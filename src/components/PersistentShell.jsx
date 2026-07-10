import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { makeSessionId, BRACKET_META, useAuth } from "../lib/ui.jsx";
import { supabase } from "../lib/supabase.js";
import { useTheme } from "../theme/ThemeContext.jsx";

// ── Layout constants ────────────────────────────────────────────────────────
const NAV_H = 64;
const HDR_H = 56;

// WUBRG color-identity pips — real Magic colors, theme-independent.
const COLOR_DOT = { W:"#e8d5a0", U:"#2060c0", B:"#9b8bba", R:"#cc2200", G:"#1a7035" };

// ── Persistence helpers ───────────────────────────────────────────────────────
function readDeck() {
  try { return JSON.parse(localStorage.getItem("podcheck_deck") ?? "null"); }
  catch { return null; }
}
function writeDeck(d) { localStorage.setItem("podcheck_deck", JSON.stringify(d)); }
function readSessionId() { return localStorage.getItem("podcheck_session") ?? null; }
function writeSessionId(id) {
  if (id) localStorage.setItem("podcheck_session", id);
  else localStorage.removeItem("podcheck_session");
}

function relativeTime(iso) {
  if (!iso) return null;
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// HELIX token block resolved per component from the current mode.
function useHelixTokens() {
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

// ── Icons ─────────────────────────────────────────────────────────────────────
function DeckIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="11" height="15" rx="1.5"/>
      <rect x="8" y="7" width="11" height="15" rx="1.5" strokeOpacity="0.45"/>
    </svg>
  );
}

function PodIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7" r="3"/>
      <circle cx="5"  cy="17" r="2.5"/>
      <circle cx="19" cy="17" r="2.5"/>
      <line x1="12" y1="10" x2="5"  y2="14.5"/>
      <line x1="12" y1="10" x2="19" y2="14.5"/>
    </svg>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
// HELIX kills the old blurred art-crop ambient background: flat panel surface
// with a sharp square thumbnail instead.
function ShellHeader({ deck }) {
  const t = useHelixTokens();
  return (
    <div style={{
      height: HDR_H, flexShrink: 0,
      position: "relative", overflow: "hidden",
      background: t.panel,
      borderBottom: `1px solid ${t.border}`,
      display: "flex", alignItems: "center",
    }}>
      {/* Art thumbnail */}
      <div style={{
        position: "relative", zIndex: 1, flexShrink: 0, marginLeft: 12,
        width: 56, height: 40, borderRadius: 0, overflow: "hidden",
        background: t.border,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {deck?.artCrop
          ? <img src={deck.artCrop} alt={deck.commander} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 18, opacity: 0.25 }}>♟</span>
        }
      </div>

      {/* Name + color pips */}
      <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1, padding: "0 10px" }}>
        {deck?.commander ? (
          <>
            <div style={{
              fontFamily: "'Zilla Slab', serif", fontWeight: 700,
              fontSize: 16, letterSpacing: 0.5, color: t.ink,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {deck.commander}
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
              {(deck.colorIdentity ?? []).map(c => (
                <div key={c} style={{ width: 8, height: 8, borderRadius: 0, background: COLOR_DOT[c] ?? "#888" }} />
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 11, color: t.dim, letterSpacing: 1.5 }}>
            LOAD YOUR DECK
          </div>
        )}
      </div>

      {/* Bracket badge */}
      {deck?.bracket && (
        <div style={{
          position: "relative", zIndex: 1, flexShrink: 0, marginRight: 14,
          background: t.base, borderRadius: 0, padding: "4px 9px",
          border: `1px solid ${t.border}`,
        }}>
          <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 700, fontSize: 18, color: t.ink, lineHeight: 1 }}>
            B{deck.bracket}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Deck row ──────────────────────────────────────────────────────────────────
function DeckRow({ deck, isFirst, isSelected, onSelect, pendingDelete, onDelete, onDeleteConfirm }) {
  const t = useHelixTokens();
  const artUrl    = deck.commander_card?.image_uris?.art_crop ?? null;
  const isPending = pendingDelete === deck.id;
  const cardCount = Array.isArray(deck.pile) ? deck.pile.length : null;
  const relTime   = relativeTime(deck.last_opened_at ?? deck.scrycheck_at ?? null);

  return (
    <div
      onClick={() => onSelect(deck)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        minHeight: 72, padding: "10px 0 10px 14px",
        background: isSelected ? `${t.accent}1a` : t.panel,
        border: `1px solid ${isSelected ? t.accent : t.border}`,
        borderLeft: `2px solid ${isFirst || isSelected ? t.accent : t.border}`,
        borderRadius: 0, cursor: "pointer",
        transition: "all 0.15s", boxSizing: "border-box",
      }}
    >
      {/* Art thumbnail */}
      <div style={{
        width: 48, height: 34, borderRadius: 0, overflow: "hidden",
        flexShrink: 0, background: t.border,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {artUrl
          ? <img src={artUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 18, color: t.dim }}>?</span>
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Noto Sans Mono', monospace", fontSize: 13, color: t.ink,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          marginBottom: 5,
        }}>
          {deck.commander_name || "Unknown"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {deck.bracket != null ? (
            <span style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 11, color: t.dim }}>
              B{deck.bracket}{deck.power != null ? ` · ${Number(deck.power).toFixed(1)}` : ""}
            </span>
          ) : (
            <span style={{
              fontFamily: "'Noto Sans Mono', monospace", fontSize: 9, color: t.accent,
              border: `1px solid ${t.accent}50`, borderRadius: 0, padding: "2px 5px", letterSpacing: 1,
            }}>
              UNRATED
            </span>
          )}
          {cardCount != null && (
            <span style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 10, color: t.dim }}>
              · {cardCount} cards
            </span>
          )}
          {relTime && (
            <span style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 10, color: t.dim }}>
              · {relTime}
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={e => { e.stopPropagation(); isPending ? onDeleteConfirm(deck.id) : onDelete(deck.id); }}
        style={{
          background: "none", border: "none", cursor: "pointer",
          flexShrink: 0, minWidth: 44, minHeight: 44,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          color: isPending ? t.attention : t.dim,
          fontFamily: "'Noto Sans Mono', monospace",
          padding: 4, lineHeight: 1.3,
        }}
      >
        {isPending ? (
          <>
            <span style={{ fontSize: 8, letterSpacing: 0.5 }}>TAP AGAIN</span>
            <span style={{ fontSize: 8, letterSpacing: 0.5 }}>TO REMOVE</span>
          </>
        ) : (
          <span style={{ fontSize: 16 }}>×</span>
        )}
      </button>
    </div>
  );
}

