import { useOperations } from "./Operations";

const assetPathPrefix = '/assets';
const imgBrainCog = `${assetPathPrefix}/0b229.svg`;
const imgChevronDown = `${assetPathPrefix}/20d57.svg`;
const imgEllipse = `${assetPathPrefix}/2ea7c.svg`;
const imgXCircle = `${assetPathPrefix}/5972c.svg`;
const imgBot = `${assetPathPrefix}/39c39.svg`;
const imgCheck = `${assetPathPrefix}/a0519.svg`;
const imgCheck1 = `${assetPathPrefix}/dbc6b.svg`;
const imgCheck2 = `${assetPathPrefix}/b409b.svg`;
const imgPaperclip = `${assetPathPrefix}/1fbce.svg`;
const imgArrowUp = `${assetPathPrefix}/536bf.svg`;

interface BobSetupProps {
  onClose: () => void;
  onAgentChat?: () => void;
}

type Step = 1 | 2 | 3 | 4;

function StepIndicator({ num, label, state }: { num: number; label: string; state: 'done' | 'active' | 'pending' }) {
  const circleCls =
    state === 'done' || state === 'active'
      ? state === 'active'
        ? 'bg-white border-2 border-[#0f62fe]'
        : 'bg-[#0f62fe]'
      : 'bg-white border border-[#e0e0e0]';
  const numCls =
    state === 'done' ? 'text-white' : state === 'active' ? 'text-[#0f62fe]' : 'text-[#8d8d8d]';
  const labelCls =
    state === 'pending' ? 'font-medium text-[#8d8d8d]' : 'font-semibold text-[#0f62fe]';
  const fontFamily = state === 'pending' ? 'IBM Plex Sans:Medium' : 'IBM Plex Sans:SemiBold';

  return (
    <div className="flex gap-2 items-center shrink-0 max-sm:flex-wrap">
      <div className={`${circleCls} flex items-center justify-center rounded-full size-5 shrink-0`}>
        <p className={`font-['IBM Plex Sans:SemiBold'] font-semibold ${numCls} text-[11px] leading-none`} style={{ fontVariationSettings: '"wdth" 100' }}>{num}</p>
      </div>
      <p className={`font-['${fontFamily}'] ${labelCls} text-[13px] leading-normal whitespace-normal`} style={{ fontVariationSettings: '"wdth" 100' }}>{label}</p>
    </div>
  );
}

function CheckBadge({ icon = imgCheck }: { icon?: string }) {
  return (
    <div className="bg-[#198038] flex items-center justify-center rounded-[2px] size-[18px] shrink-0 max-sm:flex-wrap">
      <div className="size-3 relative shrink-0">
        <img alt="" className="absolute inset-0 size-full" src={icon} />
      </div>
    </div>
  );
}

