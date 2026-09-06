# Dictionary Wordlist Location

To use a custom or extended word dictionary for word validation:
Place your wordlist text file at this exact location:
`backend/data/wordlist.txt`

Format:
- Plain text file
- One word per line (e.g. CAT, DOG, HOUSE, COMPUTER)
- Case-insensitive (will be automatically converted to UPPERCASE)

Performance:
The game engine automatically loads all words into a Python `Set` in RAM during server startup.
Word lookup is **O(1) (instantaneous)**, which is infinitely faster than querying a Database Table on every move.
