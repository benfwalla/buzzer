import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv'; // Use Vercel KV client
import { triggerPusherEvent } from '@/lib/pusher'; // Use Pusher server helper

// Define the structure for game state stored in KV
interface GameState {
  teams: string[];
  buzzes: { team: string; name: string; time: number }[];
  startTime: number | null;
}

// Define the structure for a single buzz
interface Buzz {
  team: string;
  name: string;
  time: number;
}

export async function POST(request: Request) {
  try {
    const { gameId, name, team } = await request.json();

    if (!gameId || !name || !team) {
      return NextResponse.json({ error: 'Missing required fields: gameId, name, team' }, { status: 400 });
    }

    const key = `game:${gameId}`;
    const gameState: GameState | null = await kv.get(key);

    if (!gameState) {
      return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
    }

    const buzzTime = Date.now();
    let startTime = gameState.startTime;

    // If this is the first buzz, set the startTime
    if (startTime === null) {
      startTime = buzzTime;
      gameState.startTime = startTime;
    }

    // Calculate time relative to the start
    const relativeTime = buzzTime - startTime;

    const newBuzz: Buzz = {
      team,
      name,
      time: relativeTime,
    };

    // Add the new buzz
    gameState.buzzes.push(newBuzz);
    // Sort buzzes by time (optional but good for display)
    gameState.buzzes.sort((a, b) => a.time - b.time);

    // Update the game state in KV
    // Use pipeline for atomic update if necessary, but simple set is often fine here
    await kv.set(key, gameState);
     // Re-set expiration if needed (kv.set should preserve it, but explicit is safer)
    await kv.expire(key, 60 * 60 * 24); 

    console.log(`[API /game/buzz] Buzz received for game ${gameId} from ${name} (${team}) at ${relativeTime}ms.`);

    // Trigger Pusher event to notify clients
    // Send only the new buzz data to avoid sending large state repeatedly
    await triggerPusherEvent(gameId, 'new-buzz', { ...newBuzz }); // Use object spreading

    return NextResponse.json({ success: true, buzz: newBuzz });

  } catch (error) {
    console.error('[API /game/buzz] Error processing buzz:', error);
    return NextResponse.json({ error: 'Failed to process buzz.' }, { status: 500 });
  }
}
