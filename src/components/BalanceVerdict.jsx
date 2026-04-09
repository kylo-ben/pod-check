import { COLORS, BRACKET_META } from "../lib/ui.jsx";

export default function BalanceVerdict({ players }) {
  const ready = players.filter((p) => p.status === "ready" && p.deckData?.power != null);
  if (ready.length < 2) return null;

  const powers = ready.map((p) => p.deckData.power);
  const min = Math.min(...powers);
  const max = Math.max(...powers);
  const avg = powers.reduce((a, b) => a + b, 0) / powers.length;
  const spread = max - min;

  const brackets = ready.map((p) => p.deckData.bracket).filter(Boolean);
  const bracketSpread = brackets.length > 1 ? Math.max(...brackets) - Math.min(...brackets) : 0;

  const { emoji, label, color, advice } = getVerdict(spread, bracketSpread);

  // Sort players by power descending for ranking
  const ranked = [...ready].sort((a, b) => b.deckData.power - a.deckData.power);

  return (
    <div
      style={{
        background: "rgba(26,28,46,0.12)",
        border: `1px solid ${color}30`,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      {/* Top gradient bar */}
      <div
        style={{
          height: 4,
          background: `linear-gradient(90deg, ${players
            .filter((p) => p.status === "ready")
            .map((_, i) => COLORS[players.indexOf(players.filter((p) => p.status === "ready")[i])])
            .join(", ")})`,
        }}
      />

      <div style={{ padding: 20 }}>
        {/* Verdict headline */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 36, lineHeight: 1 }}>{emoji}</div>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 3, color, lineHeight: 1 }}>
              {label}
            </div>
            <div style={{ fontSize: 12, color: "#8890b0", marginTop: 3 }}>{advice}</div>
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: 20,
            padding: "12px 0",
            borderTop: "1px solid rgba(26,28,46,0.15)",
            borderBottom: "1px solid rgba(26,28,46,0.15)",
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <Stat label="AVG POWER" value={avg.toFixed(1)} />
          <Stat label="SPREAD" value={spread.toFixed(1)} color={spread > 2 ? "#c4915a" : undefined} />
          {bracketSpread > 0 && <Stat label="BRACKET GAP" value={`${bracketSpread}`} color={bracketSpread > 1 ? "#c4915a" : undefined} />}
        </div>

        {/* Power ranking */}
        <div style={{ fontSize: 11, color: "#8890b0", letterSpacing: 2, marginBottom: 10 }}>POWER RANKING</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ranked.map((p, rank) => {
            const originalIndex = players.indexOf(p);
            const color = COLORS[originalIndex];
            const pct = ((p.deckData.power - 1) / 9) * 100;
            return (
              <div key={originalIndex} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 10, color: "#8890b0", width: 14, textAlign: "right" }}>
                  {rank + 1}
                </div>
                <div style={{ fontSize: 12, color, width: 120, flexShrink: 0 }}>
                  {p.name || `Seat ${originalIndex + 1}`}
                </div>
                <div style={{ flex: 1, background: "rgba(26,28,46,0.15)", borderRadius: 3, height: 6, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: color,
                      borderRadius: 3,
                      transition: "width 1s ease",
                    }}
                  />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color, width: 32, textAlign: "right" }}>
                  {p.deckData.power.toFixed(1)}
                </div>
                {p.deckData.bracket && (
                  <div style={{ fontSize: 10, color: BRACKET_META[p.deckData.bracket]?.color ?? "#8890b0", width: 24, textAlign: "right" }}>
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

function Stat({ label, value, color = "#d4d8eb" }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: "#8890b0", letterSpacing: 2, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function getVerdict(spread, bracketSpread) {
  if (spread <= 0.8 && bracketSpread <= 1) {
    return {
      emoji: "⚖️",
      label: "WELL MATCHED",
      color: "#5aaa88",
      advice: "This pod is balanced. Good game ahead.",
    };
  }
  if (spread <= 1.5 || bracketSpread <= 1) {
    return {
      emoji: "🟡",
      label: "MINOR GAP",
      color: "#c4915a",
      advice: "Slight power difference — playable but worth noting.",
    };
  }
  if (spread <= 2.5) {
    return {
      emoji: "⚠️",
      label: "NOTABLE GAP",
      color: "#c4915a",
      advice: "Real difference in power levels. Consider a bracket conversation.",
    };
  }
  return {
    emoji: "🔴",
    label: "SIGNIFICANT MISMATCH",
    color: "#c45c6a",
    advice: "Big power gap. Someone may want to swap decks.",
  };
}
