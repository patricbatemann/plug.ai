import { useNavigate } from "react-router";
import { useOperations } from "./Operations";
import { getAttentionRecommendations, getOtherRecommendations } from "./services/recommendationService";


interface AIRecommendationsProps {
  onBack: () => void;
  onOpenSite?: () => void;
}

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
      <p className={`font-['IBM Plex Sans:SemiBold'] font-semibold text-[14px] whitespace-nowrap max-sm:whitespace-normal ${valueColor}`} style={{ fontVariationSettings: '"wdth" 100' }}>{value}</p>
    </div>
  );
}

interface PrimaryCardProps {
  dot: string;
  siteName: string;
  siteSubtitle: string;
  tags: { label: string; bg: string; text: string }[];
  title: string;
  rationale: string;
  facts: FactProps[];
  primaryBtnLabel: string;
  primaryBtnBg: string;
  onOpenSite?: () => void;
}

function PrimaryCard({ dot, siteName, siteSubtitle, tags, title, rationale, facts, primaryBtnLabel, primaryBtnBg, onOpenSite }: PrimaryCardProps) {
  const navigate = useNavigate();
  const operations = useOperations();
  const destination = siteName.startsWith("Kuppam") ? "/siteDetail" : `/recommendation?site=${encodeURIComponent(siteName)}`;
  const openSite = () => { if (siteName.startsWith("Kuppam")) onOpenSite?.(); else navigate(destination); };
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
      <p className="font-['IBM Plex Sans:SemiBold'] font-semibold leading-[1.35] text-[#161616] text-[19px] w-full" style={{ fontVariationSettings: '"wdth" 100' }}>{title}</p>

      {/* Why BOB */}
      <div className="bg-[#edf5ff] flex flex-col gap-[5px] items-start px-[14px] py-[12px] rounded-[2px] w-full">
        <p className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[#0f62fe] text-[12px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Why BOB recommends this</p>
        <p className="font-['IBM Plex Sans:Regular'] font-normal leading-[1.35] text-[#525252] text-[13px] w-full" style={{ fontVariationSettings: '"wdth" 100' }}>{rationale}</p>
      </div>

      {/* Decision facts */}
      <div className="bg-[#f4f4f4] flex gap-6 items-start p-[14px] rounded-[2px] w-full flex-wrap">
        {facts.map((f) => <Fact key={f.label} {...f} />)}
      </div>

      {/* Card actions */}
      <div className="flex flex-wrap gap-3 items-center justify-between w-full">
        <div className="flex gap-[18px] items-start max-sm:flex-wrap">
          <button onClick={() => navigate(siteName.startsWith("Kuppam") ? "/askBob" : destination)} className="font-['IBM Plex Sans:Medium'] font-medium text-[#0f62fe] text-[13px] hover:underline cursor-pointer" style={{ fontVariationSettings: '"wdth" 100' }}>Ask BOB</button>
          <button onClick={() => navigate(siteName.startsWith("Kuppam") ? "/audit?recommendation=grid" : destination)} className="min-h-11 text-[13px] text-[#0f62fe] hover:underline">View evidence</button>
        </div>
        <div className="flex gap-2 items-start max-sm:flex-wrap">
          <button onClick={openSite} className="bg-white border border-[#0f62fe] flex items-center px-4 py-2.5 rounded-[2px] hover:bg-[#edf5ff] transition-colors cursor-pointer max-sm:flex-wrap">
            <p className="font-['IBM Plex Sans:Medium'] font-medium leading-[1.35] text-[#0f62fe] text-[14px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Open site</p>
          </button>
          <button onClick={() => { if (!siteName.startsWith("Kuppam")) navigate(destination); else if (primaryBtnLabel.includes("approval")) { operations.requestImport(); navigate("/approval"); } else navigate("/bob"); }} className={`${primaryBtnBg} flex items-center px-4 py-2.5 rounded-[2px] hover:opacity-90 transition-opacity cursor-pointer`}>
            <p className="font-['IBM Plex Sans:Medium'] font-medium leading-[1.35] text-white text-[14px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{primaryBtnLabel}</p>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AIRecommendations({ onBack, onOpenSite }: AIRecommendationsProps) {
  const navigate = useNavigate();
  return (
    <div className="bg-[#f4f4f4] min-h-screen w-full">
      {/* Content */}
      <div className="flex flex-col gap-6 items-start p-8 w-full">
        {/* Page heading */}
        <div className="flex flex-col gap-1.5 items-start w-full">
          <button onClick={onBack} className="flex gap-[7px] items-center font-['IBM Plex Sans:Medium'] font-medium text-[#0f62fe] text-[14px] hover:underline cursor-pointer pb-1 max-sm:flex-wrap" style={{ fontVariationSettings: '"wdth" 100' }}>
            <span className="text-[16px]">←</span>
            <span>Back to dashboard</span>
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
            <p className="font-['IBM Plex Sans:Regular'] font-normal leading-[1.35] text-[#525252] text-[13px]" style={{ fontVariationSettings: '"wdth" 100' }}>3 highest-priority recommendations shown first</p>
          </div>
          <div className="bg-white border border-[#e0e0e0] flex items-center px-[9px] py-[5px] rounded-[2px] max-sm:flex-wrap">
            <p className="font-['IBM Plex Sans:Medium'] font-medium leading-[1.35] text-[#161616] text-[12px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Sorted by priority</p>
          </div>
        </div>

        {/* Primary recommendation cards */}
        <div className="flex flex-col gap-3.5 items-start w-full">
          {getAttentionRecommendations().map((card) => (
            <PrimaryCard
              key={card.id}
              dot={card.dot}
              siteName={card.siteName}
              siteSubtitle={card.siteSubtitle}
              tags={card.tags}
              title={card.title}
              rationale={card.rationale}
              facts={card.facts}
              primaryBtnLabel={card.primaryBtnLabel}
              primaryBtnBg={card.primaryBtnBg}
              onOpenSite={onOpenSite}
            />
          ))}
        </div>

        {/* Other recommendations heading */}
        <div className="flex flex-wrap gap-3 items-center justify-between w-full">
          <p className="font-['IBM Plex Sans:SemiBold'] font-semibold leading-[1.35] text-[#161616] text-[20px]" style={{ fontVariationSettings: '"wdth" 100' }}>Other recommendations</p>
          <button disabled className="font-['IBM Plex Sans:Medium'] font-medium text-[#525252] text-[14px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>3 other preview recommendations</button>
        </div>

        {/* Compact cards */}
        <div className="flex gap-4 items-start w-full flex-wrap">
          {getOtherRecommendations().map((card) => (
            <div key={card.id || card.site} className="bg-white border border-[#e0e0e0] flex flex-col gap-2.5 items-start p-[18px] rounded-[2px] flex-1 min-w-0 basis-full sm:basis-[260px]">
              <div className="flex gap-2 items-start max-sm:flex-wrap">
                <p className="font-['IBM Plex Sans:SemiBold'] font-semibold leading-[1.35] text-[#161616] text-[14px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{card.site}</p>
                <div className={`${card.tagBg} flex items-center px-[9px] py-[5px] rounded-[2px] shrink-0`}>
                  <p className={`font-['IBM Plex Sans:Medium'] font-medium leading-[1.35] text-[12px] whitespace-nowrap max-sm:whitespace-normal ${card.tagText}`} style={{ fontVariationSettings: '"wdth" 100' }}>{card.tagLabel}</p>
                </div>
              </div>
              <p className="font-['IBM Plex Sans:SemiBold'] font-semibold leading-[1.35] text-[#161616] text-[16px] w-full" style={{ fontVariationSettings: '"wdth" 100' }}>{card.title}</p>
              <p className="font-['IBM Plex Sans:Regular'] font-normal leading-[1.35] text-[#525252] text-[13px] w-full" style={{ fontVariationSettings: '"wdth" 100' }}>{card.subtitle}</p>
              <div className="flex gap-3 items-center flex-wrap">
                {['Ask BOB', 'Open site', 'Set up action →'].map((lnk) => (
                  <button key={lnk} onClick={() => navigate(`/recommendation?site=${encodeURIComponent(card.site)}`)} className="font-['IBM Plex Sans:Medium'] font-medium text-[#0f62fe] text-[13px] hover:underline cursor-pointer whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>{lnk}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Results footer */}
        <div className="flex flex-wrap gap-3 items-center justify-between w-full">
          <p className="font-['IBM Plex Sans:Regular'] font-normal leading-[1.35] text-[#525252] text-[13px] whitespace-nowrap max-sm:whitespace-normal" style={{ fontVariationSettings: '"wdth" 100' }}>Showing all 6 available preview recommendations</p>
          <p className="text-xs text-[#6f6f6f]">Additional records require a connected recommendations API.</p>
        </div>
      </div>
    </div>
  );
}
