import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { COLORS, BRACKET_META, PageWrapper, ScryCheckCredit, Logo, makeSessionId, newSession } from "../lib/ui.jsx";

const STARTING_LIFE = 40;

// ─── Utils ────────────────────────────────────────────────────────────────────
function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function useCommanderArt(commanderName) {
  const [artUrl, setArtUrl] = useState(null);
  useEffect(() => {
    if (!commanderName) return;
    fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(decodeEntities(commanderName))}`, {
        headers: { "User-Agent": "PodCheck/1.0 (pod-check.vercel.app)" },
      })
      .then(r => r.json())
      .then(data => {
        const url = data.image_uris?.art_crop || data.card_faces?.[0]?.image_uris?.art_crop;
        if (url) setArtUrl(url);
      })
      .catch(() => {});
  }, [commanderName]);
  return artUrl;
}

// ─── Facts Ticker ─────────────────────────────────────────────────────────────
const MTG_FACTS = [
  "Magic was briefly called Mana Clash before becoming Magic: The Gathering.",
  "“The Gathering” was added to make the name legally protectable.",
  "Garfield planned to rename Magic with each set (e.g., Magic: Ice Age).",
  "Deckmaster was a shared brand for multiple Wizards TCGs.",
  "The card back has never changed to maintain uniformity.",
  "The original logo was blue and later changed to yellow for visibility.",
  "The card back still uses an outdated ™ instead of ®.",
  "The card back is designed to resemble a magical tome.",
  "Arabian Nights almost had a different card back.",
  "Alpha had misprints that affected gameplay.",
  "Creatures were originally labeled Summon instead of Creature.",
  "Auras were originally labeled Enchant instead of Aura.",
  "Basic lands appeared on multiple sheets in Alpha, including rare (notably Island).",
  "Mountain has the most printings due to its accidental inclusion in Arabian Nights.",
  "Early promo cards were distributed through Magic novels.",
  "Arabian Nights, Antiquities, and Legends had redemption programs.",
  "Legends split uncommons into two sheets, limiting what could appear together.",
  "Alpha cards used “Tap to” before the tap symbol existed.",
  "The tap symbol changed multiple times due to localization.",
  "The white mana symbol was redesigned for clarity.",
  "Magic entered the Game Hall of Fame its first eligible year.",
  "Magic passed 10,000 cards around Shards of Alara (exact card unclear).",
  "Possible deck combinations exceeded atoms in the universe.",
  "Booster sizes have ranged from 6 to 15 cards.",
  "Un-sets hold records for shortest and longest card names.",
  "Early Constructed decks were 40 cards with no copy limit.",
  "Circle of Protection: Black and Volcanic Island were omitted from Alpha by mistake.",
  "Birds of Paradise art was originally made for Tropical Island and repurposed.",
  "In Alpha and Beta, a basic land could appear in the rare slot of a booster.",
  "Stasis was illustrated by Richard Garfield’s aunt, Fay Jones, as a favor.",
  "Early Wizards HQ visitors were often given free decks and boosters.",
  "Arabian Nights flavor text was written in one night.",
  "Legends characters were based on a Dungeons and Dragons campaign.",
  "Urza’s Saga was almost named Urza’s Odyssey.",
  "Rancor was undercosted due to a data entry error.",
  "The mechanic Entwine was conceived in a dream.",
  "Wizards once considered including gum in booster packs.",
];

function FactsTicker() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * MTG_FACTS.length));
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % MTG_FACTS.length);
        setVisible(true);
      }, 400);
    }, 90000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ background: "rgba(167,139,250,0.04)", borderBottom: "1px solid rgba(167,139,250,0.1)", padding: "6px 14px", display: "flex", alignItems: "center", gap: 8, overflow: "hidden", flexShrink: 0 }}>
      <span style={{ fontSize: 9, color: "#a78bfa", letterSpacing: 2, flexShrink: 0 }}>MTG</span>
      <div style={{ fontSize: 10, color: "rgba(91,143,255,0.6)", lineHeight: 1.4, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", opacity: visible ? 1 : 0, transition: "opacity 0.4s ease" }}>
        {MTG_FACTS[idx]}
      </div>
    </div>
  );
}

// ─── StepBar ──────────────────────────────────────────────────────────────────
function StepBar({ current, total }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 3, borderRadius: 2,
          background: i < current ? "#a78bfa" : "rgba(255,255,255,0.1)",
          transition: "background 0.3s",
        }} />
      ))}
    </div>
  );
}

// ─── BigVerdict ───────────────────────────────────────────────────────────────
function BigVerdict({ players, mode }) {
  if (mode === 'lifetrack') return null;
  const allReady = players.filter(p => p.status === "ready");
  const online = allReady.filter(p => p.deckData?.power != null);
  if (online.length < 2) return null;

  const powers = online.map(p => p.deckData.power);
  const spread = Math.max(...powers) - Math.min(...powers);
  const avg = (powers.reduce((a, b) => a + b, 0) / powers.length).toFixed(1);
  const brackets = allReady.map(p => p.deckData?.bracket).filter(Boolean);
  const bracketSpread = brackets.length > 1 ? Math.max(...brackets) - Math.min(...brackets) : 0;

  let verdict, sub, color, emoji, bg;
  if (spread <= 0.8 && bracketSpread <= 1) {
    verdict = "FAIR GAME"; sub = "Power levels are well matched. Good game ahead.";
    color = "#34d399"; emoji = "⚖️"; bg = "rgba(52,211,153,0.08)";
  } else if (spread <= 1.5 || bracketSpread <= 1) {
    verdict = "SLIGHT GAP"; sub = "Minor power difference — totally playable, just worth noting.";
    color = "#fbbf24"; emoji = "🟡"; bg = "rgba(251,191,36,0.08)";
  } else if (spread <= 2.5) {
    verdict = "NOTABLE MISMATCH"; sub = "Real bracket difference. Have a quick conversation before you play.";
    color = "#f97316"; emoji = "⚠️"; bg = "rgba(249,115,22,0.08)";
  } else {
    verdict = "BAD IDEA"; sub = "Significant power gap. Someone should grab a different deck.";
    color = "#ef4444"; emoji = "🔴"; bg = "rgba(239,68,68,0.08)";
  }

  // Online players sorted by power, offline players appended at end
  const ranked = [
    ...online.sort((a, b) => b.deckData.power - a.deckData.power),
    ...allReady.filter(p => p.deckData?.power == null),
  ];

  return (
    <div style={{ animation: "fadeUp 0.5s ease both" }}>
      <div style={{ background: bg, border: `2px solid ${color}40`, borderRadius: 20, padding: "28px 20px", textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>{emoji}</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, letterSpacing: 4, color, lineHeight: 1, marginBottom: 10 }}>{verdict}</div>
        <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, maxWidth: 280, margin: "0 auto 16px" }}>{sub}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
          <StatBox label="AVG POWER" value={avg} color={color} />
          <StatBox label="SPREAD" value={spread.toFixed(1)} color={color} />
          {bracketSpread > 0 && <StatBox label="BRACKET GAP" value={bracketSpread} color={color} />}
        </div>
      </div>
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 10 }}>POWER RANKING</div>
        {ranked.map((p, rank) => {
          const oi = players.indexOf(p);
          const c = COLORS[oi];
          const isOffline = p.deckData?.offline || p.offline;
          const hasPower = p.deckData?.power != null;
          const pct = hasPower ? ((p.deckData.power - 1) / 9) * 100 : 0;
          const bMeta = p.deckData?.bracket ? BRACKET_META[p.deckData.bracket] : null;
          return (
            <div key={oi} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "#475569", width: 14, textAlign: "right" }}>{hasPower ? rank + 1 : "·"}</div>
              <div style={{ fontSize: 12, color: isOffline ? "#475569" : c, width: 90, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.deckData?.commander || p.name || `P${oi + 1}`}
                {isOffline
                  ? <span style={{ fontSize: 9, color: "#334155", marginLeft: 4 }}>· self-reported</span>
                  : p.deckData?.selfReported && <span style={{ fontSize: 9, color: "#475569", marginLeft: 4 }}>· self-reported</span>
                }
              </div>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 3, height: 5, overflow: "hidden" }}>
                {hasPower && <div style={{ width: `${pct}%`, height: "100%", background: c, borderRadius: 3 }} />}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: hasPower ? c : "#334155", width: 30, textAlign: "right" }}>
                {hasPower ? p.deckData.power.toFixed(1) : "—"}
              </div>
              {bMeta && <div style={{ fontSize: 10, color: bMeta.color, width: 28, textAlign: "right" }}>B{p.deckData.bracket}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

// ─── ScryfallSearch ───────────────────────────────────────────────────────────
const MTG_KEYWORDS = {
  flying: "This creature can only be blocked by creatures with flying or reach.",
  deathtouch: "Any amount of damage this deals to a creature is enough to destroy it.",
  lifelink: "Damage dealt by this creature also causes you to gain that much life.",
  trample: "This creature can deal excess combat damage to the player or planeswalker it's attacking.",
  vigilance: "Attacking doesn't cause this creature to tap.",
  haste: "This creature can attack and tap as soon as it comes under your control.",
  reach: "This creature can block creatures with flying.",
  hexproof: "This permanent can't be the target of spells or abilities your opponents control.",
  indestructible: "Effects that say 'destroy' don't destroy this. A creature with indestructible can't be destroyed by damage.",
  menace: "This creature can't be blocked except by two or more creatures.",
  ward: "Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player pays the ward cost.",
  flash: "You may cast this spell any time you could cast an instant.",
  shroud: "This permanent can't be the target of spells or abilities.",
  first_strike: "This creature deals combat damage before creatures without first strike.",
  double_strike: "This creature deals both first-strike and regular combat damage.",
  infect: "This creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.",
  persist: "When this creature dies, if it had no -1/-1 counters on it, return it with a -1/-1 counter.",
  undying: "When this creature dies, if it had no +1/+1 counters on it, return it with a +1/+1 counter.",
  cascade: "When you cast this spell, exile cards from the top of your library until you exile a nonland card with lesser mana value. You may cast it without paying its mana cost.",
  convoke: "Your creatures can help cast this spell. Each creature you tap while casting this spell pays for 1 or one mana of that creature's color.",
  delve: "Each card you exile from your graveyard while casting this spell pays for 1.",
  flashback: "You may cast this card from your graveyard for its flashback cost. Then exile it.",
  morph: "You may cast this card face down as a 2/2 creature for 3. Turn it face up any time for its morph cost.",
  phasing: "This phases in or out before you untap during each of your untap steps.",
  protection: "This permanent can't be damaged, enchanted, equipped, blocked, or targeted by anything with the specified quality.",
  regenerate: "The next time this creature would be destroyed this turn, it isn't. Instead tap it, remove all damage from it, and remove it from combat.",
  scry: "Look at the top N cards of your library, then put any number of them on the bottom and the rest on top in any order.",
  storm: "When you cast this spell, copy it for each spell cast before it this turn.",
  suspend: "Rather than cast this card from your hand, pay its suspend cost and exile it with time counters. At the start of your upkeep, remove a counter. When the last is removed, cast it for free.",
  totem_armor: "If enchanted permanent would be destroyed, instead remove all damage from it and destroy this Aura.",
  toxic: "Players dealt combat damage by this creature also get that many poison counters.",
};

const normalizeQuery = (q) => q.trim().toLowerCase().replace(/\s+/g, "_");

function KeywordRow({ keyword, definition }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      onClick={() => setExpanded(v => !v)}
      style={{
        padding: "8px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(91,143,255,0.08)",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, color: "#5b8fff" }}>✦</span>
          <span style={{ fontSize: 11, color: "#e0f2ff", fontWeight: 600 }}>
            {keyword.replace("_", " ")}
          </span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>keyword</span>
        </div>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
          {expanded ? "▴" : "▾"}
        </span>
      </div>
      {expanded && (
        <div style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.55)",
          lineHeight: 1.7,
          marginTop: 6,
          paddingTop: 6,
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
          {definition}
        </div>
      )}
    </div>
  );
}

function ScryfallPanel({ open, onOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const search = useCallback(async (q) => {
    if (!q.trim() || q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&order=name&unique=cards&page=1`,
        { headers: { "User-Agent": "PodCheck/1.0 (pod-check.vercel.app)" } }
      );
      const data = await res.json();
      if (data.object === "error") { setResults([]); return; }
      setResults((data.data || []).slice(0, 12));
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  const detectedKeyword = (() => {
    const norm = normalizeQuery(query);
    return Object.keys(MTG_KEYWORDS).find(k =>
      norm === k || norm === k.replace("_", " ") || (k.startsWith(norm) && norm.length >= 3)
    );
  })();

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  if (!open) {
    return (
      <div
        onClick={onOpen}
        style={{
          background: "#06040f",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          cursor: "pointer", gap: 4,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <div style={{ fontSize: 16 }}>🔍</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: 2, fontWeight: 700 }}>SCRYFALL</div>
      </div>
    );
  }

  if (selectedCard) {
    const imgUrl = selectedCard.image_uris?.normal || selectedCard.card_faces?.[0]?.image_uris?.normal;
    return (
      <div
        onClick={() => setSelectedCard(null)}
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "#000",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {imgUrl && (
          <img src={imgUrl} alt={selectedCard.name} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 12, objectFit: "contain" }} />
        )}
      </div>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute", inset: 0, zIndex: 30,
        background: "#06040f",
        display: "flex", flexDirection: "column",
        gridColumn: "1 / -1", gridRow: "1 / -1",
        animation: "scryfallIn 0.2s ease",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, flexShrink: 0 }}>🔍</span>
        <input
          ref={inputRef}
          value={query}
          onChange={handleInput}
          placeholder="Search any card..."
          style={{
            flex: 1, background: "transparent",
            border: "none", outline: "none",
            color: "#e0f2ff", fontSize: 12,
            fontFamily: "inherit",
          }}
        />
        {loading && (
          <div style={{
            width: 10, height: 10,
            border: "1.5px solid rgba(255,255,255,0.2)",
            borderTop: "1.5px solid #5b8fff",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            flexShrink: 0,
          }} />
        )}
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 14, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}
        >✕</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {detectedKeyword && (
          <KeywordRow keyword={detectedKeyword} definition={MTG_KEYWORDS[detectedKeyword]} />
        )}
        {results.length === 0 && !loading && query.length > 1 && !detectedKeyword && (
          <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, textAlign: "center", padding: 16 }}>No results</div>
        )}
        {results.map((card) => {
          const artUrl = card.image_uris?.art_crop || card.card_faces?.[0]?.image_uris?.art_crop;
          return (
            <div
              key={card.id}
              onClick={() => setSelectedCard(card)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 10px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {artUrl ? (
                <img src={artUrl} alt="" style={{ width: 36, height: 28, borderRadius: 3, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 36, height: 28, borderRadius: 3, background: "rgba(255,255,255,0.05)", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#e0f2ff", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.name}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.type_line}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── LifeTracker ─────────────────────────────────────────────────────────────────
function LifeTracker({ session, mySeat, onUpdate }) {
  const { game, players } = session;
  const me = game.players[mySeat];
  const myColor = COLORS[mySeat];
  const myName = players[mySeat]?.name || `P${mySeat + 1}`;
  const rawCommander = players[mySeat]?.deckData?.commander || "";
  const myCommander = decodeEntities(rawCommander);
  const artUrl = useCommanderArt(myCommander);

  const currentTurnIdx = game.turnOrder[game.currentTurn % game.turnOrder.length];
  const isMyTurn = currentTurnIdx === mySeat;

  const [showMore, setShowMore] = useState(false);
  const [scryfallOpen, setScryfallOpen] = useState(false);

  const holdTimerRef = useRef(null);
  const holdIntervalRef = useRef(null);

  const others = game.turnOrder
    .filter(i => i !== mySeat)
    .map(i => ({
      index: i,
      name: players[i]?.name || `P${i + 1}`,
      commander: decodeEntities(players[i]?.deckData?.commander || ""),
      gd: game.players[i],
    }));

  const patch = useCallback((fn) => {
    const updated = { ...game, players: game.players.map((p, i) => i === mySeat ? fn(p) : p) };
    onUpdate(updated);
  }, [game, mySeat, onUpdate]);

  const updateLife = useCallback((d) => {
    patch(p => ({ ...p, life: Math.max(0, p.life + d) }));
  }, [patch]);

  const updatePoison = (d) => patch(p => ({ ...p, poison: Math.max(0, p.poison + d) }));
  const updateCmd = (from, d) => patch(p => {
    const cd = { ...(p.commanderDamage || {}) };
    cd[from] = Math.max(0, (cd[from] || 0) + d);
    return { ...p, commanderDamage: cd };
  });

  // Hold-to-repeat logic
  const startHold = useCallback((delta) => {
    updateLife(delta);
    holdTimerRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => {
        updateLife(delta);
      }, 150);
    }, 400);
  }, [updateLife]);

  const stopHold = useCallback(() => {
    clearTimeout(holdTimerRef.current);
    clearInterval(holdIntervalRef.current);
  }, []);

  useEffect(() => () => stopHold(), [stopHold]);

  const isDead = me.life <= 0 || me.poison >= 10 ||
    Object.values(me.commanderDamage || {}).some(d => d >= 21);

  const lifeColor = isDead ? "#2a2a3a"
    : me.life <= 5 ? "#ff4d6d"
    : me.life <= 10 ? "#fb923c"
    : myColor;

  // Dynamic font size — fill the space
  const lifeStr = String(me.life);
  const lifeFontSize = lifeStr.length === 1 ? "38svh"
    : lifeStr.length === 2 ? "32svh"
    : "24svh";

  const hasAnyTracking = me.poison > 0 ||
    Object.values(me.commanderDamage || {}).some(d => d > 0);

  return (
    <div style={{
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      background: "#06040f",
      overflow: "hidden",
      userSelect: "none",
      WebkitUserSelect: "none",
      fontFamily: "'IBM Plex Mono', 'DM Mono', monospace",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        @keyframes pulse2 { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes slideUp2 { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes scryfallIn { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>

      {/* ══ ZONE 1: MY LIFE ══════════════════════════════════════════════ */}
      <div
        style={{
          flex: "0 0 65%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
        onClick={() => { if (scryfallOpen) setScryfallOpen(false); }}
      >
        {/* Commander art background */}
        {artUrl && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 0,
            backgroundImage: `url(${artUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center 20%",
            filter: "grayscale(100%) brightness(0.15) blur(10px)",
            transform: "scale(1.08)",
          }} />
        )}

        {/* Color tint overlay */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 1,
          background: `linear-gradient(180deg, ${myColor}14 0%, transparent 50%, #06040f 100%)`,
          pointerEvents: "none",
        }} />

        {/* Turn bar */}
        {isMyTurn && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3, zIndex: 10,
            background: `linear-gradient(90deg, ${myColor}, #00c9ff)`,
            animation: "pulse2 2s ease infinite",
          }} />
        )}

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "10px 14px 0",
          position: "relative", zIndex: 5, flexShrink: 0,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 15, fontWeight: 700,
              color: myColor, lineHeight: 1.2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{myName}</div>
            {myCommander && (
              <div style={{
                fontSize: 10, color: "rgba(255,255,255,0.28)",
                marginTop: 1,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                maxWidth: "80%",
              }}>{myCommander}</div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {isMyTurn && (
              <span style={{
                fontSize: 9, color: "#00c9ff", letterSpacing: 2,
                animation: "pulse2 1.5s ease infinite",
              }}>YOUR TURN</span>
            )}
            {isDead && (
              <span style={{ fontSize: 9, color: "#ff4d6d", letterSpacing: 2 }}>DEAD</span>
            )}
            {/* Hamburger */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowMore(v => !v); }}
              style={{
                background: showMore ? `${myColor}20` : "rgba(255,255,255,0.07)",
                border: `1px solid ${showMore ? myColor + "50" : "rgba(255,255,255,0.12)"}`,
                borderRadius: 8,
                width: 36, height: 36,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 4, cursor: "pointer", padding: 0,
                transition: "all 0.2s",
              }}
            >
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 14, height: 1.5,
                  background: showMore ? myColor : "rgba(255,255,255,0.5)",
                  borderRadius: 1,
                  transition: "background 0.2s",
                }} />
              ))}
            </button>
          </div>
        </div>

        {/* Life number — tap zones */}
        <div style={{
          flex: 1, position: "relative", zIndex: 5,
          display: "block", width: "100%", textAlign: "center",
        }}>
          {/* Left tap zone — decrease */}
          <div
            onPointerDown={(e) => { e.preventDefault(); if (scryfallOpen) { setScryfallOpen(false); return; } startHold(-1); }}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            style={{
              position: "absolute", left: 0, top: 0, bottom: 0, width: "50%",
              cursor: "pointer", zIndex: 2,
              WebkitTapHighlightColor: "transparent",
            }}
          />
          {/* Right tap zone — increase */}
          <div
            onPointerDown={(e) => { e.preventDefault(); if (scryfallOpen) { setScryfallOpen(false); return; } startHold(1); }}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            style={{
              position: "absolute", right: 0, top: 0, bottom: 0, width: "50%",
              cursor: "pointer", zIndex: 2,
              WebkitTapHighlightColor: "transparent",
            }}
          />

          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: lifeFontSize,
            color: lifeColor,
            lineHeight: 0.9,
            pointerEvents: "none",
            transition: "color 0.3s",
            textShadow: isDead ? "none" : `0 0 60px ${myColor}35`,
            letterSpacing: "-0.02em",
            width: "100%", textAlign: "center",
          }}>
            {me.life}
          </div>
        </div>

        {/* More drawer — overlays Zone 1 */}
        {showMore && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute", inset: 0, zIndex: 20,
              background: "rgba(6,4,15,0.94)",
              backdropFilter: "blur(8px)",
              display: "flex", flexDirection: "column",
              animation: "slideUp2 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px" }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 2 }}>TRACKING</span>
              <button
                onClick={() => setShowMore(false)}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 18, cursor: "pointer", lineHeight: 1, padding: 0 }}
              >✕</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
              {!hasAnyTracking && (
                <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, textAlign: "center", marginTop: 40 }}>
                  Nothing to track yet.
                </div>
              )}

              {/* Poison */}
              {(me.poison > 0 || true) && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 8 }}>POISON</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button onClick={() => updatePoison(-1)} style={drawerBtn(myColor)}>−</button>
                    <span style={{
                      fontSize: 36, fontWeight: 700, fontFamily: "'Bebas Neue', sans-serif",
                      color: me.poison >= 10 ? "#ff4d6d" : me.poison >= 7 ? "#fb923c" : "rgba(255,255,255,0.7)",
                      width: 50, textAlign: "center",
                    }}>{me.poison}</span>
                    <button onClick={() => updatePoison(1)} style={drawerBtn(myColor)}>+</button>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
                      {me.poison >= 10 ? "☠ DEAD" : `${10 - me.poison} to death`}
                    </span>
                  </div>
                </div>
              )}

              {/* Commander damage received from each opponent */}
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 8 }}>DAMAGE TAKEN FROM COMMANDERS</div>
                {others.map(op => {
                  const dmg = me.commanderDamage?.[op.index] || 0;
                  return (
                    <div key={op.index} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS[op.index], flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: COLORS[op.index], flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        from {op.name}
                      </span>
                      <button onClick={() => updateCmd(op.index, -1)} style={drawerBtn(COLORS[op.index])}>−</button>
                      <span style={{
                        fontSize: 28, fontWeight: 700, fontFamily: "'Bebas Neue', sans-serif",
                        color: dmg >= 21 ? "#ff4d6d" : dmg >= 15 ? "#fb923c" : "rgba(255,255,255,0.7)",
                        width: 44, textAlign: "center",
                      }}>{dmg}</span>
                      <button onClick={() => updateCmd(op.index, 1)} style={drawerBtn(COLORS[op.index])}>+</button>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", width: 44 }}>
                        {dmg >= 21 ? "☠ DEAD" : `${21 - dmg} left`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ ZONE 2: SCOREBOARD ════════════════════════════════════════════ */}
      <div style={{
        flex: "0 0 35%",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        gap: 1,
        background: "rgba(155,93,229,0.08)",
        position: "relative",
      }}>
        {[...others, null].map((op, i) => {
          // Scryfall slot
          if (op === null) {
            return (
              <ScryfallPanel
                key="scryfall"
                open={scryfallOpen}
                onOpen={() => setScryfallOpen(true)}
                onClose={() => setScryfallOpen(false)}
              />
            );
          }

          const theirTurn = game.turnOrder[game.currentTurn % game.turnOrder.length] === op.index;
          const dead = op.gd.life <= 0 || op.gd.poison >= 10 ||
            Object.values(op.gd.commanderDamage || {}).some(d => d >= 21);
          const opColor = COLORS[op.index];
          const cmdDmgFromThem = me.commanderDamage?.[op.index] || 0;
          const cmdDmgFromMe = op.gd.commanderDamage?.[mySeat] || 0;
          const theirPoison = op.gd.poison || 0;
          const dangerPct = Math.min(cmdDmgFromThem / 21, 1);
          const dangerTint = dangerPct > 0 ? `rgba(255, 77, 109, ${dangerPct * 0.35})` : "transparent";
          const barPct = Math.min((cmdDmgFromThem / 21) * 100, 100);

          return (
            <div key={op.index} style={{
              background: "#06040f",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              position: "relative", overflow: "hidden",
              padding: "4px 6px",
            }}>
              <div style={{
                position: "absolute", inset: 0,
                background: dangerPct > 0
                  ? `linear-gradient(180deg, ${dangerTint} 0%, ${opColor}05 100%)`
                  : `${opColor}05`,
                pointerEvents: "none",
                transition: "background 0.5s",
              }} />

              {theirTurn && (
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 2,
                  background: `linear-gradient(90deg, ${opColor}, #00c9ff)`,
                  animation: "pulse2 2s ease infinite",
                }} />
              )}

              {cmdDmgFromThem > 0 && (
                <div style={{
                  position: "absolute", bottom: 0, left: 0,
                  height: 3,
                  width: `${barPct}%`,
                  background: dangerPct > 0.7 ? "#ff4d6d" : dangerPct > 0.4 ? "#fb923c" : "#fbbf24",
                  transition: "width 0.4s ease, background 0.4s ease",
                  borderRadius: "0 2px 0 0",
                }} />
              )}

              <div style={{
                fontSize: 9, color: opColor, marginBottom: 1,
                maxWidth: "90%", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap",
                position: "relative",
              }}>
                {op.name}
                {theirTurn && <span style={{ color: "#00c9ff", marginLeft: 4 }}>▸</span>}
              </div>

              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: dead ? 16 : 34,
                color: dead ? "#2a2a3a" : op.gd.life <= 5 ? "#ff4d6d" : op.gd.life <= 10 ? "#fb923c" : opColor,
                lineHeight: 1,
                position: "relative",
              }}>
                {dead ? "DEAD" : op.gd.life}
              </div>

              {(cmdDmgFromThem > 0 || theirPoison > 0) && (
                <div style={{ display: "flex", gap: 5, marginTop: 2, position: "relative" }}>
                  {cmdDmgFromThem > 0 && (
                    <span style={{ fontSize: 8, color: dangerPct > 0.7 ? "#ff4d6d" : "rgba(255,255,255,0.4)", fontWeight: 700 }}>
                      ⚔{cmdDmgFromThem}/21
                    </span>
                  )}
                  {theirPoison > 0 && (
                    <span style={{ fontSize: 8, color: "rgba(255,255,255,0.35)" }}>☠{theirPoison}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MTGFact ─────────────────────────────────────────────────────────────────
function MtgFact() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * MTG_FACTS.length));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % MTG_FACTS.length);
        setVisible(true);
      }, 500);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      maxWidth: 320,
      margin: "0 auto 28px",
      padding: "14px 18px",
      background: "rgba(91,143,255,0.06)",
      border: "1px solid rgba(91,143,255,0.15)",
      borderRadius: 12,
      opacity: visible ? 1 : 0,
      transition: "opacity 0.5s ease",
    }}>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
        {MTG_FACTS[index]}
      </div>
    </div>
  );
}

