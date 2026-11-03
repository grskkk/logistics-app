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
  appointment_tomorrow: "📅",
};

const DISMISSED_KEY = "logitrack_dismissed_notifications";

function loadDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

type Tab = "replacements" | "appointments";

export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("replacements");
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
  const replacementNotes = notes.filter((n) => n.type === "no_replacement");
  const appointmentNotes = notes.filter((n) => n.type === "appointment_tomorrow");
  const activeNotes = tab === "replacements" ? replacementNotes : appointmentNotes;

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  // Clears only the notifications in the tab currently being viewed.
  const dismissActive = () => {
    setDismissed((prev) => {
      const next = new Set(prev);
      for (const n of activeNotes) next.add(n.id);
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
  const replHigh = replacementNotes.filter((n) => n.severity === "high").length;

  const renderNote = (n: FleetNotification) => (
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
  );

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
            padding: "14px 18px 0", borderBottom: "1px solid var(--border)",
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Fleet Alerts</span>
              {activeNotes.length > 0 && (
                <button
                  onClick={dismissActive}
                  style={{ background: "none", border: "none", color: "var(--text-faint)", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Two tabs: one for replacement alerts, one for tomorrow's appointments. */}
            <div style={{ display: "flex", gap: 4 }}>
              {([
                ["replacements", "Replacements", replacementNotes.length, replHigh > 0],
                ["appointments", "Appointments", appointmentNotes.length, false],
              ] as [Tab, string, number, boolean][]).map(([key, label, n, urgent]) => {
                const isActive = tab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "8px 6px", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit",
                      fontSize: 13, fontWeight: 700,
                      color: isActive ? "var(--text)" : "var(--text-faint)",
                      borderBottom: `2px solid ${isActive ? "#D97757" : "transparent"}`,
                      marginBottom: -1,
                    }}
                  >
                    {label}
                    {n > 0 && (
                      <span style={{
                        background: urgent ? "#DC2626" : isActive ? "#D97757" : "var(--border-strong)",
                        color: "#fff", fontSize: 10, fontWeight: 800,
                        borderRadius: 99, minWidth: 16, height: 16, padding: "0 4px",
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {n}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {activeNotes.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-faint)", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-line" }}>
                {tab === "replacements"
                  ? "No replacement alerts — all covered!"
                  : "No appointments for tomorrow.\nThey appear here from 15:00."}
              </div>
            )}
            {tab === "replacements"
              ? ["high", "medium", "low"].map((sev) => {
                  const group = activeNotes.filter((n) => n.severity === sev);
                  if (!group.length) return null;
                  return (
                    <div key={sev}>
                      <div style={{ padding: "8px 18px 4px", fontSize: 11, fontWeight: 700, color: severityColor[sev], textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {sev === "high" ? "Urgent" : sev === "medium" ? "Warning" : "Info"}
                      </div>
                      {group.map(renderNote)}
                    </div>
                  );
                })
              : activeNotes.map(renderNote)}
          </div>
        </div>
      )}
    </div>
  );
}
