import { useEffect, useState } from "react";
import {
  Plus, Pencil, Trash2, X, RefreshCw, CheckCircle2, AlertCircle,
  ListChecks, Clock, AlertTriangle, CalendarDays,
} from "lucide-react";
import api from "./api";
import { useAuth } from "./authContext";

const RETURN_TYPES = ["GSTR-1", "GSTR-3B", "GSTR-9", "GSTR-9C", "CMP-08"];
const DUE_DAY = { "GSTR-1": 11, "GSTR-3B": 20 };

const emptyForm = {
  client_id: "", return_type: "GSTR-3B", period: "", due_date: "",
  filed_date: "", status: "Pending", arn: "", notes: "",
};

function todayStr() {
  return new Date().toLocaleDateString("en-CA");
}

function suggestDue(returnType, period) {
  const day = DUE_DAY[returnType];
  if (!day || !period) return "";
  let [y, m] = period.split("-").map(Number);
  m += 1;
  if (m > 12) { m = 1; y += 1; }
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fmtDate(s) {
  if (!s) return "—";
  return new Date(s + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtPeriod(p) {
  return new Date(p + "-01T00:00:00").toLocaleDateString("en-IN", {
    month: "short", year: "numeric",
  });
}

function daysFromToday(s) {
  const d = new Date(s + "T00:00:00");
  const t = new Date(todayStr() + "T00:00:00");
  return Math.round((d - t) / 86400000);
}

function getState(f) {
  if (f.status === "Filed") return "Filed";
  return f.due_date < todayStr() ? "Overdue" : "Pending";
}

function dueNote(f) {
  if (f.status === "Filed") return `Filed on ${fmtDate(f.filed_date)}`;
  const n = daysFromToday(f.due_date);
  if (n < 0) return `${-n} day${-n === 1 ? "" : "s"} overdue`;
  if (n === 0) return "Due today";
  return `Due in ${n} day${n === 1 ? "" : "s"}`;
}

const BADGE = {
  Filed: "badge-active",
  Pending: "badge-pending",
  Overdue: "badge-overdue",
};

export default function Filings() {
  const { user } = useAuth();
  const [filings, setFilings] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [dueTouched, setDueTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  function notify(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [f, c] = await Promise.all([
        api.get("/api/filings/"),
        api.get("/api/clients/"),
      ]);
      setFilings(f.data);
      setClients(c.data);
    } catch {
      notify("error", "Unable to load filings. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const clientById = (id) => clients.find((c) => c.id === id);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setDueTouched(false);
    setShowForm(true);
  }

  function openEdit(f) {
    setEditingId(f.id);
    setForm({
      client_id: String(f.client_id),
      return_type: f.return_type,
      period: f.period,
      due_date: f.due_date,
      filed_date: f.filed_date || "",
      status: f.status,
      arn: f.arn || "",
      notes: f.notes || "",
    });
    setDueTouched(true);
    setShowForm(true);
  }

  function updateForm(changes) {
    const next = { ...form, ...changes };
    if (!dueTouched && ("return_type" in changes || "period" in changes)) {
      const s = suggestDue(next.return_type, next.period);
      if (s) next.due_date = s;
    }
    if ("status" in changes) {
      if (changes.status === "Filed" && !next.filed_date) next.filed_date = todayStr();
      if (changes.status === "Pending") next.filed_date = "";
    }
    setForm(next);
  }

  function errorText(err, fallback) {
    const detail = err.response?.data?.detail;
    return typeof detail === "string" ? detail : fallback;
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        client_id: Number(form.client_id),
        return_type: form.return_type,
        period: form.period,
        due_date: form.due_date,
        filed_date: form.status === "Filed" ? form.filed_date || null : null,
        status: form.status,
        arn: form.arn.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        await api.put(`/api/filings/${editingId}`, payload);
      } else {
        await api.post("/api/filings/", payload);
      }
      notify("success", editingId ? "Filing updated." : "Filing added.");
      setShowForm(false);
      setEditingId(null);
      await loadData();
    } catch (err) {
      notify("error", errorText(err, "Could not save the filing. Please check the details."));
    } finally {
      setSaving(false);
    }
  }

  async function markFiled(f) {
    try {
      await api.put(`/api/filings/${f.id}`, {
        client_id: f.client_id,
        return_type: f.return_type,
        period: f.period,
        due_date: f.due_date,
        filed_date: todayStr(),
        status: "Filed",
        arn: f.arn,
        notes: f.notes,
      });
      notify("success", "Marked as filed.");
      await loadData();
    } catch (err) {
      notify("error", errorText(err, "Could not update the filing."));
    }
  }

  async function removeFiling(f) {
    if (!window.confirm("Delete this filing? This cannot be undone.")) return;
    try {
      await api.delete(`/api/filings/${f.id}`);
      notify("success", "Filing deleted.");
      await loadData();
    } catch (err) {
      notify("error", errorText(err, "Could not delete the filing."));
    }
  }

  const counts = {
    total: filings.length,
    pending: filings.filter((f) => getState(f) === "Pending").length,
    overdue: filings.filter((f) => getState(f) === "Overdue").length,
    filed: filings.filter((f) => getState(f) === "Filed").length,
  };

  const visible = filings.filter((f) => {
    if (statusFilter !== "all" && getState(f) !== statusFilter) return false;
    if (typeFilter !== "all" && f.return_type !== typeFilter) return false;
    if (clientFilter !== "all" && String(f.client_id) !== clientFilter) return false;
    if (periodFilter && f.period !== periodFilter) return false;
    return true;
  });

  const statCards = [
    { label: "Total filings", value: counts.total, note: "All returns tracked", icon: ListChecks, tone: "blue", card: "" },
    { label: "Pending", value: counts.pending, note: "Waiting to be filed", icon: Clock, tone: "orange", card: "c-gold" },
    { label: "Overdue", value: counts.overdue, note: "Past the due date", icon: AlertTriangle, tone: "red", card: "c-red" },
    { label: "Filed", value: counts.filed, note: "Completed returns", icon: CheckCircle2, tone: "green", card: "c-green" },
  ];

  return (
    <main className="main-content">
      <header className="topbar">
        <div>
          <span className="crumb">Workspace / GST filings</span>
          <h1>GST filings</h1>
          <p>Track every return, its due date and its filing status.</p>
        </div>
        <div className="topbar-actions">
          <button className="primary-btn" onClick={openAdd}>
            <Plus size={18} /> Add filing
          </button>
        </div>
      </header>

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

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>All filings</h2>
            <p>Filter by client, status, return type or period.</p>
          </div>
          <button className="icon-btn" onClick={loadData} title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="toolbar">
          <select className="filter-select" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
            <option value="all">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.client_name}</option>
            ))}
          </select>
          <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All status</option>
            <option value="Pending">Pending</option>
            <option value="Overdue">Overdue</option>
            <option value="Filed">Filed</option>
          </select>
          <select className="filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All returns</option>
            {RETURN_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="month"
            className="filter-select"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            title="Filing period"
          />
          {(clientFilter !== "all" || statusFilter !== "all" || typeFilter !== "all" || periodFilter) && (
            <button
              className="secondary-btn"
              onClick={() => {
                setClientFilter("all"); setStatusFilter("all");
                setTypeFilter("all"); setPeriodFilter("");
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="table-wrap">
            {[0, 1, 2].map((i) => (
              <div className="skeleton-row" key={i}>
                <div className="sk circle" />
                <div className="sk" style={{ width: "22%" }} />
                <div className="sk" style={{ width: "26%" }} />
                <div className="sk" style={{ width: "16%" }} />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><CalendarDays size={26} /></div>
            <h3>{filings.length === 0 ? "No filings yet" : "No matching filings"}</h3>
            <p>
              {filings.length === 0
                ? "Add a filing to start tracking due dates for your clients."
                : "Try changing or clearing the filters."}
            </p>
            {filings.length === 0 && (
              <button className="primary-btn" onClick={openAdd}>
                <Plus size={18} /> Add filing
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Client</th><th>Return</th><th>Period</th>
                    <th>Due date</th><th>Status</th><th>ARN</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((f) => {
                    const c = clientById(f.client_id);
                    const state = getState(f);
                    return (
                      <tr key={f.id}>
                        <td>
                          <div className="client-cell">
                            <div className={`avatar av-${f.client_id % 5}`}>
                              {(c?.client_name || "?").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <strong>{c?.client_name || "Unknown client"}</strong>
                              <small>{c?.business_name || "—"}</small>
                            </div>
                          </div>
                        </td>
                        <td><strong>{f.return_type}</strong></td>
                        <td>{fmtPeriod(f.period)}</td>
                        <td>
                          {fmtDate(f.due_date)}
                          <small>{dueNote(f)}</small>
                        </td>
                        <td><span className={`badge ${BADGE[state]}`}>{state}</span></td>
                        <td className="mono">{f.arn || "—"}</td>
                        <td>
                          <div className="row-actions">
                            {state !== "Filed" && (
                              <button className="icon-btn sm" title="Mark as filed" onClick={() => markFiled(f)}>
                                <CheckCircle2 size={15} />
                              </button>
                            )}
                            <button className="icon-btn sm" title="Edit" onClick={() => openEdit(f)}>
                              <Pencil size={15} />
                            </button>
                            {user.role === "Admin" && (
                              <button className="icon-btn sm" title="Delete" onClick={() => removeFiling(f)}>
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="table-footer">
              Showing {visible.length} of {filings.length} filings
            </p>
          </>
        )}
      </section>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <h2>{editingId ? "Edit filing" : "Add new filing"}</h2>
                <p>The due date fills in for GSTR-1 and GSTR-3B. You can change it.</p>
              </div>
              <button className="icon-btn" onClick={() => setShowForm(false)} title="Close"><X /></button>
            </div>
            <form onSubmit={save}>
              <div className="form-grid">
                <label className="full-width">
                  Client *
                  <select
                    required
                    value={form.client_id}
                    onChange={(e) => updateForm({ client_id: e.target.value })}
                  >
                    <option value="">Select a client</option>
                    {clients.filter((c) => c.is_active || String(c.id) === form.client_id).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.client_name}{c.business_name ? ` (${c.business_name})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Return type *
                  <select
                    value={form.return_type}
                    onChange={(e) => updateForm({ return_type: e.target.value })}
                  >
                    {RETURN_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Period *
                  <input
                    type="month"
                    required
                    value={form.period}
                    onChange={(e) => updateForm({ period: e.target.value })}
                  />
                </label>
                <label>
                  Due date *
                  <input
                    type="date"
                    required
                    value={form.due_date}
                    onChange={(e) => { setDueTouched(true); updateForm({ due_date: e.target.value }); }}
                  />
                </label>
                <label>
                  Status
                  <select value={form.status} onChange={(e) => updateForm({ status: e.target.value })}>
                    <option value="Pending">Pending</option>
                    <option value="Filed">Filed</option>
                  </select>
                </label>
                {form.status === "Filed" && (
                  <>
                    <label>
                      Filed date *
                      <input
                        type="date"
                        required
                        value={form.filed_date}
                        onChange={(e) => updateForm({ filed_date: e.target.value })}
                      />
                    </label>
                    <label>
                      ARN (acknowledgement no.)
                      <input value={form.arn} onChange={(e) => updateForm({ arn: e.target.value })} />
                    </label>
                  </>
                )}
                <label className="full-width">
                  Notes
                  <textarea rows="3" value={form.notes} onChange={(e) => updateForm({ notes: e.target.value })} />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Update filing" : "Save filing"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type}`} role="status">
          {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}
    </main>
  );
}