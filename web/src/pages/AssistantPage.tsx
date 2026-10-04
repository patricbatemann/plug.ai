import { Chat } from '../runs/AskBob'

export function AssistantPage() {
  return (
    <>
      <h1 className="page-title">Ask BOB</h1>
      <p className="page-meta">
        Questions about decisions, assets and approvals; what-if plans; drafting action setups. BOB never executes
        actions or activates a setup from chat.
      </p>
      <div className="assistant">
        <Chat />
      </div>
    </>
  )
}
