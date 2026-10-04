import hashlib
from collections import Counter
from typing import Any

from app.game.board import Board
from app.game.dictionary import dictionary_service
from app.game.rules import RuleEngine
from app.game.tiles import DEFAULT_LETTER_VALUES

ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


class HintCache:
    """
    High-performance in-memory state cache for Hint calculations.
    Ensures 0ms instant response on cache hits.
    """

    def __init__(self, max_size: int = 300):
        self._cache: dict[str, list[dict[str, Any]]] = {}
        self._max_size = max_size

    @staticmethod
    def compute_cache_key(
        game_id: str,
        turn_number: int,
        player_id: str,
        board_cells: dict[str, Any],
        rack_tiles: list[Any],
        max_suggestions: int = 3,
    ) -> str:
        rack_chars: list[str] = []
        for t in rack_tiles:
            if isinstance(t, dict):
                c = str(t.get("letter", "")).upper()
            else:
                c = str(t).upper()
            if c:
                rack_chars.append(c)
        rack_sig = "".join(sorted(rack_chars))

        board_items = sorted(
            (c.get("row", 0), c.get("col", 0), c.get("letter", "").upper())
            for c in board_cells.values()
            if isinstance(c, dict) and "letter" in c
        )
        board_raw = ";".join(f"{r},{col},{ch}" for r, col, ch in board_items)
        board_hash = hashlib.md5(board_raw.encode("utf-8")).hexdigest()[:12]

        return f"hint_{game_id}_{turn_number}_{player_id}_{rack_sig}_{board_hash}_{max_suggestions}"

    def get(self, key: str) -> list[dict[str, Any]] | None:
        return self._cache.get(key)

    def set(self, key: str, suggestions: list[dict[str, Any]]) -> None:
        if len(self._cache) >= self._max_size:
            keys_to_pop = list(self._cache.keys())[: (self._max_size // 5)]
            for k in keys_to_pop:
                self._cache.pop(k, None)
        self._cache[key] = suggestions

    def clear(self) -> None:
        self._cache.clear()


hint_cache = HintCache()


def find_hint_suggestions(
    board_cells: dict[str, dict[str, Any]],
    rack_tiles: list[dict[str, Any] | str],
    is_first_move: bool = False,
    max_suggestions: int = 3,
) -> list[dict[str, Any]]:
    """
    Finds the top scoring valid word placements that can be made on the board
    using the player's current rack tiles.

    Uses positional indexing, precomputed cross-check bitmasking, and boundary anchor pruning.
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
    search_cap = max(35, max_suggestions * 4)

    # Normalize board cells ensuring value is present
    normalized_board: dict[str, dict[str, Any]] = {}
    for k, v in board_cells.items():
        ch = str(v.get("letter", "")).upper()
        normalized_board[k] = {
            "row": v["row"],
            "col": v["col"],
            "letter": ch,
            "value": v.get("value", DEFAULT_LETTER_VALUES.get(ch, 1)),
        }

    occupied: dict[tuple[int, int], str] = {
        (c["row"], c["col"]): c["letter"]
        for c in normalized_board.values()
    } if not is_board_empty else {}

    def get_tile_val(letter: str) -> int:
        return rack_val_map.get(letter, DEFAULT_LETTER_VALUES.get(letter, 1))

    # Helper: Check if a word can be formed with rack given a pattern of fixed board letters
    def match_word_to_pattern(word: str, fixed: dict[int, str]) -> bool:
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
            if len(candidates) >= search_cap:
                break
            words_for_len = dictionary_service.get_words_of_length(w_len)
            for word in words_for_len:
                if len(candidates) >= search_cap:
                    break
                if not match_word_to_pattern(word, {}):
                    continue

                # Try placing across covering center
                for offset in range(w_len):
                    start_c = center_c - offset
                    placed = [
                        {"row": center_r, "col": start_c + i, "letter": word[i], "value": get_tile_val(word[i])}
                        for i in range(w_len)
                    ]
                    valid, _, _, score, _ = RuleEngine.validate_move(normalized_board, placed, is_first_move=True)
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
                    placed = [
                        {"row": start_r + i, "col": center_c, "letter": word[i], "value": get_tile_val(word[i])}
                        for i in range(w_len)
                    ]
                    valid, _, _, score, _ = RuleEngine.validate_move(normalized_board, placed, is_first_move=True)
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
        # Precompute cross-check valid letter sets for adjacent boundary cells (sub-millisecond)
        cross_across: dict[tuple[int, int], set[str]] = {}
        cross_down: dict[tuple[int, int], set[str]] = {}
        active_anchors: list[tuple[tuple[int, int], str]] = []

        for (r, c), ch in occupied.items():
            has_empty_neighbor = False
            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = r + dr, c + dc
                if 0 <= nr < Board.ROWS and 0 <= nc < Board.COLS and (nr, nc) not in occupied:
                    has_empty_neighbor = True
                    if (nr, nc) not in cross_across:
                        if (nr - 1, nc) in occupied or (nr + 1, nc) in occupied:
                            top_r = nr
                            while (top_r - 1, nc) in occupied:
                                top_r -= 1
                            bot_r = nr
                            while (bot_r + 1, nc) in occupied:
                                bot_r += 1
                            v_set: set[str] = set()
                            for letter in ALPHABET:
                                cw = "".join(letter if cur == nr else occupied[(cur, nc)] for cur in range(top_r, bot_r + 1))
                                if dictionary_service.is_valid_word(cw):
                                    v_set.add(letter)
                            cross_across[(nr, nc)] = v_set

                    if (nr, nc) not in cross_down:
                        if (nr, nc - 1) in occupied or (nr, nc + 1) in occupied:
                            left_c = nc
                            while (nr, left_c - 1) in occupied:
                                left_c -= 1
                            right_c = nc
                            while (nr, right_c + 1) in occupied:
                                right_c += 1
                            v_set = set()
                            for letter in ALPHABET:
                                cw = "".join(letter if cur == nc else occupied[(nr, cur)] for cur in range(left_c, right_c + 1))
                                if dictionary_service.is_valid_word(cw):
                                    v_set.add(letter)
                            cross_down[(nr, nc)] = v_set

            if has_empty_neighbor:
                active_anchors.append(((r, c), ch))

        checked_spans: set[tuple[str, int, int, int]] = set()

        for (r, c), board_char in active_anchors:
            if len(candidates) >= search_cap:
                break

            # 1. Test horizontal spans covering (r, c)
            left_limit = max(0, c - len(rack_letters))
            right_limit = min(Board.COLS, c + len(rack_letters) + 1)

            for start_c in range(left_limit, c + 1):
                if len(candidates) >= search_cap:
                    break
                for end_c in range(c + 1, right_limit + 1):
                    span_len = end_c - start_c
                    if span_len < 2:
                        continue

                    # Word boundary checks
                    if (r, start_c - 1) in occupied or (r, end_c) in occupied:
                        continue

                    span_key = ("across", r, start_c, end_c)
                    if span_key in checked_spans:
                        continue
                    checked_spans.add(span_key)

                    fixed_letters = {cur_c - start_c: occupied[(r, cur_c)] for cur_c in range(start_c, end_c) if (r, cur_c) in occupied}
                    num_rack_needed = span_len - len(fixed_letters)
                    if not fixed_letters or num_rack_needed == 0 or num_rack_needed > len(rack_letters):
                        continue

                    anchor_pos = c - start_c
                    words_for_anchor = dictionary_service.get_words_with_char_at(span_len, anchor_pos, board_char)
                    if not words_for_anchor:
                        continue

                    for word in words_for_anchor:
                        mismatch = False
                        for f_pos, f_ch in fixed_letters.items():
                            if word[f_pos] != f_ch:
                                mismatch = True
                                break
                        if mismatch:
                            continue

                        # O(1) Cross-check rejection
                        cross_fail = False
                        for i in range(span_len):
                            if i not in fixed_letters:
                                cell = (r, start_c + i)
                                if cell in cross_across and word[i] not in cross_across[cell]:
                                    cross_fail = True
                                    break
                        if cross_fail:
                            continue

                        if match_word_to_pattern(word, fixed_letters):
                            placed = [
                                {"row": r, "col": start_c + i, "letter": word[i], "value": get_tile_val(word[i])}
                                for i in range(span_len)
                                if i not in fixed_letters
                            ]
                            valid, _, _, score, _ = RuleEngine.validate_move(normalized_board, placed, is_first_move=False)
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

            # 2. Test vertical spans covering (r, c)
            top_limit = max(0, r - len(rack_letters))
            bottom_limit = min(Board.ROWS, r + len(rack_letters) + 1)

            for start_r in range(top_limit, r + 1):
                if len(candidates) >= search_cap:
                    break
                for end_r in range(r + 1, bottom_limit + 1):
                    span_len = end_r - start_r
                    if span_len < 2 or span_len > 15:
                        continue

                    if (start_r - 1, c) in occupied or (end_r, c) in occupied:
                        continue

                    span_key = ("down", c, start_r, end_r)
                    if span_key in checked_spans:
                        continue
                    checked_spans.add(span_key)

                    fixed_letters = {cur_r - start_r: occupied[(cur_r, c)] for cur_r in range(start_r, end_r) if (cur_r, c) in occupied}
                    num_rack_needed = span_len - len(fixed_letters)
                    if not fixed_letters or num_rack_needed == 0 or num_rack_needed > len(rack_letters):
                        continue

                    anchor_pos = r - start_r
                    words_for_anchor = dictionary_service.get_words_with_char_at(span_len, anchor_pos, board_char)
                    if not words_for_anchor:
                        continue

                    for word in words_for_anchor:
                        mismatch = False
                        for f_pos, f_ch in fixed_letters.items():
                            if word[f_pos] != f_ch:
                                mismatch = True
                                break
                        if mismatch:
                            continue

                        cross_fail = False
                        for i in range(span_len):
                            if i not in fixed_letters:
                                cell = (start_r + i, c)
                                if cell in cross_down and word[i] not in cross_down[cell]:
                                    cross_fail = True
                                    break
                        if cross_fail:
                            continue

                        if match_word_to_pattern(word, fixed_letters):
                            placed = [
                                {"row": start_r + i, "col": c, "letter": word[i], "value": get_tile_val(word[i])}
                                for i in range(span_len)
                                if i not in fixed_letters
                            ]
                            valid, _, _, score, _ = RuleEngine.validate_move(normalized_board, placed, is_first_move=False)
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
