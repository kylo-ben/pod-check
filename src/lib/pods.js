// ── Event sign-up logic ───────────────────────────────────────────────────────
// An "event" is a multi-pod sign-up sheet stored as a mode:'event' session in the
// existing `sessions` table (id + jsonb). These helpers are PURE — no Supabase, no
// React — and deterministic, so any client can recompute the same pod assignment
// after a mutation. The single-pod `mode:'podcheck'` flow is untouched.

export const MAX_POD = 4;
export const DEFAULT_TARGET = 3;

// Deck sources the ScryCheck API accepts: public Archidekt & Moxfield URLs.
// Used to validate deck-link input before hitting /api/scrape.
export function isSupportedDeckUrl(raw) {
  try {
    const host = new URL(String(raw).trim()).hostname.replace(/^www\./, "").toLowerCase();
    return host === "moxfield.com" || host === "archidekt.com";
  } catch {
    return false;
  }
}

// ── Constructors ──────────────────────────────────────────────────────────────
export function newEvent(id, targetBracket = DEFAULT_TARGET) {
  return {
    id,
    createdAt: new Date().toISOString(),
    mode: "event",
    targetBracket,
    status: "open",
    players: [],
    pods: [],
  };
}

export function newEventPlayer({ commander, deckData = null, scrycheckUrl = null, addedByHost = false }) {
  return {
    id: crypto.randomUUID(),
    commander,
    tiebreak: null,                                  // emoji/color, set only on collision
    bracket: deckData?.bracket ?? null,
    deckData,
    scrycheckUrl: scrycheckUrl ?? deckData?.scrychecUrl ?? null,
    podId: null,
    status: "waiting",                               // waiting | podded | opted_out
    addedByHost,
    joinedAt: new Date().toISOString(),
  };
}

// ── Bracket rules ─────────────────────────────────────────────────────────────
// A pod is valid only if every deck is within ONE adjacent bracket step.
// {2,3} ok, {3,4} ok, {2,4} not ok, {2,3,4} not ok.
export function isPodValid(brackets) {
  const b = brackets.filter((x) => x != null);
  if (b.length < 2) return true;
  return Math.max(...b) - Math.min(...b) <= 1;
}

// A deck more than one step from the event target gets a gentle swap nudge —
// never a hard block. Retargeting the event shifts what's "in range".
export function needsNudge(bracket, target) {
  if (bracket == null || target == null) return false;
  return Math.abs(bracket - target) > 1;
}

// ── Identity ──────────────────────────────────────────────────────────────────
// Players are shown by commander legend, anonymously. When two share a commander
// each picks a NON-ORDINAL tiebreak (emoji/color) — never numbers/letters/names.
export function commanderPeers(players, commander, excludeId = null) {
  return (players ?? []).filter(
    (p) => p.status !== "opted_out" && p.commander === commander && p.id !== excludeId
  );
}

export function hasCollision(players, commander, excludeId = null) {
  return commanderPeers(players, commander, excludeId).length > 0;
}

export function takenTiebreaks(players, commander, excludeId = null) {
  return commanderPeers(players, commander, excludeId)
    .map((p) => p.tiebreak)
    .filter(Boolean);
}

export function displayName(player) {
  return player.tiebreak && !isColorTiebreak(player.tiebreak)
    ? `${player.commander} ${player.tiebreak}`
    : player.commander;
}

// Tiebreak options: emoji OR color (never numbers/letters/names). Colors are
// intentional player-identity values, not theme chrome — like the WUBRG map.
export const TIEBREAK_EMOJIS = ["🔥", "🌊", "🌿", "⚡", "💀", "🌟", "🍀", "🩸", "👑", "🎲", "🐉", "🦅"];
export const TIEBREAK_COLORS = ["#c0392b", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];

export const isColorTiebreak = (tb) => typeof tb === "string" && tb.startsWith("#");

// First unused option, for auto-distinguishing a peer who joined while unique.
export function firstFreeTiebreak(taken) {
  const used = new Set(taken);
  return (
    TIEBREAK_EMOJIS.find((e) => !used.has(e)) ??
    TIEBREAK_COLORS.find((c) => !used.has(c)) ??
    null
  );
}

// ── Pod assignment ────────────────────────────────────────────────────────────
// Deterministic, arrival-order. Pods form only at MAX_POD compatible players;
// leftovers stay "waiting". An existing pod that lost a member (opt-out) is
// healed by back-filling its open slots with compatible waiting players before
// any new pod is formed. Returns a NEW { players, pods } — does not mutate input.
export function assignPods(event) {
  const target = event.targetBracket ?? DEFAULT_TARGET;
  const byId = new Map(event.players.map((p) => [p.id, { ...p }]));

  const bracketsOf = (memberIds) =>
    memberIds.map((id) => byId.get(id)?.bracket).filter((b) => b != null);

  const waiting = () =>
    [...byId.values()]
      .filter((p) => p.status === "waiting" && p.bracket != null)
      .sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));

  // Keep only pods that still have at least one active (non-opted-out) member.
  const pods = (event.pods ?? [])
    .map((pod) => ({
      ...pod,
      memberIds: pod.memberIds.filter((id) => byId.get(id)?.status !== "opted_out"),
    }))
    .filter((pod) => pod.memberIds.length > 0);

  // 1) Back-fill incomplete pods (members lost to opt-out) with compatible waiters.
  for (const pod of pods) {
    if (pod.memberIds.length >= MAX_POD) continue;
    for (const cand of waiting()) {
      if (pod.memberIds.length >= MAX_POD) break;
      if (isPodValid([...bracketsOf(pod.memberIds), cand.bracket])) {
        pod.memberIds.push(cand.id);
        const p = byId.get(cand.id);
        p.status = "podded";
        p.podId = pod.id;
      }
    }
  }

  // 2) Form new pods of MAX_POD from remaining waiters, earliest as anchor.
  let pool = waiting();
  let guard = 0;
  while (pool.length >= MAX_POD && guard++ < 1000) {
    const anchor = pool[0];
    const group = [anchor];
    for (let i = 1; i < pool.length && group.length < MAX_POD; i++) {
      const cand = pool[i];
      if (isPodValid([...group.map((g) => g.bracket), cand.bracket])) group.push(cand);
    }
    if (group.length === MAX_POD) {
      const podId = crypto.randomUUID();
      pods.push({ id: podId, memberIds: group.map((g) => g.id), swap: null });
      for (const g of group) {
        const p = byId.get(g.id);
        p.status = "podded";
        p.podId = podId;
      }
    } else {
      // No 4-compatible set anchored here yet — leave anchor waiting, try next.
      pool = pool.slice(1);
      continue;
    }
    pool = waiting();
  }

  return { players: [...byId.values()], pods, target };
}
