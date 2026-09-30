from typing import Any
from app.game.extractor import ExtractedWord
from app.game.board import Board

class ScoringService:
    """Configurable scoring engine for moves and words."""

    BINGO_BONUS_TILES = 7
    BINGO_BONUS_POINTS = 50

    @classmethod
    def calculate_move_score(
        cls, 
        words: list[ExtractedWord], 
        placed_tiles_count: int,
        placed_coords: set[tuple[int, int]] | None = None,
        apply_bingo: bool = True
    ) -> tuple[int, list[dict[str, Any]]]:
        """
        Calculate the total move score and return a detailed breakdown.
        Temporary default rules:
          - Score for each word is the sum of letter values.
          - 50-point bonus if all 7 tiles are placed (configurable).
        """
        total_score = 0
        breakdown: list[dict[str, Any]] = []

        for w in words:
            word_base_score = 0
            word_multiplier = 1
            for index, (_, val, _) in enumerate(w.letters_with_vals):
                row, col = w.cells[index]
                letter_multiplier = Board.letter_multiplier_at(row, col)
                word_base_score += val * letter_multiplier
                if placed_coords is None or (row, col) in placed_coords:
                    word_multiplier *= Board.word_multiplier_at(row, col)

            total_word_score = word_base_score * word_multiplier
            breakdown.append({
                "word": w.word,
                "base_score": word_base_score,
                "multiplier": word_multiplier,
                "bonus": 0,
                "total": total_word_score,
                "cells": w.cells
            })
            total_score += total_word_score

        # Check for 7-tile bingo bonus
        if apply_bingo and placed_tiles_count >= cls.BINGO_BONUS_TILES:
            total_score += cls.BINGO_BONUS_POINTS
            breakdown.append({
                "word": "ALL_TILES_BONUS",
                "base_score": 0,
                "bonus": cls.BINGO_BONUS_POINTS,
                "total": cls.BINGO_BONUS_POINTS,
                "cells": []
            })

        return total_score, breakdown
