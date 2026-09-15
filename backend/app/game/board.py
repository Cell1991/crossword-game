from typing import Any, Optional
from app.core.config import settings

class Board:
    """Logical game board (19 rows x 27 columns) with sparse cell storage."""

    ROWS = settings.BOARD_ROWS
    COLS = settings.BOARD_COLS
    CENTER = (settings.CENTER_ROW, settings.CENTER_COL)
    # Premium squares: the classic 15x15 layout spread proportionally over the larger board.
    # Keep in sync with frontend/lib/board.ts.
    TRIPLE_LETTER = frozenset({
        (0, 13), (1, 2), (1, 24), (8, 0),
        (8, 26), (17, 2), (17, 24), (18, 13),
    })
    DOUBLE_LETTER = frozenset({
        (3, 9), (3, 17), (5, 13), (6, 4),
        (6, 22), (8, 7), (8, 19), (10, 4),
        (10, 22), (12, 13), (14, 9), (14, 17),
    })
    SECRET_POWER = frozenset({
        (3, 4), (3, 22), (5, 7), (5, 19),
        (13, 7), (13, 19), (15, 4), (15, 22),
    })

    def __init__(self, sparse_state: Optional[dict[str, Any]] = None):
        # sparse_state format: {"row_col": {"row": r, "col": c, "letter": "A", "value": 1, ...}}
        self.cells: dict[str, dict[str, Any]] = sparse_state.copy() if sparse_state else {}

    @staticmethod
    def key(row: int, col: int) -> str:
        return f"{row}_{col}"

    @classmethod
    def is_valid_coord(cls, row: int, col: int) -> bool:
        return 0 <= row < cls.ROWS and 0 <= col < cls.COLS

    @classmethod
    def is_center(cls, row: int, col: int) -> bool:
        return row == cls.CENTER[0] and col == cls.CENTER[1]

    @classmethod
    def multiplier_at(cls, row: int, col: int) -> int:
        if (row, col) in cls.TRIPLE_LETTER:
            return 3
        if (row, col) in cls.DOUBLE_LETTER:
            return 2
        return 1

    def is_empty(self, row: int, col: int) -> bool:
        return self.key(row, col) not in self.cells

    def get_cell(self, row: int, col: int) -> Optional[dict[str, Any]]:
        return self.cells.get(self.key(row, col))

    def set_cell(self, row: int, col: int, cell_data: dict[str, Any]) -> None:
        if not self.is_valid_coord(row, col):
            raise ValueError(f"Coordinates ({row}, {col}) out of bounds")
        self.cells[self.key(row, col)] = cell_data

    def is_board_empty(self) -> bool:
        return len(self.cells) == 0

    def get_sparse_state(self) -> dict[str, Any]:
        return self.cells
