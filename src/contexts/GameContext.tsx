import React, { createContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { GameState } from '../types';
import { initGame, drawCard, addDrawnCardToHand, addDrawnCardToTarget, playCard, endTurn, startNextRound } from '../services/gameService';
import type { Peer, DataConnection } from 'peerjs';

interface GameContextProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  sendAction: (action: any) => void;
  isPvP: boolean;
  setIsPvP: (val: boolean) => void;
  isWaiting: boolean;
  matchmakingStatus: string;
  playerIndex: number;
  startMatchmaking: (isStrategicMode: boolean) => Promise<void>;
  cancelMatchmaking: () => void;
  disconnectPvP: () => void;
}

export const GameContext = createContext<GameContextProps | undefined>(undefined);

const LOBBY_PREFIX = 'neural-game-v1-lobby-';
const MAX_LOBBIES = 10;

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>(initGame());
  const [peer, setPeer] = useState<Peer | null>(null);
  const [conn, setConn] = useState<DataConnection | null>(null);
  const [isPvP, setIsPvP] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [matchmakingStatus, setMatchmakingStatus] = useState('');
  const [playerIndex, setPlayerIndex] = useState(0);
  const [isHost, setIsHost] = useState(false);
  const [cancelSearch, setCancelSearch] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!gameState.round || gameState.players.some(p => p.persistentScore === undefined)) {
      setGameState(initGame());
    }
  }, []);

  const cleanupPeer = useCallback(() => {
    if (conn) {
      try { conn.close(); } catch(e) { console.error(e); }
    }
    if (peer) {
      try { peer.destroy(); } catch(e) { console.error(e); }
    }
    setConn(null);
    setPeer(null);
    setIsHost(false);
    setMatchmakingStatus('');
  }, [conn, peer]);

  const startMatchmaking = useCallback(async (isStrategicMode: boolean) => {
    console.log("Starting matchmaking...");
    
    // 1. Set UI state immediately
    setIsPvP(true);
    setIsWaiting(true);
    setMatchmakingStatus('Initializing PeerJS...');
    setPlayerIndex(0); 
    
    // 2. Cleanup previous connections
    cleanupPeer();

    let isCancelled = false;
    const cancel = () => { isCancelled = true; };
    setCancelSearch(() => cancel);

    try {
      // 3. Dynamic Import for Robustness
      const peerModule = await import('peerjs');
      const PeerClass = peerModule.Peer || (peerModule as any).default;
      
      if (!PeerClass) {
        throw new Error("Failed to load PeerJS library");
      }

      // 4. Helper to create a Promise-based timeout
      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      // 5. Helper to check a lobby
      const checkLobby = async (lobbyId: string): Promise<boolean> => {
        if (isCancelled) return true;
        setMatchmakingStatus(`Checking lobby...`);
        
        return new Promise<boolean>((resolve) => {
          try {
            const tempPeer = new PeerClass();
            
            tempPeer.on('open', () => {
              const connection = tempPeer.connect(lobbyId);
              
              const timeout = setTimeout(() => {
                console.log(`Timeout at ${lobbyId}`);
                connection.close();
                tempPeer.destroy();
                resolve(false);
              }, 2000); 

              connection.on('open', () => {
                clearTimeout(timeout);
                console.log(`Connected to ${lobbyId}!`);
                setMatchmakingStatus('Connected! Starting game...');
                
                setPeer(tempPeer);
                setConn(connection);
                setPlayerIndex(1);
                setIsHost(false);
                setIsWaiting(false);

                connection.on('data', (data: any) => {
                  if (data.type === 'gameStateUpdate') {
                    const newState = data.state;
                    // Ensure names are clean for local rendering logic
                    newState.players[0].name = "Player 1";
                    newState.players[1].name = "Player 2";
                    setGameState(newState);
                  } else if (data.type === 'LOBBY_FULL') {
                    connection.close();
                    tempPeer.destroy();
                    resolve(false);
                  }
                });

                connection.on('close', () => {
                  alert('Opponent disconnected.');
                  disconnectPvP();
                });

                resolve(true);
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
          } catch (e) {
            console.error(e);
            resolve(false);
          }
        });
      };

      // 5. Strategy: Deterministic "Host or Join"
      // We iterate through lobby IDs. For each ID, we try to HOST it.
      // If we can host, we wait for a player.
      // If we can't host (ID taken), we try to JOIN it.
      // If we can't join (Full/Timeout), we move to the next ID.
      
      const tryLobby = async (lobbyIndex: number): Promise<'HOSTING' | 'CONNECTED' | 'NEXT'> => {
        if (isCancelled) return 'NEXT';
        const lobbyId = `${LOBBY_PREFIX}${lobbyIndex}`;
        setMatchmakingStatus(`Checking Room ${lobbyIndex + 1}...`);
        
        return new Promise<'HOSTING' | 'CONNECTED' | 'NEXT'>((resolve) => {
          // 1. Try to HOST
          let hostPeer: Peer | null = null;
          try {
            hostPeer = new PeerClass(lobbyId, { debug: 1 });
          } catch (e) {
            console.error(e);
            resolve('NEXT');
            return;
          }

          if (!hostPeer) { resolve('NEXT'); return; }

          let isResolved = false;
          
          // If we successfully open as host, we stay here
          hostPeer.on('open', () => {
            if (isResolved || isCancelled) { hostPeer?.destroy(); return; }
            isResolved = true;
            
            console.log(`Hosting on ${lobbyId}`);
            setMatchmakingStatus('Waiting for opponent...');
            setPeer(hostPeer);
            setIsHost(true);
            
            const initialState = initGame(isStrategicMode);
            initialState.players[0].name = "Player 1";
            initialState.players[1].name = "Player 2";
            initialState.mode = "multiplayer";
            setGameState(initialState);

            hostPeer.on('connection', (connection) => {
              // If we already have a connection, reject new ones
              if (conn && conn.open) {
                 connection.on('open', () => {
                    connection.send({ type: 'LOBBY_FULL' });
                    setTimeout(() => connection.close(), 500);
                 });
                 return;
              }
              
              // Accept connection
              console.log("Player connected!");
              setMatchmakingStatus('Opponent found! Starting...');
              setConn(connection);
              setIsWaiting(false);

              connection.on('open', () => {
                connection.send({ type: 'gameStateUpdate', state: initialState });
              });

              connection.on('data', (data: any) => {
                handleAction(data);
              });

              connection.on('close', () => {
                alert('Opponent disconnected.');
                disconnectPvP();
              });
            });

            resolve('HOSTING');
          });

          // If error (likely ID taken), we try to JOIN
          hostPeer.on('error', (err: any) => {
            if (isResolved) return;
            isResolved = true;
            hostPeer?.destroy(); // Cleanup failed host attempt

            if (err.type === 'unavailable-id') {
              console.log(`${lobbyId} is taken. Trying to join...`);
              // 2. Try to JOIN
              try {
                const clientPeer = new PeerClass(undefined, { debug: 1 });
                
                clientPeer.on('open', () => {
                  const connection = clientPeer.connect(lobbyId);
                  
                  // Timeout if host doesn't answer
                  const timeout = setTimeout(() => {
                    console.log(`Timeout joining ${lobbyId}`);
                    connection.close();
                    clientPeer.destroy();
                    resolve('NEXT');
                  }, 2000);

                  connection.on('open', () => {
                    clearTimeout(timeout);
                    console.log(`Connected to ${lobbyId}`);
                    setMatchmakingStatus('Connected! Starting game...');
                    
                    setPeer(clientPeer);
                    setConn(connection);
                    setPlayerIndex(1);
                    setIsHost(false);
                    setIsWaiting(false);

                    connection.on('data', (data: any) => {
                      if (data.type === 'gameStateUpdate') {
                        const newState = data.state;
                        newState.players[0].name = "Player 1";
                        newState.players[1].name = "Player 2";
                        setGameState(newState);
                      } else if (data.type === 'LOBBY_FULL') {
                        console.log("Lobby full");
                        connection.close();
                        clientPeer.destroy();
                        resolve('NEXT'); // Move to next lobby
                      }
                    });

                    connection.on('close', () => {
                      alert('Opponent disconnected.');
                      disconnectPvP();
                    });

                    resolve('CONNECTED');
                  });

                  connection.on('error', () => {
                    clearTimeout(timeout);
                    clientPeer.destroy();
                    resolve('NEXT');
                  });
                });

                clientPeer.on('error', () => {
                  resolve('NEXT');
                });

              } catch (e) {
                resolve('NEXT');
              }
            } else {
              // Some other error
              console.error("Host error:", err);
              resolve('NEXT');
            }
          });
        });
      };

      // Execute Strategy
      for (let i = 0; i < MAX_LOBBIES; i++) {
        const result = await tryLobby(i);
        if (result === 'HOSTING' || result === 'CONNECTED') {
          return; // Stop searching, we are settled
        }
        await wait(100); // Small delay between attempts
      }

      if (!isCancelled) {
        setMatchmakingStatus("No match found. Please try again.");
      }

    } catch (err) {
      console.error("Matchmaking error:", err);
      setMatchmakingStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }

  }, [cleanupPeer]);

  const cancelMatchmaking = useCallback(() => {
    if (cancelSearch) {
      cancelSearch();
      setCancelSearch(null);
    }
    cleanupPeer();
    setIsWaiting(false);
    setIsPvP(false);
    setMatchmakingStatus('');
  }, [cancelSearch, cleanupPeer]);

  const disconnectPvP = useCallback(() => {
    cleanupPeer();
    setIsWaiting(false);
    setIsPvP(false);
    setMatchmakingStatus('');
    setGameState(initGame());
  }, [cleanupPeer]);

  const handleAction = useCallback((action: any) => {
    setGameState(prevState => {
      let newState = { ...prevState };
      try {
        switch (action.type) {
          case "drawCard": newState = drawCard(newState); break;
          case "addDrawnCardToHand": newState = addDrawnCardToHand(newState); break;
          case "addDrawnCardToTarget": newState = addDrawnCardToTarget(newState); break;
          case "playCard": newState = playCard(newState, action.cardId); break;
          case "endTurn": newState = endTurn(newState); break;
          case "startNextRound": newState = startNextRound(newState); break;
          case "restartGame":
            newState = initGame(newState.isStrategicMode);
            newState.players[0].name = "Player 1";
            newState.players[1].name = "Player 2";
            newState.mode = "multiplayer";
            break;
          case "toggleStrategicMode":
            newState = initGame(action.isStrategicMode);
            newState.players[0].name = "Player 1";
            newState.players[1].name = "Player 2";
            newState.mode = "multiplayer";
            break;
          case "endGame": newState = { ...newState, status: "gameOver" }; break;
        }
      } catch (e) {
        console.error("Action error", e);
        return prevState;
      }

      // Send update asynchronously to avoid blocking render
      if (conn && conn.open) {
        setTimeout(() => {
            try {
                conn.send({ type: 'gameStateUpdate', state: newState });
            } catch(e) { console.error("Send error", e); }
        }, 0);
      }
      return newState;
    });
  }, [conn]);

  const sendAction = useCallback((action: any) => {
    if (!isPvP) return;

    if (isHost) {
      handleAction(action);
    } else {
      if (conn && conn.open) {
        conn.send(action);
      }
    }
  }, [isPvP, isHost, conn, handleAction]);

  return (
    <GameContext.Provider value={{ 
      gameState, 
      setGameState, 
      sendAction, 
      isPvP, 
      setIsPvP, 
      isWaiting, 
      playerIndex,
      startMatchmaking,
      cancelMatchmaking,
      disconnectPvP
    }}>
      {children}
    </GameContext.Provider>
  );
};