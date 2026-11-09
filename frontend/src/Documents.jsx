import { useEffect, useRef, useState } from "react";
import {
  Plus, Search, Eye, Download, Trash2, X, RefreshCw, CheckCircle2,
  AlertCircle, AlertTriangle, FileText, FileImage, FileSpreadsheet,
  File as FileIcon, UploadCloud, Upload, HardDrive,
} from "lucide-react";
import api from "./api";
import { useAuth } from "./authContext";

const CATEGORIES = [
  "GST Return", "Invoice", "Registration", "Notice", "Bank Statement", "Other",
];
const CATEGORY_PILL = {
  "GST Return": "pill-admin",
  Invoice: "pill-paid",
  Registration: "pill-registration",
  Notice: "pill-deadline",
  "Bank Statement": "pill-anniversary",
  Other: "pill-staff",
};
const ALLOWED = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx", ".xls", ".xlsx", ".csv"];
const MAX_BYTES = 10 * 1024 * 1024;

const emptyForm = { client_id: "", filing_id: "", category: "GST Return", title: "" };

function extOf(name) {
  const i = (name || "").lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function iconFor(name) {
  const ext = extOf(name);
  if (ext === ".pdf") return { Icon: FileText, cls: "ic-red" };
  if ([".jpg", ".jpeg", ".png"].includes(ext)) return { Icon: FileImage, cls: "ic-violet" };
  if ([".xls", ".xlsx", ".csv"].includes(ext)) return { Icon: FileSpreadsheet, cls: "ic-green" };
  if ([".doc", ".docx"].includes(ext)) return { Icon: FileText, cls: "ic-blue" };
  return { Icon: FileIcon, cls: "ic-blue" };
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtDate(s) {
  return new Date(s).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtPeriod(p) {
  return new Date(p + "-01T00:00:00").toLocaleDateString("en-IN", {
    month: "short", year: "numeric",
  });
}

function isThisMonth(s) {
  const d = new Date(s);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default function Documents() {
  const { user } = useAuth();
  const fileInput = useRef(null);

  const [docs, setDocs] = useState([]);
  const [clients, setClients] = useState([]);
  const [filings, setFilings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  function notify(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }

  function errorText(err, fallback) {
    const detail = err.response?.data?.detail;
    return typeof detail === "string" ? detail : fallback;
  }

  async function loadData() {
    setLoading(true);
    try {
      const [d, c, f] = await Promise.all([
        api.get("/api/documents/"),
        api.get("/api/clients/"),
        api.get("/api/filings/"),
      ]);
      setDocs(d.data);
      setClients(c.data);
      setFilings(f.data);
    } catch {
      notify("error", "Unable to load documents. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const clientById = (id) => clients.find((c) => c.id === id);
  const filingById = (id) => filings.find((f) => f.id === id);

  function openUpload() {
    setForm(emptyForm);
    setFile(null);
    setShowForm(true);
  }

  function pickFile(f) {
    if (!f) return;
    if (!ALLOWED.includes(extOf(f.name))) {
      notify("error", "Allowed files: PDF, JPG, PNG, Word, Excel and CSV.");
      return;
    }
    if (f.size > MAX_BYTES) {
      notify("error", "File is too large. The limit is 10 MB.");
      return;
    }
    setFile(f);
  }

  async function upload(event) {
    event.preventDefault();
    if (!file) {
      notify("error", "Choose a file to upload.");
      return;
    }
    setSaving(true);
    try {
      const data = new FormData();
      data.append("client_id", form.client_id);
      data.append("category", form.category);
      if (form.filing_id) data.append("filing_id", form.filing_id);
      if (form.title.trim()) data.append("title", form.title.trim());
      data.append("file", file);

      await api.post("/api/documents/", data);
      notify("success", "Document uploaded.");
      setShowForm(false);
      await loadData();
    } catch (err) {
      notify("error", errorText(err, "Could not upload the document."));
    } finally {
      setSaving(false);
    }
  }

  async function fetchBlob(doc) {
    const res = await api.get(`/api/documents/${doc.id}/download`, {
      responseType: "blob",
    });
    return res.data;
  }

  async function download(doc) {
    try {
      const blob = await fetchBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.original_filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      notify("error", "Could not download the document.");
    }
  }

  async function view(doc) {
    const ext = extOf(doc.original_filename);
    if (![".pdf", ".jpg", ".jpeg", ".png"].includes(ext)) {
      notify("success", "This file type cannot be previewed, so it is downloading.");
      return download(doc);
    }
    const tab = window.open("", "_blank");
    try {
      const blob = await fetchBlob(doc);
      const typed = new Blob([blob], {
        type: ext === ".pdf" ? "application/pdf" : ext === ".png" ? "image/png" : "image/jpeg",
      });
      const url = URL.createObjectURL(typed);
      if (tab) tab.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      if (tab) tab.close();
      notify("error", "Could not open the document.");
    }
  }

  async function remove(doc) {
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/documents/${doc.id}`);
      notify("success", "Document deleted.");
      await loadData();
    } catch (err) {
      notify("error", errorText(err, "Could not delete the document."));
    }
  }

  const monthDocs = docs.filter((d) => isThisMonth(d.uploaded_at));
  const notices = docs.filter((d) => d.category === "Notice");
  const totalBytes = docs.reduce((s, d) => s + d.size_bytes, 0);

  const cards = [
    { label: "Total documents", value: docs.length, note: "Files stored", icon: FileText, tone: "blue", card: "" },
    { label: "Added this month", value: monthDocs.length, note: "New uploads", icon: Upload, tone: "green", card: "c-green" },
    { label: "Notices", value: notices.length, note: "Check these first", icon: AlertTriangle, tone: "red", card: "c-red" },
    { label: "Storage used", value: fmtSize(totalBytes), note: "On this computer", icon: HardDrive, tone: "violet", card: "c-violet" },
  ];

  const tabs = {
    All: docs,
    "This month": monthDocs,
    Notices: notices,
  };

  const q = search.toLowerCase();
  const visible = tabs[tab].filter((d) => {
    if (clientFilter !== "all" && String(d.client_id) !== clientFilter) return false;
    if (categoryFilter !== "all" && d.category !== categoryFilter) return false;
    return [d.title, d.original_filename].some((v) => (v || "").toLowerCase().includes(q));
  });

  const clientFilings = filings.filter((f) => String(f.client_id) === form.client_id);

  return (
    <main className="main-content">
      <header className="topbar">
        <div>
          <span className="crumb">Workspace / Documents</span>
          <h1>Documents</h1>
          <p>Store client files and link them to a filing period.</p>
        </div>
        <div className="topbar-actions">
          <button className="primary-btn" onClick={openUpload}>
            <Plus size={18} /> Upload document
          </button>
        </div>
      </header>

      <section className="stats-grid">
        {cards.map(({ label, value, note, icon: Icon, tone, card }) => (
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
        <div className="panel-tools">
          <div className="tabs">
            {Object.keys(tabs).map((k) => (
              <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
                {k} ({tabs[k].length})
              </button>
            ))}
          </div>
          <button className="icon-btn" onClick={loadData} title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="toolbar" style={{ marginTop: 0 }}>
          <div className="search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or file name..."
            />
          </div>
          <select className="filter-select" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
            <option value="all">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.client_name}</option>
            ))}
          </select>
          <select className="filter-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
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
            <div className="empty-icon"><FileText size={26} /></div>
            <h3>{docs.length === 0 ? "No documents yet" : "No matching documents"}</h3>
            <p>
              {docs.length === 0
                ? "Upload your first document for a client."
                : "Try a different tab, search or filter."}
            </p>
            {docs.length === 0 && (
              <button className="primary-btn" onClick={openUpload}>
                <Plus size={18} /> Upload document
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Document</th><th>Client</th><th>Category</th>
                    <th>Filing</th><th>Size</th><th>Uploaded</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((d) => {
                    const { Icon, cls } = iconFor(d.original_filename);
                    const filing = d.filing_id ? filingById(d.filing_id) : null;
                    return (
                      <tr key={d.id} className={d.category === "Notice" ? "row-late" : ""}>
                        <td>
                          <div className="client-cell">
                            <div className={`file-icon ${cls}`}><Icon size={18} /></div>
                            <div className="doc-title">
                              <strong>{d.title}</strong>
                              <small>{d.original_filename}</small>
                            </div>
                          </div>
                        </td>
                        <td>{clientById(d.client_id)?.client_name || "—"}</td>
                        <td>
                          <span className={`pill ${CATEGORY_PILL[d.category] || "pill-staff"}`}>
                            {d.category}
                          </span>
                        </td>
                        <td>
                          {filing ? `${filing.return_type} · ${fmtPeriod(filing.period)}` : <span className="muted">—</span>}
                        </td>
                        <td className="mono">{fmtSize(d.size_bytes)}</td>
                        <td>
                          {fmtDate(d.uploaded_at)}
                          <small>{d.uploaded_by_name || "—"}</small>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button className="icon-btn sm" title="View" onClick={() => view(d)}>
                              <Eye size={15} />
                            </button>
                            <button className="icon-btn sm" title="Download" onClick={() => download(d)}>
                              <Download size={15} />
                            </button>
                            {user.role === "Admin" && (
                              <button className="icon-btn sm" title="Delete" onClick={() => remove(d)}>
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
              Showing {visible.length} of {docs.length} documents
            </p>
          </>
        )}
      </section>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <h2>Upload document</h2>
                <p>PDF, JPG, PNG, Word, Excel or CSV. Up to 10 MB.</p>
              </div>
              <button className="icon-btn" onClick={() => setShowForm(false)} title="Close"><X /></button>
            </div>
            <form onSubmit={upload}>
              <div className="form-grid">
                <label className="full-width">
                  Client *
                  <select
                    required
                    value={form.client_id}
                    onChange={(e) => setForm({ ...form, client_id: e.target.value, filing_id: "" })}
                  >
                    <option value="">Select a client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.client_name}{c.business_name ? ` (${c.business_name})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Category
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Linked filing (optional)
                  <select
                    value={form.filing_id}
                    disabled={!form.client_id}
                    onChange={(e) => setForm({ ...form, filing_id: e.target.value })}
                  >
                    <option value="">
                      {form.client_id && clientFilings.length === 0 ? "No filings for this client" : "Not linked"}
                    </option>
                    {clientFilings.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.return_type} · {fmtPeriod(f.period)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="full-width">
                  Title (optional)
                  <input
                    value={form.title}
                    placeholder="Uses the file name if left empty"
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </label>

                <div className="full-width">
                  <div
                    className={`dropzone ${dragging ? "dragging" : ""}`}
                    onClick={() => fileInput.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      pickFile(e.dataTransfer.files?.[0]);
                    }}
                  >
                    <UploadCloud size={28} />
                    {file ? (
                      <p><strong>{file.name}</strong> ({fmtSize(file.size)})</p>
                    ) : (
                      <p><strong>Click to choose a file</strong> or drop it here</p>
                    )}
                  </div>
                  <input
                    ref={fileInput}
                    type="file"
                    hidden
                    accept={ALLOWED.join(",")}
                    onChange={(e) => pickFile(e.target.files?.[0])}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={saving}>
                  {saving ? "Uploading..." : "Upload document"}
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