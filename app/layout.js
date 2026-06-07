import "./globals.css";

export const metadata = {
  title: "Kleinanzeigen Assistent",
  description: "Artikel fotografieren – KI bewertet und schreibt die Anzeige",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
