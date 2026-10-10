import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { SITE } from "./data";
import { useSetBobActive, useSite } from "./site";

interface BobToggleProps {
  className?: string;
  compact?: boolean;
}

export default function BobToggle({ className = "", compact = false }: BobToggleProps) {
  const isActive = useSite().bobActive;
  const setBobActive = useSetBobActive();
  const toggleBobActive = () => void setBobActive(!isActive);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleToggleClick = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!isActive) {
      // Turning ON -> Show confirmation popup
      setShowConfirmModal(true);
    } else {
      // Turning OFF -> Deactivate directly
      toggleBobActive();
    }
  };

  const handleProceed = () => {
    setShowConfirmModal(false);
    toggleBobActive();
  };

  const handleCancel = () => {
    setShowConfirmModal(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      handleToggleClick(e);
    }
  };

  // Close modal on Escape
  useEffect(() => {
    if (!showConfirmModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowConfirmModal(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showConfirmModal]);

  return (
    <>
      <div
        role="switch"
        aria-checked={isActive}
        tabIndex={0}
        onClick={handleToggleClick}
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

      {/* Confirmation Modal */}
      {showConfirmModal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#161616]/60 backdrop-blur-xs p-4"
            onClick={handleCancel}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="bob-activate-title"
              className="w-full max-w-md border border-[#e0e0e0] bg-white p-6 shadow-2xl rounded-[2px] font-['IBM Plex Sans'] animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-[#e0e0e0] pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-[2px] bg-[#edf5ff] text-[#0f62fe]">
                    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h2
                      id="bob-activate-title"
                      className="font-semibold text-base text-[#161616]"
                    >
                      Enable BOB Autonomous Agent
                    </h2>
                    <p className="text-xs text-[#525252]">
                      {SITE.name} · {SITE.id}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-[#525252] hover:text-[#161616] cursor-pointer p-1 text-base leading-none"
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="py-5 space-y-3">
                <div className="rounded-[2px] border-l-4 border-[#0f62fe] bg-[#edf5ff] p-3 text-xs leading-5">
                  <p className="font-semibold text-[13px] text-[#0043ce]">
                    Agent will execute the configured actions
                  </p>
                  <p className="mt-1 text-[#525252]">
                    Once activated, BOB will monitor live telemetry and autonomously execute configured operational actions within the approved safety limits.
                  </p>
                </div>
                <p className="text-xs text-[#525252] leading-5">
                  Click <strong>Proceed</strong> to turn on BOB autonomous dispatch, or <strong>Cancel</strong> to keep BOB inactive.
                </p>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-[#e0e0e0] pt-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="min-h-10 rounded-[2px] border border-[#8d8d8d] px-4 text-xs font-semibold text-[#161616] hover:bg-[#f4f4f4] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProceed}
                  className="min-h-10 rounded-[2px] bg-[#0f62fe] px-5 text-xs font-semibold text-white hover:bg-[#0043ce] transition-colors cursor-pointer shadow-xs"
                >
                  Proceed
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
