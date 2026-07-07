import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Fleet from "./pages/Fleet";
import Drivers from "./pages/Drivers";

const linkStyle = { color: "#A8A29E", textDecoration: "none", fontWeight: 500, fontSize: 14, padding: "6px 12px", borderRadius: 6 };
const activeStyle = { color: "#FFFFFF", background: "rgba(217,119,87,0.2)" };

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", background: "#F9F7F4", display: "flex", flexDirection: "column" }}>
        <nav style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 16px", background: "#1C1917", height: 52, flexShrink: 0, overflowX: "auto", WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}>
          <span style={{ color: "#D97757", fontWeight: 800, fontSize: 17, marginRight: 16, letterSpacing: "-0.3px", whiteSpace: "nowrap" }}>LogiTrack</span>
          <NavLink to="/" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? activeStyle : {}), whiteSpace: "nowrap" })} end>Dashboard</NavLink>
          <NavLink to="/fleet" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? activeStyle : {}), whiteSpace: "nowrap" })}>Fleet</NavLink>
          <NavLink to="/drivers" style={({ isActive }) => ({ ...linkStyle, ...(isActive ? activeStyle : {}), whiteSpace: "nowrap" })}>Drivers</NavLink>
        </nav>
        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/fleet" element={<Fleet />} />
            <Route path="/drivers" element={<Drivers />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
