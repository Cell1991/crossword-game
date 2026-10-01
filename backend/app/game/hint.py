from collections import Counter
from typing import Any, Optional

from app.game.board import Board
from app.game.dictionary import dictionary_service
from app.game.rules import RuleEngine
from app.game.tiles import DEFAULT_LETTER_VALUES


def find_hint_suggestions(
    board_cells: dict[str, dict[str, Any]],
    rack_tiles: list[dict[str, Any] | str],
    is_first_move: bool = False,
    max_suggestions: int = 3,
) -> list[dict[str, Any]]:
    """
    Finds the top scoring valid word placements that can be made on the board
    using the player's current rack tiles.

    Returns up to `max_suggestions` (default 3) suggestion objects:
    [
        {
            "word": "APPLE",
            "score": 42,
            "direction": "across" | "down",
            "tiles": [{"row": 9, "col": 13, "letter": "A", "value": 1}, ...]
        },
        ...
    ]
    """
    if not rack_tiles:
        return []

    # Extract rack letters and values
    rack_letters: list[str] = []
    rack_val_map: dict[str, int] = {}
    for t in rack_tiles:
        if isinstance(t, dict):
            letter = str(t.get("letter", "")).upper()
            val = int(t.get("value", DEFAULT_LETTER_VALUES.get(letter, 1)))
        else:
            letter = str(t).upper()
            val = DEFAULT_LETTER_VALUES.get(letter, 1)
        if letter:
            rack_letters.append(letter)
            rack_val_map[letter] = val

    if not rack_letters:
        return []

    rack_counts = Counter(rack_letters)
    blanks = rack_counts.get("?", 0) + rack_counts.get("*", 0) + rack_counts.get("BLANK", 0)

    is_board_empty = len(board_cells) == 0 or is_first_move
    candidates: list[dict[str, Any]] = []
    seen_signatures: set[str] = set()
    search_cap = max(30, max_suggestions * 2)

    occupied: dict[tuple[int, int], str] = {
        (c["row"], c["col"]): c["letter"].upper()
        for c in board_cells.values()
    } if not is_board_empty else {}

    board_counts = Counter(occupied.values())
    viable_words_by_len = dictionary_service.get_viable_words(
        rack_counts=dict(rack_counts),
        board_counts=dict(board_counts),
        blanks=blanks,
        max_len=min(Board.ROWS, len(rack_letters) + len(occupied)),
    )

    def get_tile_val(letter: str) -> int:
        return rack_val_map.get(letter, DEFAULT_LETTER_VALUES.get(letter, 1))

    # Helper: Check if a word can be formed with rack given a pattern of fixed board letters
    def match_word_to_pattern(word: str, fixed: dict[int, str]) -> bool:
        # Fast positional check first
        for pos, ch in fixed.items():
            if word[pos] != ch:
                return False

        # Check required letters from rack
        used_blanks = 0
        req_counts: dict[str, int] = {}
        for i, char in enumerate(word):
            if i not in fixed:
                req_counts[char] = req_counts.get(char, 0) + 1

        for char, count in req_counts.items():
            avail = rack_counts.get(char, 0)
            if count > avail:
                used_blanks += (count - avail)
                if used_blanks > blanks:
                    return False
        return True

    # ==========================================
    # Case 1: First Move (Empty Board)
    # ==========================================
    if is_board_empty:
        center_r, center_c = Board.CENTER[0], Board.CENTER[1]
        rack_len = len(rack_letters)
        for w_len in range(2, rack_len + 1):
            words_for_len = viable_words_by_len.get(w_len, [])
            for word in words_for_len:
                # Try placing across covering center
                for offset in range(w_len):
                    start_c = center_c - offset
                    if 0 <= start_c and start_c + w_len <= Board.COLS:
                        placed = [
                            {"row": center_r, "col": start_c + i, "letter": word[i], "value": get_tile_val(word[i])}
                            for i in range(w_len)
                        ]
                        valid, _, _, score, _ = RuleEngine.validate_move(board_cells, placed, is_first_move=True)
                        if valid:
                            sig = f"A:{center_r}:{start_c}:{word}"
                            if sig not in seen_signatures:
                                seen_signatures.add(sig)
                                candidates.append({
                                    "word": word,
                                    "score": score,
                                    "direction": "across",
                                    "tiles": placed,
                                    "bingo_bonus": 50 if len(placed) >= 7 else 0,
                                })

                # Try placing down covering center
                for offset in range(w_len):
                    start_r = center_r - offset
                    if 0 <= start_r and start_r + w_len <= Board.ROWS:
                        placed = [
                            {"row": start_r + i, "col": center_c, "letter": word[i], "value": get_tile_val(word[i])}
                            for i in range(w_len)
                        ]
                        valid, _, _, score, _ = RuleEngine.validate_move(board_cells, placed, is_first_move=True)
                        if valid:
                            sig = f"D:{start_r}:{center_c}:{word}"
                            if sig not in seen_signatures:
                                seen_signatures.add(sig)
                                candidates.append({
                                    "word": word,
                                    "score": score,
                                    "direction": "down",
                                    "tiles": placed,
                                    "bingo_bonus": 50 if len(placed) >= 7 else 0,
                                })

    # ==========================================
    # Case 2: Subsequent Moves (Active Board)
    # ==========================================
    else:
        checked_spans: set[tuple[str, int, int, int]] = set()

        for (r, c), board_char in occupied.items():
            # Test horizontal spans passing through (r, c)
            left_limit = max(0, c - len(rack_letters))
            right_limit = min(Board.COLS, c + len(rack_letters) + 1)

            for start_c in range(left_limit, c + 1):
                for end_c in range(c + 1, right_limit + 1):
                    span_len = end_c - start_c
                    if span_len < 2:
                        continue

                    # Word boundary checks: cannot have letters immediately adjacent on outer ends
                    if (r, start_c - 1) in occupied or (r, end_c) in occupied:
                        continue

                    span_key = ("across", r, start_c, end_c)
                    if span_key in checked_spans:
                        continue
                    checked_spans.add(span_key)

                    # Gather fixed letters in span
                    fixed_letters: dict[int, str] = {}
                    num_rack_needed = 0
                    has_occupied = False
                    for idx, cur_c in enumerate(range(start_c, end_c)):
                        if (r, cur_c) in occupied:
                            fixed_letters[idx] = occupied[(r, cur_c)]
                            has_occupied = True
                        else:
                            num_rack_needed += 1

                    if not has_occupied or num_rack_needed == 0 or num_rack_needed > len(rack_letters):
                        continue

                    # Search dictionary words matching this length and fixed letters
                    words_for_len = viable_words_by_len.get(span_len, [])
                    for word in words_for_len:
                        if match_word_to_pattern(word, fixed_letters):
                            placed = [
                                {"row": r, "col": start_c + i, "letter": word[i], "value": get_tile_val(word[i])}
                                for i in range(span_len)
                                if i not in fixed_letters
                            ]
                            valid, _, _, score, _ = RuleEngine.validate_move(board_cells, placed, is_first_move=False)
                            if valid:
                                sig = f"A:{r}:{start_c}:{word}"
                                if sig not in seen_signatures:
                                    seen_signatures.add(sig)
                                    candidates.append({
                                        "word": word,
                                        "score": score,
                                        "direction": "across",
                                        "tiles": placed,
                                        "bingo_bonus": 50 if len(placed) >= 7 else 0,
                                    })
                                    if len(candidates) >= search_cap:
                                        break
                    if len(candidates) >= search_cap:
                        break

            # Test vertical spans passing through (r, c)
            top_limit = max(0, r - len(rack_letters))
            bottom_limit = min(Board.ROWS, r + len(rack_letters) + 1)

            for start_r in range(top_limit, r + 1):
                for end_r in range(r + 1, bottom_limit + 1):
                    span_len = end_r - start_r
                    if span_len < 2:
                        continue

                    # Word boundary checks
                    if (start_r - 1, c) in occupied or (end_r, c) in occupied:
                        continue

                    span_key = ("down", c, start_r, end_r)
                    if span_key in checked_spans:
                        continue
                    checked_spans.add(span_key)

                    fixed_letters = {}
                    num_rack_needed = 0
                    has_occupied = False
                    for idx, cur_r in enumerate(range(start_r, end_r)):
                        if (cur_r, c) in occupied:
                            fixed_letters[idx] = occupied[(cur_r, c)]
                            has_occupied = True
                        else:
                            num_rack_needed += 1

                    if not has_occupied or num_rack_needed == 0 or num_rack_needed > len(rack_letters):
                        continue

                    words_for_len = viable_words_by_len.get(span_len, [])
                    for word in words_for_len:
                        if match_word_to_pattern(word, fixed_letters):
                            placed = [
                                {"row": start_r + i, "col": c, "letter": word[i], "value": get_tile_val(word[i])}
                                for i in range(span_len)
                                if i not in fixed_letters
                            ]
                            valid, _, _, score, _ = RuleEngine.validate_move(board_cells, placed, is_first_move=False)
                            if valid:
                                sig = f"D:{start_r}:{c}:{word}"
                                if sig not in seen_signatures:
                                    seen_signatures.add(sig)
                                    candidates.append({
                                        "word": word,
                                        "score": score,
                                        "direction": "down",
                                        "tiles": placed,
                                        "bingo_bonus": 50 if len(placed) >= 7 else 0,
                                    })
                                    if len(candidates) >= search_cap:
                                        break
                    if len(candidates) >= search_cap:
                        break

    if not candidates:
        return []

    # Sort descending by score
    candidates.sort(key=lambda item: item["score"], reverse=True)

    # Pick top distinct suggestions (prefer distinct words if possible)
    top_suggestions: list[dict[str, Any]] = []
    seen_words: set[str] = set()

    for cand in candidates:
        if cand["word"] not in seen_words:
            seen_words.add(cand["word"])
            top_suggestions.append(cand)
            if len(top_suggestions) >= max_suggestions:
                break

    # If we have fewer than max_suggestions distinct words, backfill with remaining best scoring variations
    if len(top_suggestions) < max_suggestions:
        for cand in candidates:
            if cand not in top_suggestions:
                top_suggestions.append(cand)
                if len(top_suggestions) >= max_suggestions:
                    break

    return top_suggestions[:max_suggestions]


def find_hint_candidates(
    board_cells: dict[str, dict[str, Any]],
    rack_letters: list[str],
    is_first_move: bool,
    max_attempts: int = 300,
) -> list[tuple[int, int]]:
    """Backward compatibility wrapper returning anchor coords of top suggestions."""
    suggestions = find_hint_suggestions(board_cells, rack_letters, is_first_move=is_first_move, max_suggestions=5)
    coords: set[tuple[int, int]] = set()
    for s in suggestions:
        for t in s.get("tiles", []):
            coords.add((t["row"], t["col"]))
    return sorted(coords)
