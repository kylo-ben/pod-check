import { isColorTiebreak } from "../lib/pods.js";

// Renders a player's anonymous identity: commander legend, plus the tiebreak when
// there's a commander collision — an emoji inline, or a square color chip. Never a
// number, letter, or name.
export default function Identity({ player, color, size = 13 }) {
  const tb = player.tiebreak;
  const isColor = isColorTiebreak(tb);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, color, fontSize: size }}>
      {isColor && (
        <span style={{ width: size - 2, height: size - 2, background: tb, borderRadius: 0, flexShrink: 0 }} />
      )}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {player.commander}{tb && !isColor ? ` ${tb}` : ""}
      </span>
    </span>
  );
}
