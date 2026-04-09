import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { makeSessionId, newSession, PageWrapper, ScryCheckCredit, Logo } from "../lib/ui.jsx";

export default function LandingPage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);

  const createSession = useCallback(async () => {
    setCreating(true); setError(null);
    try {
      const id = makeSessionId();
      const data = newSession(id, 'podcheck');
      const { error: err } = await supabase.from("sessions").insert({ id, data });
      if (err) throw err;
      navigate(`/host/${id}`);
    } catch (e) {
      setError(e.message || "Failed to create session.");
    } finally { setCreating(false); }
  }, [navigate]);

  const joinByCode = useCallback(async () => {
    const clean = code.trim();
    if (!clean) return;
    setChecking(true); setCodeError(null);

    const isPhrase = clean.length > 5 || clean.includes(" ");

    if (isPhrase) {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, data")
        .ilike("data->>'cardName'", `%${clean}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error || !data) {
        setCodeError("Card not found. Check the name and try again.");
        setChecking(false); return;
      }
      navigate(`/join/${data.id}`);
    } else {
      const upper = clean.toUpperCase();
      const { data, error } = await supabase.from("sessions").select("id").eq("id", upper).single();
      if (error || !data) {
        setCodeError("Session not found. Check the code and try again.");
        setChecking(false); return;
      }
      navigate(`/join/${upper}`);
    }
    setChecking(false);
  }, [code, navigate]);

  return (
    <PageWrapper>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        input:focus { outline:none; border-color:#4c819c !important; }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 0, padding: "32px 24px" }}>
        <div style={{ animation: "fadeUp 0.4s ease both", width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>

          <Logo size="lg" />

          <p style={{ color: "#8890b0", fontSize: 13, textAlign: "center", lineHeight: 1.8, marginTop: -8 }}>
            Powered by <a href="https://scrycheck.com" target="_blank" rel="noopener noreferrer" style={{ color: "#b8a8d8", textDecoration: "none" }}>ScryCheck</a>.
          </p>

          {/* Create session */}
          <div style={{ width: "100%" }}>
            {error && <div style={{ color: "#c45c6a", fontSize: 12, marginBottom: 10, textAlign: "center" }}>{error}</div>}
            <button
              onClick={() => createSession()}
              disabled={creating}
              style={{
                width: "100%", background: "#4c819c", border: "1.5px solid #7ba7bb", borderRadius: 12,
                padding: "14px 16px", fontFamily: "'DM Mono', monospace",
                color: "#b1d7e1", cursor: creating ? "wait" : "pointer",
                opacity: creating ? 0.7 : 1, transition: "opacity 0.2s",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>POD CHECK</div>
              <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.65, marginTop: 2 }}>balance your pod</div>
            </button>
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(26,28,46,0.2)" }} />
            <div style={{ fontSize: 11, color: "#3d3f5a", letterSpacing: 2 }}>OR</div>
            <div style={{ flex: 1, height: 1, background: "rgba(26,28,46,0.2)" }} />
          </div>

          {/* Join by code */}
          <div style={{ width: "100%" }}>
            <div style={{ fontSize: 10, color: "#8890b0", letterSpacing: 2, marginBottom: 10, textAlign: "center" }}>JOIN A TABLE</div>
            <input
              value={code}
              onChange={e => {
                setCode(e.target.value);
                setCodeError(null);
              }}
              onKeyDown={e => e.key === "Enter" && code.trim() && joinByCode()}
              placeholder="ENTER CODE"
              maxLength={30}
              style={{
                width: "100%",
                background: "#22253a",
                border: `1px solid ${codeError ? "#c45c6a" : "#7d82a2"}`,
                borderRadius: 12,
                padding: "16px",
                color: "#b1d7e1",
                fontSize: 28,
                fontFamily: "'Bebas Neue', sans-serif",
                letterSpacing: 10,
                textAlign: "center",
                transition: "border-color 0.2s",
                marginBottom: 10,
              }}
            />
            {codeError && <div style={{ color: "#c45c6a", fontSize: 12, marginBottom: 10, textAlign: "center" }}>{codeError}</div>}
            <button
              onClick={joinByCode}
              disabled={checking || !code.trim()}
              style={{
                width: "100%",
                background: code.trim() ? "rgba(76,129,156,0.15)" : "rgba(26,28,46,0.1)",
                border: `1px solid ${code.trim() ? "rgba(76,129,156,0.3)" : "rgba(26,28,46,0.15)"}`,
                borderRadius: 12, padding: "14px",
                color: code.trim() ? "#4c819c" : "#3d3f5a",
                fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace",
                cursor: code.trim() ? "pointer" : "not-allowed", letterSpacing: 1,
                transition: "all 0.2s",
              }}
            >
              {checking ? "CHECKING..." : "JOIN SESSION →"}
            </button>
          </div>

          <ScryCheckCredit />
        </div>
      </div>
    </PageWrapper>
  );
}
