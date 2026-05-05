import { Routes, Route, Navigate } from "react-router-dom";
import HostPage        from "./pages/HostPage.jsx";
import JoinPage        from "./pages/JoinPage.jsx";
import PersistentShell from "./components/PersistentShell.jsx";

export default function App() {
  return (
    <Routes>
      {/* Landing shell — persistent MY DECK + POD tabs */}
      <Route path="/" element={<PersistentShell />} />

      {/* Host watches the session */}
      <Route path="/host/:sessionId" element={<HostPage />} />

      {/* Players join via QR or code */}
      <Route path="/join/:sessionId" element={<JoinPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
