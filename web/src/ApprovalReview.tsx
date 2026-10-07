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
  const wMap = { Regular: 'font-normal', Medium: 'font-medium', SemiBold: 'font-semibold', Bold: 'font-bold' };
  return { className: `font-sans ${wMap[w]} ${extra}` };
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
    <div className="bg-[#f4f4f4] flex flex-col min-h-screen w-full font-sans">

      {/* Header */}
      <div className="bg-white border-b border-[#e0e0e0] flex min-h-14 flex-wrap gap-3 items-center justify-between py-3 px-6 shrink-0">
        <div className="flex gap-4 items-center">
          <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-8">
            <img alt="" className="size-5" src={imgBrainCog} />
          </div>
          <p {...ibm('SemiBold', 'text-[#161616] text-[16px]')}>{SITE.name} · Approval required</p>
          <div className="bg-[#fef3c7] border border-[#f59e0b]/40 px-2.5 py-1 rounded-[2px]">
            <p {...ibm('SemiBold', 'text-[#b26207] text-[11px] font-mono tracking-tight')}>{operations.approvalState ?? "No approval request"}</p>
          </div>
        </div>
        <button onClick={onBack} className="border border-[#e0e0e0] flex items-center justify-center rounded-[2px] size-8 hover:bg-[#f4f4f4] transition-colors cursor-pointer">
          <img alt="" className="size-4" src={imgXCircle} />
        </button>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row min-w-0">
        <div className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8">
          <div className="max-w-2xl mx-auto flex flex-col gap-6">

            {/* Urgency banner */}
            {isPending && (
              <div className="bg-[#fef3c7] border border-[#f59e0b]/60 flex gap-4 items-start p-4 rounded-[2px]">
                <div className="bg-[#b26207] rounded-full size-2 mt-1.5 shrink-0 animate-pulse" />
                <div>
                  <p {...ibm('SemiBold', 'text-[#78350f] text-[14px]')}>Approval required within <span className="font-mono font-bold">{config.automation.approvalExpiryMin}</span> minutes</p>
                  <p {...ibm('Regular', 'text-[#78350f] text-[13px] mt-1 leading-relaxed')}>
                    Requested at <span className="font-mono">01 Oct 2026, 14:50 IST</span>. Expires at <span className="font-mono">15:00 IST</span>. If not approved, the request will expire and the deficit will remain uncovered.
                  </p>
                </div>
              </div>
            )}

            {/* BOB recommendation */}
            <div className="bg-white border border-[#e0e0e0] rounded-[2px] overflow-hidden">
              <div className="bg-[#f4f4f4] border-b border-[#e0e0e0] flex gap-3 items-center px-5 py-3">
                <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-7">
                  <img alt="" className="size-4" src={imgBot} />
                </div>
                <p {...ibm('SemiBold', 'text-[#161616] text-[14px]')}>BOB recommendation · <span className="font-mono">14:50 IST</span></p>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <div className="border-l-4 border-[#ff832b] bg-[#fff4e5] p-3 text-xs text-[#8a3800] leading-relaxed">Duration boundary: at 14:50 the canonical battery action has <span className="font-mono font-semibold">12 minutes</span> left and stops at <span className="font-mono font-semibold">15:02 IST</span> (30 minutes / 3 MWh). An 8 MW grid import lasting until 15:05 covers demand only while the battery supplies 6 MW. If demand remains 52 MW after 15:02, another 6 MW source or explicit load shedding is required. No automatic battery extension is allowed.</div>
                <p {...ibm('Regular', 'text-[#161616] text-[14px] leading-relaxed')}>
                  Site demand is <span className="font-mono font-semibold">52 MW</span>. Solar generates <span className="font-mono font-semibold">38 MW</span> and Battery 1 supplies <span className="font-mono font-semibold">{operations.flow.battery} MW</span>. The current <span className="font-mono font-semibold">{operations.flow.deficit} MW</span> deficit cannot be covered automatically.
                </p>
                <p {...ibm('Regular', 'text-[#161616] text-[14px] leading-relaxed')}>
                  I recommend importing <strong className="font-mono font-semibold text-[#161616]">8 MW</strong> from the grid for <span className="font-mono font-semibold">15 minutes</span>. At the canonical 6 MW battery output this covers demand. Current projected remaining deficit after an 8 MW import: <span className="font-mono font-semibold">{remainingDeficit(8)} MW</span>. No import executes without verified permissions, fresh telemetry, and safety checks.
                </p>

                {/* Energy breakdown */}
                <div className="bg-[#f4f4f4] border border-[#e0e0e0] p-4 rounded-[2px]">
                  <p {...ibm('SemiBold', 'text-[#161616] text-[13px] mb-3')}>Proposed energy balance at <span className="font-mono">14:50 IST</span> (not executing)</p>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: 'Solar generation', value: `${SNAPSHOT_14_50.solar} MW`, color: '#b26207' },
                      { label: 'Battery 1 (current output)', value: `${operations.flow.battery} MW`, color: '#0f62fe' },
                      { label: 'Grid import (proposed)', value: `${customMW} MW`, color: '#525252', proposed: true },
                      { label: 'Supply if approved AND safely executed', value: `${coveredAfterApproval(customMW)} MW`, color: '#198038', bold: true },
                      { label: 'Site demand', value: `${SNAPSHOT_14_50.demand} MW`, color: '#161616', bold: true },
                    ].map(item => (
                      <div key={item.label} className={`flex flex-wrap gap-3 items-center justify-between ${item.bold ? 'border-t border-[#e0e0e0] pt-2 mt-1' : ''}`}>
                        <p {...ibm(item.bold ? 'SemiBold' : 'Regular', 'text-[13px] text-[#525252]')}>{item.label}{item.proposed ? ' ⬤' : ''}</p>
                        <p {...ibm(item.bold ? 'Bold' : 'SemiBold', 'text-[14px] font-mono')} style={{ color: item.color }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <p {...ibm('Regular', 'text-[#8d8d8d] text-[11px] mt-2')}>⬤ Proposed — pending approval</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-[#edf5ff] border border-[#a6c8ff]/60 p-3 rounded-[2px]">
                    <p {...ibm('SemiBold', 'text-[#0f62fe] text-[12px] mb-1')}>If approved at 8 MW</p>
                    <p {...ibm('Regular', 'text-[#0043ce] text-[12px] leading-relaxed')}><span className="font-mono">38 + 6 + 8 = 52 MW</span>. Demand fully covered. No deficit.</p>
                  </div>
                  <div className="bg-[#fef3c7] border border-[#f59e0b]/40 p-3 rounded-[2px]">
                    <p {...ibm('SemiBold', 'text-[#b26207] text-[12px] mb-1')}>If approved at 6 MW</p>
                    <p {...ibm('Regular', 'text-[#78350f] text-[12px] leading-relaxed')}><span className="font-mono">38 + 6 + 6 = 50 MW</span>. 2 MW deficit remains uncovered. Load-shedding or further action required.</p>
                  </div>
                  <div className="bg-[#fff1f1] border border-[#da1e28]/40 p-3 rounded-[2px]">
                    <p {...ibm('SemiBold', 'text-[#da1e28] text-[12px] mb-1')}>If rejected</p>
                    <p {...ibm('Regular', 'text-[#da1e28] text-[12px] leading-relaxed')}><span className="font-mono">8 MW</span> deficit remains. Recovery behavior activates. Operations team alerted.</p>
                  </div>
                  <div className="bg-[#f4f4f4] border border-[#e0e0e0] p-3 rounded-[2px]">
                    <p {...ibm('SemiBold', 'text-[#525252] text-[12px] mb-1')}>If expired ({config.automation.approvalExpiryMin} min timeout)</p>
                    <p {...ibm('Regular', 'text-[#525252] text-[12px] leading-relaxed')}>Request times out. Same as rejection. New approval request required.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Decision controls */}
            {isPending && !showModify && (
              <div className="flex flex-col gap-4">
                <p {...ibm('SemiBold', 'text-[#161616] text-[15px]')}>Your decision · <span className="font-mono font-bold">{Math.floor(expiryCountdown / 60)}m {expiryCountdown % 60}s</span> remaining</p>
                <div className="flex gap-3 flex-wrap">
                  <button disabled={!canApprove} onClick={() => handleApprove(8)}
                    className="bg-[#198038] flex items-center gap-2 px-5 py-3 rounded-[2px] hover:bg-[#0e6027] transition-colors cursor-pointer text-white">
                    <p {...ibm('SemiBold', 'text-white text-[14px]')}>Approve — <span className="font-mono">8 MW</span> for 15 min</p>
                  </button>
                  <button onClick={() => setShowModify(true)}
                    className="border border-[#0f62fe] bg-white flex items-center gap-2 px-5 py-3 rounded-[2px] hover:bg-[#edf5ff] transition-colors cursor-pointer">
                    <p {...ibm('SemiBold', 'text-[#0f62fe] text-[14px]')}>Modify and approve</p>
                  </button>
                  <button disabled={!canApprove} onClick={() => operations.decide('rejected')}
                    className="border border-[#da1e28] bg-white flex items-center gap-2 px-5 py-3 rounded-[2px] hover:bg-[#fff1f1] transition-colors cursor-pointer">
                    <p {...ibm('SemiBold', 'text-[#da1e28] text-[14px]')}>Reject</p>
                  </button>
                </div>
              </div>
            )}

            {/* Modify form */}
            {isPending && showModify && (
              <div className="bg-white border border-[#e0e0e0] p-5 rounded-[2px] flex flex-col gap-4">
                <p {...ibm('SemiBold', 'text-[#161616] text-[14px]')}>Modify grid import quantity</p>
                <div className="flex items-center gap-4">
                  <p {...ibm('Regular', 'text-[#525252] text-[13px]')}>Import quantity</p>
                  <div className="flex items-center gap-2">
                    <button aria-label="Set import to 6 MW" onClick={() => updateProposedMW(6)} className="border border-[#e0e0e0] flex items-center justify-center rounded-[2px] size-8 hover:bg-[#f4f4f4] cursor-pointer text-[16px]">−</button>
                    <span {...ibm('Bold', 'text-[#161616] font-mono text-[18px] w-20 text-center')}>{customMW} MW</span>
                    <button aria-label="Set import to 8 MW" onClick={() => updateProposedMW(8)} className="border border-[#e0e0e0] flex items-center justify-center rounded-[2px] size-8 hover:bg-[#f4f4f4] cursor-pointer text-[16px]">+</button>
                  </div>
                </div>
                {remainingDeficit(customMW) > 0 && (
                  <div className="bg-[#fef3c7] border border-[#f59e0b]/40 p-3 rounded-[2px]">
                    <p {...ibm('SemiBold', 'text-[#b26207] text-[13px]')}>⚠ <span className="font-mono">{remainingDeficit(customMW)} MW</span> deficit will remain uncovered</p>
                    <p {...ibm('Regular', 'text-[#78350f] text-[12px] mt-1')}><span className="font-mono">38 + 6 + {customMW} = {coveredAfterApproval(customMW)} MW</span> of 52 MW demand. Additional action required for remaining deficit.</p>
                  </div>
                )}
                {remainingDeficit(customMW) === 0 && (
                  <div className="bg-[#defbe6] border border-[#198038]/40 p-3 rounded-[2px]">
                    <p {...ibm('Medium', 'text-[#198038] text-[13px]')}>✓ <span className="font-mono">38 + 6 + {customMW} = {coveredAfterApproval(customMW)} MW</span> — demand fully covered</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button disabled={!canApprove} onClick={() => handleApprove(customMW)}
                    className="bg-[#198038] px-5 py-2.5 rounded-[2px] hover:bg-[#0e6027] text-white cursor-pointer transition-colors">
                    <p {...ibm('SemiBold', 'text-white text-[13px]')}>Approve <span className="font-mono">{customMW} MW</span></p>
                  </button>
                  <button onClick={() => { updateProposedMW(8); setShowModify(false); }} className="border border-[#e0e0e0] px-5 py-2.5 rounded-[2px] hover:bg-[#f4f4f4] cursor-pointer transition-colors">
                    <p {...ibm('Medium', 'text-[#161616] text-[13px]')}>Cancel</p>
                  </button>
                </div>
              </div>
            )}

            {/* Outcome */}
            {!isPending && (
              <div className={`flex gap-3 items-center p-5 rounded-[2px] ${isApproved ? 'bg-[#defbe6] border border-[#198038]/40' : 'bg-[#fff1f1] border border-[#da1e28]/40'}`}>
                <div className={`flex items-center justify-center rounded-[2px] size-6 ${isApproved ? 'bg-[#198038]' : 'bg-[#da1e28]'}`}>
                  {isApproved ? <img alt="" className="size-3.5" src={imgCheck1} /> : <p className="text-white text-[10px] font-mono font-bold">✕</p>}
                </div>
                <div>
                  <p {...ibm('SemiBold', `${isApproved ? 'text-[#198038]' : 'text-[#da1e28]'} text-[14px]`)}>
                    {isApproved ? `Approved — ${approvedMW} MW for 15 min; ${request?.executable ? 'Executing in preview' : 'execution held'}` : decision === 'expired' ? 'Expired — fresh approval required' : 'Rejected — recovery behavior activated'}
                  </p>
                  <p {...ibm('Regular', 'text-[#525252] text-[12px] mt-0.5')}>{request?.executable ? `Simulated import ${operations.flow.grid} MW; ${operations.flow.deficit} MW deficit remains. No real equipment command sent.` : `Execution held: verified control permission, fresh telemetry, safe checks, and the planned battery output are required. Current grid import ${operations.flow.grid} MW; ${operations.flow.deficit} MW deficit remains.`}</p>
                </div>
              </div>
            )}

            <button onClick={isApproved ? () => onApprove(approvedMW) : isRejected ? onReject : onBack} className="border border-[#e0e0e0] flex items-center gap-2 px-4 py-2.5 rounded-[2px] hover:bg-[#f4f4f4] cursor-pointer self-start transition-colors">
              <p {...ibm('Medium', 'text-[#161616] text-[13px]')}>← Back to live monitoring</p>
            </button>
          </div>
        </div>

        {/* Right: policy context */}
        <div className="bg-white border-l border-[#e0e0e0] flex flex-col w-full lg:w-[300px] shrink-0">
          <div className="border-b border-[#e0e0e0] px-5 py-4">
            <p {...ibm('SemiBold', 'text-[#161616] text-[15px]')}>Policy context</p>
          </div>
          <div className="flex flex-col gap-4 p-5 overflow-y-auto"><p className="text-xs text-[#525252]">{canApprove ? "Administrator preview permission verified" : "Approval is restricted to administrators."}</p><Link to="/protected" className="text-sm text-[#0f62fe] hover:text-[#0043ce] underline">Review protected limits</Link>
            <div>
              <p {...ibm('SemiBold', 'text-[#161616] text-[13px] mb-2')}>Configured limits</p>
              {[
                ['Auto limit', `≤ ${config.automation.approvalAboveMW} MW (no approval)`],
                ['Approval required', `> ${config.automation.approvalAboveMW} MW`],
                ['Approval expires', `${config.automation.approvalExpiryMin} min`],
                ['Equipment maximum', `${BATTERY_POLICY.equipmentMaxMW} MW`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-2 py-1.5 border-b border-[#f4f4f4] last:border-0">
                  <p {...ibm('Regular', 'text-[#525252] text-[12px]')}>{label}</p>
                  <p {...ibm('SemiBold', 'text-[#161616] font-mono text-[12px] text-right')}>{value}</p>
                </div>
              ))}
            </div>
            <div className="bg-[#fef3c7] border border-[#f59e0b]/40 p-3 rounded-[2px]">
              <p {...ibm('SemiBold', 'text-[#78350f] text-[12px] mb-1')}>Grid import policy</p>
              <p {...ibm('Regular', 'text-[#78350f] text-[12px] leading-relaxed')}>Grid import is never started automatically. Any import above 0 MW requires explicit administrator approval. BOB can only recommend, not execute.</p>
            </div>
            <div className="bg-[#f4f4f4] border border-[#e0e0e0] p-3 rounded-[2px]">
              <p {...ibm('SemiBold', 'text-[#525252] text-[12px] mb-1')}>Battery status</p>
              <p {...ibm('Regular', 'text-[#525252] text-[12px]')}>SOC: <span className="font-mono font-medium">{operations.flow.soc}%</span> · Discharge: <span className="font-mono font-medium">{BATTERY_POLICY.autoMaxMW} MW</span> (at limit)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
