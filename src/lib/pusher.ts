import PusherServer from 'pusher';

// Check if required environment variables are set
if (!process.env.PUSHER_APP_ID || 
    !process.env.NEXT_PUBLIC_PUSHER_APP_KEY || // Server often needs the key too
    !process.env.PUSHER_SECRET || 
    !process.env.NEXT_PUBLIC_PUSHER_CLUSTER) {
  throw new Error("Missing required Pusher environment variables");
}

export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true, // Recommended for secure connections
});

/**
 * Triggers a Pusher event on a specific game channel.
 * @param gameId The ID of the game to target.
 * @param eventName The name of the event to trigger.
 * @param data The data payload for the event.
 */
export async function triggerPusherEvent(
  gameId: string,
  eventName: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!gameId || !eventName) {
    console.error('[Pusher Trigger] Error: gameId and eventName are required.');
  } else {
    const channelName = `public-game-${gameId}`;
    try {
      console.log(`[Pusher Server] Triggering event '${eventName}' on channel '${channelName}'`);
      await pusherServer.trigger(channelName, eventName, data);
      console.log(`[Pusher Server] Event '${eventName}' triggered successfully on '${channelName}'.`);
    } catch (error) {
      console.error(`[Pusher Server] Error triggering event '${eventName}' on channel '${channelName}':`, error);
      // Decide if you want to re-throw or handle
    }
  }
};
