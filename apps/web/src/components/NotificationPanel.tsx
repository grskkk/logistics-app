import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FleetNotification } from "@logistics/shared";
import { api } from "../api/client";

const severityColor: Record<string, string> = {
  high: "#DC2626",
  medium: "#D97706",
  low: "#6B7280",
};

const typeIcon: Record<string, string> = {
  no_replacement: "🔴",
  long_repair: "🟡",
  non_operational: "🔴",
};

const DISMISSED_KEY = "logitrack_dismissed_notifications";

function loadDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [allNotes, setAllNotes] = useState<FleetNotification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<FleetNotification[]>("/notifications").then(setAllNotes).catch(console.error);
    const id = setInterval(() => {
      api.get<FleetNotification[]>("/notifications").then(setAllNotes).catch(console.error);
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const notes = allNotes.filter((n) => !dismissed.has(n.id));

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const dismissAll = () => {
    setDismissed((prev) => {
      const next = new Set(prev);
      for (const n of notes) next.add(n.id);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const openVehicle = (n: FleetNotification) => {
    setOpen(false);
    navigate(`/fleet?plate=${encodeURIComponent(n.licensePlate)}`);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (open && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const high = notes.filter((n) => n.severity === "high").length;
  const count = notes.length;

  return (
    <div ref={panelRef} style={{ position: "relative", marginLeft: "auto" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          position: "relative", padding: "4px 8px", display: "flex", alignItems: "center",
        }}
        title="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ stroke: count > 0 ? "#FBBF24" : "var(--text-faint)" }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span style={{
            position: "absolute", top: 0, right: 2,
            background: high > 0 ? "#DC2626" : "#D97706",
            color: "#fff", fontSize: 10, fontWeight: 800,
            borderRadius: 99, minWidth: 16, height: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px",
          }}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: 380, maxHeight: 520, borderRadius: 12,
          background: "var(--panel)", boxShadow: "var(--shadow-modal)",
          zIndex: 200, display: "flex", flexDirection: "column",
          border: "1px solid var(--border)",
        }}>
          <div style={{
            padding: "14px 18px", borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Fleet Alerts</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                {high > 0 && <span style={{ color: "#DC2626", fontWeight: 700 }}>{high} urgent · </span>}
                {count} total
              </span>
              {count > 0 && (
                <button
                  onClick={dismissAll}
                  style={{ background: "none", border: "none", color: "var(--text-faint)", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {count === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-faint)", fontSize: 14 }}>
                No alerts — fleet looks good!
              </div>
            )}
            {["high", "medium", "low"].map((sev) => {
              const group = notes.filter((n) => n.severity === sev);
              if (!group.length) return null;
              return (
                <div key={sev}>
                  <div style={{ padding: "8px 18px 4px", fontSize: 11, fontWeight: 700, color: severityColor[sev], textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {sev === "high" ? "Urgent" : sev === "medium" ? "Warning" : "Info"}
                  </div>
                  {group.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => openVehicle(n)}
                      style={{
                        padding: "12px 18px", borderBottom: "1px solid var(--border)",
                        display: "flex", gap: 10, alignItems: "flex-start",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{typeIcon[n.type]}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{n.title}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>
                        {n.hub && (
                          <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>Hub: {n.hub}</div>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                        title="Dismiss"
                        style={{
                          background: "none", border: "none", color: "var(--border-strong)", fontSize: 14,
                          cursor: "pointer", padding: 2, flexShrink: 0, lineHeight: 1,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
