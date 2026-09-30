"""Instant Bulk Dictionary Ingestion Script.

Downloads and loads 100,000+ open-source English word definitions into
PostgreSQL `word_definitions` table in seconds using high-speed bulk batches.
"""

from __future__ import annotations
import asyncio
import json
import os
import sys
import urllib.request
from typing import Any
from sqlalchemy import select, insert

# Ensure parent path is on sys.path for app module imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.session import AsyncSessionLocal
from app.database.models import WordDefinition


DICT_URLS = [
    (
        "Webster's English Dictionary (102k words)",
        "https://raw.githubusercontent.com/matthewreagan/WebstersEnglishDictionary/master/dictionary_compact.json"
    ),
    (
        "Collaborative Open English Dictionary (86k words)",
        "https://raw.githubusercontent.com/adambom/dictionary/master/dictionary.json"
    ),
]


def download_dictionary_dataset(name: str, url: str) -> dict[str, str]:
    """Download dictionary JSON dataset into memory."""
    print(f"📥 Downloading {name}...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        content = resp.read().decode("utf-8")
        data = json.loads(content)
        print(f"   ✓ Loaded {len(data):,} words from {name}.")
        return data


async def get_existing_words() -> set[str]:
    """Retrieve words already present in the database to avoid duplicate work."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(WordDefinition.word))
        return set(result.scalars().all())


async def bulk_insert_definitions():
    """Download datasets, parse definitions, and bulk-insert into PostgreSQL."""
    print("🚀 Starting Instant Full Dictionary Ingestion...\n")

    existing_words = await get_existing_words()
    print(f"📊 Currently saved in Database: {len(existing_words):,} definitions.\n")

    combined_dict: dict[str, str] = {}

    for name, url in DICT_URLS:
        try:
            data = download_dictionary_dataset(name, url)
            for raw_word, raw_def in data.items():
                w = raw_word.strip().upper()
                if w and w.isalpha() and 2 <= len(w) <= 32:
                    if w not in combined_dict and raw_def:
                        # Clean definition text
                        cleaned_def = raw_def.strip()
                        if cleaned_def:
                            combined_dict[w] = cleaned_def
        except Exception as exc:
            print(f"   ⚠️ Could not load {name}: {exc}")

    print(f"\n📦 Total unique words gathered across datasets: {len(combined_dict):,}")

    new_words = {w: d for w, d in combined_dict.items() if w not in existing_words}
    print(f"✨ New words to insert into PostgreSQL: {len(new_words):,}\n")

    if not new_words:
        print("🎉 Database is already 100% up to date!")
        return

    # Convert to database schema rows
    rows: list[dict[str, Any]] = []
    for word, def_text in new_words.items():
        # Clean multi-paragraph or numbered definitions into clean lists
        lines = [line.strip() for line in def_text.split("\n") if line.strip()]
        definitions = lines[:4] if lines else [def_text[:400]]

        rows.append({
            "word": word,
            "phonetic": None,
            "meanings": [{"partOfSpeech": "general", "definitions": definitions}],
            "source": "OFFLINE_BULK",
        })

    # Bulk insert in batches of 5,000 for maximum speed
    batch_size = 5000
    total_rows = len(rows)
    inserted_count = 0

    print(f"⚡ Inserting {total_rows:,} definitions into PostgreSQL...")
    async with AsyncSessionLocal() as session:
        for i in range(0, total_rows, batch_size):
            chunk = rows[i : i + batch_size]
            await session.execute(insert(WordDefinition), chunk)
            await session.commit()
            inserted_count += len(chunk)
            pct = (inserted_count / total_rows) * 100
            print(f"   ✓ Inserted [{inserted_count:,}/{total_rows:,}] ({pct:.1f}%) definitions.")

    total_final = await get_existing_words()
    print(f"\n🏆 SUCCESS! Total definitions now stored in PostgreSQL: {len(total_final):,} words.")


if __name__ == "__main__":
    asyncio.run(bulk_insert_definitions())
