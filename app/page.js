"use client";
import { useState, useRef, useCallback, useEffect } from "react";

/* ─── helpers ─── */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1536;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve({ base64: canvas.toDataURL("image/jpeg", 0.82).split(",")[1], mimeType: "image/jpeg" });
    };
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
    img.src = url;
  });
}

function makeThumbnail(preview) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const MAX = 200;
      let w = img.width, h = img.height;
      if (w > h) { h = Math.round(h * MAX / w); w = MAX; } else { w = Math.round(w * MAX / h); h = MAX; }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      res(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => res(null);
    img.src = preview;
  });
}

/* ─── Btn ─── */
function Btn({ children, onClick, disabled, variant = "primary", size = "md", style: extraStyle = {} }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    border: "none", borderRadius: "var(--radius-sm)", fontFamily: "inherit",
    fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.18s cubic-bezier(0.34,1.56,0.64,1)",
    ...extraStyle,
  };
  const sizes = {
    sm: { padding: "8px 14px", fontSize: 12 },
    md: { padding: "13px 20px", fontSize: 13 },
    lg: { padding: "17px 28px", fontSize: 14, letterSpacing: "0.01em" },
  };
  const variants = {
    primary: {
      background: disabled ? "#e5e0d8" : "linear-gradient(135deg, var(--orange-light), var(--orange), var(--orange-dark))",
      color: disabled ? "#aaa8a3" : "#fff",
      boxShadow: disabled ? "none" : "var(--shadow-orange)",
    },
    secondary: {
      background: "var(--card)", color: "var(--text2)",
      border: "1.5px solid var(--border)", boxShadow: "var(--shadow-sm)",
    },
    ghost: { background: "transparent", color: "var(--text3)", border: "1.5px solid var(--border)" },
    orange_outline: { background: "var(--orange-bg)", color: "var(--orange-dark)", border: "1.5px solid var(--orange-border)" },
    danger: { background: "#fff0f0", color: "var(--red)", border: "1.5px solid rgba(239,68,68,0.2)" },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{ ...base, ...sizes[size], ...variants[variant] }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = "translateY(-2px) scale(1.01)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
    >{children}</button>
  );
}

/* ─── Card ─── */
function Card({ children, style = {}, glow = false }) {
  return (
    <div style={{
      background: "var(--card)", borderRadius: "var(--radius)",
      border: "1px solid var(--border)",
      boxShadow: glow ? "var(--shadow-lg), 0 0 0 3px var(--orange-dim)" : "var(--shadow)",
      overflow: "hidden", ...style,
    }}>{children}</div>
  );
}

/* ─── Badge ─── */
function Badge({ children, color = "orange" }) {
  const colors = {
    orange: { bg: "var(--orange-bg)", text: "var(--orange-dark)", border: "var(--orange-border)" },
    green:  { bg: "#f0fdf4", text: "#16a34a", border: "rgba(34,197,94,0.2)" },
    blue:   { bg: "#eff6ff", text: "#2563eb", border: "rgba(59,130,246,0.2)" },
    gray:   { bg: "var(--bg3)", text: "var(--text3)", border: "var(--border)" },
  };
  const c = colors[color] || colors.gray;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {children}
    </span>
  );
}

/* ─── PhotoSlot ─── */
function PhotoSlot({ index, photo, onFile, onRemove }) {
  const inputRef = useRef();
  const [drag, setDrag] = useState(false);
  const handle = f => { if (!f || !f.type.startsWith("image/")) return; onFile(index, f); };
  return (
    <div
      onClick={() => !photo && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
      style={{
        position: "relative", aspectRatio: "1/1", borderRadius: "var(--radius-sm)",
        overflow: "hidden", cursor: photo ? "default" : "pointer",
        background: drag ? "var(--orange-bg)" : photo ? "#111" : "var(--bg3)",
        border: drag ? "2px dashed var(--orange)" : photo ? "2px solid transparent" : "2px dashed var(--border)",
        transition: "all 0.2s ease",
        boxShadow: photo ? "var(--shadow)" : "none",
      }}
    >
      {photo ? (
        <>
          <img src={photo.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)" }} />
          <button
            onClick={e => { e.stopPropagation(); onRemove(index); }}
            style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.95)", border: "none", color: "#666", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", fontWeight: 700 }}
            onMouseEnter={e => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.color = "var(--red)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.95)"; e.currentTarget.style.color = "#666"; }}
          >✕</button>
          <div style={{ position: "absolute", bottom: 6, left: 8, fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.9)", textTransform: "uppercase", letterSpacing: "0.1em", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>#{index + 1}</div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 6 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: drag ? "var(--orange-dim)" : "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={drag ? "var(--orange)" : "var(--text3)"} strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
          <span style={{ fontSize: 10, color: drag ? "var(--orange)" : "var(--text3)", fontWeight: 600 }}>{drag ? "Loslassen!" : `Foto ${index + 1}`}</span>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handle(e.target.files[0])} />
    </div>
  );
}

/* ─── EditField ─── */
function EditField({ label, value, onChange, multiline, rows = 5 }) {
  const [editing, setEditing] = useState(false);
  const base = { width: "100%", background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: "var(--radius-xs)", padding: "10px 12px", color: "var(--text)", fontSize: 13, lineHeight: 1.7, fontFamily: "inherit", resize: "vertical", transition: "border-color 0.15s" };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</span>
        <Btn size="sm" variant={editing ? "orange_outline" : "ghost"} onClick={() => setEditing(!editing)}>
          {editing ? "✓ Fertig" : "✎ Bearbeiten"}
        </Btn>
      </div>
      {editing
        ? multiline
          ? <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)} style={base} onFocus={e => e.target.style.borderColor = "var(--orange)"} onBlur={e => e.target.style.borderColor = "var(--border)"} />
          : <input value={value} onChange={e => onChange(e.target.value)} style={{ ...base, resize: "none" }} onFocus={e => e.target.style.borderColor = "var(--orange)"} onBlur={e => e.target.style.borderColor = "var(--border)"} />
        : <div style={{ background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: "var(--radius-xs)", padding: "10px 12px", fontSize: 13, color: "var(--text2)", lineHeight: 1.7, whiteSpace: "pre-wrap", minHeight: multiline ? 70 : "auto" }}>{value}</div>
      }
    </div>
  );
}

