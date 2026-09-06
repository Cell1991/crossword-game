import pytest
from app.game.board import Board
from app.game.extractor import extract_all_words, ExtractedWord
from app.game.dictionary import DictionaryService
from app.game.scoring import ScoringService
from app.game.rules import RuleEngine
from app.game.game_end import GameEndService
from app.game.tiles import TileService

def test_board_initialization_and_boundaries():
    board = Board()
    assert board.is_board_empty()
    assert Board.is_valid_coord(0, 0)
    assert Board.is_valid_coord(14, 14)
    assert not Board.is_valid_coord(15, 15)
    assert not Board.is_valid_coord(-1, 0)
    assert Board.is_center(7, 7)
    assert not Board.is_center(6, 7)

def test_board_special_cells_match_the_rendered_15x15_grid():
    assert Board.TRIPLE_LETTER == frozenset({
        (0, 7), (1, 1), (1, 13), (6, 0),
        (6, 14), (13, 1), (13, 13), (14, 7),
    })
    assert Board.DOUBLE_LETTER == frozenset({
        (2, 5), (2, 9), (4, 7), (5, 2),
        (5, 12), (6, 4), (6, 10), (8, 2),
        (8, 12), (9, 7), (11, 5), (11, 9),
    })
    assert Board.SECRET_POWER == frozenset({
        (2, 2), (2, 12), (4, 4), (4, 10),
        (10, 4), (10, 10), (12, 2), (12, 12),
    })
    assert Board.CENTER == (7, 7)

def test_new_tiles_receive_letter_multipliers_only():
    word = ExtractedWord(
        "AB",
        [(6, 4), (6, 5)],
        [("A", 1, True), ("B", 3, True)],
    )
    score, _ = ScoringService.calculate_move_score(
        [word], placed_tiles_count=2, placed_coords={(6, 4), (6, 5)}, apply_bingo=False
    )
    assert score == (1 * 2) + 3

    triple_word = ExtractedWord(
        "AB",
        [(0, 7), (0, 8)],
        [("A", 1, True), ("B", 3, True)],
    )
    score, _ = ScoringService.calculate_move_score(
        [triple_word], placed_tiles_count=2, placed_coords={(0, 7), (0, 8)}, apply_bingo=False
    )
    assert score == (1 * 3) + 3

def test_committed_multiplier_cell_is_not_multiplied_again():
    word = ExtractedWord(
        "AB",
        [(6, 4), (6, 5)],
        [("A", 1, False), ("B", 3, True)],
    )
    score, _ = ScoringService.calculate_move_score(
        [word], placed_tiles_count=1, placed_coords={(6, 5)}, apply_bingo=False
    )
    assert score == 1 + 3

def test_tile_bag_generation():
    bag = TileService.create_tile_bag()
    assert len(bag) > 50
    drawn, remaining = TileService.draw_tiles(bag, 7)
    assert len(drawn) == 7
    assert len(remaining) == len(bag) - 7

def test_dictionary_lookup():
    custom_dict = DictionaryService(custom_words={"CAT", "DOG", "OX"})
    assert custom_dict.is_valid_word("CAT")
    assert custom_dict.is_valid_word("cat")
    assert custom_dict.is_valid_word("DOG")
    assert not custom_dict.is_valid_word("XYZ123")
    assert not custom_dict.is_valid_word("A")  # single letter not valid word

def test_first_move_center_requirement():
    custom_dict = DictionaryService(custom_words={"CAT"})
    board_cells = {}

    # Placing CAT at (0, 0), (0, 1), (0, 2) without center
    invalid_placed = [
        {"row": 0, "col": 0, "letter": "C", "value": 3},
        {"row": 0, "col": 1, "letter": "A", "value": 1},
        {"row": 0, "col": 2, "letter": "T", "value": 1},
    ]
    valid, err, _, _, _ = RuleEngine.validate_move(board_cells, invalid_placed, custom_dict, is_first_move=True)
    assert not valid
    assert "center star" in err
    assert "(7, 7)" in err

    # Placing CAT covering center (7, 7)
    valid_placed = [
        {"row": 7, "col": 6, "letter": "C", "value": 3},
        {"row": 7, "col": 7, "letter": "A", "value": 1},
        {"row": 7, "col": 8, "letter": "T", "value": 1},
    ]
    valid, err, words, score, _ = RuleEngine.validate_move(board_cells, valid_placed, custom_dict, is_first_move=True)
    assert valid
    assert err is None
    assert len(words) == 1
    assert words[0].word == "CAT"
    assert score == 5

