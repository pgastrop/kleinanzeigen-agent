/**
 * Startup env validation — fail fast with a clear message
 * instead of a cryptic 401 from OpenAI.
 */

const REQUIRED = ["OPENAI_API_KEY"];

export function validateEnv() {
  const missing = REQUIRED.filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Fehlende Umgebungsvariablen: ${missing.join(", ")}. ` +
      `Bitte in Vercel unter Settings → Environment Variables eintragen.`
    );
  }
}
