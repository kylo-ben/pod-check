import { useTheme } from "../theme/ThemeContext.jsx";
import { TIEBREAK_EMOJIS, TIEBREAK_COLORS } from "../lib/pods.js";

function useTokens() {
  const { theme, mode } = useTheme();
  const light = mode === "light";
  return {
    panel:  light ? theme.paper : theme.surface,
    ink:    light ? theme.ink   : theme.white,
    dim:    light ? theme.muted : theme.dim,
    border: light ? theme.border : theme.muted,
    accent: light ? theme.gold  : theme.amber,
  };
}

// Shown when a commander collides with another player. Pick a non-ordinal emoji or
// color to tell the two apart. Options already taken by peers are disabled.
export default function TiebreakPicker({ commander, taken, value, onChange }) {
  const t = useTokens();
  const used = new Set(taken);

  const cell = (opt, isColor) => {
    const disabled = used.has(opt) && value !== opt;
    const active = value === opt;
    return (
      <button
        key={opt}
        onClick={() => !disabled && onChange(opt)}
        disabled={disabled}
        style={{
          width: 38, height: 38, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: isColor ? opt : active ? `${t.accent}20` : t.panel,
          border: `2px solid ${active ? t.accent : t.border}`,
          borderRadius: 0, cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.3 : 1, fontSize: 18, lineHeight: 1,
        }}
      >
        {!isColor && opt}
      </button>
    );
  };

  return (
    <div>
      <div style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 11, color: t.dim, lineHeight: 1.6, marginBottom: 12 }}>
        Another <span style={{ color: t.ink }}>{commander}</span> is already here. Pick an emoji or color so your pod can tell you apart.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {TIEBREAK_EMOJIS.map((e) => cell(e, false))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {TIEBREAK_COLORS.map((c) => cell(c, true))}
      </div>
    </div>
  );
}
