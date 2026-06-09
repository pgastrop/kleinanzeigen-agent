"""
scraper/main.py
---------------
FastAPI-Microservice für Kleinanzeigen-Preisrecherche.
Wird von der Next.js-App unter /api/analyze aufgerufen.

Start:
    uvicorn main:app --host 0.0.0.0 --port 8000
"""

import statistics
import logging
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from kleinanzeigen_scraper import KleinanzeigenScraper

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Kleinanzeigen Price API", version="1.0.0")

# CORS: nur lokaler Next.js-Dev-Server + Produktion
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Einmaliger Scraper (Rate-Limiting ist instanz-basiert)
_scraper = KleinanzeigenScraper(delay=1.5)


class PriceResult(BaseModel):
    min: int
    max: int
    median: int
    count: int
    source: str = "kleinanzeigen.de"


@app.get("/prices", response_model=PriceResult)
def get_prices(
    q: str = Query(..., min_length=2, max_length=100, description="Produktname / Suchbegriff"),
    max_pages: int = Query(1, ge=1, le=3, description="Anzahl Suchergebnis-Seiten"),
):
    """
    Sucht Preise auf Kleinanzeigen.de und gibt Statistik zurück.
    Liefert HTTP 404 wenn weniger als 3 verwertbare Preise gefunden wurden.
    """
    logger.info(f"Preissuche: '{q}' (max_pages={max_pages})")

    try:
        listings = _scraper.search(q, max_pages=max_pages)
    except Exception as exc:
        logger.error(f"Scraper-Fehler: {exc}")
        raise HTTPException(status_code=502, detail=f"Scraper-Fehler: {exc}")

    # Nur Listings mit validen Preisen > 0
    prices = [
        int(l.price_value)
        for l in listings
        if l.price_value is not None and l.price_value > 0
    ]

    if len(prices) < 3:
        raise HTTPException(
            status_code=404,
            detail=f"Zu wenige Preisdaten ({len(prices)} Treffer) fuer '{q}'",
        )

    prices.sort()

    # Trimmed mean: untere 10 %, obere 20 % entfernen (Ausreißer)
    trim_low  = max(0, int(len(prices) * 0.10))
    trim_high = max(0, int(len(prices) * 0.20))
    trimmed   = prices[trim_low : len(prices) - trim_high] if trim_high else prices[trim_low:]

    if len(trimmed) < 2:
        raise HTTPException(status_code=404, detail="Nicht genug Preisdaten nach Bereinigung")

    return PriceResult(
        min=trimmed[0],
        max=trimmed[-1],
        median=int(statistics.median(trimmed)),
        count=len(prices),
    )


@app.get("/health")
def health():
    return {"status": "ok"}
