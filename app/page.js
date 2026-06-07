"use client";
import { useState, useRef, useCallback } from "react";

/* ─── image compression ─── */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1024;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
    };
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
    img.src = url;
  });
}

/* ─── PhotoSlot ─── */
function PhotoSlot({ index, photo, onFile, onRemove }) {
  const inputRef = useRef();
  const [drag, setDrag] = useState(false);

  const handle = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    onFile(index, file);
  };

  return (
    <div
      onClick={() => !photo && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
      style={{
        position: "relative",
        aspectRatio: "1/1",
        borderRadius: 12,
        overflow: "hidden",
        cursor: photo ? "default" : "pointer",
        background: photo ? "#0c0c0e" : drag ? "rgba(201,168,76,0.08)" : "var(--bg3)",
        border: photo ? "1.5px solid var(--gold-border)" : drag ? "1.5px dashed var(--gold)" : "1.5px dashed rgba(255,255,255,0.1)",
        transition: "all 0.2s ease",
      }}
    >
      {photo ? (
        <>
          <img src={photo.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 45%)" }} />
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(index); }}
            style={{
              position: "absolute", top: 6, right: 6,
              width: 24, height: 24, borderRadius: "50%",
              background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff", fontSize: 10, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(200,50,50,0.8)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.8)"}
          >✕</button>
          <div style={{
            position: "absolute", bottom: 6, left: 8,
            fontSize: 9, letterSpacing: "0.1em",
            color: "var(--gold)", textTransform: "uppercase", fontWeight: 600,
          }}>#{index + 1}</div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 6 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span style={{ fontSize: 9, color: "var(--text3)", letterSpacing: "0.08em" }}>Foto {index + 1}</span>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handle(e.target.files[0])} />
    </div>
  );
}

/* ─── EditField ─── */
function EditField({ label, value, onChange, multiline, rows = 5 }) {
  const [editing, setEditing] = useState(false);
  const inputStyle = {
    width: "100%",
    background: "var(--bg3)",
    border: "1.5px solid var(--gold-border)",
    borderRadius: "var(--radius-sm)",
    padding: "10px 12px",
    color: "var(--text)",
    fontSize: 13,
    lineHeight: 1.7,
    resize: "vertical",
    fontFamily: "inherit",
  };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 9, letterSpacing: "0.18em", color: "var(--text3)", textTransform: "uppercase", fontWeight: 600 }}>{label}</span>
        <button
          onClick={() => setEditing(!editing)}
          style={{
            background: editing ? "var(--gold-dim)" : "none",
            border: "1px solid rgba(255,255,255,0.1)",
            color: editing ? "var(--gold)" : "var(--text3)",
            borderRadius: 4, padding: "2px 8px",
            fontSize: 9, letterSpacing: "0.06em", cursor: "pointer", transition: "all 0.15s",
          }}
        >{editing ? "✓ Fertig" : "✎ Bearbeiten"}</button>
      </div>
      {editing
        ? multiline
          ? <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
          : <input value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, resize: "none" }} />
        : <div style={{
            background: "var(--surface)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 12px",
            fontSize: 13, color: "var(--text2)",
            lineHeight: 1.7, whiteSpace: "pre-wrap",
            minHeight: multiline ? 70 : "auto",
          }}>{value}</div>
      }
    </div>
  );
}

/* ─── StepDots ─── */
function StepDots({ step }) {
  const steps = ["upload", "loading", "result", "done"];
  const idx = steps.indexOf(step);
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 32 }}>
      {steps.filter(s => s !== "loading").map((s, i) => {
        const realIdx = i >= 1 ? i + 1 : i;
        const active = realIdx <= idx;
        return (
          <div key={s} style={{
            width: active ? 20 : 6, height: 6, borderRadius: 3,
            background: active ? "var(--gold)" : "rgba(255,255,255,0.12)",
            transition: "all 0.3s ease",
          }} />
        );
      })}
    </div>
  );
}

