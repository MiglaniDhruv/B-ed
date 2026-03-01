import logo from "../../assets/logo.png";

export function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-slate-50 flex items-center justify-center z-50">
      <style>{`
        @keyframes fadeScaleIn {
          0%   { opacity: 0; transform: scale(0.6); }
          60%  { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.06); }
        }

        @keyframes spinRing {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        @keyframes ripple {
          0%   { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }

        @keyframes ripple2 {
          0%   { transform: scale(0.8); opacity: 0.4; }
          100% { transform: scale(2.6); opacity: 0; }
        }

        @keyframes ripple3 {
          0%   { transform: scale(0.8); opacity: 0.25; }
          100% { transform: scale(3.0); opacity: 0; }
        }

        @keyframes fadeInUp {
          0%   { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .logo-wrap {
          animation: fadeScaleIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
                     pulse 2.5s ease-in-out 0.7s infinite;
        }

        .spin-ring {
          animation: spinRing 2s linear infinite;
        }

        .ripple-1 {
          animation: ripple 2.4s ease-out 0.8s infinite;
        }
        .ripple-2 {
          animation: ripple2 2.4s ease-out 1.3s infinite;
        }
        .ripple-3 {
          animation: ripple3 2.4s ease-out 1.8s infinite;
        }

        .tagline {
          animation: fadeInUp 0.6s ease-out 0.9s both;
        }
      `}</style>

      <div className="flex flex-col items-center gap-6">
        {/* Logo + rings container */}
        <div className="relative flex items-center justify-center w-40 h-40">
          {/* Ripple rings */}
          <div className="ripple-1 absolute inset-0 rounded-full border-2 border-slate-400/40" />
          <div className="ripple-2 absolute inset-0 rounded-full border-2 border-slate-400/30" />
          <div className="ripple-3 absolute inset-0 rounded-full border border-slate-400/20" />

          {/* Spinning dashed ring */}
          <div
            className="spin-ring absolute inset-0 rounded-full"
            style={{
              background: "transparent",
              border: "2.5px dashed",
              borderColor: "rgba(100,116,139,0.35)",
              borderTopColor: "rgba(15,23,42,0.7)",
            }}
          />

          {/* Logo */}
          <div className="logo-wrap relative z-10 w-24 h-24">
            <img
              src={logo}
              alt="Logo"
              className="w-24 h-24 rounded-full object-cover shadow-xl"
            />
          </div>
        </div>

        {/* Loading dots */}
        <div className="tagline flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-slate-400"
              style={{
                animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                display: "inline-block",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
