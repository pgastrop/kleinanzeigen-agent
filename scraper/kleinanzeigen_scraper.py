"""
kleinanzeigen_scraper.py
------------------------
Scrapling-basierter Scraper für kleinanzeigen.de

Features:
- Suchergebnis-Parsing (Listenansicht)
- Einzelanzeigen-Parsing (Detailseite)
- Preisbereinigung inkl. VB-Flag
- URL-Builder für Suche mit Keyword, Kategorie, Ort, Radius, Seite
- Retry-Logik mit exponential backoff
- Anti-Bot: stealthy headers via Scrapling Fetcher
- Async-Support via AsyncFetcher

Verwendung:
    scraper = KleinanzeigemScraper()
    results = scraper.search("iphone 14", category_id=161, location="heidelberg", radius=50)
    for r in results:
        print(r)

    detail = scraper.get_listing("https://www.kleinanzeigen.de/s-anzeige/...")
"""

from __future__ import annotations

import re
import time
import logging
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlencode, quote_plus

from scrapling.parser import Selector
from scrapling.fetchers import Fetcher

try:
    from scrapling.fetchers import AsyncFetcher
    ASYNC_AVAILABLE = True
except ImportError:
    ASYNC_AVAILABLE = False

logger = logging.getLogger(__name__)

BASE_URL = "https://www.kleinanzeigen.de"


# ─────────────────────────────────────────────
# Data classes
# ─────────────────────────────────────────────

@dataclass
class KleinanzeigeListing:
    """Ein einzelnes Suchergebnis aus der Listenansicht."""
    ad_id: str
    title: str
    price_raw: str
    price_value: Optional[float]
    price_negotiable: bool
    currency: str
    location: str
    date_text: str
    url: str
    thumbnail_url: Optional[str]
    category: Optional[str] = None
    description_snippet: Optional[str] = None

    def __repr__(self):
        neg = " VB" if self.price_negotiable else ""
        price_str = f"{self.price_value:.0f} €{neg}" if self.price_value else self.price_raw or "k.A."
        return f"[{self.ad_id}] {self.title!r} – {price_str} – {self.location} ({self.date_text})"


@dataclass
class KleinanzeigeDetail(KleinanzeigeDetail if False else object):
    """Vollständige Detaildaten einer Anzeige."""
    ad_id: str
    title: str
    price_raw: str
    price_value: Optional[float]
    price_negotiable: bool
    currency: str
    location: str
    date_text: str
    url: str
    description: str
    image_urls: list[str] = field(default_factory=list)
    attributes: dict[str, str] = field(default_factory=dict)
    seller_name: Optional[str] = None
    seller_type: Optional[str] = None  # "privat" | "gewerblich"
    category_path: list[str] = field(default_factory=list)


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def parse_price(text: str) -> tuple[str, Optional[float], bool]:
    """
    Gibt (raw, value, negotiable) zurück.
    Beispiele:
        "450 €"        -> ("450 €", 450.0, False)
        "380 € VB"     -> ("380 € VB", 380.0, True)
        "Zu verschenken" -> ("Zu verschenken", 0.0, False)
        "Zu verschenken" -> ("", None, False)  für unbekannte Texte
    """
    if not text:
        return "", None, False

    text = text.strip()
    negotiable = "VB" in text.upper()

    if re.search(r'verschenk', text, re.IGNORECASE):
        return text, 0.0, False

    if re.search(r'tausch|preis\s*auf\s*anfrage|vhs', text, re.IGNORECASE):
        return text, None, negotiable

    # Ziffern extrahieren: 1.200 € oder 1.200,50 € oder 1200 € oder 99,99 €
    clean = text.replace("\u00a0", "").replace(" ", "")
    # Vollständiges Preismuster: optionaler Tausend-Punkt, optionale Dezimal-Komma
    match = re.search(r'(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)', clean)
    if match:
        num_str = match.group(1)
        # DE-Format: Punkt als Tausender-Trenner → entfernen, Komma → Punkt
        if re.match(r'\d{1,3}(\.\d{3})+', num_str):
            num_str = num_str.replace(".", "").replace(",", ".")
        else:
            # Komma als Dezimaltrennzeichen
            num_str = num_str.replace(",", ".")
        try:
            return text, float(num_str), negotiable
        except ValueError:
            pass

    return text, None, negotiable


