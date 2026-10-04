from typing import Any, Optional
from app.core.config import settings

def mirror_row(r: int) -> int:
    period = 2 * (settings.BOARD_ROWS - 1)  # 2 * 18 = 36
    m = r % period
    return period - m if m > settings.BOARD_ROWS - 1 else m

def mirror_col(c: int) -> int:
    period = 2 * (settings.BOARD_COLS - 1)  # 2 * 26 = 52
    m = c % period
    return period - m if m > settings.BOARD_COLS - 1 else m

class Board:
    """Logical game board with sparse cell storage and infinite mirror expansion."""

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
        (0, 4), (0, 22),
        (1, 7), (1, 19),
        (2, 13),
        (3, 4), (3, 22),
        (5, 7), (5, 19),
        (6, 1), (6, 25),
        (7, 10), (7, 16),
        (9, 4), (9, 22),
        (11, 10), (11, 16),
        (12, 1), (12, 25),
        (13, 7), (13, 19),
        (15, 4), (15, 22),
        (16, 13),
        (17, 7), (17, 19),
        (18, 4), (18, 22),
    })


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
        mr, mc = mirror_row(row), mirror_col(col)
        if (mr, mc) in cls.TRIPLE_LETTER:
            return 3
        if (mr, mc) in cls.DOUBLE_LETTER:
            return 2
        return 1

    @classmethod
    def is_power_cell(cls, row: int, col: int) -> bool:
        mr, mc = mirror_row(row), mirror_col(col)
        return (mr, mc) in cls.SECRET_POWER

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
