import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { makeSessionId, newSession, BRACKET_META } from "../lib/ui.jsx";
import { supabase } from "../lib/supabase.js";

// ── Tokens ────────────────────────────────────────────────────────────────────
const BG      = "#06040f";
const PANEL   = "#0e0a1f";
const BORDER  = "#1a1030";
const PRIMARY = "#5b8fff";
const ACTIVE  = "#00c9ff";
const TEXT    = "#e0f2ff";
const SUCCESS = "#34d399";
const MUTED   = "#4a4a6a";
const DANGER  = "#c45c6a";
const NAV_H   = 64;
const HDR_H   = 56;

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

async function fetchCommanderData(name) {
  try {
    const r = await fetch(
      `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`,
      { headers: { "User-Agent": "PodCheck/1.0 (pod-check.vercel.app)" } }
    );
    const d = await r.json();
    if (d.object !== "card") return null;
    return {
      artCrop:       d.image_uris?.art_crop ?? d.card_faces?.[0]?.image_uris?.art_crop ?? null,
      colorIdentity: d.color_identity ?? [],
    };
  } catch { return null; }
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
function ShellHeader({ deck }) {
  return (
    <div style={{
      height: HDR_H, flexShrink: 0,
      position: "relative", overflow: "hidden",
      background: PANEL,
      borderBottom: `1px solid ${BORDER}`,
      display: "flex", alignItems: "center",
    }}>
      {deck?.artCrop && (
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${deck.artCrop})`,
          backgroundSize: "cover", backgroundPosition: "center 30%",
          filter: "blur(14px) brightness(0.2)",
          transform: "scale(1.08)",
          pointerEvents: "none",
        }} />
      )}

      {/* Art thumbnail */}
      <div style={{
        position: "relative", zIndex: 1, flexShrink: 0, marginLeft: 12,
        width: 56, height: 40, borderRadius: 5, overflow: "hidden",
        background: BORDER,
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
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 16, letterSpacing: 2, color: TEXT,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {deck.commander}
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
              {(deck.colorIdentity ?? []).map(c => (
                <div key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: COLOR_DOT[c] ?? "#888" }} />
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: MUTED, letterSpacing: 1.5 }}>
            LOAD YOUR DECK
          </div>
        )}
      </div>

      {/* Bracket badge */}
      {deck?.bracket && (
        <div style={{
          position: "relative", zIndex: 1, flexShrink: 0, marginRight: 14,
          background: "#1a1040", borderRadius: 6, padding: "4px 9px",
          border: `1px solid ${ACTIVE}35`,
        }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: ACTIVE, lineHeight: 1 }}>
            B{deck.bracket}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bracket pips ──────────────────────────────────────────────────────────────
function BracketPips({ bracket }) {
  const filled = Math.min(bracket ?? 0, 4);
  const color  = BRACKET_META[Math.min(bracket, 4)]?.color ?? ACTIVE;
  return (
    <div style={{ display: "flex", gap: 5 }}>
      {[1,2,3,4].map(i => (
        <div key={i} style={{
          flex: 1, height: 4, borderRadius: 2,
          background: i <= filled ? color : BORDER,
          transition: "background 0.3s",
        }} />
      ))}
    </div>
  );
}

// ── MY DECK tab ───────────────────────────────────────────────────────────────
function MyDeckTab({ deck, onDeckChange, onEnterPod }) {
  const [urlInput, setUrlInput] = useState(deck?.scryCheckUrl ?? "");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const handleScrape = useCallback(async (rawUrl) => {
    const clean = rawUrl.trim();
    if (!clean.startsWith("https://scrycheck.com/deck/")) {
      setError("Paste your ScryCheck result URL — looks like scrycheck.com/deck/…");
      return;
    }
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/scrape?url=${encodeURIComponent(clean)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scrape failed");

      const cmdData = json.commander ? await fetchCommanderData(json.commander) : null;
      const newDeck = {
        ...json,
        scryCheckUrl:  clean,
        artCrop:       cmdData?.artCrop       ?? null,
        colorIdentity: cmdData?.colorIdentity ?? [],
      };
      onDeckChange(newDeck);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }, [onDeckChange]);

  const bMeta = deck?.bracket ? BRACKET_META[Math.min(deck.bracket, 4)] : null;

  return (
    <div style={{ padding: "18px 16px", maxWidth: 480, margin: "0 auto" }}>
      {deck ? (
        <>
          {/* Loaded status row */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px",
            background: `${SUCCESS}0f`,
            border: `1px solid ${SUCCESS}30`,
            borderRadius: 12, marginBottom: 14,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: SUCCESS, flexShrink: 0 }} />
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11, color: SUCCESS, letterSpacing: 1.5, flex: 1,
            }}>
              LOADED
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: TEXT }}>
              {deck.power != null ? `${deck.power.toFixed(1)} · ` : ""}{`B${deck.bracket}`}
            </div>
          </div>

          {/* Bracket pip bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: MUTED, letterSpacing: 1.5 }}>
                BRACKET
              </span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: bMeta?.color ?? ACTIVE }}>
                {bMeta?.label ?? `B${deck.bracket}`}
              </span>
            </div>
            <BracketPips bracket={deck.bracket} />
          </div>

          {/* Commander pill */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "5px 12px",
            background: PANEL, border: `1px solid ${BORDER}`,
            borderRadius: 20, marginBottom: 22,
          }}>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 2, color: TEXT }}>
              {deck.commander}
            </span>
            {(deck.colorIdentity ?? []).map(c => (
              <div key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: COLOR_DOT[c] ?? "#888", flexShrink: 0 }} />
            ))}
          </div>
        </>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 28, letterSpacing: 3, color: TEXT, marginBottom: 6, lineHeight: 1.1,
          }}>
            LOAD YOUR DECK
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
            Paste your{" "}
            <a href="https://scrycheck.com" target="_blank" rel="noopener noreferrer" style={{ color: PRIMARY, textDecoration: "none" }}>
              ScryCheck
            </a>
            {" "}result URL to build your deck profile.
          </div>
        </div>
      )}

      {/* ScryCheck URL input — always visible */}
      <div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: MUTED, letterSpacing: 1.5, marginBottom: 8 }}>
          {deck ? "UPDATE — SCRYCHECK URL" : "SCRYCHECK RESULT URL"}
        </div>
        {error && (
          <div style={{
            padding: "8px 12px", background: `${DANGER}15`, border: `1px solid ${DANGER}40`,
            borderRadius: 8, fontSize: 12, color: DANGER,
            marginBottom: 8, fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            value={urlInput}
            onChange={e => { setUrlInput(e.target.value); setError(null); }}
            onKeyDown={e => e.key === "Enter" && urlInput.trim() && handleScrape(urlInput)}
            placeholder="https://scrycheck.com/deck/…"
            style={{
              flex: 1, background: PANEL,
              border: `1px solid ${error ? DANGER : BORDER}`,
              borderRadius: 10, padding: "12px 14px",
              color: TEXT, fontSize: 13,
              fontFamily: "'IBM Plex Mono', monospace",
              transition: "border-color 0.2s",
            }}
          />
          <button
            onClick={() => urlInput.trim() && handleScrape(urlInput)}
            disabled={loading || !urlInput.trim()}
            style={{
              background: loading ? `${PRIMARY}40` : urlInput.trim() ? PRIMARY : BORDER,
              border: "none", borderRadius: 10, padding: "0 18px",
              color: loading ? `${TEXT}80` : urlInput.trim() ? BG : MUTED,
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 14, letterSpacing: 1.5,
              cursor: loading ? "wait" : urlInput.trim() ? "pointer" : "default",
              flexShrink: 0, transition: "all 0.2s",
            }}
          >
            {loading ? "…" : "GO"}
          </button>
        </div>
        {!deck && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <a
              href="https://www.moxfield.com" target="_blank" rel="noopener noreferrer"
              style={{
                flex: 1, display: "block", padding: "10px",
                background: `${PANEL}`, border: `1px solid ${BORDER}`,
                borderRadius: 8, color: TEXT, fontSize: 12, textAlign: "center",
                fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1,
                textDecoration: "none", transition: "border-color 0.2s",
              }}
            >
              MOXFIELD ↗
            </a>
            <a
              href="https://www.archidekt.com" target="_blank" rel="noopener noreferrer"
              style={{
                flex: 1, display: "block", padding: "10px",
                background: `${PANEL}`, border: `1px solid ${BORDER}`,
                borderRadius: 8, color: TEXT, fontSize: 12, textAlign: "center",
                fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1,
                textDecoration: "none", transition: "border-color 0.2s",
              }}
            >
              ARCHIDEKT ↗
            </a>
          </div>
        )}
      </div>

      {/* ENTER POD CTA */}
      {deck && (
        <button
          onClick={onEnterPod}
          style={{
            width: "100%", padding: "15px 16px", marginTop: 10,
            background: `linear-gradient(135deg, ${PRIMARY} 0%, ${ACTIVE} 100%)`,
            border: "none", borderRadius: 14,
            color: BG,
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 18, letterSpacing: 3, cursor: "pointer",
          }}
        >
          ENTER POD →
        </button>
      )}
    </div>
  );
}

// ── POD tab ───────────────────────────────────────────────────────────────────
const SESSION_STATUS_COLOR = { empty: MUTED, pending: "#7ba7bb", analyzing: "#c4915a", ready: SUCCESS };
const SESSION_STATUS_TEXT  = { empty: "—", pending: "joined", analyzing: "analyzing…", ready: "ready ✓" };

function PodTab({ deck, navigate }) {
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
      const id   = makeSessionId();
      const data = newSession(id, "podcheck");
      const { error } = await supabase.from("sessions").insert({ id, data });
      if (error) throw error;
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
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: MUTED, letterSpacing: 2 }}>
          LOADING…
        </div>
      </div>
    );
  }

  // Active session view
  if (activeSession && activeId) {
    return (
      <div style={{ padding: "18px 16px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: MUTED, letterSpacing: 1.5, marginBottom: 12 }}>
          ACTIVE SESSION
        </div>

        {/* Room code + share */}
        <div style={{
          padding: "14px 16px", background: PANEL, border: `1px solid ${BORDER}`,
          borderRadius: 12, marginBottom: 10,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 8, color: ACTIVE }}>
            {activeId}
          </div>
          <button
            onClick={handleShare}
            style={{
              background: copied ? `${SUCCESS}20` : `${PRIMARY}18`,
              border: `1px solid ${copied ? SUCCESS : PRIMARY}40`,
              borderRadius: 8, padding: "8px 14px",
              color: copied ? SUCCESS : PRIMARY,
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 12, letterSpacing: 1.5, cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {copied ? "COPIED ✓" : "SHARE"}
          </button>
        </div>

        {/* Player list */}
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
          {activeSession.players.map((p, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px",
              borderBottom: i < 3 ? `1px solid ${BORDER}` : "none",
            }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: SESSION_STATUS_COLOR[p.status] ?? MUTED, flexShrink: 0 }} />
              <div style={{
                flex: 1, fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12, color: p.status === "empty" ? MUTED : TEXT,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {p.name || `Seat ${i + 1}`}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: SESSION_STATUS_COLOR[p.status] ?? MUTED, letterSpacing: 1 }}>
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
              background: `${PRIMARY}18`, border: `1px solid ${PRIMARY}40`,
              borderRadius: 10, color: PRIMARY,
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 14, letterSpacing: 2, cursor: "pointer",
            }}
          >
            REJOIN →
          </button>
          <button
            onClick={() => { writeSessionId(null); setActiveId(null); setActiveSession(null); }}
            style={{
              padding: "12px 14px",
              background: "transparent", border: `1px solid ${BORDER}`,
              borderRadius: 10, color: MUTED,
              fontFamily: "'IBM Plex Mono', monospace",
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
          padding: "10px 14px", background: `${ACTIVE}0c`,
          border: `1px solid ${ACTIVE}25`, borderRadius: 10,
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: `${ACTIVE}90`,
          marginBottom: 18, lineHeight: 1.5,
        }}>
          Load your deck in MY DECK first for the best experience.
        </div>
      )}

      {/* JOIN */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: MUTED, letterSpacing: 1.5, marginBottom: 8 }}>
          JOIN A TABLE
        </div>
        {joinError && (
          <div style={{
            padding: "8px 12px", background: `${DANGER}15`, border: `1px solid ${DANGER}40`,
            borderRadius: 8, fontSize: 12, color: DANGER,
            marginBottom: 8, fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.5,
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
              flex: 1, background: PANEL,
              border: `1px solid ${joinError ? DANGER : BORDER}`,
              borderRadius: 10, padding: "14px",
              color: TEXT, fontSize: 26,
              fontFamily: "'Bebas Neue', sans-serif",
              letterSpacing: 8, textAlign: "center",
              transition: "border-color 0.2s",
            }}
          />
          <button
            onClick={handleJoin}
            disabled={joining || !joinInput.trim()}
            style={{
              background: joinInput.trim() ? PRIMARY : BORDER,
              border: "none", borderRadius: 10, padding: "0 20px",
              color: joinInput.trim() ? BG : MUTED,
              fontFamily: "'Bebas Neue', sans-serif",
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
        <div style={{ flex: 1, height: 1, background: BORDER }} />
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: MUTED, letterSpacing: 2 }}>OR</div>
        <div style={{ flex: 1, height: 1, background: BORDER }} />
      </div>

      {/* HOST */}
      <div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: MUTED, letterSpacing: 1.5, marginBottom: 8 }}>
          START A TABLE
        </div>
        {hostError && (
          <div style={{
            padding: "8px 12px", background: `${DANGER}15`, border: `1px solid ${DANGER}40`,
            borderRadius: 8, fontSize: 12, color: DANGER,
            marginBottom: 8, fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.5,
          }}>
            {hostError}
          </div>
        )}
        <button
          onClick={handleHost}
          disabled={hosting}
          style={{
            width: "100%", padding: "14px 16px",
            background: `${ACTIVE}12`, border: `1px solid ${ACTIVE}35`,
            borderRadius: 12, color: ACTIVE,
            fontFamily: "'Bebas Neue', sans-serif",
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
  const TABS = [
    { id: "deck", label: "MY DECK", Icon: DeckIcon },
    { id: "pod",  label: "POD",     Icon: PodIcon  },
  ];
  return (
    <div style={{
      height: NAV_H, flexShrink: 0,
      display: "flex",
      background: "#0b0818",
      borderTop: `1px solid ${BORDER}`,
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {TABS.map(({ id, label, Icon }) => {
        const active = tab === id;
        const color  = active ? ACTIVE : MUTED;
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
                width: 22, height: 2, borderRadius: 1, background: ACTIVE,
              }} />
            )}
            <Icon color={color} />
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
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
  const [tab,  setTab]  = useState("deck");
  const [deck, setDeck] = useState(readDeck);
  const navigate = useNavigate();

  const handleDeckChange = useCallback((newDeck) => {
    setDeck(newDeck);
    writeDeck(newDeck);
  }, []);

  return (
    <div style={{
      minHeight: "100dvh", background: BG,
      display: "flex", flexDirection: "column",
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        input:focus { outline: none; border-color: ${PRIMARY} !important; }
        a:hover { opacity: 0.8; }
      `}</style>

      <ShellHeader deck={deck} />

      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "deck"
          ? <MyDeckTab deck={deck} onDeckChange={handleDeckChange} onEnterPod={() => setTab("pod")} />
          : <PodTab deck={deck} navigate={navigate} />
        }
      </div>

      <BottomNav tab={tab} onTab={setTab} />
    </div>
  );
}
