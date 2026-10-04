import hashlib
from collections import Counter
from typing import Any

from app.game.board import Board
from app.game.dictionary import dictionary_service
from app.game.tiles import DEFAULT_LETTER_VALUES

ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


class GrimoireCache:
    """
    High-performance in-memory and database-backed cache for Grimoire word calculations.
    Ensures 0ms instant response on cache hits.
    """

    def __init__(self, max_size: int = 500):
        self._cache: dict[str, list[str]] = {}
        self._max_size = max_size

    @staticmethod
    def compute_cache_key(
        game_id: str,
        turn_number: int,
        player_id: str,
        board_cells: dict[str, Any],
        rack_tiles: list[Any],
    ) -> str:
        # Sort rack letters
        rack_chars: list[str] = []
        for t in rack_tiles:
            if isinstance(t, dict):
                c = str(t.get("letter", "")).upper()
            else:
                c = str(t).upper()
            if c:
                rack_chars.append(c)
        rack_sig = "".join(sorted(rack_chars))

        # Board hash
        board_items = sorted(
            (c.get("row", 0), c.get("col", 0), c.get("letter", "").upper())
            for c in board_cells.values()
            if isinstance(c, dict) and "letter" in c
        )
        board_raw = ";".join(f"{r},{col},{ch}" for r, col, ch in board_items)
        board_hash = hashlib.md5(board_raw.encode("utf-8")).hexdigest()[:12]

        return f"{game_id}_{turn_number}_{player_id}_{rack_sig}_{board_hash}"

    def get(self, key: str) -> list[str] | None:
        return self._cache.get(key)

    def set(self, key: str, words: list[str]) -> None:
        if len(self._cache) >= self._max_size:
            keys_to_pop = list(self._cache.keys())[: (self._max_size // 5)]
            for k in keys_to_pop:
                self._cache.pop(k, None)
        self._cache[key] = words

    def clear(self) -> None:
        self._cache.clear()


grimoire_cache = GrimoireCache()


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

    Uses high-performance positional dictionary indexing, precomputed cross-checks,
    and boundary anchor pruning for fast response times, balanced evenly across lengths.
    """
    if not rack_tiles:
        return []

    # Extract rack letters
    rack_letters: list[str] = []
    for t in rack_tiles:
        if isinstance(t, dict):
            letter = str(t.get("letter", "")).upper()
        else:
            letter = str(t).upper()
        if letter:
            rack_letters.append(letter)

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
        # 1. Precompute cross-check valid letter sets for empty adjacent cells (sub-millisecond)
        cross_across: dict[tuple[int, int], set[str]] = {}
        cross_down: dict[tuple[int, int], set[str]] = {}

        # 2. Find active boundary anchors (occupied tiles that have at least 1 adjacent empty space)
        active_anchors: list[tuple[tuple[int, int], str]] = []

        for (r, c), ch in occupied.items():
            has_empty_neighbor = False
            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = r + dr, c + dc
                if 0 <= nr < Board.ROWS and 0 <= nc < Board.COLS and (nr, nc) not in occupied:
                    has_empty_neighbor = True
                    # Precompute perpendicular across constraint (vertical cross word)
                    if (nr, nc) not in cross_across:
                        if (nr - 1, nc) in occupied or (nr + 1, nc) in occupied:
                            top_r = nr
                            while (top_r - 1, nc) in occupied:
                                top_r -= 1
                            bot_r = nr
                            while (bot_r + 1, nc) in occupied:
                                bot_r += 1
                            valid_set: set[str] = set()
                            for letter in ALPHABET:
                                cw = "".join(letter if cur_r == nr else occupied[(cur_r, nc)] for cur_r in range(top_r, bot_r + 1))
                                if dictionary_service.is_valid_word(cw):
                                    valid_set.add(letter)
                            cross_across[(nr, nc)] = valid_set

                    # Precompute perpendicular down constraint (horizontal cross word)
                    if (nr, nc) not in cross_down:
                        if (nr, nc - 1) in occupied or (nr, nc + 1) in occupied:
                            left_c = nc
                            while (nr, left_c - 1) in occupied:
                                left_c -= 1
                            right_c = nc
                            while (nr, right_c + 1) in occupied:
                                right_c += 1
                            valid_set = set()
                            for letter in ALPHABET:
                                cw = "".join(letter if cur_c == nc else occupied[(nr, cur_c)] for cur_c in range(left_c, right_c + 1))
                                if dictionary_service.is_valid_word(cw):
                                    valid_set.add(letter)
                            cross_down[(nr, nc)] = valid_set

            if has_empty_neighbor:
                active_anchors.append(((r, c), ch))

        checked_spans: set[tuple[str, int, int, int]] = set()

        for (r, c), board_char in active_anchors:
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

                        # Quick fixed match
                        mismatch = False
                        for f_pos, f_ch in fixed.items():
                            if word[f_pos] != f_ch:
                                mismatch = True
                                break
                        if mismatch:
                            continue

                        # O(1) Precomputed cross-check validation
                        cross_fail = False
                        for i in range(span_len):
                            if i not in fixed:
                                cell = (r, start_c + i)
                                if cell in cross_across and word[i] not in cross_across[cell]:
                                    cross_fail = True
                                    break
                        if cross_fail:
                            continue

                        if can_form_with_rack(word, fixed):
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

                        mismatch = False
                        for f_pos, f_ch in fixed.items():
                            if word[f_pos] != f_ch:
                                mismatch = True
                                break
                        if mismatch:
                            continue

                        cross_fail = False
                        for i in range(span_len):
                            if i not in fixed:
                                cell = (start_r + i, c)
                                if cell in cross_down and word[i] not in cross_down[cell]:
                                    cross_fail = True
                                    break
                        if cross_fail:
                            continue

                        if can_form_with_rack(word, fixed):
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
