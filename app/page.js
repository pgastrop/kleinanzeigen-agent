"use client";

import { useState, useRef } from "react";

const GOLD = "#d4af37";
const GOLD_DIM = "rgba(212,175,55,0.15)";
const GOLD_BORDER = "rgba(212,175,55,0.25)";

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target.result.split(",")[1]);
    r.onerror = () => rej(new Error("Lesen fehlgeschlagen"));
    r.readAsDataURL(file);
  });
}

function PhotoSlot({ index, photo, onFile, onRemove }) {
  const inputRef = useRef();
  const [drag, setDrag] = useState(false);
  const handle = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    onFile(index, file);
  };
  return (
    <div
      onClick={() => !photo && inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
      style={{
        position: "relative", aspectRatio: "4/3",
        border: photo ? `2px solid ${GOLD}` : drag ? `2px dashed ${GOLD}` : "2px dashed rgba(255,255,255,0.12)",
        borderRadius: 16, overflow: "hidden",
        cursor: photo ? "default" : "pointer",
        background: photo ? "#111" : drag ? GOLD_DIM : "rgba(255,255,255,0.02)",
        transition: "all 0.25s",
      }}
    >
      {photo ? (
        <>
          <img src={photo.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)" }} />
          <button onClick={(e) => { e.stopPropagation(); onRemove(index); }} style={{
            position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: "50%",
            background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
          <div style={{ position: "absolute", bottom: 10, left: 12, fontSize: 11, letterSpacing: "0.12em", color: GOLD, textTransform: "uppercase" }}>
            Foto {index + 1} ✓
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
          <div style={{ fontSize: 38, opacity: 0.25 }}>⬡</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", lineHeight: 1.6 }}>
            Foto {index + 1}<br /><span style={{ fontSize: 10, opacity: 0.6 }}>klicken · ziehen</span>
          </div>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handle(e.target.files[0])} />
    </div>
  );
}

function Field({ label, value, onChange, multiline, rows = 5 }) {
  const [editing, setEditing] = useState(false);
  const shared = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${GOLD_BORDER}`,
    borderRadius: 10, padding: "10px 14px", color: "#f0ede8", fontSize: 13, lineHeight: 1.7, resize: "vertical",
  };
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 10, letterSpacing: "0.15em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>{label}</span>
        <button onClick={() => setEditing(!editing)} style={{
          background: "none", border: `1px solid rgba(255,255,255,0.12)`, color: "rgba(255,255,255,0.4)",
          borderRadius: 4, padding: "2px 8px", fontSize: 10, cursor: "pointer",
        }}>{editing ? "✓ Fertig" : "✎ Edit"}</button>
      </div>
      {editing ? (
        multiline
          ? <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} style={shared} />
          : <input value={value} onChange={(e) => onChange(e.target.value)} style={{ ...shared, resize: "none" }} />
      ) : (
        <div style={{
          ...shared, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)",
          whiteSpace: "pre-wrap", minHeight: multiline ? 80 : "auto", color: "rgba(255,255,255,0.8)",
        }}>{value}</div>
      )}
    </div>
  );
}

export default function Home() {
  const [photos, setPhotos] = useState([null, null]);
  const [location, setLocation] = useState("St. Leon-Rot, 68789");
  const [step, setStep] = useState("upload"); // upload | loading | correct | preview | done
  const [analysis, setAnalysis] = useState(null);
  const [listing, setListing] = useState(null);
  const [error, setError] = useState(null);
  const [correction, setCorrection] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [tab, setTab] = useState("preview");
  const [approved, setApproved] = useState(false);

  const handleFile = (index, file) => {
    const preview = URL.createObjectURL(file);
    const next = [...photos];
    next[index] = { file, preview, mimeType: file.type };
    setPhotos(next);
  };

  const handleRemove = (index) => {
    const next = [...photos];
    if (next[index]?.preview) URL.revokeObjectURL(next[index].preview);
    next[index] = null;
    setPhotos(next);
  };

  const doAnalyze = async (extraHint = "") => {
    setStep("loading");
    setError(null);
    try {
      const [b1, b2] = await Promise.all([fileToBase64(photos[0].file), fileToBase64(photos[1].file)]);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo1: b1, photo2: b2,
          mimeType1: photos[0].mimeType, mimeType2: photos[1].mimeType,
          location, extraHint,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Fehler");
      const d = json.data;
      setAnalysis(d);
      setListing({ titel: d.titel, preis: d.schaetzPreis, beschreibung: d.beschreibung, kategorie: d.empfKategoriePfad, zustand: d.zustand, ort: location, versand: d.versandMoeglich });
      setStep("correct");
      setCorrection("");
      setCorrecting(false);
    } catch (e) {
      setError(e.message);
      setStep("upload");
    }
  };

  const applyCorrection = async () => {
    if (!correction.trim()) return;
    await doAnalyze(correction.trim());
  };

  const listingText = listing ? `📦 ${listing.titel}
💰 ${listing.preis} €${listing.versand ? " · Versand möglich" : " · Nur Abholung"}
📍 ${listing.ort}
⭐ Zustand: ${listing.zustand}

${listing.beschreibung}

🏷️ ${listing.kategorie}${analysis?.tags?.length ? "\n" + analysis.tags.map(t => "#" + t).join(" ") : ""}` : "";

  const handleFreigabe = () => {
    navigator.clipboard.writeText(listingText).catch(() => {});
    setApproved(true);
    setStep("done");
    setTimeout(() => {
      window.open("https://www.kleinanzeigen.de/anzeige-aufgeben", "_blank");
    }, 800);
  };

  const reset = () => {
    photos.forEach(p => p?.preview && URL.revokeObjectURL(p.preview));
    setPhotos([null, null]); setAnalysis(null); setListing(null);
    setStep("upload"); setApproved(false); setCorrection(""); setCorrecting(false);
  };

  return (
    <main style={{ minHeight: "100vh", padding: "48px 20px 80px" }}>
      <div style={{ maxWidth: 660, margin: "0 auto" }}>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0a0a0a; color: #f0ede8; font-family: 'DM Mono', monospace; }
          @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
          button:hover { opacity: 0.85; }
          input:focus, textarea:focus, select:focus { outline: none; }
          ::-webkit-scrollbar { width: 5px; }
          ::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.3); border-radius: 3px; }
        `}</style>

        {/* Header */}
        <header style={{ textAlign: "center", marginBottom: 48, animation: "fadeUp 0.5s ease both" }}>
          <div style={{ display: "inline-block", fontSize: 10, letterSpacing: "0.35em", color: GOLD, textTransform: "uppercase", marginBottom: 16, padding: "5px 14px", border: `1px solid ${GOLD_BORDER}`, borderRadius: 20 }}>
            KI-Verkaufsassistent
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2rem, 6vw, 3rem)", fontWeight: 400, lineHeight: 1.15, marginBottom: 12 }}>
            Kleinanzeigen<br /><span style={{ color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>Sofort-Assistent</span>
          </h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.8 }}>
            Zwei Fotos hochladen — KI analysiert, bewertet und schreibt die Anzeige.
          </p>
        </header>

        {/* UPLOAD */}
        {step === "upload" && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              {[0, 1].map(i => <PhotoSlot key={i} index={i} photo={photos[i]} onFile={handleFile} onRemove={handleRemove} />)}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 16px", marginBottom: 20 }}>
              <span style={{ fontSize: 16, opacity: 0.5 }}>◎</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>Standort · Preisvergleich</div>
                <input value={location} onChange={e => setLocation(e.target.value)} style={{ background: "none", border: "none", color: "#f0ede8", fontSize: 13, width: "100%" }} />
              </div>
            </div>
            {error && <div style={{ background: "rgba(200,50,50,0.08)", border: "1px solid rgba(200,50,50,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: "#ff8080" }}>⚠ {error}</div>}
            <button onClick={() => doAnalyze()} disabled={!photos[0] || !photos[1]} style={{
              width: "100%", padding: "17px", borderRadius: 12, border: "none",
              background: photos[0] && photos[1] ? `linear-gradient(135deg, ${GOLD}, #b8962f)` : "rgba(255,255,255,0.06)",
              color: photos[0] && photos[1] ? "#0a0a0a" : "rgba(255,255,255,0.2)",
              fontSize: 13, fontWeight: "bold", letterSpacing: "0.08em", textTransform: "uppercase",
              cursor: photos[0] && photos[1] ? "pointer" : "not-allowed",
            }}>
              {photos[0] && photos[1] ? "→ KI-Analyse starten" : `Noch ${[!photos[0], !photos[1]].filter(Boolean).length} Foto(s) fehlen`}
            </button>
          </div>
        )}

        {/* LOADING */}
        {step === "loading" && (
          <div style={{ textAlign: "center", padding: "60px 0", animation: "fadeUp 0.3s ease" }}>
            <div style={{ width: 52, height: 52, margin: "0 auto 28px", border: `3px solid ${GOLD_DIM}`, borderTop: `3px solid ${GOLD}`, borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 10 }}>Analysiere Fotos…</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 2 }}>
              Produkterkennung · Zustandsbewertung<br />Marktpreisrecherche · Textgenerierung
            </div>
          </div>
        )}

        {/* KORREKTUR-SCHRITT */}
        {step === "correct" && analysis && listing && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            {/* Erkanntes Produkt */}
            <div style={{ background: `linear-gradient(135deg, rgba(212,175,55,0.08), rgba(212,175,55,0.03))`, border: `1px solid ${GOLD_BORDER}`, borderRadius: 18, padding: "24px 28px", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: GOLD, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>Erkanntes Produkt</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 6 }}>{analysis.produktName}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{analysis.empfKategoriePfad}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 38, color: GOLD, lineHeight: 1 }}>{listing.preis} <span style={{ fontSize: 20 }}>€</span></div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>Markt: {analysis.preisRange} €</div>
                </div>
              </div>
              <div style={{ marginTop: 14, fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, fontStyle: "italic" }}>
                💡 {analysis.preisBegruendung}
              </div>
            </div>

            {/* Korrektur-Box */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: correcting ? `1px solid ${GOLD_BORDER}` : "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px 20px", marginBottom: 20, transition: "border 0.2s" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: correcting ? 12 : 0 }}>
                <div>
                  <div style={{ fontSize: 13, color: "#f0ede8", marginBottom: 2 }}>Artikel falsch erkannt?</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Korrigiere den Produktnamen und analysiere neu</div>
                </div>
                <button onClick={() => setCorrecting(!correcting)} style={{
                  background: correcting ? GOLD_DIM : "rgba(255,255,255,0.05)",
                  border: `1px solid ${correcting ? GOLD_BORDER : "rgba(255,255,255,0.12)"}`,
                  color: correcting ? GOLD : "rgba(255,255,255,0.5)",
                  borderRadius: 8, padding: "6px 14px", fontSize: 11, cursor: "pointer", letterSpacing: "0.05em",
                }}>
                  {correcting ? "✕ Abbrechen" : "✎ Korrigieren"}
                </button>
              </div>

              {correcting && (
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    autoFocus
                    value={correction}
                    onChange={e => setCorrection(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && correction.trim() && applyCorrection()}
                    placeholder='z.B. "RØDE NT-USB Mikrofon mit Arm"'
                    style={{
                      flex: 1, background: "rgba(255,255,255,0.05)", border: `1px solid ${GOLD_BORDER}`,
                      borderRadius: 10, padding: "10px 14px", color: "#f0ede8", fontSize: 13,
                    }}
                  />
                  <button onClick={applyCorrection} disabled={!correction.trim()} style={{
                    padding: "10px 18px", borderRadius: 10, border: "none",
                    background: correction.trim() ? GOLD : "rgba(255,255,255,0.08)",
                    color: correction.trim() ? "#0a0a0a" : "rgba(255,255,255,0.3)",
                    fontSize: 12, fontWeight: "bold", cursor: correction.trim() ? "pointer" : "not-allowed", whiteSpace: "nowrap",
                  }}>→ Neu analysieren</button>
                </div>
              )}
            </div>

            {/* Weiter zur Vorschau */}
            <button onClick={() => setStep("preview")} style={{
              width: "100%", padding: "17px", borderRadius: 12, border: "none",
              background: `linear-gradient(135deg, ${GOLD}, #b8962f)`, color: "#0a0a0a",
              fontSize: 13, fontWeight: "bold", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
            }}>→ Anzeige prüfen & freigeben</button>

            <button onClick={() => setStep("upload")} style={{ width: "100%", marginTop: 10, padding: "12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "none", color: "rgba(255,255,255,0.3)", fontSize: 11, letterSpacing: "0.06em", cursor: "pointer" }}>
              ← Fotos neu hochladen
            </button>
          </div>
        )}

        {/* VORSCHAU & FREIGABE */}
        {step === "preview" && listing && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 20 }}>
              {["preview", "edit"].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: "10px 20px", background: "none", border: "none",
                  borderBottom: tab === t ? `2px solid ${GOLD}` : "2px solid transparent",
                  color: tab === t ? GOLD : "rgba(255,255,255,0.35)",
                  fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer",
                }}>{t === "preview" ? "Vorschau" : "Bearbeiten"}</button>
              ))}
            </div>

            {tab === "preview" && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 22px", marginBottom: 20 }}>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.8, fontFamily: "'DM Mono', monospace" }}>{listingText}</pre>
              </div>
            )}

            {tab === "edit" && (
              <div style={{ marginBottom: 20 }}>
                <Field label="Titel (max. 60 Zeichen)" value={listing.titel} onChange={v => setListing({ ...listing, titel: v })} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Preis (€)</div>
                    <input type="number" value={listing.preis} onChange={e => setListing({ ...listing, preis: e.target.value })}
                      style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${GOLD_BORDER}`, borderRadius: 10, padding: "10px 14px", color: GOLD, fontSize: 22, fontWeight: "bold" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Zustand</div>
                    <select value={listing.zustand} onChange={e => setListing({ ...listing, zustand: e.target.value })}
                      style={{ width: "100%", background: "#111", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 14px", color: "#f0ede8", fontSize: 13 }}>
                      {["Neu", "Wie neu", "Sehr gut", "Gut", "Befriedigend", "Defekt"].map(z => <option key={z} value={z}>{z}</option>)}
                    </select>
                  </div>
                </div>
                <Field label="Beschreibung" value={listing.beschreibung} onChange={v => setListing({ ...listing, beschreibung: v })} multiline rows={8} />
                <Field label="Kategorie" value={listing.kategorie} onChange={v => setListing({ ...listing, kategorie: v })} />
              </div>
            )}

            {/* FREIGABE */}
            <div style={{ background: "rgba(212,175,55,0.05)", border: `1px solid ${GOLD_BORDER}`, borderRadius: 14, padding: "20px 22px", marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: GOLD, fontWeight: "bold", marginBottom: 6, letterSpacing: "0.05em" }}>
                ✓ Anzeige freigeben
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, marginBottom: 16 }}>
                Nach der Freigabe wird der Anzeigentext automatisch in die Zwischenablage kopiert und Kleinanzeigen.de geöffnet — du musst nur noch einfügen.
              </div>
              <button onClick={handleFreigabe} style={{
                width: "100%", padding: "17px", borderRadius: 12, border: "none",
                background: `linear-gradient(135deg, ${GOLD}, #b8962f)`, color: "#0a0a0a",
                fontSize: 14, fontWeight: "bold", letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
              }}>
                🚀 Freigeben & Kleinanzeigen öffnen
              </button>
            </div>

            <button onClick={() => setStep("correct")} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "none", color: "rgba(255,255,255,0.3)", fontSize: 11, cursor: "pointer" }}>
              ← Zurück zur Analyse
            </button>
          </div>
        )}

        {/* DONE */}
        {step === "done" && (
          <div style={{ textAlign: "center", padding: "40px 0", animation: "fadeUp 0.4s ease both" }}>
            <div style={{ fontSize: 64, marginBottom: 24 }}>🎉</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, marginBottom: 12 }}>Freigegeben!</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.8, marginBottom: 32 }}>
              Anzeigentext wurde in die Zwischenablage kopiert.<br />
              Kleinanzeigen.de wurde geöffnet — einfach einfügen.
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "16px 20px", marginBottom: 24, textAlign: "left" }}>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, fontFamily: "inherit" }}>{listingText}</pre>
            </div>
            <button onClick={reset} style={{
              width: "100%", padding: "15px", borderRadius: 12, border: "none",
              background: `linear-gradient(135deg, ${GOLD}, #b8962f)`, color: "#0a0a0a",
              fontSize: 13, fontWeight: "bold", letterSpacing: "0.08em", cursor: "pointer",
            }}>↺ Neuen Artikel aufgeben</button>
          </div>
        )}

        <footer style={{ marginTop: 60, textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.15)", lineHeight: 2 }}>
          Preise basieren auf KI-Schätzung · Kein Anspruch auf Marktgenauigkeit
        </footer>
      </div>
    </main>
  );
}
