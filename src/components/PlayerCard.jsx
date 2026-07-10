import { BRACKET_META } from "../lib/ui.jsx";
import { useTheme } from "../theme/ThemeContext.jsx";

const STATUS_CONFIG = {
  empty:     { label: "Empty",     dim: true  },
  pending:   { label: "Joined",    dim: false },
  analyzing: { label: "Analyzing", dim: false },
  ready:     { label: "Ready",     dim: false },
};

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

// Themes/warnings may arrive as plain strings or as objects ({label}/{text}/{message}).
// Coerce to a display string so React never tries to render a raw object.
function asText(item) {
  if (item == null) return "";
  if (typeof item === "string") return item;
  return item.label ?? item.name ?? item.text ?? item.message ?? "";
}

function VectorBar({ label, value, color, track }) {
  if (value == null) return null;
  return (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2, opacity: 0.65 }}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div style={{ background: track, borderRadius: 0, height: 5, overflow: "hidden" }}>
        <div
          style={{
            width: `${value}%`,
            height: "100%",
            background: color,
            borderRadius: 0,
            transition: "width 1.2s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        />
      </div>
    </div>
  );
}

export default function PlayerCard({ player, index, showResult = false, highlight = false }) {
  const t = useTokens();
  const color = t.accent;
  const cfg = STATUS_CONFIG[player.status] ?? STATUS_CONFIG.empty;
  const bracket = player.deckData?.bracket;
  const bMeta = bracket ? BRACKET_META[bracket] : null;
  const statusColor = (s) => (s === "empty" ? t.dim : t.ink);

  return (
    <div
      style={{
        background: t.panel,
        border: `1px solid ${highlight ? color : t.border}`,
        borderRadius: 0,
        padding: 16,
        opacity: cfg.dim ? 0.45 : 1,
        transition: "all 0.3s",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {player.status !== "empty" && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showResult && player.deckData ? 12 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 26, height: 26, borderRadius: 0,
              background: `${color}20`, border: `1.5px solid ${color}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color, flexShrink: 0,
            }}
          >
            {index + 1}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: player.name ? t.ink : t.dim }}>
              {player.name || `Seat ${index + 1}`}
              {player.deckData?.offline && <span style={{ fontSize: 11, marginLeft: 5 }}>📵</span>}
              {player.deckData?.selfReported && !player.deckData?.offline && <span style={{ fontSize: 9, color: t.dim, marginLeft: 5 }}>· self-reported</span>}
            </div>
            {showResult && player.deckData?.commander && (
              <div style={{ fontSize: 10, color: t.dim, marginTop: 1 }}>{player.deckData.commander}</div>
            )}
          </div>
        </div>

        {showResult && player.deckData?.power != null ? (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.ink, lineHeight: 1 }}>
              {player.deckData.power.toFixed(1)}
            </div>
            <div style={{ fontSize: 9, opacity: 0.4, marginTop: 1 }}>POWER</div>
          </div>
        ) : (
          <div style={{ fontSize: 10, color: statusColor(player.status), letterSpacing: 1 }}>
            {player.status === "analyzing" ? (
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span
                  style={{
                    width: 8, height: 8,
                    border: "1.5px solid currentColor", borderTop: "1.5px solid transparent",
                    borderRadius: 0, display: "inline-block",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                ANALYZING
              </span>
            ) : cfg.label.toUpperCase()}
          </div>
        )}
      </div>

      {showResult && player.deckData && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            {bMeta && (
              <span style={{
                fontSize: 10,
                background: `${t.accent}20`,
                border: `1px solid ${t.accent}40`,
                borderRadius: 0, padding: "2px 7px",
                color: t.accent, fontWeight: 700,
              }}>
                B{bracket} · {bMeta.label}
              </span>
            )}
            {player.deckData.tier && (
              <span style={{ fontSize: 10, color: t.dim }}>{player.deckData.tier}</span>
            )}
          </div>

          {player.deckData.vectors && (
            <div>
              <VectorBar label="Velocity"    value={player.deckData.vectors.velocity}    color={color} track={t.border} />
              <VectorBar label="Consistency" value={player.deckData.vectors.consistency} color={color} track={t.border} />
              <VectorBar label="Interaction" value={player.deckData.vectors.interaction} color={color} track={t.border} />
              <VectorBar label="Efficiency"  value={player.deckData.vectors.efficiency}  color={color} track={t.border} />
              <VectorBar label="Lethality"   value={player.deckData.vectors.lethality}   color={color} track={t.border} />
            </div>
          )}

          {player.deckData.themes?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {player.deckData.themes.map((theme, i) => (
                <span key={i} style={{ fontSize: 10, color: t.accent, background: `${t.accent}1a`, borderRadius: 0, padding: "2px 7px" }}>
                  {asText(theme)}
                </span>
              ))}
            </div>
          )}

          {player.deckData.warnings?.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
              {player.deckData.warnings.map((warning, i) => (
                <div key={i} style={{ fontSize: 10, color: t.attention, lineHeight: 1.5 }}>
                  ⚠ {asText(warning)}
                </div>
              ))}
            </div>
          )}

          {player.deckData.scrychecUrl && (
            <a
              href={player.deckData.scrychecUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block", marginTop: 10, fontSize: 10,
                color: t.dim, textDecoration: "none",
                borderBottom: `1px solid ${t.border}`,
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
