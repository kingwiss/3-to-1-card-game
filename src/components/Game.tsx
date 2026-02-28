import React, { useEffect, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { drawCard, playCard, initGame, playAITurn, addDrawnCardToHand, addDrawnCardToTarget, startNextRound, endTurn, findBestCardToPlay } from '../services/gameService';
import Card from './Card';
import { motion, AnimatePresence } from 'framer-motion';
import { playSound } from '../utils/sound';
import { ChevronUp, ChevronDown, Users, User, BookOpen } from 'lucide-react';

const Game: React.FC = () => {
  const { gameState, setGameState, sendAction, isPvP, setIsPvP, isWaiting, matchmakingStatus, playerIndex, startMatchmaking, cancelMatchmaking, disconnectPvP } = useGame();
  const [isHandExpanded, setIsHandExpanded] = useState(false);
  const [isPlayerRowExpanded, setIsPlayerRowExpanded] = useState(false);
  const [isOpponentRowExpanded, setIsOpponentRowExpanded] = useState(false);
  const [isOpponentHandExpanded, setIsOpponentHandExpanded] = useState(false);
  const [isTargetExpanded, setIsTargetExpanded] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [floatingModeText, setFloatingModeText] = useState<string | null>(null);
  
  const { players, targetNumber, targetLineup, status, winnerId, activePlayerIndex, deck, hasDrawnCardThisTurn, drawnCard, round, pendingTargetDecision } = gameState;
  
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

  const handlePlayCard = (cardId: string) => {
    if (status === 'playing' && activePlayerIndex === playerIndex && hasDrawnCardThisTurn && !drawnCard) {
      playSound('play');
      if (isPvP) {
        sendAction({ type: 'playCard', cardId });
      } else {
        const newGameState = playCard(gameState, cardId);
        setGameState(newGameState);
      }
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
      const timer = setTimeout(() => {
        playSound('opponent');
        setGameState(prevState => playAITurn(prevState));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activePlayerIndex, status, setGameState, isPvP]);

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
    }
  }, [hasDrawnCardThisTurn]);

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
    }
  }, [status, winnerId, player.id, player.persistentScore, opponent.persistentScore]);

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
           if (isPvP) {
             sendAction({ type: 'playCard', cardId: bestCard.id });
           } else {
             setGameState(prevState => playCard(prevState, bestCard.id));
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
        {matchmakingStatus && <p className="text-slate-400 mb-4 animate-pulse">{matchmakingStatus}</p>}
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-8"></div>
        <button 
          onClick={cancelMatchmaking}
          className="px-6 py-2 bg-slate-700 rounded-lg hover:bg-slate-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto h-[100dvh] flex flex-col items-center justify-between text-white p-1 font-sans relative overflow-hidden">
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
                  className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-500"
                >
                  Start a new game
                </button>
              </>
            )}
            {status === 'gameOver' && (
              <>
                <h2 className="text-4xl font-bold mb-2">Final Winner:</h2>
                <h3 className="text-6xl font-bold mb-4">{player.persistentScore > opponent.persistentScore ? 'You!' : 'Opponent'}</h3>
                <button onClick={handleRestart} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-500">Play Again</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Opponent Area */}
      <div className="w-full flex flex-col items-center gap-1">
        <div className="flex justify-between w-full px-4 items-center">
          <div className="text-base font-bold flex items-center gap-2">
            Opponent
            {opponent.cleanSlate && (
              <span className="text-[10px] bg-blue-500/80 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">Clean Slate</span>
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
            {opponent.limitLifted && <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full z-50">LIMIT LIFTED</div>}
          </div>
        </div>
      </div>

      {/* Center Area */}
      <div className="w-full flex items-center justify-between px-2">
        {/* Deck Area */}
        <div className="flex flex-col items-center gap-1">
          <button onClick={handleDrawCard} className="relative w-10 h-14 md:w-14 md:h-20" disabled={hasDrawnCardThisTurn || activePlayerIndex !== playerIndex}>
            <div className="absolute top-0 left-0 w-full h-full rounded-lg bg-slate-700 border-2 border-slate-500 transform -rotate-6"></div>
            <div className="absolute top-0 left-0 w-full h-full rounded-lg bg-slate-700 border-2 border-slate-500 transform rotate-6"></div>
            <div className="absolute top-0 left-0 w-full h-full rounded-lg bg-slate-800 border-2 border-slate-600 flex items-center justify-center text-sm md:text-base font-bold cursor-pointer text-center leading-tight">1 to 3</div>
          </button>
          <p className="text-xs font-semibold">{deck.length} left</p>
        </div>

        {/* Target */}
        <div className="flex flex-col items-center gap-2 relative flex-1 mx-2 min-w-0">
          <div className="relative w-28 h-28 flex items-center justify-center floating">
            {/* Bubble Background */}
            <div className="absolute inset-0 rounded-full bubble-container overflow-hidden z-0">
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
                  className={`w-6 h-8 bg-slate-700 rounded-sm flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300 ${targetLineup.length >= 7 && !isTargetExpanded ? '-ml-3 first:ml-0 shadow-[-2px_0_4px_rgba(0,0,0,0.5)]' : ''}`}
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
                className={`relative w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-500 ${isUnlocked ? 'bg-blue-500/40 text-white shadow-[0_0_15px_rgba(59,130,246,0.6),4px_4px_0px_rgba(0,0,0,0.4)]' : 'bg-slate-700/40 text-white shadow-[4px_4px_0px_rgba(0,0,0,0.4)]'}`}
              >
                {/* Radiating animation when unlocked */}
                {isUnlocked && (
                  <div className="absolute inset-0 rounded-full animate-ping bg-blue-400/40 z-0" style={{ animationDuration: '2s' }}></div>
                )}
                
                {/* Bubble Highlights */}
                <div className="absolute inset-0 rounded-full overflow-hidden z-0">
                  <div className="absolute top-1.5 left-2 w-3 h-1.5 bg-white/40 rounded-full transform -rotate-45 blur-[0.5px]"></div>
                  <div className="absolute bottom-1.5 right-2 w-2 h-1 bg-white/20 rounded-full transform -rotate-45 blur-[1px]"></div>
                </div>
                
                <span className="relative z-10">{num}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Player Area */}
      <div className="w-full flex flex-col items-center gap-1 pb-10">
        <div className="flex justify-between w-full px-4 items-center">
          <div className="text-base font-bold w-20 flex items-center gap-2">
            {isPvP ? `${player.name} (You)` : 'You'}
            {player.cleanSlate && (
              <span className="text-[10px] bg-blue-500/80 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">Clean Slate</span>
            )}
          </div>
          <div className="flex-1 flex justify-center">
            {activePlayerIndex === playerIndex && hasDrawnCardThisTurn && !drawnCard && gameState.isStrategicMode && (
              <button 
                onClick={handleEndTurn}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-500 rounded-full text-xs font-bold shadow-lg transition-colors animate-pulse"
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
            {player.limitLifted && <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full z-50">LIMIT LIFTED</div>}
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
                  isMyTurnToPlay &&
                  player.score + card.value <= targetNumber &&
                  !(player.row.length > 0 && player.row[player.row.length - 1].value === card.value) &&
                  !(card.value > 3 && !player.highCardsUnlocked);

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
                          handlePlayCard(card.id);
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
            exit={{ top: '85%', left: '50%', x: '-50%', y: '-50%', scale: 1, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <div className="flex flex-col items-center gap-4">
              <Card card={drawnCard} />
              {pendingTargetDecision && activePlayerIndex === playerIndex && (
                <div className="flex gap-2 bg-slate-800 p-2 rounded-lg border-2 border-slate-600 shadow-xl">
                  <button 
                    onClick={() => {
                      playSound('play');
                      if (isMultiplayer) {
                        sendAction({ type: 'addDrawnCardToTarget' });
                      } else {
                        setGameState(addDrawnCardToTarget(gameState));
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 text-sm font-bold"
                  >
                    Add to Target
                  </button>
                  <button 
                    onClick={() => {
                      playSound('draw');
                      if (isMultiplayer) {
                        sendAction({ type: 'addDrawnCardToHand' });
                      } else {
                        setGameState(addDrawnCardToHand(gameState));
                      }
                    }}
                    className="px-4 py-2 bg-slate-600 rounded hover:bg-slate-500 text-sm font-bold"
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
      {/* Strategic Mode Toggle */}
      <div className="absolute bottom-4 left-4 flex flex-col items-start z-40">
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
              sendAction({ type: 'toggleStrategicMode', isStrategicMode: newMode });
            } else {
              setGameState(initGame(newMode));
            }
            
            setFloatingModeText(newMode ? "Strategic Mode" : "Mandatory Play Mode");
            setTimeout(() => setFloatingModeText(null), 3000);
          }}
          className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out shadow-inner ${gameState.isStrategicMode ? 'bg-purple-600' : 'bg-slate-700'}`}
        >
          <motion.div 
            className="w-4 h-4 bg-white rounded-full shadow-md"
            animate={{ x: gameState.isStrategicMode ? 24 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
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
              <button 
                onClick={() => {
                  setShowGuide(true);
                  setIsMenuOpen(false);
                }}
                className="w-12 h-12 bg-slate-800 border border-slate-600 rounded-full flex items-center justify-center text-slate-300 hover:bg-slate-700 hover:text-white transition-colors shadow-lg"
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
                    startMatchmaking(gameState.isStrategicMode);
                  }
                  setIsMenuOpen(false);
                }}
                className={`w-12 h-12 border rounded-full flex items-center justify-center transition-colors shadow-lg ${isPvP ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                title={isPvP ? 'Disconnect' : 'Play vs Real User'}
              >
                {isPvP ? <Users size={20} /> : <User size={20} />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="w-14 h-14 bg-slate-700 border-2 border-slate-500 rounded-full flex items-center justify-center text-white hover:bg-slate-600 transition-colors shadow-xl"
        >
          <motion.div animate={{ rotate: isMenuOpen ? 180 : 0 }}>
            <ChevronUp size={24} />
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
              className="bg-slate-800 border-2 border-slate-600 rounded-xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6 sticky top-0 bg-slate-800 pb-2 z-10 border-b border-slate-700">
                <h2 className="text-2xl font-bold text-white">How to Play</h2>
                <button onClick={() => setShowGuide(false)} className="text-slate-400 hover:text-white bg-slate-700 p-1 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              
              <div className="space-y-6 text-sm text-slate-300">
                <section>
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs text-white">1</div>
                    The Goal & Turns
                  </h3>
                  <p>Reach the exact target number shown in the center bubble.</p>
                  <p className="mt-2">On your turn, you must draw a card. Then you can play up to 2 cards (or 0-2 in Strategic Mode).</p>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-xs text-white">2</div>
                    The 1-2-3 Cycle
                  </h3>
                  <p>A player must play only <strong>ones, twos, and threes</strong> to their row, and they must add <strong>at least one of each</strong> before they can play a card from 4 to 9.</p>
                  
                  <div className="bg-slate-900/50 p-3 rounded-lg mt-2 border border-slate-700">
                    <p className="text-xs text-slate-400 mb-2">Example of unlocking a high card:</p>
                    <div className="flex gap-2 items-center">
                      <div className="w-8 h-10 bg-white rounded text-black font-bold flex items-center justify-center shadow-sm">2</div>
                      <span className="text-slate-500">→</span>
                      <div className="w-8 h-10 bg-white rounded text-black font-bold flex items-center justify-center shadow-sm">1</div>
                      <span className="text-slate-500">→</span>
                      <div className="w-8 h-10 bg-white rounded text-black font-bold flex items-center justify-center shadow-sm">3</div>
                      <span className="text-green-400 font-bold ml-2">Unlocked!</span>
                    </div>
                  </div>

                  <p className="mt-3"><strong>No Consecutive Duplicates:</strong> You cannot play the same number twice in a row. You can alternate (e.g., 1-2-1-2).</p>
                  
                  <div className="bg-slate-900/50 p-3 rounded-lg mt-2 border border-slate-700">
                    <div className="flex flex-col gap-4">
                      <div>
                        <p className="text-xs text-red-400 mb-1 font-bold">Invalid (Consecutive Duplicates):</p>
                        <div className="flex gap-1">
                          <div className="w-6 h-8 bg-white rounded text-black font-bold flex items-center justify-center text-xs">1</div>
                          <div className="w-6 h-8 bg-red-200 rounded text-red-800 font-bold flex items-center justify-center text-xs border border-red-500">1</div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-green-400 mb-1 font-bold">Valid Example 1:</p>
                        <div className="flex flex-wrap gap-1">
                          {[1,2,1,2,3,2,3,2,3,1,3,1,3,1,3,1].map((num, i) => (
                            <div key={i} className="w-6 h-8 bg-white rounded text-black font-bold flex items-center justify-center text-xs shadow-sm">{num}</div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-green-400 mb-1 font-bold">Valid Example 2:</p>
                        <div className="flex flex-wrap gap-1">
                          {[2,1,2,1,2,1,3,2,3,2,3,2].map((num, i) => (
                            <div key={i} className="w-6 h-8 bg-white rounded text-black font-bold flex items-center justify-center text-xs shadow-sm">{num}</div>
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
                    <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-xs text-white">3</div>
                    The 4-5-6 Target Rule
                  </h3>
                  <p>When you draw a <strong>4, 5, or 6</strong>, you must decide <strong>immediately</strong> if you want to add it to the main target number or keep it in your hand.</p>
                  
                  <div className="bg-blue-900/30 p-3 rounded-lg mt-3 border border-blue-700/50">
                    <p className="text-sm text-blue-300 font-bold flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                      Limit Lifted!
                    </p>
                    <p className="text-xs mt-1 text-blue-100">If you add a 4, 5, or 6 to the target number, your opponent's play limit is lifted for their next turn. They can play as many eligible cards as they want, surpassing the 2-card limit!</p>
                  </div>
                </section>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-700 text-center">
                <p className="text-sm text-slate-300 mb-3">
                  Created by <span className="font-bold text-white">Frederick Wisseh</span>
                </p>
                <a 
                  href="https://www.paypal.com/donate/?hosted_button_id=ZEBDDY584FA24" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors shadow-lg mb-2"
                >
                  Donate to Creator
                </a>
              </div>

              <button 
                onClick={() => setShowGuide(false)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors shadow-lg"
              >
                Got it!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Game;