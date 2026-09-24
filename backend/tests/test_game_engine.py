from collections import Counter

import pytest
from app.game.board import Board
from app.game.extractor import extract_all_words, ExtractedWord
from app.game.dictionary import DictionaryService
from app.game.scoring import ScoringService
from app.game.rules import RuleEngine
from app.game.game_end import GameEndService
from app.game.tiles import TileService, NotEnoughTilesInBag, DEFAULT_LETTER_FREQUENCIES, DEFAULT_LETTER_VALUES

def test_board_initialization_and_boundaries():
    board = Board()
    assert board.is_board_empty()
    assert Board.is_valid_coord(0, 0)
    assert Board.is_valid_coord(18, 26)
    assert not Board.is_valid_coord(19, 0)
    assert not Board.is_valid_coord(0, 27)
    assert not Board.is_valid_coord(-1, 0)
    assert Board.is_center(9, 13)
    assert not Board.is_center(7, 7)

def test_board_special_cells_match_the_rendered_19x27_grid():
    assert (Board.ROWS, Board.COLS, Board.CENTER) == (19, 27, (9, 13))
    assert Board.TRIPLE_LETTER == frozenset({
        (0, 13), (1, 2), (1, 24), (8, 0),
        (8, 26), (17, 2), (17, 24), (18, 13),
    })
    assert Board.DOUBLE_LETTER == frozenset({
        (3, 9), (3, 17), (5, 13), (6, 4),
        (6, 22), (8, 7), (8, 19), (10, 4),
        (10, 22), (12, 13), (14, 9), (14, 17),
    })
    assert Board.SECRET_POWER == frozenset({
        (3, 4), (3, 22), (5, 7), (5, 19),
        (13, 7), (13, 19), (15, 4), (15, 22),
    })

def test_premium_squares_are_the_classic_layout_spread_over_the_larger_board():
    classic_15x15 = {
        "triple": {(0, 7), (1, 1), (1, 13), (6, 0), (6, 14), (13, 1), (13, 13), (14, 7)},
        "double": {(2, 5), (2, 9), (4, 7), (5, 2), (5, 12), (6, 4), (6, 10), (8, 2), (8, 12), (9, 7), (11, 5), (11, 9)},
        "power": {(2, 2), (2, 12), (4, 4), (4, 10), (10, 4), (10, 10), (12, 2), (12, 12)},
    }

    def spread(cells):
        return frozenset((round(r * (Board.ROWS - 1) / 14), round(c * (Board.COLS - 1) / 14)) for r, c in cells)

    assert Board.TRIPLE_LETTER == spread(classic_15x15["triple"])
    assert Board.DOUBLE_LETTER == spread(classic_15x15["double"])
    assert Board.SECRET_POWER == spread(classic_15x15["power"])
    premium = Board.TRIPLE_LETTER | Board.DOUBLE_LETTER | Board.SECRET_POWER
    assert len(premium) == 8 + 12 + 8 and Board.CENTER not in premium
    assert premium == {(r, Board.COLS - 1 - c) for r, c in premium}

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
        [(0, 13), (0, 14)],
        [("A", 1, True), ("B", 3, True)],
    )
    score, _ = ScoringService.calculate_move_score(
        [triple_word], placed_tiles_count=2, placed_coords={(0, 13), (0, 14)}, apply_bingo=False
    )
    assert score == (1 * 3) + 3

def test_committed_multiplier_cell_retains_letter_multiplier():
    word = ExtractedWord(
        "AB",
        [(6, 4), (6, 5)],
        [("A", 1, False), ("B", 3, True)],
    )
    score, _ = ScoringService.calculate_move_score(
        [word], placed_tiles_count=1, placed_coords={(6, 5)}, apply_bingo=False
    )
    assert score == (1 * 2) + 3

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
    assert "(9, 13)" in err

    # Placing CAT covering center (9, 13)
    valid_placed = [
        {"row": 9, "col": 12, "letter": "C", "value": 3},
        {"row": 9, "col": 13, "letter": "A", "value": 1},
        {"row": 9, "col": 14, "letter": "T", "value": 1},
    ]
    valid, err, words, score, _ = RuleEngine.validate_move(board_cells, valid_placed, custom_dict, is_first_move=True)
    assert valid
    assert err is None
    assert len(words) == 1
    assert words[0].word == "CAT"
    assert score == 5

