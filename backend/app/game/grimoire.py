from collections import Counter
from typing import Any

from app.game.board import Board
from app.game.dictionary import dictionary_service
from app.game.rules import RuleEngine
from app.game.tiles import DEFAULT_LETTER_VALUES


def find_grimoire_words(
    board_cells: dict[str, dict[str, Any]],
    rack_tiles: list[dict[str, Any] | str],
    is_first_move: bool = False,
    max_words: int = 20,
    min_len: int = 3,
) -> list[str]:
    """
    Finds up to `max_words` (default 20) valid playable words (length >= `min_len`, default 3)
    that can be played onto the current board using the player's current rack tiles.

    Returns a list of distinct uppercase word strings (e.g., ["PLANET", "STAR", "ORBIT"]).
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
    occupied: dict[tuple[int, int], str] = {
        (c["row"], c["col"]): c["letter"].upper()
        for c in board_cells.values()
    } if not is_board_empty else {}

    board_counts = Counter(occupied.values())
    viable_words_by_len = dictionary_service.get_viable_words(
        rack_counts=dict(rack_counts),
        board_counts=dict(board_counts),
        blanks=blanks,
        max_len=len(rack_letters) + len(occupied),
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

    found_words: set[str] = set()

    # ==========================================
    # Case 1: First Move (Empty Board)
    # ==========================================
    if is_board_empty:
        center_r, center_c = Board.CENTER[0], Board.CENTER[1]
        rack_len = len(rack_letters)
        for w_len in range(max(min_len, 2), rack_len + 1):
            words_for_len = viable_words_by_len.get(w_len, [])
            for word in words_for_len:
                if len(word) < min_len or word in found_words:
                    continue

                # Try across covering center
                for offset in range(w_len):
                    start_c = center_c - offset
                    placed = [
                        {"row": center_r, "col": start_c + i, "letter": word[i], "value": get_tile_val(word[i])}
                        for i in range(w_len)
                    ]
                    valid, _, _, _, _ = RuleEngine.validate_move(board_cells, placed, is_first_move=True)
                    if valid:
                        found_words.add(word)
                        break

                if len(found_words) >= max_words:
                    break

                # Try down covering center
                if word not in found_words:
                    for offset in range(w_len):
                        start_r = center_r - offset
                        placed = [
                            {"row": start_r + i, "col": center_c, "letter": word[i], "value": get_tile_val(word[i])}
                            for i in range(w_len)
                        ]
                        valid, _, _, _, _ = RuleEngine.validate_move(board_cells, placed, is_first_move=True)
                        if valid:
                            found_words.add(word)
                            break

                if len(found_words) >= max_words:
                    break
            if len(found_words) >= max_words:
                break

    # ==========================================
    # Case 2: Active Board (Subsequent Moves)
    # ==========================================
    else:
        checked_spans: set[tuple[str, int, int, int]] = set()

        for (r, c), board_char in occupied.items():
            if len(found_words) >= max_words:
                break

            # Test horizontal spans passing through (r, c)
            left_limit = c - len(rack_letters)
            right_limit = c + len(rack_letters) + 1

            for start_c in range(left_limit, c + 1):
                if len(found_words) >= max_words:
                    break
                for end_c in range(c + 1, right_limit + 1):
                    span_len = end_c - start_c
                    if span_len < min_len:
                        continue

                    # Word boundary checks
                    if (r, start_c - 1) in occupied or (r, end_c) in occupied:
                        continue

                    span_key = ("across", r, start_c, end_c)
                    if span_key in checked_spans:
                        continue
                    checked_spans.add(span_key)

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

                    words_for_len = viable_words_by_len.get(span_len, [])
                    for word in words_for_len:
                        if len(word) < min_len or word in found_words:
                            continue
                        if match_word_to_pattern(word, fixed_letters):
                            placed = [
                                {"row": r, "col": start_c + i, "letter": word[i], "value": get_tile_val(word[i])}
                                for i in range(span_len)
                                if i not in fixed_letters
                            ]
                            valid, _, _, _, _ = RuleEngine.validate_move(board_cells, placed, is_first_move=False)
                            if valid:
                                found_words.add(word)
                                if len(found_words) >= max_words:
                                    break
                    if len(found_words) >= max_words:
                        break

            # Test vertical spans passing through (r, c)
            top_limit = r - len(rack_letters)
            bottom_limit = r + len(rack_letters) + 1

            for start_r in range(top_limit, r + 1):
                if len(found_words) >= max_words:
                    break
                for end_r in range(r + 1, bottom_limit + 1):
                    span_len = end_r - start_r
                    if span_len < min_len:
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
                        if len(word) < min_len or word in found_words:
                            continue
                        if match_word_to_pattern(word, fixed_letters):
                            placed = [
                                {"row": start_r + i, "col": c, "letter": word[i], "value": get_tile_val(word[i])}
                                for i in range(span_len)
                                if i not in fixed_letters
                            ]
                            valid, _, _, _, _ = RuleEngine.validate_move(board_cells, placed, is_first_move=False)
                            if valid:
                                found_words.add(word)
                                if len(found_words) >= max_words:
                                    break
                    if len(found_words) >= max_words:
                        break

    # Sort words by length descending, then alphabetically for clean presentation
    sorted_words = sorted(list(found_words), key=lambda w: (-len(w), w))
    return sorted_words[:max_words]
