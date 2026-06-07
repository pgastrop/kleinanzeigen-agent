"use client";

import { useState, useRef } from "react";

const GOLD = "#d4af37";
const GOLD_DIM = "rgba(212,175,55,0.15)";
const GOLD_BORDER = "rgba(212,175,55,0.25)";

/* ── helpers ── */
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target.result.split(",")[1]);
    r.onerror = () => rej(new Error("Lesen fehlgeschlagen"));
    r.readAsDataURL(file);
  });
}

/* ── sub-components ── */

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
        position: "relative",
        aspectRatio: "4/3",
        border: photo
          ? `2px solid ${GOLD}`
          : drag
          ? `2px dashed ${GOLD}`
          : "2px dashed rgba(255,255,255,0.12)",
        borderRadius: 16,
        overflow: "hidden",
        cursor: photo ? "default" : "pointer",
        background: photo ? "#111" : drag ? GOLD_DIM : "rgba(255,255,255,0.02)",
        transition: "all 0.25s",
      }}
    >
      {photo ? (
        <>
          <img
            src={photo.preview}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)",
          }} />
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(index); }}
            style={{
              position: "absolute", top: 10, right: 10,
              width: 30, height: 30, borderRadius: "50%",
              background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.2)",
              color: "#fff", fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
          <div style={{
            position: "absolute", bottom: 10, left: 12,
            fontSize: 11, letterSpacing: "0.12em", color: GOLD,
            textTransform: "uppercase",
          }}>
            Foto {index + 1} ✓
          </div>
        </>
      ) : (
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          height: "100%", gap: 10,
        }}>
          <div style={{ fontSize: 38, opacity: 0.25 }}>⬡</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", lineHeight: 1.6 }}>
            Foto {index + 1}<br />
            <span style={{ fontSize: 10, opacity: 0.6 }}>klicken · ziehen · einfügen</span>
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => handle(e.target.files[0])}
      />
    </div>
  );
}

function Tag({ children }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: 20,
      border: `1px solid ${GOLD_BORDER}`,
      background: GOLD_DIM,
      fontSize: 11,
      color: GOLD,
      letterSpacing: "0.05em",
    }}>{children}</span>
  );
}

