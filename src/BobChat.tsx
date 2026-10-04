import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { Link } from "react-router"
import { SITE, BATTERY_POLICY } from "./data"

export interface BobMessage {
  id: string
  role: "user" | "assistant"
  text: string
}

interface Conversation {
  messages: BobMessage[]
  conversationId?: string
}

const sessions = new Map<string, Conversation>()
try {
  const saved = JSON.parse(sessionStorage.getItem('plug-bob-conversations-v2') || '[]')
  for (const [scope, conversation] of saved) if (Array.isArray(conversation.messages)) sessions.set(scope, conversation)
} catch {}
const endpoint = import.meta.env.VITE_BOB_CHAT_ENDPOINT?.trim()

export function useBobChat(scope: string, context: Record<string, unknown>, onProtectedRequest?: (rule: string) => void) {
  const [conversation, setConversation] = useState<Conversation>(
    () => sessions.get(scope) ?? { messages: [] },
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const controller = useRef<AbortController | null>(null)
  const lastRequest = useRef<Conversation | null>(null)
  const current = useRef(conversation)

  useEffect(() => () => controller.current?.abort(), [])

  const update = (next: Conversation) => {
    current.current = next
    sessions.set(scope, next)
    try { sessionStorage.setItem('plug-bob-conversations-v2', JSON.stringify([...sessions])) } catch {}
    setConversation(next)
  }

  const request = async (next: Conversation) => {
    if (controller.current) return
    const abort = new AbortController()
    controller.current = abort
    lastRequest.current = next
    setPending(true)
    setError("")
    const timeout = window.setTimeout(() => abort.abort(), 30000)
    try {
      let reply: string
      let conversationId = next.conversationId
      if (!endpoint) {
        await new Promise((resolve) => window.setTimeout(resolve, 350))
        if (abort.signal.aborted) return
        const lastUser = next.messages.filter(m => m.role === 'user').at(-1)?.text.toLowerCase() ?? ""
        if (lastUser.includes("status") || lastUser.includes("balance") || lastUser.includes("solar") || lastUser.includes("power")) {
          reply = `Current snapshot at 01 Oct 2026 14:32 IST for ${SITE.name} (${SITE.id}): Solar generation is 38 MW, demand is 44 MW, Battery 1 discharge is 6 MW, and grid import is 0 MW. Energy balance is 38 + 6 = 44 MW. Battery SOC is 72% with 3.4 MWh usable above the 55% reserve floor. Action runtime capped at 30 minutes / 3 MWh.`
        } else if (lastUser.includes("14:50") || lastUser.includes("spike") || lastUser.includes("grid") || lastUser.includes("import")) {
          reply = `At 14:50 IST, site demand is forecast to surge to 52 MW against 38 MW solar. Battery 1 provides automatic discharge up to 6 MW, leaving an 8 MW deficit. BOB recommends an 8 MW grid import for 15 minutes, which strictly requires administrator approval and expires after 10 minutes. If modified to 6 MW, a 2 MW deficit remains uncovered.`
        } else if (lastUser.includes("test") || lastUser.includes("simulation")) {
          reply = `Before activation, 7 mandatory simulation scenarios must pass: normal 6 MW discharge, 58% SOC block (<60% start threshold), stop at 55% reserve, high temperature hold, stale telemetry (>2 min delay), battery unavailable recovery, and discharge >6 MW approval gate.`
        } else if (lastUser.includes("evidence") || lastUser.includes("audit") || lastUser.includes("history")) {
          reply = `Audit evidence record for ${SITE.name}: 14:32 IST baseline established (38 MW solar, 44 MW demand, 6 MW battery discharge, 72% SOC). Historical transactions logged. All proposed grid actions enforce 10-minute expiry windows and verified control boundaries.`
        } else if (lastUser.includes("policy") || lastUser.includes("limit") || lastUser.includes("safety") || lastUser.includes("reserve")) {
          reply = `Canonical Battery Policy: Start only when demand exceeds solar by >3 MW for 5 min with SOC >60%. Automatic discharge limit: 6 MW (equipment maximum 8 MW). Stop at 55% configured reserve. Locked emergency floor: 30% SOC. Cap: 30 minutes / 3 MWh. Approvals expire in 10 minutes.`
        } else {
          reply = `Preview mode — no live AI backend is connected. BOB is operating under canonical policy: 38 MW solar + 6 MW battery discharge = 44 MW demand. The locked 30% emergency floor, 55% configured reserve, and 6 MW automatic discharge limit remain strictly protected.`
        }
      } else {
        const url = new URL(endpoint, window.location.origin)
        if (url.origin !== window.location.origin)
          throw new Error(
            "Use a same-origin server endpoint to keep API credentials private.",
          )
        const response = await fetch(url, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          signal: abort.signal,
          body: JSON.stringify({
            conversationId,
            scope,
            siteId: SITE.id,
            messages: next.messages.map(({ role, text }) => ({
              role,
              content: text,
            })),
            context,
          }),
        })
        if (!response.ok)
          throw new Error(
            response.status === 401 || response.status === 403
              ? "Your session does not have permission to use BOB. Sign in or ask an administrator."
              : `BOB is unavailable (HTTP ${response.status}). Your message is saved; retry when ready.`,
          )
        const body: unknown = await response.json()
        if (
          !body ||
          typeof body !== "object" ||
          !("reply" in body) ||
          typeof body.reply !== "string" ||
          !body.reply.trim()
        )
          throw new Error(
            "BOB returned an invalid response. Expected a non-empty reply.",
          )
        reply = body.reply
        if ("conversationId" in body && typeof body.conversationId === "string")
          conversationId = body.conversationId
      }
      if (!abort.signal.aborted)
        update({
          conversationId,
          messages: [
            ...next.messages,
            { id: crypto.randomUUID(), role: "assistant", text: reply },
          ],
        })
    } catch (failure) {
      setError(
        abort.signal.aborted
          ? "The response timed out. Your message is saved; try again."
          : failure instanceof Error
            ? failure.message
            : "Unable to reach BOB. Please retry.",
      )
    } finally {
      window.clearTimeout(timeout)
      controller.current = null
      setPending(false)
    }
  }

  const send = async (text: string) => {
    if (!text.trim() || controller.current || error) return
    const next = {
      ...current.current,
      messages: [
        ...current.current.messages,
        { id: crypto.randomUUID(), role: "user" as const, text: text.trim() },
      ],
    }
    update(next)
    const lower = text.toLowerCase()
    const soc = lower.match(/(?:reserve|floor|soc)[^\d]{0,30}(\d+)\s*%/)
    const power = lower.match(/(?:discharg\w*|automatic|auto|output|rate)[^\d]{0,30}(\d+(?:\.\d+)?)\s*mw/)
    const isBypass = /(?:disable|bypass|ignore|override|skip|turn off).*(?:safety|approval|telemetry|floor|reserve|limit|check)/.test(lower)
    if (onProtectedRequest && ((soc && Number(soc[1]) < 55) || (power && Number(power[1]) > 6) || isBypass)) {
      const warning = 'Requested change conflicts with protected limits. Automatic discharge stays at or below 6 MW, reserve stays at or above 55%, and safety checks cannot be bypassed. Approval never overrides the 8 MW equipment maximum or 30% locked floor.'
      onProtectedRequest(warning)
      update({ ...next, messages: [...next.messages, { id: crypto.randomUUID(), role: 'assistant', text: warning }] })
      return
    }
    await request(next)
  }

  return {
    messages: conversation.messages,
    pending,
    error,
    send,
    connected: Boolean(endpoint),
    retry: () => lastRequest.current && request(lastRequest.current),
    dismissError: () => setError(""),
  }
}

