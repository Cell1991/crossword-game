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
        max_passes: int = settings.MAX_CONSECUTIVE_PASSES,
        game_mode: str = "HP",
    ) -> tuple[bool, str | None, str | None]:
        """
        Evaluate if the game has ended.
        Returns: (is_game_over, reason, winner_player_id)
        """
        living_players = [p for p in players if p.get("hp", 100) > 0]
        if len(players) > 1 and len(living_players) <= 1:
            winner = living_players[0].get("id") if living_players else cls.determine_winner(players, game_mode)
            return True, "Game ended: only one player has HP remaining", winner

        # Tile bag is empty AND at least one player has exhausted their rack
        if len(tile_bag) == 0:
            for p in players:
                rack = p.get("rack", [])
                if len(rack) == 0:
                    winner = cls.determine_winner(players, game_mode)
                    return True, f"Game ended: Tile bag exhausted and {p.get('display_name')} played all tiles", winner

        return False, None, None

    @classmethod
    def determine_winner(cls, players: list[dict[str, Any]], game_mode: str = "HP") -> str | None:
        if not players:
            return None

        # Blood modes (HP/FANCY) are a last-one-standing fight: the survivor with the most HP left
        # wins, not whoever racked up the most word score. Score-only modes keep ranking by score.
        use_hp_ranking = game_mode in ("HP", "FANCY")

        def rank(player: dict[str, Any]) -> tuple[bool, bool, int]:
            alive = player.get("hp", 100) > 0
            # A player who left the game forfeits: anyone still playing ranks above them.
            still_playing = alive and player.get("connection_status") != "OFFLINE"
            tiebreaker = player.get("hp", 0) if use_hp_ranking else player.get("score", 0)
            return still_playing, alive, tiebreaker

        return max(players, key=rank).get("id")

    @classmethod
    def get_leaderboard(cls, players: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return sorted(players, key=lambda p: p.get("score", 0), reverse=True)
