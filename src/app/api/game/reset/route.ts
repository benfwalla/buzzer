import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv'; // Use Vercel KV client
import { triggerPusherEvent } from '@/lib/pusher'; // Use Pusher server helper

// Define the structure for game state stored in KV
interface GameState {
  teams: string[];
  buzzes: { team: string; name: string; time: number }[];
  startTime: number | null;
}

export async function POST(request: Request) {
  try {
    const { gameId } = await request.json();

    if (!gameId) {
      return NextResponse.json({ error: 'Missing required field: gameId' }, { status: 400 });
    }

    const key = `game:${gameId}`;
    const gameState: GameState | null = await kv.get(key);

    if (!gameState) {
      return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
    }

    // Reset buzzes and start time
    gameState.buzzes = [];
    gameState.startTime = null;

    // Update the game state in KV
    await kv.set(key, gameState);
     // Re-set expiration if needed
    await kv.expire(key, 60 * 60 * 24);

    console.log(`[API /game/reset] Buzzes reset for game ${gameId}.`);

    // Trigger Pusher event to notify clients
    await triggerPusherEvent(gameId, 'reset-buzzes', {}); // Send empty data or just confirmation

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[API /game/reset] Error resetting buzzes:', error);
    return NextResponse.json({ error: 'Failed to reset buzzes.' }, { status: 500 });
  }
}
