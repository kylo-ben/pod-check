import { useState, useEffect } from "react";

export const COLORS = ["#d4a0c0", "#c4915a", "#5aaa88", "#7ba7bb"];

export const BRACKET_META = {
  1: { label: "Precon",     color: "#5aaa88" },
  2: { label: "Upgraded",   color: "#7ba7bb" },
  3: { label: "Optimized",  color: "#c4915a" },
  4: { label: "High Power", color: "#c45c6a" },
  5: { label: "cEDH",       color: "#b8a8d8" },
};

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const STAPLES = [
  "Sol Ring", "Command Tower", "Arcane Signet", "Mana Vault", "Rhystic Study",
  "Cyclonic Rift", "Demonic Tutor", "Vampiric Tutor", "Birds of Paradise",
  "Swords to Plowshares", "Force of Will", "Swan Song", "Smothering Tithe",
  "Dark Ritual", "Fierce Guardianship", "Mystical Tutor", "Enlightened Tutor",
  "Gamble", "Esper Sentinel", "Ragavan, Nimble Pilferer", "Grand Abolisher",
  "Thassa's Oracle", "Orcish Bowmasters", "Grim Monolith", "Chrome Mox",
  "Mox Diamond", "Lion's Eye Diamond", "Lotus Petal", "Crop Rotation",
  "Chain of Vapor", "Cavern of Souls", "Silence", "Underworld Breach",
  "Demonic Consultation", "Diabolic Intent", "Finale of Devastation",
  "Brain Freeze", "Fellwar Stone", "Wishclaw Talisman", "Faerie Mastermind",
  "Ranger-Captain of Eos", "Delighted Halfling", "Boseiju, Who Endures",
  "Pact of Negation", "Force of Negation", "Flusterstorm", "Mental Misstep",
  "Mindbreak Trap", "Tainted Pact", "Deflecting Swat", "The One Ring",
  "Imperial Seal", "Gaea's Cradle", "Ancient Tomb", "Mana Confluence",
  "Misty Rainforest", "Scalding Tarn", "Flooded Strand", "Polluted Delta",
  "Verdant Catacombs", "Bloodstained Mire", "Wooded Foothills", "Windswept Heath",
  "Marsh Flats", "Arid Mesa", "City of Brass", "Exotic Orchard",
  "Gemstone Caverns", "Mox Amber", "Mox Opal", "Otawara, Soaring City",
  "Mystic Remora", "An Offer You Can't Refuse", "Rite of Flame",
  "Simian Spirit Guide", "Elvish Spirit Guide", "Cabal Ritual",
  "Jeska's Will", "Hexing Squelcher", "Borne Upon a Wind", "Into the Flood Maw",
  "Voice of Victory", "Mockingbird", "Red Elemental Blast", "Watery Grave",
  "Volcanic Island", "Underground Sea", "Tropical Island", "Tundra", "Scrubland",
  "City of Traitors",
];

export function stapleForSession(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return STAPLES[h % STAPLES.length];
}

export function SessionCodeCard({ sessionId }) {
  const cardName = stapleForSession(sessionId);
  const [card, setCard] = useState(null);

  useEffect(() => {
    fetch(
      `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`,
      { headers: { "User-Agent": "PodCheck/1.0 (pod-check.vercel.app)" } }
    )
      .then(r => r.json())
      .then(d => { if (d.object === "card") setCard(d); })
      .catch(() => {});
  }, [cardName]);

  const artUrl = card?.image_uris?.art_crop || card?.card_faces?.[0]?.image_uris?.art_crop;
  const identity = card?.color_identity?.[0];
  const borderColor = { W:"#c8ccdb", U:"#7ba7bb", B:"#aab0c7", R:"#c45c6a", G:"#5aaa88" }[identity] || "#b8a8d8";
  const manaCost = card?.mana_cost?.replace(/[{}]/g, "").trim() || "";

  return (
    <div onClick={() => navigator.clipboard?.copyText(cardName)} style={{ cursor: "pointer" }}>
      <div style={{
        width: "100%", maxWidth: 300, margin: "0 auto",
        borderRadius: 12, border: `3px solid ${borderColor}`,
        background: "#c8ccdb", overflow: "hidden",
        boxShadow: `0 0 32px ${borderColor}40`,
        fontFamily: "serif",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:"#aab0c7", borderBottom:"1.5px solid #7d82a2" }}>
          <span style={{ fontSize:16, fontWeight:700, color:"#1a1c2e" }}>{card?.name || "—"}</span>
          <span style={{ fontSize:12, fontWeight:600, color:"#1a1c2e", letterSpacing:1 }}>{manaCost}</span>
        </div>
        <div style={{ width:"100%", height:180, background:`${borderColor}30`, overflow:"hidden" }}>
          {artUrl
            ? <img src={artUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            : <div style={{ width:"100%", height:"100%", background:`${borderColor}20` }} />
          }
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 12px", background:"#aab0c7", borderTop:"1.5px solid #7d82a2" }}>
          <span style={{ fontSize:13, fontWeight:600, color:"#1a1c2e" }}>{card?.type_line || "—"}</span>
          {card?.set && (
            <img src={`https://svgs.scryfall.io/sets/${card.set}.svg`} alt="" style={{ width:18, height:18, opacity:0.6, filter:"invert(0.3)" }} />
          )}
        </div>
        <div style={{ padding:"3px 12px 6px", background:"#c8ccdb", textAlign:"right" }}>
          <span style={{ fontSize:9, color:"#475569", fontFamily:"monospace", letterSpacing:1 }}>
            {sessionId} · POD CHECK
          </span>
        </div>
      </div>
      <div style={{ textAlign:"center", marginTop:12 }}>
        <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:24, letterSpacing:4, color: borderColor, textTransform:"uppercase", lineHeight:1, marginBottom:4 }}>
          {card?.name || cardName}
        </div>
        <div style={{ fontSize:10, color:"#334155", fontFamily:"monospace", letterSpacing:2 }}>
          {sessionId}
        </div>
      </div>
    </div>
  );
}

