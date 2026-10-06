import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface CachedRoomData {
  id: string;
  game_pin: string;
  status: string;
  host_name: string;
  player_count: number;
  max_players: number;
  turn_time_limit: 30 | 60 | 90 | 120 | null;
  game_mode: 'HP' | 'TURNS';
  max_turns: number | null;
  starting_hp: number;
  is_debug: boolean;
  created_at: string;
}

let cachedRooms: CachedRoomData[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 4000; // 4-second memory cache to eliminate redundant network egress traffic

function getBackendApiUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL;
  if (envUrl) {
    const trimmed = envUrl.replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  return 'https://crossword-backend.onrender.com/api';
}

export async function GET() {
  const now = Date.now();
  if (cachedRooms && now - lastCacheTime < CACHE_TTL_MS) {
    return NextResponse.json(cachedRooms, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'X-Cache': 'HIT',
      },
    });
  }

  try {
    const backendUrl = getBackendApiUrl();
    const res = await fetch(`${backendUrl}/rooms?_t=${now}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      if (cachedRooms) {
        return NextResponse.json(cachedRooms, { headers: { 'X-Cache': 'STALE' } });
      }
      return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } });
    }

    const data = await res.json();
    if (Array.isArray(data)) {
      cachedRooms = data;
      lastCacheTime = now;
      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'X-Cache': 'MISS',
        },
      });
    }

    return NextResponse.json(cachedRooms || []);
  } catch {
    if (cachedRooms) {
      return NextResponse.json(cachedRooms, { headers: { 'X-Cache': 'FALLBACK' } });
    }
    return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const gamePin = body.game_pin;
    const maxPlayers = Number(body.max_players);
    if (!gamePin || !maxPlayers || isNaN(maxPlayers)) {
      return NextResponse.json({ error: 'Missing or invalid game_pin / max_players' }, { status: 400 });
    }

    // Invalidate local cache on update
    cachedRooms = null;
    lastCacheTime = 0;

    return NextResponse.json({ success: true, max_players: maxPlayers });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
