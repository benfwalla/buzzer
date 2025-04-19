'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import io, { Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

let socket: Socket | null = null;

export default function PlayerPage() {
  const params = useParams();
  const gameId = typeof params?.gameId === 'string' ? params.gameId : null;

  const [name, setName] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [availableTeams, setAvailableTeams] = useState<string[]>([]);
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [buzzedMessage, setBuzzedMessage] = useState<string>('');

  const socketInitializer = useCallback(async () => {
    if (socket || !gameId) return;

    await fetch('/api/socket'); 
    socket = io();

    socket.on('connect', () => {
      console.log(`Player connected for game ${gameId}`);
      socket?.emit('get-game-info', { gameId }, (response: { teams?: string[], error?: string }) => {
          if (response.teams) {
              setAvailableTeams(response.teams);
              setErrorMessage('');
          } else if (response.error) {
              setErrorMessage(response.error);
              console.error('Error fetching game info:', response.error);
              setAvailableTeams([]);
          } else {
              setErrorMessage('Game not found or invalid ID.');
              console.error('Invalid game ID or game does not exist:', gameId);
              setAvailableTeams([]);
          }
      });
    });

    socket.on('game-not-found', () => {
        setErrorMessage('Game not found. Please check the link.');
        setAvailableTeams([]);
    });

    socket.on('disconnect', () => {
      console.log('Player disconnected');
    });

    return () => {
      if (socket) {
        console.log('Disconnecting player socket');
        socket.disconnect();
        socket = null;
      }
    };
  }, [gameId]);

  useEffect(() => {
    socketInitializer();
  }, [socketInitializer]);

  if (!gameId) {
    return (
        <div className="container mx-auto p-4 flex justify-center items-center min-h-screen">
            <p className="text-muted-foreground">Loading game details...</p>
        </div>
    );
  }

  const handleJoin = () => {
    if (name.trim() && selectedTeam && gameId) {
      setIsConfigured(true);
      setBuzzedMessage(''); 
      console.log(`Player ${name} (${selectedTeam}) configured for game ${gameId}`);
    } else {
        if (!name.trim()) alert('Please enter your name.');
        else if (!selectedTeam) alert('Please select your team.');
    }
  };

  const handleBuzz = () => {
    if (socket && isConfigured && gameId) {
      socket.emit('buzz', { gameId, name, team: selectedTeam });
      setBuzzedMessage('Buzzed!');
      setTimeout(() => setBuzzedMessage(''), 1500); 
    }
  };

  if (errorMessage) {
      return (
          <div className="container mx-auto p-4 flex justify-center items-center min-h-screen">
              <Card className="w-full max-w-md">
                  <CardHeader>
                      <CardTitle className="text-center text-destructive">Error</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <p className="text-center text-destructive-foreground">{errorMessage}</p>
                      <p className="text-center text-muted-foreground text-sm mt-2">Please check the game link or contact the host.</p>
                  </CardContent>
              </Card>
          </div>
      );
  }

   if (availableTeams.length === 0 && !errorMessage) {
        return (
            <div className="container mx-auto p-4 flex justify-center items-center min-h-screen">
                <p className="text-muted-foreground">Loading game info...</p>
            </div>
        );
    }

  return (
    <div className="container mx-auto p-4 flex flex-col justify-center items-center min-h-screen bg-background text-foreground">
      {!isConfigured ? (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-center">Join the Game</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col space-y-4">
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
            <Button onClick={handleJoin} className="w-full">Join</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center space-y-4">
          <p className="text-lg">Ready, <span className="font-semibold">{name}</span> ({selectedTeam} Team)?</p>
           <Button
              onClick={handleBuzz}
              className="w-64 h-64 rounded-full text-4xl font-bold shadow-lg transform active:scale-95 transition-transform duration-75 ease-in-out"
           >
            BUZZ!
          </Button>
          {buzzedMessage && <p className="text-green-500 font-semibold animate-pulse">{buzzedMessage}</p>}
          <Button onClick={() => setIsConfigured(false)} variant="link" size="sm" className="mt-6 text-muted-foreground">
            Change Name/Team
          </Button>
        </div>
      )}
    </div>
  );
}
