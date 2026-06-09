import { checkRateLimit } from "../../../lib/ratelimit.js";
import { validateEnv }    from "../../../lib/env.js";

export const maxDuration = 60;

const MAX_PAYLOAD_BYTES = 10_000_000; // 10 MB

async function scrapeKleinanzeigenPrices(produktName) {
  try {
    // Kleinanzeigen uses hyphenated slugs, not percent-encoded spaces
    const query = produktName.trim()
      .toLowerCase()
      .replace(/[äöüß]/g, c => ({ ä:"ae", ö:"oe", ü:"ue", ß:"ss" }[c]))
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const url = `https://www.kleinanzeigen.de/seite:1/s-${query}/k0`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept-Language": "de-DE,de;q=0.9",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const html = await res.text();

    const priceMatches = [...html.matchAll(/(\d{1,2}\.?\d{3}|\d{1,4})\s*€/g)]
      .map(m => parseInt(m[1].replace(/\./g, ""), 10))
      .filter(p => Number.isFinite(p) && p >= 1 && p <= 50000);

    if (priceMatches.length < 3) return null;

    priceMatches.sort((a, b) => a - b);
    const trimLow  = Math.floor(priceMatches.length * 0.1);
    const trimHigh = Math.floor(priceMatches.length * 0.2);
    const trimmed  = priceMatches.slice(trimLow, priceMatches.length - trimHigh);
    if (trimmed.length < 2) return null;

    const min    = trimmed[0];
    const max    = trimmed[trimmed.length - 1];
    const median = trimmed[Math.floor(trimmed.length / 2)];

    return { min, max, median, count: priceMatches.length };
  } catch {
    return null;
  }
}

function calculatePrice(priceData, zustandScore) {
  if (!priceData || !Number.isFinite(zustandScore)) return null;
  const score  = Math.min(1.0, Math.max(0.5, zustandScore));
  const raw    = Math.round(priceData.median * score);
  return Math.round(raw / 5) * 5;               // snap to 5 €
}

// Integer keys avoid JS float precision issues (0.1+0.2 != 0.3 etc.)
const ZUSTAND_LABELS = { 10: "Neu", 9: "Wie neu", 8: "Sehr gut", 7: "Gut", 6: "Befriedigend", 5: "Defekt" };
function zustandLabel(score) {
  const key = Math.round(score * 10);
  return ZUSTAND_LABELS[key] ?? "Gut";
}

// Cache validation result — only runs once per instance, not per request
let envValidated = false;

