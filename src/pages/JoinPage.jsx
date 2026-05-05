import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { COLORS, BRACKET_META, PageWrapper, Logo, SessionCodeCard } from "../lib/ui.jsx";
import { QRCodeSVG } from "qrcode.react";

// ─── Utils ────────────────────────────────────────────────────────────────────
function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// ─── Facts Ticker ─────────────────────────────────────────────────────────────
const MTG_FACTS = [
  "Magic was briefly called Mana Clash before becoming Magic: The Gathering.",
  "\u201cThe Gathering\u201d was added to make the name legally protectable.",
  "Garfield planned to rename Magic with each set (e.g., Magic: Ice Age).",
  "Deckmaster was a shared brand for multiple Wizards TCGs.",
  "The card back has never changed to maintain uniformity.",
  "The original logo was blue and later changed to yellow for visibility.",
  "The card back still uses an outdated \u2122 instead of \u00ae.",
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
  "Alpha cards used \u201cTap to\u201d before the tap symbol existed.",
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
  "Stasis was illustrated by Richard Garfield's aunt, Fay Jones, as a favor.",
  "Early Wizards HQ visitors were often given free decks and boosters.",
  "Arabian Nights flavor text was written in one night.",
  "Legends characters were based on a Dungeons and Dragons campaign.",
  "Urza's Saga was almost named Urza's Odyssey.",
  "Rancor was undercosted due to a data entry error.",
  "The mechanic Entwine was conceived in a dream.",
  "Wizards once considered including gum in booster packs.",
];

// ─── StepBar ──────────────────────────────────────────────────────────────────
function StepBar({ current, total }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 3, borderRadius: 2,
          background: i < current ? "#b8a8d8" : "rgba(255,255,255,0.1)",
          transition: "background 0.3s",
        }} />
      ))}
    </div>
  );
}

