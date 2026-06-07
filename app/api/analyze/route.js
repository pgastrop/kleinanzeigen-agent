export const maxDuration = 60;

async function searchMarketPrices(produktName, location) {
  try {
    const query = `${produktName} Kleinanzeigen ${location} kaufen preis`;
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&search_lang=de&country=DE`,
      {
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": process.env.BRAVE_API_KEY || "",
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const snippets = data?.web?.results?.map(r => r.description).filter(Boolean).join("\n");
    return snippets || null;
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

    // Erst Produkt grob erkennen für Preisrecherche
    const quickRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 60,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: extraHint ? `Produktname für Suche: "${extraHint}". Antworte nur mit dem Produktnamen, nichts sonst.` : "Was ist das für ein Produkt? Antworte nur mit Marke und Modell, nichts sonst. Max 8 Wörter." },
            { type: "image_url", image_url: { url: `data:${mimeType1};base64,${photo1}`, detail: "low" } },
          ],
        }],
      }),
    });
    const quickData = await quickRes.json();
    const detectedName = extraHint || quickData.choices?.[0]?.message?.content?.trim() || "Artikel";

    // Marktpreise recherchieren
    const marketData = await searchMarketPrices(detectedName, location);

    const marketContext = marketData
      ? `\n\nAKTUELLE MARKTDATEN aus Kleinanzeigen-Suche für "${detectedName}" in der Region ${location}:\n${marketData}\n\nNutze diese Daten um einen realistischen, optimalen Verkaufspreis zu ermitteln.`
      : `\n\nKeine Marktdaten verfügbar. Schätze den Preis anhand deines Wissens über den deutschen Gebrauchtmarkt für "${detectedName}".`;

    const prompt = `Du bist ein Experte für den deutschen Kleinanzeigenmarkt (Kleinanzeigen.de).

Analysiere diese zwei Produktfotos und erstelle eine vollständige Verkaufsanalyse für ${location}.${hintText}${marketContext}

Ermittle einen OPTIMALEN Verkaufspreis: nicht zu hoch (sonst kein Verkauf), nicht zu niedrig (Geld verschenkt). Orientiere dich an ähnlichen Artikeln in der Region.

Antworte NUR mit einem JSON-Objekt (kein Markdown, keine Backticks):
{
  "produktName": "Exakter Produktname mit Marke und Modell",
  "kategorie": "Kleinanzeigen Kategorie",
  "zustand": "Sehr gut",
  "zustandsBeschreibung": "1-2 Sätze über sichtbaren Zustand",
  "schaetzPreis": 45,
  "preisRange": "35-55",
  "preisStrategie": "Kurze Erklärung warum dieser Preis optimal ist basierend auf Marktdaten",
  "titel": "Anzeigentitel max 60 Zeichen, prägnant und keyword-stark",
  "beschreibung": "Vollständiger Verkaufstext 150-250 Wörter. Professionell, mit allen Details. Mit Abholung/Versand-Hinweis enden.",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
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
