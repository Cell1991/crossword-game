import uuid
import random
from typing import Any

DEFAULT_LETTER_VALUES: dict[str, int] = {
    "A": 1, "B": 3, "C": 3, "D": 2, "E": 1,
    "F": 4, "G": 2, "H": 4, "I": 1, "J": 8,
    "K": 5, "L": 1, "M": 3, "N": 1, "O": 1,
    "P": 3, "Q": 10, "R": 1, "S": 1, "T": 1,
    "U": 1, "V": 4, "W": 4, "X": 8, "Y": 4,
    "Z": 10, "BLANK": 0
}

DEFAULT_LETTER_FREQUENCIES: dict[str, int] = {
    "A": 9, "B": 2, "C": 2, "D": 4, "E": 12,
    "F": 2, "G": 3, "H": 2, "I": 9, "J": 1,
    "K": 1, "L": 4, "M": 2, "N": 6, "O": 8,
    "P": 2, "Q": 1, "R": 6, "S": 4, "T": 6,
    "U": 4, "V": 2, "W": 2, "X": 1, "Y": 2,
    "Z": 1, "BLANK": 2
}

class NotEnoughTilesInBag(ValueError):
    """An exchange asked for more tiles than the bag holds."""


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

    @staticmethod
    def exchange_tiles(
        rack: list[dict[str, Any]],
        bag: list[dict[str, Any]],
        tile_ids: list[str],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """
        Trade the chosen rack tiles for the same number of tiles from the bag.
        Replacements are drawn before the old tiles go back in, so a player can never
        draw back what they just gave up. Each new tile takes the seat of the tile it replaces.
        Returns: (new_rack, new_bag). Raises ValueError when the exchange is not allowed.
        """
        if not tile_ids:
            raise ValueError("Choose at least one tile to exchange")
        if len(set(tile_ids)) != len(tile_ids):
            raise ValueError("Each tile can only be exchanged once")
        rack_ids = {tile["id"] for tile in rack}
        if any(tile_id not in rack_ids for tile_id in tile_ids):
            raise ValueError("You can only exchange tiles from your own rack")
        if len(bag) < len(tile_ids):
            raise NotEnoughTilesInBag(f"Not enough tiles in the bag to exchange {len(tile_ids)} (only {len(bag)} left)")

        drawn, remaining_bag = TileService.draw_tiles(bag, len(tile_ids))
        chosen = set(tile_ids)
        replacements = iter(drawn)
        new_rack = [next(replacements) if tile["id"] in chosen else tile for tile in rack]
        new_bag = remaining_bag + [tile for tile in rack if tile["id"] in chosen]
        random.shuffle(new_bag)
        return new_rack, new_bag
