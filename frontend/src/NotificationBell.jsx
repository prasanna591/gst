import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCircle2 } from "lucide-react";
import api from "./api";

function note(days) {
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} overdue`;
  if (days === 0) return "Today";
  return `In ${days} day${days === 1 ? "" : "s"}`;
}

function desktopAlert(list) {
  const urgent = list.filter((x) => x.days <= 0);

  if (!urgent.length) return;

  const key = "notified-" + new Date().toLocaleDateString("en-CA");

  if (localStorage.getItem(key)) return;

  if (!("Notification" in window)) {
    console.error("Browser notifications are not supported.");
    return;
  }

  if (Notification.permission !== "granted") {
    console.warn("Notification permission is not granted.");
    return;
  }

  try {
    new Notification("GST Office", {
      body: `${urgent.length} item(s) due today or overdue. Open the bell to see them.`,
      icon: "/favicon.ico"
    });

    localStorage.setItem(key, "1");
  } catch (error) {
    console.error("Desktop notification failed:", error);
  }
}

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  async function load(alert = false) {
    try {
      const r = await api.get("/api/reminders/upcoming");
      setItems(r.data);
      if (alert) desktopAlert(r.data);
    } catch { /* stay quiet if the server is not reachable */ }
  }

  useEffect(() => {
    load(true);
    const id = setInterval(() => load(true), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const overdue = items.filter((x) => x.days < 0).length;

  return (
    <div className="bell-wrap" ref={wrap}>
      <button className="icon-btn bell" title="Notifications"
              onClick={() => { setOpen(!open); if (!open) load(); }}>
        <Bell size={17} />
        {items.length > 0 && (
          <span className={`bell-count ${overdue ? "late" : ""}`}>{items.length > 9 ? "9+" : items.length}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <strong>Reminders</strong>
            <small>{items.length === 0 ? "All clear" : `${overdue} overdue · ${items.length - overdue} coming up`}</small>
          </div>

          {items.length === 0 ? (
            <div className="notif-empty">
              <CheckCircle2 size={22} />
              <p>Nothing overdue and nothing due in the next 7 days.</p>
            </div>
          ) : (
            <ul className="notif-list">
              {items.slice(0, 10).map((x, i) => (
                <li key={i}>
                  <Link to={x.link} onClick={() => setOpen(false)}>
                    <div>
                      <strong>{x.title}</strong>
                      <small>{x.type} · {x.subtitle}</small>
                    </div>
                    <span className={`badge ${x.days < 0 ? "badge-overdue" : "badge-pending"}`}>{note(x.days)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}