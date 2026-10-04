import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useOperations } from './Operations';
import { BATTERY_POLICY, SITE, SNAPSHOT_14_32, SNAPSHOT_14_50 } from './data';
import type { ActionConfig } from './AgentChat';

const assetPathPrefix = '/assets';
const imgBrainCog = `${assetPathPrefix}/71557.svg`;
const imgBot = `${assetPathPrefix}/0d037.svg`;
const imgCheck1 = `${assetPathPrefix}/f6f5a.svg`;
const imgArrowRight = `${assetPathPrefix}/21c0f.svg`;
const imgXCircle = `${assetPathPrefix}/179e0.svg`;

interface ApprovalReviewProps {
  config: ActionConfig;
  onBack: () => void;
  onApprove: (mw: number) => void;
  onReject: () => void;
}

function ibm(w: 'Regular' | 'Medium' | 'SemiBold' | 'Bold', extra = '') {
  const wMap = { Regular: 'normal', Medium: 'medium', SemiBold: 'semibold', Bold: 'bold' };
  return { className: `font-['IBM Plex Sans:${w}'] font-${wMap[w]} ${extra}`, style: { fontVariationSettings: '"wdth" 100' } };
}

type Decision = 'pending' | 'approved_8' | 'approved_6' | 'rejected' | 'expired';

