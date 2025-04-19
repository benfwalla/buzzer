import { NextResponse, NextRequest } from 'next/server';
import { kv } from '@/lib/kv';

// Define the structure for game state stored in KV
interface GameState {
  teams: string[];
  buzzes: { team: string; name: string; time: number }[];
  startTime: number | null;
}

export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    const gameId = context.params?.gameId;

    if (!gameId) {
      return NextResponse.json({ error: 'Game ID is required or missing in context.' }, { status: 400 });
    }

    const key = `game:${gameId}`;
    const gameState: GameState | null = await kv.get(key);

    if (!gameState) {
      return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
    }

    console.log(`[API /game/state/${gameId}] State retrieved.`);

    // Return the relevant parts of the game state (e.g., teams, current buzzes)
    // You might not need to send everything, depending on client needs
    return NextResponse.json({ 
        teams: gameState.teams,
        buzzes: gameState.buzzes, // Send current buzzes so client knows if buzzing is disabled
        startTime: gameState.startTime
    });

  } catch (error) {
    console.error(`[API /game/state/[gameId]] Error fetching game state:`, error);
    return NextResponse.json({ error: 'Failed to fetch game state.' }, { status: 500 });
  }
}
