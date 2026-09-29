from typing import Any, Optional
from app.core.config import settings

def _generate_echoes(base_cells: frozenset[tuple[int, int]], max_ring: int = 16) -> frozenset[tuple[int, int]]:
    echoes: set[tuple[int, int]] = set()
    center_r, center_c = settings.CENTER_ROW, settings.CENTER_COL
    def round_from_center(v: float) -> int:
        return (1 if v > 0 else -1 if v < 0 else 0) * int(round(abs(v)))

    for r, c in base_cells:
        for ring in range(1, max_ring + 1):
            scale = 1.0 + ring * 0.25
            echo_r = center_r + round_from_center((r - center_r) * scale)
            echo_c = center_c + round_from_center((c - center_c) * scale)
            if echo_r < 0 or echo_r >= settings.BOARD_ROWS or echo_c < 0 or echo_c >= settings.BOARD_COLS:
                echoes.add((echo_r, echo_c))
    return frozenset(echoes)

class Board:
    """Logical game board with sparse cell storage and infinite expansion."""

    ROWS = settings.BOARD_ROWS
    COLS = settings.BOARD_COLS
    CENTER = (settings.CENTER_ROW, settings.CENTER_COL)

    # Base premium squares (starter 19x27 board)
    TRIPLE_LETTER = frozenset({
        (0, 13), (1, 2), (1, 24), (8, 0),
        (8, 26), (10, 0), (10, 26),
        (17, 2), (17, 24), (18, 13),
        (9, 10), (9, 16),
    })
    DOUBLE_LETTER = frozenset({
        (3, 9), (3, 17), (15, 9), (15, 17),
        (5, 13), (13, 13),
        (6, 4), (6, 22), (12, 4), (12, 22),
        (8, 7), (8, 19), (10, 7), (10, 19),
        (8, 12), (8, 14), (10, 12), (10, 14),
    })
    SECRET_POWER = frozenset({
        (3, 4), (3, 22),
        (5, 7), (5, 19),
        (7, 10), (7, 16),
        (11, 10), (11, 16),
        (13, 7), (13, 19),
        (15, 4), (15, 22),
    })

    # Extended echoes for infinite expansion
    ALL_TRIPLE_LETTER = TRIPLE_LETTER | _generate_echoes(TRIPLE_LETTER)
    ALL_DOUBLE_LETTER = DOUBLE_LETTER | _generate_echoes(DOUBLE_LETTER)
    ALL_SECRET_POWER = SECRET_POWER | _generate_echoes(SECRET_POWER)

    def __init__(self, sparse_state: Optional[dict[str, Any]] = None):
        self.cells: dict[str, dict[str, Any]] = sparse_state.copy() if sparse_state else {}

    @staticmethod
    def key(row: int, col: int) -> str:
        return f"{row}_{col}"

    @classmethod
    def is_valid_coord(cls, row: int, col: int) -> bool:
        return isinstance(row, int) and isinstance(col, int)

    @classmethod
    def is_center(cls, row: int, col: int) -> bool:
        return row == cls.CENTER[0] and col == cls.CENTER[1]

    @classmethod
    def multiplier_at(cls, row: int, col: int) -> int:
        if (row, col) in cls.ALL_TRIPLE_LETTER:
            return 3
        if (row, col) in cls.ALL_DOUBLE_LETTER:
            return 2
        return 1

    @classmethod
    def is_power_cell(cls, row: int, col: int) -> bool:
        return (row, col) in cls.ALL_SECRET_POWER

    def is_empty(self, row: int, col: int) -> bool:
        return self.key(row, col) not in self.cells

    def get_cell(self, row: int, col: int) -> Optional[dict[str, Any]]:
        return self.cells.get(self.key(row, col))

    def set_cell(self, row: int, col: int, cell_data: dict[str, Any]) -> None:
        self.cells[self.key(row, col)] = cell_data

    def is_board_empty(self) -> bool:
        return len(self.cells) == 0

    def get_sparse_state(self) -> dict[str, Any]:
        return self.cells
