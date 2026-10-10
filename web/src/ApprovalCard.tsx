import { useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { runApi, type ActionOut } from "./api/client";
import { actionLabel, mw, simTime } from "./format";

function Tag({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <div className={`${bg} flex items-center px-[9px] py-[5px] rounded-[2px] shrink-0`}>
      <p className={`font-['IBM Plex Sans:Medium'] font-medium leading-[1.35] text-[12px] whitespace-nowrap max-sm:whitespace-normal ${text}`} style={{ fontVariationSettings: '"wdth" 100' }}>{label}</p>
    </div>
  );
}

interface FactProps { label: string; value: string; valueColor: string }
function Fact({ label, value, valueColor }: FactProps) {
  return (
    <div className="flex flex-col gap-1 items-start shrink-0 w-[190px]">
      <p className="font-['IBM Plex Sans:Medium'] font-medium text-[#8d8d8d] text-[10px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{label}</p>
      <p className={`font-mono font-semibold text-[14px] whitespace-nowrap max-sm:whitespace-normal ${valueColor}`}>{value}</p>
    </div>
  );
}

const AWAITING = { label: "Awaiting approval", bg: "bg-[#fff8e1]", text: "text-[#8e6a00]" };
const AI = { label: "AI-generated", bg: "bg-[#f6f2ff]", text: "text-[#6929c4]" };

export const actionTitle = (a: ActionOut) => `${actionLabel(a.kind, a.mw)}${a.mw ? ` · ${mw(Math.abs(a.mw))}` : ""}${a.asset ? ` on ${a.asset}` : ""}`;
export const rationaleOf = (a: ActionOut) => a.reason || "BOB's plan for this block calls for this action.";

export default function ApprovalCard({ action: a, runId, onOpenSite }: { action: ActionOut; runId: number; onOpenSite?: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const openSite = () => { if (onOpenSite) onOpenSite(); else navigate("/siteDetail"); };
  const decide = async (approve: boolean) => {
    setError("");
    try {
      await (approve ? runApi.approve : runApi.decline)(runId, a.id);
      await queryClient.invalidateQueries();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The decision was not recorded.");
    }
  };
  const dot = "/assets/c2bde.svg";
  const siteName = a.site ?? "Portfolio";
  const siteSubtitle = `Proposed for ${simTime(a.time)} IST`;
  const tags = [AI, AWAITING];
  const facts = [
    { label: "SUGGESTED ACTION", value: actionLabel(a.kind, a.mw), valueColor: "text-[#0f62fe]" },
    { label: "SIZE", value: a.mw ? mw(Math.abs(a.mw)) : "—", valueColor: "text-[#161616]" },
    { label: "ANSWER BY", value: a.deadline_at ? `${simTime(a.deadline_at)} IST` : "—", valueColor: "text-[#da1e28]" },
  ];
  return (
    <div className="bg-white border border-[#e0e0e0] flex flex-col gap-4 items-start p-[22px] rounded-[2px] w-full">
      {/* Card header */}
      <div className="flex items-start justify-between w-full max-sm:flex-wrap">
        <div className="flex flex-col gap-1 items-start">
          <div className="flex gap-2 items-center max-sm:flex-wrap">
            <div className="relative size-2 shrink-0">
              <img alt="" className="absolute inset-0 size-full" src={dot} />
            </div>
            <p className="font-['IBM Plex Sans:SemiBold'] font-semibold leading-[1.35] text-[#161616] text-[14px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{siteName}</p>
          </div>
          <p className="font-['IBM Plex Sans:Regular'] font-normal leading-[1.35] text-[#525252] text-[12px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{siteSubtitle}</p>
        </div>
        <div className="flex gap-2 items-start flex-wrap justify-end">
          {tags.map((t) => <Tag key={t.label} {...t} />)}
        </div>
      </div>

      {/* Title */}
      <p className="font-['IBM Plex Sans:SemiBold'] font-semibold leading-[1.35] text-[#161616] text-[19px] w-full" style={{ fontVariationSettings: '"wdth" 100' }}>{actionTitle(a)}</p>

      {/* Why BOB */}
      <div className="bg-[#edf5ff] flex flex-col gap-[5px] items-start px-[14px] py-[12px] rounded-[2px] w-full">
        <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#0f62fe] text-[12px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Why BOB recommends this</p>
        <p className="font-['IBM Plex Sans:Regular'] font-normal leading-[1.35] text-[#525252] text-[13px] w-full" style={{ fontVariationSettings: '"wdth" 100' }}>{rationaleOf(a)}</p>
      </div>

      {/* Decision facts */}
      <div className="bg-[#f4f4f4] flex gap-6 items-start p-[14px] rounded-[2px] w-full flex-wrap">
        {facts.map((f) => <Fact key={f.label} {...f} />)}
      </div>

      {/* Card actions */}
      <div className="flex flex-wrap gap-3 items-center justify-between w-full">
        <div className="flex gap-[18px] items-start max-sm:flex-wrap">
          {error && <p role="alert" className="text-[13px] text-[#da1e28]">{error}</p>}
        </div>
        <div className="flex gap-2 items-start max-sm:flex-wrap">
          <button onClick={openSite} className="bg-white border border-[#0f62fe] flex items-center px-4 py-2.5 rounded-[2px] hover:bg-[#edf5ff] transition-colors cursor-pointer max-sm:flex-wrap">
            <p className="font-['IBM Plex Sans:Medium'] font-medium leading-[1.35] text-[#0f62fe] text-[14px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Open site</p>
          </button>
          <button onClick={() => decide(false)} className="bg-white border border-[#da1e28] flex items-center px-4 py-2.5 rounded-[2px] hover:bg-[#fff1f1] transition-colors cursor-pointer">
            <p className="font-['IBM Plex Sans:Medium'] font-medium leading-[1.35] text-[#da1e28] text-[14px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Decline</p>
          </button>
          <button onClick={() => decide(true)} className="bg-[#0f62fe] flex items-center px-4 py-2.5 rounded-[2px] hover:opacity-90 transition-opacity cursor-pointer">
            <p className="font-['IBM Plex Sans:Medium'] font-medium leading-[1.35] text-white text-[14px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Approve</p>
          </button>
        </div>
      </div>
    </div>
  );
}
