import React, { createContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { GameState } from '../types';
import { initGame, drawCard, addDrawnCardToHand, addDrawnCardToTarget, playCard, endTurn, startNextRound } from '../services/gameService';
import Peer, { DataConnection } from 'peerjs';

interface GameContextProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  sendAction: (action: any) => void;
  isMultiplayer: boolean;
  setIsMultiplayer: (val: boolean) => void;
  isWaiting: boolean;
  playerIndex: number;
  startMatchmaking: (isStrategicMode: boolean) => Promise<void>;
  cancelMatchmaking: () => void;
  disconnectMultiplayer: () => void;
  isFirebaseReady: boolean; // Kept for interface compatibility but always true
}

export const GameContext = createContext<GameContextProps | undefined>(undefined);

const LOBBY_PREFIX = 'neural-game-v1-lobby-';
const MAX_LOBBIES = 10;

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>(initGame());
  const [peer, setPeer] = useState<Peer | null>(null);
  const [conn, setConn] = useState<DataConnection | null>(null);
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [isHost, setIsHost] = useState(false);
  const [cancelSearch, setCancelSearch] = useState<(() => void) | null>(null);

  useEffect(() => {
    // This is a safeguard against stale state from hot-reloading.
    if (!gameState.round || gameState.players.some(p => p.persistentScore === undefined)) {
      setGameState(initGame());
    }
  }, []);

  const cleanupPeer = useCallback(() => {
    if (conn) {
      conn.close();
    }
    if (peer) {
      peer.destroy();
    }
    setConn(null);
    setPeer(null);
    setIsHost(false);
  }, [conn, peer]);

  const startMatchmaking = useCallback(async (isStrategicMode: boolean) => {
    setIsMultiplayer(true);
    setIsWaiting(true);
    setPlayerIndex(0); // Default, will update if matched as P2
    
    // Cleanup previous attempts
    cleanupPeer();

    let isCancelled = false;
    const cancel = () => { isCancelled = true; };
    setCancelSearch(() => cancel);

    // Try to find a lobby or create one
    const tryConnectToLobby = async (lobbyIndex: number): Promise<boolean> => {
      if (isCancelled) return true; // Stop searching if cancelled

      const lobbyId = `${LOBBY_PREFIX}${lobbyIndex}`;
      console.log(`Trying to join lobby: ${lobbyId}`);

      return new Promise<boolean>((resolve) => {
        // Create a temporary peer to check connection
        const tempPeer = new Peer();
        
        tempPeer.on('open', () => {
          const connection = tempPeer.connect(lobbyId);
          
          const timeout = setTimeout(() => {
            console.log(`Timeout connecting to ${lobbyId}`);
            connection.close();
            tempPeer.destroy();
            resolve(false);
          }, 2000);

          connection.on('open', () => {
            clearTimeout(timeout);
            console.log(`Connected to ${lobbyId}!`);
            
            // We found a host!
            setPeer(tempPeer);
            setConn(connection);
            setPlayerIndex(1);
            setIsHost(false);
            setIsWaiting(false);

            // Setup listeners
            connection.on('data', (data: any) => {
              if (data.type === 'gameStateUpdate') {
                const newState = data.state;
                // Swap names for local view
                if (newState.players[1].name === "Player 2") {
                     newState.players[1].name = "Player 2 (You)";
                     newState.players[0].name = "Player 1";
                }
                setGameState(newState);
              } else if (data.type === 'LOBBY_FULL') {
                console.log("Lobby full, trying next...");
                connection.close();
                tempPeer.destroy();
                resolve(false);
              }
            });

            connection.on('close', () => {
              alert('Host disconnected.');
              disconnectMultiplayer();
            });

            resolve(true); // Success
          });

          connection.on('error', () => {
            clearTimeout(timeout);
            tempPeer.destroy();
            resolve(false);
          });
        });

        tempPeer.on('error', () => {
          tempPeer.destroy();
          resolve(false);
        });
      });
    };

    const tryCreateLobby = async (lobbyIndex: number): Promise<boolean> => {
      if (isCancelled) return true;

      const lobbyId = `${LOBBY_PREFIX}${lobbyIndex}`;
      console.log(`Trying to host lobby: ${lobbyId}`);

      return new Promise<boolean>((resolve) => {
        const newPeer = new Peer(lobbyId);

        newPeer.on('open', () => {
          console.log(`Hosting lobby ${lobbyId}!`);
          setPeer(newPeer);
          setIsHost(true);
          
          // Initialize game state
          const initialState = initGame(isStrategicMode);
          initialState.players[0].name = "Player 1 (You)";
          initialState.players[1].name = "Player 2";
          initialState.mode = "multiplayer";
          setGameState(initialState);

          newPeer.on('connection', (connection) => {
            if (conn) {
              // Already have a player, reject new ones
              connection.on('open', () => {
                connection.send({ type: 'LOBBY_FULL' });
                setTimeout(() => connection.close(), 500);
              });
              return;
            }

            console.log("Player connected!");
            setConn(connection);
            setIsWaiting(false);

            connection.on('open', () => {
              // Send initial state
              connection.send({ type: 'gameStateUpdate', state: initialState });
            });

            connection.on('data', (data: any) => {
              handleAction(data);
            });

            connection.on('close', () => {
              alert('Opponent disconnected.');
              disconnectMultiplayer();
            });
          });

          resolve(true);
        });

        newPeer.on('error', (err: any) => {
          console.log(`Failed to host ${lobbyId}:`, err.type);
          newPeer.destroy();
          resolve(false);
        });
      });
    };

    // Main matchmaking loop
    // 1. Try to join existing lobbies
    for (let i = 0; i < MAX_LOBBIES; i++) {
      if (await tryConnectToLobby(i)) return;
    }

    // 2. If no lobbies found, try to create one
    for (let i = 0; i < MAX_LOBBIES; i++) {
      if (await tryCreateLobby(i)) return;
    }

    alert("Could not find or create a game lobby. Please try again.");
    setIsWaiting(false);
    setIsMultiplayer(false);

  }, [cleanupPeer]);

  const cancelMatchmaking = useCallback(() => {
    if (cancelSearch) {
      cancelSearch();
      setCancelSearch(null);
    }
    cleanupPeer();
    setIsWaiting(false);
    setIsMultiplayer(false);
  }, [cancelSearch, cleanupPeer]);

  const disconnectMultiplayer = useCallback(() => {
    cleanupPeer();
    setIsWaiting(false);
    setIsMultiplayer(false);
    setGameState(initGame());
  }, [cleanupPeer]);

  // Centralized action handler (runs on Host)
  const handleAction = useCallback((action: any) => {
    setGameState(prevState => {
      let newState = { ...prevState };
      
      try {
        switch (action.type) {
          case "drawCard":
            newState = drawCard(newState);
            break;
          case "addDrawnCardToHand":
            newState = addDrawnCardToHand(newState);
            break;
          case "addDrawnCardToTarget":
            newState = addDrawnCardToTarget(newState);
            break;
          case "playCard":
            newState = playCard(newState, action.cardId);
            break;
          case "endTurn":
            newState = endTurn(newState);
            break;
          case "startNextRound":
            newState = startNextRound(newState);
            break;
          case "restartGame":
            newState = initGame(newState.isStrategicMode);
            newState.players[0].name = "Player 1 (You)";
            newState.players[1].name = "Player 2";
            newState.mode = "multiplayer";
            break;
          case "toggleStrategicMode":
            newState = initGame(action.isStrategicMode);
            newState.players[0].name = "Player 1 (You)";
            newState.players[1].name = "Player 2";
            newState.mode = "multiplayer";
            break;
          case "endGame":
            newState = { ...newState, status: "gameOver" };
            break;
        }
      } catch (e) {
        console.error("Action error", e);
        return prevState;
      }

      // Broadcast new state to peer if we are host
      if (conn && conn.open) {
        conn.send({ type: 'gameStateUpdate', state: newState });
      }

      return newState;
    });
  }, [conn]); // Removed 'peer' dependency to avoid stale closure issues, rely on 'conn' ref if possible or just state

  const sendAction = useCallback((action: any) => {
    if (!isMultiplayer) return;

    if (isHost) {
      handleAction(action);
    } else {
      if (conn && conn.open) {
        conn.send(action);
      }
    }
  }, [isMultiplayer, isHost, conn, handleAction]);

  return (
    <GameContext.Provider value={{ 
      gameState, 
      setGameState, 
      sendAction, 
      isMultiplayer, 
      setIsMultiplayer, 
      isWaiting, 
      playerIndex,
      startMatchmaking,
      cancelMatchmaking,
      disconnectMultiplayer,
      isFirebaseReady: true
    }}>
      {children}
    </GameContext.Provider>
  );
};