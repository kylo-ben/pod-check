import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { makeSessionId, PageWrapper, Logo } from "../lib/ui.jsx";
import { newEvent, DEFAULT_TARGET } from "../lib/pods.js";
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

const BRACKETS = [
  { b: 1, label: "Precon" },
  { b: 2, label: "Upgraded" },
  { b: 3, label: "Optimized" },
  { b: 4, label: "High Power" },
  { b: 5, label: "cEDH" },
];

// Host opens an event with a target bracket and a code, then lands in the lobby.
export default function EventHostSetup() {
  const t = useTokens();
  const navigate = useNavigate();
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const create = async () => {
    setCreating(true); setError(null);
    try {
      const id = makeSessionId();
      const { error } = await supabase.from("sessions").insert({ id, data: newEvent(id, target) });
      if (error) throw new Error(error.message || "Could not create the event.");
      navigate(`/event/${id}?host=1`);
    } catch (e) {
      setError(e.message);
      setCreating(false);
    }
  };

  return (
    <PageWrapper>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${t.border}` }}>
        <Logo size="sm" />
        <button onClick={() => navigate("/")} style={{ background: "none", border: `1px solid ${t.border}`, borderRadius: 0, padding: "4px 10px", color: t.dim, fontSize: 10, cursor: "pointer", fontFamily: "'Noto Sans Mono', monospace" }}>
          CANCEL
        </button>
      </div>

      <div style={{ padding: "24px 20px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 700, fontSize: 32, letterSpacing: 1, color: t.ink, marginBottom: 6, lineHeight: 1.1 }}>
          HOST AN EVENT
        </div>
        <div style={{ fontSize: 13, color: t.dim, lineHeight: 1.7, marginBottom: 24 }}>
          Players sign up with a Moxfield or Archidekt deck URL. Pods fill by arrival, one bracket step apart.
        </div>

        <div style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 9, color: t.dim, letterSpacing: 1.5, marginBottom: 10 }}>
          TARGET BRACKET
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
          {BRACKETS.map(({ b, label }) => {
            const active = target === b;
            return (
              <button key={b} onClick={() => setTarget(b)} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "12px 14px",
                background: active ? `${t.accent}20` : t.panel,
                border: `1px solid ${active ? t.accent : t.border}`,
                borderLeft: `2px solid ${active ? t.accent : t.border}`,
                borderRadius: 0, cursor: "pointer", fontFamily: "inherit",
                color: active ? t.accent : t.ink,
              }}>
                <span style={{ fontSize: 13, fontWeight: active ? 700 : 400 }}>B{b} · {label}</span>
                {active && <span style={{ fontSize: 11, fontFamily: "'Noto Sans Mono', monospace", letterSpacing: 1 }}>TARGET</span>}
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: "8px 12px", background: `${t.attention}15`, border: `1px solid ${t.attention}40`, borderRadius: 0, fontSize: 12, color: t.attention, fontFamily: "'Noto Sans Mono', monospace" }}>
            {error}
          </div>
        )}

        <button onClick={create} disabled={creating} style={{
          width: "100%", padding: "15px 16px",
          background: t.accent, border: "none", borderRadius: 0,
          color: t.base, fontFamily: "'Zilla Slab', serif", fontWeight: 700,
          fontSize: 18, letterSpacing: 1, cursor: creating ? "wait" : "pointer",
          opacity: creating ? 0.7 : 1,
        }}>
          {creating ? "CREATING…" : "CREATE EVENT →"}
        </button>
      </div>
    </PageWrapper>
  );
}