def test_word_extraction_and_cross_words():
    # Setup existing board with "CAT" at row 6, cols 6..8
    board_cells = {
        "6_6": {"row": 6, "col": 6, "letter": "C", "value": 3},
        "6_7": {"row": 6, "col": 7, "letter": "A", "value": 1},
        "6_8": {"row": 6, "col": 8, "letter": "T", "value": 1},
    }

    # Place 'O' under the 'T' to make "TO" vertically
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

    # Place "DOG" far away
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

    # Covers the center star at (9, 13) but leaves (9, 14) empty
    gapped_placed = [
        {"row": 9, "col": 13, "letter": "C", "value": 3},
        {"row": 9, "col": 15, "letter": "T", "value": 1},
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


def only_words(*words: str) -> DictionaryService:
    """A dictionary holding just these words (the bundled word list is skipped)."""
    return DictionaryService(custom_words=set(words), wordlist_file="missing-wordlist.txt")


def test_en01_tile_bag_matches_the_letter_distribution():
    bag = TileService.create_tile_bag()

    assert len(bag) == 100
    assert Counter(tile["letter"] for tile in bag) == Counter(DEFAULT_LETTER_FREQUENCIES)
    assert all(tile["value"] == DEFAULT_LETTER_VALUES[tile["letter"]] for tile in bag)
    assert Counter(tile["letter"] for tile in bag)["BLANK"] == 2
    assert len({tile["id"] for tile in bag}) == len(bag)


def test_en02_drawing_more_than_the_bag_holds_returns_what_is_left():
    drawn, remaining = TileService.draw_tiles([{"id": "a"}, {"id": "b"}], 7)

    assert (len(drawn), remaining) == (2, [])


@pytest.mark.parametrize("placed, message", [
    ([(7, 7, "A"), (8, 8, "T")], "same row or column"),
    ([(9, 26, "A"), (9, 27, "T")], "out of board"),
    ([(7, 7, "A"), (7, 7, "T")], "Duplicate"),
    ([(7, 8, "A"), (7, 9, "T")], "already occupied"),
], ids=["not-in-a-line", "off-the-board", "same-cell-twice", "occupied-cell"])
def test_en03_malformed_placements_are_rejected(placed, message):
    board_cells = {"7_8": {"row": 7, "col": 8, "letter": "C", "value": 3}}
    tiles = [{"row": row, "col": col, "letter": letter, "value": 1} for row, col, letter in placed]

    valid, err, *_ = RuleEngine.validate_move(board_cells, tiles, only_words("AT"))

    assert not valid
    assert message in err


def test_en04_one_tile_can_form_words_in_both_directions():
    board_cells = {
        "7_6": {"row": 7, "col": 6, "letter": "A", "value": 1},
        "8_7": {"row": 8, "col": 7, "letter": "O", "value": 1},
    }
    placed = [{"row": 7, "col": 7, "letter": "T", "value": 1}]

    valid, err, words, score, _ = RuleEngine.validate_move(board_cells, placed, only_words("AT", "TO"))

    assert valid, err
    assert sorted(w.word for w in words) == ["AT", "TO"]
    assert score == (1 + 1) + (1 + 1)


def test_en05_one_invalid_cross_word_rejects_the_whole_move():
    board_cells = {
        "7_6": {"row": 7, "col": 6, "letter": "A", "value": 1},
        "8_7": {"row": 8, "col": 7, "letter": "O", "value": 1},
    }
    placed = [{"row": 7, "col": 7, "letter": "T", "value": 1}]

    valid, err, *_ = RuleEngine.validate_move(board_cells, placed, only_words("AT"))

    assert not valid
    assert "'TO' is not recognized" in err


def test_en06_all_tiles_bonus_needs_seven_placed_tiles():
    word = ExtractedWord("RETAINS", [(7, col) for col in range(4, 11)], [(letter, 1, True) for letter in "RETAINS"])

    with_bonus, breakdown = ScoringService.calculate_move_score([word], 7, placed_coords=set(word.cells))
    without_bonus, _ = ScoringService.calculate_move_score([word], 6, placed_coords=set(word.cells))

    assert (with_bonus, without_bonus) == (57, 7)
    assert breakdown[-1]["word"] == "ALL_TILES_BONUS"


def test_en07_winner_must_still_be_standing():
    players = [
        {"id": "p1", "display_name": "Alice", "score": 90, "hp": 0, "rack": []},
        {"id": "p2", "display_name": "Bob", "score": 10, "hp": 40, "rack": []},
    ]

    is_over, reason, winner = GameEndService.check_game_over(tile_bag=[{"id": "t"}], players=players, consecutive_passes=0)

    assert (is_over, winner) == (True, "p2")
    assert "only one player" in reason


def test_en08_a_short_bag_is_reported_separately_from_other_exchange_errors():
    rack = [{"id": f"r{i}", "letter": "A", "value": 1} for i in range(8)]
    bag = [{"id": f"b{i}", "letter": "E", "value": 1} for i in range(7)]

    with pytest.raises(NotEnoughTilesInBag):
        TileService.exchange_tiles(rack, bag, [tile["id"] for tile in rack])
