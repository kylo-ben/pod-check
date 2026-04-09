import { COLORS, BRACKET_META } from "../lib/ui.jsx";

const STATUS_CONFIG = {
  empty:     { label: "Empty",     dim: true  },
  pending:   { label: "Joined",    dim: false },
  analyzing: { label: "Analyzing", dim: false },
  ready:     { label: "Ready",     dim: false },
};

function VectorBar({ label, value, color }) {
  if (value == null) return null;
  return (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2, opacity: 0.65 }}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div style={{ background: "rgba(26,28,46,0.2)", borderRadius: 3, height: 5, overflow: "hidden" }}>
        <div
          style={{
            width: `${value}%`,
            height: "100%",
            background: color,
            borderRadius: 3,
            transition: "width 1.2s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        />
      </div>
    </div>
  );
}

export default function PlayerCard({ player, index, showResult = false, highlight = false }) {
  const color = COLORS[index];
  const cfg = STATUS_CONFIG[player.status] ?? STATUS_CONFIG.empty;
  const bracket = player.deckData?.bracket;
  const bMeta = bracket ? BRACKET_META[bracket] : null;

  return (
    <div
      style={{
        background: "rgba(26,28,46,0.12)",
        border: `1px solid ${highlight ? color + "60" : "rgba(26,28,46,0.2)"}`,
        borderRadius: 14,
        padding: 16,
        opacity: cfg.dim ? 0.4 : 1,
        transition: "all 0.3s",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top color bar */}
      {player.status !== "empty" && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />
      )}

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showResult && player.deckData ? 12 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: `${color}20`,
              border: `1.5px solid ${color}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color,
              flexShrink: 0,
            }}
          >
            {index + 1}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: player.name ? "#d4d8eb" : "#3d3f5a" }}>
              {player.name || `Seat ${index + 1}`}
              {player.deckData?.offline && <span style={{ fontSize: 11, marginLeft: 5 }}>📵</span>}
              {player.deckData?.selfReported && !player.deckData?.offline && <span style={{ fontSize: 9, color: "#8890b0", marginLeft: 5 }}>· self-reported</span>}
            </div>
            {showResult && player.deckData?.commander && (
              <div style={{ fontSize: 10, color: "#8890b0", marginTop: 1 }}>{player.deckData.commander}</div>
            )}
          </div>
        </div>

        {/* Right side: power or status */}
        {showResult && player.deckData?.power != null ? (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>
              {player.deckData.power.toFixed(1)}
            </div>
            <div style={{ fontSize: 9, opacity: 0.4, marginTop: 1 }}>POWER</div>
          </div>
        ) : (
          <div style={{ fontSize: 10, color: getStatusColor(player.status), letterSpacing: 1 }}>
            {player.status === "analyzing" ? (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    border: "1.5px solid currentColor",
                    borderTop: "1.5px solid transparent",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                ANALYZING
              </span>
            ) : cfg.label.toUpperCase()}
          </div>
        )}
      </div>

      {/* Result detail */}
      {showResult && player.deckData && (
        <>
          {/* Bracket + tier */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            {bMeta && (
              <span
                style={{
                  fontSize: 10,
                  background: bMeta.color + "20",
                  border: `1px solid ${bMeta.color}40`,
                  borderRadius: 4,
                  padding: "2px 7px",
                  color: bMeta.color,
                  fontWeight: 700,
                }}
              >
                B{bracket} · {bMeta.label}
              </span>
            )}
            {player.deckData.tier && (
              <span style={{ fontSize: 10, color: "#8890b0" }}>{player.deckData.tier}</span>
            )}
          </div>

          {/* Vectors */}
          {player.deckData.vectors && (
            <div>
              <VectorBar label="Speed"       value={player.deckData.vectors.speed}       color={color} />
              <VectorBar label="Consistency" value={player.deckData.vectors.consistency} color={color} />
              <VectorBar label="Interaction" value={player.deckData.vectors.interaction} color={color} />
              <VectorBar label="Mana Base"   value={player.deckData.vectors.manaBase}    color={color} />
              <VectorBar label="Threats"     value={player.deckData.vectors.threats}     color={color} />
            </div>
          )}

          {/* Combos / game changers */}
          {(player.deckData.combos > 0 || player.deckData.gameChangers > 0) && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {player.deckData.combos > 0 && (
                <span style={{ fontSize: 10, color: "#c45c6a", background: "rgba(196,92,106,0.1)", borderRadius: 4, padding: "2px 7px" }}>
                  {player.deckData.combos} combo{player.deckData.combos !== 1 ? "s" : ""}
                </span>
              )}
              {player.deckData.gameChangers > 0 && (
                <span style={{ fontSize: 10, color: "#c4915a", background: "rgba(196,145,90,0.1)", borderRadius: 4, padding: "2px 7px" }}>
                  {player.deckData.gameChangers} game changer{player.deckData.gameChangers !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {/* Link back to ScryCheck */}
          {player.deckData.scrychecUrl && (
            <a
              href={player.deckData.scrychecUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                marginTop: 10,
                fontSize: 10,
                color: "#8890b0",
                textDecoration: "none",
                borderBottom: "1px solid rgba(136,144,176,0.4)",
              }}
            >
              View full analysis on ScryCheck ↗
            </a>
          )}
        </>
      )}
    </div>
  );
}

function getStatusColor(status) {
  return {
    empty:     "#3d3f5a",
    pending:   "#7ba7bb",
    analyzing: "#c4915a",
    ready:     "#5aaa88",
  }[status] ?? "#3d3f5a";
}
