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

// Helper function to trigger events
// We'll use public channels for simplicity for now
export const triggerPusherEvent = async (gameId: string, event: string, data: any) => {
  const channelName = `public-game-${gameId}`;
  try {
    console.log(`[Pusher Server] Triggering event '${event}' on channel '${channelName}'`);
    await pusherServer.trigger(channelName, event, data);
    console.log(`[Pusher Server] Event '${event}' triggered successfully on '${channelName}'.`);
  } catch (error) {
    console.error(`[Pusher Server] Error triggering event '${event}' on channel '${channelName}':`, error);
    // Decide if you want to re-throw or handle
  }
};
