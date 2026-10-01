import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NEON_SQL_URL =
  process.env.NEON_SQL_URL ||
  'https://ep-lingering-river-b5qqbz4r-pooler.c-7.us-east-2.aws.neon.tech/sql';

const NEON_CONN_STRING =
  process.env.DATABASE_URL?.replace(/^postgresql\+asyncpg:\/\//, 'postgresql://') ||
  'postgresql://neondb_owner:npg_u1M4njDJWyYc@ep-lingering-river-b5qqbz4r-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';

interface DbRoomRow {
  id: string;
  game_pin: string;
  status: string;
  turn_time_limit: number | null;
  game_mode: string | null;
  max_turns: number | null;
  starting_hp: number | null;
  is_debug: boolean | null;
  created_at: string | null;
  max_players: number | null;
  host_name: string | null;
  player_count: number | null;
}

export async function GET() {
  try {
    // 1. Expire stale waiting rooms & clean up abandoned rooms in background
    const expireSql = `
      UPDATE game_rooms 
      SET status = 'EXPIRED' 
      WHERE status = 'WAITING' 
        AND (created_at IS NULL OR created_at < NOW() - INTERVAL '10 minutes');

      UPDATE game_rooms r
      SET status = 'ABANDONED'
      WHERE r.status = 'WAITING'
        AND NOT EXISTS (
          SELECT 1 FROM game_players gp 
          WHERE gp.game_id = r.id 
            AND gp.connection_status != 'OFFLINE'
        );

      UPDATE game_rooms r
      SET status = 'ABANDONED'
      WHERE r.status = 'PLAYING'
        AND NOT EXISTS (
          SELECT 1 FROM game_players gp 
          WHERE gp.game_id = r.id 
            AND gp.connection_status != 'OFFLINE'
            AND gp.display_name NOT ILIKE '%bot%'
            AND gp.display_name NOT ILIKE '%[ai]%'
        );

      UPDATE game_rooms r
      SET status = 'FINISHED'
      WHERE r.status = 'PLAYING'
        AND (SELECT count(*) FROM game_players gp WHERE gp.game_id = r.id) > 1
        AND (SELECT count(*) FROM game_players gp WHERE gp.game_id = r.id AND gp.connection_status != 'OFFLINE') <= 1;
    `;
    fetch(NEON_SQL_URL, {
      method: 'POST',
      headers: {
        'neon-connection-string': NEON_CONN_STRING,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: expireSql }),
    }).catch(() => {});

    // 2. Fetch active rooms (WAITING with active players, PLAYING with active human players)
    const selectSql = `
      SELECT 
        r.id,
        r.game_pin,
        r.status,
        r.turn_time_limit,
        r.game_mode,
        r.max_turns,
        r.starting_hp,
        r.is_debug,
        r.created_at,
        COALESCE(r.max_players, 4) AS max_players,
        COALESCE(p.display_name, 'Host') AS host_name,
        COALESCE((
          SELECT count(*)::int 
          FROM game_players gp 
          WHERE gp.game_id = r.id AND gp.connection_status != 'OFFLINE'
        ), 1) AS player_count
      FROM game_rooms r
      LEFT JOIN game_players p ON r.host_player_id = p.id
      WHERE (
        (
          r.status = 'WAITING' 
          AND (r.created_at IS NULL OR r.created_at >= NOW() - INTERVAL '10 minutes')
          AND EXISTS (
            SELECT 1 FROM game_players gp 
            WHERE gp.game_id = r.id AND gp.connection_status != 'OFFLINE'
          )
        )
        OR
        (
          r.status = 'PLAYING' 
          AND (r.started_at >= NOW() - INTERVAL '2 hours' OR (r.started_at IS NULL AND r.created_at >= NOW() - INTERVAL '2 hours'))
          AND EXISTS (
            SELECT 1 FROM game_players gp 
            WHERE gp.game_id = r.id 
              AND gp.connection_status != 'OFFLINE'
              AND gp.display_name NOT ILIKE '%bot%'
              AND gp.display_name NOT ILIKE '%[ai]%'
          )
          AND (
            (SELECT count(*) FROM game_players gp WHERE gp.game_id = r.id) = 1
            OR
            (SELECT count(*) FROM game_players gp WHERE gp.game_id = r.id AND gp.connection_status != 'OFFLINE') > 1
          )
        )
      )
      ORDER BY CASE WHEN r.status = 'WAITING' THEN 0 ELSE 1 END, r.created_at DESC
      LIMIT 20
    `;

    let res = await fetch(NEON_SQL_URL, {
      method: 'POST',
      headers: {
        'neon-connection-string': NEON_CONN_STRING,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: selectSql }),
      cache: 'no-store',
    });

    if (!res.ok) {
      // Fallback query without r.max_players in case of schema discrepancy
      const fallbackSql = `
        SELECT 
          r.id,
          r.game_pin,
          r.status,
          r.turn_time_limit,
          r.game_mode,
          r.max_turns,
          r.starting_hp,
          r.is_debug,
          r.created_at,
          4 AS max_players,
          COALESCE(p.display_name, 'Host') AS host_name,
          COALESCE((
            SELECT count(*)::int 
            FROM game_players gp 
            WHERE gp.game_id = r.id AND gp.connection_status != 'OFFLINE'
          ), 1) AS player_count
        FROM game_rooms r
        LEFT JOIN game_players p ON r.host_player_id = p.id
        WHERE (
          (
            r.status = 'WAITING' 
            AND (r.created_at IS NULL OR r.created_at >= NOW() - INTERVAL '10 minutes')
            AND EXISTS (
              SELECT 1 FROM game_players gp 
              WHERE gp.game_id = r.id AND gp.connection_status != 'OFFLINE'
            )
          )
          OR
          (
            r.status = 'PLAYING' 
            AND (r.started_at >= NOW() - INTERVAL '2 hours' OR (r.started_at IS NULL AND r.created_at >= NOW() - INTERVAL '2 hours'))
            AND EXISTS (
              SELECT 1 FROM game_players gp 
              WHERE gp.game_id = r.id 
                AND gp.connection_status != 'OFFLINE'
                AND gp.display_name NOT ILIKE '%bot%'
                AND gp.display_name NOT ILIKE '%[ai]%'
            )
            AND (
              (SELECT count(*) FROM game_players gp WHERE gp.game_id = r.id) = 1
              OR
              (SELECT count(*) FROM game_players gp WHERE gp.game_id = r.id AND gp.connection_status != 'OFFLINE') > 1
            )
          )
        )
        ORDER BY CASE WHEN r.status = 'WAITING' THEN 0 ELSE 1 END, r.created_at DESC
        LIMIT 20
      `;
      res = await fetch(NEON_SQL_URL, {
        method: 'POST',
        headers: {
          'neon-connection-string': NEON_CONN_STRING,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: fallbackSql }),
        cache: 'no-store',
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error('Failed to query rooms from database:', errText);
      return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } });
    }

    const data = await res.json();
    const rows: DbRoomRow[] = data.rows || [];

    const summaries = rows.map((r) => ({
      id: String(r.id),
      game_pin: String(r.game_pin),
      status: String(r.status || 'WAITING'),
      host_name: String(r.host_name || 'Host'),
      player_count: Number(r.player_count || 1),
      max_players:
        r.max_players !== null && r.max_players !== undefined
          ? Number(r.max_players)
          : 4,
      turn_time_limit:
        r.turn_time_limit !== null && r.turn_time_limit !== undefined
          ? (Number(r.turn_time_limit) as 30 | 60 | 90 | 120)
          : null,
      game_mode: (r.game_mode === 'TURNS' ? 'TURNS' : 'HP') as 'HP' | 'TURNS',
      max_turns:
        r.max_turns !== null && r.max_turns !== undefined
          ? Number(r.max_turns)
          : null,
      starting_hp:
        r.starting_hp !== null && r.starting_hp !== undefined
          ? Number(r.starting_hp)
          : 100,
      is_debug: Boolean(r.is_debug),
      created_at: r.created_at
        ? new Date(r.created_at).toISOString()
        : new Date().toISOString(),
    }));

    return NextResponse.json(summaries, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { detail: errorMsg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
