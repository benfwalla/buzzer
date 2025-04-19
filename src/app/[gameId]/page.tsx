'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Pusher, { Channel } from 'pusher-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

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
  const [isBuzzingDisabled, setIsBuzzingDisabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [pusherClient, setPusherClient] = useState<Pusher | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);

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
        setIsBuzzingDisabled(gameState.buzzes && gameState.buzzes.length > 0);
        console.log('Initial game state fetched:', gameState);

      } catch (err: any) {
        console.error('Error fetching game state:', err);
        setError(err.message);
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

    client.connection.bind('error', (err: any) => {
      console.error('Pusher connection error:', err);
       setError((prev) => prev ? `${prev} & Pusher connection failed.` : `Pusher connection failed: ${err.error?.data?.message || 'Error'}`);
    });

    client.connection.bind('connected', () => {
      console.log('Pusher connected successfully!');
      setError((prev) => prev?.includes('Pusher') && !prev?.includes('&') ? null : prev);
    });
    
     client.connection.bind('disconnected', () => {
      console.warn('Pusher disconnected.');
    });

    setPusherClient(client);

    return () => {
      console.log('Disconnecting Pusher client...');
      client.disconnect();
      setPusherClient(null);
    };
  }, []); 

  useEffect(() => {
    if (!pusherClient || !gameId || error) {
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

    newChannel.bind('new-buzz', () => {
      console.log('Pusher received new-buzz');
      setIsBuzzingDisabled(true); 
    });

    newChannel.bind('reset-buzzes', () => {
      console.log('Pusher received reset-buzzes');
      setIsBuzzingDisabled(false); 
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
  }, [pusherClient, gameId, error]); 


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
    if (!isConfigured || !gameId || isBuzzingDisabled || !pusherClient || pusherClient.connection.state !== 'connected') {
      console.warn('Buzz attempt blocked:', { isConfigured, gameId, isBuzzingDisabled, pusherConnected: pusherClient?.connection.state });
      return;
    }

    setIsBuzzingDisabled(true);
    
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
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      console.log('Buzz sent successfully via API');
      // No need to change state here; Pusher 'new-buzz' event confirms and disables for all

    } catch (err: any) {
      console.error('Error sending buzz:', err);
      setError(`Failed to send buzz: ${err.message}`);
      // Keep buzzing disabled, host reset is needed
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
          <CardContent className="flex flex-col space-y-4">
            {error && (
              <p className="text-center text-sm text-red-600 mb-2">{error}</p>
            )}
            <div>
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                maxLength={20} 
              />
            </div>
            <div>
              <Label htmlFor="team">Select Team</Label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger id="team">
                  <SelectValue placeholder="Select your team" />
                </SelectTrigger>
                <SelectContent>
                  {availableTeams.map((team) => (
                    <SelectItem key={team} value={team}>
                      {team}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleJoin} className="w-full" disabled={availableTeams.length === 0}>
              {availableTeams.length > 0 ? 'Join' : 'Waiting for Host...'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          disabled={isBuzzingDisabled || !pusherClient || pusherClient.connection.state !== 'connected'} 
          className={`w-64 h-64 rounded-full text-4xl font-bold shadow-lg transition-all duration-150 ease-in-out ${isBuzzingDisabled ? 'bg-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-95'}`}
        >
          {isBuzzingDisabled ? 'BUZZED' : 'BUZZ!'}
        </Button>
        <Button onClick={() => {setIsConfigured(false); setError(null);}} variant="link" size="sm" className="mt-6 text-muted-foreground">
          Change Name/Team
        </Button>
      </div>
    </div>
  );
}
