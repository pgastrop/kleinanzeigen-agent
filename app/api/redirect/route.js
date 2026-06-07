export async function GET() {
  // HTML-Seite die per JS weiterleitet — umgeht iOS Universal Links
  return new Response(
    `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Weiterleitung...</title></head>
<body>
<script>
  window.location.replace("https://www.kleinanzeigen.de/anzeige-aufgeben");
</script>
<p>Weiterleitung zu Kleinanzeigen...</p>
</body>
</html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    }
  );
}
