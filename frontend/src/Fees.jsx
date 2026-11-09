import { useEffect, useState } from "react";
import {
  Plus, Pencil, Trash2, X, IndianRupee, AlertTriangle, CalendarClock, CheckCircle2, Search,
} from "lucide-react";
import api from "./api";

const empty = { client_id: "", purpose: "", amount: "", due_date: "", expected_date: "", reference_person: "", notes: "" };
const inr = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const todayStr = () => new Date().toLocaleDateString("en-CA");
const fmt = (s) => s ? new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const daysFrom = (s) => Math.round((new Date(s + "T00:00:00") - new Date(todayStr() + "T00:00:00")) / 86400000);

function dueText(f) {
  if (f.status === "Paid") return { text: f.paid_date ? `Paid on ${fmt(f.paid_date)}` : "Paid", cls: "" };
  const d = daysFrom(f.due_date);
  if (d < 0) return { text: `${-d} day${d === -1 ? "" : "s"} overdue`, cls: "late" };
  if (d === 0) return { text: "Due today", cls: "soon" };
  if (d <= 7) return { text: `Due in ${d} day${d === 1 ? "" : "s"}`, cls: "soon" };
  return { text: `Due in ${d} days`, cls: "" };
}

export default function Fees() {
  const [fees, setFees] = useState([]);
  const [clients, setClients] = useState([]);
  const [tab, setTab] = useState("Pending");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));

  async function load() {
    const [f, c] = await Promise.all([api.get("/api/fees/"), api.get("/api/clients/")]);
    setFees(f.data); setClients(c.data); setLoading(false);
  }
  useEffect(() => { load().catch(() => { setError("Could not load fees."); setLoading(false); }); }, []);

  const pending = fees.filter((f) => f.status === "Pending");
  const paid = fees.filter((f) => f.status === "Paid");
  const overdue = pending.filter((f) => daysFrom(f.due_date) < 0);
  const soon = pending.filter((f) => { const d = daysFrom(f.due_date); return d >= 0 && d <= 7; });
  const sum = (list) => list.reduce((s, f) => s + f.amount, 0);

  const q = search.toLowerCase();
  const shown = fees
    .filter((f) => tab === "All" || f.status === tab)
    .filter((f) => [f.client_name, f.purpose, f.reference_person].some((v) => (v || "").toLowerCase().includes(q)));

  const cards = [
    { label: "Pending amount", value: inr(sum(pending)), note: `${pending.length} payment${pending.length === 1 ? "" : "s"} pending`, icon: IndianRupee, tone: "blue", card: "" },
    { label: "Overdue", value: overdue.length, note: overdue.length ? inr(sum(overdue)) + " past due date" : "Nothing overdue", icon: AlertTriangle, tone: "orange", card: "c-gold", red: overdue.length > 0 },
    { label: "Due this week", value: soon.length, note: soon.length ? inr(sum(soon)) + " to collect" : "Nothing due soon", icon: CalendarClock, tone: "violet", card: "c-violet" },
    { label: "Collected", value: inr(sum(paid)), note: `${paid.length} payment${paid.length === 1 ? "" : "s"} received`, icon: CheckCircle2, tone: "green", card: "c-green" },
  ];

  function openNew() { setEditId(null); setForm(empty); setError(""); }
  function openEdit(f) {
    setEditId(f.id); setError("");
    setForm({ client_id: String(f.client_id), purpose: f.purpose, amount: String(f.amount), due_date: f.due_date,
              expected_date: f.expected_date || "", reference_person: f.reference_person || "", notes: f.notes || "" });
  }

  async function save(e) {
    e.preventDefault(); setError("");
    const body = {
      client_id: Number(form.client_id), purpose: form.purpose.trim(), amount: Number(form.amount),
      due_date: form.due_date, expected_date: form.expected_date || null,
      reference_person: form.reference_person.trim() || null, notes: form.notes.trim() || null,
    };
    try {
      if (editId) await api.put(`/api/fees/${editId}`, body); else await api.post("/api/fees/", body);
      setForm(null); await load();
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(typeof d === "string" ? d : "Please check the details.");
    }
  }
  async function toggle(f) { await api.patch(`/api/fees/${f.id}/paid`, { paid: f.status !== "Paid" }); load(); }
  async function remove(f) {
    if (window.confirm(`Delete this fee for ${f.client_name}?`)) { await api.delete(`/api/fees/${f.id}`); load(); }
  }

  return (
    <main className="main-content">
      <header className="topbar">
        <div>
          <span className="crumb">Workspace / Fees</span>
          <h1>Fees collection</h1>
          <p>Track what each client owes and tick a payment when it is received.</p>
        </div>
        <div className="topbar-actions">
          <button className="primary-btn" onClick={openNew}><Plus size={18} /> Add fee</button>
        </div>
      </header>

      <section className="stats-grid">
        {cards.map(({ label, value, note, icon: Icon, tone, card, red }) => (
          <article className={`stat-card ${card}`} key={label}>
            <div className="stat-top"><span>{label}</span><div className={`stat-icon ${tone}`}><Icon /></div></div>
            <strong style={red ? { color: "#b91c1c" } : {}}>{loading ? "…" : value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-tools">
          <div className="tabs">
            {[["Pending", pending.length], ["Paid", paid.length], ["All", fees.length]].map(([t, n]) => (
              <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t} ({n})</button>
            ))}
          </div>
          <div className="search-box">
            <Search size={18} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client, purpose or contact..." />
          </div>
        </div>

        {error && !form && <p role="alert">{error}</p>}

        {!loading && shown.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><IndianRupee size={26} /></div>
            <h3>{fees.length === 0 ? "No fees yet" : "Nothing here"}</h3>
            <p>{fees.length === 0 ? "Add the first fee to start tracking payments." : "Try another tab or search."}</p>
            {fees.length === 0 && <button className="primary-btn" onClick={openNew}><Plus size={18} /> Add fee</button>}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Paid</th><th>Client</th><th>Purpose</th><th>Amount</th><th>Due date</th><th>Expected</th><th>Contact</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {shown.map((f) => {
                  const due = dueText(f);
                  const late = f.status === "Pending" && daysFrom(f.due_date) < 0;
                  return (
                    <tr key={f.id} className={late ? "row-late" : f.status === "Paid" ? "row-paid" : ""}>
                      <td><input type="checkbox" className="task-check" checked={f.status === "Paid"} onChange={() => toggle(f)} title="Mark as paid" /></td>
                      <td>
                        <div className="person">
                          <div className={`avatar av-${f.client_id % 5}`}>{(f.client_name || "?").charAt(0).toUpperCase()}</div>
                          <strong>{f.client_name}</strong>
                        </div>
                      </td>
                      <td>{f.purpose}</td>
                      <td className="money">{inr(f.amount)}</td>
                      <td>{fmt(f.due_date)}<span className={`due-note ${due.cls}`}>{due.text}</span></td>
                      <td>{fmt(f.expected_date)}</td>
                      <td>{f.reference_person || "—"}</td>
                      <td>
                        <div className="row-actions">
                          <button className="icon-btn sm" title="Edit" onClick={() => openEdit(f)}><Pencil size={15} /></button>
                          <button className="icon-btn sm" title="Delete" onClick={() => remove(f)}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {shown.length > 0 && <p className="table-footer">Showing {shown.length} of {fees.length} fees</p>}
      </section>

      {form && (
        <div className="modal-backdrop" onClick={() => setForm(null)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <h2>{editId ? "Edit fee" : "Add fee"}</h2>
                <p>Enter what the client owes and when it is due.</p>
              </div>
              <button className="icon-btn" onClick={() => setForm(null)}><X /></button>
            </div>
            <form onSubmit={save}>
              <div className="form-grid">
                <label className="full-width">Client *
                  <select required value={form.client_id} onChange={(e) => set("client_id", e.target.value)}>
                    <option value="">Select a client</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.client_name}{c.business_name ? ` (${c.business_name})` : ""}</option>)}
                  </select></label>
                <label className="full-width">Purpose / service *
                  <input required value={form.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="e.g. GSTR-3B filing, March" /></label>
                <label>Amount (₹) *
                  <input required type="number" min="1" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} /></label>
                <label>Reference person
                  <input value={form.reference_person} onChange={(e) => set("reference_person", e.target.value)} /></label>
                <label>Due date *
                  <input required type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} /></label>
                <label>Expected payment date
                  <input type="date" value={form.expected_date} onChange={(e) => set("expected_date", e.target.value)} /></label>
                <label className="full-width">Notes
                  <textarea rows="2" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></label>
              </div>
              {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
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