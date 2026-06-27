import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { PageWrapper, Logo } from "../lib/ui.jsx";
import PodCard from "../components/PodCard.jsx";
import Identity from "../components/Identity.jsx";
import EventSignup from "../components/EventSignup.jsx";
import { useTheme } from "../theme/ThemeContext.jsx";

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

// Layer-1 scaffold: loads the mode:'event' session, subscribes to realtime, and
// renders a minimal skeleton. The lobby, sign-up, pod-fill, opt-out and swap-vote
// layers build on this. The single-pod (mode:'podcheck') flow is unaffected.
export default function EventPage() {
  const t = useTokens();
  const { code } = useParams();
  const location = useLocation();
  const isHost = new URLSearchParams(location.search).get("host") === "1";

  const [event, setEvent] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [myId, setMyId] = useState(() => localStorage.getItem(`podcheck-event-${code}`));
  const [addingWalkin, setAddingWalkin] = useState(false);

  const share = useCallback(() => {
    navigator.clipboard?.writeText(`https://pod-check.vercel.app/event/${code}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [code]);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from("sessions").select("data").eq("id", code).single();
      if (error || !data) { setLoadError("Event not found. Check the code with the host."); return; }
      if (data.data?.mode !== "event") { setLoadError("That code isn't an event."); return; }
      setEvent(data.data);
    }
    load();
  }, [code]);

  useEffect(() => {
    if (!code) return;
    const ch = supabase.channel(`event:${code}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${code}` },
        (p) => { if (p.new.data?.mode === "event") setEvent(p.new.data); })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [code]);

  if (loadError) return (
    <PageWrapper>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16, padding: 24 }}>
        <Logo />
        <div style={{ color: t.attention, fontSize: 13, textAlign: "center" }}>{loadError}</div>
      </div>
    </PageWrapper>
  );

  if (!event) return (
    <PageWrapper>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ color: t.dim, fontSize: 13, letterSpacing: 2 }}>LOADING…</div>
      </div>
    </PageWrapper>
  );

  const byId = new Map(event.players.map((p) => [p.id, p]));
  const waiting = event.players.filter((p) => p.status === "waiting");
  const pods = event.pods ?? [];
  const me = myId ? byId.get(myId) : null;
  const meActive = me && me.status !== "opted_out";

  return (
    <PageWrapper>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${t.border}` }}>
        <Logo size="sm" />
        <button onClick={share} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Noto Sans Mono', monospace", fontSize: 12, color: copied ? t.accent : t.accent, letterSpacing: 3 }}>
          {copied ? "COPIED ✓" : code}
        </button>
      </div>

      <div style={{ padding: "24px 20px", maxWidth: 520, margin: "0 auto" }}>
        <div style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 700, fontSize: 28, letterSpacing: 1, color: t.ink, marginBottom: 6 }}>
          EVENT LOBBY
        </div>
        <div style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 11, color: t.dim, letterSpacing: 1, marginBottom: 20 }}>
          TARGET B{event.targetBracket} · {pods.length} POD{pods.length === 1 ? "" : "S"} · {waiting.length} WAITING{isHost ? " · HOST" : ""}
        </div>

        {/* Self-serve sign-up (player who hasn't joined) */}
        {!isHost && !meActive && (
          <EventSignup code={code} event={event} variant="self" onDone={(p) => setMyId(p.id)} />
        )}

        {/* Host walk-in adder */}
        {isHost && (
          addingWalkin ? (
            <EventSignup code={code} event={event} variant="walkin" onDone={() => setAddingWalkin(false)} onCancel={() => setAddingWalkin(false)} />
          ) : (
            <button onClick={() => setAddingWalkin(true)} style={{ width: "100%", background: "transparent", border: `1px dashed ${t.border}`, borderRadius: 0, padding: "12px", color: t.dim, fontSize: 12, fontFamily: "'Noto Sans Mono', monospace", letterSpacing: 1, cursor: "pointer", marginBottom: 16 }}>
              + ADD A WALK-IN
            </button>
          )
        )}

        {pods.map((pod, i) => (
          <PodCard key={pod.id} index={i} members={pod.memberIds.map((id) => byId.get(id)).filter(Boolean)} />
        ))}

        <div style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 9, color: t.dim, letterSpacing: 1.5, margin: "8px 0 10px" }}>
          WAITING FOR A POD ({waiting.length})
        </div>
        {waiting.length === 0 ? (
          <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 0, padding: 16, color: t.dim, fontSize: 12, lineHeight: 1.6, textAlign: "center" }}>
            No one's signed up yet. Share the code to fill the room.
          </div>
        ) : (
          <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 0, overflow: "hidden" }}>
            {waiting.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: i < waiting.length - 1 ? `1px solid ${t.border}` : "none" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <Identity player={p} color={p.id === myId ? t.accent : t.ink} />
                  {p.id === myId && <span style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 9, color: t.accent, letterSpacing: 1 }}>YOU</span>}
                </span>
                <span style={{ fontFamily: "'Noto Sans Mono', monospace", fontSize: 11, color: t.dim, flexShrink: 0, marginLeft: 8 }}>{p.bracket != null ? `B${p.bracket}` : "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
