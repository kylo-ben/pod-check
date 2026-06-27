import { BRACKET_META } from "../lib/ui.jsx";
import { useTheme } from "../theme/ThemeContext.jsx";

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

export default function BalanceVerdict({ players }) {
  const t = useTokens();
  const ready = players.filter((p) => p.status === "ready" && p.deckData?.power != null);
  if (ready.length < 2) return null;

  const powers = ready.map((p) => p.deckData.power);
  const min = Math.min(...powers);
  const max = Math.max(...powers);
  const avg = powers.reduce((a, b) => a + b, 0) / powers.length;
  const spread = max - min;

  const brackets = ready.map((p) => p.deckData.bracket).filter(Boolean);
  const bracketSpread = brackets.length > 1 ? Math.max(...brackets) - Math.min(...brackets) : 0;

  const { emoji, label, advice } = getVerdict(spread, bracketSpread);

  const ranked = [...ready].sort((a, b) => b.deckData.power - a.deckData.power);

  return (
    <div style={{
      background: t.panel,
      border: `1px solid ${t.border}`,
      borderRadius: 0, overflow: "hidden",
    }}>
      <div style={{ height: 4, background: t.accent }} />

      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 36, lineHeight: 1 }}>{emoji}</div>
          <div>
            <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 700, fontSize: 24, letterSpacing: 1, color: t.ink, lineHeight: 1 }}>
              {label}
            </div>
            <div style={{ fontSize: 12, color: t.dim, marginTop: 3 }}>{advice}</div>
          </div>
        </div>

        <div style={{
          display: "flex", gap: 20, padding: "12px 0",
          borderTop: `1px solid ${t.border}`,
          borderBottom: `1px solid ${t.border}`,
          marginBottom: 16, flexWrap: "wrap",
        }}>
          <Stat label="AVG POWER" value={avg.toFixed(1)} t={t} />
          <Stat label="SPREAD" value={spread.toFixed(1)} t={t} />
          {bracketSpread > 0 && <Stat label="BRACKET GAP" value={`${bracketSpread}`} t={t} />}
        </div>

        <div style={{ fontSize: 11, color: t.dim, letterSpacing: 2, marginBottom: 10 }}>POWER RANKING</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ranked.map((p, rank) => {
            const originalIndex = players.indexOf(p);
            const pct = ((p.deckData.power - 1) / 9) * 100;
            return (
              <div key={originalIndex} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 10, color: t.dim, width: 14, textAlign: "right" }}>{rank + 1}</div>
                <div style={{ fontSize: 12, color: t.ink, width: 120, flexShrink: 0 }}>
                  {p.name || `Seat ${originalIndex + 1}`}
                </div>
                <div style={{ flex: 1, background: t.border, borderRadius: 0, height: 6, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: t.accent, borderRadius: 0, transition: "width 1s ease" }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.ink, width: 32, textAlign: "right" }}>
                  {p.deckData.power.toFixed(1)}
                </div>
                {p.deckData.bracket && (
                  <div style={{ fontSize: 10, color: t.dim, width: 24, textAlign: "right" }}>
                    B{p.deckData.bracket}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color, t }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: t.dim, letterSpacing: 2, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? t.ink }}>{value}</div>
    </div>
  );
}

function getVerdict(spread, bracketSpread) {
  if (spread <= 0.8 && bracketSpread <= 1) {
    return { emoji: "⚖️", label: "WELL MATCHED", advice: "This pod is balanced. Good game ahead." };
  }
  if (spread <= 1.5 || bracketSpread <= 1) {
    return { emoji: "🟡", label: "MINOR GAP", advice: "Slight power difference — playable but worth noting." };
  }
  if (spread <= 2.5) {
    return { emoji: "⚠️", label: "NOTABLE GAP", advice: "Real difference in power levels. Consider a bracket conversation." };
  }
  return { emoji: "🔴", label: "SIGNIFICANT MISMATCH", advice: "Big power gap. Someone may want to swap decks." };
}
