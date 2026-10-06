import { Link } from 'react-router-dom'
import { ArrowLeft, Bot } from '@carbon/icons-react'
import { Chat } from '../runs/AskBob'
import { useCurrentRun } from '../runs/useCurrentRun'

export function AssistantPage() {
  const { data: run } = useCurrentRun()
  return (
    <>
      <div className="review-bar">
        <span className="bob-mark"><Bot size={20} /></span>
        <h1>Ask BOB</h1>
        <span className={`badge badge--${run?.bob_online ? 'blue' : 'gray'}`}>{run?.bob_online ? 'BOB online' : 'Rules only'}</span>
      </div>
      <Link to="/portfolio" className="text-link text-link--icon back-link assistant__back"><ArrowLeft size={16} />Back</Link>
      <div className="assistant">
        <Chat />
      </div>
    </>
  )
}