export default function ApprovalReview({ config, onBack, onApprove, onReject }: ApprovalReviewProps) {
  const operations = useOperations();
  const request = operations.state.approval;
  const decision: Decision = request?.decision === 'approved' ? request.mw === 8 ? 'approved_8' : 'approved_6' : request?.decision ?? 'expired';
  const [customMW, setCustomMW] = useState(request?.mw ?? 8);
  const [showModify, setShowModify] = useState(request?.decision === 'pending' && request.mw !== 8);
  const updateProposedMW = (mw: number) => {
    setCustomMW(mw);
    operations.setState(current => current.approval?.decision === 'pending' ? { ...current, approval: { ...current.approval, mw } } : current);
  };
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const expiryCountdown = Math.max(0, Math.ceil(((request?.deadline ?? now) - now) / 1000));
  const canApprove = operations.state.role === 'administrator' && expiryCountdown > 0;

  const isPending = decision === 'pending';
  const isApproved = decision.startsWith('approved');
  const isRejected = decision === 'rejected';
  const approvedMW = decision === 'approved_8' ? 8 : decision === 'approved_6' ? 6 : 0;

  // At 14:50: demand=52, solar=38, battery=6 (auto limit). Deficit=8 MW
  const deficit = operations.flow.deficit;
  const coveredAfterApproval = (mw: number) => 38 + operations.flow.battery + mw;
  const remainingDeficit = (mw: number) => Math.max(0, 52 - coveredAfterApproval(mw));

  const handleApprove = (mw: number) => {
    if (canApprove) operations.decide('approved', mw);
  };

  return (
    <div className="bg-[#f4f4f4] flex flex-col min-h-screen w-full">

      {/* Header */}
      <div className="bg-white border-b border-[#e5e7eb] flex min-h-14 flex-wrap gap-3 items-center justify-between py-3 px-6 shrink-0">
        <div className="flex gap-4 items-center">
          <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-8">
            <img alt="" className="size-5" src={imgBrainCog} />
          </div>
          <p {...ibm('SemiBold', 'text-[#1f2937] text-[16px]')}>{SITE.name} · Approval required</p>
          <div className="bg-[#fff8e1] px-2 py-1 rounded-[2px]">
            <p {...ibm('SemiBold', 'text-[#e6a817] text-[11px]')}>{operations.approvalState ?? "No approval request"}</p>
          </div>
        </div>
        <button onClick={onBack} className="border border-[#e5e7eb] flex items-center justify-center rounded-[2px] size-8 hover:bg-[#f4f4f4] cursor-pointer">
          <img alt="" className="size-4" src={imgXCircle} />
        </button>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row min-w-0">
        <div className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8">
          <div className="max-w-2xl mx-auto flex flex-col gap-6">

            {/* Urgency banner */}
            {isPending && (
              <div className="bg-[#fff8e1] border border-[#fcd34d]/60 flex gap-4 items-start p-4 rounded-[2px]">
                <div className="bg-[#e6a817] rounded-full size-2 mt-1.5 shrink-0 animate-pulse" />
                <div>
                  <p {...ibm('SemiBold', 'text-[#92400e] text-[14px]')}>Approval required within {config.automation.approvalExpiryMin} minutes</p>
                  <p {...ibm('Regular', 'text-[#78350f] text-[13px] mt-1 leading-relaxed')}>
                    Requested at 01 Oct 2026, 14:50 IST. Expires at 15:00 IST. If not approved, the request will expire and the deficit will remain uncovered.
                  </p>
                </div>
              </div>
            )}

            {/* BOB recommendation */}
            <div className="bg-white border border-[#e5e7eb] rounded-[2px] overflow-hidden">
              <div className="bg-[#f9fafb] border-b border-[#e5e7eb] flex gap-3 items-center px-5 py-3">
                <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-7">
                  <img alt="" className="size-4" src={imgBot} />
                </div>
                <p {...ibm('SemiBold', 'text-[#1f2937] text-[14px]')}>BOB recommendation · 14:50 IST</p>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <div className="border-l-4 border-[#ff832b] bg-[#fff4e5] p-3 text-xs text-[#8a3800]">Duration boundary: at 14:50 the canonical battery action has 12 minutes left and stops at 15:02 IST (30 minutes / 3 MWh). An 8 MW grid import lasting until 15:05 covers demand only while the battery supplies 6 MW. If demand remains 52 MW after 15:02, another 6 MW source or explicit load shedding is required. No automatic battery extension is allowed.</div>
                <p {...ibm('Regular', 'text-[#1f2937] text-[14px] leading-relaxed')}>
                  Site demand is 52 MW. Solar generates 38 MW and Battery 1 supplies {operations.flow.battery} MW. The current {operations.flow.deficit} MW deficit cannot be covered automatically.
                </p>
                <p {...ibm('Regular', 'text-[#1f2937] text-[14px] leading-relaxed')}>
                  I recommend importing <strong>8 MW from the grid for 15 minutes</strong>. At the canonical 6 MW battery output this covers demand. Current projected remaining deficit after an 8 MW import: {remainingDeficit(8)} MW. No import executes without verified permissions, fresh telemetry, and safety checks.
                </p>

                {/* Energy breakdown */}
                <div className="bg-[#f9fafb] p-4 rounded-[2px]">
                  <p {...ibm('SemiBold', 'text-[#1f2937] text-[13px] mb-3')}>Proposed energy balance at 14:50 IST (not executing)</p>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: 'Solar generation', value: `${SNAPSHOT_14_50.solar} MW`, color: '#f59e0b' },
                      { label: 'Battery 1 (current output)', value: `${operations.flow.battery} MW`, color: '#0f62fe' },
                      { label: 'Grid import (proposed)', value: `${customMW} MW`, color: '#94a3b8', proposed: true },
                      { label: 'Supply if approved AND safely executed', value: `${coveredAfterApproval(customMW)} MW`, color: '#10b981', bold: true },
                      { label: 'Site demand', value: `${SNAPSHOT_14_50.demand} MW`, color: '#6366f1', bold: true },
                    ].map(item => (
                      <div key={item.label} className={`flex flex-wrap gap-3 items-center justify-between ${item.bold ? 'border-t border-[#e5e7eb] pt-2 mt-1' : ''}`}>
                        <p {...ibm(item.bold ? 'SemiBold' : 'Regular', 'text-[13px] text-[#525252]')}>{item.label}{item.proposed ? ' ⬤' : ''}</p>
                        <p {...ibm(item.bold ? 'Bold' : 'SemiBold', 'text-[14px]')} style={{ color: item.color }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <p {...ibm('Regular', 'text-[#94a3b8] text-[11px] mt-2')}>⬤ Proposed — pending approval</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-[#e8f1ff] p-3 rounded-[2px]">
                    <p {...ibm('SemiBold', 'text-[#0f62fe] text-[12px] mb-1')}>If approved at 8 MW</p>
                    <p {...ibm('Regular', 'text-[#1e3a8a] text-[12px] leading-relaxed')}>38 + 6 + 8 = 52 MW. Demand fully covered. No deficit.</p>
                  </div>
                  <div className="bg-[#fff8e1] p-3 rounded-[2px]">
                    <p {...ibm('SemiBold', 'text-[#e6a817] text-[12px] mb-1')}>If approved at 6 MW</p>
                    <p {...ibm('Regular', 'text-[#78350f] text-[12px] leading-relaxed')}>38 + 6 + 6 = 50 MW. 2 MW deficit remains uncovered. Load-shedding or further action required.</p>
                  </div>
                  <div className="bg-[#fef2f2] p-3 rounded-[2px]">
                    <p {...ibm('SemiBold', 'text-[#dc2626] text-[12px] mb-1')}>If rejected</p>
                    <p {...ibm('Regular', 'text-[#7f1d1d] text-[12px] leading-relaxed')}>8 MW deficit remains. Recovery behavior activates. Operations team alerted.</p>
                  </div>
                  <div className="bg-[#f4f4f4] p-3 rounded-[2px]">
                    <p {...ibm('SemiBold', 'text-[#525252] text-[12px] mb-1')}>If expired ({config.automation.approvalExpiryMin} min timeout)</p>
                    <p {...ibm('Regular', 'text-[#525252] text-[12px] leading-relaxed')}>Request times out. Same as rejection. New approval request required.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Decision controls */}
            {isPending && !showModify && (
              <div className="flex flex-col gap-4">
                <p {...ibm('SemiBold', 'text-[#1f2937] text-[15px]')}>Your decision · {Math.floor(expiryCountdown / 60)}m {expiryCountdown % 60}s remaining</p>
                <div className="flex gap-3 flex-wrap">
                  <button disabled={!canApprove} onClick={() => handleApprove(8)}
                    className="bg-[#10b981] flex items-center gap-2 px-5 py-3 rounded-[2px] hover:bg-[#059669] transition-colors cursor-pointer">
                    <p {...ibm('SemiBold', 'text-white text-[14px]')}>Approve — 8 MW for 15 min</p>
                  </button>
                  <button onClick={() => setShowModify(true)}
                    className="border border-[#0f62fe] flex items-center gap-2 px-5 py-3 rounded-[2px] hover:bg-[#e8f1ff] transition-colors cursor-pointer">
                    <p {...ibm('SemiBold', 'text-[#0f62fe] text-[14px]')}>Modify and approve</p>
                  </button>
                  <button disabled={!canApprove} onClick={() => operations.decide('rejected')}
                    className="border border-[#dc2626]/40 flex items-center gap-2 px-5 py-3 rounded-[2px] hover:bg-[#fef2f2] transition-colors cursor-pointer">
                    <p {...ibm('SemiBold', 'text-[#dc2626] text-[14px]')}>Reject</p>
                  </button>
                </div>
              </div>
            )}

            {/* Modify form */}
            {isPending && showModify && (
              <div className="bg-white border border-[#e5e7eb] p-5 rounded-[2px] flex flex-col gap-4">
                <p {...ibm('SemiBold', 'text-[#1f2937] text-[14px]')}>Modify grid import quantity</p>
                <div className="flex items-center gap-4">
                  <p {...ibm('Regular', 'text-[#525252] text-[13px]')}>Import quantity</p>
                  <div className="flex items-center gap-2">
                    <button aria-label="Set import to 6 MW" onClick={() => updateProposedMW(6)} className="border border-[#e5e7eb] flex items-center justify-center rounded-[2px] size-8 hover:bg-[#f4f4f4] cursor-pointer text-[16px]">−</button>
                    <span {...ibm('Bold', 'text-[#1f2937] text-[18px] w-20 text-center')}>{customMW} MW</span>
                    <button aria-label="Set import to 8 MW" onClick={() => updateProposedMW(8)} className="border border-[#e5e7eb] flex items-center justify-center rounded-[2px] size-8 hover:bg-[#f4f4f4] cursor-pointer text-[16px]">+</button>
                  </div>
                </div>
                {remainingDeficit(customMW) > 0 && (
                  <div className="bg-[#fff8e1] border border-[#fcd34d]/40 p-3 rounded-[2px]">
                    <p {...ibm('SemiBold', 'text-[#e6a817] text-[13px]')}>⚠ {remainingDeficit(customMW)} MW deficit will remain uncovered</p>
                    <p {...ibm('Regular', 'text-[#78350f] text-[12px] mt-1')}>38 + 6 + {customMW} = {coveredAfterApproval(customMW)} MW of 52 MW demand. Additional action required for remaining deficit.</p>
                  </div>
                )}
                {remainingDeficit(customMW) === 0 && (
                  <div className="bg-[#e6f4ea] p-3 rounded-[2px]">
                    <p {...ibm('Medium', 'text-[#1a7f37] text-[13px]')}>✓ 38 + 6 + {customMW} = {coveredAfterApproval(customMW)} MW — demand fully covered</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button disabled={!canApprove} onClick={() => handleApprove(customMW)}
                    className="bg-[#10b981] px-5 py-2.5 rounded-[2px] hover:bg-[#059669] cursor-pointer">
                    <p {...ibm('SemiBold', 'text-white text-[13px]')}>Approve {customMW} MW</p>
                  </button>
                  <button onClick={() => { updateProposedMW(8); setShowModify(false); }} className="border border-[#e5e7eb] px-5 py-2.5 rounded-[2px] hover:bg-[#f4f4f4] cursor-pointer">
                    <p {...ibm('Medium', 'text-[#1f2937] text-[13px]')}>Cancel</p>
                  </button>
                </div>
              </div>
            )}

            {/* Outcome */}
            {!isPending && (
              <div className={`flex gap-3 items-center p-5 rounded-[2px] ${isApproved ? 'bg-[#e6f4ea] border border-[#10b981]/40' : 'bg-[#fef2f2] border border-[#dc2626]/30'}`}>
                <div className={`flex items-center justify-center rounded-full size-6 ${isApproved ? 'bg-[#10b981]' : 'bg-[#dc2626]'}`}>
                  {isApproved ? <img alt="" className="size-3.5" src={imgCheck1} /> : <p className="text-white text-[10px] font-bold">✕</p>}
                </div>
                <div>
                  <p {...ibm('SemiBold', `${isApproved ? 'text-[#1a7f37]' : 'text-[#dc2626]'} text-[14px]`)}>
                    {isApproved ? `Approved — ${approvedMW} MW for 15 min; ${request?.executable ? 'Executing in preview' : 'execution held'}` : decision === 'expired' ? 'Expired — fresh approval required' : 'Rejected — recovery behavior activated'}
                  </p>
                  <p {...ibm('Regular', 'text-[#525252] text-[12px] mt-0.5')}>{request?.executable ? `Simulated import ${operations.flow.grid} MW; ${operations.flow.deficit} MW deficit remains. No real equipment command sent.` : `Execution held: verified control permission, fresh telemetry, safe checks, and the planned battery output are required. Current grid import ${operations.flow.grid} MW; ${operations.flow.deficit} MW deficit remains.`}</p>
                </div>
              </div>
            )}

            <Link to="/audit" className="inline-flex min-h-11 items-center text-sm text-[#0f62fe]">View approval audit and notifications</Link>
            <button onClick={isApproved ? () => onApprove(approvedMW) : isRejected ? onReject : onBack} className="border border-[#e5e7eb] flex items-center gap-2 px-4 py-2.5 rounded-[2px] hover:bg-[#f4f4f4] cursor-pointer self-start">
              <p {...ibm('Medium', 'text-[#1f2937] text-[13px]')}>← Back to live monitoring</p>
            </button>
          </div>
        </div>

        {/* Right: policy context */}
        <div className="bg-white border-l border-[#e5e7eb] flex flex-col w-full lg:w-[300px] shrink-0">
          <div className="border-b border-[#e5e7eb] px-5 py-4">
            <p {...ibm('SemiBold', 'text-[#1f2937] text-[15px]')}>Policy context</p>
          </div>
          <div className="flex flex-col gap-4 p-5 overflow-y-auto"><p className="text-xs text-[#525252]">{canApprove ? "Administrator preview permission verified" : "Approval is restricted to administrators. Change the preview role in Audit to test this branch."}</p><Link to="/audit" className="text-sm text-[#0f62fe]">Review permissions</Link>
            <div>
              <p {...ibm('SemiBold', 'text-[#1f2937] text-[13px] mb-2')}>Configured limits</p>
              {[
                ['Auto limit', `≤ ${config.automation.approvalAboveMW} MW (no approval)`],
                ['Approval required', `> ${config.automation.approvalAboveMW} MW`],
                ['Approval expires', `${config.automation.approvalExpiryMin} min`],
                ['Equipment maximum', `${BATTERY_POLICY.equipmentMaxMW} MW`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-2 py-1.5 border-b border-[#f4f4f4] last:border-0">
                  <p {...ibm('Regular', 'text-[#525252] text-[12px]')}>{label}</p>
                  <p {...ibm('SemiBold', 'text-[#1f2937] text-[12px] text-right')}>{value}</p>
                </div>
              ))}
            </div>
            <div className="bg-[#fff8e1] border border-[#fcd34d]/40 p-3 rounded-[2px]">
              <p {...ibm('SemiBold', 'text-[#92400e] text-[12px] mb-1')}>Grid import policy</p>
              <p {...ibm('Regular', 'text-[#78350f] text-[12px] leading-relaxed')}>Grid import is never started automatically. Any import above 0 MW requires explicit administrator approval. BOB can only recommend, not execute.</p>
            </div>
            <div className="bg-[#f4f4f4] p-3 rounded-[2px]">
              <p {...ibm('SemiBold', 'text-[#525252] text-[12px] mb-1')}>Battery status</p>
              <p {...ibm('Regular', 'text-[#525252] text-[12px]')}>SOC: {operations.flow.soc}% · Discharge: {BATTERY_POLICY.autoMaxMW} MW (at limit)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
