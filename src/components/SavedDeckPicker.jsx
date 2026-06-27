import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { useTheme } from "../theme/ThemeContext.jsx";

export default function SavedDeckPicker({ user, onUse, onSwitch }) {
  const { theme, mode } = useTheme();
  const light = mode === "light";
  const base   = theme.base;
  const panel  = light ? theme.paper : theme.surface;
  const ink    = light ? theme.ink   : theme.white;
  const dim    = light ? theme.muted : theme.dim;
  const border = light ? theme.border : theme.muted;
  const accent = light ? theme.gold  : theme.amber;

  const [decks, setDecks] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    async function load() {
      if (user && !user.is_anonymous) {
        const { data } = await supabase
          .from('decks')
          .select('id, commander_name, power, bracket, scrycheck_url, tier')
          .eq('user_id', user.id)
          .not('bracket', 'is', null)
          .order('scrycheck_at', { ascending: false })
          .limit(5)
        setDecks(data ?? [])
      } else {
        const raw = localStorage.getItem('cardstock_last_deck')
        setDecks(raw ? [JSON.parse(raw)] : [])
      }
    }
    load()
  }, [user])

  useEffect(() => {
    if (decks !== null && decks.length === 0) onSwitch()
  }, [decks, onSwitch])

  if (decks === null || decks.length === 0) return null

  return (
    <div style={{ animation: "fadeUp 0.4s ease both" }}>
      <div style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 11, color: accent, letterSpacing: 2, marginBottom: 16 }}>
        YOUR DECKS
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {decks.map((d, i) => (
          <div
            key={d.id ?? i}
            onClick={() => setSelected(d)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 14px", borderRadius: 0, cursor: "pointer",
              background: selected === d ? `${accent}22` : panel,
              border: `1px solid ${selected === d ? accent : border}`,
              borderLeft: `2px solid ${selected === d ? accent : border}`,
              transition: "all 0.15s",
            }}
          >
            <span style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 13, color: ink }}>
              {d.commander_name || "Unknown"}
            </span>
            <span style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 11, color: dim }}>
              B{d.bracket}{d.power != null ? ` · ${Number(d.power).toFixed(1)}` : ""}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => selected && onUse({
            commander: selected.commander_name,
            power: selected.power,
            bracket: selected.bracket,
            tier: selected.tier,
            vectors: {},
          })}
          disabled={!selected}
          style={{
            flex: 1, minHeight: 44, background: selected ? accent : `${accent}26`,
            border: `1px solid ${accent}`, borderRadius: 0,
            color: selected ? base : accent, fontFamily: "'Noto Sans Mono', monospace",
            fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: selected ? "pointer" : "not-allowed",
          }}
        >
          USE THIS DECK
        </button>
        <button
          onClick={onSwitch}
          style={{
            flex: 1, minHeight: 44, background: "transparent",
            border: `1px solid ${accent}`, borderRadius: 0,
            color: accent, fontFamily: "'Noto Sans Mono', monospace",
            fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
          }}
        >
          DIFFERENT DECK
        </button>
      </div>
    </div>
  )
}