/* ─── QueueCard ─── */
function QueueCard({ item, index, onEdit, onRemove, onPublish }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card style={{ marginBottom: 10, animation: "slideIn 0.3s ease both", animationDelay: `${index * 0.05}s` }}>
      <div onClick={() => setExpanded(!expanded)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }}>
        {item.previews?.[0] && (
          <img src={item.previews[0]} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: "1px solid var(--border)" }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>
            {item.listing.titel || item.analysis.produktName}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Badge color="gray">{item.listing.zustand}</Badge>
            {item.listing.versand && <Badge color="blue">📦 Versand</Badge>}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--orange-dark)", fontFamily: "'Nunito', sans-serif" }}>{item.listing.preis} €</div>
          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1 }}>{expanded ? "▲ einklappen" : "▼ ausklappen"}</div>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border2)", animation: "fadeIn 0.2s ease" }}>
          <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.7, marginTop: 12, marginBottom: 14 }}>
            {item.listing.beschreibung?.slice(0, 180)}…
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="secondary" size="sm" onClick={() => onEdit(index)} style={{ flex: 1 }}>✎ Bearbeiten</Btn>
            <Btn variant="primary" size="sm" onClick={() => onPublish(index)} style={{ flex: 1 }}>→ Veröffentlichen</Btn>
            <Btn variant="danger" size="sm" onClick={() => onRemove(index)}>✕</Btn>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ─── StepBar ─── */
function StepBar({ step }) {
  const steps = [
    { id: "upload", label: "Fotos" },
    { id: "result", label: "Analyse" },
    { id: "queue",  label: "Warteschlange" },
    { id: "publish",label: "Veröffentlichen" },
  ];
  const order = ["upload","loading","result","queue","publish"];
  const cur = order.indexOf(step);
  const active = steps.findIndex(s => s.id === (step === "loading" ? "result" : step));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28 }}>
      {steps.map((s, i) => {
        const done = i < active;
        const isCur = i === active;
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                background: done ? "var(--orange)" : isCur ? "var(--orange)" : "var(--bg3)",
                border: isCur ? "3px solid var(--orange-light)" : done ? "none" : "2px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: done || isCur ? "#fff" : "var(--text3)",
                fontSize: done ? 12 : 11, fontWeight: 700,
                boxShadow: isCur ? "0 0 0 4px var(--orange-dim)" : "none",
                transition: "all 0.3s ease",
              }}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 9, fontWeight: 600, color: isCur ? "var(--orange-dark)" : done ? "var(--text2)" : "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? "linear-gradient(to right, var(--orange), var(--orange-light))" : "var(--bg3)", margin: "0 6px", marginBottom: 20, transition: "background 0.3s ease", borderRadius: 1 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Toggle ─── */
function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{ width: 48, height: 28, borderRadius: 14, cursor: "pointer", background: value ? "var(--orange)" : "var(--bg3)", border: `2px solid ${value ? "var(--orange-light)" : "var(--border)"}`, position: "relative", transition: "all 0.25s ease", flexShrink: 0, boxShadow: value ? "0 2px 8px var(--orange-dim)" : "none" }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: value ? 22 : 2, transition: "left 0.25s cubic-bezier(0.34,1.56,0.64,1)", boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }} />
    </div>
  );
}