export function makeSessionId() {
  return Array.from({ length: 5 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join("");
}

export function emptyPlayer(seat) {
  return { seat, name: "", status: "empty", scrycheckUrl: null, deckData: null, agreed: false, error: null };
}

export function newSession(id, mode = 'podcheck') {
  const players = [0, 1, 2, 3].map(emptyPlayer);
  players[0].status = "pending";
  return { id, createdAt: new Date().toISOString(), players, game: null, mode, cardName: stapleForSession(id) };
}

export function PageWrapper({ children, style = {} }) {
  return (
    <div style={{ minHeight: "100vh", background: "#1a2744", color: "#e0f2ff", fontFamily: "'DM Mono', monospace", ...style }}>
      {children}
    </div>
  );
}

export function ScryCheckCredit() {
  return (
    <div style={{ textAlign: "center", padding: "24px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "#475569", lineHeight: 1.8 }}>
      <div style={{ marginBottom: 4 }}>
        Deck analysis powered by{" "}
        <a href="https://scrycheck.com" target="_blank" rel="noopener noreferrer" style={{ color: "#b8a8d8", textDecoration: "none", fontWeight: 600 }}>
          ScryCheck
        </a>
        {" "}— the best Commander power level tool out there.
      </div>
      <div style={{ opacity: 0.6 }}>Pod Check is an unofficial fan app. Not affiliated with ScryCheck or Wizards of the Coast.</div>
      <div style={{ marginTop: 8, fontSize: 10, color: "#334155" }}>
        <a href="https://github.com/kylo-ben/pod-check/issues/new?template=bug_report.md&title=[BUG]%20" target="_blank" rel="noopener noreferrer" style={{ color: "#4c819c", textDecoration: "none" }}>report a bug</a>
      </div>
    </div>
  );
}

export function Logo({ size = "md" }) {
  const fontSize = size === "lg" ? 40 : size === "sm" ? 20 : 28;
  const sub = size === "lg" ? 13 : 10;
  return (
    <div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize, letterSpacing: 4, color: "#b8a8d8", lineHeight: 1 }}>
        POD CHECK
      </div>
      {size !== "sm" && (
        <div style={{ fontSize: sub, color: "#475569", letterSpacing: 2, marginTop: 2 }}>
          COMMANDER POWER BALANCE
        </div>
      )}
    </div>
  );
}

export function SessionCode({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy} style={{ background: "rgba(76,129,156,0.12)", border: "2px solid rgba(76,129,156,0.3)", borderRadius: 16, padding: "16px 28px", cursor: "pointer", textAlign: "center", width: "100%" }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, letterSpacing: 10, color: "#b1d7e1", lineHeight: 1, paddingLeft: 10 }}>
        {code}
      </div>
      <div style={{ fontSize: 10, color: copied ? "#5aaa88" : "#475569", letterSpacing: 2, marginTop: 6, transition: "color 0.2s" }}>
        {copied ? "COPIED ✓" : "TAP TO COPY"}
      </div>
    </button>
  );
}
