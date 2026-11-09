import { useEffect, useState } from "react";
import {
  Plus, Pencil, Trash2, X, ListChecks, AlertTriangle, Star, CheckCircle2,
} from "lucide-react";
import api from "./api";

const todayStr = () => new Date().toLocaleDateString("en-CA");
const emptyForm = () => ({
  title: "", notes: "", due_date: todayStr(), priority: "Normal", client_id: "",
});

function daysFromToday(s) {
  const d = new Date(s + "T00:00:00");
  const t = new Date(todayStr() + "T00:00:00");
  return Math.round((d - t) / 86400000);
}

function fmtDate(s) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("Today");
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));

  async function load() {
    try {
      const [t, c] = await Promise.all([api.get("/api/tasks/"), api.get("/api/clients/")]);
      setTasks(t.data);
      setClients(c.data);
      setError("");
      window.dispatchEvent(new Event("gst:data-changed"));
    } catch {
      setError("Could not load tasks. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const t0 = todayStr();
  const open = tasks.filter((t) => !t.is_done);
  const todays = open.filter((t) => t.due_date <= t0);
  const upcoming = open.filter((t) => t.due_date > t0);
  const done = tasks.filter((t) => t.is_done);
  const overdue = open.filter((t) => t.due_date < t0);
  const important = open.filter((t) => t.priority === "High");

  const byPriority = (a, b) =>
    (a.priority === "High" ? 0 : 1) - (b.priority === "High" ? 0 : 1) ||
    a.due_date.localeCompare(b.due_date);

  const lists = {
    Today: [...todays].sort(byPriority),
    Upcoming: [...upcoming].sort((a, b) => a.due_date.localeCompare(b.due_date)),
    Done: [...done].sort((a, b) => b.due_date.localeCompare(a.due_date)),
  };
  const shown = lists[tab];

  const cards = [
    { label: "Due today", value: todays.length - overdue.length, note: "Plan for today", icon: ListChecks, tone: "blue", card: "" },
    { label: "Overdue", value: overdue.length, note: "Past the date", icon: AlertTriangle, tone: "red", card: "c-red" },
    { label: "Important", value: important.length, note: "High priority, not done", icon: Star, tone: "orange", card: "c-gold" },
    { label: "Done", value: done.length, note: "Completed tasks", icon: CheckCircle2, tone: "green", card: "c-green" },
  ];

  function openNew() {
    setEditId(null);
    setError("");
    setForm(emptyForm());
  }

  function openEdit(t) {
    setEditId(t.id);
    setError("");
    setForm({
      title: t.title, notes: t.notes || "", due_date: t.due_date,
      priority: t.priority, client_id: t.client_id ? String(t.client_id) : "",
    });
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    const body = {
      title: form.title.trim(),
      notes: form.notes.trim() || null,
      due_date: form.due_date,
      priority: form.priority,
      client_id: form.client_id ? Number(form.client_id) : null,
    };
    try {
      if (editId) await api.put(`/api/tasks/${editId}`, body);
      else await api.post("/api/tasks/", body);
      setForm(null);
      load();
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(typeof d === "string" ? d : "Please check the details.");
    }
  }

  async function toggle(t) {
    try {
      await api.patch(`/api/tasks/${t.id}/done`, { done: !t.is_done });
      load();
    } catch {
      setError("Could not update the task.");
    }
  }

  async function remove(t) {
    if (!window.confirm(`Delete "${t.title}"?`)) return;
    try {
      await api.delete(`/api/tasks/${t.id}`);
      load();
    } catch {
      setError("Could not delete the task.");
    }
  }

  return (
    <main className="main-content">
      <header className="topbar">
        <div>
          <span className="crumb">Workspace / Tasks</span>
          <h1>Tasks</h1>
          <p>Your daily to-do list. Tick a task when it is done.</p>
        </div>
        <div className="topbar-actions">
          <button className="primary-btn" onClick={openNew}><Plus size={18} /> Add task</button>
        </div>
      </header>

      <section className="stats-grid">
        {cards.map(({ label, value, note, icon: Icon, tone, card }) => (
          <article className={`stat-card ${card}`} key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <div className={`stat-icon ${tone}`}><Icon /></div>
            </div>
            <strong>{loading ? "…" : Math.max(value, 0)}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="tabs">
          {Object.keys(lists).map((k) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              {k} ({lists[k].length})
            </button>
          ))}
        </div>

        {error && !form && <div className="login-error" role="alert" style={{ marginTop: 14 }}>{error}</div>}

        {loading ? (
          <p className="task-empty">Loading tasks...</p>
        ) : shown.length === 0 ? (
          <p className="task-empty">
            {tab === "Today" ? "Nothing pending for today." : tab === "Upcoming" ? "No upcoming tasks." : "No completed tasks yet."}
          </p>
        ) : (
          <ul className="dx-list">
            {shown.map((t) => {
              const late = !t.is_done && t.due_date < t0;
              const n = daysFromToday(t.due_date);
              return (
                <li
                  key={t.id}
                  className={`dx-row ${t.priority === "High" && !t.is_done ? "high" : ""} ${late ? "late" : ""} ${t.is_done ? "done" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="dx-check"
                    checked={t.is_done}
                    title={t.is_done ? "Mark as not done" : "Mark as done"}
                    onChange={() => toggle(t)}
                  />
                  <div className="dx-body">
                    <strong>{t.title}</strong>
                    <small>
                      {fmtDate(t.due_date)}{t.client_name ? ` · ${t.client_name}` : ""}
                      {late ? ` · ${-n} day${-n === 1 ? "" : "s"} overdue` : n === 0 && !t.is_done ? " · Today" : ""}
                    </small>
                  </div>
                  {t.priority === "High" && !t.is_done && <span className="chip chip-amber">Important</span>}
                  {late && <span className="chip chip-red">Overdue</span>}
                  <div className="dx-actions">
                    <button className="icon-btn sm" title="Edit" onClick={() => openEdit(t)}><Pencil size={15} /></button>
                    <button className="icon-btn sm" title="Delete" onClick={() => remove(t)}><Trash2 size={15} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {form && (
        <div className="modal-backdrop" onClick={() => setForm(null)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <h2>{editId ? "Edit task" : "Add task"}</h2>
              <button className="icon-btn" onClick={() => setForm(null)} title="Close"><X /></button>
            </div>
            <form onSubmit={save}>
              <div className="form-grid">
                <label className="full-width">Task *
                  <input required autoFocus value={form.title} onChange={(e) => set("title", e.target.value)} />
                </label>
                <label>Date *
                  <input required type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
                </label>
                <label>Priority
                  <select value={form.priority} onChange={(e) => set("priority", e.target.value)}>
                    <option value="Normal">Normal</option>
                    <option value="High">High (important)</option>
                  </select>
                </label>
                <label className="full-width">Client (optional)
                  <select value={form.client_id} onChange={(e) => set("client_id", e.target.value)}>
                    <option value="">No client</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.client_name}</option>)}
                  </select>
                </label>
                <label className="full-width">Notes
                  <textarea rows="2" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
                </label>
              </div>
              {error && <div className="login-error" role="alert" style={{ marginTop: 16 }}>{error}</div>}
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setForm(null)}>Cancel</button>
                <button type="submit" className="primary-btn">Save</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}