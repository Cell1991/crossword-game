from fastapi import APIRouter
from app.schemas.dictionary import WordDefinitionOut
from app.services.dictionary_lookup import dictionary_lookup_service

router = APIRouter(prefix="/dictionary", tags=["Dictionary"])


@router.get("/{word}", response_model=WordDefinitionOut)
async def get_word_definition(word: str):
    """Look up English definition for a given word."""
    result = await dictionary_lookup_service.lookup_word(word)
    return WordDefinitionOut(**result)
