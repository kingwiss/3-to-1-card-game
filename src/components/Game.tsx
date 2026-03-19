import React, { useEffect, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { useAuth } from '../contexts/AuthContext';
import { drawCard, playCard, initGame, addDrawnCardToHand, addDrawnCardToTarget, startNextRound, endTurn, findBestCardToPlay, getBestGoldenCardValue } from '../services/gameService';
import { auth } from '../services/firebase';
import Card from './Card';
import Profile from './Profile';
import Login from './Login';
import PremiumModal from './PremiumModal';
import SpecialGameModal from './SpecialGameModal';
import { motion, AnimatePresence } from 'framer-motion';
import { playSound } from '../utils/sound';
import { ChevronUp, ChevronDown, Users, User, BookOpen, Star, Palette, X, Sparkles, LogIn, LogOut, Gamepad2 } from 'lucide-react';
import { io } from 'socket.io-client';

const ColorButton = ({ color, index, angle, themeColor, setThemeColor, isPremium }: any) => {
  const radius = 90;
  const x = Math.cos((angle * Math.PI) / 180) * radius;
  const y = Math.sin((angle * Math.PI) / 180) * radius;

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
      animate={{ scale: 1, opacity: 1, x, y }}
      exit={{ scale: 0, opacity: 0, x: 0, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20, delay: index * 0.05 }}
      whileHover={{ scale: 1.2, zIndex: 50 }}
      whileTap={{ scale: 0.9 }}
      onClick={() => {
        if (isPremium) playSound('tick');
        setThemeColor(color);
      }}
      className={`absolute w-10 h-10 -ml-5 -mt-5 rounded-full border-2 shadow-lg flex items-center justify-center ${themeColor === color ? 'border-white z-10' : 'border-transparent'}`}
    >
      <div 
        className="w-full h-full rounded-full relative"
        style={{
          backgroundColor: 
            color === 'slate' ? '#64748b' :
            color === 'blue' ? '#3b82f6' :
            color === 'red' ? '#ef4444' :
            color === 'emerald' ? '#10b981' :
            color === 'purple' ? '#a855f7' :
            color === 'orange' ? '#f97316' :
            color === 'pink' ? '#ec4899' :
            color === 'teal-gray' ? '#0f766e' :
            '#06b6d4'
        }}
      >
        {themeColor === color && <div className="absolute inset-0 m-auto w-2 h-2 bg-white rounded-full" />}
      </div>
    </motion.button>
  );
};

