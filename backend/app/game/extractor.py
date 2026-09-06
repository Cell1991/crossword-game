from typing import Any

class ExtractedWord:
    def __init__(self, word: str, cells: list[tuple[int, int]], letters_with_vals: list[tuple[str, int, bool]]):
        self.word = word
        # cells: list of (row, col) coordinates in order
        self.cells = cells
        # letters_with_vals: list of (letter, value, is_newly_placed)
        self.letters_with_vals = letters_with_vals

    def to_dict(self) -> dict[str, Any]:
        return {
            "word": self.word,
            "cells": self.cells,
            "length": len(self.word)
        }

def extract_all_words(
    board_cells: dict[str, dict[str, Any]], 
    placed_tiles: list[dict[str, Any]]
) -> tuple[bool, str | None, list[ExtractedWord]]:
    """
    Derive all newly formed words (primary line and perpendicular cross-words)
    from the combination of existing board cells and newly placed tiles.
    """
    if not placed_tiles:
        return False, "No tiles were placed", []

    # Build combined temporary grid
    combined: dict[tuple[int, int], dict[str, Any]] = {}
    
    # Existing committed cells
    for k, cell in board_cells.items():
        combined[(cell["row"], cell["col"])] = {
            "letter": cell["letter"].upper(),
            "value": cell["value"],
            "is_new": False
        }

    placed_coords: list[tuple[int, int]] = []
    for pt in placed_tiles:
        coord = (pt["row"], pt["col"])
        if coord in combined and not combined[coord]["is_new"]:
            return False, f"Cell ({pt['row']}, {pt['col']}) is already occupied", []
        combined[coord] = {
            "letter": pt["letter"].upper(),
            "value": pt["value"],
            "is_new": True
        }
        placed_coords.append(coord)

    # Determine orientation
    rows = {r for r, c in placed_coords}
    cols = {c for r, c in placed_coords}

    is_horizontal = False
    is_vertical = False

    if len(rows) == 1 and len(cols) == 1:
        # Single tile placed
        is_horizontal = True  # Check both directions below
    elif len(rows) == 1:
        is_horizontal = True
    elif len(cols) == 1:
        is_vertical = True
    else:
        return False, "All newly placed tiles must be in the same row or column", []

    # Check for empty gaps between placed tiles along the primary line
    if is_horizontal and len(cols) > 1:
        r = next(iter(rows))
        min_c, max_c = min(cols), max(cols)
        for c in range(min_c, max_c + 1):
            if (r, c) not in combined:
                return False, f"There is an empty gap in the placed word at ({r}, {c})", []
    elif is_vertical and len(rows) > 1:
        c = next(iter(cols))
        min_r, max_r = min(rows), max(rows)
        for r in range(min_r, max_r + 1):
            if (r, c) not in combined:
                return False, f"There is an empty gap in the placed word at ({r}, {c})", []

    found_words: list[ExtractedWord] = []
    seen_word_signatures: set[str] = set()

    def get_line_word(start_r: int, start_c: int, dr: int, dc: int) -> ExtractedWord | None:
        # Find start of word
        curr_r, curr_c = start_r, start_c
        while (curr_r - dr, curr_c - dc) in combined:
            curr_r -= dr
            curr_c -= dc

        # Traverse to end
        word_letters: list[str] = []
        word_cells: list[tuple[int, int]] = []
        letters_with_vals: list[tuple[str, int, bool]] = []

        while (curr_r, curr_c) in combined:
            tile = combined[(curr_r, curr_c)]
            word_letters.append(tile["letter"])
            word_cells.append((curr_r, curr_c))
            letters_with_vals.append((tile["letter"], tile["value"], tile["is_new"]))
            curr_r += dr
            curr_c += dc

        if len(word_letters) >= 2:
            sig = f"{word_cells[0]}_{word_cells[-1]}_{''.join(word_letters)}"
            if sig not in seen_word_signatures:
                seen_word_signatures.add(sig)
                return ExtractedWord("".join(word_letters), word_cells, letters_with_vals)
        return None

    if len(placed_coords) == 1:
        # Single tile placed: could form a horizontal word, a vertical word, or both!
        pr, pc = placed_coords[0]
        h_word = get_line_word(pr, pc, 0, 1)
        if h_word:
            found_words.append(h_word)
        v_word = get_line_word(pr, pc, 1, 0)
        if v_word:
            found_words.append(v_word)
    elif is_horizontal:
        # Primary line: horizontal
        pr, pc = placed_coords[0]
        main_word = get_line_word(pr, pc, 0, 1)
        if main_word:
            found_words.append(main_word)
        # Cross words: vertical for each placed tile
        for r, c in placed_coords:
            cross_word = get_line_word(r, c, 1, 0)
            if cross_word:
                found_words.append(cross_word)
    else:
        # Primary line: vertical
        pr, pc = placed_coords[0]
        main_word = get_line_word(pr, pc, 1, 0)
        if main_word:
            found_words.append(main_word)
        # Cross words: horizontal for each placed tile
        for r, c in placed_coords:
            cross_word = get_line_word(r, c, 0, 1)
            if cross_word:
                found_words.append(cross_word)

    return True, None, found_words
