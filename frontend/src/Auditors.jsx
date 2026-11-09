import { useEffect, useState } from "react";
import {
  Plus, Search, Pencil, X, RefreshCw, UserCheck, CheckCircle2, AlertCircle,
} from "lucide-react";
import api from "./api";

const emptyForm = {
  name: "", firm_name: "", qualification: "", membership_no: "",
  phone: "", email: "", notes: "", is_active: true,
};

export default function Auditors() {
  const [auditors, setAuditors] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  function notify(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [a, c] = await Promise.all([
        api.get("/api/auditors/"),
        api.get("/api/clients/"),
      ]);
      setAuditors(a.data);
      setClients(c.data);
    } catch {
      notify("error", "Unable to load auditors. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(a) {
    setEditingId(a.id);
    setForm({
      name: a.name || "",
      firm_name: a.firm_name || "",
      qualification: a.qualification || "",
      membership_no: a.membership_no || "",
      phone: a.phone || "",
      email: a.email || "",
      notes: a.notes || "",
      is_active: a.is_active !== false,
    });
    setShowForm(true);
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const { is_active, ...text } = form;
      const payload = {
        ...Object.fromEntries(
          Object.entries(text).map(([k, v]) => [k, v.trim() || null])
        ),
        is_active,
      };
      if (editingId) {
        await api.put(`/api/auditors/${editingId}`, payload);
      } else {
        await api.post("/api/auditors/", payload);
      }
      notify("success", editingId ? "Auditor updated." : "Auditor added.");
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      notify(
        "error",
        typeof detail === "string"
          ? detail
          : "Could not save the auditor. Please check the details."
      );
    } finally {
      setSaving(false);
    }
  }

  const q = search.toLowerCase();
  const filtered = auditors.filter((a) =>
    [a.name, a.firm_name, a.qualification, a.membership_no, a.phone, a.email]
      .some((v) => (v || "").toLowerCase().includes(q))
  );

  const clientCount = (id) => clients.filter((c) => c.auditor_id === id).length;

  return (
    <main className="main-content">
      <header className="topbar">
        <div>
          <span className="crumb">Workspace / Auditors</span>
          <h1>Auditor management</h1>
          <p>Keep auditor details and see who handles which clients.</p>
        </div>
        <div className="topbar-actions">
          <button className="primary-btn" onClick={openAdd}>
            <Plus size={18} /> Add auditor
          </button>
        </div>
      </header>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>All auditors</h2>
            <p>Search by name, firm, qualification, membership number or phone.</p>
          </div>
          <button className="icon-btn" onClick={loadData} title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search auditors..."
            />
          </div>
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
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><UserCheck size={26} /></div>
            <h3>{auditors.length === 0 ? "No auditors yet" : "No matching auditors"}</h3>
            <p>
              {auditors.length === 0
                ? "Add your first auditor so you can assign clients to them."
                : "Try a different name, firm or membership number."}
            </p>
            {auditors.length === 0 && (
              <button className="primary-btn" onClick={openAdd}>
                <Plus size={18} /> Add auditor
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Auditor</th><th>Firm</th><th>Qualification</th>
                    <th>Membership no.</th><th>Phone</th><th>Email</th>
                    <th>Clients</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className="client-cell">
                          <div className={`avatar av-${a.id % 5}`}>
                            {(a.name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <strong>{a.name}</strong>
                            <small>ID: {a.id}</small>
                          </div>
                        </div>
                      </td>
                      <td>{a.firm_name || "—"}</td>
                      <td>{a.qualification || "—"}</td>
                      <td className="mono">{a.membership_no || "—"}</td>
                      <td className="mono">{a.phone || "—"}</td>
                      <td>{a.email || "—"}</td>
                      <td>{clientCount(a.id)}</td>
                      <td>
                        <span className={`badge ${a.is_active ? "badge-active" : "badge-inactive"}`}>
                          {a.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="icon-btn sm" title="Edit" onClick={() => openEdit(a)}>
                            <Pencil size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="table-footer">
              Showing {filtered.length} of {auditors.length} auditors
            </p>
          </>
        )}
      </section>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <h2>{editingId ? "Edit auditor" : "Add new auditor"}</h2>
                <p>Enter the auditor's professional details.</p>
              </div>
              <button className="icon-btn" onClick={() => setShowForm(false)} title="Close"><X /></button>
            </div>
            <form onSubmit={save}>
              <div className="form-grid">
                {[
                  ["name", "Auditor name *", true],
                  ["firm_name", "Firm name"],
                  ["qualification", "Qualification (e.g. CA)"],
                  ["membership_no", "Membership number"],
                  ["phone", "Phone"],
                  ["email", "Email"],
                ].map(([key, label, required]) => (
                  <label key={key}>
                    {label}
                    <input
                      required={Boolean(required)}
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  </label>
                ))}
                <label className="full-width">
                  Status
                  <select
                    value={form.is_active ? "active" : "inactive"}
                    onChange={(e) => setForm({ ...form, is_active: e.target.value === "active" })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <label className="full-width">
                  Notes
                  <textarea
                    rows="3"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Update auditor" : "Save auditor"}
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