const Game: React.FC = () => {
  const { gameState, setGameState, sendAction, isPvP, setIsPvP, isWaiting, matchmakingStatus, playerIndex, startMatchmaking, cancelMatchmaking, disconnectPvP } = useGame();
  const { user, userProfile } = useAuth();
  const [isHandExpanded, setIsHandExpanded] = useState(false);
  const [isPlayerRowExpanded, setIsPlayerRowExpanded] = useState(false);
  const [isOpponentRowExpanded, setIsOpponentRowExpanded] = useState(false);
  const [isOpponentHandExpanded, setIsOpponentHandExpanded] = useState(false);
  const [isTargetExpanded, setIsTargetExpanded] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [floatingModeText, setFloatingModeText] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(userProfile?.isPremium || false);
  // Theme color is local state and not synced with opponent
  const [themeColor, setThemeColor] = useState(userProfile?.isPremium ? 'cyan' : 'teal-gray');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isLeftMenuOpen, setIsLeftMenuOpen] = useState(false);
  const [isGameModeModalOpen, setIsGameModeModalOpen] = useState(false);
  const [isGoldenCardModalOpen, setIsGoldenCardModalOpen] = useState(false);
  const [selectedGoldenCardId, setSelectedGoldenCardId] = useState<string | null>(null);
  const [goldenCardValue, setGoldenCardValue] = useState<number | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<number>(0);
  const [hasRecordedGame, setHasRecordedGame] = useState(false);
  const [showSpecialGameModal, setShowSpecialGameModal] = useState(false);
  const [localSpecialGamesPlayed, setLocalSpecialGamesPlayed] = useState(0);
  const { updateProfile } = useAuth();

  // Handle local tracking for unauthenticated users
  useEffect(() => {
    if (!userProfile) {
      const storedData = localStorage.getItem('specialGamesTracking');
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      
      if (storedData) {
        try {
          const { played, resetDate } = JSON.parse(storedData);
          if (Date.now() - resetDate >= ONE_WEEK_MS) {
            localStorage.setItem('specialGamesTracking', JSON.stringify({ played: 0, resetDate: Date.now() }));
            setLocalSpecialGamesPlayed(0);
          } else {
            setLocalSpecialGamesPlayed(played);
          }
        } catch (e) {
          localStorage.setItem('specialGamesTracking', JSON.stringify({ played: 0, resetDate: Date.now() }));
          setLocalSpecialGamesPlayed(0);
        }
      } else {
        localStorage.setItem('specialGamesTracking', JSON.stringify({ played: 0, resetDate: Date.now() }));
        setLocalSpecialGamesPlayed(0);
      }
    }
  }, [userProfile]);

  // Reset hasRecordedGame when a new game starts
  useEffect(() => {
    if (gameState.status === 'playing' && gameState.round === 1) {
      setHasRecordedGame(false);
    }
  }, [gameState.status, gameState.round]);

  useEffect(() => {
    // Connect to the socket server
    const socket = io();
    
    socket.on('connect', () => {
      console.log('Connected to socket server');
      socket.emit('requestOnlineUsers');
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });

    socket.on('onlineUsers', (count: number) => {
      console.log('Online users count updated:', count);
      setOnlineUsers(count);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isLeftMenuOpen) {
      setIsColorPickerOpen(false);
    }
  }, [isLeftMenuOpen]);

  useEffect(() => {
    document.body.className = `theme-${themeColor}`;
  }, [themeColor]);

  // Sync user profile with game state
  useEffect(() => {
    if (userProfile && gameState.players[playerIndex].name !== userProfile.displayName) {
      const newPlayers = [...gameState.players];
      newPlayers[playerIndex].name = userProfile.displayName;
      
      if (isPvP) {
        sendAction({ type: 'syncName', name: userProfile.displayName, playerIndex });
      } else {
        setGameState({ ...gameState, players: newPlayers });
      }
    }
    // Also sync premium status if needed for UI logic
    if (userProfile?.isPremium !== isPremium) {
      const newPremium = userProfile?.isPremium || false;
      setIsPremium(newPremium);
      // Update theme if it was the default
      if (themeColor === 'slate' || themeColor === 'teal-gray' || themeColor === 'cyan') {
        setThemeColor(newPremium ? 'cyan' : 'teal-gray');
      }
    }
  }, [userProfile, playerIndex, gameState.players, isPremium, setGameState, isPvP, sendAction]);

  const { players, targetNumber, targetLineup, status, winnerId, activePlayerIndex, deck, hasDrawnCardThisTurn, drawnCard, round, pendingTargetDecision, gameMode } = gameState;
  
  const player = players[playerIndex];
  const opponent = players[playerIndex === 0 ? 1 : 0];

  const handleDrawCard = () => {
    if (status === 'playing' && activePlayerIndex === playerIndex && !hasDrawnCardThisTurn) {
      playSound('draw');
      if (isPvP) {
        sendAction({ type: 'drawCard' });
      } else {
        const newGameState = drawCard(gameState);
        setGameState(newGameState);
      }
    }
  };

  const handlePlayCard = (cardId: string, selectedValue?: number) => {
    if (status === 'playing' && activePlayerIndex === playerIndex && hasDrawnCardThisTurn && !drawnCard) {
      playSound('play');
      if (isPvP) {
        sendAction({ type: 'playCard', cardId, selectedValue });
      } else {
        const newGameState = playCard(gameState, cardId, selectedValue);
        setGameState(newGameState);
      }
    }
  };

  const onCardClick = (cardId: string, card: any) => {
    if (card.type === 'golden') {
       setSelectedGoldenCardId(cardId);
       setGoldenCardValue(null);
       setIsGoldenCardModalOpen(true);
    } else {
       handlePlayCard(cardId);
    }
  };

  const handleEndTurn = () => {
    if (status === 'playing' && activePlayerIndex === playerIndex && gameState.isStrategicMode) {
      if (isPvP) {
        sendAction({ type: 'endTurn' });
      } else {
        setGameState(endTurn(gameState));
      }
    }
  };

  const handleRestart = () => {
    if (isPvP) {
      sendAction({ type: 'restartGame' });
    } else {
      setGameState(initGame(gameState.isStrategicMode));
    }
  };

  const handleEndGame = () => {
    if (isPvP) {
      sendAction({ type: 'endGame' });
    } else {
      setGameState({ ...gameState, status: 'gameOver' });
    }
  };

  useEffect(() => {
    if (!isPvP && activePlayerIndex === 1 && status === 'playing') {
      let timer: NodeJS.Timeout;

      if (!hasDrawnCardThisTurn) {
        timer = setTimeout(() => {
          playSound('draw');
          setGameState(prevState => drawCard(prevState));
        }, 1000);
      } else if (drawnCard) {
        timer = setTimeout(() => {
          playSound('draw');
          setGameState(prevState => {
            if (prevState.pendingTargetDecision) {
              // Simple AI: always add to hand for now
              return addDrawnCardToHand(prevState);
            } else {
              return addDrawnCardToHand(prevState);
            }
          });
        }, 1000);
      } else {
        timer = setTimeout(() => {
          const aiPlayer = players[1];
          
          if (gameState.isStrategicMode && gameState.playsThisTurn > 0) {
            if (Math.random() < 0.3) {
              setGameState(prevState => endTurn(prevState));
              return;
            }
          }

          const bestCard = findBestCardToPlay(aiPlayer, targetNumber);
          if (bestCard) {
            playSound('play');
            let selectedValue: number | undefined;
            if (bestCard.type === 'golden') {
              selectedValue = getBestGoldenCardValue(aiPlayer, targetNumber);
            }
            setGameState(prevState => {
              const newState = playCard(prevState, bestCard.id, selectedValue);
              if (newState === prevState) {
                return endTurn(prevState);
              }
              return newState;
            });
          } else {
            setGameState(prevState => endTurn(prevState));
          }
        }, 1000);
      }

      return () => clearTimeout(timer);
    }
  }, [activePlayerIndex, status, setGameState, isPvP, hasDrawnCardThisTurn, drawnCard, pendingTargetDecision, players, targetNumber, gameState.isStrategicMode, gameState.playsThisTurn]);

  useEffect(() => {
    if (drawnCard && !pendingTargetDecision && activePlayerIndex === playerIndex) {
      const timer = setTimeout(() => {
        playSound('draw');
        if (isPvP) {
          sendAction({ type: 'addDrawnCardToHand' });
        } else {
          setGameState(prevState => addDrawnCardToHand(prevState));
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [drawnCard, pendingTargetDecision, setGameState, isPvP, activePlayerIndex, playerIndex, sendAction]);

  useEffect(() => {
    if (!hasDrawnCardThisTurn) {
      setIsHandExpanded(false);
    } else if (activePlayerIndex === playerIndex) {
      setIsHandExpanded(true);
    }
  }, [hasDrawnCardThisTurn, activePlayerIndex, playerIndex]);

  useEffect(() => {
    if (status === 'roundOver') {
      if (winnerId === player.id) {
        playSound('win');
      } else {
        playSound('lose');
      }
    } else if (status === 'gameOver') {
      if (player.persistentScore > opponent.persistentScore) {
        playSound('win');
      } else {
        playSound('lose');
      }

      if (userProfile && !hasRecordedGame) {
        const isWin = player.persistentScore > opponent.persistentScore;
        const isLoss = player.persistentScore < opponent.persistentScore;
        
        updateProfile({
          gamesPlayed: (userProfile.gamesPlayed || 0) + 1,
          wins: (userProfile.wins || 0) + (isWin ? 1 : 0),
          losses: (userProfile.losses || 0) + (isLoss ? 1 : 0)
        });
        setHasRecordedGame(true);
      }
    }
  }, [status, winnerId, player.id, player.persistentScore, opponent.persistentScore, userProfile, hasRecordedGame, updateProfile]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const isMyTurn = activePlayerIndex === playerIndex;

    if (isMyTurn && hasDrawnCardThisTurn && !drawnCard && !pendingTargetDecision && status === 'playing') {
      timer = setTimeout(() => {
        // Auto-play logic for 10s rule
        const currentPlayer = players[activePlayerIndex];
        const bestCard = findBestCardToPlay(currentPlayer, targetNumber);
        
        if (bestCard) {
           playSound('play');
           let selectedValue: number | undefined;
           if (bestCard.type === 'golden') {
             selectedValue = getBestGoldenCardValue(currentPlayer, targetNumber);
           }
           if (isPvP) {
             sendAction({ type: 'playCard', cardId: bestCard.id, selectedValue });
           } else {
             setGameState(prevState => {
               const newState = playCard(prevState, bestCard.id, selectedValue);
               if (newState === prevState) {
                 return endTurn(prevState);
               }
               return newState;
             });
           }
        } else {
           if (isPvP) {
             sendAction({ type: 'endTurn' });
           } else {
             setGameState(prevState => endTurn(prevState));
           }
        }
      }, 10000);
    }
    return () => clearTimeout(timer);
  }, [activePlayerIndex, hasDrawnCardThisTurn, drawnCard, pendingTargetDecision, status, isPvP, playerIndex, sendAction, players, targetNumber]);

  if (isWaiting) {
    return (
      <div className="w-full max-w-md mx-auto h-[100dvh] flex flex-col items-center justify-center text-white p-4 font-sans">
        <h2 className="text-2xl font-bold mb-4">Searching for opponent...</h2>
        {matchmakingStatus && <p className="text-theme-400 mb-4 animate-pulse">{matchmakingStatus}</p>}
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-8"></div>
        <button 
          onClick={cancelMatchmaking}
          className="px-6 py-2 bg-theme-700 rounded-lg hover:bg-theme-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto h-[100dvh] flex flex-col items-center justify-between text-white p-1 font-sans relative overflow-hidden">
      {/* Online Users (Top Left) */}
      <div className="absolute top-4 left-4 text-xs text-white/50 z-40 flex items-center gap-1.5 font-medium tracking-wide">
        <div className={`w-1.5 h-1.5 rounded-full ${onlineUsers > 0 ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
        {Math.max(1, onlineUsers)} online
      </div>

      {/* Auth Buttons (Top Right) */}
      {user ? (
        <div className="absolute top-4 right-4 z-40 flex flex-col items-end">
          {isProfileMenuOpen && (
            <div 
              className="fixed inset-0 z-30" 
              onClick={() => setIsProfileMenuOpen(false)}
            />
          )}
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="relative z-40 w-10 h-10 rounded-full bg-theme-800 border-2 border-theme-600 flex items-center justify-center overflow-hidden shadow-lg hover:scale-105 transition-transform"
          >
            {userProfile?.photoURL ? (
              <img src={userProfile.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-bold text-white">
                {userProfile?.displayName?.charAt(0).toUpperCase() || <User size={20} />}
              </span>
            )}
          </button>
          
          {isProfileMenuOpen && (
            <div className="relative z-40 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-slate-700">
                <p className="text-sm font-bold text-white truncate">{userProfile?.displayName}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  setShowProfile(true);
                }}
                className="px-4 py-3 text-left text-sm text-white hover:bg-slate-700 transition-colors flex items-center gap-2"
              >
                <User size={16} />
                View Dashboard
              </button>
              <button
                onClick={async () => {
                  setIsProfileMenuOpen(false);
                  await auth.signOut();
                }}
                className="px-4 py-3 text-left text-sm text-red-400 hover:bg-slate-700 transition-colors flex items-center gap-2"
              >
                <LogOut size={16} />
                Log Out
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowLogin(true)}
          className="absolute top-4 right-4 z-40 px-3 py-1.5 bg-black text-white rounded-lg shadow-[0_4px_0_#333] active:shadow-none active:translate-y-[4px] flex items-center gap-2 font-bold text-xs transition-all border-none"
        >
          <LogIn size={14} />
          Login / Sign Up
        </button>
      )}

      {(status === 'roundOver' || status === 'gameOver') && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-center">
            {status === 'roundOver' && (
              <>
                <h2 className="text-4xl font-bold mb-2">Winner:</h2>
                <h3 className="text-6xl font-bold mb-4">{winnerId === player.id ? 'You!' : 'Opponent'}</h3>
                <button 
                  onClick={() => {
                    if (isPvP) {
                      sendAction({ type: 'startNextRound' });
                    } else {
                      setGameState(startNextRound(gameState));
                    }
                  }} 
                  className="px-6 py-2 bg-theme-600 rounded-lg hover:bg-theme-500"
                >
                  Start a new game
                </button>
              </>
            )}
            {status === 'gameOver' && (
              <>
                <h2 className="text-4xl font-bold mb-2">Final Winner:</h2>
                <h3 className="text-6xl font-bold mb-4">{player.persistentScore > opponent.persistentScore ? 'You!' : 'Opponent'}</h3>
                <button onClick={handleRestart} className="px-6 py-2 bg-theme-600 rounded-lg hover:bg-theme-500">Play Again</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Opponent Area */}
      <div className="w-full flex flex-col items-center gap-1 pt-12">
        <div className="flex justify-between w-full px-4 items-center">
          <div className="text-base font-bold flex items-center gap-2">
            {opponent.name || 'Opponent'}
            {opponent.cleanSlate && (
              <span className="text-[10px] bg-theme-500/80 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">Clean Slate</span>
            )}
          </div>
          <div className="text-base font-bold">Sum: {opponent.score}</div>
        </div>
        
        {/* Opponent's Hand */}
        <div className="w-full flex flex-col items-center relative">
          <div 
            className="w-full overflow-x-auto h-16 md:h-24 flex cursor-pointer group scrollbar-hide"
            onClick={() => setIsOpponentHandExpanded(!isOpponentHandExpanded)}
          >
            <div className={`flex items-center m-auto transition-all duration-300 ${isOpponentHandExpanded ? 'gap-2 px-4' : ''}`}>
              {opponent.hand.map((card) => (
                <div 
                  key={card.id} 
                  className={`transition-all duration-300 transform-gpu ${isOpponentHandExpanded ? 'flex-shrink-0' : '-ml-8 first:ml-0 z-10'}`}
                >
                  <Card card={card} isHidden={true} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Opponent's Row */}
        <div className="w-[90%] flex flex-col items-center relative">
          <div 
            className={`relative w-full bg-black/20 rounded-xl flex overflow-hidden transition-all duration-300 shadow-[6px_6px_0px_rgba(0,0,0,0.4)] ${isOpponentRowExpanded ? 'h-[64px] md:h-[88px]' : 'h-[64px] md:h-[88px] cursor-pointer group p-1'}`}
            onClick={() => setIsOpponentRowExpanded(!isOpponentRowExpanded)}
          >
            <div className={`flex items-center m-auto transition-all duration-300 ${isOpponentRowExpanded ? 'gap-2 px-4' : ''}`}>
              {opponent.row.map(card => (
                <div 
                  key={card.id} 
                  className={`transition-all duration-300 transform-gpu ${isOpponentRowExpanded ? 'flex-shrink-0' : '-ml-8 first:ml-0 z-10'}`}
                >
                  <Card card={card} />
                </div>
              ))}
            </div>
            {opponent.limitLifted && <div className="absolute -top-2 -right-2 bg-theme-500 text-white text-xs font-bold px-2 py-0.5 rounded-full z-50">LIMIT LIFTED</div>}
          </div>
        </div>
      </div>

      {/* Center Area */}
      <div className="w-full flex items-center justify-between px-2">
        {/* Deck Area */}
        <div className="flex flex-col items-center gap-1">
          <button onClick={handleDrawCard} className="relative w-10 h-14 md:w-14 md:h-20" disabled={hasDrawnCardThisTurn || activePlayerIndex !== playerIndex}>
            <div className="absolute top-0 left-0 w-full h-full rounded-lg border-2 border-[var(--theme-600)] transform -rotate-6" style={{ backgroundColor: 'var(--theme-800)' }}></div>
            <div className="absolute top-0 left-0 w-full h-full rounded-lg border-2 border-[var(--theme-600)] transform rotate-6" style={{ backgroundColor: 'var(--theme-800)' }}></div>
            <div className={`absolute top-0 left-0 w-full h-full rounded-lg border-2 flex items-center justify-center text-sm md:text-base font-bold cursor-pointer text-center leading-tight transition-colors ${activePlayerIndex === playerIndex && !hasDrawnCardThisTurn ? 'border-green-400 shadow-[0_0_15px_rgba(74,222,128,0.5)]' : 'border-[var(--theme-700)]'}`} style={{ backgroundColor: 'var(--theme-900)' }}>
              1 to 3
            </div>
          </button>
          <p className="text-xs font-semibold">{deck.length} left</p>
        </div>

        {/* Target */}
        <div className="flex flex-col items-center gap-2 relative flex-1 mx-2 min-w-0">
          {/* Turn Indicator */}
          <div className={`px-4 py-1 rounded-full text-xs font-bold shadow-lg transition-all duration-300 ${activePlayerIndex === playerIndex ? 'bg-green-500 text-white animate-pulse' : 'bg-red-500 text-white'}`}>
            {activePlayerIndex === playerIndex ? "YOUR TURN" : "OPPONENT'S TURN"}
          </div>
          <div className="relative w-28 h-28 flex items-center justify-center floating">
            {/* Bubble Background */}
            <div className="absolute inset-0 rounded-full bubble-container overflow-hidden z-0">
              {/* Special Mode Radiating Effect */}
              {gameState.gameMode === 'special' && (
                <div className="absolute inset-0 z-0">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-full blur-md"
                    style={{ 
                      backgroundColor: 
                        themeColor === 'slate' ? '#64748b' :
                        themeColor === 'blue' ? '#3b82f6' :
                        themeColor === 'red' ? '#ef4444' :
                        themeColor === 'emerald' ? '#10b981' :
                        themeColor === 'purple' ? '#a855f7' :
                        themeColor === 'orange' ? '#f97316' :
                        themeColor === 'pink' ? '#ec4899' :
                        '#06b6d4'
                    }}
                  />
                </div>
              )}

              {/* Fluid Fill */}
              <div 
                className={`absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-in-out ${activePlayerIndex === playerIndex ? 'bg-green-500/60' : 'bg-red-500/60'}`}
                style={{ 
                  height: `${Math.min(100, ((activePlayerIndex === playerIndex ? player.score : opponent.score) / targetNumber) * 100)}%`,
                  boxShadow: '0 -4px 12px rgba(0,0,0,0.2)'
                }}
              >
                {/* Fluid Surface Wave Effect (Simplified with CSS) */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-white/20 rounded-t-full"></div>
              </div>
              
              {/* Bubble Shine Effect */}
              <div className="absolute top-1 left-2 w-16 h-16 bubble-shine z-20"></div>
              <div className="absolute bottom-2 right-4 w-6 h-3 bg-white/20 rounded-full transform -rotate-45 blur-[2px] z-20"></div>
            </div>
            
            <h2 className="text-5xl font-black relative z-30 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{targetNumber}</h2>
          </div>
          <div 
            className={`flex items-center ${targetLineup.length >= 7 && isTargetExpanded ? 'w-full overflow-x-auto scrollbar-hide justify-start px-2' : 'justify-center'} cursor-pointer transition-all duration-300`}
            onClick={() => {
              if (targetLineup.length >= 7) {
                setIsTargetExpanded(!isTargetExpanded);
              }
            }}
          >
            <div className={`flex ${targetLineup.length >= 7 && !isTargetExpanded ? '' : 'gap-1'} transition-all duration-300 m-auto`}>
              {targetLineup.map((card, idx) => (
                <div 
                  key={card.id} 
                  className={`w-6 h-8 rounded-sm flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300 ${targetLineup.length >= 7 && !isTargetExpanded ? '-ml-3 first:ml-0 shadow-[-2px_0_4px_rgba(0,0,0,0.5)]' : ''}`}
                  style={{ backgroundColor: 'var(--theme-800)' }}
                >
                  {card.value}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 123 Module */}
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((num) => {
            const isUnlocked = players[activePlayerIndex].unlockedNumbers[num as 1 | 2 | 3];
            return (
              <div 
                key={num}
                className={`relative w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-75 ${isUnlocked ? 'bg-theme-500 text-white shadow-[0_0_25px_var(--theme-500),0_0_10px_rgba(255,255,255,0.8),4px_4px_0px_rgba(0,0,0,0.4)] scale-110 border-2 border-white' : 'bg-white/10 text-white shadow-[4px_4px_0px_rgba(0,0,0,0.2)] border-2 border-white/10 backdrop-blur-sm'}`}
              >
                {/* Radiating animation when unlocked */}
                {isUnlocked && (
                  <div className="absolute inset-0 rounded-full animate-ping bg-theme-400/80 z-0" style={{ animationDuration: '1s' }}></div>
                )}
                
                {/* Bubble Highlights */}
                <div className="absolute inset-0 rounded-full overflow-hidden z-0">
                  <div className="absolute top-1.5 left-2 w-3 h-1.5 bg-white/60 rounded-full transform -rotate-45 blur-[0.5px]"></div>
                  <div className="absolute bottom-1.5 right-2 w-2 h-1 bg-white/30 rounded-full transform -rotate-45 blur-[1px]"></div>
                </div>
                
                <span className="relative z-10 drop-shadow-md">{num}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Player Area */}
      <div className="w-full flex flex-col items-center gap-1 pb-10">
        <div className="flex justify-between w-full px-4 items-center">
          <div className="text-base font-bold w-20 flex items-center gap-2">
            {player.name || 'You'}
            {player.cleanSlate && (
              <span className="text-[10px] bg-theme-500/80 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">Clean Slate</span>
            )}
          </div>
          <div className="flex-1 flex justify-center">
            {activePlayerIndex === playerIndex && hasDrawnCardThisTurn && !drawnCard && gameState.isStrategicMode && (
              <button 
                onClick={handleEndTurn}
                className="px-4 py-1.5 bg-theme-600 hover:bg-theme-500 rounded-full text-xs font-bold shadow-lg transition-colors animate-pulse"
              >
                End Turn
              </button>
            )}
          </div>
          <div className="text-base font-bold w-20 text-right">Sum: {player.score}</div>
        </div>

        {/* Player's Row */}
        <div className="w-[90%] flex flex-col items-center relative">
          <div 
            className={`relative w-full bg-black/20 rounded-xl flex overflow-hidden transition-all duration-300 shadow-[6px_6px_0px_rgba(0,0,0,0.4)] ${isPlayerRowExpanded ? 'h-[64px] md:h-[88px]' : 'h-[64px] md:h-[88px] cursor-pointer group p-1'}`}
            onClick={() => setIsPlayerRowExpanded(!isPlayerRowExpanded)}
          >
            <div className={`flex items-center m-auto transition-all duration-300 ${isPlayerRowExpanded ? 'gap-2 px-4' : ''}`}>
              {player.row.map(card => (
                <div 
                  key={card.id} 
                  className={`transition-all duration-300 transform-gpu ${isPlayerRowExpanded ? 'flex-shrink-0' : '-ml-8 first:ml-0 z-10'}`}
                >
                  <Card card={card} />
                </div>
              ))}
            </div>
            {player.limitLifted && <div className="absolute -top-2 -right-2 bg-theme-500 text-white text-xs font-bold px-2 py-0.5 rounded-full z-50">LIMIT LIFTED</div>}
          </div>
        </div>

        {/* Player's Hand */}
        <div className="w-full flex flex-col items-center relative">
          <div 
            className="w-full overflow-x-auto h-20 md:h-28 flex cursor-pointer group scrollbar-hide"
            onClick={() => setIsHandExpanded(!isHandExpanded)}
          >
            <div className={`flex items-center m-auto transition-all duration-300 ${isHandExpanded ? 'gap-2 px-4' : ''}`}>
              {player.hand.map((card) => {
                const isMyTurnToPlay = activePlayerIndex === playerIndex && hasDrawnCardThisTurn && !drawnCard;
                const isCardPlayable = 
                  isMyTurnToPlay && (
                    card.type === 'golden' || (
                      player.score + card.value <= targetNumber &&
                      !(player.row.length > 0 && player.row[player.row.length - 1].value === card.value) &&
                      !(card.value > 3 && !player.highCardsUnlocked)
                    )
                  );

                return (
                  <div 
                    key={card.id} 
                    className={`transition-all duration-300 transform-gpu ${isHandExpanded ? `flex-shrink-0 ${isCardPlayable ? '-translate-y-4 shadow-lg z-20' : 'translate-y-0 z-10'}` : '-ml-8 first:ml-0 z-10'}`}
                  >
                    <Card 
                      card={card} 
                      onClick={(id, e) => {
                        if (isHandExpanded && isCardPlayable) {
                          e?.stopPropagation();
                          onCardClick(card.id, card);
                        }
                      }} 
                      isPlayable={isHandExpanded && isCardPlayable} 
                      isDisabled={isHandExpanded && !isCardPlayable}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {drawnCard && (
          <motion.div
            className={`absolute z-50 ${pendingTargetDecision ? '' : 'pointer-events-none'}`}
            initial={{ top: '50%', left: '25%', x: '-50%', y: '-50%', scale: 0.5, rotate: -15 }}
            animate={{ top: '50%', left: '50%', x: '-50%', y: '-50%', scale: 1.5, rotate: 0 }}
            exit={{ 
              top: activePlayerIndex === playerIndex ? '85%' : '15%', 
              left: '50%', 
              x: '-50%', 
              y: '-50%', 
              scale: 1, 
              opacity: 0 
            }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <div className="flex flex-col items-center gap-4">
              <Card card={drawnCard} isHidden={activePlayerIndex !== playerIndex} />
              {pendingTargetDecision && activePlayerIndex === playerIndex && (
                <div className="flex gap-2 p-2 rounded-lg border-2 border-[var(--theme-700)] shadow-xl" style={{ backgroundColor: 'var(--theme-900)' }}>
                  <button 
                    onClick={() => {
                      playSound('play');
                      if (isPvP) {
                        sendAction({ type: 'addDrawnCardToTarget' });
                      } else {
                        setGameState(addDrawnCardToTarget(gameState));
                      }
                    }}
                    className="px-4 py-2 bg-theme-600 rounded hover:bg-theme-500 text-sm font-bold"
                  >
                    Add to Target
                  </button>
                  <button 
                    onClick={() => {
                      playSound('draw');
                      if (isPvP) {
                        sendAction({ type: 'addDrawnCardToHand' });
                      } else {
                        setGameState(addDrawnCardToHand(gameState));
                      }
                    }}
                    className="px-4 py-2 bg-theme-600 rounded hover:bg-theme-500 text-sm font-bold"
                  >
                    Keep in Hand
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Controls */}
      <div className="absolute bottom-4 left-4 flex flex-col items-start gap-4 z-40">
        {/* Premium Left Menu */}
        <AnimatePresence>
          {isPremium && (
            <div className="flex flex-col items-start gap-3">
              <AnimatePresence>
                {isLeftMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="flex flex-col items-start gap-3"
                  >
                    {/* Color Picker Button */}
                    <div className="relative">
                      <button
                        onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                        className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 text-white hover:scale-110 transition-transform z-50 relative"
                        title="Change Theme"
                      >
                        <Palette size={20} />
                      </button>
                      
                      <AnimatePresence>
                        {isColorPickerOpen && (
                          <motion.div 
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 z-40"
                          >
                            {['teal-gray', 'blue', 'red', 'emerald', 'purple', 'orange', 'pink', 'cyan'].map((color, index) => {
                              const totalColors = 8;
                              // Static arc from -110 to 20 degrees (130 degree span)
                              // This ensures all items are visible and clickable
                              const startAngle = -110;
                              const endAngle = 20;
                              const span = endAngle - startAngle;
                              const angle = startAngle + (index * span) / (totalColors - 1);
                              
                              return (
                                <ColorButton 
                                  key={color}
                                  color={color}
                                  index={index}
                                  angle={angle}
                                  themeColor={themeColor}
                                  setThemeColor={setThemeColor}
                                  isPremium={isPremium}
                                />
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Special Cards Game Button */}
                    <div className="relative">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-0 bg-purple-500 rounded-full blur-md"
                      />
                      <button 
                        onClick={() => {
                          if (isPremium) playSound('play');
                          setIsGameModeModalOpen(true);
                          setIsLeftMenuOpen(false);
                        }}
                        className="relative w-12 h-12 rounded-full shadow-lg flex items-center justify-center bg-purple-600 hover:bg-purple-500 text-white hover:scale-110 transition-transform border-2 border-purple-400 z-10"
                        title="Special Cards Game"
                      >
                        <Gamepad2 size={24} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={() => setIsLeftMenuOpen(!isLeftMenuOpen)}
                className="w-14 h-14 border-2 border-theme-500 rounded-full flex items-center justify-center text-white hover:bg-theme-600 transition-colors shadow-xl"
                style={{ backgroundColor: 'var(--theme-800)' }}
              >
                <motion.div animate={{ rotate: isLeftMenuOpen ? 180 : 0 }}>
                  <ChevronUp size={24} />
                </motion.div>
              </button>
            </div>
          )}
        </AnimatePresence>

        {/* Free User Special Game Button */}
        {!isPremium && (
          <div className="relative">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full blur-md"
              style={{ background: 'linear-gradient(135deg, #a855f7, #1e3a8a)' }}
            />
            <button 
              onClick={() => {
                playSound('play');
                setShowSpecialGameModal(true);
              }}
              className="relative w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white hover:scale-110 transition-transform border-2 border-purple-300/50 z-10"
              style={{ background: 'linear-gradient(135deg, #c084fc, #1e3a8a)' }}
              title="Special Cards Game"
            >
              <Gamepad2 size={28} />
            </button>
          </div>
        )}

        {/* Strategic Mode Toggle */}
        <div className="relative">
          <AnimatePresence>
            {floatingModeText && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: -10 }}
                exit={{ opacity: 0 }}
                className="absolute -top-8 left-0 whitespace-nowrap bg-black/80 text-white text-xs px-2 py-1 rounded pointer-events-none"
              >
                {floatingModeText}
              </motion.div>
            )}
          </AnimatePresence>
          
          <button 
            onClick={() => {
              const newMode = !gameState.isStrategicMode;
              if (isPvP) {
                if (window.confirm("Changing the game mode will disconnect you from your current opponent. Do you want to proceed?")) {
                  disconnectPvP();
                  setGameState(initGame(newMode, gameState.gameMode));
                  startMatchmaking(newMode, gameState.gameMode);
                } else {
                  return; // Cancel the toggle
                }
              } else {
                setGameState(initGame(newMode, gameState.gameMode));
              }
              
              setFloatingModeText(newMode ? "Strategic Mode" : "Mandatory Play Mode");
              setTimeout(() => setFloatingModeText(null), 3000);
            }}
            className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out shadow-inner ${gameState.isStrategicMode ? 'bg-theme-500' : 'bg-[var(--theme-800)]'}`}
          >
            <motion.div 
              className="w-4 h-4 bg-white rounded-full shadow-md"
              animate={{ x: gameState.isStrategicMode ? 24 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </div>

      {/* Floating Action Menu */}
      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-3 z-40">
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex flex-col items-end gap-3"
            >
              <div className="relative">
                {!isPremium && (
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 bg-blue-500 rounded-full blur-md"
                  />
                )}
                <button 
                  onClick={() => {
                    setShowPremiumModal(true);
                    setIsMenuOpen(false);
                  }}
                  className={`relative w-12 h-12 border-2 rounded-full flex items-center justify-center transition-all shadow-lg z-10 hover:scale-110 ${isPremium ? 'border-yellow-300' : 'border-yellow-500/50'}`}
                  style={{ background: 'linear-gradient(135deg, #facc15 0%, #eab308 50%, #14b8a6 85%, #4c1d95 100%)' }}
                  title="Get Premium"
                >
                  <Star size={20} className="fill-current text-white drop-shadow-sm" />
                </button>
              </div>

              <button 
                onClick={() => {
                  setShowGuide(true);
                  setIsMenuOpen(false);
                }}
                className="w-12 h-12 border border-theme-700 rounded-full flex items-center justify-center text-white hover:scale-110 transition-all shadow-lg"
                style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 40%, #1e3a8a 100%)' }}
                title="How to Play"
              >
                <BookOpen size={20} />
              </button>
              
              <button 
                onClick={() => {
                  if (isPvP) {
                    if (window.confirm("Disconnect from current game?")) {
                      disconnectPvP();
                    }
                  } else {
                    startMatchmaking(gameState.isStrategicMode, gameState.gameMode);
                  }
                  setIsMenuOpen(false);
                }}
                className="w-12 h-12 border border-theme-700 rounded-full flex items-center justify-center text-white hover:scale-110 transition-all shadow-lg"
                style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 40%, #1e3a8a 100%)' }}
                title={isPvP ? 'Disconnect' : 'Play vs Real User'}
              >
                {isPvP ? <Users size={20} /> : <User size={20} />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="w-14 h-14 border-2 border-yellow-300 rounded-full flex items-center justify-center text-white hover:scale-105 transition-all shadow-xl"
          style={{ background: 'linear-gradient(135deg, #facc15 0%, #eab308 50%, #14b8a6 85%, #4c1d95 100%)' }}
        >
          <motion.div animate={{ rotate: isMenuOpen ? 180 : 0 }}>
            <Star size={24} className="text-white fill-current drop-shadow-md" />
          </motion.div>
        </button>
      </div>

      {/* Guide Modal */}
      <AnimatePresence>
        {showGuide && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="border-2 border-[var(--theme-700)] rounded-xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl"
              style={{ backgroundColor: 'var(--theme-900)' }}
            >
              <div className="flex justify-between items-center mb-6 sticky top-0 pb-2 z-10 border-b border-[var(--theme-800)]" style={{ backgroundColor: 'var(--theme-900)' }}>
                <h2 className="text-2xl font-bold text-white">How to Play</h2>
                <button onClick={() => setShowGuide(false)} className="text-theme-400 hover:text-white p-1 rounded-full" style={{ backgroundColor: 'var(--theme-800)' }}>
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-6 text-sm text-theme-300">
                <section>
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-theme-500 flex items-center justify-center text-xs text-white">1</div>
                    The Goal & Turns
                  </h3>
                  <p>Reach the exact target number shown in the center bubble.</p>
                  <p className="mt-2">On your turn, you must draw a card. Then you can play up to 2 cards.</p>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs text-white">i</div>
                    Game Modes
                  </h3>
                  <div className="space-y-4">
                    <div className="bg-theme-800/50 p-3 rounded-lg border border-theme-700">
                      <h4 className="font-bold text-theme-200 mb-1">Mandatory Mode (Standard)</h4>
                      <p className="text-xs text-theme-300">
                        You <strong>MUST</strong> play at least one card if you have a valid move available. You cannot skip your turn if you are able to play. You can play up to 2 cards maximum.
                      </p>
                    </div>
                    
                    <div className="bg-theme-800/50 p-3 rounded-lg border border-theme-700">
                      <h4 className="font-bold text-theme-200 mb-1">Strategic Mode</h4>
                      <p className="text-xs text-theme-300">
                        Playing cards is <strong>optional</strong>. You can choose to play 0, 1, or 2 cards on your turn. You can end your turn without playing any cards to save them for later, even if you have valid moves.
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-theme-500 flex items-center justify-center text-xs text-white">2</div>
                    The 1-2-3 Cycle
                  </h3>
                  <p>A player must play only <strong>ones, twos, and threes</strong> to their row, and they must add <strong>at least one of each</strong> before they can play a card from 4 to 9.</p>
                  
                  <div className="p-3 rounded-lg mt-2 border border-[var(--theme-700)]" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-900) 50%, transparent)' }}>
                    <p className="text-xs text-theme-400 mb-2">Example of unlocking a high card:</p>
                    <div className="flex gap-2 items-center">
                      <div className="w-8 h-10 border border-[var(--theme-700)] rounded text-white font-bold flex items-center justify-center shadow-sm" style={{ backgroundColor: 'var(--theme-900)' }}>2</div>
                      <span className="text-theme-500">→</span>
                      <div className="w-8 h-10 border border-[var(--theme-700)] rounded text-white font-bold flex items-center justify-center shadow-sm" style={{ backgroundColor: 'var(--theme-900)' }}>1</div>
                      <span className="text-theme-500">→</span>
                      <div className="w-8 h-10 border border-[var(--theme-700)] rounded text-white font-bold flex items-center justify-center shadow-sm" style={{ backgroundColor: 'var(--theme-900)' }}>3</div>
                      <span className="text-green-400 font-bold ml-2">Unlocked!</span>
                    </div>
                  </div>

                  <p className="mt-3"><strong>No Consecutive Duplicates:</strong> You cannot play the same number twice in a row. You can alternate (e.g., 1-2-1-2).</p>
                  
                  <div className="p-3 rounded-lg mt-2 border border-[var(--theme-700)]" style={{ backgroundColor: 'color-mix(in srgb, var(--theme-900) 50%, transparent)' }}>
                    <div className="flex flex-col gap-4">
                      <div>
                        <p className="text-xs text-red-400 mb-1 font-bold">Invalid (Consecutive Duplicates):</p>
                        <div className="flex gap-1">
                          <div className="w-6 h-8 border border-[var(--theme-700)] rounded text-white font-bold flex items-center justify-center text-xs" style={{ backgroundColor: 'var(--theme-900)' }}>1</div>
                          <div className="w-6 h-8 bg-red-900 rounded text-red-200 font-bold flex items-center justify-center text-xs border border-red-500">1</div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-green-400 mb-1 font-bold">Valid Example 1:</p>
                        <div className="flex flex-wrap gap-1">
                          {[1,2,1,2,3,2,3,2,3,1,3,1,3,1,3,1].map((num, i) => (
                            <div key={i} className="w-6 h-8 border border-[var(--theme-700)] rounded text-white font-bold flex items-center justify-center text-xs shadow-sm" style={{ backgroundColor: 'var(--theme-900)' }}>{num}</div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-green-400 mb-1 font-bold">Valid Example 2:</p>
                        <div className="flex flex-wrap gap-1">
                          {[2,1,2,1,2,1,3,2,3,2,3,2].map((num, i) => (
                            <div key={i} className="w-6 h-8 border border-[var(--theme-700)] rounded text-white font-bold flex items-center justify-center text-xs shadow-sm" style={{ backgroundColor: 'var(--theme-900)' }}>{num}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-amber-300/90 text-xs bg-amber-900/20 p-2 rounded border border-amber-700/30">
                    <strong>Note:</strong> Once you play a high card, you must repeat the cycle and play at least one of each of the 1, 2, and 3 before you can add another high card.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-theme-500 flex items-center justify-center text-xs text-white">3</div>
                    The 4-5-6 Target Rule
                  </h3>
                  <p>When you draw a <strong>4, 5, or 6</strong>, you must decide <strong>immediately</strong> if you want to add it to the main target number or keep it in your hand.</p>
                  
                  <div className="bg-theme-900/30 p-3 rounded-lg mt-3 border border-theme-700/50">
                    <p className="text-sm text-theme-300 font-bold flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                      Limit Lifted!
                    </p>
                    <p className="text-xs mt-1 text-theme-100">If you add a 4, 5, or 6 to the target number, your opponent's play limit is lifted for their next turn. They can play as many eligible cards as they want, surpassing the 2-card limit!</p>
                  </div>
                </section>
                
                {isPremium && (
                  <section>
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-xs text-white">4</div>
                      Special Cards (Premium)
                    </h3>
                    <div className="space-y-3">
                      <div className="flex gap-3 items-start">
                        <div className="w-10 h-14 border-2 border-yellow-500 rounded flex items-center justify-center bg-gradient-to-br from-yellow-400 to-yellow-600 text-white font-bold text-lg shadow-sm flex-shrink-0">?</div>
                        <div>
                          <p className="font-bold text-yellow-400">Golden Card</p>
                          <p className="text-xs">Can be played as ANY number (1-9). Does not require completing the 1-2-3 cycle.</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <div className="w-10 h-14 border-2 border-purple-500 rounded flex items-center justify-center bg-[var(--theme-900)] text-white font-bold text-lg shadow-sm flex-shrink-0 relative">
                          1
                          <span className="absolute bottom-0.5 right-0.5 text-[8px] text-purple-400">∞</span>
                        </div>
                        <div>
                          <p className="font-bold text-purple-400">Permanent Card</p>
                          <p className="text-xs">Stays in your hand after playing! Can be played multiple times (but not consecutively).</p>
                        </div>
                      </div>
                      <div className="flex gap-3 items-start">
                        <div className="w-10 h-14 border-2 border-blue-400 rounded flex flex-col items-center justify-center bg-[var(--theme-900)] text-white font-bold text-xs shadow-sm flex-shrink-0 leading-tight">
                          <span>1</span><span>2</span><span>1</span>
                        </div>
                        <div>
                          <p className="font-bold text-blue-400">Sequence Card</p>
                          <p className="text-xs">Adds multiple numbers at once! Great for quick cycle completion.</p>
                        </div>
                      </div>
                    </div>
                  </section>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-theme-700 text-center">
                <p className="text-sm text-theme-300 mb-3">
                  Created by <span className="font-bold text-white">Frederick Wisseh</span>
                </p>
                <a 
                  href="https://www.paypal.com/donate/?hosted_button_id=ZEBDDY584FA24" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block w-full py-2 bg-theme-600 hover:bg-theme-500 text-white font-bold rounded-lg transition-colors shadow-lg mb-2"
                >
                  Donate to Creator
                </a>
              </div>

              <button 
                onClick={() => setShowGuide(false)}
                className="w-full py-3 bg-theme-600 hover:bg-theme-500 text-white font-bold rounded-lg transition-colors shadow-lg"
              >
                Got it!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Mode Modal */}
      <AnimatePresence>
        {isGameModeModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="border-2 border-[var(--theme-700)] rounded-xl max-w-4xl w-full shadow-2xl bg-[var(--theme-900)] max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex justify-between items-center p-4 md:p-6 border-b border-[var(--theme-700)] shrink-0">
                <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="text-purple-400" /> Select Game Mode
                </h2>
                <button onClick={() => setIsGameModeModalOpen(false)} className="text-theme-400 hover:text-white p-1 rounded-full bg-[var(--theme-800)] shrink-0">
                  <X size={24} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-4 md:p-6 overflow-y-auto">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Special Mode */}
                  <div 
                    onClick={() => {
                      if (isPremium) {
                        setGameState(initGame(gameState.isStrategicMode, 'special'));
                        setIsGameModeModalOpen(false);
                      } else {
                        setIsGameModeModalOpen(false);
                        setShowSpecialGameModal(true);
                      }
                    }}
                    className={`cursor-pointer group relative overflow-hidden rounded-xl border-2 p-6 transition-all duration-300 hover:scale-[1.02] flex flex-col ${gameMode === 'special' ? 'border-purple-500 bg-purple-900/20 ring-2 ring-purple-500/50' : 'border-[var(--theme-700)] bg-[var(--theme-800)] hover:border-purple-400'}`}
                  >
                    <div className="absolute top-0 right-0 p-2 bg-purple-600 text-white text-xs font-bold rounded-bl-lg flex items-center gap-1">
                      <Sparkles size={12} /> PREMIUM
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Special Cards Mode</h3>
                    <p className="text-sm text-theme-300 mb-4">Unleash chaos with powerful new cards! Break the rules and dominate.</p>
                    
                    <div className="flex justify-center gap-2 mb-4 opacity-80 group-hover:opacity-100 transition-opacity">
                      {/* Golden Card Preview */}
                      <div className="w-10 h-14 border-2 border-yellow-500 rounded flex items-center justify-center bg-gradient-to-br from-yellow-400 to-yellow-600 text-white font-bold shadow-sm">?</div>
                      {/* Permanent Card Preview */}
                      <div className="w-10 h-14 border-2 border-purple-500 rounded flex items-center justify-center bg-[var(--theme-900)] text-white font-bold shadow-sm relative">
                        1<span className="absolute bottom-0 right-0 text-[8px] text-purple-400 p-0.5">∞</span>
                      </div>
                      {/* Sequence Card Preview */}
                      <div className="w-10 h-14 border-2 border-blue-400 rounded flex flex-col items-center justify-center bg-[var(--theme-900)] text-white font-bold text-[8px] shadow-sm leading-tight">
                        <span>1</span><span>2</span><span>3</span>
                      </div>
                    </div>

                    <ul className="text-xs text-theme-400 space-y-1 list-disc list-inside mb-4">
                      <li><span className="text-yellow-400 font-bold">Golden Cards:</span> Choose any value (1-9)!</li>
                      <li><span className="text-purple-400 font-bold">Permanent Cards:</span> Reusable cards!</li>
                      <li><span className="text-blue-400 font-bold">Sequence Cards:</span> Play multiple numbers!</li>
                    </ul>

                    <div className="mt-auto">
                      <button className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors shadow-lg">
                        Play Special Cards
                      </button>
                    </div>
                  </div>

                  {/* Normal Mode */}
                  <div 
                    onClick={() => {
                      setGameState(initGame(gameState.isStrategicMode, 'normal'));
                      setIsGameModeModalOpen(false);
                    }}
                    className={`cursor-pointer group relative overflow-hidden rounded-xl border-2 p-6 transition-all duration-300 hover:scale-[1.02] flex flex-col ${gameMode === 'normal' ? 'border-theme-500 bg-theme-900/50 ring-2 ring-theme-500/50' : 'border-[var(--theme-700)] bg-[var(--theme-800)] hover:border-theme-400'}`}
                  >
                    <div className="absolute top-0 right-0 p-2 bg-theme-600 text-white text-xs font-bold rounded-bl-lg">CLASSIC</div>
                    <h3 className="text-xl font-bold text-white mb-2">Normal Mode</h3>
                    <p className="text-sm text-theme-300 mb-4">The classic strategic experience. Master the 1-2-3 cycle and use high cards wisely.</p>
                    
                    <div className="flex justify-center gap-2 mb-4 opacity-80 group-hover:opacity-100 transition-opacity">
                      <div className="w-10 h-14 bg-theme-800 border border-theme-600 rounded flex items-center justify-center text-white font-bold">1</div>
                      <div className="w-10 h-14 bg-theme-800 border border-theme-600 rounded flex items-center justify-center text-white font-bold">2</div>
                      <div className="w-10 h-14 bg-theme-800 border border-theme-600 rounded flex items-center justify-center text-white font-bold">3</div>
                    </div>
                    
                    <ul className="text-xs text-theme-400 space-y-1 list-disc list-inside mb-4">
                      <li>Standard 1-2-3 Cycle Rules</li>
                      <li>4-5-6 Target Decisions</li>
                      <li>Strategic or Mandatory Play</li>
                    </ul>

                    <div className="mt-auto">
                      <button className="w-full py-2 bg-[var(--theme-600)] hover:bg-[var(--theme-500)] text-white font-bold rounded-lg transition-colors shadow-lg">
                        Play Normal Mode
                      </button>
                    </div>
                  </div>
                </div>

                {/* Detailed Card Descriptions */}
                <div className="mt-8 border-t border-[var(--theme-700)] pt-6">
                  <h3 className="text-lg font-bold text-white mb-4">Special Card Details</h3>
                  <div className="grid gap-4">
                    <div className="flex gap-4 items-start bg-black/20 p-3 rounded-lg border border-[var(--theme-700)]">
                      <div className="w-16 h-24 border-2 border-yellow-500 rounded-lg flex items-center justify-center bg-gradient-to-br from-yellow-400 to-yellow-600 text-white font-bold text-3xl shadow-lg flex-shrink-0">?</div>
                      <div>
                        <h4 className="font-bold text-yellow-400 text-lg">Golden Card</h4>
                        <p className="text-sm text-theme-200">The ultimate wild card. When played, you choose its value from 1 to 9. It bypasses the 1-2-3 cycle requirement, allowing you to play high numbers instantly or fill a specific gap in your strategy.</p>
                      </div>
                    </div>

                    <div className="flex gap-4 items-start bg-black/20 p-3 rounded-lg border border-[var(--theme-700)]">
                      <div className="w-16 h-24 border-2 border-purple-500 rounded-lg flex items-center justify-center bg-[var(--theme-900)] text-white font-bold text-3xl shadow-lg flex-shrink-0 relative">
                        2
                        <span className="absolute bottom-1 right-1 text-sm text-purple-400">∞</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-purple-400 text-lg">Permanent Card</h4>
                        <p className="text-sm text-theme-200">A card that never leaves your hand! Once played, a copy is added to your row, but the original stays with you. Use it to reliably complete cycles or increment your score turn after turn.</p>
                      </div>
                    </div>

                    <div className="flex gap-4 items-start bg-black/20 p-3 rounded-lg border border-[var(--theme-700)]">
                      <div className="w-16 h-24 border-2 border-blue-400 rounded-lg flex flex-col items-center justify-center bg-[var(--theme-900)] text-white font-bold text-sm shadow-lg flex-shrink-0 leading-tight gap-1">
                        <span>1</span><span>2</span><span>3</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-blue-400 text-lg">Sequence Card</h4>
                        <p className="text-sm text-theme-200">Efficiency in a single card. Playing this adds a predefined sequence (e.g., 1-2-3) to your row immediately. Perfect for instantly unlocking high cards or making a big score jump in one move.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 md:p-6 border-t border-[var(--theme-700)] shrink-0 bg-[var(--theme-900)]">
                <button 
                  onClick={() => setIsGameModeModalOpen(false)}
                  className="w-full py-3 bg-[var(--theme-700)] hover:bg-[var(--theme-600)] text-white font-bold rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Golden Card Modal */}
      <AnimatePresence>
        {isGoldenCardModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          >
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="border-2 border-yellow-500 rounded-xl p-6 max-w-lg w-full shadow-2xl bg-[var(--theme-900)] overflow-y-auto max-h-[90vh] relative"
            >
              <button 
                onClick={() => {
                  setIsGoldenCardModalOpen(false);
                  setSelectedGoldenCardId(null);
                }}
                className="absolute top-4 right-4 text-yellow-500 hover:text-white bg-black/20 hover:bg-black/40 rounded-full p-2 transition-colors z-20"
              >
                <X size={20} />
              </button>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-300 animate-pulse"></div>
              
              <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 mb-2 text-center drop-shadow-sm">Golden Card</h2>
              <p className="text-yellow-100 text-center mb-8 text-sm">Slide to choose your destiny!</p>
              
              <div className="relative h-40 flex items-center justify-center mb-8 perspective-1000">
                {/* Selection Highlight */}
                {goldenCardValue !== null && (
                  <div className="absolute w-20 h-28 border-4 border-yellow-400 rounded-lg z-10 shadow-[0_0_20px_rgba(250,204,21,0.6)] pointer-events-none"></div>
                )}
                
                <div className="flex items-center gap-4 overflow-x-auto px-32 py-4 no-scrollbar snap-x snap-mandatory w-full" 
                     style={{ scrollBehavior: 'smooth' }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                    const isSelected = goldenCardValue === num;
                    return (
                      <motion.button
                        key={num}
                        onClick={() => setGoldenCardValue(num)}
                        animate={{ 
                          scale: isSelected ? 1.2 : 0.8,
                          opacity: isSelected ? 1 : 0.5,
                          y: isSelected ? 0 : 10,
                          rotateY: isSelected ? 0 : 20
                        }}
                        className={`flex-shrink-0 w-16 h-24 rounded-lg flex items-center justify-center text-3xl font-bold shadow-lg transition-colors snap-center ${isSelected ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white border-2 border-white' : 'bg-[var(--theme-800)] text-theme-400 border border-[var(--theme-700)]'}`}
                      >
                        {num}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setIsGoldenCardModalOpen(false);
                    setSelectedGoldenCardId(null);
                  }}
                  className="flex-1 py-3 bg-[var(--theme-800)] hover:bg-[var(--theme-700)] text-theme-300 font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  disabled={goldenCardValue === null}
                  onClick={() => {
                    if (selectedGoldenCardId && goldenCardValue !== null) {
                      handlePlayCard(selectedGoldenCardId, goldenCardValue);
                      setIsGoldenCardModalOpen(false);
                      setSelectedGoldenCardId(null);
                      playSound('play');
                    }
                  }}
                  className={`flex-1 py-3 font-bold rounded-lg shadow-lg transform transition-all ${goldenCardValue === null ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-white hover:scale-105'}`}
                >
                  {goldenCardValue === null ? 'Select a Number' : `Play ${goldenCardValue}`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfile && <Profile onClose={() => setShowProfile(false)} />}
      </AnimatePresence>

      {/* Login Modal */}
      <AnimatePresence>
        {showLogin && <Login onClose={() => setShowLogin(false)} />}
      </AnimatePresence>

      {/* Premium Modal */}
      <AnimatePresence>
        {showPremiumModal && <PremiumModal onClose={() => setShowPremiumModal(false)} />}
      </AnimatePresence>

      {/* Special Game Modal */}
      <SpecialGameModal 
        isOpen={showSpecialGameModal}
        onClose={() => setShowSpecialGameModal(false)}
        onGetPremium={() => {
          setShowSpecialGameModal(false);
          setShowPremiumModal(true);
        }}
        specialGamesPlayedThisWeek={userProfile ? (userProfile.specialGamesPlayedThisWeek || 0) : localSpecialGamesPlayed}
        onPlay={() => {
          const gamesPlayed = userProfile ? (userProfile.specialGamesPlayedThisWeek || 0) : localSpecialGamesPlayed;
          if (gamesPlayed < 2) {
            if (userProfile) {
              updateProfile({ specialGamesPlayedThisWeek: gamesPlayed + 1 });
            } else {
              const newPlayed = gamesPlayed + 1;
              setLocalSpecialGamesPlayed(newPlayed);
              const storedData = localStorage.getItem('specialGamesTracking');
              const resetDate = storedData ? JSON.parse(storedData).resetDate : Date.now();
              localStorage.setItem('specialGamesTracking', JSON.stringify({ played: newPlayed, resetDate }));
            }
            setShowSpecialGameModal(false);
            
            if (isPvP) {
              if (window.confirm("Changing the game mode will disconnect you from your current opponent. Do you want to proceed?")) {
                disconnectPvP();
                setGameState(initGame(gameState.isStrategicMode, 'special'));
                setFloatingModeText("Special Cards Mode Enabled");
                setTimeout(() => setFloatingModeText(null), 2000);
              }
            } else {
              setGameState(initGame(gameState.isStrategicMode, 'special'));
              setFloatingModeText("Special Cards Mode Enabled");
              setTimeout(() => setFloatingModeText(null), 2000);
            }
          }
        }}
      />
    </div>
  );
};

export default Game;