// ── MY DECKS page ─────────────────────────────────────────────────────────────
function MyDecksPage({ user, onDeckChange, onEnterPod }) {
  const t = useHelixTokens();
  const [decks,         setDecks]         = useState([]);
  const [selected,      setSelected]      = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const isAnon = !user || user.is_anonymous;

  useEffect(() => {
    if (isAnon) {
      const raw = localStorage.getItem("cardstock_last_deck");
      if (raw) {
        try {
          const p = JSON.parse(raw);
          setDecks([{ ...p, id: "__local__", commander_name: p.commander_name ?? p.commander }]);
        } catch { setDecks([]); }
      } else {
        setDecks([]);
      }
      return;
    }

    supabase
      .from("decks")
      .select("*")
      .eq("user_id", user.id)
      .order("last_opened_at", { ascending: false })
      .then(({ data }) => setDecks(data ?? []));

    const refetch = () =>
      supabase
        .from("decks")
        .select("*")
        .eq("user_id", user.id)
        .order("last_opened_at", { ascending: false })
        .then(({ data }) => setDecks(data ?? []));

    const channel = supabase
      .channel("my-decks")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "decks",
        filter: `user_id=eq.${user.id}`,
      }, refetch)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  const handleDeleteInit    = useCallback((id) => setPendingDelete(id), []);
  const handleDeleteConfirm = useCallback(async (id) => {
    setPendingDelete(null);
    if (id === "__local__") {
      localStorage.removeItem("cardstock_last_deck");
      setDecks([]);
    } else {
      await supabase.from("decks").delete().eq("id", id);
      setDecks(prev => prev.filter(d => d.id !== id));
    }
    setSelected(prev => (prev?.id === id ? null : prev));
  }, []);

  const handleUseInPod = useCallback(() => {
    if (!selected) return;
    onDeckChange({
      commander:     selected.commander_name,
      power:         selected.power         ?? null,
      bracket:       selected.bracket       ?? null,
      tier:          selected.tier          ?? null,
      scryCheckUrl:  selected.scrycheck_url ?? null,
      artCrop:       selected.commander_card?.image_uris?.art_crop ?? null,
      colorIdentity: selected.commander_card?.color_identity       ?? [],
      vectors:       {},
    });
    onEnterPod();
  }, [selected, onDeckChange, onEnterPod]);

  return (
    <div style={{ padding: "18px 16px", maxWidth: 480, margin: "0 auto" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 16,
      }}>
        <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 700, fontSize: 28, letterSpacing: 1, color: t.ink }}>
          MY DECKS
        </div>
        <div style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 11, color: t.dim }}>
          {decks.length} saved
        </div>
      </div>

      {decks.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "40px 20px",
          background: t.panel, border: `1px solid ${t.border}`, borderRadius: 0,
        }}>
          <div style={{
            fontFamily: "'Noto Sans Mono', monospace",
            fontSize: 11, color: t.dim, letterSpacing: 1.5, marginBottom: 10,
          }}>
            NO DECKS SAVED YET
          </div>
          <div style={{
            fontFamily: "'Noto Sans Mono', monospace",
            fontSize: 11, color: t.dim, lineHeight: 1.9,
            marginBottom: isAnon ? 24 : 0,
          }}>
            Add a deck at a table<br />to save it here.
          </div>
          {isAnon && (
            <button style={{
              background: "transparent", border: `1px solid ${t.accent}`,
              borderRadius: 0, padding: "10px 18px",
              color: t.accent, fontFamily: "'Noto Sans Mono', monospace",
              fontSize: 11, letterSpacing: 1.5, cursor: "pointer",
            }}>
              SIGN IN TO SYNC ACROSS DEVICES
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {decks.map((d, i) => (
              <DeckRow
                key={d.id ?? i}
                deck={d}
                isFirst={i === 0}
                isSelected={selected?.id === d.id}
                onSelect={setSelected}
                pendingDelete={pendingDelete}
                onDelete={handleDeleteInit}
                onDeleteConfirm={handleDeleteConfirm}
              />
            ))}
          </div>

          {selected && (
            <button
              onClick={handleUseInPod}
              style={{
                width: "100%", padding: "15px 16px",
                background: t.accent,
                border: "none", borderRadius: 0,
                color: t.base, fontFamily: "'Zilla Slab', serif", fontWeight: 700,
                fontSize: 18, letterSpacing: 1, cursor: "pointer",
                animation: "fadeUp 0.15s ease both",
              }}
            >
              USE IN POD →
            </button>
          )}

          {isAnon && (
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <button style={{
                background: "transparent", border: `1px solid ${t.accent}`,
                borderRadius: 0, padding: "10px 18px",
                color: t.accent, fontFamily: "'Noto Sans Mono', monospace",
                fontSize: 11, letterSpacing: 1.5, cursor: "pointer",
              }}>
                SIGN IN TO SYNC ACROSS DEVICES
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── POD tab ───────────────────────────────────────────────────────────────────
const SESSION_STATUS_TEXT = { empty: "—", pending: "joined", analyzing: "analyzing…", ready: "ready ✓" };

function PodTab({ deck, navigate }) {
  const t = useHelixTokens();
  const statusColor = (s) => (s === "empty" ? t.dim : t.ink);
  const [joinInput,      setJoinInput]      = useState("");
  const [joinError,      setJoinError]      = useState(null);
  const [joining,        setJoining]        = useState(false);
  const [hosting,        setHosting]        = useState(false);
  const [hostError,      setHostError]      = useState(null);
  const [activeId,       setActiveId]       = useState(readSessionId);
  const [activeSession,  setActiveSession]  = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [copied,         setCopied]         = useState(false);

  useEffect(() => {
    if (!activeId) return;
    setSessionLoading(true);
    supabase.from("sessions").select("data").eq("id", activeId).single()
      .then(({ data, error }) => {
        if (error || !data) { writeSessionId(null); setActiveId(null); }
        else setActiveSession(data.data);
      })
      .finally(() => setSessionLoading(false));
  }, [activeId]);

  const handleJoin = useCallback(async () => {
    const clean = joinInput.trim().toUpperCase();
    if (!clean) return;
    setJoining(true); setJoinError(null);
    try {
      const { data, error } = await supabase.from("sessions").select("id").eq("id", clean).single();
      if (error || !data) throw new Error("Session not found. Check the code and try again.");
      writeSessionId(clean);
      navigate(`/join/${clean}`, { state: deck ? { deckData: deck } : undefined });
    } catch (e) {
      setJoinError(e.message);
      setJoining(false);
    }
  }, [joinInput, deck, navigate]);

  const handleHost = useCallback(async () => {
    setHosting(true); setHostError(null);
    try {
      const id = makeSessionId();
      writeSessionId(id);
      navigate(`/join/${id}?host=1`, { state: deck ? { deckData: deck } : undefined });
    } catch (e) {
      setHostError(e.message || "Failed to create session.");
      setHosting(false);
    }
  }, [deck, navigate]);

  const handleShare = useCallback(() => {
    if (!activeId) return;
    navigator.clipboard?.writeText(`https://pod-check.vercel.app/join/${activeId}`).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    });
  }, [activeId]);

  if (sessionLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <div style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 11, color: t.dim, letterSpacing: 2 }}>
          LOADING…
        </div>
      </div>
    );
  }

  // Active session view
  if (activeSession && activeId) {
    return (
      <div style={{ padding: "18px 16px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 9, color: t.dim, letterSpacing: 1.5, marginBottom: 12 }}>
          ACTIVE SESSION
        </div>

        {/* Room code + share */}
        <div style={{
          padding: "14px 16px", background: t.panel, border: `1px solid ${t.border}`,
          borderRadius: 0, marginBottom: 10,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 700, fontSize: 32, letterSpacing: 6, color: t.ink }}>
            {activeId}
          </div>
          <button
            onClick={handleShare}
            style={{
              background: copied ? `${t.accent}22` : `${t.accent}14`,
              border: `1px solid ${t.accent}40`,
              borderRadius: 0, padding: "8px 14px",
              color: t.accent,
              fontFamily: "'Zilla Slab', serif", fontWeight: 700,
              fontSize: 12, letterSpacing: 1.5, cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {copied ? "COPIED ✓" : "SHARE"}
          </button>
        </div>

        {/* Player list */}
        <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 0, overflow: "hidden", marginBottom: 10 }}>
          {activeSession.players.map((p, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px",
              borderBottom: i < 3 ? `1px solid ${t.border}` : "none",
            }}>
              <div style={{ width: 7, height: 7, borderRadius: 0, background: statusColor(p.status), flexShrink: 0 }} />
              <div style={{
                flex: 1, fontFamily: "'Noto Sans Mono', monospace",
                fontSize: 12, color: p.status === "empty" ? t.dim : t.ink,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {p.name || `Seat ${i + 1}`}
              </div>
              <div style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 10, color: statusColor(p.status), letterSpacing: 1 }}>
                {SESSION_STATUS_TEXT[p.status] ?? "—"}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => navigate(`/join/${activeId}`, { state: deck ? { deckData: deck } : undefined })}
            style={{
              flex: 1, padding: "12px 14px",
              background: `${t.accent}14`,
              border: `1px solid ${t.accent}40`,
              borderRadius: 0, color: t.accent,
              fontFamily: "'Zilla Slab', serif", fontWeight: 700,
              fontSize: 14, letterSpacing: 2, cursor: "pointer",
            }}
          >
            REJOIN →
          </button>
          <button
            onClick={() => { writeSessionId(null); setActiveId(null); setActiveSession(null); }}
            style={{
              padding: "12px 14px",
              background: "transparent", border: `1px solid ${t.border}`,
              borderRadius: 0, color: t.dim,
              fontFamily: "'Noto Sans Mono', monospace",
              fontSize: 11, letterSpacing: 1, cursor: "pointer",
            }}
          >
            LEAVE
          </button>
        </div>
      </div>
    );
  }

  // No active session
  return (
    <div style={{ padding: "18px 16px", maxWidth: 480, margin: "0 auto" }}>
      {!deck && (
        <div style={{
          padding: "10px 14px",
          background: `${t.accent}0d`,
          border: `1px solid ${t.accent}24`,
          borderRadius: 0,
          fontFamily: "'Noto Sans Mono', monospace", fontSize: 11,
          color: t.dim,
          marginBottom: 18, lineHeight: 1.5,
        }}>
          Load your deck in MY DECK first for the best experience.
        </div>
      )}

      {/* JOIN */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 9, color: t.dim, letterSpacing: 1.5, marginBottom: 8 }}>
          JOIN A TABLE
        </div>
        {joinError && (
          <div style={{
            padding: "8px 12px", background: `${t.attention}15`, border: `1px solid ${t.attention}40`,
            borderRadius: 0, fontSize: 12, color: t.attention,
            marginBottom: 8, fontFamily: "'Noto Sans Mono', monospace", lineHeight: 1.5,
          }}>
            {joinError}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={joinInput}
            onChange={e => { setJoinInput(e.target.value.toUpperCase()); setJoinError(null); }}
            onKeyDown={e => e.key === "Enter" && joinInput.trim() && handleJoin()}
            placeholder="ENTER CODE"
            maxLength={5}
            style={{
              flex: 1, background: t.panel,
              border: `1px solid ${joinError ? t.attention : t.border}`,
              borderRadius: 0, padding: "14px",
              color: t.ink, fontSize: 26,
              fontFamily: "'Zilla Slab', serif", fontWeight: 700,
              letterSpacing: 8, textAlign: "center",
              transition: "border-color 0.2s",
            }}
          />
          <button
            onClick={handleJoin}
            disabled={joining || !joinInput.trim()}
            style={{
              background: joinInput.trim() ? t.accent : t.border,
              border: "none", borderRadius: 0, padding: "0 20px",
              color: joinInput.trim() ? t.base : t.dim,
              fontFamily: "'Zilla Slab', serif", fontWeight: 700,
              fontSize: 16, letterSpacing: 2,
              cursor: joinInput.trim() ? "pointer" : "default",
              flexShrink: 0, transition: "all 0.2s",
            }}
          >
            {joining ? "…" : "JOIN"}
          </button>
        </div>
      </div>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 1, background: t.border }} />
        <div style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 10, color: t.dim, letterSpacing: 2 }}>OR</div>
        <div style={{ flex: 1, height: 1, background: t.border }} />
      </div>

      {/* HOST */}
      <div>
        <div style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 9, color: t.dim, letterSpacing: 1.5, marginBottom: 8 }}>
          START A TABLE
        </div>
        {hostError && (
          <div style={{
            padding: "8px 12px", background: `${t.attention}15`, border: `1px solid ${t.attention}40`,
            borderRadius: 0, fontSize: 12, color: t.attention,
            marginBottom: 8, fontFamily: "'Noto Sans Mono', monospace", lineHeight: 1.5,
          }}>
            {hostError}
          </div>
        )}
        <button
          onClick={handleHost}
          disabled={hosting}
          style={{
            width: "100%", padding: "14px 16px",
            background: `${t.accent}12`,
            border: `1px solid ${t.accent}36`,
            borderRadius: 0, color: t.accent,
            fontFamily: "'Zilla Slab', serif", fontWeight: 700,
            fontSize: 16, letterSpacing: 3,
            cursor: hosting ? "wait" : "pointer",
            opacity: hosting ? 0.7 : 1, transition: "opacity 0.2s",
          }}
        >
          {hosting ? "CREATING…" : "HOST A POD"}
        </button>
      </div>
    </div>
  );
}

