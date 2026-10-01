import pytest
import time
from app.services.bot_service import BotService
from app.game.hint import find_hint_suggestions


def test_words_by_char_fast_index():
    start = time.perf_counter()
    words_c = BotService._get_words_for_char("C")
    elapsed = (time.perf_counter() - start) * 1000
    assert len(words_c) > 0
    # Subsequent calls must be instantaneous (<1ms)
    start = time.perf_counter()
    words_a = BotService._get_words_for_char("A")
    elapsed_fast = (time.perf_counter() - start) * 1000
    assert elapsed_fast < 5, f"Cached char lookup should be <5ms, took {elapsed_fast:.2f}ms"
    assert any("CAT" == w for w in words_c)


def test_order_candidates_by_difficulty():
    mock_candidates = [
        {"word": "AT", "score": 2},
        {"word": "CAT", "score": 5},
        {"word": "BOAT", "score": 9},
        {"word": "CRANE", "score": 14},
        {"word": "ZODIAC", "score": 35},
        {"word": "QUARTZ", "score": 48},
    ]

    # Easy: targets 2 to 10
    easy_res = BotService._order_candidates_by_difficulty(mock_candidates, "easy")
    assert len(easy_res) == len(mock_candidates)
    # The first element should be in the 2-10 range
    assert 2 <= easy_res[0]["score"] <= 10

    # Medium: targets 2 to 15, favoring higher average (e.g. 14, 9, 5)
    medium_res = BotService._order_candidates_by_difficulty(mock_candidates, "medium")
    assert 2 <= medium_res[0]["score"] <= 15
    # Since pool is sorted descending, highest in <=15 should be first
    assert medium_res[0]["score"] == 14

    # Hard: picks maximum score (35 or 48)
    hard_res = BotService._order_candidates_by_difficulty(mock_candidates, "hard")
    assert hard_res[0]["score"] in (35, 48)


def test_hint_candidates_fast_speed():
    board_cells = {}
    rack_tiles = [
        {"id": "1", "letter": "C", "value": 3},
        {"id": "2", "letter": "A", "value": 1},
        {"id": "3", "letter": "T", "value": 1},
        {"id": "4", "letter": "S", "value": 1},
        {"id": "5", "letter": "D", "value": 2},
        {"id": "6", "letter": "O", "value": 1},
        {"id": "7", "letter": "G", "value": 2},
    ]

    start = time.perf_counter()
    candidates = find_hint_suggestions(board_cells, rack_tiles, is_first_move=True, max_suggestions=20)
    elapsed_ms = (time.perf_counter() - start) * 1000

    assert len(candidates) > 0
    assert elapsed_ms < 200, f"Generating candidates took {elapsed_ms:.2f}ms"
