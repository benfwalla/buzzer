import { Server as HttpServer } from 'http';
import { NextApiRequest, NextApiResponse } from 'next';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { nanoid } from 'nanoid';

type PlayerBuzz = {
  name: string;
  team: string;
  timestamp: number;
};

type GameState = {
  teams: string[];
  buzzes: PlayerBuzz[];
  startTime: number | null;
};

// In-memory store for game states
const games = new Map<string, GameState>();

// Predefined team colors
const TEAM_COLORS = [
  'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Pink', 'Cyan'
];

// Extend NextApiResponse to include the socket server
interface NextApiResponseWithSocket extends NextApiResponse {
  socket: NextApiResponse['socket'] & {
    server: HttpServer & {
      io?: SocketIOServer;
    };
  };
}

const SocketHandler = (req: NextApiRequest, res: NextApiResponseWithSocket) => {
  if (!res.socket.server.io) {
    console.log('*First use, starting Socket.IO');
    const io = new SocketIOServer(res.socket.server);

    io.on('connection', (socket: Socket) => {
      console.log(`Socket connected: ${socket.id}`);

      socket.on('create-game', ({ numTeams }: { numTeams: number }, callback) => {
        try {
          console.log(`[Server] create-game received for socket ${socket.id} with numTeams: ${numTeams}`);
          const gameId = nanoid(6); // Generate a short unique ID
          const teams = TEAM_COLORS.slice(0, numTeams);
          games.set(gameId, { teams, buzzes: [], startTime: null });
          console.log(`[Server] Game created: ${gameId} with teams: ${teams.join(', ')}`);
          
          console.log(`[Server] About to call callback for game ${gameId}...`);
          callback({ gameId, teams }); // Send gameId and teams back to host
          console.log(`[Server] Callback invoked successfully for game ${gameId}.`);
        } catch (error) {
          console.error(`[Server] Error in create-game handler for socket ${socket.id}:`, error);
          // Optionally, inform the client about the error via callback if possible
          if (typeof callback === 'function') {
            callback({ error: 'Failed to create game on server.' });
          }
        }
      });

      socket.on('join-game', ({ gameId, name, team }: { gameId: string; name: string; team: string }) => {
        const game = games.get(gameId);
        if (game) {
          socket.join(gameId);
          console.log(`Player ${name} (${team}) joined game ${gameId}`);
          // Send current game state to the joining player
          socket.emit('game-update', game);
        } else {
          socket.emit('game-not-found');
          console.log(`Game not found: ${gameId} for player ${name}`);
        }
      });

      socket.on('get-game-info', ({ gameId } : { gameId: string }, callback) => {
          const game = games.get(gameId);
          if (game) {
              callback({ teams: game.teams });
          } else {
              callback({ error: 'Game not found' });
          }
      });

      socket.on('buzz', ({ gameId, name, team }: { gameId: string; name: string; team: string }) => {
        const game = games.get(gameId);
        if (game) {
          const now = Date.now();
          if (game.buzzes.length === 0) {
            game.startTime = now; // Set start time on first buzz
          }
          game.buzzes.push({ name, team, timestamp: now });
          // Sort buzzes by timestamp
          game.buzzes.sort((a, b) => a.timestamp - b.timestamp);
          console.log(`Buzz received in ${gameId} from ${name} (${team})`);
          // Broadcast updated game state to everyone in the room
          io.to(gameId).emit('game-update', game);
        } else {
             console.log(`Game not found during buzz: ${gameId}`);
        }
      });

      socket.on('reset-buzzes', ({ gameId }: { gameId: string }) => {
        const game = games.get(gameId);
        if (game) {
          game.buzzes = [];
          game.startTime = null;
          console.log(`Buzzes reset for game ${gameId}`);
          // Broadcast cleared game state
          io.to(gameId).emit('game-update', game);
        }
      });

      socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
        // Optional: Clean up games if needed, but maybe not necessary for a short-lived party game
      });
    });

    res.socket.server.io = io;
  } else {
    console.log('Socket.IO already running');
  }
  res.end();
};

export default SocketHandler;
