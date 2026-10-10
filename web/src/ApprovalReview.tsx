import { Link } from 'react-router';
import ApprovalCard from './ApprovalCard';
import { SITE } from './data';
import { AUTONOMY, limitsSummary } from './format';
import { useSite } from './site';

const assetPathPrefix = '/assets';
const imgBrainCog = `${assetPathPrefix}/71557.svg`;
const imgXCircle = `${assetPathPrefix}/179e0.svg`;

function ibm(w: 'Regular' | 'Medium' | 'SemiBold' | 'Bold', extra = '') {
  const wMap = { Regular: 'font-normal', Medium: 'font-medium', SemiBold: 'font-semibold', Bold: 'font-bold' };
  return { className: `font-sans ${wMap[w]} ${extra}` };
}

export default function ApprovalReview({ onBack }: { onBack: () => void }) {
  const { run, approvals, configs, battery, floorPct } = useSite();

  return (
    <div className="bg-[#f4f4f4] flex flex-col min-h-screen w-full font-sans">
      <div className="bg-white border-b border-[#e0e0e0] flex min-h-14 flex-wrap gap-3 items-center justify-between py-3 px-6 shrink-0">
        <div className="flex gap-4 items-center">
          <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-8">
            <img alt="" className="size-5" src={imgBrainCog} />
          </div>
          <p {...ibm('SemiBold', 'text-[#161616] text-[16px]')}>{SITE.name} · Approvals</p>
          <div className="bg-[#fef3c7] border border-[#f59e0b]/40 px-2.5 py-1 rounded-[2px]">
            <p {...ibm('SemiBold', 'text-[#b26207] text-[11px] font-mono tracking-tight')}>{approvals.length} waiting</p>
          </div>
        </div>
        <button onClick={onBack} aria-label="Close approvals" className="border border-[#e0e0e0] flex items-center justify-center rounded-[2px] size-8 hover:bg-[#f4f4f4] transition-colors cursor-pointer">
          <img alt="" className="size-4" src={imgXCircle} />
        </button>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row min-w-0">
        <div className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8">
          <div className="max-w-2xl mx-auto flex flex-col gap-6">
            {approvals.length === 0 && (
              <div className="bg-white border border-[#e0e0e0] p-5 rounded-[2px]">
                <p {...ibm('SemiBold', 'text-[#161616] text-[14px]')}>No approval is waiting at this site</p>
                <p {...ibm('Regular', 'text-[#525252] text-[13px] mt-1')}>BOB asks here when an action is above its automatic limit. An unanswered request expires at its deadline and BOB plans without it.</p>
              </div>
            )}
            {run && approvals.map((action) => <ApprovalCard key={action.id} action={action} runId={run.id} />)}
            <button onClick={onBack} className="border border-[#e0e0e0] flex items-center gap-2 px-4 py-2.5 rounded-[2px] hover:bg-[#f4f4f4] cursor-pointer self-start transition-colors">
              <p {...ibm('Medium', 'text-[#161616] text-[13px]')}>← Back to live monitoring</p>
            </button>
          </div>
        </div>

        <div className="bg-white border-l border-[#e0e0e0] flex flex-col w-full lg:w-[300px] shrink-0">
          <div className="border-b border-[#e0e0e0] px-5 py-4">
            <p {...ibm('SemiBold', 'text-[#161616] text-[15px]')}>Policy context</p>
          </div>
          <div className="flex flex-col gap-4 p-5 overflow-y-auto">
            <Link to="/protected" className="text-sm text-[#0f62fe] hover:text-[#0043ce] underline">Review protected limits</Link>
            {configs.map((c) => (
              <div key={c.id}>
                <p {...ibm('SemiBold', 'text-[#161616] text-[13px] mb-2')}>{c.name}</p>
                {[AUTONOMY[c.autonomy].label, ...limitsSummary(c.limits), `Answer within ${c.approval.response_min ?? 10} min`].map((line) => (
                  <p key={line} {...ibm('Regular', 'text-[#525252] text-[12px] py-1 border-b border-[#f4f4f4] last:border-0')}>{line}</p>
                ))}
              </div>
            ))}
            {battery && (
              <div className="bg-[#f4f4f4] border border-[#e0e0e0] p-3 rounded-[2px]">
                <p {...ibm('SemiBold', 'text-[#525252] text-[12px] mb-1')}>{battery.name}</p>
                <p {...ibm('Regular', 'text-[#525252] text-[12px]')}>
                  Charge <span className="font-mono font-medium">{battery.soc_pct}%</span> · {battery.mw > 0 ? 'discharging' : battery.mw < 0 ? 'charging' : 'idle'} <span className="font-mono font-medium">{Math.abs(battery.mw)} MW</span>
                  {floorPct !== null && <> · locked floor <span className="font-mono font-medium">{floorPct}%</span></>}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