export default function BobSetup({ onClose, onAgentChat }: BobSetupProps) {
  const { state } = useOperations();
  const displayStage = state.activated ? (state.stage === 'Executing' ? 'Executing' : 'Active') : state.stage === 'Draft' ? 'Draft' : 'Configuring';
  return (
    <div className="bg-[#f4f4f4] flex flex-col items-start min-h-screen w-full">

      {/* Mini progress bar at very top (collapsed view) */}
      <div className="bg-[#f4f4f4] border-b border-[#e0e0e0] flex flex-col gap-2 items-start px-6 py-3 w-full">
        <div className="flex gap-3 items-center w-full max-sm:flex-wrap">
          <StepIndicator num={1} label="Select action" state="done" />
          <div className="bg-[#e0e0e0] h-px w-10 shrink-0" />
          <StepIndicator num={2} label="Configure" state="active" />
          <div className="bg-[#e0e0e0] h-px w-10 shrink-0" />
          <StepIndicator num={3} label="Test" state="pending" />
          <div className="bg-[#e0e0e0] h-px w-10 shrink-0" />
          <StepIndicator num={4} label="Activate" state="pending" />
        </div>
        <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[13px] leading-normal pt-2 whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>
          3 of 7 configuration decisions completed · Snapshot <span className="font-mono text-[#161616]">01 Oct 2026, 14:32 IST</span>
        </p>
      </div>

      {/* Main Header */}
      <div className="bg-white border-b border-[#e0e0e0] flex min-h-14 flex-wrap gap-3 items-center justify-between py-3 px-6 shrink-0 w-full">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-8 shrink-0 max-sm:flex-wrap">
            <div className="size-5 relative shrink-0">
              <img alt="" className="absolute inset-0 size-full" src={imgBrainCog} />
            </div>
          </div>
          <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[16px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>BOB Agent Setup</p>
          <div className="border border-[#e0e0e0] flex gap-2 items-center px-2.5 py-1.5 rounded-[2px] max-sm:flex-wrap">
            <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#161616] text-[13px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>
              Kuppam Solar Site <span className="font-mono font-medium text-[#525252]">KUP-SOLAR-001</span>
            </p>
            <div className="size-3.5 relative shrink-0">
              <img alt="" className="absolute inset-0 size-full" src={imgChevronDown} />
            </div>
          </div>
          <div className="bg-[#edf5ff] border border-[#a6c8ff] px-2 py-0.5 rounded-[2px]">
            <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#0f62fe] text-[11px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{displayStage}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-1.5 items-center max-sm:flex-wrap">
            <div className="size-1.5 relative shrink-0">
              <img alt="" className="absolute inset-0 size-full" src={imgEllipse} />
            </div>
            <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[13px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>5 connected systems</p>
          </div>
          <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[13px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>All changes saved</p>
          {onAgentChat && (
            <button onClick={onAgentChat} className="bg-[#0f62fe] flex items-center px-3 py-1.5 rounded-[2px] hover:bg-[#0043ce] transition-colors cursor-pointer max-sm:flex-wrap">
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-white text-[13px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Open Chat</p>
            </button>
          )}
          <button className="border border-[#e0e0e0] bg-white flex items-center px-3 py-1.5 rounded-[2px] hover:bg-[#f4f4f4] transition-colors cursor-pointer max-sm:flex-wrap">
            <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#161616] text-[13px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Save and exit</p>
          </button>
          <button onClick={onClose} className="border border-[#e0e0e0] bg-white flex items-center justify-center rounded-[2px] size-8 shrink-0 hover:bg-[#f4f4f4] transition-colors cursor-pointer max-sm:flex-wrap">
            <div className="size-4 relative shrink-0">
              <img alt="" className="absolute inset-0 size-full" src={imgXCircle} />
            </div>
          </button>
        </div>
      </div>

      {/* Progress Bar (main) */}
      <div className="bg-[#f4f4f4] border-b border-[#e0e0e0] flex items-start px-6 py-3 w-full shrink-0 max-sm:flex-wrap">
        <div className="flex flex-1 flex-wrap gap-3 items-center min-w-0">
          <StepIndicator num={1} label="Select action" state="done" />
          <div className="bg-[#e0e0e0] h-px w-10 shrink-0" />
          <StepIndicator num={2} label="Configure" state="active" />
          <div className="bg-[#e0e0e0] h-px w-10 shrink-0" />
          <StepIndicator num={3} label="Test" state="pending" />
          <div className="bg-[#e0e0e0] h-px w-10 shrink-0" />
          <StepIndicator num={4} label="Activate" state="pending" />
        </div>
        <div className="flex flex-1 items-start min-w-0 pt-2 hidden xl:flex max-sm:flex-wrap">
          <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[13px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>
            3 of 7 configuration decisions completed · Snapshot <span className="font-mono text-[#161616]">01 Oct 2026, 14:32 IST</span>
          </p>
        </div>
      </div>

      {/* Workspace: Chat + Sidebar */}
      <div className="flex flex-1 flex-col lg:flex-row items-stretch w-full min-h-0 min-w-0">

        {/* Left sidebar: step icons */}
        <div className="bg-white border-r border-[#e0e0e0] flex flex-col gap-6 items-center py-6 shrink-0 w-14 hidden lg:flex">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={`flex items-center justify-center rounded-[2px] size-8 ${n === 1 ? 'bg-[#0f62fe]' : n === 2 ? 'bg-[#edf5ff] border border-[#0f62fe]' : 'bg-white border border-[#e0e0e0]'}`}>
              <div className="size-4 relative shrink-0">
                <img alt="" className="absolute inset-0 size-full" src={imgBot} />
              </div>
            </div>
          ))}
        </div>

        {/* Chat Column */}
        <div className="flex flex-1 flex-col h-full items-start justify-between p-6 min-w-0">
          <div className="flex flex-col gap-6 items-start w-full">

            {/* Welcome / action selected */}
            <div className="flex gap-3 items-start w-full max-sm:flex-wrap">
              <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-7 shrink-0 max-sm:flex-wrap">
                <div className="size-4 relative shrink-0">
                  <img alt="" className="absolute inset-0 size-full" src={imgBot} />
                </div>
              </div>
              <div className="bg-white border border-[#e0e0e0] flex flex-1 flex-col items-start min-w-0 p-5 rounded-[2px]">
                <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[14px] leading-normal w-full" style={{ fontVariationSettings: '"wdth" 100' }}>
                  Action selected: Discharge battery to support demand
                </p>
              </div>
            </div>

            {/* Q1 — Objective configured */}
            <div className="flex gap-3 items-start w-full max-sm:flex-wrap">
              <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-7 shrink-0 max-sm:flex-wrap">
                <div className="size-4 relative shrink-0">
                  <img alt="" className="absolute inset-0 size-full" src={imgBot} />
                </div>
              </div>
              <div className="bg-white border border-[#e0e0e0] flex flex-1 flex-col gap-3 items-start min-w-0 p-5 rounded-[2px]">
                <div className="flex flex-wrap gap-3 items-center justify-between w-full">
                  <div className="flex flex-wrap gap-3 items-center">
                    <CheckBadge />
                    <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[14px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Objective configured</p>
                  </div>
                  <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[13px] leading-normal cursor-pointer hover:text-[#0f62fe] transition-colors whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Edit</p>
                </div>
                <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[14px] leading-[1.5] w-full" style={{ fontVariationSettings: '"wdth" 100' }}>
                  Maintain supply reliability · Snapshot <span className="font-mono text-[#161616]">01 Oct 2026, 14:32 IST</span>
                </p>
              </div>
            </div>

            {/* Q2 — Controlled asset configured */}
            <div className="flex gap-3 items-start w-full max-sm:flex-wrap">
              <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-7 shrink-0 max-sm:flex-wrap">
                <div className="size-4 relative shrink-0">
                  <img alt="" className="absolute inset-0 size-full" src={imgBot} />
                </div>
              </div>
              <div className="bg-white border border-[#e0e0e0] flex flex-1 flex-col gap-3 items-start min-w-0 p-5 rounded-[2px]">
                <div className="flex flex-wrap gap-3 items-center justify-between w-full">
                  <div className="flex flex-wrap gap-3 items-center">
                    <CheckBadge />
                    <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[14px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Controlled asset configured</p>
                  </div>
                  <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[13px] leading-normal cursor-pointer hover:text-[#0f62fe] transition-colors whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Edit</p>
                </div>
                <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[14px] leading-[1.5] w-full" style={{ fontVariationSettings: '"wdth" 100' }}>
                  Battery 1 — Available · <span className="font-mono font-medium text-[#161616]">72% SOC</span> · <span className="font-mono font-medium text-[#161616]">8 MW max</span> · Snapshot <span className="font-mono text-[#161616]">01 Oct 2026, 14:32 IST</span>
                </p>
              </div>
            </div>

            {/* Q3 — Trigger (expanded) */}
            <div className="flex gap-3 items-start w-full max-sm:flex-wrap">
              <div className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-7 shrink-0 mt-0.5 max-sm:flex-wrap">
                <div className="size-4 relative shrink-0">
                  <img alt="" className="absolute inset-0 size-full" src={imgBot} />
                </div>
              </div>
              <div className="bg-white border border-[#e0e0e0] flex flex-1 flex-col gap-4 items-start min-w-0 p-5 rounded-[2px]">
                <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#161616] text-[14px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>
                  When should I discharge Battery 1? · Snapshot <span className="font-mono">01 Oct 2026, 14:32 IST</span>
                </p>

                {/* Warning notification */}
                <div className="bg-[#fef3c7] border border-[#fde68a] flex gap-3 items-start p-4 rounded-[2px] w-full max-sm:flex-wrap">
                  <div className="bg-[#b26207] self-stretch shrink-0 w-1 rounded-[2px]" />
                  <p className="flex-1 font-['IBM Plex Sans:Regular'] font-normal text-[#b26207] text-[13px] leading-[1.4] min-w-0 max-sm:flex-wrap" style={{ fontVariationSettings: '"wdth" 100' }}>
                    Four of five trigger conditions are currently met. The action would become eligible if the demand gap continues for one more minute.
                  </p>
                </div>

                {/* Rule editor */}
                <div className="bg-[#f4f4f4] border border-[#e0e0e0] flex flex-col gap-3 items-start p-4 rounded-[2px] w-full">
                  <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#161616] text-[14px] leading-[22px] w-full" style={{ fontVariationSettings: '"wdth" 100' }}>
                    Start when site demand exceeds solar generation by more than{' '}
                    <span className="font-mono font-semibold text-[#0f62fe]">3 MW</span>
                    {' '}for at least{' '}
                    <span className="font-mono font-semibold text-[#0f62fe]">5 minutes</span>
                    {' '}and all safety conditions are met.
                  </p>
                  <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[12px] leading-normal w-full" style={{ fontVariationSettings: '"wdth" 100' }}>
                    Adjust the highlighted values to change the trigger threshold and duration. Safety conditions remain visible below.
                  </p>
                </div>

                {/* Required conditions */}
                <div className="bg-white border border-[#e0e0e0] flex flex-col gap-3 items-start p-4 rounded-[2px] w-full">
                  <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[13px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>
                    Required conditions · Snapshot <span className="font-mono">01 Oct 2026, 14:32 IST</span>
                  </p>
                  {[
                    { icon: imgCheck, text: 'Battery 1 SOC is above 60%' },
                    { icon: imgCheck, text: 'Shortfall is forecast to continue for at least 15 minutes' },
                    { icon: imgCheck1, text: 'Battery 1 has no critical warning' },
                    { icon: imgCheck, text: 'Live battery data is available' },
                    { icon: imgCheck2, text: 'Maintenance is not active' },
                  ].map((cond) => (
                    <div key={cond.text} className="flex gap-3 items-center w-full max-sm:flex-wrap">
                      <CheckBadge icon={cond.icon} />
                      <p className="flex-1 font-['IBM Plex Sans:Regular'] font-normal text-[#161616] text-[13px] leading-normal min-w-0 max-sm:flex-wrap" style={{ fontVariationSettings: '"wdth" 100' }}>{cond.text}</p>
                    </div>
                  ))}
                </div>

                {/* Current site values */}
                <div className="bg-[#f4f4f4] border border-[#e0e0e0] flex flex-col gap-3 items-start p-4 rounded-[2px] w-full">
                  <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[13px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>
                    Current site values · Snapshot <span className="font-mono">01 Oct 2026, 14:32 IST</span>
                  </p>
                  {[
                    { label: 'Site demand', value: '44 MW', isMono: true },
                    { label: 'Solar generation', value: '38 MW', isMono: true },
                    { label: 'Current demand gap', value: '6 MW', isMono: true },
                    { label: 'Gap duration', value: '4 minutes', isMono: true },
                    { label: 'Battery charge', value: '72%', isMono: true },
                    { label: 'Forecast duration', value: '20 minutes', isMono: true },
                    { label: 'Battery availability', value: 'Available', isMono: false },
                  ].map((row) => (
                    <div key={row.label} className="flex flex-wrap gap-3 items-center justify-between w-full">
                      <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#525252] text-[13px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{row.label}</p>
                      <p className={`${row.isMono ? 'font-mono' : "font-['IBM Plex Sans:Medium']"} font-medium text-[#161616] text-[13px] leading-normal whitespace-normal`}>{row.value}</p>
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 items-center flex-wrap">
                  <button className="bg-[#0f62fe] flex items-start px-5 py-2.5 rounded-[2px] cursor-pointer hover:bg-[#0043ce] transition-colors max-sm:flex-wrap">
                    <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-white text-[13px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Use recommended trigger</p>
                  </button>
                  <button className="border border-[#e0e0e0] bg-white flex items-start px-4 py-2.5 rounded-[2px] cursor-pointer hover:bg-[#f4f4f4] transition-colors max-sm:flex-wrap">
                    <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#161616] text-[13px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Adjust conditions</p>
                  </button>
                  <button className="border border-[#e0e0e0] bg-white flex items-start px-4 py-2.5 rounded-[2px] cursor-pointer hover:bg-[#f4f4f4] transition-colors max-sm:flex-wrap">
                    <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[13px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Add condition</p>
                  </button>
                  <button className="border border-[#e0e0e0] bg-white flex items-start px-4 py-2.5 rounded-[2px] cursor-pointer hover:bg-[#f4f4f4] transition-colors max-sm:flex-wrap">
                    <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[13px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Explain trigger</p>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Chat composer */}
          <div className="bg-white border border-[#e0e0e0] flex min-h-14 flex-wrap gap-3 items-center justify-between py-3 mt-6 px-4 rounded-[2px] w-full shrink-0">
            <div className="flex flex-1 gap-3 items-center min-w-0 max-sm:flex-wrap">
              <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#8d8d8d] text-[14px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>
                Ask BOB to adjust limits or explain any setup option...
              </p>
            </div>
            <div className="flex gap-3 items-center shrink-0 max-sm:flex-wrap">
              <div className="flex items-center justify-center size-5 shrink-0 cursor-pointer max-sm:flex-wrap">
                <img alt="" className="size-full" src={imgPaperclip} />
              </div>
              <button className="bg-[#0f62fe] flex items-center justify-center rounded-[2px] size-8 shrink-0 cursor-pointer hover:bg-[#0043ce] transition-colors max-sm:flex-wrap">
                <div className="size-4 relative shrink-0">
                  <img alt="" className="absolute inset-0 size-full" src={imgArrowUp} />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Configured Actions Panel */}
        <div className="bg-white border-l border-[#e0e0e0] flex flex-col h-full items-start shrink-0 w-full lg:w-[420px]">
          {/* Panel header */}
          <div className="border-b border-[#e0e0e0] flex flex-wrap gap-3 items-center justify-between px-6 py-5 w-full shrink-0">
            <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[16px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Configured actions</p>
            <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[13px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>1 action</p>
            <button className="border border-[#e0e0e0] bg-white flex items-start px-3 py-1.5 rounded-[2px] cursor-pointer hover:bg-[#f4f4f4] transition-colors max-sm:flex-wrap">
              <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#161616] text-[13px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Add action</p>
            </button>
          </div>

          {/* Panel body */}
          <div className="flex flex-col items-start p-6 w-full">
            <div className="bg-white border border-[#e0e0e0] flex flex-col gap-4 items-start p-5 rounded-[2px] w-full">
              {/* Action header */}
              <div className="flex flex-wrap gap-3 items-center justify-between w-full">
                <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#161616] text-[16px] leading-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Support demand using Battery 1</p>
                <div className="bg-[#edf5ff] border border-[#a6c8ff] px-2 py-0.5 rounded-[2px] shrink-0 ml-2">
                  <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#0f62fe] text-[11px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Configuring</p>
                </div>
              </div>
              <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[13px] leading-normal whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>
                3 of 7 settings complete · Snapshot <span className="font-mono text-[#161616]">01 Oct 2026, 14:32 IST</span>
              </p>

              {/* CONFIGURED section */}
              <div className="flex flex-col gap-2 w-full">
                <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#8d8d8d] text-[12px] leading-normal uppercase tracking-wide" style={{ fontVariationSettings: '"wdth" 100' }}>CONFIGURED</p>
                {[
                  'Objective: Maintain supply reliability',
                  'Battery: Battery 1',
                  'Trigger: Demand gap above 3 MW for 5 minutes',
                ].map((item) => (
                  <div key={item} className="flex gap-3 items-center w-full max-sm:flex-wrap">
                    <CheckBadge />
                    <p className="flex-1 font-['IBM Plex Sans:Regular'] font-normal text-[#161616] text-[13px] leading-normal min-w-0 max-sm:flex-wrap" style={{ fontVariationSettings: '"wdth" 100' }}>{item}</p>
                  </div>
                ))}
              </div>

              {/* MISSING section */}
              <div className="flex flex-col gap-2 w-full">
                <p className="font-['IBM Plex Sans:Regular'] font-normal text-[#8d8d8d] text-[12px] leading-normal uppercase tracking-wide" style={{ fontVariationSettings: '"wdth" 100' }}>MISSING</p>
                {['Limits', 'Automation', 'Recovery', 'Notifications'].map((item) => (
                  <div key={item} className="flex items-center w-full max-sm:flex-wrap">
                    <p className="flex-1 font-['IBM Plex Sans:Regular'] font-normal text-[#8d8d8d] text-[13px] leading-normal max-sm:flex-wrap" style={{ fontVariationSettings: '"wdth" 100' }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
