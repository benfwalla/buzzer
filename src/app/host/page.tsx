'use client';

import { useState, useEffect } from 'react';
import Pusher, { Channel } from 'pusher-js'; 
import QRCode from 'react-qr-code';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface PlayerBuzz {
  name: string;
  team: string;
  time: number;
}

export default function HostPage() {
  const [numTeams, setNumTeams] = useState<number>(2);
  const [gameId, setGameId] = useState<string | null>(null);
  const [teams, setTeams] = useState<string[]>([]);
  const [buzzes, setBuzzes] = useState<PlayerBuzz[]>([]);
  const [gameUrl, setGameUrl] = useState<string>('');
  const [pusherClient, setPusherClient] = useState<Pusher | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null); 
  const [error, setError] = useState<string | null>(null);
  const [pusherConnectionState, setPusherConnectionState] = useState<string>('initializing');

  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!pusherKey || !pusherCluster) {
      console.error('Pusher environment variables not set!');
      setError('Pusher configuration is missing. Real-time updates will not work.');
      return;
    }

    console.log('Initializing Pusher client...');
    const client = new Pusher(pusherKey, { 
      cluster: pusherCluster,
    });

    const states: string[] = ['connecting', 'connected', 'disconnected', 'failed', 'unavailable'];
    
    states.forEach(state => {
        client.connection.bind(state, () => {
            setPusherConnectionState(state);
            
            if (state === 'connected') {
                setError((prev) => prev?.includes('Pusher') ? null : prev);
            } else if (state === 'failed' || state === 'unavailable') {
                console.error(`Pusher connection failed/unavailable. State: ${state}`);
                setError((prev) => prev ? `${prev} & Pusher connection failed.` : 'Pusher connection failed.');
            }
        });
    });

    setPusherConnectionState(client.connection.state);

    setPusherClient(client);

    return () => {
      console.log('Disconnecting Pusher client...');
      client.disconnect();
      setPusherClient(null);
    };
  }, []);

  useEffect(() => {
    if (pusherConnectionState !== 'connected' || !gameId || !pusherClient) { 
       if (channel) {
         console.log(`Unsubscribing from Pusher channel: ${channel.name}`);
         channel.unbind_all(); 
         pusherClient?.unsubscribe(channel.name); 
         setChannel(null);
       }
       return;
    }

    const channelName = `public-game-${gameId}`;
    console.log(`Subscribing to Pusher channel: ${channelName}`);
    const newChannel = pusherClient.subscribe(channelName);

    newChannel.bind('pusher:subscription_succeeded', () => {
      console.log(`Successfully subscribed to ${channelName}`);
    });

    newChannel.bind('pusher:subscription_error', (status: number) => {
      console.error(`Failed to subscribe to ${channelName}, status: ${status}`);
      setError(`Failed to subscribe to game channel (${status}). Real-time updates may not work.`);
    });

    newChannel.bind('new-buzz', (data: PlayerBuzz) => {
      console.log('Pusher received new-buzz:', data);
      setBuzzes((prevBuzzes) => {
        const updatedBuzzes = [...prevBuzzes, data].sort((a, b) => a.time - b.time);
        return updatedBuzzes;
      });
    });

    newChannel.bind('reset-buzzes', () => {
      console.log('Pusher received reset-buzzes');
      setBuzzes([]);
    });

    setChannel(newChannel);

    return () => {
      if (pusherClient && newChannel) {
        console.log(`Unsubscribing from Pusher channel: ${newChannel.name}`);
        newChannel.unbind_all();
        pusherClient.unsubscribe(newChannel.name);
        setChannel(null);
      }
    };
  }, [pusherClient, gameId, pusherConnectionState, channel]);

  const handleCreateGame = async () => {
    console.log('handleCreateGame called with numTeams:', numTeams);
    setError(null);
    try {
      const response = await fetch('/api/game/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ numTeams }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const { gameId: newGameId, teams: newTeams } = await response.json();
      console.log('Game created successfully via API:', { newGameId, newTeams });

      setGameId(newGameId);
      setTeams(newTeams);
      setBuzzes([]);
      const url = `${window.location.origin}/${newGameId}`;
      setGameUrl(url);
      console.log(`Game setup complete. URL: ${url}`);

    } catch (err: unknown) {
      console.error('Error creating game:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(`Failed to create game: ${message}`);
      setGameId(null);
    }
  };

  const handleResetBuzzes = async () => {
    if (!gameId) return;
    console.log(`handleResetBuzzes called for game: ${gameId}`);
    setError(null);
    try {
      const response = await fetch('/api/game/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gameId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      console.log('Buzzes reset successfully via API');

    } catch (err: unknown) {
      console.error('Error resetting buzzes:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(`Failed to reset buzzes: ${message}`);
    }
  };

  const formatTimeDiff = (relativeTimeMs: number): string => {
    if (relativeTimeMs <= 10) {
      return '';
    }
    return `+${(relativeTimeMs / 1000).toFixed(3)}s`;
  };

  return (
    <div className="container mx-auto p-4 flex flex-col items-center min-h-screen bg-background text-foreground">
      {error && (
        <div className="w-full max-w-lg p-4 mb-4 text-center text-red-700 bg-red-100 border border-red-400 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}
      
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
            <Button
              onClick={handleCreateGame}
              className="w-full"
              disabled={pusherConnectionState !== 'connected'}
            >
              {pusherConnectionState === 'connected' ? 'Start Game' : 
               pusherConnectionState === 'connecting' ? 'Connecting...' : 
               `Pusher: ${pusherConnectionState}`}
            </Button>
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
                    <li key={`${buzz.name}-${buzz.team}-${buzz.time}-${index}`} className={`p-3 rounded-md ${index === 0 ? 'bg-primary text-primary-foreground shadow-lg' : 'bg-secondary text-secondary-foreground'}`}>
                      <div className="flex justify-between items-center">
                        <span className={`font-semibold ${index === 0 ? 'text-xl' : ''}`}>
                          {index + 1}. {buzz.name} ({buzz.team})
                        </span>
                        {index > 0 && (
                          <span className="text-xs font-mono text-muted-foreground pl-2">
                             {formatTimeDiff(buzz.time)}
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

           <Button onClick={() => { 
             setError(null);
             setGameId(null); 
             setGameUrl(''); 
             setTeams([]); 
             setBuzzes([]); 
            }} variant="outline">
             End Game & Setup New One
           </Button>
        </div>
      )}
    </div>
  );
}
