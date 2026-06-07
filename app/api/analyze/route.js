export const maxDuration = 60;

// Scrapt echte Preise von Kleinanzeigen-Suchergebnissen
async function scrapeKleinanzeigenPrices(produktName, location) {
  try {
    const city = location.split(",")[0].trim();
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

    // Preise aus HTML extrahieren: Muster "123 €" oder "1.234 €"
    const priceMatches = [...html.matchAll(/(\d{1,2}\.?\d{3}|\d{1,4})\s*€/g)]
      .map(m => parseInt(m[1].replace(".", "")))
      .filter(p => p >= 1 && p <= 50000);

    if (priceMatches.length < 2) return null;

    priceMatches.sort((a, b) => a - b);

    // Ausreißer entfernen (unterstes und oberstes 20%)
    const trim = Math.floor(priceMatches.length * 0.2);
    const trimmed = priceMatches.slice(trim, priceMatches.length - trim);

    const min = trimmed[0];
    const max = trimmed[trimmed.length - 1];
    const median = trimmed[Math.floor(trimmed.length / 2)];
    const avg = Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);

    return { min, max, median, avg, count: priceMatches.length, city };
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    const { photo1, photo2, mimeType1, mimeType2, location, extraHint } =
      await request.json();

    const hintText = extraHint
      ? `\n\nWICHTIG: Der Nutzer hat den Artikel korrigiert auf: "${extraHint}". Verwende diesen Namen als Basis.`
      : "";

    // Schritt 1: Produkt erkennen
    const quickRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 60,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: extraHint
              ? `Produktname für Suchanfrage: "${extraHint}". Gib nur den optimalen Suchbegriff zurück, max 5 Wörter.`
              : "Erkenne Marke und Modell dieses Produkts. Antworte NUR mit dem Produktnamen, max 5 Wörter, kein anderer Text." },
            { type: "image_url", image_url: { url: `data:${mimeType1};base64,${photo1}`, detail: "low" } },
          ],
        }],
      }),
    });
    const quickData = await quickRes.json();
    const detectedName = extraHint || quickData.choices?.[0]?.message?.content?.trim() || "Artikel";

    // Schritt 2: Echte Marktpreise von Kleinanzeigen scrapen
    const priceData = await scrapeKleinanzeigenPrices(detectedName, location);

    const marketContext = priceData
      ? `\n\nECHTE MARKTPREISE von Kleinanzeigen.de für "${detectedName}" (${priceData.count} Anzeigen ausgewertet):
- Günstigster Preis: ${priceData.min} €
- Teuerster Preis: ${priceData.max} €  
- Median: ${priceData.median} €
- Durchschnitt: ${priceData.avg} €

PREISEMPFEHLUNG: Setze den Preis auf ${priceData.median} € (Median der aktuellen Angebote). 
Berücksichtige den Zustand des Artikels: bei sehr gutem Zustand eher Richtung ${Math.round(priceData.median * 1.1)} €, bei Gebrauchsspuren eher ${Math.round(priceData.median * 0.85)} €.
Sei realistisch — zu hohe Preise führen zu keinem Verkauf.`
      : `\n\nKeine Marktdaten verfügbar. Schätze konservativ basierend auf deutschem Gebrauchtmarkt. Lieber 10-20% unter Neupreis als zu hoch.`;

    // Schritt 3: Vollständige Analyse mit realen Preisdaten
    const prompt = `Du bist ein erfahrener Verkäufer auf Kleinanzeigen.de mit jahrelanger Erfahrung.

Analysiere diese Produktfotos für einen Verkauf in ${location}.${hintText}${marketContext}

WICHTIGE PREISREGELN:
- Nutze die echten Marktdaten als Hauptreferenz
- Privatverkäufer müssen 10-20% günstiger als Händler sein  
- Bei unbekanntem Zustand: konservativer Preis
- Kein VB (Verhandlungsbasis) einplanen — Preis ist bereits fair kalkuliert
- NIEMALS den Neupreis als Basis nehmen ohne starken Abschlag

Antworte NUR mit einem JSON-Objekt (kein Markdown, keine Backticks):
{
  "produktName": "Exakter Produktname mit Marke und Modell",
  "kategorie": "Kleinanzeigen Kategorie",
  "zustand": "Sehr gut",
  "zustandsBeschreibung": "1-2 Sätze über sichtbaren Zustand aus den Fotos",
  "schaetzPreis": 45,
  "preisRange": "35-55",
  "preisStrategie": "Erklärung: Median laut Marktdaten X €, Zustand Y, daher Z €",
  "marktdaten": ${priceData ? `"${priceData.count} Anzeigen: ${priceData.min}–${priceData.max} €, Median ${priceData.median} €"` : '"Keine Marktdaten verfügbar"'},
  "titel": "Anzeigentitel max 60 Zeichen, prägnant",
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

    return Response.json({ success: true, data: parsed });
  } catch (error) {
    console.error("Error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
