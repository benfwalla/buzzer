import { NextResponse, NextRequest } from 'next/server'; 
import { kv } from '@/lib/kv'; 

interface GameState {
  teams: string[];
  buzzes: { team: string; name: string; time: number }[];
  startTime: number | null;
}

export async function GET(
  request: NextRequest, 
  context: { params: { gameId: string } } 
) {
  try {
    const gameId = context.params.gameId;

    if (!gameId) {
      return NextResponse.json({ error: 'Game ID is required' }, { status: 400 });
    }

    const key = `game:${gameId}`;
    console.log(`[API /game/state] Fetching state for key: ${key}`);
    const gameState: GameState | null = await kv.get(key);

    if (!gameState) {
      console.log(`[API /game/state] Game not found for key: ${key}`);
      return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
    }

    console.log(`[API /game/state] Game state found for key: ${key}`);
    return NextResponse.json(gameState);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[API /game/state/[gameId]] Error fetching game state:`, message);
    return NextResponse.json({ error: 'Failed to fetch game state', details: message }, { status: 500 });
  }
}
