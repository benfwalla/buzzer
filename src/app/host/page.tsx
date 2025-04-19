'use client';

import { useState, useEffect } from 'react';
import Pusher, { Channel } from 'pusher-js';
import QRCode from 'react-qr-code';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RefreshCw } from 'lucide-react';
import { getTeamColor, getContrastingTextColor } from '@/lib/utils';

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

  // --- Pusher Initialization Effect ---
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
            console.log(`Pusher state changed: ${state}`);
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

  // --- Pusher Channel Subscription Effect ---
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
        // Add the new buzz and sort
        const updatedBuzzes = [...prevBuzzes, data].sort((a, b) => a.time - b.time);
        return updatedBuzzes;
      });
    });

    newChannel.bind('reset-buzzes', () => {
      console.log('Pusher received reset-buzzes');
      setBuzzes([]);
    });

    setChannel(newChannel);

    // Cleanup: Unsubscribe when gameId changes or component unmounts
    return () => {
      if (pusherClient && newChannel) {
        console.log(`Unsubscribing from Pusher channel: ${newChannel.name}`);
        newChannel.unbind_all();
        pusherClient.unsubscribe(newChannel.name);
        setChannel(null);
      }
    };
  }, [gameId, pusherClient, pusherConnectionState]); // Rerun when gameId, client, or connection state changes


  // --- API Call Functions ---
  const handleCreateGame = async () => {
    setError(null); // Clear previous errors
    try {
      const response = await fetch('/api/game/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numTeams }),
      });
      if (!response.ok) {
        throw new Error(`Failed to create game: ${response.statusText}`);
      }
      const { gameId: newGameId, teams: generatedTeams } = await response.json();
      setGameId(newGameId);
      setTeams(generatedTeams);
      setBuzzes([]); // Reset buzzes for the new game
      setGameUrl(`${window.location.origin}/${newGameId}`);
      console.log('Game created:', newGameId, generatedTeams);
    } catch (err) {
      console.error('Error creating game:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };

  const handleResetBuzzes = async () => {
    if (!gameId) return;
    setError(null);
    try {
      const response = await fetch('/api/game/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId }),
      });
      if (!response.ok) {
        throw new Error(`Failed to reset buzzes: ${response.statusText}`);
      }
      // Buzzes state will be cleared via the Pusher 'reset-buzzes' event
      console.log('Reset buzzes request sent.');
    } catch (err) {
      console.error('Error resetting buzzes:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };

  // --- Main Render ---
  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gradient-to-br from-background to-muted/30 p-4">
      {error && (
        <div className="bg-destructive text-destructive-foreground p-3 rounded-md mb-4 w-full max-w-4xl text-center shadow">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* --- Initial Setup Screen --- */}
      {!gameId ? (
        <Card className="w-full max-w-md mt-10 shadow-xl">
          <CardHeader>
            <CardTitle className="text-center text-2xl font-semibold">Setup Jeopardy Buzzer</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col space-y-6">
            <div>
              <Label htmlFor="numTeams" className="text-base">Number of Teams</Label>
              <Select
                value={numTeams.toString()}
                onValueChange={(value) => setNumTeams(parseInt(value, 10))}
              >
                <SelectTrigger id="numTeams" className="mt-1 text-base">
                  <SelectValue placeholder="Select number of teams" />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <SelectItem key={n} value={n.toString()} className="text-base">
                      {n} Teams
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleCreateGame}
              disabled={pusherConnectionState !== 'connected'}
              className="w-full py-3 text-lg cursor-pointer" 
            >
              {pusherConnectionState === 'connected' ? 'Start Game' : (
                <div className="flex items-center justify-center">
                  {pusherConnectionState === 'connecting' ? 'Connecting...' : `Pusher: ${pusherConnectionState}`}
                </div>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* --- Active Game Screen (Two Columns) --- */
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 w-full max-w-7xl mx-auto">

          {/* --- Left Column (Buzz Queue) --- */}
          <div className="lg:w-2/3 order-2 lg:order-1"> 
            <Card className="shadow-xl h-full">
              <CardHeader className="pb-2"> 
                <div className="flex justify-between items-center"> 
                  <CardTitle className="text-2xl">The Buzz Board</CardTitle> 
                  <Button onClick={handleResetBuzzes} variant="ghost" size="icon" className="text-muted-foreground hover:text-primary cursor-pointer border rounded-md"> 
                    <RefreshCw className="h-5 w-5" />
                    <span className="sr-only">Reset Buzzes</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-2 pb-4 px-4">
                {buzzes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-10 text-lg">Waiting for the first buzz...</p>
                ) : (
                  <div className="mt-2 space-y-3 overflow-y-auto max-h-[70vh] pr-3">
                    {buzzes.map((buzz, index) => {
                      const bgColor = getTeamColor(buzz.team);
                      const textColor = getContrastingTextColor(bgColor);
                      const timeDiff = index > 0 ? buzz.time - buzzes[0].time : 0;

                      return (
                        <div 
                          key={`${buzz.name}-${buzz.team}-${buzz.time}`}
                          className={`rounded-lg transition-all duration-150 ease-in-out 
                            ${index === 0
                              ? 'p-4 mb-3 shadow-lg border border-primary/50' // Enhanced first place: softer shadow + border
                              : 'p-3 mb-2 shadow'}` // Regular items
                          }
                          style={{ backgroundColor: bgColor }}
                        >
                          <div className="flex justify-between items-baseline w-full">
                            <span
                              className={`font-semibold ${index === 0 ? 'text-3xl font-bold' : 'text-xl'}`} // Larger first place name
                              style={{ color: textColor }}
                            >
                              {index + 1}. {buzz.name} 
                            </span>
                            <span
                              className={`font-mono ${index === 0 ? 'text-xl font-semibold' : 'text-base'} pl-3`} // Adjusted time font
                              style={{ color: textColor }}
                            >
                              {index === 0 ? `${buzz.time}ms` : `+${timeDiff}ms`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* --- Right Column (Info & Actions) --- */}
          <div className="lg:w-1/3 flex flex-col space-y-4 order-1 lg:order-2"> 
            {/* Game Info Card */} 
            <Card className="shadow-lg"> 
              <CardHeader className="pt-1 flex flex-row items-center justify-between"> 
                <CardTitle className="text-xl">Game Info</CardTitle> 
                <Button onClick={() => { 
                    setError(null);
                    setGameId(null);
                    setGameUrl('');
                    setTeams([]);
                    setBuzzes([]);
                  }} variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive px-2 cursor-pointer border rounded-md"> 
                  End 
                </Button>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-2 p-2"> 
                {/* --- Join Info --- */} 
                <p className="text-sm text-muted-foreground text-center">Join game here:</p> 
                <a href={gameUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all text-center text-sm font-medium">
                  {gameUrl}
                </a>
                <div className="bg-white p-1 rounded-md inline-block shadow mt-1 mb-2"> 
                  <QRCode value={gameUrl} size={96} />
                </div>

                {/* --- Teams Display (Color Circles) --- */} 
                {teams.length > 0 && ( 
                  <div className="flex items-center space-x-2"> 
                    <span className="text-sm font-medium">Teams:</span>
                    <div className="flex space-x-1"> 
                      {teams.map((team) => (
                        <div
                          key={team}
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: getTeamColor(team) }}
                          title={team} // Tooltip for team name
                        />
                      ))}
                    </div>
                  </div>
                )} 

                {/* Removed Teams text list and End Game button */}
                
              </CardContent>
            </Card>

            {/* Action Buttons Removed */}
          </div>

        </div>
      )}
    </div>
  );
}