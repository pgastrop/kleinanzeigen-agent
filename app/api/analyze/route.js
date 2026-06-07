import Anthropic from "@anthropic-ai/sdk";

export async function POST(request) {
  try {
    const { photo1, photo2, mimeType1, mimeType2, location } =
      await request.json();

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

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
  "beschreibung": "Vollständiger Verkaufstext für Kleinanzeigen, 150-250 Wörter. Professionell, ehrlich, Zustand beschreiben, Maße/Besonderheiten wenn erkennbar. Mit Hinweis auf Abholung/Versand enden.",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "besonderheiten": ["Feature 1", "Feature 2", "Feature 3"],
  "versandMoeglich": true,
  "empfKategoriePfad": "z.B. Elektronik > Audio > Kopfhörer"
}`;

    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType1,
                data: photo1,
              },
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType2,
                data: photo2,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const raw =
      response.content.find((b) => b.type === "text")?.text || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return Response.json({ success: true, data: parsed });
  } catch (error) {
    console.error("Analysis error:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export const maxDuration = 60;
