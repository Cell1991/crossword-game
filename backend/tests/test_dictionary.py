import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from app.services.dictionary_lookup import dictionary_lookup_service


@pytest.mark.asyncio
async def test_offline_dictionary_lookup():
    result = await dictionary_lookup_service.lookup_word("QI")
    assert result["found"] is True
    assert result["word"] == "QI"
    assert len(result["meanings"]) > 0
    assert result["phonetic"] is not None


@pytest.mark.asyncio
async def test_api_dictionary_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/dictionary/CAT")
        assert response.status_code == 200
        data = response.json()
        assert data["word"] == "CAT"
        assert data["found"] is True
        assert len(data["meanings"]) > 0
        assert "definitions" in data["meanings"][0]
