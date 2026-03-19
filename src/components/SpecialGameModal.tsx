import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gamepad2, Star, RefreshCw } from 'lucide-react';

interface SpecialGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlay: () => void;
  onGetPremium: () => void;
  specialGamesPlayedThisWeek: number;
}

const SpecialGameModal: React.FC<SpecialGameModalProps> = ({ isOpen, onClose, onPlay, onGetPremium, specialGamesPlayedThisWeek }) => {
  const gamesLeft = Math.max(0, 2 - specialGamesPlayedThisWeek);
  const canPlay = gamesLeft > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full border border-purple-500/30 overflow-hidden relative max-h-[90vh] flex flex-col"
          >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-amber-900 p-6 relative flex-shrink-0">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors bg-black/20 rounded-full p-1"
            >
              <X size={24} />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-purple-600 flex items-center justify-center shadow-lg transform -rotate-6">
                <Gamepad2 size={32} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-purple-200">
                  Special Cards Game
                </h2>
                <p className="text-purple-200/80 text-sm font-medium">Experience the ultimate strategic showdown!</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 pb-40 overflow-y-auto flex-grow custom-scrollbar">
            <div className="space-y-6">
              <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <Star className="text-amber-400" size={20} />
                  What is the Special Cards Game?
                </h3>
                <p className="text-slate-300 leading-relaxed">
                  Take your gameplay to the next level! In this mode, you'll unlock powerful special cards that can completely change the tide of battle. Use them wisely to outsmart your opponent and secure victory.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-4 px-2">Meet the Special Cards</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-amber-900/40 to-slate-800 p-4 rounded-xl border border-amber-500/20 flex gap-4 items-start">
                    <div className="w-12 h-16 bg-gradient-to-br from-amber-300 to-amber-600 rounded shadow-md flex items-center justify-center flex-shrink-0 border border-amber-200">
                      <Star className="text-white drop-shadow-md" size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-300">Golden Card</h4>
                      <p className="text-sm text-slate-300 mt-1">Choose its value from 1 to 9. The ultimate wild card!</p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-900/40 to-slate-800 p-4 rounded-xl border border-purple-500/20 flex gap-4 items-start">
                    <div className="w-12 h-16 bg-gradient-to-br from-purple-400 to-purple-700 rounded shadow-md flex items-center justify-center flex-shrink-0 border border-purple-300 relative">
                      <span className="text-white font-bold text-xl drop-shadow-md">1</span>
                      <span className="absolute bottom-1 right-1 text-[10px] text-white font-bold">∞</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-purple-300">Permanent Cards</h4>
                      <p className="text-sm text-slate-300 mt-1">Reusable 1s, 2s, and 3s that stay in your hand after being played.</p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-900/40 to-slate-800 p-4 rounded-xl border border-blue-500/20 flex gap-4 items-start md:col-span-2">
                    <div className="w-12 h-16 bg-gradient-to-br from-blue-400 to-blue-700 rounded shadow-md flex flex-col items-center justify-center flex-shrink-0 border border-blue-300">
                      <span className="text-white font-bold text-[10px] leading-none">1</span>
                      <span className="text-white font-bold text-[10px] leading-none my-0.5">2</span>
                      <span className="text-white font-bold text-[10px] leading-none">3</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-blue-300">Sequence Cards</h4>
                      <p className="text-sm text-slate-300 mt-1">Play multiple numbers at once! Includes sequences like 1-2-1, 3-2-1, 1-2-3, and more to rapidly build your score.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent flex-shrink-0 z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-3 pointer-events-auto w-full max-w-sm mx-auto">
              
              {/* Top Row: Info & Premium */}
              <div className="flex gap-3 w-full">
                <div className="flex-1 bg-slate-800/80 px-2 py-2 rounded-[10px] border border-slate-700 flex flex-col items-center justify-center text-center shadow-lg">
                  <div className="flex items-center gap-1 mb-0.5">
                    <RefreshCw size={12} className="text-amber-400" />
                    <span className="text-[10px] text-slate-300 leading-tight">
                      <strong className="text-white">2 free plays</strong> / week
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-400 font-bold leading-tight">{gamesLeft} plays remaining</span>
                </div>

                <button
                  onClick={onGetPremium}
                  className="flex-1 py-2 px-2 rounded-[10px] text-xs font-bold text-white bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 transition-all shadow-md flex flex-col items-center justify-center gap-1 opacity-75 hover:opacity-100 active:opacity-100"
                >
                  <div className="flex items-center gap-1">
                    <Star size={14} className="fill-current" />
                    <span>Get Premium</span>
                  </div>
                  <span className="text-[10px] font-normal opacity-90 leading-tight">Unlimited Plays</span>
                </button>
              </div>

              {/* Bottom Row: Exit & Play */}
              <div className="flex gap-3 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 py-2 px-4 rounded-[10px] text-sm font-bold text-white bg-slate-700 hover:bg-slate-600 transition-all shadow-md opacity-75 hover:opacity-100 active:opacity-100"
                >
                  Exit
                </button>
                <button
                  onClick={onPlay}
                  disabled={!canPlay}
                  className={`flex-1 py-2 px-4 rounded-[10px] text-sm font-bold text-white transition-all shadow-md opacity-75 hover:opacity-100 active:opacity-100 ${
                    canPlay 
                      ? 'bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 hover:scale-[1.02]' 
                      : 'bg-slate-700 cursor-not-allowed'
                  }`}
                >
                  {canPlay ? 'Play Free Game' : 'No Plays Left'}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SpecialGameModal;
