import { useOperations } from "./Operations"

interface BobToggleProps {
  className?: string;
  compact?: boolean;
}

export default function BobToggle({ className = "", compact = false }: BobToggleProps) {
  const { state, toggleBobActive } = useOperations();
  const isActive = state.activated;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleBobActive();
    }
  };

  return (
    <div
      role="switch"
      aria-checked={isActive}
      tabIndex={0}
      onClick={toggleBobActive}
      onKeyDown={handleKeyDown}
      title={isActive ? "Click to set BOB to Inactive" : "Click to set BOB to Active"}
      className={`group inline-flex items-center gap-2.5 px-3 py-1.5 rounded-[2px] border cursor-pointer select-none transition-all duration-200 outline-none focus-visible:outline-2 focus-visible:outline-[#0f62fe] focus-visible:outline-offset-1 ${
        isActive
          ? "bg-[#defbe6] border-[#42be65] hover:bg-[#c6f6d5]"
          : "bg-white border-[#e0e0e0] hover:bg-[#f4f4f4] hover:border-[#8d8d8d]"
      } ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="font-['IBM Plex Sans:SemiBold'] font-semibold text-[13px] text-[#161616] tracking-tight"
          style={{ fontVariationSettings: '"wdth" 100' }}
        >
          BOB
        </span>
      </div>

      {/* Switch track & knob */}
      <div
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${
          isActive ? "bg-[#198038]" : "bg-[#c6c6c6] group-hover:bg-[#a8a8a8]"
        }`}
      >
        <span
          className={`pointer-events-none inline-block size-3.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            isActive ? "translate-x-4.5" : "translate-x-1"
          }`}
        />
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-1.5 min-w-[54px]">
        <span
          className={`size-2 rounded-full shrink-0 ${
            isActive ? "bg-[#198038] animate-pulse" : "bg-[#8d8d8d]"
          }`}
        />
        <span
          className={`font-['IBM Plex Sans:SemiBold'] font-semibold text-[12px] leading-normal whitespace-nowrap ${
            isActive ? "text-[#198038]" : "text-[#525252]"
          }`}
          style={{ fontVariationSettings: '"wdth" 100' }}
        >
          {isActive ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  );
}
