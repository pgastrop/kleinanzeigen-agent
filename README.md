# Kleinanzeigen KI-Assistent

KI-gestützter Verkaufsassistent für Kleinanzeigen.de. Fotos hochladen → Artikel wird erkannt, Marktpreis recherchiert, Anzeigentext generiert.

## Features

- 📸 Bis zu 6 Fotos hochladen (Galerie oder Kamera)
- 🤖 Automatische Produkterkennung via GPT-4o-mini Vision + OCR
- 💶 Echte Marktpreise von Kleinanzeigen.de (deterministischer Median)
- ✍️ 5 Schreibstile: Sachlich, Emotional, Knapp, Ausführlich, Menschlich
- 💾 Artikel-Warteschlange mit localStorage-Persistenz
- 🔒 Festpreis / VB + Abholung / Versand wählbar

## Setup

### Voraussetzungen

- Node.js 18+
- OpenAI API Key ([platform.openai.com](https://platform.openai.com))

### Lokal starten

```bash
npm install
cp .env.example .env.local
# OPENAI_API_KEY eintragen
npm run dev
```

### Deployment (Vercel)

1. Repository auf GitHub pushen
2. [vercel.com/new](https://vercel.com/new) → Repository importieren
3. Environment Variables setzen:

| Variable | Beschreibung | Pflicht |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API Key | ✅ |

4. Deploy klicken

## Umgebungsvariablen

```env
OPENAI_API_KEY=sk-proj-...
```

## Rate Limiting

API-Routen sind mit IP-basiertem Rate Limiting gesichert:
- Max. **10 Anfragen pro Minute** pro IP
- Bei Überschreitung: HTTP 429 mit `Retry-After` Header

## Kosten

GPT-4o-mini: ca. **0,001–0,002 € pro Analyse**.  
100 Analysen ≈ 0,20 €.

## Architektur

```
app/
├── page.js              # Frontend (React, Next.js App Router)
├── api/
│   ├── analyze/         # Produkterkennung + Preisrecherche + Textgenerierung
│   ├── generate-text/   # Stilbasierte Textgenerierung
│   └── redirect/        # App-Store-Bypass für Kleinanzeigen-Link
lib/
├── ratelimit.js         # IP-basiertes Rate Limiting
├── env.js               # Startup-Env-Validierung
└── format.js            # Preis- und Text-Utilities
```

## Bekannte Einschränkungen

- **Kein Kleinanzeigen-API**: Direktes Veröffentlichen nicht möglich (keine öffentliche API)
- **Scraping fragil**: Preisrecherche via HTML-Scraping kann bei KA-Updates brechen
- **In-Memory Rate Limit**: Wird bei Vercel-Instance-Restart zurückgesetzt

## Lizenz

Privates Projekt — nicht zur kommerziellen Nutzung.
