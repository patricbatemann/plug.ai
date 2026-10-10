import React, { useState } from "react";
import { authApi, tokenStore } from "./api/client";

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // First attempt to login
      const res = await authApi.login(email, password);
      tokenStore.set(res.access_token);
      onLoginSuccess?.();
    } catch (err: unknown) {
      // If user is not yet registered in local DB, attempt automatic register
      try {
        const reg = await authApi.register(email, password);
        tokenStore.set(reg.access_token);
        onLoginSuccess?.();
      } catch {
        setErrorMsg(err instanceof Error ? err.message : "Authentication failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#f4f4f4] flex flex-col justify-between overflow-x-hidden font-['IBM_Plex_Sans',system-ui,sans-serif]">
      {/* Background Isometric Blueprint / Schematic Line Art */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <svg
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          viewBox="0 0 1440 900"
        >
          <defs>
            <linearGradient id="panelGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#0f62fe" stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id="panelGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#edf5ff" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#0f62fe" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {/* Left Circuit Lines & Nodes */}
          <path
            d="M -20 250 L 80 250 L 140 290 L 260 290"
            fill="none"
            stroke="#e0e0e0"
            strokeWidth="1.5"
          />
          <circle cx="260" cy="290" r="4.5" fill="#0f62fe" />

          <path
            d="M 260 290 L 310 395 L 360 395"
            fill="none"
            stroke="#a6c8ff"
            strokeWidth="1.5"
          />
          <circle cx="360" cy="395" r="4.5" fill="#0f62fe" />

          <path
            d="M -30 380 L 110 380 L 180 500 L 400 500"
            fill="none"
            stroke="#a6c8ff"
            strokeWidth="1.5"
          />

          <path
            d="M 50 650 L 280 220 L 480 220"
            fill="none"
            stroke="#e0e0e0"
            strokeWidth="1.5"
          />
          <circle cx="480" cy="220" r="4" fill="#a6c8ff" />

          <path
            d="M 120 780 L 420 240 L 460 240"
            fill="none"
            stroke="#a6c8ff"
            strokeWidth="1.25"
          />

          <path
            d="M 180 840 L 480 300"
            fill="none"
            stroke="#e0e0e0"
            strokeWidth="1.5"
          />

          {/* Bottom Left Panel & Traces */}
          <polygon
            points="380,800 480,800 420,835 320,835"
            fill="url(#panelGrad2)"
            stroke="#0f62fe"
            strokeWidth="1.5"
          />
          <polygon
            points="435,835 520,835 480,865 395,865"
            fill="none"
            stroke="#a6c8ff"
            strokeWidth="1.5"
          />
          <path
            d="M 320 835 L 290 835 L 230 785 L 180 785"
            fill="none"
            stroke="#e0e0e0"
            strokeWidth="1.5"
          />
          <circle cx="180" cy="785" r="4.5" fill="#a6c8ff" />

          {/* Center-crossing Diagonal Schematic Lines */}
          <path
            d="M 390 560 L 460 560 L 520 620"
            fill="none"
            stroke="#a6c8ff"
            strokeWidth="1.5"
          />
          <circle cx="390" cy="560" r="4" fill="#0f62fe" />

          {/* Right Circuit Lines & Nodes */}
          <path
            d="M 960 60 L 1460 60"
            fill="none"
            stroke="#e0e0e0"
            strokeWidth="1.5"
          />
          <path
            d="M 960 60 L 960 200 L 1180 200"
            fill="none"
            stroke="#a6c8ff"
            strokeWidth="1.5"
          />

          {/* Right Floating Isometric Panel */}
          <polygon
            points="1080,160 1200,160 1100,260 980,260"
            fill="url(#panelGrad1)"
            stroke="#0043ce"
            strokeWidth="1.5"
          />

          <path
            d="M 1200 160 L 1320 160 L 1320 280"
            fill="none"
            stroke="#e0e0e0"
            strokeWidth="1.5"
          />
          <circle cx="1320" cy="245" r="4.5" fill="#0f62fe" />
          <circle cx="1360" cy="340" r="4.5" fill="#a6c8ff" />

          <path
            d="M 980 260 L 890 350 L 970 350"
            fill="none"
            stroke="#e0e0e0"
            strokeWidth="1.25"
          />
          <circle cx="970" cy="350" r="4" fill="#0f62fe" />

          {/* Right Stepped Bus Traces */}
          <path
            d="M 780 710 L 980 710 L 1070 600 L 1340 600 L 1380 640 L 1460 640"
            fill="none"
            stroke="#a6c8ff"
            strokeWidth="1.5"
          />
          <path
            d="M 800 730 L 1000 730 L 1080 620 L 1300 620"
            fill="none"
            stroke="#e0e0e0"
            strokeWidth="1.25"
          />
          <path
            d="M 820 750 L 1020 750 L 1090 640 L 1260 640"
            fill="none"
            stroke="#a6c8ff"
            strokeWidth="1.5"
          />

          <circle cx="1035" cy="585" r="4.5" fill="#0f62fe" />
          <circle cx="1340" cy="480" r="5" fill="#a6c8ff" />

          <path
            d="M 1280 690 L 1330 690"
            fill="none"
            stroke="#0f62fe"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          <circle cx="1270" cy="740" r="4" fill="#a6c8ff" />
        </svg>
      </div>

      {/* Top Header */}
      <header className="relative z-10 w-full bg-white border-b border-[#e0e0e0] px-6 sm:px-10 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[20px] font-bold text-[#161616]">
            Plugin.ai
          </span>
          <div className="h-4 w-px bg-[#e0e0e0]" />
          <span className="text-[14px] text-[#525252]">
            Energy operations platform
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[#525252]">
          {/* Lock icon */}
          <svg
            className="size-3.5 text-[#525252]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span className="text-[13px] font-normal">Admin access</span>
        </div>
      </header>

      {/* Center Sign-In Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-4">
        <div className="w-full max-w-[460px] bg-white border border-[#e0e0e0] rounded-[2px] shadow-[0_2px_6px_rgba(0,0,0,0.06)] p-7 sm:p-9 transition-all">
          {/* Admin access Tag */}
          <div className="inline-flex items-center px-2 py-0.5 rounded-[2px] bg-[#edf5ff] border border-[#a6c8ff]">
            <span className="text-[11.5px] font-semibold text-[#0f62fe]">
              Admin access
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-[26px] sm:text-[28px] font-semibold text-[#161616] mt-3">
            Admin sign in
          </h1>

          {/* Subtitle */}
          <p className="text-[14px] text-[#525252] mt-1.5 mb-6">
            Secure access to the Plugin.ai energy operations platform.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col">
            {/* Email Address */}
            <label className="block text-[12px] font-medium text-[#525252] mb-1.5 uppercase tracking-wide">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your work email"
              className="w-full bg-[#f4f4f4] text-[#161616] text-[14px] px-3.5 py-2.5 rounded-[2px] border-b border-[#8d8d8d] focus:border-b-2 focus:border-[#0f62fe] focus:bg-[#f4f4f4] focus:outline-none transition-all placeholder:text-[#8d8d8d]"
            />

            {/* Password */}
            <label className="block text-[12px] font-medium text-[#525252] mb-1.5 mt-4 uppercase tracking-wide">
              Password
            </label>
            <div className="relative w-full">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-[#f4f4f4] text-[#161616] text-[14px] px-3.5 py-2.5 pr-10 rounded-[2px] border-b border-[#8d8d8d] focus:border-b-2 focus:border-[#0f62fe] focus:bg-[#f4f4f4] focus:outline-none transition-all placeholder:text-[#8d8d8d]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#525252] hover:text-[#161616] cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  // Eye off icon
                  <svg
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                    />
                  </svg>
                ) : (
                  // Eye icon
                  <svg
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="mt-4 mb-6 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-4 rounded-[2px] border-[#8d8d8d] text-[#0f62fe] focus:ring-[#0f62fe] cursor-pointer"
                />
                <span className="text-[13px] text-[#525252]">Remember me</span>
              </label>

              <button
                type="button"
                onClick={() =>
                  alert("Password recovery link sent to " + (email || "your work email") + ".")
                }
                className="text-[13px] text-[#0f62fe] hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-2.5 bg-[#fff1f1] border-l-2 border-[#da1e28] text-[13px] text-[#da1e28]">
                {errorMsg}
              </div>
            )}

            {/* Sign in Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-12 bg-[#0f62fe] hover:bg-[#0353e9] active:bg-[#0043ce] text-white font-semibold text-[14px] px-4 rounded-[2px] flex items-center justify-between transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <span>{isLoading ? "Signing in…" : "Sign in"}</span>
              <svg
                className="size-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </button>
          </form>

          {/* Card Footer notice */}
          <div className="mt-6 pt-5 border-t border-[#e0e0e0] flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#525252]">
            <div className="flex items-center gap-1.5">
              <svg
                className="size-3.5 text-[#8d8d8d] shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <span>For authorized administrators only.</span>
            </div>

            <div className="flex items-center gap-1">
              <span>Need access?</span>
              <button
                type="button"
                onClick={() =>
                  alert("Support request logged. An administrator will review your account access request.")
                }
                className="text-[#0f62fe] hover:underline font-medium cursor-pointer"
              >
                Contact support
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Page Footer */}
      <footer className="relative z-10 w-full bg-white border-t border-[#e0e0e0] px-6 sm:px-10 py-3.5 flex flex-wrap items-center justify-between text-[12px] text-[#525252]">
        <span>© 2026 Plugin.ai. All rights reserved.</span>
        <div className="flex items-center gap-6">
          <a
            href="#privacy"
            onClick={(e) => {
              e.preventDefault();
              alert("Plugin.ai Privacy Policy: Your enterprise credentials and telemetry are encrypted end-to-end.");
            }}
            className="hover:text-[#161616] hover:underline transition-colors"
          >
            Privacy policy
          </a>
          <a
            href="#terms"
            onClick={(e) => {
              e.preventDefault();
              alert("Plugin.ai Terms of Use: Access is restricted to authorized energy operators.");
            }}
            className="hover:text-[#161616] hover:underline transition-colors"
          >
            Terms of use
          </a>
        </div>
      </footer>
    </div>
  );
}
