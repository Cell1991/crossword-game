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
    max_words: int = 100,
    min_len: int = 3,
) -> list[str]:
    """
    Finds up to `max_words` (default 100) valid playable words (length >= `min_len`, default 3)
    that can be played onto the current board using the player's current rack tiles.

    Uses high-performance positional dictionary indexing and fast cross-checking
    for sub-50ms response times, balanced evenly across available word lengths.
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

    # Fast rack-matching helper
    def can_form_with_rack(word: str, fixed: dict[int, str]) -> bool:
        for pos, ch in fixed.items():
            if word[pos] != ch:
                return False
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

    # Fast perpendicular cross-word validators (O(1) set lookups)
    def is_valid_cross_across(r: int, c: int, ch: str) -> bool:
        if (r - 1, c) not in occupied and (r + 1, c) not in occupied:
            return True
        top_r = r
        while (top_r - 1, c) in occupied:
            top_r -= 1
        bot_r = r
        while (bot_r + 1, c) in occupied:
            bot_r += 1
        cross_word = "".join(ch if cur_r == r else occupied[(cur_r, c)] for cur_r in range(top_r, bot_r + 1))
        return len(cross_word) < 2 or dictionary_service.is_valid_word(cross_word)

    def is_valid_cross_down(r: int, c: int, ch: str) -> bool:
        if (r, c - 1) not in occupied and (r, c + 1) not in occupied:
            return True
        left_c = c
        while (r, left_c - 1) in occupied:
            left_c -= 1
        right_c = c
        while (r, right_c + 1) in occupied:
            right_c += 1
        cross_word = "".join(ch if cur_c == c else occupied[(r, cur_c)] for cur_c in range(left_c, right_c + 1))
        return len(cross_word) < 2 or dictionary_service.is_valid_word(cross_word)

    # Candidate collection grouped by length
    candidates_by_len: dict[int, list[str]] = {}
    found_words_set: set[str] = set()
    MAX_CANDIDATES_PER_LEN = max(25, (max_words // 3) + 5)
    MAX_TOTAL_SEARCH = max_words * 4

    def add_candidate(word: str) -> None:
        if word in found_words_set:
            return
        w_len = len(word)
        found_words_set.add(word)
        if w_len not in candidates_by_len:
            candidates_by_len[w_len] = []
        candidates_by_len[w_len].append(word)

    # ==========================================
    # Case 1: First Move (Empty Board)
    # ==========================================
    if is_board_empty:
        rack_len = len(rack_letters)
        for w_len in range(max(min_len, 2), rack_len + 1):
            if len(found_words_set) >= MAX_TOTAL_SEARCH:
                break
            words_for_len = dictionary_service.get_words_of_length(w_len)
            for word in words_for_len:
                if len(word) < min_len or word in found_words_set:
                    continue
                if len(candidates_by_len.get(w_len, [])) >= MAX_CANDIDATES_PER_LEN:
                    break
                if can_form_with_rack(word, {}):
                    add_candidate(word)

    # ==========================================
    # Case 2: Active Board (Subsequent Moves)
    # ==========================================
    else:
        checked_spans: set[tuple[str, int, int, int]] = set()

        for (r, c), board_char in occupied.items():
            if len(found_words_set) >= MAX_TOTAL_SEARCH:
                break

            # 1. Test horizontal spans covering (r, c)
            left_limit = max(0, c - len(rack_letters))
            right_limit = min(Board.COLS, c + len(rack_letters) + 1)

            for start_c in range(left_limit, c + 1):
                if len(found_words_set) >= MAX_TOTAL_SEARCH:
                    break
                for end_c in range(c + 1, right_limit + 1):
                    span_len = end_c - start_c
                    if span_len < min_len:
                        continue
                    if len(candidates_by_len.get(span_len, [])) >= MAX_CANDIDATES_PER_LEN:
                        continue

                    # Word boundary checks
                    if (r, start_c - 1) in occupied or (r, end_c) in occupied:
                        continue

                    span_key = ("across", r, start_c, end_c)
                    if span_key in checked_spans:
                        continue
                    checked_spans.add(span_key)

                    fixed = {cur_c - start_c: occupied[(r, cur_c)] for cur_c in range(start_c, end_c) if (r, cur_c) in occupied}
                    num_rack_needed = span_len - len(fixed)
                    if not fixed or num_rack_needed == 0 or num_rack_needed > len(rack_letters):
                        continue

                    # Select smallest candidate pool using positional indexing
                    best_pos, best_char = min(
                        fixed.items(),
                        key=lambda item: len(dictionary_service.get_words_with_char_at(span_len, item[0], item[1]))
                    )
                    word_candidates = dictionary_service.get_words_with_char_at(span_len, best_pos, best_char)

                    for word in word_candidates:
                        if len(word) < min_len or word in found_words_set:
                            continue
                        if len(candidates_by_len.get(span_len, [])) >= MAX_CANDIDATES_PER_LEN:
                            break
                        if can_form_with_rack(word, fixed):
                            # Fast cross-word validation for each newly placed tile
                            valid_cross = True
                            for i in range(span_len):
                                if i not in fixed:
                                    if not is_valid_cross_across(r, start_c + i, word[i]):
                                        valid_cross = False
                                        break
                            if valid_cross:
                                add_candidate(word)

            # 2. Test vertical spans covering (r, c)
            top_limit = max(0, r - len(rack_letters))
            bottom_limit = min(Board.ROWS, r + len(rack_letters) + 1)

            for start_r in range(top_limit, r + 1):
                if len(found_words_set) >= MAX_TOTAL_SEARCH:
                    break
                for end_r in range(r + 1, bottom_limit + 1):
                    span_len = end_r - start_r
                    if span_len < min_len:
                        continue
                    if len(candidates_by_len.get(span_len, [])) >= MAX_CANDIDATES_PER_LEN:
                        continue

                    # Word boundary checks
                    if (start_r - 1, c) in occupied or (end_r, c) in occupied:
                        continue

                    span_key = ("down", c, start_r, end_r)
                    if span_key in checked_spans:
                        continue
                    checked_spans.add(span_key)

                    fixed = {cur_r - start_r: occupied[(cur_r, c)] for cur_r in range(start_r, end_r) if (cur_r, c) in occupied}
                    num_rack_needed = span_len - len(fixed)
                    if not fixed or num_rack_needed == 0 or num_rack_needed > len(rack_letters):
                        continue

                    # Select smallest candidate pool using positional indexing
                    best_pos, best_char = min(
                        fixed.items(),
                        key=lambda item: len(dictionary_service.get_words_with_char_at(span_len, item[0], item[1]))
                    )
                    word_candidates = dictionary_service.get_words_with_char_at(span_len, best_pos, best_char)

                    for word in word_candidates:
                        if len(word) < min_len or word in found_words_set:
                            continue
                        if len(candidates_by_len.get(span_len, [])) >= MAX_CANDIDATES_PER_LEN:
                            break
                        if can_form_with_rack(word, fixed):
                            # Fast cross-word validation for each newly placed tile
                            valid_cross = True
                            for i in range(span_len):
                                if i not in fixed:
                                    if not is_valid_cross_down(start_r + i, c, word[i]):
                                        valid_cross = False
                                        break
                            if valid_cross:
                                add_candidate(word)

    # ==========================================
    # Balanced Round-Robin Selection across Lengths
    # ==========================================
    available_lens = sorted(candidates_by_len.keys())
    if not available_lens:
        return []

    selected_words: list[str] = []
    selected_set: set[str] = set()
    pools = {l: list(candidates_by_len[l]) for l in available_lens}

    while len(selected_words) < max_words:
        added_in_round = False
        for l in available_lens:
            if len(selected_words) >= max_words:
                break
            if pools[l]:
                w = pools[l].pop(0)
                if w not in selected_set:
                    selected_set.add(w)
                    selected_words.append(w)
                    added_in_round = True
        if not added_in_round:
            break

    # Sort final words by length ascending, then alphabetically
    return sorted(selected_words, key=lambda w: (len(w), w))[:max_words]