// ── Bottom nav ────────────────────────────────────────────────────────────────
function BottomNav({ tab, onTab }) {
  const t = useHelixTokens();
  const TABS = [
    { id: "deck", label: "MY DECK", Icon: DeckIcon },
    { id: "pod",  label: "POD",     Icon: PodIcon  },
  ];
  return (
    <div style={{
      height: NAV_H, flexShrink: 0,
      display: "flex",
      background: t.base,
      borderTop: `1px solid ${t.border}`,
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {TABS.map(({ id, label, Icon }) => {
        const active = tab === id;
        const color  = active ? t.accent : t.dim;
        return (
          <button
            key={id}
            onClick={() => onTab(id)}
            style={{
              flex: 1, background: "none", border: "none",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 4, cursor: "pointer", position: "relative",
              paddingTop: 8,
            }}
          >
            {active && (
              <div style={{
                position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                width: 22, height: 2, borderRadius: 0, background: t.accent,
              }} />
            )}
            <Icon color={color} />
            <span style={{
              fontFamily: "'Noto Sans Mono', monospace",
              fontSize: 9, letterSpacing: 1.5,
              color, lineHeight: 1,
            }}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Shell root ────────────────────────────────────────────────────────────────
export default function PersistentShell() {
  const t = useHelixTokens();
  const [tab,  setTab]  = useState("deck");
  const [deck, setDeck] = useState(readDeck);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleDeckChange = useCallback((newDeck) => {
    setDeck(newDeck);
    writeDeck(newDeck);
  }, []);

  return (
    <div style={{
      minHeight: "100dvh", background: t.base,
      display: "flex", flexDirection: "column",
      fontFamily: "'Noto Sans', sans-serif",
    }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        input:focus { outline: none; border-color: ${t.accent} !important; }
        a:hover { opacity: 0.8; }
      `}</style>

      <ShellHeader deck={deck} />

      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "deck"
          ? <MyDecksPage user={user} onDeckChange={handleDeckChange} onEnterPod={() => setTab("pod")} />
          : <PodTab deck={deck} navigate={navigate} />
        }
      </div>

      <BottomNav tab={tab} onTab={setTab} />
    </div>
  );
}
