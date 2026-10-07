import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getBackendApiUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL;
  if (envUrl) {
    const trimmed = envUrl.replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  return 'https://crossword-backend.onrender.com/api';
}

const definitionMemoryCache = new Map<string, any>();

export async function GET(
  _request: Request,
  props: { params: Promise<{ word: string }> }
) {
  try {
    const { word } = await props.params;
    if (!word) {
      return NextResponse.json({ found: false, word: '', meanings: [] }, { status: 400 });
    }

    const cleanWord = decodeURIComponent(word).trim().toUpperCase();

    // Check memory cache first
    if (definitionMemoryCache.has(cleanWord)) {
      return NextResponse.json(definitionMemoryCache.get(cleanWord), {
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        },
      });
    }

    const backendUrl = getBackendApiUrl();
    const res = await fetch(`${backendUrl}/dictionary/${encodeURIComponent(cleanWord)}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      const fallback = { word: cleanWord, found: false, meanings: [] };
      return NextResponse.json(fallback, { status: 200 });
    }

    const data = await res.json();
    definitionMemoryCache.set(cleanWord, data);

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (err) {
    console.error('Error fetching word definition:', err);
    return NextResponse.json({ found: false, meanings: [] }, { status: 200 });
  }
}
