import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { kv } from '@/lib/kv'; // Use Vercel KV client

// Define team colors (assuming these are constant)
const TEAM_COLORS = [
  'Red', 'Blue', 'Green', 'Yellow', 
  'Purple', 'Orange', 'Cyan', 'Magenta'
];

// Define the structure for game state stored in KV
interface GameState {
  teams: string[];
  buzzes: { team: string; name: string; time: number }[];
  startTime: number | null;
}

export async function POST(request: Request) {
  try {
    const { numTeams } = await request.json();

    if (!numTeams || typeof numTeams !== 'number' || numTeams < 1 || numTeams > TEAM_COLORS.length) {
      return NextResponse.json({ error: `Invalid number of teams. Must be between 1 and ${TEAM_COLORS.length}.` }, { status: 400 });
    }

    const gameId = nanoid(4); // Generate a short unique ID
    const teams = TEAM_COLORS.slice(0, numTeams);

    const initialGameState: GameState = {
      teams,
      buzzes: [],
      startTime: null,
    };

    // Store the initial game state in Vercel KV
    // Key: `game:${gameId}`
    await kv.set(`game:${gameId}`, initialGameState);
    // Optional: Set an expiration time for the game data (e.g., 24 hours)
    await kv.expire(`game:${gameId}`, 60 * 60 * 24); // 86400 seconds

    console.log(`[API /game/create] Game created: ${gameId} with ${numTeams} teams.`);

    // Return the gameId and teams to the host
    return NextResponse.json({ gameId, teams });

  } catch (error) {
    console.error('[API /game/create] Error creating game:', error);
    return NextResponse.json({ error: 'Failed to create game.' }, { status: 500 });
  }
}
