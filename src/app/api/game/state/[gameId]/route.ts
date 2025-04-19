import { NextResponse, NextRequest } from 'next/server'; 

export async function GET(
  request: NextRequest, 
  context: { params: { gameId: string } } 
) {
  try {
    const gameId = context.params.gameId;
    console.log(`[API /game/state/${gameId}] Minimal handler called.`);
    return NextResponse.json({ message: 'Minimal response', gameId: gameId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[API /game/state/[gameId]] Minimal handler error:`, message);
    return NextResponse.json({ error: 'Minimal handler failed', details: message }, { status: 500 });
  }
}
