export async function GET() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "https://www.kleinanzeigen.de/anzeige-aufgeben",
      "Cache-Control": "no-store",
    },
  });
}
