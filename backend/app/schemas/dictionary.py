from typing import Optional
from pydantic import BaseModel


class MeaningOut(BaseModel):
    partOfSpeech: str
    definitions: list[str]
    example: Optional[str] = None


class WordDefinitionOut(BaseModel):
    word: str
    phonetic: Optional[str] = None
    found: bool = True
    meanings: list[MeaningOut] = []