/* ─── Main ─── */
export default function Home() {
  const MAX = 6;
  const empty = () => Array(MAX).fill(null);

  // ── Persistenz: aus localStorage laden beim Start ──
  const loadFromStorage = (key, fallback) => {
    if (typeof window === "undefined") return fallback;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  };

  const [photos, setPhotos]       = useState(empty());
  const [location, setLocation]   = useState(() => loadFromStorage("kaz_location", "St. Leon-Rot, 68789"));
  const [step, setStep]           = useState("upload");
  const [analysis, setAnalysis]   = useState(null);
  const [listing, setListing]     = useState(null);
  const [error, setError]         = useState(null);
  const [correction, setCorrection] = useState("");
  const [tab, setTab]             = useState("preview");
  const [queue, setQueue]         = useState(() => loadFromStorage("kaz_queue", []));
  const [editingIdx, setEditingIdx] = useState(null);
  const [publishSnap, setPublishSnap] = useState(null);
  const [publishIdx, setPublishIdx]   = useState(null);
  const [copied, setCopied]       = useState(false);
  const [activeStyle, setActiveStyle] = useState(null);
  const [styleLoading, setStyleLoading] = useState(false);
  const [priceType, setPriceType] = useState("fest");    // fest | vb
  const [deliveryType, setDeliveryType] = useState("beide"); // abholung | versand | beide

  // ── Persistenz: in localStorage speichern bei Änderung ──
  useEffect(() => {
    try { localStorage.setItem("kaz_queue", JSON.stringify(queue)); } catch {}
  }, [queue]);

  useEffect(() => {
    try { localStorage.setItem("kaz_location", JSON.stringify(location)); } catch {}
  }, [location]);

  const galleryRef = useRef();
  const cameraRef  = useRef();
  const linkRef    = useRef();

  /* photo handlers */
  const handleFile = useCallback((index, file) => {
    const preview = URL.createObjectURL(file);
    setPhotos(prev => { const n = [...prev]; n[index] = { file, preview }; return n; });
  }, []);

  const handleFiles = useCallback((fileList) => {
    const files = Array.from(fileList).filter(f => f.type.startsWith("image/")).slice(0, MAX);
    if (!files.length) return;
    setPhotos(prev => {
      const next = [...prev];
      let slot = 0;
      for (const file of files) {
        while (slot < MAX && next[slot] !== null) slot++;
        if (slot >= MAX) break;
        next[slot] = { file, preview: URL.createObjectURL(file) };
        slot++;
      }
      return next;
    });
  }, []);

  const handleRemove = useCallback((index) => {
    setPhotos(prev => {
      const next = [...prev];
      if (next[index]?.preview) URL.revokeObjectURL(next[index].preview);
      next[index] = null;
      return next;
    });
  }, []);

  const clearPhotos = () => {
    photos.forEach(p => p?.preview && URL.revokeObjectURL(p.preview));
    setPhotos(empty());
  };

  const hasPhotos    = photos.some(p => p !== null);
  const activeCount  = photos.filter(p => p !== null).length;

  /* analyze */
  const doAnalyze = async (extraHint = "") => {
    const active = photos.filter(p => p !== null);
    if (active.length === 0) { setError("Bitte mindestens 1 Foto hochladen."); return; }
    setStep("loading"); setError(null);
    try {
      const compressed = await Promise.all(active.map(p => compressImage(p.file)));
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: compressed, location, extraHint }),
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 200));
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Analyse fehlgeschlagen");
      const d = json.data;
      setAnalysis(d);
      setListing({ titel: d.titel || "", preis: d.schaetzPreis || 0, beschreibung: d.beschreibung || "", kategorie: d.empfKategoriePfad || d.kategorie || "", zustand: d.zustand || "Gut", ort: location, versand: d.versandMoeglich ?? true });
      setCorrection(""); setTab("preview"); setEditingIdx(null);
      setStep("result");
    } catch (e) { setError(e.message); setStep("upload"); }
  };

  /* listing text */
  const makePriceLabel = (preis, pt) => {
    if (pt === "vb") return `${preis} € VB`;
    return `${preis} € (Festpreis)`;
  };

  const makeDeliveryLabel = (dt) => {
    if (dt === "abholung") return "Nur Abholung";
    if (dt === "versand")  return "Versand möglich";
    return "Abholung oder Versand möglich";
  };

  const makeText = (l, a, pt, dt) => !l ? "" :
    `📦 ${l.titel}\n💰 ${makePriceLabel(l.preis, pt ?? "fest")}\n📍 ${l.ort}\n⭐ Zustand: ${l.zustand}\n🚚 ${makeDeliveryLabel(dt ?? "beide")}\n\n${l.beschreibung}\n\n🏷️ ${l.kategorie}${a?.tags?.length ? "\n" + a.tags.map(t => "#" + t).join(" ") : ""}`;

  const listingText = makeText(listing, analysis, priceType, deliveryType);

  /* save */
  const saveToQueue = async () => {
    const previews = (await Promise.all(photos.filter(p => p !== null).map(p => makeThumbnail(p.preview)))).filter(Boolean);
    const item = { analysis, listing: { ...listing }, previews, id: Date.now(), priceType, deliveryType };
    if (editingIdx !== null) {
      setQueue(prev => { const q = [...prev]; q[editingIdx] = item; return q; });
      setEditingIdx(null);
    } else {
      setQueue(prev => [...prev, item]);
    }
    clearPhotos(); setAnalysis(null); setListing(null); setCorrection("");
    setStep("upload");
  };

  const editQueueItem = idx => {
    const item = queue[idx];
    setAnalysis(item.analysis); setListing({ ...item.listing });
    if (item.priceType) setPriceType(item.priceType);
    if (item.deliveryType) setDeliveryType(item.deliveryType);
    setEditingIdx(idx); clearPhotos(); setCorrection(""); setTab("edit");
    setStep("result");
  };

  const removeFromQueue = idx => setQueue(prev => prev.filter((_, i) => i !== idx));

  /* publish */
  const publishItem = (l, a, idx = null, pt, dt) => {
    const text = makeText(l, a, pt ?? priceType, dt ?? deliveryType);
    navigator.clipboard.writeText(text).catch(() => {});
    setPublishSnap({ listing: l, analysis: a, text, priceType: pt ?? priceType, deliveryType: dt ?? deliveryType });
    setPublishIdx(idx);
    setStep("publish");
    setTimeout(() => linkRef.current?.click(), 500);
  };

  const publishCurrent  = ()    => publishItem({ ...listing }, { ...analysis }, null);
  const publishSingle   = idx   => publishItem({ ...queue[idx].listing }, { ...queue[idx].analysis }, idx, queue[idx].priceType, queue[idx].deliveryType);

  const copyText = text => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const STYLES = [
    { key: "sachlich",    label: "Sachlich",    emoji: "📋", desc: "Fakten, nüchtern" },
    { key: "emotional",   label: "Emotional",   emoji: "✨", desc: "Warm, einladend" },
    { key: "knapp",       label: "Knapp",       emoji: "⚡", desc: "60-80 Wörter" },
    { key: "ausfuehrlich",label: "Ausführlich", emoji: "📝", desc: "250-350 Wörter" },
    { key: "human",       label: "Menschlich",  emoji: "🧑", desc: "Kein KI-Stil, keine Emojis" },
  ];

  const generateStyle = async (styleKey) => {
    if (!listing || !analysis) return;
    setStyleLoading(true);
    setActiveStyle(styleKey);
    try {
      const res = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produktName: analysis.produktName,
          zustand: listing.zustand,
          preis: listing.preis,
          kategorie: listing.kategorie,
          ort: listing.ort,
          versand: listing.versand,
          styleKey,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setListing(prev => ({ ...prev, beschreibung: json.text }));
      setTab("preview");
    } catch (e) {
      setError("Stil konnte nicht generiert werden: " + e.message);
    } finally {
      setStyleLoading(false);
    }
  };

  const resetAll = () => {
    clearPhotos(); setAnalysis(null); setListing(null); setError(null);
    setCorrection(""); setStep("upload"); setTab("preview");
    setEditingIdx(null); setPublishIdx(null); setPublishSnap(null);
  };

  const clearAllData = () => {
    if (!confirm("Alle gespeicherten Artikel und Daten löschen?")) return;
    setQueue([]);
    clearPhotos(); setAnalysis(null); setListing(null);
    setStep("upload"); setEditingIdx(null); setPublishSnap(null);
    try { localStorage.removeItem("kaz_queue"); } catch {}
  };

  /* ── RENDER ── */
  return (
    <main style={{ minHeight: "100vh", padding: "40px 16px 100px" }}>
      <a ref={linkRef} href="/api/redirect" target="_blank" rel="noreferrer" style={{ display: "none" }}>go</a>

      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* ── HEADER ── */}
        <header style={{ textAlign: "center", marginBottom: 36, animation: "fadeUp 0.5s ease both" }}>
          {/* Logo mark */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, var(--orange-light), var(--orange-dark))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-orange)", fontSize: 20 }}>
              📸
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", fontFamily: "'Nunito', sans-serif", lineHeight: 1.1 }}>Kleinanzeigen</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--orange)", letterSpacing: "0.05em" }}>KI-Assistent</div>
            </div>
          </div>

          <h1 style={{ fontFamily: "'Nunito', sans-serif", fontSize: "clamp(1.9rem, 6vw, 2.8rem)", fontWeight: 900, lineHeight: 1.15, color: "var(--text)", marginBottom: 10 }}>
            Artikel scannen,{" "}
            <span style={{ background: "linear-gradient(135deg, var(--orange), var(--orange-dark))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              sofort verkaufen.
            </span>
          </h1>
          <p style={{ fontSize: 14, color: "var(--text3)", lineHeight: 1.7, maxWidth: 360, margin: "0 auto" }}>
            Fotos hochladen — KI erkennt den Artikel, recherchiert Marktpreise und schreibt die Anzeige.
          </p>

          {/* Queue badge */}
          {queue.length > 0 && (
            <button onClick={() => setStep("queue")} style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, padding: "8px 16px", borderRadius: 20, border: "1.5px solid var(--orange-border)", background: "var(--orange-bg)", color: "var(--orange-dark)", fontSize: 12, fontWeight: 700, cursor: "pointer", animation: "popIn 0.3s ease both", transition: "all 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "var(--shadow-orange)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
            >
              <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--orange)", color: "#fff", fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{queue.length}</span>
              {queue.length} Artikel in Warteschlange →
            </button>
          )}
          {/* Storage indicator */}
          {queue.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8, fontSize: 11, color: "var(--text3)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
              Automatisch gespeichert
              <button onClick={clearAllData} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0 }}>· Alles löschen</button>
            </div>
          )}
        </header>

        <StepBar step={step} />

        {/* ── UPLOAD ── */}
        {step === "upload" && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            {/* Photo grid */}
            <Card style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--orange)", color: "#fff", fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>1</span>
                Fotos hochladen
                {activeCount > 0 && <Badge color="orange">{activeCount} Foto{activeCount > 1 ? "s" : ""}</Badge>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                {photos.map((p, i) => <PhotoSlot key={i} index={i} photo={p} onFile={handleFile} onRemove={handleRemove} />)}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                <Btn variant="orange_outline" onClick={() => galleryRef.current?.click()} style={{ justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Galerie · bis zu 6 Fotos
                </Btn>
                <Btn variant="secondary" onClick={() => cameraRef.current?.click()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  Kamera
                </Btn>
              </div>
              <input ref={galleryRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { const f = e.target.files[0]; if (f) handleFiles([f]); }} />
            </Card>

            {/* Location */}
            <Card style={{ padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--orange)", color: "#fff", fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>2</span>
                Standort für Preisvergleich
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <input value={location} onChange={e => setLocation(e.target.value)} style={{ flex: 1, background: "none", border: "none", color: "var(--text)", fontSize: 14, fontWeight: 600 }} placeholder="Stadt oder PLZ" />
              </div>
            </Card>

            {error && (
              <div style={{ background: "#fff0f0", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "var(--radius-sm)", padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "var(--red)", display: "flex", gap: 8, animation: "fadeIn 0.2s ease" }}>
                ⚠ {error}
              </div>
            )}

            <Btn variant="primary" size="lg" disabled={!hasPhotos} onClick={() => doAnalyze()} style={{ width: "100%" }}>
              {hasPhotos
                ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> {activeCount} Foto{activeCount > 1 ? "s" : ""} analysieren</>
                : "Mindestens 1 Foto hochladen"
              }
            </Btn>
          </div>
        )}

        {/* ── LOADING ── */}
        {step === "loading" && (
          <div style={{ textAlign: "center", padding: "60px 0", animation: "fadeIn 0.3s ease" }}>
            <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 28px" }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--orange-bg)", animation: "bounce 1.2s ease-in-out infinite" }} />
              <div style={{ position: "absolute", inset: 6, borderRadius: "50%", border: "3px solid var(--orange-light)", borderTop: "3px solid var(--orange-dark)", animation: "spin 0.8s linear infinite" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🔍</div>
            </div>
            <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 10 }}>Analysiere deine Fotos…</div>
            {["Texte & Logos auf Fotos lesen", "Marktpreise auf Kleinanzeigen suchen", "Anzeigentext verfassen"].map((s, i) => (
              <div key={i} style={{ fontSize: 13, color: "var(--text3)", marginBottom: 4, animation: `pulse 1.5s ease-in-out infinite`, animationDelay: `${i * 0.5}s` }}>
                ⏳ {s}
              </div>
            ))}
          </div>
        )}

        {/* ── RESULT ── */}
        {step === "result" && analysis && listing && (
          <div style={{ animation: "fadeUp 0.35s ease both" }}>

            {/* Edit banner */}
            {editingIdx !== null && (
              <div style={{ background: "var(--orange-bg)", border: "1.5px solid var(--orange-border)", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "var(--orange-dark)", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center", animation: "slideIn 0.2s ease" }}>
                <span>✎ Artikel #{editingIdx + 1} aus Warteschlange bearbeiten</span>
                <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text3)" }}>Nur Textfelder editierbar</span>
              </div>
            )}

            {/* Price card */}
            <Card glow style={{ marginBottom: 14 }}>
              <div style={{ padding: "20px", background: "linear-gradient(135deg, var(--orange-bg) 0%, #fff8f5 100%)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 6 }}>Erkanntes Produkt</div>
                    <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 20, fontWeight: 800, color: "var(--text)", lineHeight: 1.2, marginBottom: 6 }}>{analysis.produktName}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10 }}>{analysis.empfKategoriePfad || analysis.kategorie}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Badge color="gray">⭐ {listing.zustand}</Badge>
                      {listing.versand ? <Badge color="blue">📦 Versand</Badge> : <Badge color="gray">🤝 Abholung</Badge>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 42, fontWeight: 900, color: "var(--orange-dark)", lineHeight: 1 }}>{listing.preis}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--orange)", marginTop: -2 }}>Euro</div>
                    <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 4 }}>Markt: {analysis.preisRange} €</div>
                  </div>
                </div>
              </div>
              {(analysis.preisStrategie || analysis.marktdaten) && (
                <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border2)", background: "#fafaf9" }}>
                  {analysis.preisStrategie && <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: analysis.marktdaten ? 6 : 0 }}>💡 {analysis.preisStrategie}</div>}
                  {analysis.marktdaten && <div style={{ fontSize: 11, color: "var(--text3)", background: "var(--bg3)", borderRadius: 6, padding: "5px 10px", display: "inline-block" }}>📊 {analysis.marktdaten}</div>}
                </div>
              )}
            </Card>

            {/* Preis & Lieferung Optionen */}
            <Card style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

                {/* Preistyp */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Preistyp</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { key: "fest", label: "Festpreis",         icon: "🔒", desc: "Kein Rabatt" },
                      { key: "vb",   label: "Verhandlungsbasis", icon: "🤝", desc: "Preis verhandelbar" },
                    ].map(o => (
                      <button key={o.key} onClick={() => setPriceType(o.key)} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                        borderRadius: "var(--radius-xs)", border: priceType === o.key ? "2px solid var(--orange)" : "1.5px solid var(--border)",
                        background: priceType === o.key ? "var(--orange-bg)" : "var(--bg3)",
                        cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                      }}>
                        <span style={{ fontSize: 16 }}>{o.icon}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: priceType === o.key ? "var(--orange-dark)" : "var(--text)" }}>{o.label}</div>
                          <div style={{ fontSize: 10, color: "var(--text3)" }}>{o.desc}</div>
                        </div>
                        {priceType === o.key && <span style={{ marginLeft: "auto", color: "var(--orange)", fontWeight: 800, fontSize: 14 }}>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lieferung */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Übergabe</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { key: "abholung", label: "Nur Abholung", icon: "🏠", desc: "Zu groß / zu schwer" },
                      { key: "versand",  label: "Nur Versand",  icon: "📦", desc: "Versandfertig" },
                      { key: "beide",    label: "Beides",       icon: "✅", desc: "Flexibel" },
                    ].map(o => (
                      <button key={o.key} onClick={() => setDeliveryType(o.key)} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                        borderRadius: "var(--radius-xs)", border: deliveryType === o.key ? "2px solid var(--orange)" : "1.5px solid var(--border)",
                        background: deliveryType === o.key ? "var(--orange-bg)" : "var(--bg3)",
                        cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                      }}>
                        <span style={{ fontSize: 16 }}>{o.icon}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: deliveryType === o.key ? "var(--orange-dark)" : "var(--text)" }}>{o.label}</div>
                          <div style={{ fontSize: 10, color: "var(--text3)" }}>{o.desc}</div>
                        </div>
                        {deliveryType === o.key && <span style={{ marginLeft: "auto", color: "var(--orange)", fontWeight: 800, fontSize: 14 }}>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Correction */}
            <Card style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>Artikel falsch erkannt?</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={correction}
                  onChange={e => setCorrection(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && correction.trim() && doAnalyze(correction.trim())}
                  placeholder='Korrekten Namen eingeben, z.B. "RØDE NT-USB"'
                  style={{ flex: 1, background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: "var(--radius-xs)", padding: "10px 12px", color: "var(--text)", fontSize: 13, transition: "border-color 0.15s" }}
                  onFocus={e => e.target.style.borderColor = "var(--orange)"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"}
                />
                <Btn variant={correction.trim() ? "primary" : "ghost"} disabled={!correction.trim()} onClick={() => doAnalyze(correction.trim())}>↺ Neu</Btn>
              </div>
            </Card>

            {/* Stil-Selector */}
            <Card style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  Beschreibungsstil
                </div>
                {activeStyle && !styleLoading && (
                  <Badge color="green">✓ {STYLES.find(s => s.key === activeStyle)?.label} aktiv</Badge>
                )}
                {styleLoading && (
                  <Badge color="orange">⏳ Wird generiert…</Badge>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                {STYLES.map(s => (
                  <button
                    key={s.key}
                    onClick={() => !styleLoading && generateStyle(s.key)}
                    disabled={styleLoading}
                    style={{
                      padding: "10px 6px",
                      borderRadius: "var(--radius-xs)",
                      border: activeStyle === s.key ? "2px solid var(--orange)" : "1.5px solid var(--border)",
                      background: activeStyle === s.key ? "var(--orange-bg)" : styleLoading && activeStyle === s.key ? "var(--orange-bg)" : "var(--bg3)",
                      color: activeStyle === s.key ? "var(--orange-dark)" : "var(--text2)",
                      cursor: styleLoading ? "wait" : "pointer",
                      textAlign: "center",
                      transition: "all 0.18s ease",
                      opacity: styleLoading && activeStyle !== s.key ? 0.5 : 1,
                    }}
                    onMouseEnter={e => { if (!styleLoading && activeStyle !== s.key) e.currentTarget.style.borderColor = "var(--orange-light)"; }}
                    onMouseLeave={e => { if (activeStyle !== s.key) e.currentTarget.style.borderColor = "var(--border)"; }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 4, filter: styleLoading && activeStyle === s.key ? "none" : "none" }}>
                      {styleLoading && activeStyle === s.key ? "⏳" : s.emoji}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.2 }}>{s.label}</div>
                    <div style={{ fontSize: 9, color: "var(--text3)", marginTop: 2, lineHeight: 1.3 }}>{s.desc}</div>
                  </button>
                ))}
              </div>
            </Card>

            {/* Tabs */}
            <div style={{ display: "flex", background: "var(--bg3)", borderRadius: "var(--radius-sm)", padding: 4, marginBottom: 14, gap: 3 }}>
              {[["preview", "👁 Vorschau"], ["edit", "✎ Bearbeiten"]].map(([t, label]) => (
                <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: tab === t ? "#fff" : "transparent", color: tab === t ? "var(--orange-dark)" : "var(--text3)", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: tab === t ? "var(--shadow-sm)" : "none", transition: "all 0.15s" }}>{label}</button>
              ))}
            </div>

            {tab === "preview" && (
              <Card style={{ padding: "18px 20px", marginBottom: 14 }}>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: 12.5, color: "var(--text2)", lineHeight: 1.9, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{listingText}</pre>
              </Card>
            )}

            {tab === "edit" && (
              <Card style={{ padding: 18, marginBottom: 14 }}>
                <EditField label="Titel (max. 60 Zeichen)" value={listing.titel} onChange={v => setListing({ ...listing, titel: v })} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Preis (€)</div>
                    <input type="number" value={listing.preis} onChange={e => setListing({ ...listing, preis: Number(e.target.value) })}
                      style={{ width: "100%", background: "var(--bg)", border: "1.5px solid var(--orange-border)", borderRadius: "var(--radius-xs)", padding: "10px 12px", color: "var(--orange-dark)", fontSize: 26, fontWeight: 900, fontFamily: "'Nunito', sans-serif" }}
                      onFocus={e => e.target.style.borderColor = "var(--orange)"}
                      onBlur={e => e.target.style.borderColor = "var(--orange-border)"}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Zustand</div>
                    <select value={listing.zustand} onChange={e => setListing({ ...listing, zustand: e.target.value })}
                      style={{ width: "100%", background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: "var(--radius-xs)", padding: "12px", color: "var(--text)", fontSize: 13, fontFamily: "inherit", fontWeight: 600 }}>
                      {["Neu","Wie neu","Sehr gut","Gut","Befriedigend","Defekt"].map(z => <option key={z} value={z}>{z}</option>)}
                    </select>
                  </div>
                </div>
                <EditField label="Beschreibung" value={listing.beschreibung} onChange={v => setListing({ ...listing, beschreibung: v })} multiline rows={7} />
                <EditField label="Kategorie" value={listing.kategorie} onChange={v => setListing({ ...listing, kategorie: v })} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0 2px", borderTop: "1px solid var(--border2)" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>Versand möglich</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>Ändert auch die Übergabe-Option oben</div>
                  </div>
                  <Toggle value={deliveryType !== "abholung"} onChange={v => setDeliveryType(v ? "beide" : "abholung")} />
                </div>
              </Card>
            )}

            {/* Actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <Btn variant="secondary" size="lg" onClick={saveToQueue} style={{ flexDirection: "column", gap: 2, width: "100%", padding: "14px" }}>
                <span>💾 Speichern</span>
                <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)" }}>+ nächster Artikel</span>
              </Btn>
              <Btn variant="primary" size="lg" onClick={publishCurrent} style={{ flexDirection: "column", gap: 2, width: "100%", padding: "14px" }}>
                <span>🚀 Veröffentlichen</span>
                <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.8 }}>Kleinanzeigen öffnen</span>
              </Btn>
            </div>
            <Btn variant="ghost" size="sm" onClick={() => setStep("upload")} style={{ width: "100%" }}>← Fotos neu hochladen</Btn>
          </div>
        )}

        {/* ── QUEUE ── */}
        {step === "queue" && (
          <div style={{ animation: "fadeUp 0.35s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 22, fontWeight: 800 }}>Warteschlange</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{queue.length} Artikel bereit zur Veröffentlichung</div>
              </div>
              <Btn variant="primary" size="sm" onClick={() => setStep("upload")}>+ Neuer Artikel</Btn>
            </div>

            {queue.length === 0 ? (
              <Card style={{ padding: "40px", textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 14, color: "var(--text3)" }}>Keine Artikel gespeichert.</div>
              </Card>
            ) : (
              <>
                {queue.map((item, idx) => (
                  <QueueCard key={item.id} item={item} index={idx} onEdit={editQueueItem} onRemove={removeFromQueue} onPublish={publishSingle} />
                ))}
                <Card style={{ padding: 20, marginTop: 16, background: "linear-gradient(135deg, var(--orange-bg), #fff)" }}>
                  <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14, textAlign: "center" }}>
                    Alle Artikel der Reihe nach auf Kleinanzeigen einstellen
                  </div>
                  <Btn variant="primary" size="lg" onClick={() => publishSingle(0)} style={{ width: "100%" }}>
                    🚀 Mit Artikel 1 starten
                  </Btn>
                </Card>
              </>
            )}
          </div>
        )}

        {/* ── PUBLISH ── */}
        {step === "publish" && publishSnap && (
          <div style={{ animation: "fadeUp 0.35s ease both" }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 60, marginBottom: 12, animation: "popIn 0.5s ease both" }}>🎉</div>
              <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 26, fontWeight: 900, color: "var(--text)", marginBottom: 8 }}>Bereit zur Veröffentlichung!</div>
              <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.8 }}>Text ist in der Zwischenablage — auf Kleinanzeigen einfach einfügen.</div>
            </div>

            {/* Steps */}
            <Card style={{ marginBottom: 16 }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border2)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Nächste Schritte</div>
              </div>
              {[
                ["Kleinanzeigen öffnen & einloggen", "", "1"],
                ["Kategorie wählen", publishSnap.listing.kategorie, "2"],
                ['„Anzeige aufgeben" klicken', "", "3"],
                ["Titel & Text einfügen", "Strg+V oder Einfügen", "4"],
                [`Preis: ${publishSnap.listing.preis} € + Fotos hochladen`, "", "5"],
              ].map(([title, sub, n], i) => (
                <div key={i} style={{ display: "flex", gap: 14, padding: "13px 20px", borderBottom: i < 4 ? "1px solid var(--border2)" : "none", alignItems: "center" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--orange)", color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{title}</div>
                    {sub && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 1 }}>{sub}</div>}
                  </div>
                </div>
              ))}
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <a href="/api/redirect" target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "15px", borderRadius: "var(--radius-sm)", background: "linear-gradient(135deg, var(--orange-light), var(--orange-dark))", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", boxShadow: "var(--shadow-orange)" }}>
                → Kleinanzeigen öffnen
              </a>
              <Btn variant={copied ? "orange_outline" : "secondary"} size="md" onClick={() => copyText(publishSnap.text)} style={{ width: "100%" }}>
                {copied ? "✓ Kopiert!" : "📋 Text kopieren"}
              </Btn>
            </div>

            {/* Next in queue */}
            {queue.length > 0 && (
              <Card style={{ padding: 16, marginBottom: 14, background: "var(--orange-bg)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600 }}>
                    Noch <span style={{ color: "var(--orange-dark)", fontWeight: 800 }}>{queue.length}</span> Artikel in der Warteschlange
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {publishIdx !== null && queue.length > 1 && (
                      <Btn variant="primary" size="sm" onClick={() => publishSingle((publishIdx + 1) % queue.length)}>→ Nächster</Btn>
                    )}
                    <Btn variant="orange_outline" size="sm" onClick={() => setStep("queue")}>Warteschlange</Btn>
                  </div>
                </div>
              </Card>
            )}

            {/* Preview text */}
            <Card style={{ padding: 18, marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>Dein Anzeigentext</div>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "var(--text2)", lineHeight: 1.9, fontFamily: "inherit" }}>{publishSnap.text}</pre>
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Btn variant="ghost" onClick={() => setStep("upload")} style={{ width: "100%" }}>+ Neuer Artikel</Btn>
              <Btn variant="ghost" onClick={resetAll} style={{ width: "100%" }}>↺ Alles zurücksetzen</Btn>
            </div>
          </div>
        )}

        <footer style={{ marginTop: 60, textAlign: "center", fontSize: 11, color: "var(--text3)", lineHeight: 2 }}>
          Preise basieren auf Marktrecherche · Kein Anspruch auf Genauigkeit
        </footer>
      </div>
    </main>
  );
}
