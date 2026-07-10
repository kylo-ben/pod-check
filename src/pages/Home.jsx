import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageWrapper, Logo, ScryCheckCredit } from "../lib/ui.jsx";
import { useTheme } from "../theme/ThemeContext.jsx";

function useTokens() {
  const { theme, mode } = useTheme();
  const light = mode === "light";
  return {
    base:      theme.base,
    panel:     light ? theme.paper : theme.surface,
    ink:       light ? theme.ink   : theme.white,
    dim:       light ? theme.muted : theme.dim,
    border:    light ? theme.border : theme.muted,
    accent:    light ? theme.gold  : theme.amber,
    attention: light ? theme.stamp : theme.amber,
  };
}

// Event-first front door. Hosting a day of Commander is the primary product; the
// single-pod balance tool is demoted to a quiet "classic" link below.
export default function Home() {
  const t = useTokens();
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const join = () => {
    const clean = code.trim().toUpperCase();
    if (clean) navigate(`/event/${clean}`);
  };

  return (
    <PageWrapper>
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", padding: "28px 20px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ marginBottom: 36 }}>
          <Logo size="lg" />
        </div>

        {/* Primary: host an event */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: t.dim, lineHeight: 1.7, marginBottom: 14 }}>
            Running a table of Commander? Set the bracket, share a code, and let everyone's
            decks settle into fair pods on their own.
          </div>
          <button
            onClick={() => navigate("/event/new")}
            style={{
              width: "100%", padding: "18px 16px",
              background: t.accent, border: "none", borderRadius: 0,
              color: t.base, fontFamily: "'Zilla Slab', serif", fontWeight: 700,
              fontSize: 22, letterSpacing: 1, cursor: "pointer", lineHeight: 1.1,
            }}
          >
            HOST COMMANDER DAY →
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1, height: 1, background: t.border }} />
          <div style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 10, color: t.dim, letterSpacing: 2 }}>OR JOIN ONE</div>
          <div style={{ flex: 1, height: 1, background: t.border }} />
        </div>

        {/* Secondary: join with a code */}
        <div style={{ marginBottom: "auto" }}>
          <div style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 9, color: t.dim, letterSpacing: 1.5, marginBottom: 8 }}>
            GOT A CODE?
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && code.trim() && join()}
              placeholder="ENTER CODE"
              maxLength={5}
              style={{
                flex: 1, background: t.panel, border: `1px solid ${t.border}`,
                borderRadius: 0, padding: "14px", color: t.ink, fontSize: 26,
                fontFamily: "'Zilla Slab', serif", fontWeight: 700,
                letterSpacing: 8, textAlign: "center",
              }}
            />
            <button
              onClick={join}
              disabled={!code.trim()}
              style={{
                background: code.trim() ? t.accent : t.border, border: "none", borderRadius: 0,
                padding: "0 20px", color: code.trim() ? t.base : t.dim,
                fontFamily: "'Zilla Slab', serif", fontWeight: 700, fontSize: 16, letterSpacing: 2,
                cursor: code.trim() ? "pointer" : "default", flexShrink: 0,
              }}
            >
              JOIN
            </button>
          </div>
        </div>

        <ScryCheckCredit />
      </div>
    </PageWrapper>
  );
}