// ─── LobbyStatus ──────────────────────────────────────────────────────────────
const STATUS_META = {
  empty:     { text: "Empty",     color: "#334155" },
  pending:   { text: "Joined",    color: "#60a5fa" },
  analyzing: { text: "Analyzing", color: "#fbbf24" },
  ready:     { text: "Ready ✓",   color: "#34d399" },
};

function LobbyStatus({ session, mySeat }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 16, marginTop: 20 }}>
      <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 10 }}>POD STATUS</div>
      {session.players.map((p, i) => {
        const s = STATUS_META[p.status];
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS[i], opacity: p.status === "empty" ? 0.2 : 1 }} />
              <span style={{ fontSize: 12, color: i === mySeat ? COLORS[i] : p.status === "empty" ? "#334155" : "#94a3b8" }}>
                {p.name || `Seat ${i + 1}`}{i === mySeat && <span style={{ opacity: 0.5 }}> (you)</span>}
              </span>
            </div>
            <div style={{ fontSize: 10, color: s?.color ?? "#334155", letterSpacing: 1, display: "flex", alignItems: "center", gap: 5 }}>
              {p.status === "analyzing" && <div style={{ width: 7, height: 7, border: "1.5px solid currentColor", borderTop: "1.5px solid transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
              {s?.text ?? "Empty"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── CommanderSearch ──────────────────────────────────────────────────────────
function CommanderSearch({ onSelect, color }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [cmdError, setCmdError] = useState(null);
  const [validating, setValidating] = useState(false);
  const debounceRef = useRef(null);

  const search = async (q) => {
    if (q.length < 2) { setResults([]); return; }
    const res = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(q)}&include_extras=false`, { headers: { "User-Agent": "PodCheck/1.0 (pod-check.vercel.app)" } });
    const data = await res.json();
    setResults((data.data || []).slice(0, 8));
  };

  const handleSelect = async (name) => {
    const decoded = decodeEntities(name);
    setQuery(decoded);
    setResults([]);
    setCmdError(null);
    setValidating(true);
    try {
      const res = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(decoded)}`, { headers: { "User-Agent": "PodCheck/1.0 (pod-check.vercel.app)" } });
      const card = await res.json();
      if (card.legalities?.commander !== "legal") {
        setCmdError("That card isn't legal as a commander. Try another.");
        return;
      }
      onSelect(decoded);
    } catch {
      setCmdError("That card isn't legal as a commander. Try another.");
    } finally {
      setValidating(false);
    }
  };

  return (
    <div style={{ animation: "fadeUp 0.4s ease both" }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 3, color: "#e0f2ff", marginBottom: 12, lineHeight: 1.1 }}>WHO'S YOUR COMMANDER?</div>
      <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.8, marginBottom: 20 }}>Search and tap your commander. That's your display name.</div>
      <input
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setCmdError(null);
          clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => search(e.target.value), 400);
        }}
        placeholder="Search commander name..."
        autoFocus
        style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: results.length ? "10px 10px 0 0" : 10, padding: "14px", color: "#e0f2ff", fontSize: 14, fontFamily: "inherit" }}
      />
      {results.length > 0 && (
        <div style={{ background: "#0e0a1f", border: "1px solid rgba(255,255,255,0.08)", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
          {results.map(name => (
            <div
              key={name}
              onClick={() => handleSelect(name)}
              style={{ padding: "12px 14px", fontSize: 13, color: "#e0f2ff", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              {decodeEntities(name)}
            </div>
          ))}
        </div>
      )}
      {validating && <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>Checking legality...</div>}
      {cmdError && <div style={{ fontSize: 12, color: "#f87171", marginTop: 8 }}>{cmdError}</div>}
    </div>
  );
}

// ─── EscapeHatch ──────────────────────────────────────────────────────────────
function EscapeHatch({ onComplete }) {
  const [show, setShow] = useState(false);
  const [bracket, setBracket] = useState(null);

  if (!show) return (
    <button
      onClick={() => setShow(true)}
      style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: 11, fontFamily: "inherit", cursor: "pointer", marginTop: 16, textDecoration: "underline", letterSpacing: 1 }}
    >
      skip scrycheck — i know my bracket
    </button>
  );

  if (bracket !== null) return (
    <div style={{ marginTop: 16, padding: 16, background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 12 }}>WHO'S YOUR COMMANDER?</div>
      <CommanderSearch
        onSelect={(name) => onComplete({ commander: name, power: null, bracket: bracket.b, tier: bracket.label, selfReported: true, vectors: {} })}
        color="#a78bfa"
      />
      <button onClick={() => setBracket(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", fontSize: 10, cursor: "pointer", fontFamily: "inherit", marginTop: 12 }}>← back</button>
    </div>
  );

  return (
    <div style={{ marginTop: 16, padding: 16, background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 12 }}>SELF-REPORTED BRACKET</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginBottom: 12, lineHeight: 1.6 }}>cool, we trust you. mostly. 🫡</div>
      {[
        { b: 1, label: "Precon" }, { b: 2, label: "Upgraded" }, { b: 3, label: "Optimized" },
        { b: 4, label: "High Power" }, { b: 5, label: "cEDH" },
      ].map(({ b, label }) => (
        <button key={b}
          onClick={() => setBracket({ b, label })}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 14px", marginBottom: 6, cursor: "pointer", fontFamily: "inherit", color: "#e0f2ff" }}>
          <span style={{ fontSize: 12 }}>B{b} · {label}</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>→</span>
        </button>
      ))}
      <button onClick={() => setShow(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", fontSize: 10, cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>← back</button>
    </div>
  );
}

// ─── ThreeBarOnboarding ───────────────────────────────────────────────────────
function ThreeBarOnboarding({ session, mySeat, sessionId, onComplete }) {
  const [bars, setBars] = useState([false, false, false]);
  const [deckSiteOpened, setDeckSiteOpened] = useState(false);
  const [resultInput, setResultInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const myColor = COLORS[mySeat];

  const handleOpenDeckSite = useCallback((url) => {
    window.open(url, "_blank");
    setDeckSiteOpened(true);
  }, []);

  const handleContinue = useCallback(() => {
    window.open("https://scrycheck.com", "_blank");
    setBars([true, false, false]);
    setError(null);
  }, []);

  const handleResultUrl = useCallback(async (url) => {
    const clean = url.trim();
    if (!clean.startsWith("https://scrycheck.com/deck/")) {
      setError("Paste your ScryCheck result URL — looks like scrycheck.com/deck/abc123"); return;
    }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(clean)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scrape failed");
      setBars([true, true, false]);
      await new Promise(r => setTimeout(r, 400));
      setBars([true, true, true]);
      await new Promise(r => setTimeout(r, 500));
      onComplete(json);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }, [onComplete]);

  const BAR_DEFS = [
    { label: "YOUR DECK",  sub: "open your deck site and copy the URL" },
    { label: "SCRYCHECK",  sub: "paste your deck URL into ScryCheck, then paste the result URL below" },
    { label: "YOU'RE IN",  sub: "sit back" },
  ];

  return (
    <div style={{ animation: "fadeUp 0.4s ease both" }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3, color: "#e0f2ff", marginBottom: 6, lineHeight: 1.1 }}>ANALYZE YOUR DECK</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 24, lineHeight: 1.7 }}>One paste. Thirty seconds.</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {BAR_DEFS.map(({ label, sub }, i) => {
          const done   = bars[i];
          const active = !done && (i === 0 || bars[i - 1]);
          const isAnalyzing = i === 1 && active && loading;
          return (
            <div key={i}>
              <div style={{
                display: "flex", alignItems: "center", gap: 14, padding: "16px 18px",
                background: done ? "rgba(52,211,153,0.08)" : active ? `${myColor}10` : "rgba(255,255,255,0.02)",
                border: `1.5px solid ${done ? "#34d399" : active ? myColor : "rgba(255,255,255,0.06)"}`,
                borderRadius: 14, transition: "all 0.3s",
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  background: done ? "#34d399" : active ? myColor : "rgba(255,255,255,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: "#06040f", fontWeight: 700,
                }}>
                  {done ? "✓" : isAnalyzing ? (
                    <div style={{ width: 10, height: 10, border: "2px solid rgba(6,4,15,0.3)", borderTop: `2px solid #06040f`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  ) : i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: done ? "#34d399" : active ? "#e0f2ff" : "rgba(255,255,255,0.2)", letterSpacing: 1 }}>{label}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>{sub}</div>
                </div>
                <div style={{ fontSize: 14, color: done ? "#34d399" : active ? myColor : "rgba(255,255,255,0.1)", flexShrink: 0 }}>
                  {done ? "✓" : "·"}
                </div>
              </div>

              {i === 0 && active && !done && (
                <div style={{ marginTop: 8, padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: `1px solid ${myColor}30`, borderRadius: 12, animation: "fadeUp 0.2s ease both" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: deckSiteOpened ? 12 : 0 }}>
                    <button onClick={() => handleOpenDeckSite("https://www.moxfield.com")}
                      style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px", color: "#e0f2ff", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>
                      OPEN MOXFIELD ↗
                    </button>
                    <button onClick={() => handleOpenDeckSite("https://www.archidekt.com")}
                      style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px", color: "#e0f2ff", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>
                      OPEN ARCHIDEKT ↗
                    </button>
                  </div>
                  {deckSiteOpened && (
                    <button onClick={handleContinue}
                      style={{ width: "100%", background: myColor, border: "none", borderRadius: 8, padding: "12px", color: "#06040f", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: 1 }}>
                      CONTINUE →
                    </button>
                  )}
                </div>
              )}

              {i === 1 && active && !done && (
                <div style={{ marginTop: 8, padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: `1px solid ${myColor}30`, borderRadius: 12, animation: "fadeUp 0.2s ease both" }}>
                  {error && (
                    <div style={{ marginBottom: 10, padding: "8px 12px", background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.2)", borderRadius: 8, fontSize: 12, color: "#ff4d6d", lineHeight: 1.6 }}>
                      {error}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={resultInput}
                      onChange={e => setResultInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && resultInput.trim() && handleResultUrl(resultInput)}
                      placeholder="https://scrycheck.com/deck/..."
                      autoFocus
                      style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: `1px solid ${error ? "#ff4d6d" : "rgba(255,255,255,0.12)"}`, borderRadius: 8, padding: "10px 12px", color: "#e0f2ff", fontSize: 12, fontFamily: "inherit" }}
                    />
                    <button
                      onClick={() => resultInput.trim() && handleResultUrl(resultInput)}
                      disabled={loading || !resultInput.trim()}
                      style={{ background: loading ? "rgba(91,143,255,0.3)" : resultInput.trim() ? "#5b8fff" : "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "0 16px", color: "#06040f", fontSize: 13, fontWeight: 700, cursor: loading ? "wait" : "pointer", fontFamily: "inherit" }}>
                      {loading ? "..." : "GO"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <EscapeHatch onComplete={onComplete} />
      <LobbyStatus session={session} mySeat={mySeat} />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function JoinPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [step, setStep] = useState(1);
  const [mySeat, setMySeat] = useState(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from("sessions").select("data").eq("id", sessionId).single();
      if (error || !data) { setLoadError("Session not found. Ask the host to create a new one."); return; }
      setSession(data.data);
    }
    load();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase.channel(`session:${sessionId}:join`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        p => setSession(p.new.data))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [sessionId]);

  useEffect(() => {
    if (!session) return;
    if (session.game?.phase === "playing" && step < 8) { setStep(8); return; }
    if (session.game?.phase === "rolling" && step < 7) { setStep(7); return; }
    const isLifetrack = session.mode === 'lifetrack';
    const allReady = session.players.every(p => p.status === "ready");
    const allAgreed = allReady && session.players.filter(p => p.status === "ready").every(p => p.agreed);
    if (allAgreed && !session.game && step < 7) { setStep(7); return; }
    if (isLifetrack && allReady && !session.game && step < 7) { setStep(7); return; }
    if (!isLifetrack && allReady && !allAgreed && step < 5 && mySeat !== null) { setStep(5); return; }
  }, [session, step, mySeat]);

  useEffect(() => {
    if (!session) return;
    const saved = localStorage.getItem(`podcheck-${sessionId}`);
    if (saved === null) return;
    const savedSeat = parseInt(saved);
    if (mySeat !== null) return;
    const player = session.players[savedSeat];
    if (!player || player.status === "empty") { localStorage.removeItem(`podcheck-${sessionId}`); return; }
    setMySeat(savedSeat);
    if (session.game?.phase === "playing") { setStep(8); return; }
    const isLifetrack = session.mode === 'lifetrack';
    const allReady = session.players.every(p => p.status === "ready");
    const allAgreed = allReady && session.players.filter(p => p.status === "ready").every(p => p.agreed);
    if (allAgreed) { setStep(7); return; }
    if (allReady) { setStep(isLifetrack ? 6 : 5); return; }
    if (player.status === "ready") { setStep(4); return; }
    if (player.status === "analyzing") { setStep(4); return; }
    if (player.status === "pending") { setStep(isLifetrack ? 4 : 3); return; }
  }, [session, sessionId, mySeat]);

  const joinSession = useCallback(async (name) => {
    if (!session) return;
    const next = session.players.findIndex(p => p.status === "empty");
    if (next === -1) return;
    const isLifetrack = session.mode === 'lifetrack';
    const newStatus = isLifetrack ? 'ready' : 'pending';
    const playerName = name || `Player ${next + 1}`;
    const updated = { ...session, players: session.players.map((p, i) => i === next ? { ...p, name: playerName, status: newStatus } : p) };
    const { error } = await supabase.from("sessions").update({ data: updated }).eq("id", sessionId);
    if (!error) { setMySeat(next); setSession(updated); setStep(isLifetrack ? 4 : 3); localStorage.setItem(`podcheck-${sessionId}`, next.toString()); }
  }, [session, sessionId]);

  useEffect(() => {
    if (step !== 1 || !session || mySeat !== null) return;
    if (session.mode === 'lifetrack') return;
    if (session.players.filter(p => p.status !== "empty").length >= 4) return;
    joinSession();
  }, [step, session, mySeat, joinSession]);

  const handleThreeBarComplete = useCallback(async (deckData) => {
    const ready = { ...session, players: session.players.map((p, i) =>
      i === mySeat ? { ...p, name: deckData.commander || p.name, status: "ready", deckData } : p
    )};
    await supabase.from("sessions").update({ data: ready }).eq("id", sessionId);
    setSession(ready);
    setStep(4);
  }, [session, mySeat, sessionId]);

  const handleAgree = useCallback(async () => {
    const updated = { ...session, players: session.players.map((p, i) => i === mySeat ? { ...p, agreed: true } : p) };
    await supabase.from("sessions").update({ data: updated }).eq("id", sessionId);
    setSession(updated);
  }, [session, mySeat, sessionId]);

  const handleDiceComplete = useCallback(async (turnOrder) => {
    const gameState = {
      phase: "playing", turnOrder, currentTurn: 0,
      players: session.players.map(() => ({ life: STARTING_LIFE, poison: 0, commanderDamage: {}, eliminated: false })),
    };
    const updated = { ...session, game: gameState };
    await supabase.from("sessions").update({ data: updated }).eq("id", sessionId);
    setSession(updated); setStep(8);
  }, [session, sessionId]);

  const handleStartLifeTrack = useCallback(async () => {
    const withAgreed = {
      ...session,
      players: session.players.map(p =>
        p.status === "ready" ? { ...p, agreed: true } : p
      ),
      game: {
        phase: "rolling",
        turnOrder: [0, 1, 2, 3],
        currentTurn: 0,
        players: session.players.map(() => ({
          life: 40, poison: 0, commanderDamage: {}, eliminated: false
        })),
      },
    };
    await supabase.from("sessions").update({ data: withAgreed }).eq("id", sessionId);
    setSession(withAgreed);
    setStep(7);
  }, [session, sessionId]);

  const handleGameUpdate = useCallback(async (updatedGame) => {
    const updated = { ...session, game: updatedGame };
    await supabase.from("sessions").update({ data: updated }).eq("id", sessionId);
    setSession(updated);
  }, [session, sessionId]);

  if (loadError) return (
    <PageWrapper>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16, padding: 24 }}>
        <Logo /><div style={{ color: "#f87171", fontSize: 13, textAlign: "center" }}>{loadError}</div>
      </div>
    </PageWrapper>
  );

  if (!session) return (
    <PageWrapper>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 12 }}>
        <div style={{ color: "#475569", fontSize: 13, letterSpacing: 2 }}>LOADING...</div>
      </div>
    </PageWrapper>
  );

  if (step === 8 && session.game) return <LifeTracker session={session} mySeat={mySeat ?? 0} onUpdate={handleGameUpdate} />;

  return (
    <PageWrapper>
      <style>{`
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        input:focus { outline:none; border-color:#a78bfa !important; }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Logo size="sm" />
        <div style={{ fontSize: 12, color: "#a78bfa", letterSpacing: 3 }}>{sessionId}</div>
      </div>

      <div style={{ padding: "24px 20px", maxWidth: 480, margin: "0 auto" }}>
        {step === 1 && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            {session.players.filter(p => p.status !== "empty").length >= 4 ? (
              <div style={{ color: "#f87171", fontSize: 13, textAlign: "center", marginTop: 40 }}>This session is full.</div>
            ) : session.mode === 'lifetrack' ? (
              <CommanderSearch onSelect={(name) => joinSession(name)} color="#a78bfa" />
            ) : (
              <div style={{ color: "#475569", fontSize: 13, textAlign: "center", marginTop: 40 }}>Joining session...</div>
            )}
          </div>
        )}

        {step === 3 && mySeat !== null && (
          <ThreeBarOnboarding
            session={session}
            mySeat={mySeat}
            sessionId={sessionId}
            onComplete={handleThreeBarComplete}
          />
        )}

        {step === 4 && (
          <div style={{ animation: "fadeUp 0.4s ease both", textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: 11, color: "#34d399", letterSpacing: 2, marginBottom: 20 }}>✓ DECK SUBMITTED</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 3, color: "#e0f2ff", marginBottom: 8 }}>WAITING FOR THE POD</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 28 }}>Results appear automatically when everyone is ready.</div>
            <div style={{ width: 44, height: 44, border: "3px solid rgba(167,139,250,0.2)", borderTop: "3px solid #a78bfa", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 28px" }} />
            <MtgFact />
            <LobbyStatus session={session} mySeat={mySeat} />
          </div>
        )}

        {step === 5 && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            <BigVerdict players={session.players} mode={session.mode} />
            <div style={{
              textAlign: "center",
              margin: "24px 0 16px",
              padding: "16px",
              background: "rgba(91,143,255,0.06)",
              border: "1px solid rgba(91,143,255,0.12)",
              borderRadius: 12,
            }}>
              <div style={{ fontSize: 11, color: "#5b8fff", letterSpacing: 2, marginBottom: 6 }}>
                ENJOY POD CHECK?
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
                Give Life Track a try — turn order, life totals, and Scryfall search. All in one place.
              </div>
            </div>
            <button onClick={handleStartLifeTrack} style={{ ...btnStyle, background: "#5b8fff", width: "100%", marginTop: 4 }}>
              START LIFE TRACK →
            </button>
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                done — back to home
              </button>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}

const inputStyle = {
  width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10, padding: "12px 14px", color: "#e0f2ff", fontSize: 13,
  fontFamily: "inherit", transition: "border-color 0.2s",
};
const btnStyle = {
  border: "none", borderRadius: 10, padding: 14, color: "#06040f", fontSize: 13,
  fontWeight: 700, fontFamily: "inherit", cursor: "pointer", letterSpacing: 1,
  transition: "opacity 0.2s", display: "block",
};

// ─── Drawer button style helper ───────────────────────────────────────────────
function drawerBtn(color) {
  return {
    background: `${color}12`,
    border: `1px solid ${color}30`,
    borderRadius: 8, width: 36, height: 36,
    color: "#e0f2ff", fontSize: 18,
    fontFamily: "'IBM Plex Mono', monospace",
    cursor: "pointer", display: "flex",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0, padding: 0,
  };
}
