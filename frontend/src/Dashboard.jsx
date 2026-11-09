import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users, UserCheck, Clock, AlertTriangle, CheckCircle2, CalendarDays,
  ListChecks, IndianRupee, Gift, Star,
} from "lucide-react";
import api from "./api";
import { useAuth } from "./authContext";
import NotificationBell from "./NotificationBell";

function todayStr() {
  return new Date().toLocaleDateString("en-CA");
}

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

function fmtPeriod(p) {
  return new Date(p + "-01T00:00:00").toLocaleDateString("en-IN", {
    month: "short", year: "numeric",
  });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [auditors, setAuditors] = useState([]);
  const [filings, setFilings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [fees, setFees] = useState([]);
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  async function loadData() {
    setLoading(true);
    setFailed(false);
    try {
      const [c, a, f, t, fe, d] = await Promise.all([
        api.get("/api/clients/"),
        api.get("/api/auditors/"),
        api.get("/api/filings/"),
        api.get("/api/tasks/").catch(() => ({ data: [] })),
        api.get("/api/fees/").catch(() => ({ data: [] })),
        api.get("/api/reminders/dates").catch(() => ({ data: [] })),
      ]);
      setClients(c.data);
      setAuditors(a.data);
      setFilings(f.data);
      setTasks(t.data);
      setFees(fe.data);
      setDates(d.data);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const today = todayStr();
  const clientById = (id) => clients.find((c) => c.id === id);

  const open = filings.filter((f) => f.status !== "Filed");
  const overdue = open
    .filter((f) => f.due_date < today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const upcoming = open
    .filter((f) => f.due_date >= today && daysFromToday(f.due_date) <= 7)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const pendingCount = open.filter((f) => f.due_date >= today).length;
  const filedCount = filings.filter((f) => f.status === "Filed").length;
  const activeClients = clients.filter((c) => c.is_active).length;

  const inr = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const todayTasks = tasks
    .filter((t) => !t.is_done && t.due_date <= today)
    .sort((a, b) => (a.priority === "High" ? 0 : 1) - (b.priority === "High" ? 0 : 1)
      || a.due_date.localeCompare(b.due_date));
  const pendingFees = fees
    .filter((f) => f.status === "Pending")
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const overdueFees = pendingFees.filter((f) => f.due_date < today);
  const feeTotal = pendingFees.reduce((s, f) => s + f.amount, 0);
  const soonDates = dates.filter((d) => d.days >= 0 && d.days <= 14);

  async function tickTask(t) {
    await api.patch(`/api/tasks/${t.id}/done`, { done: true });
    loadData();
  }
  async function tickFee(f) {
    await api.patch(`/api/fees/${f.id}/paid`, { paid: true });
    loadData();
  }

  const dayCards = [
    { label: "Tasks for today", value: todayTasks.length, note: todayTasks.length ? "Tick them off below" : "All clear", icon: ListChecks, tone: "blue", card: "" },
    { label: "Pending fees", value: inr(feeTotal), note: `${pendingFees.length} payment${pendingFees.length === 1 ? "" : "s"} to collect`, icon: IndianRupee, tone: "orange", card: "c-gold" },
    { label: "Overdue fees", value: overdueFees.length, note: "Past the due date", icon: AlertTriangle, tone: "red", card: "c-red" },
    { label: "Dates in 14 days", value: soonDates.length, note: "Birthdays and reminders", icon: Gift, tone: "violet", card: "c-violet" },
  ];

  const workloadRows = [
    ...auditors.filter((a) => a.is_active).map((a) => ({ key: a.id, name: a.name, id: a.id })),
    { key: "none", name: "Not assigned", id: null },
  ].map((row) => {
    const mine = clients.filter((c) =>
      row.id === null ? !c.auditor_id : c.auditor_id === row.id
    );
    const ids = new Set(mine.map((c) => c.id));
    const myOpen = open.filter((f) => ids.has(f.client_id));
    return {
      ...row,
      clients: mine.length,
      open: myOpen.length,
      overdue: myOpen.filter((f) => f.due_date < today).length,
    };
  }).filter((r) => r.id !== null || r.clients > 0);

  const maxOpen = Math.max(1, ...workloadRows.map((r) => r.open));

  const statCards = [
    { label: "Total clients", value: clients.length, note: `${activeClients} active`, icon: Users, tone: "blue", card: "" },
    { label: "Pending filings", value: pendingCount, note: "Not yet due or due soon", icon: Clock, tone: "orange", card: "c-gold" },
    { label: "Overdue filings", value: overdue.length, note: "Need action now", icon: AlertTriangle, tone: "red", card: "c-red" },
    { label: "Filed", value: filedCount, note: "Completed returns", icon: CheckCircle2, tone: "green", card: "c-green" },
  ];

  function TaskList({ items, emptyText, late }) {
    if (items.length === 0) {
      return <p className="task-empty">{emptyText}</p>;
    }
    return (
      <ul className="task-list">
        {items.slice(0, 6).map((f) => {
          const c = clientById(f.client_id);
          const n = daysFromToday(f.due_date);
          const note = late
            ? `${-n} day${-n === 1 ? "" : "s"} overdue`
            : n === 0 ? "Due today" : `Due in ${n} day${n === 1 ? "" : "s"}`;
          return (
            <li className="task-item" key={f.id}>
              <div>
                <strong>{c?.client_name || "Unknown client"}</strong>
                <small>{f.return_type} · {fmtPeriod(f.period)} · {fmtDate(f.due_date)}</small>
              </div>
              <span className={`badge ${late ? "badge-overdue" : "badge-pending"}`}>{note}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <main className="main-content">
      <header className="topbar">
        <div>
          <span className="crumb">Workspace / Dashboard</span>
          <h1>{greeting()}, {user.full_name.split(" ")[0]}</h1>
          <p>Here is what needs your attention today.</p>
        </div>
        <div className="topbar-actions">
          <span className="date-chip">
            <CalendarDays size={15} />
            {new Date().toLocaleDateString("en-IN", {
              weekday: "short", day: "numeric", month: "short", year: "numeric",
            })}
          </span>
          <NotificationBell />
          <Link className="primary-btn" to="/filings">View all filings</Link>
        </div>
      </header>

      {failed && (
        <div className="empty-state" style={{ marginBottom: 24 }}>
          <h3>Could not load the dashboard</h3>
          <p>Check that the backend is running, then try again.</p>
          <button className="primary-btn" onClick={loadData}>Try again</button>
        </div>
      )}

      <section className="stats-grid">
        {statCards.map(({ label, value, note, icon: Icon, tone, card }) => (
          <article className={`stat-card ${card}`} key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <div className={`stat-icon ${tone}`}><Icon /></div>
            </div>
            <strong>{loading ? "…" : value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>

      <section className="stats-grid">
        {dayCards.map(({ label, value, note, icon: Icon, tone, card }) => (
          <article className={`stat-card ${card}`} key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <div className={`stat-icon ${tone}`}><Icon /></div>
            </div>
            <strong>{loading ? "…" : value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>

      <section className="dash-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Today's tasks</h2>
              <p>Due today or overdue. Important ones first.</p>
            </div>
            <Link className="secondary-btn" to="/tasks">All tasks</Link>
          </div>
          {todayTasks.length === 0 ? (
            <p className="task-empty">Nothing pending for today.</p>
          ) : (
            <ul className="dx-list">
              {todayTasks.slice(0, 6).map((t) => (
                <li key={t.id} className={`dx-row ${t.priority === "High" ? "high" : ""} ${t.due_date < today ? "late" : ""}`}>
                  <input type="checkbox" className="dx-check" title="Mark as done" onChange={() => tickTask(t)} />
                  <div className="dx-body">
                    <strong>{t.title}</strong>
                    <small>{t.client_name || "General"}{t.due_date < today ? ` · ${-daysFromToday(t.due_date)} day(s) overdue` : " · Today"}</small>
                  </div>
                  {t.priority === "High" && <span className="chip chip-amber"><Star size={11} /> Important</span>}
                </li>
              ))}
            </ul>
          )}
          {todayTasks.length > 6 && <Link className="see-all" to="/tasks">See all {todayTasks.length} tasks</Link>}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Pending payments</h2>
              <p>Fees waiting to be collected. Tick when received.</p>
            </div>
            <Link className="secondary-btn" to="/fees">All fees</Link>
          </div>
          {pendingFees.length === 0 ? (
            <p className="task-empty">No pending payments.</p>
          ) : (
            <ul className="dx-list">
              {pendingFees.slice(0, 6).map((f) => {
                const n = daysFromToday(f.due_date);
                return (
                  <li key={f.id} className={`dx-row ${n < 0 ? "late" : ""}`}>
                    <input type="checkbox" className="dx-check" title="Mark as paid" onChange={() => tickFee(f)} />
                    <div className="dx-body">
                      <strong>{f.client_name}</strong>
                      <small>{f.purpose} · {n < 0 ? `${-n} day(s) overdue` : n === 0 ? "Due today" : `Due in ${n} day(s)`}</small>
                    </div>
                    <span className="money">{inr(f.amount)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {pendingFees.length > 6 && <Link className="see-all" to="/fees">See all {pendingFees.length} payments</Link>}
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-heading">
          <div>
            <h2>Coming up</h2>
            <p>Birthdays, registration dates, anniversaries and reminders in the next 14 days.</p>
          </div>
          <Link className="secondary-btn" to="/dates">All dates</Link>
        </div>
        {soonDates.length === 0 ? (
          <p className="task-empty">No important dates in the next 14 days.</p>
        ) : (
          <ul className="dx-list">
            {soonDates.slice(0, 6).map((d) => (
              <li key={d.key} className="dx-row">
                <div className="dx-body">
                  <strong>{d.title}</strong>
                  <small>{d.kind}{d.client_name ? ` · ${d.client_name}` : ""} · {fmtDate(d.date)}</small>
                </div>
                <span className={`badge ${d.days <= 1 ? "badge-overdue" : "badge-pending"}`}>
                  {d.days === 0 ? "Today" : d.days === 1 ? "Tomorrow" : `In ${d.days} days`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dash-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Overdue filings</h2>
              <p>Past the due date and not yet filed.</p>
            </div>
          </div>
          {loading ? (
            <p className="task-empty">Loading...</p>
          ) : (
            <TaskList items={overdue} late emptyText="No overdue filings. Great work." />
          )}
          {overdue.length > 6 && (
            <Link className="see-all" to="/filings">See all {overdue.length} overdue filings</Link>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Due in the next 7 days</h2>
              <p>Plan these filings first.</p>
            </div>
          </div>
          {loading ? (
            <p className="task-empty">Loading...</p>
          ) : (
            <TaskList items={upcoming} emptyText="Nothing is due in the next 7 days." />
          )}
          {upcoming.length > 6 && (
            <Link className="see-all" to="/filings">See all {upcoming.length} upcoming filings</Link>
          )}
        </div>
      </section>

      <section className="panel" style={{ marginTop: 24 }}>
        <div className="panel-heading">
          <div>
            <h2>Workload by auditor</h2>
            <p>Open filings (pending and overdue) for each auditor's clients.</p>
          </div>
          <Link className="secondary-btn" to="/auditors"><UserCheck size={16} /> Auditors</Link>
        </div>

        {!loading && workloadRows.length === 0 ? (
          <p className="task-empty">Add an auditor and assign clients to see their workload.</p>
        ) : (
          <div className="workload">
            {workloadRows.map((r) => (
              <div className="workload-row" key={r.key}>
                <div className="workload-name">
                  <strong>{r.name}</strong>
                  <small>{r.clients} client{r.clients === 1 ? "" : "s"}</small>
                </div>
                <div className="workload-bar">
                  <div
                    className="workload-fill"
                    style={{ width: `${(r.open / maxOpen) * 100}%` }}
                  />
                </div>
                <div className="workload-num">
                  <strong>{r.open}</strong> open
                  {r.overdue > 0 && <span className="workload-late"> · {r.overdue} overdue</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}