def build_search_url(
    keyword: str = "",
    *,
    category_id: Optional[int] = None,
    location_slug: Optional[str] = None,   # z.B. "heidelberg"
    radius_km: Optional[int] = None,        # 5, 10, 20, 30, 50, 100, 150, 200
    page: int = 1,
    price_min: Optional[int] = None,
    price_max: Optional[int] = None,
    sort: str = "RELEVANCE",               # RELEVANCE | DATE_DESCENDING | PRICE_ASCENDING
) -> str:
    """Baut die Such-URL für kleinanzeigen.de nach deren URL-Schema."""
    parts = [BASE_URL]

    # Radius vor Location einfügen wenn angegeben
    if location_slug and radius_km:
        parts.append(f"s-{radius_km}km")

    if location_slug:
        parts.append(f"s-{location_slug.lower().replace(' ', '-')}")

    if keyword:
        parts.append(f"s-{quote_plus(keyword)}")
    else:
        parts.append("s-anzeigen")

    if category_id:
        parts.append(f"c{category_id}")

    if page > 1:
        parts.append(f"seite:{page}")

    url = "/".join(parts)

    # Query-Parameter für Preis & Sortierung
    params = {}
    if price_min is not None:
        params["minPrice"] = price_min
    if price_max is not None:
        params["maxPrice"] = price_max
    if sort and sort != "RELEVANCE":
        params["sortingField"] = sort

    if params:
        url += "?" + urlencode(params)

    return url


# ─────────────────────────────────────────────
# Parser-Funktionen (stateless, testbar)
# ─────────────────────────────────────────────

def parse_listing_page(html, base_url: str = BASE_URL) -> list[KleinanzeigeDetail]:
    """Parst eine Suchergebnis-Seite und gibt eine Liste von KleinanzeigeDetail zurück."""
    if isinstance(html, bytes):
        html = html.decode("utf-8", errors="replace")
    page = Selector(content=html)
    results: list[KleinanzeigeDetail] = []

    articles = page.css('article.aditem')
    if not articles:
        # Fallback: neueres DOM-Schema
        articles = page.css('[data-adid]')

    for article in articles:
        ad_id = article.attrib.get("data-adid", "")
        if not ad_id:
            continue

        # Titel + URL
        link_el = article.css('h2 a').first or article.css('a.ellipsis').first
        title = link_el.text.strip() if link_el else ""
        href = link_el.attrib.get("href", "") if link_el else ""
        url = f"{base_url}{href}" if href.startswith("/") else href

        # Preis
        price_el = (article.css('.aditem-main--middle--price-shipping--price').first
                    or article.css('strong.price-tag').first
                    or article.css('[class*="price"]').first)
        price_text = price_el.text.strip() if price_el else ""
        price_raw, price_value, price_neg = parse_price(price_text)

        # Ort + Datum
        location_spans = article.css('.aditem-main--top--left--cityareadate span')
        location = location_spans[0].text.strip() if location_spans else ""
        date_text = location_spans[1].text.strip() if len(location_spans) > 1 else ""

        # Thumbnail
        img_el = article.css('img').first
        thumbnail = img_el.attrib.get("src") if img_el else None

        # Kategorie-Tag
        cat_el = article.css('.simpletag').first or article.css('[class*="tag"]').first
        category = cat_el.text.strip() if cat_el else None

        # Beschreibungs-Snippet
        desc_el = article.css('p.aditem-main--middle--description').first
        snippet = desc_el.text.strip() if desc_el else None

        results.append(KleinanzeigeDetail(
            ad_id=ad_id,
            title=title,
            price_raw=price_raw,
            price_value=price_value,
            price_negotiable=price_neg,
            currency="EUR",
            location=location,
            date_text=date_text,
            url=url,
            description=snippet or "",
            image_urls=[thumbnail] if thumbnail else [],
            attributes={},
            category_path=[category] if category else [],
        ))

    return results