export async function POST(request) {
  try {
    // ── Env validation (cached) ──
    if (!envValidated) { validateEnv(); envValidated = true; }

    // ── Rate limiting ──
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
             || request.headers.get("x-real-ip")
             || "unknown";
    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
      return Response.json(
        { success: false, error: `Zu viele Anfragen. Bitte ${rl.retryAfter}s warten.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    // ── Payload size guard (reads raw bytes — works with chunked transfers too) ──
    const rawBody = await request.text();
    if (rawBody.length > MAX_PAYLOAD_BYTES) {
      return Response.json(
        { success: false, error: "Payload zu groß. Maximal 10 MB." },
        { status: 413 }
      );
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return Response.json({ success: false, error: "Ungültiges JSON." }, { status: 400 });
    }

    const { photos = [], location = "Deutschland", extraHint = "" } = body;

    // Sanitize user inputs — prevent prompt injection
    const safeHint     = String(extraHint).slice(0, 100).replace(/[`${}\\]/g, "");
    const safeLocation = String(location).slice(0, 80).replace(/[`${}\\]/g, "") || "Deutschland";

    // Guard: at least one photo required
    const validPhotos = photos.filter(p => p?.base64 && p?.mimeType);
    if (validPhotos.length === 0) {
      return Response.json({ success: false, error: "Kein Foto übermittelt." }, { status: 400 });
    }

    // Guard: max 6 photos, base64 length sanity check
    if (validPhotos.length > 6) {
      return Response.json({ success: false, error: "Maximal 6 Fotos erlaubt." }, { status: 400 });
    }
    if (validPhotos.some(p => p.base64.length > 2_000_000)) {
      return Response.json({ success: false, error: "Ein Foto ist zu groß (max 1.5 MB nach Komprimierung)." }, { status: 400 });
    }

    // Use first photo for quick product ID, rest for full analysis
    const primaryPhoto = validPhotos[0];

    /* ── Step 1: Identify product + condition ── */
    const idPrompt = safeHint
      ? `Der Nutzer nennt das Produkt: "${safeHint}". Gib NUR zurück: Produktname (max 5 Wörter), Komma, Zustandszahl 0.5-1.0. Beispiel: "RØDE NT-USB Mikrofon, 0.8"`
      : `Analysiere das Foto präzise:
1. Lies ALLEN sichtbaren Text auf dem Produkt: Markennamen, Modellbezeichnungen, Seriennummern, Typenschilder, Aufdrucke, Logos, EAN/Barcodes, technische Angaben (Watt, Volt, etc.)
2. Nutze diesen Text als primäre Quelle für die Produktidentifikation — er ist zuverlässiger als visuelle Schätzung
3. Erkenne zusätzlich Form, Farbe und Kategorie des Produkts

Antworte NUR mit: Vollständiger Produktname inkl. Modellnummer falls lesbar (max 6 Wörter), Komma, Zustandszahl 0.5-1.0 (1.0=Neu 0.9=WieNeu 0.8=SehrGut 0.7=Gut 0.6=Befriedigend 0.5=Defekt)
Beispiele: "RØDE NT-USB Mikrofon, 0.8" / "Bosch PSB 18 LI-2, 0.7" / "Sony WH-1000XM4, 0.9"`;

    const idRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini", max_tokens: 60, temperature: 0,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: idPrompt },
            { type: "image_url", image_url: { url: `data:${primaryPhoto.mimeType};base64,${primaryPhoto.base64}`, detail: "high" } },
          ],
        }],
      }),
    });

    if (!idRes.ok) {
      const errBody = await idRes.text();
      throw new Error(`OpenAI ID-Call ${idRes.status}: ${errBody.slice(0, 200)}`);
    }
    const idData = await idRes.json();
    const idText = idData.choices?.[0]?.message?.content?.trim() ?? "";

    const parts        = idText.split(",");
    const detectedName = safeHint || (parts[0]?.trim() ?? "Artikel");
    const rawScore     = parseFloat(parts[1]?.trim() ?? "0.75");
    const zustandScore = Number.isFinite(rawScore) ? Math.min(1.0, Math.max(0.5, rawScore)) : 0.75;
    const zustand      = zustandLabel(zustandScore);

    /* ── Step 2: Scrape real market prices ── */
    const priceData  = await scrapeKleinanzeigenPrices(detectedName);
    const fixedPrice = calculatePrice(priceData, zustandScore);

    const priceInstruction = priceData && fixedPrice
      ? `FESTGELEGTER PREIS: ${fixedPrice} €  (Marktmedian ${priceData.median} € × Zustandsfaktor ${zustandScore.toFixed(1)}). Trage exakt ${fixedPrice} in "schaetzPreis" ein.`
      : `Schätze konservativ. Lieber 15% unter Neupreis als zu hoch.`;

    const marktdatenStr = priceData
      ? `${priceData.count} Anzeigen: ${priceData.min}–${priceData.max} €, Median ${priceData.median} €, empfohlen ${fixedPrice} €`
      : "Marktpreise konnten nicht abgerufen werden – KI-Schätzung (kein Echtzeitwert)";

    const preisRange = priceData ? `${priceData.min}–${priceData.max}` : "?–?";
    const preisStrategie = priceData && fixedPrice
      ? `Marktmedian ${priceData.median} € × ${zustandScore.toFixed(1)} (${zustand}) = ${fixedPrice} €`
      : "Schätzung ohne Marktdaten";

    /* ── Step 3: Generate full listing text ── */
    const prompt = `Du bist ein erfahrener Kleinanzeigen-Verkäufer in Deutschland mit perfekter Lesefähigkeit für Produkttexte.

Produkt: "${detectedName}", Zustand: "${zustand}", Standort: ${safeLocation}
${priceInstruction}

WICHTIG zur Produktanalyse:
- Lies ALLEN sichtbaren Text auf den Fotos sorgfältig: Typenschilder, Seriennummern, Modellnummern, technische Daten, Zubehör-Aufdrucke
- Extrahiere alle relevanten Produktmerkmale die auf den Fotos lesbar sind (Watt, Volt, Liter, Größe, Farbe, Version etc.)
- Nutze diese Informationen für einen präzisen, faktischen Anzeigentext

Schreibe eine professionelle, ehrliche Anzeige. Erfinde keinen anderen Preis.

Antworte NUR mit validem JSON (kein Markdown, keine Backticks, kein Text außerhalb):
{
  "produktName": "Vollständiger Produktname mit Marke",
  "kategorie": "Hauptkategorie",
  "zustand": "${zustand}",
  "zustandsBeschreibung": "1-2 Sätze zum Zustand laut Fotos",
  "schaetzPreis": ${fixedPrice ?? 0},
  "preisRange": "${preisRange}",
  "preisStrategie": "${preisStrategie.replace(/"/g, "'")}",
  "marktdaten": "${marktdatenStr.replace(/"/g, "'")}",
  "titel": "max 60 Zeichen, prägnant, keyword-reich",
  "beschreibung": "150-250 Wörter, professionell, mit Abholung/Versand am Ende",
  "tags": ["keyword1", "keyword2", "keyword3"],
  "besonderheiten": ["Feature 1", "Feature 2"],
  "versandMoeglich": true,
  "empfKategoriePfad": "Oberkategorie > Kategorie > Unterkategorie"
}`;

    const allPhotosParts = validPhotos.map(p => ({
      type: "image_url",
      image_url: { url: `data:${p.mimeType};base64,${p.base64}`, detail: "high" },
    }));

    const analysisRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini", max_tokens: 1500, temperature: 0,
        messages: [{
          role: "user",
          content: [{ type: "text", text: prompt }, ...allPhotosParts],
        }],
      }),
    });

    if (!analysisRes.ok) {
      const errBody = await analysisRes.text();
      throw new Error(`OpenAI Analysis-Call ${analysisRes.status}: ${errBody.slice(0, 200)}`);
    }

    const analysisData = await analysisRes.json();
    const raw   = analysisData.choices?.[0]?.message?.content ?? "";
    const clean = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      throw new Error("KI-Antwort war kein gültiges JSON. Bitte erneut versuchen.");
    }

    // Enforce deterministic price — KI darf ihn nicht überschreiben
    if (fixedPrice) parsed.schaetzPreis = fixedPrice;
    parsed.preisStrategie = preisStrategie;
    parsed.marktdaten     = marktdatenStr;

    return Response.json({ success: true, data: parsed });

  } catch (error) {
    console.error("analyze error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
