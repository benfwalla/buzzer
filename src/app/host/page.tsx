'use client';

import { useState, useEffect, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import QRCode from 'react-qr-code';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface PlayerBuzz {
  name: string;
  team: string;
  timestamp: number;
}

interface GameState {
  teams: string[];
  buzzes: PlayerBuzz[];
  startTime: number | null;
}

let socket: Socket | null = null;

export default function HostPage() {
  const [numTeams, setNumTeams] = useState<number>(2);
  const [gameId, setGameId] = useState<string | null>(null);
  const [teams, setTeams] = useState<string[]>([]);
  const [buzzes, setBuzzes] = useState<PlayerBuzz[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [gameUrl, setGameUrl] = useState<string>('');

  const socketInitializer = useCallback(async () => {
    // Ensure only one connection
    if (socket) return;

    await fetch('/api/socket'); // Initialize the backend socket server
    socket = io();

    socket.on('connect', () => {
      console.log('Host connected to socket server');
    });

    socket.on('disconnect', () => {
      console.log('Host disconnected');
      // Optionally handle reconnection or cleanup
    });

    socket.on('game-update', (gameState: GameState) => {
      console.log('Received game update:', gameState);
      setBuzzes(gameState.buzzes);
      setStartTime(gameState.startTime);
      // Update teams only if they haven't been set yet during creation
      if (teams.length === 0) {
          setTeams(gameState.teams);
      }
    });

    // Clean up on component unmount
    return () => {
      if (socket) {
        console.log('Disconnecting host socket');
        socket.disconnect();
        socket = null;
      }
    };
  }, [teams.length]); // Add teams.length dependency

  useEffect(() => {
    socketInitializer();
  }, [socketInitializer]);

  const handleCreateGame = () => {
    if (socket) {
      socket.emit('create-game', { numTeams }, (response: { gameId: string; teams: string[] }) => {
        setGameId(response.gameId);
        setTeams(response.teams);
        setBuzzes([]); // Clear any previous buzzes
        setStartTime(null);
        const url = `${window.location.origin}/${response.gameId}`;
        setGameUrl(url);
        console.log(`Game created with ID: ${response.gameId}, URL: ${url}`);
        // Automatically join the room as host to receive updates
        socket?.emit('join-game', { gameId: response.gameId, name: 'Host', team: 'N/A' });
      });
    }
  };

  const handleResetBuzzes = () => {
    if (socket && gameId) {
      socket.emit('reset-buzzes', { gameId });
    }
  };

  const formatTimeDiff = (timestamp: number): string => {
    if (!startTime || timestamp === startTime) {
      return ''; // No diff for the first buzz
    }
    const diff = timestamp - startTime;
    return `+${(diff / 1000).toFixed(3)}s`;
  };

  return (
    <div className="container mx-auto p-4 flex flex-col items-center min-h-screen bg-background text-foreground">
      {!gameId ? (
        <Card className="w-full max-w-md mt-10">
          <CardHeader>
            <CardTitle className="text-center">Setup Jeopardy Buzzer</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col space-y-4">
            <div>
              <Label htmlFor="numTeams">Number of Teams</Label>
              <Select
                value={numTeams.toString()}
                onValueChange={(value) => setNumTeams(parseInt(value, 10))}
              >
                <SelectTrigger id="numTeams">
                  <SelectValue placeholder="Select number of teams" />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} Teams
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreateGame} className="w-full">Start Game</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="w-full flex flex-col items-center space-y-6">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle className="text-center">Game Active!</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <p className="text-sm text-muted-foreground">Share this link or QR code with players:</p>
              <a href={gameUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
                {gameUrl}
              </a>
              <div style={{ background: 'white', padding: '8px', display: 'inline-block' }}>
                <QRCode value={gameUrl} size={128} />
              </div>
              <p className="text-sm font-medium">Teams: {teams.join(', ')}</p>
            </CardContent>
          </Card>

          <Card className="w-full max-w-lg">
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle>Buzz Queue</CardTitle>
              <Button onClick={handleResetBuzzes} variant="destructive" size="sm">Reset Buzzes</Button>
            </CardHeader>
            <CardContent>
              {buzzes.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Waiting for buzzes...</p>
              ) : (
                <ul className="space-y-3">
                  {buzzes.map((buzz, index) => (
                    <li key={`${buzz.name}-${buzz.timestamp}-${index}`} className={`p-3 rounded-md ${index === 0 ? 'bg-primary text-primary-foreground shadow-lg' : 'bg-secondary text-secondary-foreground'}`}>
                      <div className="flex justify-between items-center">
                        <span className={`font-semibold ${index === 0 ? 'text-xl' : ''}`}>
                          {index + 1}. {buzz.name} ({buzz.team})
                        </span>
                        {index > 0 && startTime && (
                          <span className="text-xs font-mono text-muted-foreground pl-2">
                             {formatTimeDiff(buzz.timestamp)}
                           </span>
                        )}
                      </div>
                     {index === 0 && <Separator className="my-2 bg-primary-foreground/50" />} {/* Separator only under the winner */}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

           <Button onClick={() => { setGameId(null); setGameUrl(''); setTeams([]); setBuzzes([]); /* Optionally disconnect/reconnect logic if needed */ }} variant="outline">
             End Game & Setup New One
           </Button>
        </div>
      )}
    </div>
  );
}