/* ─── Main ─── */
export default function Home() {
  const MAX_PHOTOS = 6;
  const [photos, setPhotos] = useState(Array(MAX_PHOTOS).fill(null));
  const [location, setLocation] = useState("St. Leon-Rot, 68789");
  const [step, setStep] = useState("upload");
  const [analysis, setAnalysis] = useState(null);
  const [listing, setListing] = useState(null);
  const [error, setError] = useState(null);
  const [correction, setCorrection] = useState("");
  const [tab, setTab] = useState("preview");
  const [copied, setCopied] = useState(false);
  const galleryRef = useRef();
  const cameraRef = useRef();
  const linkRef = useRef();

  /* photo handlers */
  const handleFile = useCallback((index, file) => {
    const preview = URL.createObjectURL(file);
    setPhotos(prev => { const n = [...prev]; n[index] = { file, preview }; return n; });
  }, []);

  const handleFiles = useCallback((fileList) => {
    const files = Array.from(fileList).filter(f => f.type.startsWith("image/")).slice(0, MAX_PHOTOS);
    if (!files.length) return;
    // Find first empty slots
    setPhotos(prev => {
      const next = [...prev];
      let slotIdx = 0;
      for (const file of files) {
        // Find next empty slot
        while (slotIdx < MAX_PHOTOS && next[slotIdx] !== null) slotIdx++;
        if (slotIdx >= MAX_PHOTOS) break;
        next[slotIdx] = { file, preview: URL.createObjectURL(file) };
        slotIdx++;
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

  const hasPhotos = photos.some(p => p !== null);
  const activeCount = photos.filter(p => p !== null).length;

  /* analyze */
  const doAnalyze = async (extraHint = "") => {
    setStep("loading");
    setError(null);
    try {
      const active = photos.filter(p => p !== null);
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
      setListing({
        titel: d.titel || "",
        preis: d.schaetzPreis || 0,
        beschreibung: d.beschreibung || "",
        kategorie: d.empfKategoriePfad || d.kategorie || "",
        zustand: d.zustand || "Gut",
        ort: location,
        versand: d.versandMoeglich ?? true,
      });
      setCorrection("");
      setTab("preview");
      setStep("result");
    } catch (e) {
      setError(e.message);
      setStep("upload");
    }
  };

  /* listing text */
  const listingText = listing
    ? `📦 ${listing.titel}
💰 ${listing.preis} €${listing.versand ? " · Versand möglich" : " · Nur Abholung"}
📍 ${listing.ort}
⭐ Zustand: ${listing.zustand}

${listing.beschreibung}

🏷️ ${listing.kategorie}${analysis?.tags?.length ? "\n" + analysis.tags.map(t => "#" + t).join(" ") : ""}`
    : "";

  /* freigabe */
  const handleFreigabe = () => {
    navigator.clipboard.writeText(listingText).catch(() => {});
    setStep("done");
    setTimeout(() => linkRef.current?.click(), 400);
  };

  /* copy */
  const copyText = () => {
    navigator.clipboard.writeText(listingText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* reset */
  const reset = () => {
    photos.forEach(p => p?.preview && URL.revokeObjectURL(p.preview));
    setPhotos(Array(MAX_PHOTOS).fill(null));
    setAnalysis(null); setListing(null);
    setError(null); setCorrection("");
    setStep("upload"); setTab("preview");
  };

  /* ── render ── */
  return (
    <main style={{ minHeight: "100vh", padding: "48px 20px 100px" }}>

      {/* hidden redirect link */}
      <a ref={linkRef} href="/api/redirect" target="_blank" rel="noreferrer" style={{ display: "none" }} aria-hidden>go</a>

      <div style={{ maxWidth: 580, margin: "0 auto" }}>

        {/* Header */}
        <header style={{ textAlign: "center", marginBottom: 40, animation: "fadeUp 0.5s ease both" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            fontSize: 9, letterSpacing: "0.3em", color: "var(--gold)",
            textTransform: "uppercase", fontWeight: 600,
            marginBottom: 20, padding: "6px 16px",
            border: "1px solid var(--gold-border)", borderRadius: 20,
            background: "var(--gold-dim)",
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--gold)", display: "inline-block" }} />
            KI-Verkaufsassistent
          </div>
          <h1 style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: "clamp(2.2rem, 8vw, 3.6rem)",
            fontWeight: 400, lineHeight: 1.1,
            marginBottom: 12, letterSpacing: "-0.01em",
          }}>
            Kleinanzeigen
            <br />
            <em style={{ color: "var(--text3)", fontStyle: "italic" }}>Assistent</em>
          </h1>
          <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.8, maxWidth: 320, margin: "0 auto" }}>
            Fotos hochladen — KI analysiert, bewertet<br />und schreibt die Anzeige automatisch.
          </p>
        </header>

        <StepDots step={step} />

        {/* ── UPLOAD ── */}
        {step === "upload" && (
          <div style={{ animation: "fadeUp 0.35s ease both" }}>

            {/* Photo Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
              {photos.map((p, i) => (
                <PhotoSlot key={i} index={i} photo={p} onFile={handleFile} onRemove={handleRemove} />
              ))}
            </div>

            {/* Upload Actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => galleryRef.current?.click()}
                style={{
                  padding: "13px 16px",
                  borderRadius: "var(--radius-sm)",
                  border: "1.5px dashed var(--gold-border)",
                  background: "var(--gold-dim)",
                  color: "var(--gold)",
                  fontSize: 12, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(201,168,76,0.18)"}
                onMouseLeave={e => e.currentTarget.style.background = "var(--gold-dim)"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                Galerie · bis zu 6 Fotos
              </button>
              <button
                onClick={() => cameraRef.current?.click()}
                style={{
                  padding: "13px 16px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "var(--surface)",
                  color: "var(--text2)",
                  fontSize: 12, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                onMouseLeave={e => e.currentTarget.style.background = "var(--surface)"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Kamera
              </button>
            </div>

            {/* Hidden file inputs */}
            <input ref={galleryRef} type="file" accept="image/*" multiple style={{ display: "none" }}
              onChange={(e) => handleFiles(e.target.files)} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files[0]; if (f) handleFiles([f]); }} />

            {/* Location */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "var(--bg3)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "var(--radius-sm)", padding: "11px 14px", marginBottom: 14,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" style={{ flexShrink: 0 }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: "var(--text3)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 2, fontWeight: 600 }}>Standort für Preisvergleich</div>
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  style={{ background: "none", border: "none", color: "var(--text)", fontSize: 13, width: "100%" }}
                />
              </div>
            </div>

            {error && (
              <div style={{
                background: "rgba(224,92,92,0.08)", border: "1px solid rgba(224,92,92,0.25)",
                borderRadius: "var(--radius-sm)", padding: "11px 14px",
                marginBottom: 14, fontSize: 12, color: "#e08080",
                display: "flex", gap: 8, alignItems: "flex-start",
              }}>
                <span style={{ flexShrink: 0 }}>⚠</span> {error}
              </div>
            )}

            {/* Analyze Button */}
            <button
              onClick={() => doAnalyze()}
              disabled={!hasPhotos}
              style={{
                width: "100%", padding: "16px",
                borderRadius: "var(--radius)", border: "none",
                background: hasPhotos
                  ? "linear-gradient(135deg, var(--gold-bright) 0%, var(--gold) 50%, #a8862a 100%)"
                  : "var(--surface)",
                color: hasPhotos ? "#0c0c0e" : "var(--text3)",
                fontSize: 12, fontWeight: 700,
                letterSpacing: "0.12em", textTransform: "uppercase",
                cursor: hasPhotos ? "pointer" : "not-allowed",
                transition: "all 0.2s",
                boxShadow: hasPhotos ? "0 4px 24px rgba(201,168,76,0.25)" : "none",
              }}
              onMouseEnter={e => hasPhotos && (e.currentTarget.style.boxShadow = "0 6px 32px rgba(201,168,76,0.4)")}
              onMouseLeave={e => hasPhotos && (e.currentTarget.style.boxShadow = "0 4px 24px rgba(201,168,76,0.25)")}
            >
              {hasPhotos ? `→ ${activeCount} Foto${activeCount > 1 ? "s" : ""} analysieren` : "Mindestens 1 Foto hochladen"}
            </button>
          </div>
        )}

        {/* ── LOADING ── */}
        {step === "loading" && (
          <div style={{ textAlign: "center", padding: "60px 0", animation: "fadeIn 0.3s ease" }}>
            <div style={{ position: "relative", width: 60, height: 60, margin: "0 auto 32px" }}>
              <div style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                border: "2px solid var(--gold-border)",
                animation: "pulse-ring 1.4s ease-out infinite",
              }} />
              <div style={{
                width: 60, height: 60, borderRadius: "50%",
                border: "2px solid transparent",
                borderTop: "2px solid var(--gold)",
                animation: "spin 0.9s linear infinite",
              }} />
            </div>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, marginBottom: 10 }}>Analysiere…</div>
            <div style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "0.08em", lineHeight: 2.2 }}>
              PRODUKTERKENNUNG · PREISRECHERCHE · TEXTERSTELLUNG
            </div>
          </div>
        )}

        {/* ── RESULT ── */}
        {step === "result" && analysis && listing && (
          <div style={{ animation: "fadeUp 0.35s ease both" }}>

            {/* Price Card */}
            <div style={{
              background: "linear-gradient(135deg, rgba(201,168,76,0.07) 0%, rgba(201,168,76,0.02) 100%)",
              border: "1px solid var(--gold-border)",
              borderRadius: "var(--radius)", padding: "22px",
              marginBottom: 14, position: "relative", overflow: "hidden",
            }}>
              {/* Decorative accent */}
              <div style={{
                position: "absolute", top: 0, right: 0,
                width: 120, height: 120,
                background: "radial-gradient(circle at top right, rgba(201,168,76,0.08) 0%, transparent 70%)",
              }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>Erkanntes Produkt</div>
                  <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, lineHeight: 1.3, marginBottom: 5 }}>{analysis.produktName}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{analysis.empfKategoriePfad || analysis.kategorie}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{
                    fontFamily: "'Instrument Serif', serif",
                    fontSize: 40, color: "var(--gold)", lineHeight: 1,
                    background: "linear-gradient(135deg, var(--gold-bright), var(--gold))",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  }}>
                    {listing.preis}
                    <span style={{ fontSize: 20, WebkitTextFillColor: "var(--gold)" }}> €</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}>
                    Markt: {analysis.preisRange} €
                  </div>
                </div>
              </div>

              {/* Zustand Badge */}
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 10, padding: "3px 10px", borderRadius: 20,
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--text2)", letterSpacing: "0.05em",
                }}>⭐ {analysis.zustand}</span>
                <span style={{
                  fontSize: 10, padding: "3px 10px", borderRadius: 20,
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--text2)",
                }}>{analysis.versandMoeglich ? "📦 Versand möglich" : "🤝 Nur Abholung"}</span>
              </div>

              {/* Strategy + Market Data */}
              {analysis.preisStrategie && (
                <div style={{ marginTop: 12, fontSize: 11, color: "var(--text3)", lineHeight: 1.6, fontStyle: "italic" }}>
                  {analysis.preisStrategie}
                </div>
              )}
              {analysis.marktdaten && (
                <div style={{
                  marginTop: 8, fontSize: 10, color: "var(--text3)",
                  background: "rgba(255,255,255,0.04)", borderRadius: 6,
                  padding: "5px 10px", letterSpacing: "0.03em",
                }}>
                  📊 {analysis.marktdaten}
                </div>
              )}
            </div>

            {/* Correction */}
            <div style={{
              background: "var(--bg3)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "var(--radius-sm)", padding: "14px", marginBottom: 14,
            }}>
              <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600, marginBottom: 10 }}>
                Produkt falsch erkannt? Korrigieren:
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={correction}
                  onChange={e => setCorrection(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && correction.trim() && doAnalyze(correction.trim())}
                  placeholder='z.B. "RØDE NT-USB Mikrofon"'
                  style={{
                    flex: 1, minWidth: 0,
                    background: "var(--bg2)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "var(--radius-sm)", padding: "10px 12px",
                    color: "var(--text)", fontSize: 12,
                  }}
                />
                <button
                  onClick={() => correction.trim() && doAnalyze(correction.trim())}
                  disabled={!correction.trim()}
                  style={{
                    padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "none",
                    background: correction.trim() ? "var(--gold)" : "var(--surface)",
                    color: correction.trim() ? "#0c0c0e" : "var(--text3)",
                    fontSize: 11, fontWeight: 700, cursor: correction.trim() ? "pointer" : "not-allowed",
                    whiteSpace: "nowrap", letterSpacing: "0.06em",
                  }}
                >↺ Neu</button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 2, background: "var(--bg3)", borderRadius: "var(--radius-sm)", padding: 3, marginBottom: 14 }}>
              {[["preview", "Vorschau"], ["edit", "Bearbeiten"]].map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1, padding: "9px",
                    borderRadius: 8, border: "none",
                    background: tab === t ? "var(--bg2)" : "none",
                    color: tab === t ? "var(--gold)" : "var(--text3)",
                    fontSize: 11, letterSpacing: "0.08em", cursor: "pointer",
                    boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
                    transition: "all 0.15s",
                  }}
                >{label}</button>
              ))}
            </div>

            {tab === "preview" && (
              <div style={{
                background: "var(--bg3)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "var(--radius-sm)", padding: "18px", marginBottom: 14,
              }}>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "var(--text2)", lineHeight: 1.9, fontFamily: "'JetBrains Mono', monospace" }}>
                  {listingText}
                </pre>
              </div>
            )}

            {tab === "edit" && (
              <div style={{ marginBottom: 14 }}>
                <EditField label="Titel (max. 60 Zeichen)" value={listing.titel} onChange={v => setListing({ ...listing, titel: v })} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600, marginBottom: 6 }}>Preis (€)</div>
                    <input
                      type="number"
                      value={listing.preis}
                      onChange={e => setListing({ ...listing, preis: Number(e.target.value) })}
                      style={{
                        width: "100%", background: "var(--bg3)",
                        border: "1.5px solid var(--gold-border)", borderRadius: "var(--radius-sm)",
                        padding: "10px 12px", color: "var(--gold)",
                        fontSize: 24, fontWeight: 700, fontFamily: "inherit",
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600, marginBottom: 6 }}>Zustand</div>
                    <select
                      value={listing.zustand}
                      onChange={e => setListing({ ...listing, zustand: e.target.value })}
                      style={{
                        width: "100%", background: "var(--bg3)",
                        border: "1px solid rgba(255,255,255,0.1)", borderRadius: "var(--radius-sm)",
                        padding: "10px 12px", color: "var(--text)", fontSize: 12, fontFamily: "inherit",
                      }}
                    >
                      {["Neu", "Wie neu", "Sehr gut", "Gut", "Befriedigend", "Defekt"].map(z => (
                        <option key={z} value={z} style={{ background: "#17171b" }}>{z}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <EditField label="Beschreibung" value={listing.beschreibung} onChange={v => setListing({ ...listing, beschreibung: v })} multiline rows={7} />
                <EditField label="Kategorie" value={listing.kategorie} onChange={v => setListing({ ...listing, kategorie: v })} />
                {/* Versand toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 2 }}>Versand möglich</div>
                    <div style={{ fontSize: 10, color: "var(--text3)" }}>Deutschlandweiter Versand anbieten</div>
                  </div>
                  <div
                    onClick={() => setListing({ ...listing, versand: !listing.versand })}
                    style={{
                      width: 44, height: 24, borderRadius: 12, cursor: "pointer",
                      background: listing.versand ? "var(--gold)" : "rgba(255,255,255,0.1)",
                      position: "relative", transition: "background 0.2s", flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 3,
                      left: listing.versand ? 23 : 3, transition: "left 0.2s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    }} />
                  </div>
                </div>
              </div>
            )}

            {/* Freigabe */}
            <button
              onClick={handleFreigabe}
              style={{
                width: "100%", padding: "16px", marginBottom: 8,
                borderRadius: "var(--radius)", border: "none",
                background: "linear-gradient(135deg, var(--gold-bright) 0%, var(--gold) 50%, #a8862a 100%)",
                color: "#0c0c0e", fontSize: 12, fontWeight: 700,
                letterSpacing: "0.12em", textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: "0 4px 24px rgba(201,168,76,0.3)",
                transition: "box-shadow 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 6px 32px rgba(201,168,76,0.5)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "0 4px 24px rgba(201,168,76,0.3)"}
            >
              🚀 Freigeben & Kleinanzeigen öffnen
            </button>

            <button
              onClick={() => setStep("upload")}
              style={{
                width: "100%", padding: "12px", borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(255,255,255,0.07)", background: "none",
                color: "var(--text3)", fontSize: 11, cursor: "pointer",
                letterSpacing: "0.06em",
              }}
            >← Fotos neu hochladen</button>
          </div>
        )}

        {/* ── DONE ── */}
        {step === "done" && listing && (
          <div style={{ animation: "fadeUp 0.35s ease both" }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 52, marginBottom: 16, animation: "fadeUp 0.5s ease both" }}>🎉</div>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, marginBottom: 8 }}>Freigegeben!</div>
              <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.8 }}>
                Text ist in der Zwischenablage — einfach auf Kleinanzeigen einfügen.
              </div>
            </div>

            {/* Steps */}
            <div style={{
              background: "var(--bg3)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "var(--radius)", padding: "20px", marginBottom: 14,
            }}>
              <div style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600, marginBottom: 16 }}>Nächste Schritte</div>
              {[
                ["Kleinanzeigen öffnen & einloggen", "Button unten klicken"],
                ["Kategorie wählen", listing.kategorie],
                ['„Anzeige aufgeben" klicken', ""],
                ["Titel & Text einfügen", "Strg+V / Einfügen"],
                [`Preis eintragen: ${listing.preis} €`, "Fotos direkt dort hochladen"],
              ].map(([title, sub], i) => (
                <div key={i} style={{ display: "flex", gap: 12, marginBottom: i < 4 ? 14 : 0, alignItems: "flex-start" }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: "var(--gold)", color: "#0c0c0e",
                    fontSize: 10, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>{i + 1}</div>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 1 }}>{title}</div>
                    {sub && <div style={{ fontSize: 10, color: "var(--text3)" }}>{sub}</div>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              <a
                href="/api/redirect" target="_blank" rel="noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "14px",
                  borderRadius: "var(--radius-sm)",
                  background: "linear-gradient(135deg, var(--gold-bright), var(--gold))",
                  color: "#0c0c0e", fontSize: 12, fontWeight: 700,
                  textDecoration: "none", letterSpacing: "0.06em",
                  boxShadow: "0 4px 20px rgba(201,168,76,0.25)",
                }}
              >→ Kleinanzeigen</a>
              <button
                onClick={copyText}
                style={{
                  padding: "14px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--gold-border)",
                  background: copied ? "var(--gold-dim)" : "transparent",
                  color: "var(--gold)", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", letterSpacing: "0.06em",
                  transition: "all 0.15s",
                }}
              >{copied ? "✓ Kopiert!" : "📋 Text kopieren"}</button>
            </div>

            {/* Preview */}
            <div style={{
              background: "var(--bg3)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "var(--radius-sm)", padding: "16px", marginBottom: 14,
            }}>
              <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600, marginBottom: 10 }}>Dein Anzeigentext</div>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "var(--text3)", lineHeight: 1.8, fontFamily: "inherit" }}>{listingText}</pre>
            </div>

            <button
              onClick={reset}
              style={{
                width: "100%", padding: "13px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(255,255,255,0.08)", background: "none",
                color: "var(--text3)", fontSize: 11, cursor: "pointer", letterSpacing: "0.08em",
              }}
            >↺ Neuen Artikel aufgeben</button>
          </div>
        )}

        <footer style={{ marginTop: 60, textAlign: "center", fontSize: 9, color: "var(--text3)", lineHeight: 2.5, letterSpacing: "0.08em" }}>
          PREISE BASIEREN AUF MARKTRECHERCHE · KEIN ANSPRUCH AUF GENAUIGKEIT
        </footer>
      </div>
    </main>
  );
}
