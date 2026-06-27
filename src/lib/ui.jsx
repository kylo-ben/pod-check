import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";
import { useTheme } from "../theme/ThemeContext.jsx";

// Bracket labels. Colors were removed with the multi-theme teardown — the
// single HELIX look reads brackets through neutral tokens at each call site.
export const BRACKET_META = {
  1: { label: "Precon" },
  2: { label: "Upgraded" },
  3: { label: "Optimized" },
  4: { label: "High Power" },
  5: { label: "cEDH" },
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
  const { theme, mode } = useTheme();
  const dim = mode === "light" ? theme.muted : theme.dim;
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
        borderRadius: 0, border: `3px solid ${borderColor}`,
        background: "#c8ccdb", overflow: "hidden",
        fontFamily: "'Zilla Slab', serif",
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
          <span style={{ fontSize:9, color:"#1a1c2e", fontFamily:"'Noto Sans Mono', monospace", letterSpacing:1 }}>
            {sessionId} · POD CHECK
          </span>
        </div>
      </div>
      <div style={{ textAlign:"center", marginTop:12 }}>
        <div style={{ fontFamily:"'Zilla Slab', serif", fontWeight:700, fontSize:24, letterSpacing:1, color: borderColor, textTransform:"uppercase", lineHeight:1, marginBottom:4 }}>
          {card?.name || cardName}
        </div>
        <div style={{ fontSize:10, color: dim, fontFamily:"'Noto Sans Mono', monospace", letterSpacing:2 }}>
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
  const { theme, mode } = useTheme();
  const ink = mode === "light" ? theme.ink : theme.white;
  return (
    <div style={{ minHeight: "100vh", background: theme.base, color: ink, fontFamily: "'Noto Sans', sans-serif", ...style }}>
      {children}
    </div>
  );
}

export function ScryCheckCredit() {
  const { theme, mode } = useTheme();
  const dim = mode === "light" ? theme.muted : theme.dim;
  const border = mode === "light" ? theme.border : theme.muted;
  const accent = mode === "light" ? theme.gold : theme.amber;
  return (
    <div style={{ textAlign: "center", padding: "24px 16px", borderTop: `1px solid ${border}`, fontSize: 11, color: dim, lineHeight: 1.8 }}>
      <div style={{ marginBottom: 4 }}>
        Deck analysis powered by{" "}
        <a href="https://scrycheck.com" target="_blank" rel="noopener noreferrer" style={{ color: accent, textDecoration: "none", fontWeight: 600 }}>
          ScryCheck
        </a>
        {" "}— the best Commander power level tool out there.
      </div>
      <div style={{ opacity: 0.6 }}>Pod Check is an unofficial fan app. Not affiliated with ScryCheck or Wizards of the Coast.</div>
      <div style={{ marginTop: 8, fontSize: 10, color: dim }}>
        <a href="https://github.com/kylo-ben/pod-check/issues/new?template=bug_report.md&title=[BUG]%20" target="_blank" rel="noopener noreferrer" style={{ color: accent, textDecoration: "none" }}>report a bug</a>
      </div>
    </div>
  );
}

export function Logo({ size = "md" }) {
  const { theme, mode } = useTheme();
  const ink = mode === "light" ? theme.ink : theme.white;
  const dim = mode === "light" ? theme.muted : theme.dim;
  const fontSize = size === "lg" ? 40 : size === "sm" ? 20 : 28;
  const sub = size === "lg" ? 13 : 10;
  return (
    <div>
      <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 700, fontSize, letterSpacing: 1, color: ink, lineHeight: 1 }}>
        POD CHECK
      </div>
      {size !== "sm" && (
        <div style={{ fontSize: sub, color: dim, letterSpacing: 2, marginTop: 2 }}>
          COMMANDER POWER BALANCE
        </div>
      )}
    </div>
  );
}

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null
        setUser(u)
        if (event === 'SIGNED_IN' && u && !u.is_anonymous) {
          const anonSessionId = localStorage.getItem('cardstock_session_id')
          if (anonSessionId) {
            await supabase.rpc('migrate_anonymous_decks', { p_session_id: anonSessionId })
            localStorage.removeItem('cardstock_session_id')
          }
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  return { user, loading, isAnonymous: user?.is_anonymous ?? true }
}

export function usePodPresence(user, deckData) {
  useEffect(() => {
    if (!user || !deckData) return

    const upsertPresence = async () => {
      await supabase.from('pod_presence').upsert({
        id: user.id,
        user_id: user.id,
        commander_name: deckData.commander,
        bracket: deckData.bracket,
        power: deckData.power,
        reveal_commander: true,
        last_seen: new Date().toISOString()
      }, { onConflict: 'user_id' })
    }

    upsertPresence()
    const interval = setInterval(upsertPresence, 30000)
    return () => {
      clearInterval(interval)
      supabase.from('pod_presence').delete().eq('user_id', user.id)
    }
  }, [user, deckData])
}

