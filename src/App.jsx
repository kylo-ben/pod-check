import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Turnstile } from "@marsidev/react-turnstile";
import HostPage        from "./pages/HostPage.jsx";
import JoinPage        from "./pages/JoinPage.jsx";
import EventPage       from "./pages/EventPage.jsx";
import EventHostSetup  from "./pages/EventHostSetup.jsx";
import PersistentShell from "./components/PersistentShell.jsx";
import { initSession } from "./lib/supabase.js";
import { useTheme }    from "./theme/ThemeContext.jsx";

export default function App() {
  const { theme } = useTheme();

  useEffect(() => {
    document.body.style.background = theme.base;
    document.body.style.fontFamily = "'Noto Sans', sans-serif";
  }, [theme.base]);

  return (
    <>
      <div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}>
        <Turnstile siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY} onSuccess={initSession} />
      </div>
      <Routes>
        {/* Landing shell — persistent MY DECK + POD tabs */}
        <Route path="/" element={<PersistentShell />} />

        {/* Host watches the session */}
        <Route path="/host/:sessionId" element={<HostPage />} />

        {/* Players join via QR or code */}
        <Route path="/join/:sessionId" element={<JoinPage />} />

        {/* Event sign-up: many pods filling by arrival */}
        <Route path="/event/new" element={<EventHostSetup />} />
        <Route path="/event/:code" element={<EventPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
