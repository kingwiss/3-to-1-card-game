import React, { createContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { GameState } from '../types';
import { initGame, drawCard, addDrawnCardToHand, addDrawnCardToTarget, playCard, endTurn, startNextRound, handleGambleChoice } from '../services/gameService';
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
  startMatchmaking: (isStrategicMode: boolean, gameMode: 'normal' | 'special') => Promise<void>;
  cancelMatchmaking: () => void;
  disconnectPvP: () => void;
}

export const GameContext = createContext<GameContextProps | undefined>(undefined);

const getLobbyPrefix = (isStrategic: boolean, gameMode: 'normal' | 'special') => {
  const modePrefix = gameMode === 'special' ? 'special' : 'normal';
  const stratPrefix = isStrategic ? 'strat' : 'std';
  return `neural-game-v1-${modePrefix}-${stratPrefix}-`;
};
const MAX_LOBBIES = 50;

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

  // Apply state changes locally without sending
  const applyStateChange = useCallback((newState: GameState) => {
    setGameState(newState);
  }, []);

  // Handle incoming data from peer
  const handleIncomingData = useCallback((data: any) => {
    if (data.type === 'gameStateUpdate') {
      const newState = data.state;
      applyStateChange(newState);
    }
  }, [applyStateChange]);

  const startMatchmaking = useCallback(async (isStrategicMode: boolean, gameMode: 'normal' | 'special') => {
    console.log("Starting matchmaking...", { isStrategicMode, gameMode });
    
    setIsPvP(true);
    setIsWaiting(true);
    setMatchmakingStatus('Initializing PeerJS...');
    setPlayerIndex(0); 
    
    cleanupPeer();

    let isCancelled = false;
    const cancel = () => { isCancelled = true; };
    setCancelSearch(() => cancel);

    try {
      const peerModule = await import('peerjs');
      const PeerClass = peerModule.Peer || (peerModule as any).default;
      
      if (!PeerClass) {
        throw new Error("Failed to load PeerJS library");
      }

      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      const tryLobby = async (lobbyIndex: number): Promise<'HOSTING' | 'CONNECTED' | 'NEXT'> => {
        if (isCancelled) return 'NEXT';
        const lobbyId = `${getLobbyPrefix(isStrategicMode, gameMode)}${lobbyIndex}`;
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
          
          hostPeer.on('open', () => {
            if (isResolved || isCancelled) { hostPeer?.destroy(); return; }
            isResolved = true;
            
            console.log(`Hosting on ${lobbyId}`);
            setMatchmakingStatus('Waiting for opponent...');
            setPeer(hostPeer);
            setIsHost(true);
            
            const initialState = initGame(isStrategicMode, gameMode);
            initialState.players[0].name = "Player 1";
            initialState.players[1].name = "Player 2";
            initialState.mode = "multiplayer";
            setGameState(initialState);

            hostPeer.on('connection', (connection) => {
              if (conn && conn.open) {
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
                handleIncomingData(data);
              });

              connection.on('close', () => {
                alert('Opponent disconnected.');
                disconnectPvP();
              });
            });

            resolve('HOSTING');
          });

          hostPeer.on('error', (err: any) => {
            if (isResolved) return;
            isResolved = true;
            hostPeer?.destroy(); 

            if (err.type === 'unavailable-id') {
              console.log(`${lobbyId} is taken. Trying to join...`);
              // 2. Try to JOIN
              try {
                const clientPeer = new PeerClass(undefined, { debug: 1 });
                
                clientPeer.on('open', () => {
                  const connection = clientPeer.connect(lobbyId);
                  
                  const timeout = setTimeout(() => {
                    console.log(`Timeout joining ${lobbyId}`);
                    connection.close();
                    clientPeer.destroy();
                    resolve('NEXT');
                  }, 500); // Fast timeout for scanning

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
                        handleIncomingData(data);
                      } else if (data.type === 'LOBBY_FULL') {
                        console.log("Lobby full");
                        connection.close();
                        clientPeer.destroy();
                        resolve('NEXT');
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
              console.error("Host error:", err);
              resolve('NEXT');
            }
          });
        });
      };

      for (let i = 0; i < MAX_LOBBIES; i++) {
        const result = await tryLobby(i);
        if (result === 'HOSTING' || result === 'CONNECTED') {
          return; 
        }
        await wait(50); 
      }

      if (!isCancelled) {
        setMatchmakingStatus("No match found. Please try again.");
      }

    } catch (err) {
      console.error("Matchmaking error:", err);
      setMatchmakingStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }

  }, [cleanupPeer, handleIncomingData]);

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

  // Called by UI to perform an action and broadcast it
  const sendAction = useCallback((action: any) => {
    if (!isPvP) return;

    setGameState(prevState => {
      let newState = { ...prevState };
      try {
        switch (action.type) {
          case "drawCard": newState = drawCard(newState); break;
          case "addDrawnCardToHand": newState = addDrawnCardToHand(newState); break;
          case "addDrawnCardToTarget": newState = addDrawnCardToTarget(newState); break;
          case "gambleChoice": newState = handleGambleChoice(newState, action.cardId, action.choice); break;
          case "playCard": newState = playCard(newState, action.cardId, action.selectedValue); break;
          case "endTurn": newState = endTurn(newState); break;
          case "startNextRound": newState = startNextRound(newState); break;
          case "syncName":
            newState.players[action.playerIndex].name = action.name;
            break;
          case "restartGame": {
            const p1Name = newState.players[0].name;
            const p2Name = newState.players[1].name;
            newState = initGame(newState.isStrategicMode);
            newState.players[0].name = p1Name;
            newState.players[1].name = p2Name;
            newState.mode = "multiplayer";
            break;
          }
          case "toggleStrategicMode": {
            const p1Name = newState.players[0].name;
            const p2Name = newState.players[1].name;
            newState = initGame(action.isStrategicMode);
            newState.players[0].name = p1Name;
            newState.players[1].name = p2Name;
            newState.mode = "multiplayer";
            break;
          }
          case "endGame": newState = { ...newState, status: "gameOver" }; break;
          case "chatMessage": {
            newState.chatMessages = [...(newState.chatMessages || []), {
              senderId: action.senderId,
              text: action.text,
              timestamp: Date.now()
            }];
            break;
          }
        }
      } catch (e) {
        console.error("Action error", e);
        return prevState;
      }

      // We must broadcast the state. Since setGameState updater is pure,
      // we can use a ref or just send it here, but sending it here is the
      // only way to get the exact newState. We use setTimeout to avoid blocking.
      if (conn && conn.open) {
        setTimeout(() => {
            try {
                conn.send({ type: 'gameStateUpdate', state: newState });
            } catch(e) { console.error("Send error", e); }
        }, 0);
      }
      return newState;
    });
  }, [isPvP, conn]);

  return (
    <GameContext.Provider value={{ 
      gameState, 
      setGameState, 
      sendAction, 
      isPvP, 
      setIsPvP, 
      isWaiting, 
      matchmakingStatus,
      playerIndex,
      startMatchmaking,
      cancelMatchmaking,
      disconnectPvP
    }}>
      {children}
    </GameContext.Provider>
  );
};