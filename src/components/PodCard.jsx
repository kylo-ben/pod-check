import { useTheme } from "../theme/ThemeContext.jsx";
import { displayName, MAX_POD } from "../lib/pods.js";

function useTokens() {
  const { theme, mode } = useTheme();
  const light = mode === "light";
  return {
    base:   theme.base,
    panel:  light ? theme.paper : theme.surface,
    ink:    light ? theme.ink   : theme.white,
    dim:    light ? theme.muted : theme.dim,
    border: light ? theme.border : theme.muted,
    accent: light ? theme.gold  : theme.amber,
  };
}

// One pod: up to MAX_POD anonymous commander identities, plus empty slots while
// it waits for a compatible fourth. `index` is display order, not a player rank.
export default function PodCard({ index, members, children }) {
  const t = useTokens();
  const brackets = members.map((m) => m.bracket).filter((b) => b != null);
  const range = brackets.length ? (Math.min(...brackets) === Math.max(...brackets)
    ? `B${brackets[0]}`
    : `B${Math.min(...brackets)}–B${Math.max(...brackets)}`) : "—";
  const open = MAX_POD - members.length;

  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 0, marginBottom: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 700, fontSize: 16, letterSpacing: 1, color: t.ink }}>
          POD {index + 1}
        </div>
        <div style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 10, color: t.dim, letterSpacing: 1 }}>
          {range}{open > 0 ? ` · ${open} OPEN` : " · FULL"}
        </div>
      </div>

      {members.map((m) => (
        <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${t.border}` }}>
          <span style={{ fontSize: 13, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayName(m)}
          </span>
          <span style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 11, color: t.dim, flexShrink: 0, marginLeft: 8 }}>
            {m.bracket != null ? `B${m.bracket}` : "—"}
          </span>
        </div>
      ))}

      {Array.from({ length: open }).map((_, i) => (
        <div key={`open-${i}`} style={{ padding: "10px 14px", borderBottom: `1px solid ${t.border}` }}>
          <span style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 11, color: t.dim, letterSpacing: 1, opacity: 0.6 }}>
            WAITING FOR A 4TH…
          </span>
        </div>
      ))}

      {children}
    </div>
  );
}
