from typing import Any, Optional
from app.core.config import settings

class Board:
    """Logical 63x63 Game Board with sparse cell storage."""

    SIZE = settings.BOARD_SIZE
    CENTER = (settings.CENTER_ROW, settings.CENTER_COL)

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
