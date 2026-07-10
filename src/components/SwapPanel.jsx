import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useTheme } from "../theme/ThemeContext.jsx";
import { isPodValid, assignPods, displayName, isSupportedDeckUrl } from "../lib/pods.js";

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

const MAJORITY = 2; // 2-of-3 resolves either way

// Re-reads the event row, applies a mutation to this pod, writes back.
async function mutatePod(code, podId, fn) {
  const { data, error } = await supabase.from("sessions").select("data").eq("id", code).single();
  if (error || !data) throw new Error("Lost the event. Refresh and try again.");
  const ev = data.data;
  const result = fn(ev, ev.pods.find((p) => p.id === podId));
  const next = result ?? ev;
  const { error: writeErr } = await supabase.from("sessions").update({ data: next }).eq("id", code);
  if (writeErr) throw new Error(writeErr.message || "Write failed.");
}

// Deck-swap proposals for one pod. A member proposes swapping their own deck; the
// other three vote thumbs up/down ANONYMOUSLY (only the tally + who-has-voted are
// stored, never the direction per person); it resolves at a 2-of-3 majority.
export default function SwapPanel({ code, pod, members, myId }) {
  const t = useTokens();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [url, setUrl] = useState("");

  const swap = pod.swap;
  const amProposer = swap && swap.byPlayerId === myId;
  const haveVoted = swap && swap.votedBy.includes(myId);
  const proposer = swap && members.find((m) => m.id === swap.byPlayerId);

  const run = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const propose = () => run(() => mutatePod(code, pod.id, (ev, p) => {
    p.swap = { byPlayerId: myId, tally: { up: 0, down: 0 }, votedBy: [], outcome: null };
    return { ...ev };
  }));

  const cancel = () => run(() => mutatePod(code, pod.id, (ev, p) => { p.swap = null; return { ...ev }; }));

  const vote = (dir) => run(() => mutatePod(code, pod.id, (ev, p) => {
    if (!p.swap || p.swap.votedBy.includes(myId)) return ev;
    p.swap.tally[dir] += 1;
    p.swap.votedBy.push(myId);
    if (p.swap.tally.up >= MAJORITY) p.swap.outcome = "approved";
    else if (p.swap.tally.down >= MAJORITY) { p.swap = null; } // rejected -> clear
    return { ...ev };
  }));

  const submitNew = () => run(async () => {
    const clean = url.trim();
    if (!isSupportedDeckUrl(clean)) {
      throw new Error("Paste your Moxfield or Archidekt deck URL (e.g. moxfield.com/decks/…).");
    }
    const res = await fetch(`/api/scrape?url=${encodeURIComponent(clean)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Couldn't analyze that deck.");

    await mutatePod(code, pod.id, (ev, p) => {
      const players = ev.players.map((pl) =>
        pl.id === myId ? { ...pl, commander: json.commander, deckData: json, bracket: json.bracket, scrycheckUrl: json.scrychecUrl } : pl
      );
      // Re-check adjacency; if the new deck breaks the pod, the swapper drops to
      // waiting and assignPods re-seats everyone.
      const podBrackets = p.memberIds.map((id) => players.find((pl) => pl.id === id)?.bracket);
      if (!isPodValid(podBrackets)) {
        const swapped = players.map((pl) => (pl.id === myId ? { ...pl, status: "waiting", podId: null } : pl));
        p.swap = null;
        const assigned = assignPods({ ...ev, players: swapped });
        return { ...ev, players: assigned.players, pods: assigned.pods };
      }
      p.swap = null;
      return { ...ev, players };
    });
    setUrl("");
  });

  const wrap = { background: t.base, border: `1px dashed ${t.border}`, padding: "10px 14px", borderTop: `1px solid ${t.border}` };
  const small = { fontFamily: "'Noto Sans Mono', monospace", fontSize: 11, color: t.dim, lineHeight: 1.5 };

  // Only pod members interact.
  if (!members.some((m) => m.id === myId)) return null;

  return (
    <div style={wrap}>
      {error && <div style={{ ...small, color: t.attention, marginBottom: 8 }}>{error}</div>}

      {!swap && (
        <button onClick={propose} disabled={busy} style={btn(t)}>PROPOSE TO SWAP MY DECK</button>
      )}

      {swap && amProposer && swap.outcome !== "approved" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={small}>Your swap is up for a vote — {swap.votedBy.length}/3 in.</span>
          <button onClick={cancel} disabled={busy} style={ghost(t)}>CANCEL</button>
        </div>
      )}

      {swap && amProposer && swap.outcome === "approved" && (
        <div>
          <div style={{ ...small, color: t.accent, marginBottom: 8 }}>Approved — submit your new Moxfield or Archidekt deck URL.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://moxfield.com/decks/..." style={{ flex: 1, background: t.panel, border: `1px solid ${t.border}`, borderRadius: 0, padding: "10px", color: t.ink, fontSize: 13, fontFamily: "inherit" }} />
            <button onClick={submitNew} disabled={busy} style={{ ...btn(t), width: "auto", padding: "0 16px" }}>{busy ? "…" : "GO"}</button>
          </div>
        </div>
      )}

      {swap && !amProposer && !haveVoted && (
        <div>
          <div style={{ ...small, marginBottom: 8 }}>
            <span style={{ color: t.ink }}>{proposer ? displayName(proposer) : "A player"}</span> proposes swapping their deck.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => vote("up")} disabled={busy} style={btn(t)}>👍 KEEP IT FAIR</button>
            <button onClick={() => vote("down")} disabled={busy} style={ghost(t)}>👎 NO</button>
          </div>
        </div>
      )}

      {swap && !amProposer && haveVoted && (
        <span style={small}>Vote recorded — anonymous. Waiting on the pod ({swap.votedBy.length}/3).</span>
      )}
    </div>
  );
}

const btn = (t) => ({
  flex: 1, width: "100%", background: t.accent, border: "none", borderRadius: 0, padding: "10px",
  color: t.base, fontFamily: "'Noto Sans Mono', monospace", fontSize: 11, letterSpacing: 1, cursor: "pointer",
});
const ghost = (t) => ({
  background: "transparent", border: `1px solid ${t.border}`, borderRadius: 0, padding: "10px 14px",
  color: t.dim, fontFamily: "'Noto Sans Mono', monospace", fontSize: 11, letterSpacing: 1, cursor: "pointer",
});