def parse_detail_page(html: str, url: str = "") -> Optional[KleinanzeigeDetail]:
    """Parst eine Einzelanzeige und gibt ein KleinanzeigeDetail zurück."""
    page = Selector(content=html)

    # Ad-ID aus URL oder Meta-Tag
    ad_id_match = re.search(r'/(\d+)-\d+-\d+', url)
    ad_id = ad_id_match.group(1) if ad_id_match else ""
    if not ad_id:
        meta = page.css('meta[name="description"]').first
        # Fallback: aus OG-URL
        og_url = page.css('meta[property="og:url"]').first
        if og_url:
            m = re.search(r'/(\d+)-\d+', og_url.attrib.get("content", ""))
            ad_id = m.group(1) if m else ""

    # Titel
    title_el = page.css('#viewad-title').first or page.css('h1').first
    title = title_el.text.strip() if title_el else ""

    # Preis
    price_el = page.css('#viewad-price').first or page.css('[class*="price"]').first
    price_raw, price_value, price_neg = parse_price(price_el.text.strip() if price_el else "")

    # Beschreibung
    desc_el = page.css('#viewad-description-text').first or page.css('[class*="description"]').first
    description = desc_el.text.strip() if desc_el else ""

    # Ort
    loc_el = page.css('#viewad-locality').first or page.css('[itemprop="locality"]').first
    location = loc_el.text.strip() if loc_el else ""

    # Datum
    date_el = page.css('#viewad-extra-info span').first
    date_text = date_el.text.strip() if date_el else ""

    # Bilder
    image_urls = []
    # Versuch 1: dedizierte Gallery-Selektoren
    for img in page.css('#viewad-image img, .galleryimage-element img'):
        for attr in ("src", "data-imgsrc", "data-src"):
            src = img.attrib.get(attr, "")
            if src and src not in image_urls:
                image_urls.append(src)
                break
    # Versuch 2: alle img mit kleinanzeigen/kaz im src
    if not image_urls:
        for img in page.css('img'):
            src = img.attrib.get("src", "")
            if src and ("kleinanzeigen" in src or "kaz.de" in src) and src not in image_urls:
                image_urls.append(src)

    # Attribute/Details-Liste
    attributes = {}
    for row in page.css('#viewad-details li, .addetailslist--detail'):
        label_el = row.css('.addetailslist--detail--title, dt').first
        value_el = row.css('.addetailslist--detail--value, dd').first
        if label_el and value_el:
            attributes[label_el.text.strip()] = value_el.text.strip()

    # Verkäufer
    seller_el = page.css('#viewad-contact .userprofile-vip, #viewad-contact .text-bold').first
    seller_name = seller_el.text.strip() if seller_el else None
    seller_type_el = page.css('.userbadge-private, .userbadge-commercial').first
    seller_type = None
    if seller_type_el:
        cls = " ".join(seller_type_el.attrib.get("class", "").split())
        seller_type = "gewerblich" if "commercial" in cls else "privat"

    # Kategorie-Pfad (Breadcrumb)
    category_path = [el.text.strip() for el in page.css('#breadcrump-data li a, .breadcrumb a') if el.text.strip()]

    return KleinanzeigeDetail(
        ad_id=ad_id,
        title=title,
        price_raw=price_raw,
        price_value=price_value,
        price_negotiable=price_neg,
        currency="EUR",
        location=location,
        date_text=date_text,
        url=url,
        description=description,
        image_urls=image_urls,
        attributes=attributes,
        seller_name=seller_name,
        seller_type=seller_type,
        category_path=category_path,
    )


# ─────────────────────────────────────────────
# Scraper-Klasse
# ─────────────────────────────────────────────

