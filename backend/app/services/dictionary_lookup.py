"""Hybrid Dictionary Definition Lookup Service.

Combines offline database definitions for rapid instant access with
asynchronous online API fallback and memory caching.
"""

from __future__ import annotations
import asyncio
import logging
import re
from typing import Any, Optional
import httpx

from app.game.offline_definitions import OFFLINE_DEFINITIONS

logger = logging.getLogger(__name__)

POS_MAP = {
    "n": "noun",
    "v": "verb",
    "adj": "adjective",
    "adv": "adverb",
    "u": "interjection",
    "pron": "pronoun",
    "prep": "preposition",
    "conj": "conjunction",
    "art": "article",
}

GEO_PREFIXES = (
    "a locality in",
    "a municipality of",
    "a village in",
    "a town in",
    "a city in",
    "a county of",
    "a county in",
    "a commune of",
    "a commune in",
    "a parish in",
    "a district of",
    "an unincorporated community in",
    "a civil parish in",
)


def clean_definition_text(text: str) -> str:
    """Clean raw Datamuse/Wiktionary definition strings."""
    cleaned = text.strip()
    # Unpack nested [(...)] patterns
    cleaned = re.sub(r"\[\((.*?)\)\s*", r"(\1) ", cleaned)
    # Remove hanging unclosed brackets at end
    cleaned = cleaned.rstrip("] ")
    # Clean multiple spaces
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


class DictionaryLookupService:
    """Multi-tier Dictionary Lookup Service with L1 RAM Cache, L2 Database, and L3 Online Fallback."""

    def __init__(self) -> None:
        self._cache: dict[str, dict[str, Any]] = {}
        # Pre-seed L1 RAM cache with offline definitions
        for word, data in OFFLINE_DEFINITIONS.items():
            self._cache[word] = {
                "word": word,
                "found": True,
                "phonetic": data.get("phonetic"),
                "meanings": data.get("meanings", []),
            }

    async def _persist_to_db(self, word: str, phonetic: Optional[str], meanings: list[dict], source: str = "ONLINE") -> None:
        """Asynchronously persist word definition to database in background (Non-blocking)."""
        try:
            from app.database.session import AsyncSessionLocal
            from app.database.models import WordDefinition
            from sqlalchemy import select

            async with AsyncSessionLocal() as session:
                existing = await session.scalar(select(WordDefinition.word).where(WordDefinition.word == word))
                if not existing:
                    session.add(WordDefinition(
                        word=word,
                        phonetic=phonetic,
                        meanings=meanings,
                        source=source,
                    ))
                    await session.commit()
        except Exception as exc:
            logger.debug(f"Background definition persist skipped for '{word}': {exc}")

    async def lookup_word(self, raw_word: str) -> dict[str, Any]:
        """Look up definition of a word using 3-tier L1 RAM -> L2 Database -> L3 Online strategy."""
        if not raw_word or not isinstance(raw_word, str):
            return {
                "word": "",
                "found": False,
                "phonetic": None,
                "meanings": [],
                "message": "Invalid word.",
            }

        word = raw_word.strip().upper()

        # Tier 1: In-memory RAM cache check (0ms Instant)
        if word in self._cache:
            return self._cache[word]

        # Tier 2: Persistent Database cache check (<1ms)
        try:
            from app.database.session import AsyncSessionLocal
            from app.database.models import WordDefinition
            from sqlalchemy import select

            async with AsyncSessionLocal() as session:
                db_record = (await session.execute(select(WordDefinition).where(WordDefinition.word == word))).scalar_one_or_none()
                if db_record:
                    result = {
                        "word": db_record.word,
                        "found": True,
                        "phonetic": db_record.phonetic,
                        "meanings": db_record.meanings or [],
                    }
                    self._cache[word] = result
                    return result
        except Exception as exc:
            logger.debug(f"Database definition check failed for '{word}': {exc}")

        # Tier 3: Async Online API query (Datamuse dictionary with definition metadata)
        try:
            async with httpx.AsyncClient(timeout=3.5) as client:
                resp = await client.get(
                    f"https://api.datamuse.com/words?sp={word.lower()}&md=dp&max=1"
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if data and isinstance(data, list) and len(data) > 0:
                        entry = data[0]
                        defs_raw: list[str] = entry.get("defs", [])
                        if defs_raw:
                            meanings_map: dict[str, list[str]] = {}
                            geo_fallbacks: list[tuple[str, str]] = []

                            for d_str in defs_raw:
                                if "\t" in d_str:
                                    tag, def_text = d_str.split("\t", 1)
                                    pos = POS_MAP.get(tag.strip().lower(), tag.strip().lower())
                                else:
                                    pos = "general"
                                    def_text = d_str

                                clean_def = clean_definition_text(def_text)
                                if not clean_def:
                                    continue

                                # Deprioritize obscure geography places if general definitions exist
                                lower_def = clean_def.lower()
                                if any(lower_def.startswith(prefix) for prefix in GEO_PREFIXES):
                                    geo_fallbacks.append((pos, clean_def))
                                    continue

                                if pos not in meanings_map:
                                    meanings_map[pos] = []
                                if clean_def not in meanings_map[pos]:
                                    meanings_map[pos].append(clean_def)

                            # If only geo definitions were found, restore them
                            if not meanings_map and geo_fallbacks:
                                for pos, geo_def in geo_fallbacks:
                                    if pos not in meanings_map:
                                        meanings_map[pos] = []
                                    meanings_map[pos].append(geo_def)

                            meanings = [
                                {
                                    "partOfSpeech": pos,
                                    "definitions": defs_list[:3],  # top 3 per part of speech
                                }
                                for pos, defs_list in meanings_map.items()
                            ]

                            result = {
                                "word": word,
                                "found": True,
                                "phonetic": None,
                                "meanings": meanings,
                            }
                            # Cache in L1 RAM immediately
                            self._cache[word] = result
                            # Non-blocking async background persist to L2 Database
                            asyncio.create_task(self._persist_to_db(word, None, meanings, source="ONLINE"))
                            return result
        except Exception as exc:
            logger.warning(f"Online definition lookup failed for '{word}': {exc}")

        # Fallback for unrecognized words
        fallback = {
            "word": word,
            "found": False,
            "phonetic": None,
            "meanings": [
                {
                    "partOfSpeech": "word",
                    "definitions": [f"Valid game word '{word}'."],
                }
            ],
        }
        self._cache[word] = fallback
        return fallback


dictionary_lookup_service = DictionaryLookupService()

