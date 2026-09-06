from typing import Any, Optional
from app.core.config import settings

class Board:
    """Logical 15x15 game board with sparse cell storage."""

    SIZE = settings.BOARD_SIZE
    CENTER = (settings.CENTER_ROW, settings.CENTER_COL)
    TRIPLE_LETTER = frozenset({
        (0, 7), (1, 1), (1, 13), (7, 0),
        (7, 14), (13, 1), (13, 13), (14, 7),
    })
    DOUBLE_LETTER = frozenset({
        (2, 5), (2, 9), (4, 7), (5, 2),
        (5, 12), (7, 4), (7, 10), (9, 2),
        (9, 12), (10, 7), (12, 5), (12, 9),
    })
    SECRET_POWER = frozenset({
        (2, 2), (2, 12), (4, 4), (4, 10),
        (10, 4), (10, 10), (12, 2), (12, 12),
    })

    def __init__(self, sparse_state: Optional[dict[str, Any]] = None):
        # sparse_state format: {"row_col": {"row": r, "col": c, "letter": "A", "value": 1, ...}}
        self.cells: dict[str, dict[str, Any]] = sparse_state.copy() if sparse_state else {}

    @staticmethod
    def key(row: int, col: int) -> str:
        return f"{row}_{col}"

    @classmethod
    def is_valid_coord(cls, row: int, col: int) -> bool:
        return 0 <= row < cls.SIZE and 0 <= col < cls.SIZE

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