class KleinanzeigenScraper:
    """
    Scrapling-basierter Scraper für kleinanzeigen.de.

    Beispiel:
        scraper = KleinanzeigenScraper()
        listings = scraper.search("iphone 14", category_id=161, location_slug="heidelberg", radius_km=50)
        for l in listings:
            print(l)
    """

    # Kleinanzeigen erlaubt ~1-2 req/s ohne Block
    DEFAULT_DELAY = 1.5
    MAX_RETRIES = 3

    def __init__(self, delay: float = DEFAULT_DELAY):
        self.delay = delay
        self._fetcher = Fetcher()
        self._last_request = 0.0

    def _fetch(self, url: str, retry: int = 0) -> Optional[str]:
        """HTTP GET mit Rate-Limiting und Retry."""
        # Rate-limit
        elapsed = time.time() - self._last_request
        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)

        logger.info(f"GET {url}")
        try:
            page = self._fetcher.get(url, stealthy_headers=True, follow_redirects=True)
            self._last_request = time.time()

            if page.status == 200:
                return page.body
            elif page.status == 429:
                wait = 2 ** (retry + 2)  # 4s, 8s, 16s
                logger.warning(f"Rate-limited (429), warte {wait}s ...")
                time.sleep(wait)
                if retry < self.MAX_RETRIES:
                    return self._fetch(url, retry + 1)
            elif page.status == 403:
                logger.error(f"403 Forbidden – möglicherweise Bot-Detection aktiv")
                return None
            else:
                logger.warning(f"Unerwarteter Status {page.status} für {url}")
                return None

        except Exception as e:
            logger.error(f"Fehler beim Abrufen von {url}: {e}")
            if retry < self.MAX_RETRIES:
                time.sleep(2 ** retry)
                return self._fetch(url, retry + 1)
            return None

    def search(
        self,
        keyword: str = "",
        *,
        category_id: Optional[int] = None,
        location_slug: Optional[str] = None,
        radius_km: Optional[int] = None,
        price_min: Optional[int] = None,
        price_max: Optional[int] = None,
        max_pages: int = 1,
        sort: str = "RELEVANCE",
    ) -> list[KleinanzeigeDetail]:
        """
        Sucht Anzeigen und gibt alle Ergebnisse zurück.

        Args:
            keyword:        Suchbegriff (z.B. "iphone 14")
            category_id:    Kategorie-ID (z.B. 161 = Handys)
            location_slug:  Ort als Slug (z.B. "heidelberg", "st-leon-rot")
            radius_km:      Suchradius in km (5/10/20/30/50/100/150/200)
            price_min:      Mindestpreis in €
            price_max:      Höchstpreis in €
            max_pages:      Anzahl Seiten (Standard: 1)
            sort:           Sortierung: RELEVANCE | DATE_DESCENDING | PRICE_ASCENDING

        Returns:
            Liste von KleinanzeigeDetail-Objekten
        """
        all_results: list[KleinanzeigeDetail] = []

        for page_num in range(1, max_pages + 1):
            url = build_search_url(
                keyword=keyword,
                category_id=category_id,
                location_slug=location_slug,
                radius_km=radius_km,
                page=page_num,
                price_min=price_min,
                price_max=price_max,
                sort=sort,
            )

            html = self._fetch(url)
            if not html:
                logger.warning(f"Keine HTML-Antwort für Seite {page_num}, breche ab")
                break

            listings = parse_listing_page(html)
            if not listings:
                logger.info(f"Keine Ergebnisse auf Seite {page_num}, fertig")
                break

            all_results.extend(listings)
            logger.info(f"Seite {page_num}: {len(listings)} Ergebnisse ({len(all_results)} gesamt)")

        return all_results

    def get_listing(self, url: str) -> Optional[KleinanzeigeDetail]:
        """Ruft eine Einzelanzeige ab und gibt die geparsten Details zurück."""
        html = self._fetch(url)
        if not html:
            return None
        return parse_detail_page(html, url=url)

    def search_and_enrich(
        self,
        keyword: str,
        *,
        category_id: Optional[int] = None,
        location_slug: Optional[str] = None,
        radius_km: Optional[int] = None,
        max_pages: int = 1,
        max_details: int = 10,
    ) -> list[KleinanzeigeDetail]:
        """
        Sucht und ruft dann Detailseiten ab (langsamer, aber vollständige Daten).
        max_details begrenzt die Anzahl der Detail-Requests.
        """
        listings = self.search(
            keyword,
            category_id=category_id,
            location_slug=location_slug,
            radius_km=radius_km,
            max_pages=max_pages,
        )

        enriched = []
        for i, listing in enumerate(listings[:max_details]):
            detail = self.get_listing(listing.url)
            if detail:
                enriched.append(detail)
            else:
                enriched.append(listing)  # Fallback auf Listen-Daten

        return enriched


# ─────────────────────────────────────────────
# Kategorie-IDs (häufige)
# ─────────────────────────────────────────────
CATEGORIES = {
    "elektronik": 161,
    "handys": 173,
    "computer": 224,
    "tablets": 228,
    "audio_hifi": 172,
    "foto": 269,
    "konsolen": 230,
    "haushaltsgeraete": 272,
    "autos": 216,
    "motorraeder": 305,
    "fahrraeder": 217,
    "kleidung_herren": 111,
    "kleidung_damen": 110,
    "moebel": 272,
    "immobilien_miete": 203,
    "jobs": 102,
    "dienstleistungen": 271,
}


# ─────────────────────────────────────────────
# CLI / Quick-Test
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    keyword = sys.argv[1] if len(sys.argv) > 1 else "iphone"
    cat = int(sys.argv[2]) if len(sys.argv) > 2 else None

    scraper = KleinanzeigenScraper()
    results = scraper.search(keyword, category_id=cat, location_slug="heidelberg", radius_km=50)

    print(f"\n{'='*60}")
    print(f"Ergebnisse für '{keyword}': {len(results)}")
    print(f"{'='*60}")
    for r in results:
        print(r)
