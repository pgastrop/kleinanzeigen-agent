/** Utility: Preis immer mit 2 Dezimalstellen, deutsche Locale */
export const formatPreis = (preis) => {
  const n = Number(preis);
  if (!Number.isFinite(n)) return "0,00";
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const makePriceLabel = (preis, priceType) => {
  const p = formatPreis(preis);
  return priceType === "vb" ? `${p} € VB` : `${p} € (Festpreis)`;
};

export const makeDeliveryLabel = (deliveryType) => {
  if (deliveryType === "abholung") return "Nur Abholung";
  if (deliveryType === "versand")  return "Versand möglich";
  return "Abholung oder Versand möglich";
};

export const makeListingText = (listing, analysis, priceType = "fest", deliveryType = "beide") => {
  if (!listing) return "";
  const tags = analysis?.tags?.length
    ? "\n" + analysis.tags.map(t => `#${t}`).join(" ")
    : "";
  return [
    `📦 ${listing.titel}`,
    `💰 ${makePriceLabel(listing.preis, priceType)}`,
    `📍 ${listing.ort}`,
    `⭐ Zustand: ${listing.zustand}`,
    `🚚 ${makeDeliveryLabel(deliveryType)}`,
    ``,
    listing.beschreibung,
    ``,
    `🏷️ ${listing.kategorie}${tags}`,
  ].join("\n");
};
