from typing import Any
from app.core.config import settings

class GameEndService:
    """Configurable service to evaluate game completion and winners."""

    @classmethod
    def check_game_over(
        cls,
        tile_bag: list[Any],
        players: list[dict[str, Any]],
        consecutive_passes: int,
        max_passes: int = settings.MAX_CONSECUTIVE_PASSES
    ) -> tuple[bool, str | None, str | None]:
        """
        Evaluate if the game has ended.
        Returns: (is_game_over, reason, winner_player_id)
        """
        living_players = [p for p in players if p.get("hp", 100) > 0]
        if len(players) > 1 and len(living_players) <= 1:
            winner = living_players[0].get("id") if living_players else cls.determine_winner(players)
            return True, "Game ended: only one player has HP remaining", winner

        # Rule 1: All players passed consecutively
        if consecutive_passes >= max_passes and len(players) > 0:
            winner = cls.determine_winner(players)
            return True, f"Game ended: {consecutive_passes} consecutive passes by players", winner

        # Rule 2: Tile bag is empty AND at least one player has exhausted their rack
        if len(tile_bag) == 0:
            for p in players:
                rack = p.get("rack", [])
                if len(rack) == 0:
                    winner = cls.determine_winner(players)
                    return True, f"Game ended: Tile bag exhausted and {p.get('display_name')} played all tiles", winner

        return False, None, None

    @classmethod
    def determine_winner(cls, players: list[dict[str, Any]]) -> str | None:
        if not players:
            return None
        sorted_players = sorted(players, key=lambda p: (p.get("hp", 100) > 0, p.get("score", 0)), reverse=True)
        return sorted_players[0].get("id")

    @classmethod
    def get_leaderboard(cls, players: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return sorted(players, key=lambda p: p.get("score", 0), reverse=True)
