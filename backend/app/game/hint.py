import random
from typing import Any

from app.game.board import Board
from app.game.rules import RuleEngine


def find_hint_candidates(
    board_cells: dict[str, dict[str, Any]],
    rack_letters: list[str],
    is_first_move: bool,
    max_attempts: int = 300,
) -> list[tuple[int, int]]:
    """
    Randomized search for board cells that admit at least one valid placement
    from the given rack. Returns the distinct anchor coordinates found.

    # ponytail: heuristic randomized search, not an exhaustive Scrabble move
    # generator (none exists in this codebase, see app/game/rules.py) — may
    # occasionally miss a valid spot or return [] when one exists. Upgrade to
    # a trie/GADDAG-based generator if the HINT card ever needs to be exhaustive.
    """
    if not rack_letters:
        return []

    is_board_empty = len(board_cells) == 0 or is_first_move
    if is_board_empty:
        anchors = [(Board.CENTER[0], Board.CENTER[1])]
    else:
        occupied = {(cell["row"], cell["col"]) for cell in board_cells.values()}
        anchor_set: set[tuple[int, int]] = set()
        for r, c in occupied:
            for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
                if Board.is_valid_coord(nr, nc) and (nr, nc) not in occupied:
                    anchor_set.add((nr, nc))
        anchors = list(anchor_set)

    random.shuffle(anchors)
    found: set[tuple[int, int]] = set()
    attempts = 0

    for anchor_r, anchor_c in anchors:
        for dr, dc in ((0, 1), (1, 0)):
            max_len = 0
            while True:
                r, c = anchor_r + dr * max_len, anchor_c + dc * max_len
                if not Board.is_valid_coord(r, c) or Board.key(r, c) in board_cells:
                    break
                max_len += 1
            max_len = min(max_len, len(rack_letters))
            if max_len == 0:
                continue

            # Spend the full attempt budget here rather than a fixed handful per anchor/direction:
            # an empty board has only one anchor (center) and two directions, so a small fixed
            # count left most of max_attempts unused and made HINT fail on racks that plainly
            # contained a valid word.
            for _ in range(max_attempts):
                if attempts >= max_attempts:
                    return sorted(found)
                attempts += 1
                length = random.randint(1, max_len)
                letters = random.sample(rack_letters, length)
                placed = [
                    {"row": anchor_r + dr * i, "col": anchor_c + dc * i, "letter": letters[i], "value": 0}
                    for i in range(length)
                ]
                valid, _, _, _, _ = RuleEngine.validate_move(
                    board_cells=board_cells, placed_tiles=placed, is_first_move=is_first_move
                )
                if valid:
                    found.add((anchor_r, anchor_c))
                    break

    return sorted(found)
