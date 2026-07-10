import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useTheme } from "../theme/ThemeContext.jsx";
import {
  newEventPlayer, commanderPeers, takenTiebreaks, firstFreeTiebreak, needsNudge, assignPods, isSupportedDeckUrl,
} from "../lib/pods.js";
import TiebreakPicker from "./TiebreakPicker.jsx";

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

// Self-serve (a player joins) or walk-in (host adds someone): paste a Moxfield or
// Archidekt deck URL, reuse /api/scrape to analyze it for the bracket, resolve a
// commander collision with an emoji/color tiebreak, then write the player to the event.
export default function EventSignup({ code, event, variant = "self", onDone, onCancel }) {
  const t = useTokens();
  const isWalkin = variant === "walkin";

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scraped, setScraped] = useState(null);   // deckData awaiting confirm
  const [tiebreak, setTiebreak] = useState(null);

  const peers = scraped ? commanderPeers(event.players, scraped.commander) : [];
  const collision = peers.length > 0;
  const taken = scraped ? takenTiebreaks(event.players, scraped.commander) : [];

  const scrape = async () => {
    const clean = url.trim();
    if (!isSupportedDeckUrl(clean)) {
      setError("Paste your Moxfield or Archidekt deck URL — e.g. moxfield.com/decks/abc123");
      return;
    }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(clean)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't analyze that deck.");
      setScraped(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (collision && !tiebreak) { setError("Pick an emoji or color first."); return; }
    setLoading(true); setError(null);
    try {
      // Re-read the row so we append to the latest player list.
      const { data, error: readErr } = await supabase.from("sessions").select("data").eq("id", code).single();
      if (readErr || !data) throw new Error("Lost the event. Refresh and try again.");
      const ev = data.data;

      const player = newEventPlayer({ commander: scraped.commander, deckData: scraped, addedByHost: isWalkin });
      if (collision) {
        player.tiebreak = tiebreak;
        // Distinguish any peer that joined while still unique.
        for (const peer of commanderPeers(ev.players, scraped.commander)) {
          if (!peer.tiebreak) {
            peer.tiebreak = firstFreeTiebreak(takenTiebreaks(ev.players, scraped.commander).concat(tiebreak));
          }
        }
      }
      // Append, then re-run pod assignment (deterministic — forms pods of 4
      // within one bracket step, leaves the rest waiting).
      const withPlayer = { ...ev, players: [...ev.players, player] };
      const assigned = assignPods(withPlayer);
      const updated = { ...withPlayer, players: assigned.players, pods: assigned.pods };
      const { error: writeErr } = await supabase.from("sessions").update({ data: updated }).eq("id", code);
      if (writeErr) throw new Error(writeErr.message || "Couldn't sign up. Try again.");

      if (!isWalkin) localStorage.setItem(`podcheck-event-${code}`, player.id);
      onDone?.(player);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const nudge = scraped && needsNudge(scraped.bracket, event.targetBracket);

  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 0, padding: 16, marginBottom: 16 }}>
      <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 700, fontSize: 20, letterSpacing: 1, color: t.ink, marginBottom: 4 }}>
        {isWalkin ? "SEAT A WALK-IN" : "PULL UP A CHAIR"}
      </div>
      <div style={{ fontSize: 12, color: t.dim, lineHeight: 1.6, marginBottom: 14 }}>
        {isWalkin
          ? "Drop in their Moxfield or Archidekt deck link and we'll seat them at a fair table."
          : "Drop in your Moxfield or Archidekt deck link — it's just so we can build fair pods, never a power check."}
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: "8px 12px", background: `${t.attention}15`, border: `1px solid ${t.attention}40`, borderRadius: 0, fontSize: 12, color: t.attention, fontFamily: "'Noto Sans Mono', monospace", lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      {!scraped ? (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && url.trim() && scrape()}
            placeholder="https://moxfield.com/decks/..."
            autoFocus
            style={{ flex: 1, background: t.base, border: `1px solid ${t.border}`, borderRadius: 0, padding: "12px", color: t.ink, fontSize: 14, fontFamily: "inherit" }}
          />
          <button onClick={scrape} disabled={loading || !url.trim()} style={{ background: url.trim() ? t.accent : t.border, border: "none", borderRadius: 0, padding: "0 18px", color: url.trim() ? t.base : t.dim, fontFamily: "'Zilla Slab', serif", fontWeight: 700, fontSize: 15, letterSpacing: 1, cursor: loading ? "wait" : "pointer", flexShrink: 0 }}>
            {loading ? "…" : "GO"}
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 15, color: t.ink, fontWeight: 600 }}>{scraped.commander}</span>
            <span style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 12, color: t.dim }}>
              {scraped.bracket != null ? `B${scraped.bracket}` : "—"}{scraped.power != null ? ` · ${Number(scraped.power).toFixed(1)}` : ""}
            </span>
          </div>

          {nudge && (
            <div style={{ marginBottom: 12, padding: "8px 12px", background: `${t.accent}14`, border: `1px solid ${t.accent}40`, borderRadius: 0, fontSize: 11, color: t.ink, lineHeight: 1.5 }}>
              Heads up — B{scraped.bracket} is outside this event's target (B{event.targetBracket}). You can still join, but consider swapping to a closer deck.
            </div>
          )}

          {collision && (
            <div style={{ marginBottom: 14 }}>
              <TiebreakPicker commander={scraped.commander} taken={taken} value={tiebreak} onChange={setTiebreak} />
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={confirm} disabled={loading} style={{ flex: 1, background: t.accent, border: "none", borderRadius: 0, padding: "12px", color: t.base, fontFamily: "'Zilla Slab', serif", fontWeight: 700, fontSize: 15, letterSpacing: 1, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1 }}>
              {loading ? "…" : isWalkin ? "ADD →" : "JOIN →"}
            </button>
            <button onClick={() => { setScraped(null); setTiebreak(null); setError(null); }} style={{ background: "transparent", border: `1px solid ${t.border}`, borderRadius: 0, padding: "12px 14px", color: t.dim, fontFamily: "'Noto Sans Mono', monospace", fontSize: 11, cursor: "pointer" }}>
              REDO
            </button>
          </div>
        </>
      )}

      {onCancel && !scraped && (
        <button onClick={onCancel} style={{ background: "none", border: "none", color: t.dim, fontSize: 10, cursor: "pointer", fontFamily: "'Noto Sans Mono', monospace", marginTop: 12 }}>
          ← back
        </button>
      )}
    </div>
  );
}
