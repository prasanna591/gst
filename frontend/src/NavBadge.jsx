import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "./api";

const todayStr = () => new Date().toLocaleDateString("en-CA");

export default function NavBadge({ kind }) {
  const { pathname } = useLocation();
  const [count, setCount] = useState(0);
  const [late, setLate] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const today = todayStr();
        if (kind === "tasks") {
          const res = await api.get("/api/tasks/");
          const due = res.data.filter((t) => !t.is_done && t.due_date <= today);
          if (!cancelled) {
            setCount(due.length);
            setLate(due.some((t) => t.due_date < today));
          }
        } else {
          const res = await api.get("/api/fees/");
          const overdue = res.data.filter(
            (f) => f.status === "Pending" && f.due_date < today
          );
          if (!cancelled) {
            setCount(overdue.length);
            setLate(true);
          }
        }
      } catch {
        if (!cancelled) setCount(0);
      }
    }

    load();
    const id = setInterval(load, 60000);
    window.addEventListener("gst:data-changed", load);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("gst:data-changed", load);
    };
  }, [kind, pathname]);

  if (count === 0) return null;

  return (
    <span
      className={`nav-badge ${late ? "red" : ""}`}
      style={{ color: "#fff", fontSize: "11.5px", fontWeight: 700, lineHeight: 1 }}
      title={kind === "tasks" ? "Tasks due today or overdue" : "Overdue payments"}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}