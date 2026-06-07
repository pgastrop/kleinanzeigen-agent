export const maxDuration = 60;

async function scrapeKleinanzeigenPrices(produktName) {
  try {
    const query = encodeURIComponent(produktName);
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
      .map(m => parseInt(m[1].replace(".", "")))
      .filter(p => p >= 1 && p <= 50000);

    if (priceMatches.length < 3) return null;

    priceMatches.sort((a, b) => a - b);

    // Ausreißer entfernen (unterstes 10%, oberstes 20%)
    const trimLow = Math.floor(priceMatches.length * 0.1);
    const trimHigh = Math.floor(priceMatches.length * 0.2);
    const trimmed = priceMatches.slice(trimLow, priceMatches.length - trimHigh);

    const min = trimmed[0];
    const max = trimmed[trimmed.length - 1];
    const median = trimmed[Math.floor(trimmed.length / 2)];
    const avg = Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);

    return { min, max, median, avg, count: priceMatches.length };
  } catch {
    return null;
  }
}

// Preis deterministisch berechnen — kein KI-Spielraum
function calculatePrice(priceData, zustandScore) {
  if (!priceData) return null;
  // zustandScore: 1.0 = Neu, 0.9 = Wie neu, 0.8 = Sehr gut, 0.7 = Gut, 0.6 = Befriedigend
  const base = priceData.median;
  const adjusted = Math.round(base * zustandScore);
  // Auf glatte Zahl runden (5er-Schritte)
  return Math.round(adjusted / 5) * 5;
}

export async function POST(request) {
  try {
    const { photo1, photo2, mimeType1, mimeType2, location, extraHint } =
      await request.json();

    const hintText = extraHint
      ? `Der Nutzer hat den Artikel korrigiert auf: "${extraHint}". Verwende diesen Namen.`
      : "";

    // Schritt 1: Produkt + Zustand erkennen (temperature 0 = deterministisch)
    const quickRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 80,
        temperature: 0,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: extraHint
              ? `Produktname für Kleinanzeigen-Suche: "${extraHint}". Gib NUR den optimalen Suchbegriff zurück (max 4 Wörter), dann ein Komma, dann eine Zahl 0.6-1.0 für den Zustand (1.0=Neu, 0.9=Wie neu, 0.8=Sehr gut, 0.7=Gut, 0.6=Befriedigend). Beispiel: "iPhone 13 Pro, 0.8"`
              : `Erkenne das Produkt auf dem Foto. Antworte NUR mit: Produktname (max 4 Wörter), Komma, Zustandszahl 0.6-1.0 (1.0=Neu, 0.9=Wie neu, 0.8=Sehr gut, 0.7=Gut, 0.6=Befriedigend). Beispiel: "RØDE NT-USB Mikrofon, 0.8"` },
            { type: "image_url", image_url: { url: `data:${mimeType1};base64,${photo1}`, detail: "low" } },
          ],
        }],
      }),
    });

    const quickData = await quickRes.json();
    const quickText = quickData.choices?.[0]?.message?.content?.trim() || "";
    const parts = quickText.split(",");
    const detectedName = extraHint || parts[0]?.trim() || "Artikel";
    const zustandScore = parseFloat(parts[1]?.trim()) || 0.75;

    // Zustand in Text umwandeln
    const zustandText = zustandScore >= 1.0 ? "Neu" : zustandScore >= 0.9 ? "Wie neu" : zustandScore >= 0.8 ? "Sehr gut" : zustandScore >= 0.7 ? "Gut" : "Befriedigend";

    // Schritt 2: Echte Marktpreise scrapen
    const priceData = await scrapeKleinanzeigenPrices(detectedName);

    // Schritt 3: Preis deterministisch berechnen
    const fixedPrice = calculatePrice(priceData, zustandScore);

    const priceInfo = priceData
      ? `FESTGELEGTER PREIS: ${fixedPrice} € (berechnet aus Median ${priceData.median} € × Zustandsfaktor ${zustandScore}). Trage exakt diesen Wert als schaetzPreis ein — keine Abweichung.`
      : `Kein Marktpreis verfügbar. Schätze konservativ für "${detectedName}" im Zustand "${zustandText}".`;

    const marktdatenText = priceData
      ? `${priceData.count} Anzeigen ausgewertet: ${priceData.min}–${priceData.max} €, Median ${priceData.median} €, empfohlener Preis ${fixedPrice} €`
      : "Keine Marktdaten verfügbar";

    // Schritt 4: Nur Text generieren, Preis ist vorgegeben
    const prompt = `Du bist ein erfahrener Verkäufer auf Kleinanzeigen.de.

Analysiere diese Produktfotos. ${hintText}

Produkt: "${detectedName}", Zustand: "${zustandText}"
${priceInfo}

Schreibe einen professionellen Anzeigentext. Der Preis ist bereits festgelegt — erfinde keinen eigenen.

Antworte NUR mit einem JSON-Objekt (kein Markdown, keine Backticks):
{
  "produktName": "Exakter Produktname mit Marke und Modell",
  "kategorie": "Kleinanzeigen Kategorie",
  "zustand": "${zustandText}",
  "zustandsBeschreibung": "1-2 Sätze über sichtbaren Zustand",
  "schaetzPreis": ${fixedPrice || 0},
  "preisRange": "${priceData ? `${priceData.min}–${priceData.max}` : '?'}",
  "preisStrategie": "Marktmedian ${priceData?.median || '?'} € × Zustandsfaktor ${zustandScore} = ${fixedPrice || '?'} €",
  "marktdaten": "${marktdatenText}",
  "titel": "Anzeigentitel max 60 Zeichen",
  "beschreibung": "Verkaufstext 150-250 Wörter. Mit Abholung/Versand-Hinweis enden.",
  "tags": ["tag1", "tag2", "tag3"],
  "besonderheiten": ["Feature 1", "Feature 2"],
  "versandMoeglich": true,
  "empfKategoriePfad": "z.B. Elektronik > Audio > Mikrofon"
}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1500,
        temperature: 0,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType1};base64,${photo1}`, detail: "low" } },
            { type: "image_url", image_url: { url: `data:${mimeType2};base64,${photo2}`, detail: "low" } },
          ],
        }],
      }),
    });

    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    // Preis nochmals sichern — KI darf ihn nicht eigenmächtig ändern
    if (fixedPrice) parsed.schaetzPreis = fixedPrice;

    return Response.json({ success: true, data: parsed });
  } catch (error) {
    console.error("Error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
