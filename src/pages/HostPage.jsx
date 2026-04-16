import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { QRCodeSVG } from 'qrcode.react';
import { COLORS, BRACKET_META, PageWrapper, ScryCheckCredit, Logo } from "../lib/ui.jsx";

const STATUS_COLORS = {
  empty: "#334155", pending: "#7ba7bb", analyzing: "#c4915a", ready: "#5aaa88",
};

function MiniPlayerCard({ player, index }) {
  const color = COLORS[index];
  const bMeta = player.deckData?.bracket ? BRACKET_META[player.deckData.bracket] : null;
  const isEmpty = player.status === "empty";
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${isEmpty ? "rgba(255,255,255,0.06)" : color + "30"}`,
      borderRadius: 12, padding: "12px 14px",
      opacity: isEmpty ? 0.35 : 1,
      position: "relative", overflow: "hidden",
    }}>
      {!isEmpty && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${color}20`, border: `1.5px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color, flexShrink: 0 }}>{index + 1}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: player.name ? "#e0f2ff" : "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {player.name || "Empty"}
            </div>
            {player.deckData?.commander && <div style={{ fontSize: 10, color: "#475569", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{player.deckData.commander}</div>}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
          {player.deckData?.power != null
            ? <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{player.deckData.power.toFixed(1)}</div>
            : player.offline
              ? <div style={{ fontSize: 9, color: "#475569", letterSpacing: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "2px 5px" }}>OFFLINE</div>
              : <div style={{ fontSize: 10, color: STATUS_COLORS[player.status], letterSpacing: 1 }}>{player.status.toUpperCase()}</div>
          }
          {bMeta && <div style={{ fontSize: 9, color: bMeta.color, marginTop: 2 }}>B{player.deckData.bracket} · {bMeta.label}</div>}
        </div>
      </div>
    </div>
  );
}

function BalanceSummary({ players }) {
  const ready = players.filter(p => p.status === "ready" && p.deckData?.power != null);
  if (ready.length < 2) return null;
  const powers = ready.map(p => p.deckData.power);
  const spread = Math.max(...powers) - Math.min(...powers);
  const brackets = ready.map(p => p.deckData.bracket).filter(Boolean);
  const bracketSpread = brackets.length > 1 ? Math.max(...brackets) - Math.min(...brackets) : 0;

  let verdict, color, emoji, sub;
  if (spread <= 0.8 && bracketSpread <= 1) { verdict = "FAIR GAME"; color = "#5aaa88"; emoji = "⚖️"; sub = "Power levels are well matched."; }
  else if (spread <= 1.5 || bracketSpread <= 1) { verdict = "SLIGHT GAP"; color = "#c4915a"; emoji = "🟡"; sub = "Minor difference — totally playable."; }
  else if (spread <= 2.5) { verdict = "NOTABLE MISMATCH"; color = "#c4915a"; emoji = "⚠️"; sub = "Worth a bracket conversation."; }
  else { verdict = "BAD IDEA"; color = "#c45c6a"; emoji = "🔴"; sub = "Significant gap — someone swap decks."; }

  return (
    <div style={{ background: `${color}10`, border: `2px solid ${color}40`, borderRadius: 16, padding: "20px", textAlign: "center", marginBottom: 20, animation: "fadeUp 0.4s ease both" }}>
      <div style={{ fontSize: 36, marginBottom: 6 }}>{emoji}</div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, letterSpacing: 4, color, lineHeight: 1, marginBottom: 6 }}>{verdict}</div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>{sub}</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
        <div><div style={{ fontSize: 9, color: "#475569", letterSpacing: 2 }}>SPREAD</div><div style={{ fontSize: 20, fontWeight: 800, color }}>{spread.toFixed(1)}</div></div>
        {bracketSpread > 0 && <div><div style={{ fontSize: 9, color: "#475569", letterSpacing: 2 }}>BRACKET GAP</div><div style={{ fontSize: 20, fontWeight: 800, color }}>{bracketSpread}</div></div>}
      </div>
    </div>
  );
}

export default function HostPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddOffline, setShowAddOffline] = useState(false);
  const [offlineName, setOfflineName] = useState("");
  const [offlineBracket, setOfflineBracket] = useState(3);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from("sessions").select("data").eq("id", sessionId).single();
      if (error || !data) { navigate("/"); return; }
      setSession(data.data);
      setLoading(false);
    }
    load();
  }, [sessionId, navigate]);

  useEffect(() => {
    if (!session) return;
    const ch = supabase.channel(`session:${sessionId}:host`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        p => setSession(p.new.data))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [session?.id, sessionId]);

  const joinUrl = `https://pod-check.vercel.app/join/${sessionId}`;

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({ title: "Pod Check", text: `Join my Commander pod! Session: ${sessionId}`, url: joinUrl }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(joinUrl);
    }
  }, [joinUrl, sessionId]);

  const addOfflinePlayer = async () => {
    if (!offlineName.trim()) return;
    const next = session.players.findIndex(p => p.status === "empty");
    if (next === -1) return;
    const updated = { ...session };
    updated.players = session.players.map((p, i) =>
      i === next ? {
        ...p,
        name: offlineName.trim(),
        status: "ready",
        offline: true,
        deckData: {
          bracket: offlineBracket,
          tier: ["Precon","Upgraded","Optimized","High Power","cEDH"][offlineBracket - 1],
          selfReported: true,
          offline: true,
          commander: offlineName.trim(),
          power: null,
        }
      } : p
    );
    await supabase.from("sessions").update({ data: updated }).eq("id", sessionId);
    setSession(updated);
    setOfflineName("");
    setOfflineBracket(3);
    setShowAddOffline(false);
  };

  const readyCount = session?.players.filter(p => p.status === "ready").length ?? 0;
  const allReady = readyCount === 4;
  const hasGame = session?.game?.phase === "playing";

  if (loading) {
    return (
      <PageWrapper>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <div style={{ color: "#475569", fontSize: 13, letterSpacing: 2 }}>LOADING...</div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Logo size="sm" />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#5aaa88" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#5aaa88", animation: "pulse 2s ease infinite" }} />
            LIVE
          </div>
          <button onClick={() => navigate("/")} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 10px", color: "#475569", fontSize: 10, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>
            NEW SESSION
          </button>
        </div>
      </div>

      <div style={{ padding: "20px", maxWidth: 520, margin: "0 auto" }}>

        {allReady && <BalanceSummary players={session.players} />}

        {!hasGame && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, textAlign: "center", marginBottom: 10 }}>
              {allReady ? "SESSION CODE" : "SHARE THIS CODE WITH YOUR POD"}
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: "#ffffff", padding: 12, borderRadius: 8, display: "inline-block" }}>
                <QRCodeSVG value={joinUrl} size={180} bgColor="#ffffff" fgColor="#000000" />
              </div>
              <div style={{ color: '#b8a8d8', fontFamily: 'IBM Plex Mono', fontSize: '12px', letterSpacing: '0.1em' }}>OR ENTER CODE</div>
              <div style={{ color: '#b1d7e1', fontFamily: 'Bebas Neue', fontSize: '48px', letterSpacing: '0.05em' }}>{sessionId}</div>
            </div>
          </div>
        )}

        {!allReady && !hasGame && (
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <button
              onClick={handleShare}
              style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 16px", color: "#475569", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
            >
              SHARE LINK ↗
            </button>
          </div>
        )}

        <button
          onClick={() => navigate(`/join/${sessionId}?host=1`)}
          style={{
            width: "100%", marginBottom: 16,
            background: hasGame ? "#4c819c" : "rgba(76,129,156,0.12)",
            border: `1px solid ${hasGame ? "#7ba7bb" : "rgba(76,129,156,0.25)"}`,
            borderRadius: 12, padding: "14px",
            color: hasGame ? "#b1d7e1" : "#b8a8d8",
            fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace",
            cursor: "pointer", letterSpacing: 1,
          }}
        >
          {hasGame ? "OPEN LIFE TRACKER →" : "JOIN AS PLAYER →"}
        </button>

        {!hasGame && (
          <>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2, marginBottom: 10 }}>
              {readyCount}/4 PLAYERS READY
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {session.players.map((p, i) => <MiniPlayerCard key={i} player={p} index={i} />)}
            </div>
            {session.players.some(p => p.status === "empty") && (
              <div style={{ marginBottom: 24 }}>
                {!showAddOffline ? (
                  <button
                    onClick={() => setShowAddOffline(true)}
                    style={{
                      width: "100%", background: "transparent",
                      border: "1px dashed rgba(255,255,255,0.15)",
                      borderRadius: 10, padding: "10px",
                      color: "rgba(255,255,255,0.3)", fontSize: 12,
                      fontFamily: "'DM Mono', monospace", cursor: "pointer",
                      letterSpacing: 1,
                    }}
                  >
                    + ADD OFFLINE PLAYER
                  </button>
                ) : (
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 10 }}>OFFLINE PLAYER</div>
                    <input
                      value={offlineName}
                      onChange={e => setOfflineName(e.target.value)}
                      placeholder="Commander name..."
                      autoFocus
                      style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px", color: "#e0f2ff", fontSize: 13, fontFamily: "inherit", marginBottom: 10 }}
                    />
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 8 }}>BRACKET (self-reported)</div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                      {[1,2,3,4,5].map(b => (
                        <button key={b} onClick={() => setOfflineBracket(b)} style={{
                          flex: 1, padding: "8px 0",
                          background: offlineBracket === b ? "rgba(76,129,156,0.2)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${offlineBracket === b ? "#4c819c" : "rgba(255,255,255,0.08)"}`,
                          borderRadius: 6, color: offlineBracket === b ? "#7ba7bb" : "rgba(255,255,255,0.4)",
                          fontSize: 12, fontFamily: "inherit", cursor: "pointer",
                        }}>B{b}</button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={addOfflinePlayer} disabled={!offlineName.trim()} style={{
                        flex: 1, background: offlineName.trim() ? "#4c819c" : "rgba(76,129,156,0.2)",
                        border: "none", borderRadius: 8, padding: "10px",
                        color: offlineName.trim() ? "#b1d7e1" : "rgba(255,255,255,0.3)",
                        fontSize: 12, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", letterSpacing: 1,
                      }}>ADD →</button>
                      <button onClick={() => setShowAddOffline(false)} style={{
                        background: "none", border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8, padding: "10px 14px",
                        color: "rgba(255,255,255,0.3)", fontSize: 11, fontFamily: "inherit", cursor: "pointer",
                      }}>✕</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <ScryCheckCredit />
      </div>
    </PageWrapper>
  );
}
