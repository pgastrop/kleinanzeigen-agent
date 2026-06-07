export const maxDuration = 60;

export async function POST(request) {
  try {
    const { photo1, photo2, mimeType1, mimeType2, location } =
      await request.json();

    const prompt = `Du bist ein Experte für den deutschen Kleinanzeigenmarkt (Kleinanzeigen.de).

Analysiere diese zwei Produktfotos und erstelle eine vollständige Verkaufsanalyse für den Standort ${location}.

Antworte NUR mit einem JSON-Objekt (kein Markdown, keine Backticks, kein Text davor oder danach):
{
  "produktName": "Exakter Produktname mit Marke falls erkennbar",
  "kategorie": "Kleinanzeigen Kategorie",
  "zustand": "Sehr gut",
  "zustandsBeschreibung": "1-2 Sätze über sichtbaren Zustand aus den Fotos",
  "schaetzPreis": 45,
  "preisRange": "35-55",
  "preisBegruendung": "Kurze Begründung warum dieser Preis realistisch ist für ${location}",
  "titel": "Anzeigentitel max 60 Zeichen, prägnant und keyword-stark",
  "beschreibung": "Vollständiger Verkaufstext für Kleinanzeigen, 150-250 Wörter. Professionell, ehrlich, Zustand beschreiben. Mit Hinweis auf Abholung/Versand enden.",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "besonderheiten": ["Feature 1", "Feature 2", "Feature 3"],
  "versandMoeglich": true,
  "empfKategoriePfad": "z.B. Elektronik > Audio > Mikrofon"
}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mimeType1};base64,${photo1}`, detail: "low" } },
              { type: "image_url", image_url: { url: `data:${mimeType2};base64,${photo2}`, detail: "low" } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return Response.json({ success: true, data: parsed });
  } catch (error) {
    console.error("OpenAI error:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
