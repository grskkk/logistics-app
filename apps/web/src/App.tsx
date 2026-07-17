import { useEffect, useState } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Fleet from "./pages/Fleet";
import VehicleDetail from "./pages/VehicleDetail";
import Login from "./pages/Login";
import NotificationPanel from "./components/NotificationPanel";
import { api, AUTH_EVENT } from "./api/client";
import { applyTheme, getCurrentTheme, type Theme } from "./theme";

const linkStyle = { color: "#A8A29E", textDecoration: "none", fontWeight: 500, fontSize: 14, padding: "6px 12px", borderRadius: 6 };
const activeStyle = { color: "#FFFFFF", background: "rgba(217,119,87,0.2)" };

export default function App() {
  const [theme, setTheme] = useState<Theme>(getCurrentTheme);
  // null = still checking; true/false = known auth state.
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    api.me()
      .then((r) => setAuthed(r.authenticated))
      .catch(() => setAuthed(false));
    const onUnauthorized = () => setAuthed(false);
    window.addEventListener(AUTH_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_EVENT, onUnauthorized);
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  };

  const handleLogout = async () => {
    await api.logout();
    setAuthed(false);
  };

  if (authed === null) {
    return <div style={{ minHeight: "100vh", background: "var(--bg)" }} />;
  }
  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
        <nav style={{ display: "flex", alignItems: "center", padding: "0 16px", background: "#1C1917", height: 52, flexShrink: 0 }}>
          <span style={{ color: "#D97757", fontWeight: 800, fontSize: 17, marginRight: 16, letterSpacing: "-0.3px", whiteSpace: "nowrap" }}>Vanakias</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, overflowX: "auto", WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}>
            <NavLink to="/" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? activeStyle : {}), whiteSpace: "nowrap" })} end>Dashboard</NavLink>
            <NavLink to="/fleet" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? activeStyle : {}), whiteSpace: "nowrap" })}>Fleet</NavLink>
          </div>
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
              width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 15, marginRight: 8, flexShrink: 0,
            }}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <NotificationPanel />
          <button
            onClick={handleLogout}
            title="Sign out"
            style={{
              background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
              height: 32, padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 13, color: "#A8A29E", marginLeft: 8, flexShrink: 0, whiteSpace: "nowrap",
            }}
          >
            Sign out
          </button>
        </nav>
        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/fleet" element={<Fleet />} />
            <Route path="/fleet/:id" element={<VehicleDetail />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
