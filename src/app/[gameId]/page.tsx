'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Pusher, { Channel } from 'pusher-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { getTeamColor } from '@/lib/utils';

interface ApiGameState {
  teams: string[];
  buzzes: { team: string; name: string; time: number }[];
  startTime: number | null;
}

export default function PlayerPage() {
  const params = useParams();
  const gameId = typeof params?.gameId === 'string' ? params.gameId : null;

  const [name, setName] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [availableTeams, setAvailableTeams] = useState<string[]>([]);
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [pusherClient, setPusherClient] = useState<Pusher | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    if (!gameId) {
      setError("Invalid game link.");
      setIsLoading(false);
      return;
    }

    const fetchGameState = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/game/state/${gameId}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Game not found. Please check the link or contact the host.');
          } 
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to load game info (Status: ${response.status})`);
        }
        const gameState: ApiGameState = await response.json();
        setAvailableTeams(gameState.teams || []);
        console.log('Initial game state fetched:', gameState);

      } catch (err: unknown) {
        console.error('Error fetching game state:', err);
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setAvailableTeams([]); 
      } finally {
        setIsLoading(false);
      }
    };

    fetchGameState();
  }, [gameId]);

  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!pusherKey || !pusherCluster) {
      console.error('Pusher environment variables not set!');
      setError((prev) => prev ? `${prev} & Pusher config missing.` : 'Pusher configuration is missing.');
      return;
    }

    const client = new Pusher(pusherKey, {
      cluster: pusherCluster,
    });

    client.connection.bind('connected', () => {
      console.log('Pusher connected successfully!');
      setIsConnected(true);
      setError((prev) => prev?.includes('Pusher') ? null : prev);
    });
    
    client.connection.bind('disconnected', () => {
      console.warn('Pusher disconnected.');
      setIsConnected(false);
    });

    client.connection.bind('error', (err: { error?: { data?: { message?: string } } }) => {
      console.error('Pusher connection error:', err);
      setIsConnected(false);
      setError((prev) => prev ? `${prev} & Pusher connection failed.` : `Pusher connection failed: ${err.error?.data?.message || 'Error'}`);
    });

    client.connection.bind('connecting', () => setIsConnected(false));
    client.connection.bind('failed', () => {
      console.error('Pusher connection failed.');
      setIsConnected(false);
      setError((prev) => prev ? `${prev} & Pusher connection failed.` : 'Pusher connection failed.');
    });
    client.connection.bind('unavailable', () => {
      console.error('Pusher connection unavailable.');
      setIsConnected(false);
      setError((prev) => prev ? `${prev} & Pusher connection unavailable.` : 'Pusher connection unavailable.');
    });

    setPusherClient(client);
    setIsConnected(client.connection.state === 'connected');

    return () => {
      console.log('Disconnecting Pusher client...');
      client.disconnect();
      setPusherClient(null);
      setIsConnected(false);
    };
  }, []);

  useEffect(() => {
    if (!pusherClient || !gameId || error || !isConfigured) {
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
      setError((prev) => prev ? `${prev} & Failed Pusher subscribe.` : `Failed to subscribe to game channel (${status}).`);
    });

    newChannel.bind('new-buzz', (data: { team: string; name: string; time: number }) => {
      console.log('Pusher received new-buzz:', data);
    });

    newChannel.bind('reset-buzzes', () => {
      console.log('Pusher received reset-buzzes');
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
  }, [pusherClient, gameId, error, isConfigured]);

  const handleJoin = () => {
    if (name.trim() && selectedTeam && gameId) {
      if (availableTeams.includes(selectedTeam)) {
        setIsConfigured(true);
        setError(null); 
        console.log(`Player ${name} (${selectedTeam}) configured for game ${gameId}`);
      } else {
         setError('Selected team is not valid for this game.');
      }
    } else {
      if (!name.trim()) setError('Please enter your name.');
      else if (!selectedTeam) setError('Please select your team.');
    }
  };

  const handleBuzz = async () => {
    if (!isConfigured || !gameId || !isConnected) {
      console.warn('Buzz attempt blocked:', { isConfigured, gameId, isConnected });
      return;
    }

    console.log(`Player ${name} buzzing for team ${selectedTeam} in game ${gameId}`);

    try {
      const response = await fetch('/api/game/buzz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gameId, name, team: selectedTeam }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to send buzz (Status: ${response.status})`);
      }

      console.log('Buzz sent successfully via API');
    } catch (err: unknown) {
      console.error('Error sending buzz:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(`Failed to send buzz: ${message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 flex flex-col justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Loading game details...</p>
      </div>
    );
  }

  if (error && !isConfigured) { 
    return (
      <div className="container mx-auto p-4 flex justify-center items-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-destructive-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!isConfigured) {
    return (
      <div className="container mx-auto p-4 flex flex-col justify-center items-center min-h-screen bg-background text-foreground">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-center">Join Game: {gameId}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col space-y-4 mt-4"> 
            {error && (
              <p className="text-center text-sm text-red-600 mb-2">{error}</p>
            )}
            <div>
              <Label htmlFor="name" className="mb-1 block">Your Name</Label> 
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                maxLength={20} 
              />
            </div>
            <div>
              <Label htmlFor="team-select" className="mb-1 block">Select Team</Label> 
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger id="team-select">
                  <SelectValue placeholder="Select your team" />
                </SelectTrigger>
                <SelectContent> 
                  {availableTeams.map((team) => (
                    <SelectItem key={team} value={team}> 
                      <div className="flex items-center"> 
                        <div 
                          className="w-3 h-3 rounded-full inline-block mr-2" 
                          style={{ backgroundColor: getTeamColor(team) }} 
                        />
                        <span>{team}</span> 
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleJoin} className="w-full cursor-pointer" disabled={availableTeams.length === 0}>
              {availableTeams.length > 0 ? 'Join' : 'Waiting for Host...'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  console.log('Rendering PlayerPage button state:', {
    isConnected: isConnected,
    pusherState: pusherClient?.connection?.state,
    selectedTeam: selectedTeam,
    teamColor: getTeamColor(selectedTeam),
  });

  return (
    <div className="container mx-auto p-4 flex flex-col justify-center items-center min-h-screen bg-background text-foreground">
      <div className="flex flex-col items-center space-y-4">
        {pusherClient?.connection.state !== 'connected' && (
          <p className="text-xs text-orange-500">Pusher: {pusherClient?.connection.state ?? 'disconnected'}...</p>
        )}
        {error && error.includes('Pusher') && (
          <p className="text-xs text-red-500">{error}</p>
        )}

        <p className="text-lg">Ready, <span className="font-semibold">{name}</span> ({selectedTeam} Team)?</p>
        <Button
          onClick={handleBuzz}
          disabled={!isConnected}
          className={`w-64 h-64 rounded-full text-4xl font-bold text-white shadow-lg transition-all duration-150 ease-in-out 
                      active:scale-95
                      ${!isConnected ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          style={{
            backgroundColor: !isConnected ? '#6b7280' : getTeamColor(selectedTeam)
          }}
         >
           BUZZ!
         </Button>
        <Button onClick={() => {setIsConfigured(false); setError(null);}} variant="link" size="sm" className="mt-6 text-muted-foreground cursor-pointer">
          Change Name/Team
        </Button>
      </div>
    </div>
  );
}