export type BobChatState = ReturnType<typeof useBobChat>

export function BobChatScrollArea({ children, updateKey, lastUserId, className = "" }: {
  children: ReactNode
  updateKey: string
  lastUserId?: string
  className?: string
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const armed = useRef(false)
  const previous = useRef({ updateKey, lastUserId })

  useLayoutEffect(() => {
    const element = viewport.current
    const body = content.current
    if (!element || !body) return
    if (lastUserId) {
      armed.current = true
      element.scrollTop = element.scrollHeight
    }
    const onScroll = () => {
      following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80
    }
    const observer = new ResizeObserver(() => {
      if (armed.current && following.current) element.scrollTop = element.scrollHeight
    })
    element.addEventListener("scroll", onScroll, { passive: true })
    observer.observe(body)
    return () => {
      observer.disconnect()
      element.removeEventListener("scroll", onScroll)
    }
  }, [])

  useLayoutEffect(() => {
    if (previous.current.updateKey !== updateKey) {
      armed.current = true
      if (lastUserId && previous.current.lastUserId !== lastUserId) following.current = true
      if (following.current && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight
    }
    previous.current = { updateKey, lastUserId }
  }, [updateKey, lastUserId])

  return <div ref={viewport} className={`min-h-0 min-w-0 overflow-y-auto overscroll-contain ${className}`}><div ref={content} className="flex min-w-0 flex-col gap-6">{children}</div></div>
}

export function BobMessages({ chat, variant = "default" }: { chat: BobChatState; variant?: "default" | "admin" }) {
  return (
    <div
      role="log"
      aria-label="BOB conversation"
      aria-live="polite"
      className="flex w-full min-w-0 flex-col gap-4"
    >
      {chat.messages.map((message) => (
        <div
          key={message.id}
          className={`flex min-w-0 gap-3 ${
            message.role === "user" ? "justify-end" : "items-start"
          }`}
        >
          {message.role === "assistant" && (
            <div className={variant === "admin" ? "flex size-7 shrink-0 items-center justify-center rounded-[2px] bg-[#0f62fe]" : "flex size-8 shrink-0 items-center justify-center rounded-[2px] bg-[#0f62fe] text-[10px] font-semibold text-white"}>
              {variant === "admin" ? <img alt="" src="/assets/ask-bob/0d037.svg" /> : "BOB"}
            </div>
          )}
          <div
            className={variant === "admin" ? `min-w-0 max-w-[70%] px-4 py-3 ${message.role === "user" ? "rounded-[4px] rounded-br-[2px] bg-[#e0e0e0]" : "px-0"}` : `min-w-0 max-w-[70%] rounded-[2px] border border-[#e0e0e0] p-4 ${
              message.role === "user" ? "bg-[#edf5ff]" : "bg-white"
            }`}
          >
            <p className="mb-1 text-[11px] font-semibold text-[#525252]">
              {message.role === "user"
                ? "You"
                : chat.connected
                  ? "BOB"
                  : "BOB · Preview"}
            </p>
            <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#161616] [overflow-wrap:anywhere]">
              {message.text}
            </p>
            {message.role === "assistant" && message.text.includes("conflicts with protected limits") && (
              <div className="mt-3 border-t border-[#fca5a5] pt-2">
                <Link
                  to="/protected"
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#da1e28] hover:underline"
                >
                  ⚠ View protected boundary &amp; safe alternatives →
                </Link>
              </div>
            )}
          </div>
        </div>
      ))}
      {chat.pending && (
        <p
          role="status"
          className="flex items-center gap-2 text-[13px] text-[#525252]"
        >
          <span aria-hidden="true" className="flex gap-1">
            <span className="size-1.5 rounded-full bg-[#0f62fe] motion-safe:animate-pulse" />
            <span className="size-1.5 rounded-full bg-[#0f62fe] motion-safe:animate-pulse" />
            <span className="size-1.5 rounded-full bg-[#0f62fe] motion-safe:animate-pulse" />
          </span>
          BOB is responding…
        </p>
      )}
      {chat.error && (
        <div
          role="alert"
          className="border-l-4 border-[#da1e28] bg-[#fff1f1] p-4 text-[13px] text-[#161616]"
        >
          <p>{chat.error}</p>
          <div className="mt-3 flex gap-4">
            <button
              type="button"
              onClick={chat.retry}
              className="text-[#0f62fe] underline"
            >
              Retry response
            </button>
            <button
              type="button"
              onClick={chat.dismissError}
              className="text-[#525252] underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function BobComposer({
  chat,
  draft: controlledDraft,
  onDraftChange,
  placeholder = "Ask BOB to configure, explain, or change an action",
}: {
  chat: BobChatState
  draft?: string
  onDraftChange?: (value: string) => void
  placeholder?: string
}) {
  const [localDraft, setLocalDraft] = useState("")
  const draft = controlledDraft ?? localDraft
  const setDraft = onDraftChange ?? setLocalDraft
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (!draft.trim() || chat.pending || chat.error) return
        void chat.send(draft)
        setDraft("")
      }}
      className="border-t border-[#e0e0e0] bg-white p-4"
    >
      <div className="flex min-w-0 items-end gap-3">
        <textarea
          aria-label="Message BOB"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder={placeholder}
          className="min-h-14 max-h-[25dvh] min-w-0 flex-1 resize-y rounded-t-[2px] border-b border-[#8d8d8d] bg-[#f4f4f4] px-3 py-2 text-[14px] text-[#161616] placeholder:text-[#6f6f6f] focus:outline-2 focus:outline-[#0f62fe]"
        />
        <button
          aria-label="Send message"
          type="submit"
          disabled={!draft.trim() || chat.pending || Boolean(chat.error)}
          className="flex size-11 shrink-0 items-center justify-center rounded-[2px] bg-[#0f62fe] text-xl text-white hover:bg-[#0353e9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f62fe] disabled:cursor-not-allowed disabled:bg-[#c6c6c6]"
        >
          ↑
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[#6f6f6f]">
        {chat.connected
          ? "API-backed conversation · Actions still require review and simulation."
          : "Preview conversation · API not connected. No actions are executed."}{" "}
        Shift + Enter for a new line.
      </p>
    </form>
  )
}
