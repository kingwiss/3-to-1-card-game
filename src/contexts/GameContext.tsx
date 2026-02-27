import React, { createContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { GameState } from '../types';
import { initGame } from '../services/gameService';
import { io, Socket } from 'socket.io-client';

interface GameContextProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  sendAction: (action: any) => void;
  isMultiplayer: boolean;
  setIsMultiplayer: (val: boolean) => void;
  isWaiting: boolean;
  playerIndex: number;
}

export const GameContext = createContext<GameContextProps | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>(initGame());
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [playerIndex, setPlayerIndex] = useState(0);

  useEffect(() => {
    // This is a safeguard against stale state from hot-reloading.
    if (!gameState.round || gameState.players.some(p => p.persistentScore === undefined)) {
      setGameState(initGame());
    }
  }, []);

  useEffect(() => {
    if (isMultiplayer) {
      const newSocket = io();
      setSocket(newSocket);

      newSocket.on('connect', () => {
        newSocket.emit('findMatch');
      });

      newSocket.on('waitingForMatch', () => {
        setIsWaiting(true);
      });

      newSocket.on('matchFound', (data: { roomId: string, playerIndex: number, state: GameState }) => {
        setIsWaiting(false);
        setPlayerIndex(data.playerIndex);
        setGameState(data.state);
      });

      newSocket.on('gameStateUpdate', (newState: GameState) => {
        setGameState(newState);
      });

      newSocket.on('opponentDisconnected', () => {
        alert('Opponent disconnected. Returning to bot mode.');
        setIsMultiplayer(false);
        setGameState(initGame());
        setPlayerIndex(0);
      });

      return () => {
        newSocket.disconnect();
      };
    } else {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setIsWaiting(false);
      setPlayerIndex(0);
      setGameState(initGame());
    }
  }, [isMultiplayer]);

  const sendAction = useCallback((action: any) => {
    if (isMultiplayer && socket) {
      socket.emit('action', action);
    }
  }, [isMultiplayer, socket]);

  return (
    <GameContext.Provider value={{ gameState, setGameState, sendAction, isMultiplayer, setIsMultiplayer, isWaiting, playerIndex }}>
      {children}
    </GameContext.Provider>
  );
};