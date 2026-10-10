import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { runApi, type ChatItem } from "./api/client"
import { SITE } from "./data"

export interface BobMessage {
  id: string
  role: "user" | "assistant"
  text: string
}

// The new UI shows text only; a reply that is only a card would be an empty bubble.
const toMessages = (items: ChatItem[]): BobMessage[] =>
  items.filter((item) => item.text).map((item) => ({ id: String(item.id), role: item.role, text: item.text }))
const reason = (failure: unknown) => failure instanceof Error ? failure.message : "Unable to reach BOB. Please retry."

export function useBobChat(scope: string) {
  const [runId, setRunId] = useState<number>()
  const [messages, setMessages] = useState<BobMessage[]>([])
  const [reply, setReply] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const last = useRef("")

  const load = async () => {
    setError("")
    try {
      const run = await runApi.current()
      setMessages(toMessages(await runApi.chat(run.id)))
      setRunId(run.id)
    } catch (failure) {
      setError(reason(failure))
    }
  }

  useEffect(() => { void load() }, [])

  const ask = async (text: string) => {
    if (!runId) return
    last.current = text
    setPending(true)
    setError("")
    try {
      await runApi.ask(runId, text, `${SITE.id}, ${scope} screen`, (event) => {
        // A status means the text so far was a preamble to a tool call.
        if (event.event === "status") setReply("")
        else if (event.event === "delta") setReply((so) => so + event.data)
        else setMessages(toMessages(event.data))
      })
    } catch (failure) {
      setError(reason(failure))
    } finally {
      setReply("")
      setPending(false)
    }
  }

  return {
    messages,
    reply,
    pending,
    error,
    ready: runId !== undefined,
    send: async (text: string) => {
      if (!text.trim() || pending || error || !runId) return
      setMessages((so) => [...so, { id: `new-${so.length}`, role: "user", text: text.trim() }])
      await ask(text.trim())
    },
    retry: () => (runId ? ask(last.current) : load()),
    dismissError: () => setError(""),
    reset: async () => {
      if (!runId || pending) return
      try {
        await runApi.clearChat(runId)
        setMessages([])
        setError("")
      } catch (failure) {
        setError(reason(failure))
      }
    },
  }
}

export type BobChatState = ReturnType<typeof useBobChat>

/** BOB's reply as GitHub-flavoured markdown; raw HTML in it is shown as text, never rendered. */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="bob-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>
        {text}
      </ReactMarkdown>
    </div>
  )
}

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
              {message.role === "user" ? "You" : "BOB"}
            </p>
            {message.role === "assistant" ? <Markdown text={message.text} /> : (
              <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#161616] [overflow-wrap:anywhere]">
                {message.text}
              </p>
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
      {chat.reply && <div className="pl-11"><Markdown text={chat.reply} /></div>}
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
          className="flex size-11 shrink-0 items-center justify-center rounded-[2px] bg-[#0f62fe] text-xl text-white hover:bg-[#0043ce] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f62fe] disabled:cursor-not-allowed disabled:bg-[#c6c6c6] cursor-pointer"
        >
          ↑
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[#6f6f6f]">
        Actions still require review and simulation. Shift + Enter for a new line.
      </p>
    </form>
  )
}

export function BobNewChat({ chat }: { chat: BobChatState }) {
  return (
    <button
      type="button"
      onClick={() => { if (window.confirm("Start a new chat? BOB forgets this conversation.")) void chat.reset() }}
      disabled={!chat.ready || chat.pending || !chat.messages.length}
      className="min-h-8 rounded-[2px] border border-[#e0e0e0] bg-white px-3 text-[13px] text-[#161616] hover:bg-[#f4f4f4] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
    >
      New chat
    </button>
  )
}
