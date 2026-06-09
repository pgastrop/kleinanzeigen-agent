import { checkRateLimit } from "../../../lib/ratelimit.js";
import { validateEnv }    from "../../../lib/env.js";

export const maxDuration = 30;

const STYLES = {
  sachlich: {
    label: "Sachlich",
    instruction: `Schreibe einen sachlichen, faktenbasierten Verkaufstext.
Keine Ausrufezeichen, keine Werbephrasen, keine Emotionen.
Nur relevante Fakten: Was ist es, welcher Zustand, welche technischen Details, Maße falls erkennbar, Abholung/Versand.
Ton: nüchtern, direkt, informativ. Wie ein technisches Datenblatt in Prosaform.`,
  },
  emotional: {
    label: "Emotional",
    instruction: `Schreibe einen emotionalen, einladenden Verkaufstext der eine Geschichte erzählt.
Warum ist dieser Artikel besonders? Was hat er erlebt? Welche Möglichkeiten eröffnet er dem Käufer?
Ton: warm, begeistert, persönlich. Sprich den Leser direkt an.
Keine Emojis, aber lebendige Sprache die Lust macht den Artikel zu kaufen.`,
  },
  knapp: {
    label: "Knapp",
    instruction: `Schreibe einen sehr kurzen, prägnanten Verkaufstext — maximal 60-80 Wörter.
Nur das Allerwichtigste: Was, Zustand, Preis-Hinweis, Abholung/Versand.
Kein Fülltext, keine Wiederholungen, keine Phrasen.
Jedes Wort muss zählen.`,
  },
  ausfuehrlich: {
    label: "Ausführlich",
    instruction: `Schreibe einen sehr ausführlichen, vollständigen Verkaufstext — 250-350 Wörter.
Beschreibe alles was sichtbar oder relevant ist: Zustand im Detail, alle Funktionen, mögliche Verwendungszwecke, Zubehör, Besonderheiten.
Beantworte potenzielle Käuferfragen vorweg. Sei gründlich und vollständig.`,
  },
  human: {
    label: "Menschlich",
    instruction: `Schreibe einen Verkaufstext der klingt als hätte ihn ein echter Mensch geschrieben — nicht eine KI, nicht ein Werbetexter.
Natürliche Sprache, leichte Umgangssprache, gelegentlich ein persönlicher Satz wie "Ich verkaufe das weil..." oder "Hatte ich selbst eine Weile und...".
Keine perfekte Grammatik erzwingen — menschliche Texte haben manchmal kurze Sätze.
KEINE Emojis, KEINE Aufzählungszeichen, KEIN Marketingsprech.
Klingt wie ein normaler Mensch der ehrlich etwas verkauft.`,
  },
};

let envValidated = false;

export async function POST(request) {
  try {
    if (!envValidated) { validateEnv(); envValidated = true; }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
      return Response.json(
        { success: false, error: `Zu viele Anfragen. Bitte ${rl.retryAfter}s warten.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const { produktName, zustand, preis, kategorie, ort, versand, styleKey } = await request.json();

    // Input validation
    if (!produktName || !styleKey) {
      return Response.json({ success: false, error: "Produktname und Stil sind erforderlich." }, { status: 400 });
    }

    const style = STYLES[styleKey];
    if (!style) throw new Error(`Unbekannter Stil: ${styleKey}`);

    const prompt = `Du schreibst einen Kleinanzeigen-Verkaufstext.

Artikel: ${produktName}
Zustand: ${zustand}
Preis: ${preis} €
Kategorie: ${kategorie}
Standort: ${ort}
Versand: ${versand ? "möglich" : "nur Abholung"}

Stilanweisung:
${style.instruction}

Antworte NUR mit dem Beschreibungstext — kein Titel, keine Metadaten, kein JSON. Nur der reine Fließtext.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 600,
        temperature: styleKey === "human" ? 0.9 : styleKey === "emotional" ? 0.8 : 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`OpenAI: ${res.status}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) throw new Error("Leere Antwort von KI");

    return Response.json({ success: true, text });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
