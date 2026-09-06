import uuid
import random
from typing import Any

DEFAULT_LETTER_VALUES: dict[str, int] = {
    "A": 1, "B": 3, "C": 3, "D": 2, "E": 1,
    "F": 4, "G": 2, "H": 4, "I": 1, "J": 8,
    "K": 5, "L": 1, "M": 3, "N": 1, "O": 1,
    "P": 3, "Q": 10, "R": 1, "S": 1, "T": 1,
    "U": 1, "V": 4, "W": 4, "X": 8, "Y": 4,
    "Z": 10
}

DEFAULT_LETTER_FREQUENCIES: dict[str, int] = {
    "A": 9, "B": 2, "C": 2, "D": 4, "E": 12,
    "F": 2, "G": 3, "H": 2, "I": 9, "J": 1,
    "K": 1, "L": 4, "M": 2, "N": 6, "O": 8,
    "P": 2, "Q": 1, "R": 6, "S": 4, "T": 6,
    "U": 4, "V": 2, "W": 2, "X": 1, "Y": 2,
    "Z": 1
}

class TileService:
    """Configurable Tile Bag and Rack Service."""

    @staticmethod
    def create_tile_bag(
        frequencies: dict[str, int] = DEFAULT_LETTER_FREQUENCIES,
        values: dict[str, int] = DEFAULT_LETTER_VALUES,
        multiplier: int = 1
    ) -> list[dict[str, Any]]:
        """Generate a shuffled pool of letter tiles."""
        bag: list[dict[str, Any]] = []
        for letter, count in frequencies.items():
            val = values.get(letter, 1)
            for _ in range(count * multiplier):
                bag.append({
                    "id": str(uuid.uuid4())[:8],
                    "letter": letter.upper(),
                    "value": val
                })
        random.shuffle(bag)
        return bag

    @staticmethod
    def draw_tiles(bag: list[dict[str, Any]], count: int) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Draw up to `count` tiles from the bag."""
        actual_count = min(count, len(bag))
        drawn = bag[:actual_count]
        remaining = bag[actual_count:]
        return drawn, remaining