def test_word_extraction_and_cross_words():
    # Setup existing board with "CAT" at row 31, cols 30..32
    board_cells = {
        "6_6": {"row": 6, "col": 6, "letter": "C", "value": 3},
        "6_7": {"row": 6, "col": 7, "letter": "A", "value": 1},
        "6_8": {"row": 6, "col": 8, "letter": "T", "value": 1},
    }

    # Now place "AT" vertically intersecting at 'T' (row 31, col 32)
    # So we place 'O' at (32, 32) to make "TO" vertically!
    custom_dict = DictionaryService(custom_words={"CAT", "TO"})
    placed = [
        {"row": 7, "col": 8, "letter": "O", "value": 1}
    ]

    valid, err, words, score, _ = RuleEngine.validate_move(board_cells, placed, custom_dict, is_first_move=False)
    assert valid
    assert len(words) == 1
    assert words[0].word == "TO"
    assert score == 2  # T(1) + O(1)

def test_disconnected_subsequent_move_rejected():
    board_cells = {
        "6_7": {"row": 6, "col": 7, "letter": "A", "value": 1},
        "6_8": {"row": 6, "col": 8, "letter": "T", "value": 1},
    }
    custom_dict = DictionaryService(custom_words={"AT", "DOG"})
    
    # Place "DOG" far away at (10, 10)
    disconnected_placed = [
        {"row": 1, "col": 1, "letter": "D", "value": 2},
        {"row": 1, "col": 2, "letter": "O", "value": 1},
        {"row": 1, "col": 3, "letter": "G", "value": 2},
    ]
    valid, err, _, _, _ = RuleEngine.validate_move(board_cells, disconnected_placed, custom_dict, is_first_move=False)
    assert not valid
    assert "must connect" in err

def test_gap_between_placed_tiles_rejected():
    board_cells = {}
    custom_dict = DictionaryService(custom_words={"CAT"})
    
    # Place with center star at col 31 and gap at col 32
    gapped_placed = [
        {"row": 7, "col": 7, "letter": "C", "value": 3},
        {"row": 7, "col": 9, "letter": "T", "value": 1},
    ]
    valid, err, _, _, _ = RuleEngine.validate_move(board_cells, gapped_placed, custom_dict, is_first_move=True)
    assert not valid
    assert "empty gap" in err


def test_game_end_conditions():
    players = [
        {"id": "p1", "display_name": "Alice", "score": 100, "rack": []},
        {"id": "p2", "display_name": "Bob", "score": 80, "rack": [{"id": "t1", "letter": "A", "value": 1}]}
    ]
    
    # Tile bag empty and p1 has empty rack
    is_over, reason, winner = GameEndService.check_game_over(tile_bag=[], players=players, consecutive_passes=0)
    assert is_over
    assert winner == "p1"
    assert "exhausted" in reason

    # Consecutive passes limit reached
    is_over, reason, winner = GameEndService.check_game_over(tile_bag=[{"id": "t2"}], players=players, consecutive_passes=4, max_passes=4)
    assert is_over
    assert winner == "p1"
    assert "consecutive passes" in reason


def test_csw24_dictionary_loading():
    dict_svc = DictionaryService()
    # Ensure large dictionary loaded (> 100,000 words)
    assert len(dict_svc._words) > 100000
    # Spot-check Scrabble words from CSW24
    assert dict_svc.is_valid_word("AARDVARK")
    assert dict_svc.is_valid_word("ZYZZYVA")
    assert dict_svc.is_valid_word("QI")
    assert dict_svc.is_valid_word("ZA")
    assert not dict_svc.is_valid_word("XYZABC123")

