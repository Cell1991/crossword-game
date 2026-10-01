import pytest
from app.services.game_service import GameService
from app.services.move_service import MoveService
from app.schemas.move import PlacedTileInput
from app.database.models import Base, Game, GamePlayer, GameRoom
from app.database.session import AsyncSessionLocal, engine


@pytest.mark.asyncio
async def test_elimination_skips_dead_player_in_turn_order():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db_session:
        # Setup a 3-player game in HP mode (max_turns is None)
        room = GameRoom(
            id="game-elim-test",
            game_pin="999888",
            host_player_id="p1",
            game_mode="HP",
            starting_hp=50,
            max_players=4,
            status="PLAYING",
        )
        game = Game(
            id="game-elim-test",
            status="PLAYING",
            current_player_id="p1",
            turn_number=1,
            starting_hp=50,
            tile_bag=[{"id": f"t{i}", "letter": "A", "value": 1} for i in range(50)],
            board_state={},
        )
        p1 = GamePlayer(
            id="p1", game_id=game.id, display_name="Player 1",
            hp=50, max_hp=50, turn_order=0, connection_status="ONLINE", session_token="tok_p1",
            rack=[{"id": f"r1_{i}", "letter": l, "value": 10} for i, l in enumerate(["C", "A", "T", "S", "D", "O", "G"])],
        )
        p2 = GamePlayer(
            id="p2", game_id=game.id, display_name="Player 2",
            hp=10, max_hp=50, turn_order=1, connection_status="ONLINE", session_token="tok_p2",
            rack=[{"id": f"r2_{i}", "letter": l, "value": 1} for i, l in enumerate(["A", "B", "C", "D", "E", "F", "G"])],
        )
        p3 = GamePlayer(
            id="p3", game_id=game.id, display_name="Player 3",
            hp=50, max_hp=50, turn_order=2, connection_status="ONLINE", session_token="tok_p3",
            rack=[{"id": f"r3_{i}", "letter": l, "value": 1} for i, l in enumerate(["A", "B", "C", "D", "E", "F", "G"])],
        )

        db_session.add_all([room, game, p1, p2, p3])
        await db_session.commit()

        # P1 places 'CAT' on row 9 (center 9, 13) for 30 points damage (letters value 10 each)
        placed = [
            PlacedTileInput(row=9, col=12, letter="C", value=10, tile_id="r1_0"),
            PlacedTileInput(row=9, col=13, letter="A", value=10, tile_id="r1_1"),
            PlacedTileInput(row=9, col=14, letter="T", value=10, tile_id="r1_2"),
        ]

        res, game_ret, player_ret = await MoveService.commit_move(db_session, game.id, "p1", placed)
        await db_session.commit()

        # P2 only had 10 HP. The move dealt 30 damage, so P2 died (HP <= 0)!
        assert p2.hp <= 0, f"Player 2 should be knocked out, had hp {p2.hp}"
        assert p3.hp == 20, f"Player 3 took 30 damage, should have 20 hp, had {p3.hp}"

        # Verify that turn did NOT go to dead P2! It must skip P2 and go directly to P3!
        assert res.next_player_id == "p3", f"Expected turn to skip dead P2 and go to P3, got {res.next_player_id}"
        assert game_ret.current_player_id == "p3", f"Game current player should be P3, got {game_ret.current_player_id}"
        assert not res.game_over, "Game should not be over since P1 and P3 are still alive"


@pytest.mark.asyncio
async def test_elimination_ends_game_when_one_player_remains():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db_session:
        # Setup a 2-player game in HP mode
        room = GameRoom(
            id="game-elim-2p",
            game_pin="999777",
            host_player_id="p1_2p",
            game_mode="HP",
            starting_hp=20,
            max_players=2,
            status="PLAYING",
        )
        game = Game(
            id="game-elim-2p",
            status="PLAYING",
            current_player_id="p1_2p",
            turn_number=1,
            starting_hp=20,
            tile_bag=[{"id": f"t{i}", "letter": "A", "value": 1} for i in range(50)],
            board_state={},
        )
        p1 = GamePlayer(
            id="p1_2p", game_id=game.id, display_name="Winner",
            hp=50, max_hp=50, turn_order=0, connection_status="ONLINE", session_token="tok_p1_2",
            rack=[{"id": f"r1_{i}", "letter": l, "value": 10} for i, l in enumerate(["C", "A", "T", "S", "D", "O", "G"])],
        )
        p2 = GamePlayer(
            id="p2_2p", game_id=game.id, display_name="Loser",
            hp=10, max_hp=20, turn_order=1, connection_status="ONLINE", session_token="tok_p2_2",
            rack=[{"id": f"r2_{i}", "letter": l, "value": 1} for i, l in enumerate(["A", "B", "C", "D", "E", "F", "G"])],
        )

        db_session.add_all([room, game, p1, p2])
        await db_session.commit()

        placed = [
            PlacedTileInput(row=9, col=12, letter="C", value=10, tile_id="r1_0"),
            PlacedTileInput(row=9, col=13, letter="A", value=10, tile_id="r1_1"),
            PlacedTileInput(row=9, col=14, letter="T", value=10, tile_id="r1_2"),
        ]

        res, game_ret, player_ret = await MoveService.commit_move(db_session, game.id, "p1_2p", placed)
        await db_session.commit()

        assert p2.hp <= 0
        assert res.game_over, "Game should be over when opponent HP reaches 0"
        assert res.winner_id == "p1_2p", f"Winner should be p1_2p, got {res.winner_id}"
        assert game_ret.status == "FINISHED"
