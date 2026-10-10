import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { runApi } from "./api/client";
import ApprovalCard, { actionTitle, rationaleOf } from "./ApprovalCard";
import { simTime } from "./format";
import { useCurrentRun } from "./runs/useCurrentRun";


/** What BOB is waiting on a person for across every site: approvals first, soonest deadline first, then suggestions. */
function useOpenRecommendations() {
  const run = useCurrentRun().data;
  const actions = useQuery({
    queryKey: ["actions", run?.id, run?.block, "open"],
    queryFn: () => runApi.actions(run!.id, { status: ["awaiting_approval", "recommended"], limit: 50 }),
    enabled: !!run,
  }).data ?? [];
  return { run, actions };
}

/** The portfolio page's card: the open recommendations, or a plain statement that there are none. */
export function TopRecommendations({ onReview, onAsk }: { onReview: () => void; onAsk: () => void }) {
  const { actions } = useOpenRecommendations();
  const open = [...actions].sort((x, y) =>
    Number(y.status === "awaiting_approval") - Number(x.status === "awaiting_approval") ||
    (x.deadline_at ?? "").localeCompare(y.deadline_at ?? ""));
  return (
    <div className="bg-white border border-[#e0e0e0] flex flex-col gap-4 p-6 rounded-[2px]">
      {open.length ? (
        <ul className="flex flex-col divide-y divide-[#e0e0e0]">
          {open.slice(0, 3).map((a) => (
            <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-[12px] text-[#525252]">
                  <span className="font-semibold text-[#161616]">{a.site ?? "Portfolio"}</span> · {a.status === "awaiting_approval"
                    ? <>Approval needed{a.deadline_at && <> · answer by <span className="font-mono">{simTime(a.deadline_at)}</span> IST</>}</>
                    : "Recommended"}
                </p>
                <p className="text-[15px] font-semibold text-[#161616]">{actionTitle(a)}</p>
                <p className="text-[13px] text-[#525252]">{rationaleOf(a)}</p>
              </div>
              <button onClick={onReview} className="min-h-11 border border-[#0f62fe] px-4 text-[14px] font-semibold text-[#0f62fe] hover:bg-[#edf5ff] cursor-pointer">Review</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-[#525252]">No recommendation right now; BOB is acting within its limits.</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {open.length > 3 && <p className="text-[13px] text-[#525252]">{open.length - 3} more open</p>}
        <button onClick={onAsk} className="min-h-11 border border-[#0f62fe] bg-white px-4 text-[14px] font-semibold text-[#0f62fe] hover:bg-[#edf5ff] cursor-pointer">Ask BOB</button>
      </div>
    </div>
  );
}

interface AIRecommendationsProps {
  onBack: () => void;
  onOpenSite?: () => void;
}

export default function AIRecommendations({ onBack, onOpenSite }: AIRecommendationsProps) {
  const navigate = useNavigate();
  const { run, actions } = useOpenRecommendations();
  const attention = actions.filter((a) => a.status === "awaiting_approval");
  const others = actions.filter((a) => a.status === "recommended");
  return (
    <div className="bg-[#f4f4f4] min-h-screen w-full">
      {/* Content */}
      <div className="flex flex-col gap-6 items-start p-8 w-full">
        {/* Page heading */}
        <div className="flex flex-col gap-1.5 items-start w-full">
          <button onClick={onBack} className="flex gap-[7px] items-center font-['IBM Plex Sans:Medium'] font-medium text-[#0f62fe] text-[14px] hover:underline cursor-pointer pb-1 max-sm:flex-wrap" style={{ fontVariationSettings: '"wdth" 100' }}>
            <span className="text-[16px]">←</span>
            <span>Back to portfolio</span>
          </button>
          <p className="font-['IBM Plex Sans:SemiBold'] font-semibold leading-[1.35] text-[#161616] text-[26px] sm:text-[32px]" style={{ fontVariationSettings: '"wdth" 100' }}>All AI recommendations</p>
          <p className="font-['IBM Plex Sans:Regular'] font-normal leading-[1.35] text-[#525252] text-[14px] max-w-4xl" style={{ fontVariationSettings: '"wdth" 100' }}>
            AI-generated recommendations across every registered site. Understand the rationale, ask BOB, then open the site or configure an action. Nothing executes until its approval policy is satisfied.
          </p>
        </div>

        {/* List heading */}
        <div className="flex flex-wrap gap-3 items-center justify-between w-full">
          <div className="flex flex-col gap-1 items-start">
            <p className="font-['IBM Plex Sans:SemiBold'] font-semibold leading-[1.35] text-[#161616] text-[20px]" style={{ fontVariationSettings: '"wdth" 100' }}>Recommendations requiring attention</p>
            <p className="font-['IBM Plex Sans:Regular'] font-normal leading-[1.35] text-[#525252] text-[13px]" style={{ fontVariationSettings: '"wdth" 100' }}>{attention.length ? `${attention.length} waiting for a decision, soonest deadline first` : "Nothing is waiting for a decision"}</p>
          </div>
          <div className="bg-white border border-[#e0e0e0] flex items-center px-[9px] py-[5px] rounded-[2px] max-sm:flex-wrap">
            <p className="font-['IBM Plex Sans:Medium'] font-medium leading-[1.35] text-[#161616] text-[12px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Sorted by priority</p>
          </div>
        </div>

        {/* Primary recommendation cards */}
        <div className="flex flex-col gap-3.5 items-start w-full">
          {[...attention].sort((x, y) => (x.deadline_at ?? "").localeCompare(y.deadline_at ?? "")).map((a) => (
            <ApprovalCard key={a.id} action={a} runId={run!.id} onOpenSite={onOpenSite} />
          ))}
        </div>

        {/* Other recommendations heading */}
        <div className="flex flex-wrap gap-3 items-center justify-between w-full">
          <p className="font-['IBM Plex Sans:SemiBold'] font-semibold leading-[1.35] text-[#161616] text-[20px]" style={{ fontVariationSettings: '"wdth" 100' }}>Other recommendations</p>
          <button disabled className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[14px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{others.length} recommended by BOB</button>
        </div>

        {/* Compact cards */}
        <div className="flex gap-4 items-start w-full flex-wrap">
          {others.length === 0 && <p className="text-[13px] text-[#525252]">BOB has no other recommendations right now.</p>}
          {others.map((a) => (
            <div key={a.id} className="bg-white border border-[#e0e0e0] flex flex-col gap-2.5 items-start p-[18px] rounded-[2px] flex-1 min-w-0 basis-full sm:basis-[260px]">
              <div className="flex gap-2 items-start max-sm:flex-wrap">
                <p className="font-['IBM Plex Sans:SemiBold'] font-semibold leading-[1.35] text-[#161616] text-[14px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{a.site ?? "Portfolio"}</p>
                <div className="bg-[#f6f2ff] flex items-center px-[9px] py-[5px] rounded-[2px] shrink-0">
                  <p className="font-['IBM Plex Sans:Medium'] font-medium leading-[1.35] text-[12px] whitespace-nowrap max-sm:whitespace-normal text-[#6929c4]" style={{ fontVariationSettings: '"wdth" 100' }}>Recommended</p>
                </div>
              </div>
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold leading-[1.35] text-[#161616] text-[16px] w-full" style={{ fontVariationSettings: '"wdth" 100' }}>{actionTitle(a)}</p>
              <p className="font-['IBM Plex Sans:Regular'] font-normal leading-[1.35] text-[#525252] text-[13px] w-full" style={{ fontVariationSettings: '"wdth" 100' }}>{rationaleOf(a)}</p>
              <div className="flex gap-3 items-center flex-wrap pt-1">
                <button onClick={() => navigate('/askBob')} className="font-['IBM Plex Sans:Medium'] font-medium text-[#0f62fe] text-[13px] hover:underline cursor-pointer whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Ask BOB</button>
                <button onClick={() => onOpenSite ? onOpenSite() : navigate('/siteDetail')} className="font-['IBM Plex Sans:Medium'] font-medium text-[#0f62fe] text-[13px] hover:underline cursor-pointer whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Open site</button>
                <button onClick={() => navigate('/agentChat')} className="font-['IBM Plex Sans:Medium'] font-medium text-[#0f62fe] text-[13px] hover:underline cursor-pointer whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Set up action →</button>
              </div>
            </div>
          ))}
        </div>

        {/* Results footer */}
        <div className="flex flex-wrap gap-3 items-center justify-between w-full">
          <p className="font-['IBM Plex Sans:Regular'] font-normal leading-[1.35] text-[#525252] text-[13px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Showing {actions.length} open recommendations from the live run</p>
        </div>
      </div>
    </div>
  );
}
