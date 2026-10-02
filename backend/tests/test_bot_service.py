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


@pytest.mark.parametrize("scores", [
    [2, 5, 9, 14, 35, 48],   # a board offering big plays
    [2, 3, 4, 5, 6, 7],      # a cramped board where nothing scores well
])
def test_order_candidates_by_difficulty_is_monotonic_in_strength(scores):
    """
    A harder bot must prefer a higher-scoring move than an easier one, whatever the board offers.
    This ordering used to key off absolute point bands, so on a low-scoring board medium took the
    best move while hard randomised below it, and Nexus beat Titan.
    """
    candidates = [{"word": f"W{s}", "score": s} for s in scores]

    picks = {
        level: BotService._order_candidates_by_difficulty(candidates, level)
        for level in ("easy", "medium", "hard")
    }

    # Nothing may be dropped: the caller falls through this list when a move will not fit the rack.
    for level, ordered in picks.items():
        assert sorted(c["score"] for c in ordered) == sorted(scores), level

    easy, medium, hard = (picks[level][0]["score"] for level in ("easy", "medium", "hard"))
    assert hard == max(scores), "hard must take the best move available"
    assert easy < medium <= hard, f"expected easy < medium <= hard, got {easy} / {medium} / {hard}"


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
