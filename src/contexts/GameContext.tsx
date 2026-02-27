import React, { createContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { GameState } from '../types';
import { initGame, drawCard, addDrawnCardToHand, addDrawnCardToTarget, playCard, endTurn, startNextRound } from '../services/gameService';
import { Peer, DataConnection } from 'peerjs';

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
const MAX_LOBBIES = 20; // Increased to reduce collisions

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
    setMatchmakingStatus('');
  }, [conn, peer]);

  const startMatchmaking = useCallback(async (isStrategicMode: boolean) => {
    console.log("Starting matchmaking...");
    setIsPvP(true);
    setIsWaiting(true);
    setMatchmakingStatus('Initializing...');
    setPlayerIndex(0); 
    
    cleanupPeer();

    let isCancelled = false;
    const cancel = () => { isCancelled = true; };
    setCancelSearch(() => cancel);

    try {
      // Helper to check a specific lobby
      const checkLobby = async (lobbyId: string): Promise<boolean> => {
        if (isCancelled) return true;
        setMatchmakingStatus(`Checking lobby...`);
        console.log(`Checking lobby: ${lobbyId}`);

        return new Promise<boolean>((resolve) => {
          try {
            const tempPeer = new Peer(undefined, {
              debug: 2
            });
            
            tempPeer.on('open', () => {
              const connection = tempPeer.connect(lobbyId);
              
              const timeout = setTimeout(() => {
                console.log(`Timeout/No Host at ${lobbyId}`);
                connection.close();
                tempPeer.destroy();
                resolve(false);
              }, 1500); // 1.5s timeout

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
                    if (newState.players[1].name === "Player 2") {
                        newState.players[1].name = "Player 2 (You)";
                        newState.players[0].name = "Player 1";
                    }
                    setGameState(newState);
                  } else if (data.type === 'LOBBY_FULL') {
                    console.log("Lobby full");
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

              connection.on('error', (err: any) => {
                console.log("Connection error", err);
                clearTimeout(timeout);
                tempPeer.destroy();
                resolve(false);
              });
            });

            tempPeer.on('error', (err: any) => {
              console.log("Peer error", err);
              tempPeer.destroy();
              resolve(false);
            });
          } catch (e) {
            console.error("Peer creation failed", e);
            resolve(false);
          }
        });
      };

      // Helper to host a lobby
      const hostLobby = async (lobbyId: string): Promise<boolean> => {
        if (isCancelled) return true;
        setMatchmakingStatus(`Creating lobby...`);
        console.log(`Attempting to host: ${lobbyId}`);

        return new Promise<boolean>((resolve) => {
          try {
            const newPeer = new Peer(lobbyId, {
              debug: 2
            });

            newPeer.on('open', () => {
              console.log(`Hosting ${lobbyId}!`);
              setMatchmakingStatus('Waiting for opponent...');
              setPeer(newPeer);
              setIsHost(true);
              
              const initialState = initGame(isStrategicMode);
              initialState.players[0].name = "Player 1 (You)";
              initialState.players[1].name = "Player 2";
              initialState.mode = "multiplayer";
              setGameState(initialState);

              newPeer.on('connection', (connection) => {
                if (conn) {
                  connection.on('open', () => {
                    connection.send({ type: 'LOBBY_FULL' });
                    setTimeout(() => connection.close(), 500);
                  });
                  return;
                }

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

              resolve(true);
            });

            newPeer.on('error', (err: any) => {
              console.log(`Failed to host ${lobbyId} (likely taken)`);
              newPeer.destroy();
              resolve(false);
            });
          } catch (e) {
            console.error("Peer creation failed", e);
            resolve(false);
          }
        });
      };

      // Generate random permutation
      const indices = Array.from({ length: MAX_LOBBIES }, (_, i) => i).sort(() => Math.random() - 0.5);
      
      // Try to join first few
      for (let i = 0; i < 5; i++) {
        if (await checkLobby(`${LOBBY_PREFIX}${indices[i]}`)) return;
      }

      // Try to host on the rest
      for (let i = 5; i < MAX_LOBBIES; i++) {
        if (await hostLobby(`${LOBBY_PREFIX}${indices[i]}`)) return;
      }

      if (!isCancelled) {
        setMatchmakingStatus("Unable to find a match. Please try again.");
        // Do not reset isWaiting automatically, let user see message
      }
    } catch (err) {
      console.error("Matchmaking error:", err);
      setMatchmakingStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
      // Do not reset isWaiting automatically
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
          case "endGame": newState = { ...newState, status: "gameOver" }; break;
        }
      } catch (e) {
        console.error("Action error", e);
        return prevState;
      }

      if (conn && conn.open) {
        conn.send({ type: 'gameStateUpdate', state: newState });
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