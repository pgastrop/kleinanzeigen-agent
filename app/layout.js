import "./globals.css";

export const metadata = {
  title: "Kleinanzeigen Assistent · KI-Verkaufshelfer",
  description: "Artikel fotografieren – KI bewertet und schreibt die Anzeige automatisch",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