// ─── BigVerdict ───────────────────────────────────────────────────────────────
function BigVerdict({ players, mySeat, onResubmit }) {
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
    color = "#5aaa88"; emoji = "⚖️"; bg = "rgba(90,170,136,0.08)";
  } else if (spread <= 1.5 || bracketSpread <= 1) {
    verdict = "SLIGHT GAP"; sub = "Minor power difference — totally playable, just worth noting.";
    color = "#c4915a"; emoji = "🟡"; bg = "rgba(196,145,90,0.08)";
  } else if (spread <= 2.5) {
    verdict = "NOTABLE MISMATCH"; sub = "Real bracket difference. Have a quick conversation before you play.";
    color = "#c4915a"; emoji = "⚠️"; bg = "rgba(196,145,90,0.08)";
  } else {
    verdict = "BAD IDEA"; sub = "Significant power gap. Someone should grab a different deck.";
    color = "#c45c6a"; emoji = "🔴"; bg = "rgba(196,92,106,0.08)";
  }

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
              {oi === mySeat && onResubmit && (
                <button
                  onClick={onResubmit}
                  style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, padding: "2px 8px", fontSize: 9, color: "#475569", cursor: "pointer", fontFamily: "inherit", letterSpacing: 1, flexShrink: 0 }}
                >
                  RE-SUBMIT
                </button>
              )}
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
      maxWidth: 320, margin: "0 auto 28px", padding: "14px 18px",
      background: "rgba(76,129,156,0.06)", border: "1px solid rgba(76,129,156,0.15)",
      borderRadius: 12, opacity: visible ? 1 : 0, transition: "opacity 0.5s ease",
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
  pending:   { text: "Joined",    color: "#7ba7bb" },
  analyzing: { text: "Analyzing", color: "#c4915a" },
  ready:     { text: "Ready ✓",   color: "#5aaa88" },
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
        <div style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
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
      {cmdError && <div style={{ fontSize: 12, color: "#c45c6a", marginTop: 8 }}>{cmdError}</div>}
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
        color="#b8a8d8"
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
                background: done ? "rgba(90,170,136,0.08)" : active ? `${myColor}10` : "rgba(255,255,255,0.02)",
                border: `1.5px solid ${done ? "#5aaa88" : active ? myColor : "rgba(255,255,255,0.06)"}`,
                borderRadius: 14, transition: "all 0.3s",
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  background: done ? "#5aaa88" : active ? myColor : "rgba(255,255,255,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: "#1a2744", fontWeight: 700,
                }}>
                  {done ? "✓" : isAnalyzing ? (
                    <div style={{ width: 10, height: 10, border: "2px solid rgba(26,39,68,0.3)", borderTop: `2px solid #1a2744`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  ) : i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: done ? "#5aaa88" : active ? "#e0f2ff" : "rgba(255,255,255,0.2)", letterSpacing: 1 }}>{label}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>{sub}</div>
                </div>
                <div style={{ fontSize: 14, color: done ? "#5aaa88" : active ? myColor : "rgba(255,255,255,0.1)", flexShrink: 0 }}>
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
                      style={{ width: "100%", background: myColor, border: "none", borderRadius: 8, padding: "12px", color: "#1a2744", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: 1 }}>
                      CONTINUE →
                    </button>
                  )}
                </div>
              )}

              {i === 1 && active && !done && (
                <div style={{ marginTop: 8, padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: `1px solid ${myColor}30`, borderRadius: 12, animation: "fadeUp 0.2s ease both" }}>
                  {error && (
                    <div style={{ marginBottom: 10, padding: "8px 12px", background: "rgba(196,92,106,0.1)", border: "1px solid rgba(196,92,106,0.25)", borderRadius: 8, fontSize: 12, color: "#c45c6a", lineHeight: 1.6 }}>
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
                      style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: `1px solid ${error ? "#c45c6a" : "rgba(255,255,255,0.12)"}`, borderRadius: 8, padding: "10px 12px", color: "#e0f2ff", fontSize: 16, fontFamily: "inherit" }}
                    />
                    <button
                      onClick={() => resultInput.trim() && handleResultUrl(resultInput)}
                      disabled={loading || !resultInput.trim()}
                      style={{ background: loading ? "rgba(76,129,156,0.3)" : resultInput.trim() ? "#4c819c" : "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "0 16px", color: "#e0f2ff", fontSize: 13, fontWeight: 700, cursor: loading ? "wait" : "pointer", fontFamily: "inherit" }}>
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
  const location = useLocation();
  const isHost = new URLSearchParams(location.search).get("host") === "1";
  const [session, setSession] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [step, setStep] = useState(1);
  const [mySeat, setMySeat] = useState(null);
  const [checkedStorage, setCheckedStorage] = useState(false);

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
    const allReady = session.players.every(p => p.status === "ready");
    if (allReady && step < 5 && mySeat !== null) { setStep(5); return; }
  }, [session, step, mySeat]);

  useEffect(() => {
    if (!session) return;
    const saved = localStorage.getItem(`podcheck-${sessionId}`);
    if (saved === null) { setCheckedStorage(true); return; }
    const savedSeat = parseInt(saved);
    if (mySeat !== null) return;
    const player = session.players[savedSeat];
    if (!player || player.status === "empty") { localStorage.removeItem(`podcheck-${sessionId}`); setCheckedStorage(true); return; }
    setMySeat(savedSeat);
    const allReady = session.players.every(p => p.status === "ready");
    if (allReady) { setStep(5); setCheckedStorage(true); return; }
    if (player.status === "ready") { setStep(4); setCheckedStorage(true); return; }
    if (player.status === "analyzing") { setStep(4); setCheckedStorage(true); return; }
    if (player.status === "pending") { setStep(3); setCheckedStorage(true); return; }
    setCheckedStorage(true);
  }, [session, sessionId, mySeat]);

  const joinSession = useCallback(async (name) => {
    if (!session) return;
    const next = session.players.findIndex(p => p.status === "empty");
    if (next === -1) return;
    const playerName = name || `Player ${next + 1}`;
    const updated = { ...session, players: session.players.map((p, i) => i === next ? { ...p, name: playerName, status: 'pending' } : p) };
    const { error } = await supabase.from("sessions").update({ data: updated }).eq("id", sessionId);
    if (!error) { setMySeat(next); setSession(updated); setStep(3); localStorage.setItem(`podcheck-${sessionId}`, next.toString()); }
  }, [session, sessionId]);

  useEffect(() => {
    if (!checkedStorage) return;
    if (step !== 1 || !session || mySeat !== null) return;
    if (session.players.filter(p => p.status !== "empty").length >= 4) return;
    if (isHost) {
      setMySeat(0);
      setStep(3);
      localStorage.setItem(`podcheck-${sessionId}`, "0");
      return;
    }
    joinSession();
  }, [checkedStorage, step, session, mySeat, joinSession, isHost, sessionId]);

  const handleThreeBarComplete = useCallback(async (deckData) => {
    const ready = { ...session, players: session.players.map((p, i) =>
      i === mySeat ? { ...p, name: deckData.commander || p.name, status: "ready", deckData } : p
    )};
    await supabase.from("sessions").update({ data: ready }).eq("id", sessionId);
    setSession(ready);
    setStep(4);
  }, [session, mySeat, sessionId]);

  // If the shell pre-loaded deck data was passed via router state, skip ThreeBarOnboarding
  // and submit immediately when we reach step 3 (seat claimed, session ready).
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    if (step !== 3 || mySeat === null || autoJoinedRef.current) return;
    const deckData = location.state?.deckData;
    if (!deckData) return;
    autoJoinedRef.current = true;
    handleThreeBarComplete(deckData);
  }, [step, mySeat, handleThreeBarComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAgree = useCallback(async () => {
    const updated = { ...session, players: session.players.map((p, i) => i === mySeat ? { ...p, agreed: true } : p) };
    await supabase.from("sessions").update({ data: updated }).eq("id", sessionId);
    setSession(updated);
  }, [session, mySeat, sessionId]);

  const handleResubmit = useCallback(async () => {
    const updated = { ...session, players: session.players.map((p, i) =>
      i === mySeat ? { ...p, status: "pending", deckData: null, agreed: false } : p
    )};
    await supabase.from("sessions").update({ data: updated }).eq("id", sessionId);
    setSession(updated);
    setStep(3);
  }, [session, mySeat, sessionId]);


  if (loadError) return (
    <PageWrapper>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16, padding: 24 }}>
        <Logo /><div style={{ color: "#c45c6a", fontSize: 13, textAlign: "center" }}>{loadError}</div>
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

  return (
    <PageWrapper>
      <style>{`
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        input:focus { outline:none; border-color:#4c819c !important; }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Logo size="sm" />
        <div style={{ fontSize: 12, color: "#b8a8d8", letterSpacing: 3 }}>{sessionId}</div>
      </div>

      <div style={{ padding: "24px 20px", maxWidth: 480, margin: "0 auto" }}>
        {step === 1 && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            {session.players.filter(p => p.status !== "empty").length >= 4 ? (
              <div style={{ color: "#c45c6a", fontSize: 13, textAlign: "center", marginTop: 40 }}>This session is full.</div>
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
            <div style={{ fontSize: 11, color: "#5aaa88", letterSpacing: 2, marginBottom: 20 }}>✓ DECK SUBMITTED</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 3, color: "#e0f2ff", marginBottom: 8 }}>WAITING FOR THE POD</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 28 }}>Results appear automatically when everyone is ready.</div>
            <div style={{ display: "inline-block", background: "#ffffff", borderRadius: 16, padding: 16, marginBottom: 12 }}>
              <QRCodeSVG value={`https://pod-check.vercel.app/join/${sessionId}`} size={180} bgColor="#ffffff" fgColor="#000000" level="M" />
            </div>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 28 }}>
              SCAN TO JOIN ·{" "}
              <span style={{ color: "#b1d7e1", fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 4 }}>
                {sessionId}
              </span>
            </div>
            <div style={{ width: 44, height: 44, border: "3px solid rgba(76,129,156,0.2)", borderTop: "3px solid #4c819c", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 28px" }} />
            <MtgFact />
            <LobbyStatus session={session} mySeat={mySeat} />
          </div>
        )}

        {step === 5 && (
          <div style={{ animation: "fadeUp 0.5s ease both" }}>
            <BigVerdict players={session.players} mode={session.mode} mySeat={mySeat} onResubmit={handleResubmit} />
            <div style={{ textAlign: "center", marginTop: 24 }}>
              <button onClick={() => navigate("/")} style={{ ...btnStyle, background: "rgba(255,255,255,0.08)", color: "#e0f2ff", width: "100%" }}>
                DONE — BACK TO HOME
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
  border: "none", borderRadius: 10, padding: 14, color: "#1a2744", fontSize: 13,
  fontWeight: 700, fontFamily: "inherit", cursor: "pointer", letterSpacing: 1,
  transition: "opacity 0.2s", display: "block",
};