function Field({ label, value, onChange, multiline, rows = 5 }) {
  const [editing, setEditing] = useState(false);
  const shared = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${GOLD_BORDER}`,
    borderRadius: 10,
    padding: "10px 14px",
    color: "#f0ede8",
    fontSize: 13,
    lineHeight: 1.7,
    resize: "vertical",
  };
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 10, letterSpacing: "0.15em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>{label}</span>
        <button
          onClick={() => setEditing(!editing)}
          style={{
            background: "none", border: `1px solid rgba(255,255,255,0.12)`,
            color: "rgba(255,255,255,0.4)", borderRadius: 4,
            padding: "2px 8px", fontSize: 10, cursor: "pointer", letterSpacing: "0.05em",
          }}
        >{editing ? "✓ Fertig" : "✎ Edit"}</button>
      </div>
      {editing ? (
        multiline
          ? <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} style={shared} />
          : <input value={value} onChange={(e) => onChange(e.target.value)} style={{ ...shared, resize: "none" }} />
      ) : (
        <div style={{
          ...shared,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
          whiteSpace: "pre-wrap",
          minHeight: multiline ? 80 : "auto",
          color: "rgba(255,255,255,0.8)",
        }}>{value}</div>
      )}
    </div>
  );
}

/* ── main ── */

export default function Home() {
  const [photos, setPhotos] = useState([null, null]);
  const [location, setLocation] = useState("St. Leon-Rot, 68789");
  const [step, setStep] = useState("upload"); // upload | loading | result
  const [analysis, setAnalysis] = useState(null);
  const [listing, setListing] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState("preview"); // preview | edit

  const handleFile = async (index, file) => {
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

  const analyze = async () => {
    if (!photos[0] || !photos[1]) return;
    setStep("loading");
    setError(null);
    try {
      const [b1, b2] = await Promise.all([
        fileToBase64(photos[0].file),
        fileToBase64(photos[1].file),
      ]);

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo1: b1,
          photo2: b2,
          mimeType1: photos[0].mimeType,
          mimeType2: photos[1].mimeType,
          location,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Unbekannter Fehler");

      const d = json.data;
      setAnalysis(d);
      setListing({
        titel: d.titel,
        preis: d.schaetzPreis,
        beschreibung: d.beschreibung,
        kategorie: d.empfKategoriePfad,
        zustand: d.zustand,
        ort: location,
        versand: d.versandMoeglich,
      });
      setStep("result");
    } catch (e) {
      setError(e.message);
      setStep("upload");
    }
  };

  const listingText = listing
    ? `📦 ${listing.titel}
💰 ${listing.preis} €${listing.versand ? " · Versand möglich" : " · Nur Abholung"}
📍 ${listing.ort}
⭐ Zustand: ${listing.zustand}

${listing.beschreibung}

🏷️ ${listing.kategorie}${analysis?.tags?.length ? "\n" + analysis.tags.map((t) => "#" + t).join(" ") : ""}`
    : "";

  const copy = () => {
    navigator.clipboard.writeText(listingText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    photos.forEach((p) => p?.preview && URL.revokeObjectURL(p.preview));
    setPhotos([null, null]);
    setAnalysis(null);
    setListing(null);
    setStep("upload");
    setTab("preview");
  };

  /* ── render ── */

  return (
    <main style={{ minHeight: "100vh", padding: "48px 20px 80px" }}>
      <div style={{ maxWidth: 660, margin: "0 auto" }}>

        {/* Header */}
        <header style={{ textAlign: "center", marginBottom: 56, animation: "fadeUp 0.5s ease both" }}>
          <div style={{
            display: "inline-block",
            fontSize: 10, letterSpacing: "0.35em", color: GOLD,
            textTransform: "uppercase", marginBottom: 16,
            padding: "5px 14px", border: `1px solid ${GOLD_BORDER}`, borderRadius: 20,
          }}>
            KI-Verkaufsassistent
          </div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(2rem, 6vw, 3rem)",
            fontWeight: 400,
            lineHeight: 1.15,
            marginBottom: 12,
          }}>
            Kleinanzeigen<br />
            <span style={{ color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>Sofort-Assistent</span>
          </h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.8, maxWidth: 400, margin: "0 auto" }}>
            Zwei Fotos hochladen — die KI analysiert den Artikel,<br />
            schätzt den Marktpreis und schreibt die Anzeige.
          </p>
        </header>

        {/* UPLOAD */}
        {step === "upload" && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>
            {/* Photos */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              {[0, 1].map((i) => (
                <PhotoSlot key={i} index={i} photo={photos[i]} onFile={handleFile} onRemove={handleRemove} />
              ))}
            </div>

            {/* Location */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, padding: "12px 16px", marginBottom: 20,
            }}>
              <span style={{ fontSize: 16, opacity: 0.5 }}>◎</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>
                  Standort · Preisvergleich
                </div>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  style={{ background: "none", border: "none", color: "#f0ede8", fontSize: 13, width: "100%", outline: "none" }}
                />
              </div>
            </div>

            {error && (
              <div style={{
                background: "rgba(200,50,50,0.08)", border: "1px solid rgba(200,50,50,0.25)",
                borderRadius: 10, padding: "12px 16px", marginBottom: 16,
                fontSize: 12, color: "#ff8080",
              }}>⚠ {error}</div>
            )}

            <button
              onClick={analyze}
              disabled={!photos[0] || !photos[1]}
              style={{
                width: "100%", padding: "17px",
                borderRadius: 12, border: "none",
                background: photos[0] && photos[1]
                  ? `linear-gradient(135deg, ${GOLD}, #b8962f)`
                  : "rgba(255,255,255,0.06)",
                color: photos[0] && photos[1] ? "#0a0a0a" : "rgba(255,255,255,0.2)",
                fontSize: 13, fontWeight: "bold", letterSpacing: "0.08em",
                textTransform: "uppercase", cursor: photos[0] && photos[1] ? "pointer" : "not-allowed",
                transition: "all 0.2s",
              }}
            >
              {photos[0] && photos[1]
                ? "→ KI-Analyse starten"
                : `Noch ${[!photos[0], !photos[1]].filter(Boolean).length} Foto(s) fehlen`}
            </button>
          </div>
        )}

        {/* LOADING */}
        {step === "loading" && (
          <div style={{ textAlign: "center", padding: "60px 0", animation: "fadeUp 0.3s ease" }}>
            <div style={{
              width: 52, height: 52, margin: "0 auto 28px",
              border: `3px solid ${GOLD_DIM}`,
              borderTop: `3px solid ${GOLD}`,
              borderRadius: "50%",
              animation: "spin 0.9s linear infinite",
            }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 10 }}>
              Analysiere Fotos…
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 2 }}>
              Produkterkennung · Zustandsbewertung<br />
              Marktpreisrecherche · Textgenerierung
            </div>
          </div>
        )}

        {/* RESULT */}
        {step === "result" && analysis && listing && (
          <div style={{ animation: "fadeUp 0.4s ease both" }}>

            {/* Price hero */}
            <div style={{
              background: `linear-gradient(135deg, rgba(212,175,55,0.08), rgba(212,175,55,0.03))`,
              border: `1px solid ${GOLD_BORDER}`,
              borderRadius: 18, padding: "24px 28px", marginBottom: 24,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: GOLD, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>
                    Erkanntes Produkt
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 6 }}>
                    {analysis.produktName}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                    {analysis.empfKategoriePfad}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 38, color: GOLD, lineHeight: 1,
                  }}>
                    {listing.preis} <span style={{ fontSize: 20 }}>€</span>
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                    Markt: {analysis.preisRange} €
                  </div>
                </div>
              </div>

              <div style={{
                marginTop: 18, paddingTop: 16,
                borderTop: "1px solid rgba(255,255,255,0.07)",
                display: "flex", gap: 24, flexWrap: "wrap",
              }}>
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Zustand</div>
                  <div style={{ fontSize: 13, marginTop: 3 }}>{analysis.zustand}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Versand</div>
                  <div style={{ fontSize: 13, marginTop: 3 }}>{analysis.versandMoeglich ? "Möglich" : "Nur Abholung"}</div>
                </div>
              </div>

              <div style={{
                marginTop: 14, fontSize: 12, color: "rgba(255,255,255,0.4)",
                lineHeight: 1.6, fontStyle: "italic",
              }}>
                💡 {analysis.preisBegruendung}
              </div>

              {analysis.zustandsBeschreibung && (
                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                  🔍 {analysis.zustandsBeschreibung}
                </div>
              )}
            </div>

            {/* Features / tags */}
            {analysis.besonderheiten?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
                  Highlights
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {analysis.besonderheiten.map((f, i) => <Tag key={i}>✦ {f}</Tag>)}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 20 }}>
              {["preview", "edit"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: "10px 20px",
                    background: "none", border: "none",
                    borderBottom: tab === t ? `2px solid ${GOLD}` : "2px solid transparent",
                    color: tab === t ? GOLD : "rgba(255,255,255,0.35)",
                    fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
                    cursor: "pointer", transition: "all 0.2s",
                  }}
                >
                  {t === "preview" ? "Vorschau" : "Bearbeiten"}
                </button>
              ))}
            </div>

            {/* Preview tab */}
            {tab === "preview" && (
              <div style={{
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 14, padding: "20px 22px", marginBottom: 20,
              }}>
                <pre style={{
                  whiteSpace: "pre-wrap", fontSize: 13, color: "rgba(255,255,255,0.75)",
                  lineHeight: 1.8, fontFamily: "'DM Mono', monospace",
                }}>
                  {listingText}
                </pre>
              </div>
            )}

            {/* Edit tab */}
            {tab === "edit" && (
              <div style={{ marginBottom: 20 }}>
                <Field label="Titel (max. 60 Zeichen)" value={listing.titel} onChange={(v) => setListing({ ...listing, titel: v })} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Preis (€)</div>
                    <input
                      type="number"
                      value={listing.preis}
                      onChange={(e) => setListing({ ...listing, preis: e.target.value })}
                      style={{
                        width: "100%", background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${GOLD_BORDER}`, borderRadius: 10,
                        padding: "10px 14px", color: GOLD, fontSize: 22, fontWeight: "bold",
                        outline: "none",
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Zustand</div>
                    <select
                      value={listing.zustand}
                      onChange={(e) => setListing({ ...listing, zustand: e.target.value })}
                      style={{
                        width: "100%", background: "#111",
                        border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
                        padding: "10px 14px", color: "#f0ede8", fontSize: 13, outline: "none",
                      }}
                    >
                      {["Neu", "Wie neu", "Sehr gut", "Gut", "Befriedigend", "Defekt"].map((z) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <Field label="Beschreibung" value={listing.beschreibung} onChange={(v) => setListing({ ...listing, beschreibung: v })} multiline rows={8} />
                <Field label="Kategorie" value={listing.kategorie} onChange={(v) => setListing({ ...listing, kategorie: v })} />
                <Field label="Standort" value={listing.ort} onChange={(v) => setListing({ ...listing, ort: v })} />

                {/* Versand toggle */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: "14px 16px",
                }}>
                  <div>
                    <div style={{ fontSize: 13, marginBottom: 2 }}>Versand möglich</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Deutschlandweiter Versand anbieten</div>
                  </div>
                  <div
                    onClick={() => setListing({ ...listing, versand: !listing.versand })}
                    style={{
                      width: 48, height: 26, borderRadius: 13, cursor: "pointer",
                      background: listing.versand ? GOLD : "rgba(255,255,255,0.12)",
                      position: "relative", transition: "background 0.2s",
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: "50%", background: "#fff",
                      position: "absolute", top: 3,
                      left: listing.versand ? 25 : 3, transition: "left 0.2s",
                    }} />
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <button
                onClick={copy}
                style={{
                  padding: "15px", borderRadius: 12,
                  border: `1px solid ${GOLD_BORDER}`,
                  background: GOLD_DIM, color: GOLD,
                  fontSize: 12, fontWeight: "bold", letterSpacing: "0.08em",
                  textTransform: "uppercase", cursor: "pointer",
                }}
              >{copied ? "✓ Kopiert!" : "Kopieren"}</button>
              <a
                href="https://www.kleinanzeigen.de/anzeige-aufgeben"
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "15px", borderRadius: 12, border: "none",
                  background: `linear-gradient(135deg, ${GOLD}, #b8962f)`,
                  color: "#0a0a0a", fontSize: 12, fontWeight: "bold",
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  cursor: "pointer", textDecoration: "none", display: "block", textAlign: "center",
                }}
              >→ Kleinanzeigen</a>
            </div>

            <button
              onClick={reset}
              style={{
                width: "100%", padding: "13px", borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.07)", background: "none",
                color: "rgba(255,255,255,0.25)", fontSize: 11,
                letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
              }}
            >↺ Neuen Artikel analysieren</button>
          </div>
        )}

        {/* Footer */}
        <footer style={{ marginTop: 60, textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.15)", lineHeight: 2 }}>
          Preise basieren auf KI-Schätzung · Kein Anspruch auf Marktgenauigkeit<br />
          Powered by Claude Vision API
        </footer>
      </div>
    </main>
  );
}
