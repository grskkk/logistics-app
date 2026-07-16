import { useState } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Fleet from "./pages/Fleet";
import VehicleDetail from "./pages/VehicleDetail";
import NotificationPanel from "./components/NotificationPanel";
import { applyTheme, getCurrentTheme, type Theme } from "./theme";

const linkStyle = { color: "#A8A29E", textDecoration: "none", fontWeight: 500, fontSize: 14, padding: "6px 12px", borderRadius: 6 };
const activeStyle = { color: "#FFFFFF", background: "rgba(217,119,87,0.2)" };

export default function App() {
  const [theme, setTheme] = useState<Theme>(getCurrentTheme);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  };

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
