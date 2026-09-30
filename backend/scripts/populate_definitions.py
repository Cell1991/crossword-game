"""Bulk Word Definition Ingestion & Seeding Utility.

Asynchronously populates English definitions for dictionary words into the
PostgreSQL `word_definitions` table in batches.

Features:
- Resumable: Automatically skips words already saved in the database.
- Concurrency-Controlled: Safe rate-limiting to prevent API throttling.
- Batch Persist: Bulk inserts definitions to maximize database throughput.
"""

from __future__ import annotations
import asyncio
import os
import sys
from typing import Any, Optional
import httpx
from sqlalchemy import select, insert

# Ensure parent path is on sys.path for app module imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.session import AsyncSessionLocal
from app.database.models import WordDefinition
from app.services.dictionary_lookup import clean_definition_text, POS_MAP, GEO_PREFIXES


async def get_existing_words() -> set[str]:
    """Retrieve words already present in the database."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(WordDefinition.word))
        return set(result.scalars().all())


async def fetch_word_definition(client: httpx.AsyncClient, word: str) -> Optional[dict[str, Any]]:
    """Fetch and parse word definition from dictionary API."""
    try:
        resp = await client.get(
            f"https://api.datamuse.com/words?sp={word.lower()}&md=dp&max=1",
            timeout=5.0,
        )
        if resp.status_code != 200:
            return None

        data = resp.json()
        if not data or not isinstance(data, list):
            return None

        entry = data[0]
        defs_raw: list[str] = entry.get("defs", [])
        if not defs_raw:
            return None

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

            lower_def = clean_def.lower()
            if any(lower_def.startswith(prefix) for prefix in GEO_PREFIXES):
                geo_fallbacks.append((pos, clean_def))
                continue

            if pos not in meanings_map:
                meanings_map[pos] = []
            if clean_def not in meanings_map[pos]:
                meanings_map[pos].append(clean_def)

        if not meanings_map and geo_fallbacks:
            for pos, geo_def in geo_fallbacks:
                if pos not in meanings_map:
                    meanings_map[pos] = []
                meanings_map[pos].append(geo_def)

        if not meanings_map:
            return None

        meanings = [
            {"partOfSpeech": pos, "definitions": defs_list[:3]}
            for pos, defs_list in meanings_map.items()
        ]

        return {
            "word": word,
            "phonetic": None,
            "meanings": meanings,
            "source": "BULK_SYNC",
        }
    except Exception:
        return None


async def run_bulk_ingestion(limit: Optional[int] = None, batch_size: int = 50, concurrency: int = 5):
    """Run the batch definition fetch and database populate process."""
    wordlist_path = os.path.join(os.path.dirname(__file__), "..", "data", "wordlist.txt")
    if not os.path.exists(wordlist_path):
        print(f"Error: Wordlist not found at {wordlist_path}")
        return

    print("Checking existing definitions in database...")
    existing = await get_existing_words()
    print(f"Database currently contains {len(existing):,} saved definitions.")

    # Load all words, sorted by length (short words prioritized first)
    all_words: list[str] = []
    with open(wordlist_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            w = line.strip().upper()
            if w and w.isalpha() and w not in existing:
                all_words.append(w)

    all_words.sort(key=lambda w: (len(w), w))

    if limit:
        all_words = all_words[:limit]

    total_to_fetch = len(all_words)
    print(f"Found {total_to_fetch:,} words remaining to populate.")
    if total_to_fetch == 0:
        print("All words are already populated in the database!")
        return

    semaphore = asyncio.Semaphore(concurrency)
    saved_count = 0
    buffer: list[dict[str, Any]] = []

    async with httpx.AsyncClient(limits=httpx.Limits(max_connections=concurrency + 2)) as client:
        async def worker(word: str) -> Optional[dict[str, Any]]:
            async with semaphore:
                # Modest delay between API queries
                await asyncio.sleep(0.05)
                return await fetch_word_definition(client, word)

        for i in range(0, total_to_fetch, batch_size):
            chunk = all_words[i : i + batch_size]
            results = await asyncio.gather(*(worker(w) for w in chunk))

            valid_results = [r for r in results if r is not None]
            if valid_results:
                buffer.extend(valid_results)

            if len(buffer) >= batch_size or i + batch_size >= total_to_fetch:
                if buffer:
                    async with AsyncSessionLocal() as session:
                        await session.execute(insert(WordDefinition), buffer)
                        await session.commit()
                    saved_count += len(buffer)
                    buffer.clear()

            progress_pct = ((i + len(chunk)) / total_to_fetch) * 100
            print(f"Progress: [{i + len(chunk):,}/{total_to_fetch:,}] ({progress_pct:.1f}%) — Saved: {saved_count:,} definitions to database.")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Bulk Word Definition Ingestion Tool")
    parser.add_argument("--limit", type=int, default=None, help="Maximum number of words to process in this run")
    parser.add_argument("--batch", type=int, default=50, help="Batch size for database inserts")
    parser.add_argument("--concurrency", type=int, default=5, help="Number of concurrent API fetch workers")
    args = parser.parse_args()

    try:
        asyncio.run(run_bulk_ingestion(limit=args.limit, batch_size=args.batch, concurrency=args.concurrency))
    except KeyboardInterrupt:
        print("\nProcess interrupted by user. Saved progress is safely preserved in database.")
