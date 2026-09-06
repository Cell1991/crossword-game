import secrets
import random

def generate_game_pin() -> str:
    """Generate a 6-digit numeric game PIN for Kahoot-style joining."""
    return f"{random.randint(100000, 999999)}"

def generate_session_token() -> str:
    """Generate a cryptographically secure player session token."""
    return secrets.token_urlsafe(32)
