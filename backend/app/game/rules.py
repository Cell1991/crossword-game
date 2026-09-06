from typing import Any
from app.core.config import settings
from app.game.board import Board
from app.game.extractor import extract_all_words, ExtractedWord
from app.game.dictionary import DictionaryService, dictionary_service as default_dictionary
from app.game.scoring import ScoringService

class RuleEngine:
    """Authoritative validation engine for board moves."""

    @classmethod
    def validate_move(
        cls,
        board_cells: dict[str, dict[str, Any]],
        placed_tiles: list[dict[str, Any]],
        dict_service: DictionaryService = default_dictionary,
        is_first_move: bool = False
    ) -> tuple[bool, str | None, list[ExtractedWord], int, list[dict[str, Any]]]:
        """
        Validates the move against all official rules.
        Returns: (is_valid, error_reason, extracted_words, total_score, score_breakdown)
        """
        if not placed_tiles:
            return False, "No tiles were placed", [], 0, []

        is_board_empty = len(board_cells) == 0 or is_first_move

        # 1. Check coordinates bounds and uniqueness
        placed_coords: list[tuple[int, int]] = []
        seen_coords: set[tuple[int, int]] = set()

        for t in placed_tiles:
            r, c = t.get("row", -1), t.get("col", -1)
            if not Board.is_valid_coord(r, c):
                return False, f"Tile placement ({r}, {c}) is out of board boundaries (0..62)", [], 0, []
            
            coord = (r, c)
            if coord in seen_coords:
                return False, f"Duplicate tile placement at ({r}, {c})", [], 0, []
            seen_coords.add(coord)

            # Check collision with already committed cells
            if Board.key(r, c) in board_cells:
                return False, f"Cell ({r}, {c}) is already occupied by an existing tile", [], 0, []

            placed_coords.append(coord)

        # 2. First move rule
        if is_board_empty:
            if len(placed_coords) < 2:
                return False, "First move must be a word of at least 2 letters", [], 0, []
            
            if settings.FIRST_MOVE_MUST_COVER_CENTER:
                has_center = any(Board.is_center(r, c) for r, c in placed_coords)
                if not has_center:
                    return False, f"First move must cover the center star at ({settings.CENTER_ROW}, {settings.CENTER_COL})", [], 0, []
        else:
            # 3. Subsequent move connectivity check
            # At least one placed tile must touch an existing committed tile,
            # or the placed tiles span across an existing committed tile.
            connected = False

            # Check direct adjacency
            for r, c in placed_coords:
                neighbors = [(r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)]
                for nr, nc in neighbors:
                    if Board.key(nr, nc) in board_cells:
                        connected = True
                        break
                if connected:
                    break

            if not connected:
                # Check spanning across existing tiles along row or column
                rows = {r for r, _ in placed_coords}
                cols = {c for _, c in placed_coords}
                if len(rows) == 1:
                    r = next(iter(rows))
                    min_c, max_c = min(cols), max(cols)
                    for c in range(min_c, max_c + 1):
                        if Board.key(r, c) in board_cells:
                            connected = True
                            break
                elif len(cols) == 1:
                    c = next(iter(cols))
                    min_r, max_r = min(rows), max(rows)
                    for r in range(min_r, max_r + 1):
                        if Board.key(r, c) in board_cells:
                            connected = True
                            break

            if not connected:
                return False, "Placed tiles must connect to at least one existing tile on the board", [], 0, []

        # 4. Extract all words formed
        success, err, words = extract_all_words(board_cells, placed_tiles)
        if not success:
            return False, err, [], 0, []

        if not words:
            return False, "No valid words formed", [], 0, []

        # 5. Dictionary validation for all formed words
        for w in words:
            if not dict_service.is_valid_word(w.word):
                return False, f"Word '{w.word}' is not recognized in the dictionary", [], 0, []

        # 6. Authoritative score calculation
        score, breakdown = ScoringService.calculate_move_score(words, len(placed_tiles))

        return True, None, words, score, breakdown
