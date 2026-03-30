import React from 'react';
import { Card as CardType } from '../types';

interface CardProps {
  card: CardType;
  onClick?: (id: string, e?: React.MouseEvent) => void;
  onGambleChoice?: (id: string, choice: 'positive' | 'negative', e: React.MouseEvent) => void;
  isPlayable?: boolean;
  isHidden?: boolean;
  isDisabled?: boolean;
  themeColor?: string;
  isSubtracting?: boolean;
}

const Card: React.FC<CardProps> = ({ card, onClick, onGambleChoice, isPlayable = false, isHidden = false, isDisabled = false, themeColor = 'teal-gray', isSubtracting = false }) => {
  const baseClasses = 'w-10 h-14 md:w-14 md:h-20 rounded-lg shadow-lg transform transition-all duration-300 flex-shrink-0 overflow-hidden';
  const playableClasses = isPlayable ? 'cursor-pointer hover:scale-105' : 'cursor-default';
  const disabledClasses = isDisabled ? 'opacity-50 grayscale' : '';
  
  const getThemeGradient = (theme: string) => {
    switch (theme) {
      case 'slate': return 'linear-gradient(135deg, #94a3b8 0%, #475569 40%, #0f172a 100%)';
      case 'blue': return 'linear-gradient(135deg, #60a5fa 0%, #2563eb 40%, #1e3a8a 100%)';
      case 'red': return 'linear-gradient(135deg, #f87171 0%, #dc2626 40%, #450a0a 100%)';
      case 'emerald': return 'linear-gradient(135deg, #34d399 0%, #059669 40%, #022c22 100%)';
      case 'purple': return 'linear-gradient(135deg, #c084fc 0%, #9333ea 40%, #3b0764 100%)';
      case 'orange': return 'linear-gradient(135deg, #fb923c 0%, #ea580c 40%, #431407 100%)';
      case 'pink': return 'linear-gradient(135deg, #f472b6 0%, #db2777 40%, #4c0519 100%)';
      case 'cyan': return 'linear-gradient(135deg, #22d3ee 0%, #0891b2 40%, #083344 100%)';
      case 'teal-gray':
      default: return 'linear-gradient(135deg, #14b8a6 0%, #0f766e 40%, #1e3a8a 100%)';
    }
  };
  
  const themeGradient = getThemeGradient(themeColor);
  
  let bgClass = 'border-2 border-[var(--theme-700)]';
  let bgStyle = themeGradient;
  let content = <span className="absolute top-0.5 left-1.5 text-base md:text-lg font-bold text-white">{card.isNegative ? '-' : ''}{card.value}</span>;

  if (!isHidden) {
    if (card.type === 'golden') {
      bgClass = 'border-2 border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.6)]';
      // "Actual color gold" - using a rich metallic gradient
      bgStyle = 'linear-gradient(135deg, #FFD700 0%, #B8860B 40%, #FFD700 70%, #DAA520 100%)';
      content = (
        <div className="flex flex-col items-center justify-center w-full h-full">
          <span className="text-3xl font-extrabold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">{card.value ? `${card.isNegative ? '-' : ''}${card.value}` : '?'}</span>
          <div className="absolute inset-0 bg-white/20 animate-pulse rounded-lg"></div>
        </div>
      );
    } else if (card.type === 'permanent') {
      bgClass = 'border-2 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]';
      // Darker purple background for contrast
      bgStyle = 'linear-gradient(to bottom right, #2e1065, #581c87)';
      content = (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{card.isNegative ? '-' : ''}{card.permanentValue}</span>
          <div className="absolute -bottom-1 -right-1 text-2xl font-bold text-purple-300 drop-shadow-md">∞</div>
        </div>
      );
    } else if (card.type === 'sequence') {
      bgClass = 'border-2 border-blue-400';
      bgStyle = themeGradient;
      content = (
        <div className="flex flex-col items-center justify-center w-full h-full leading-tight text-white">
          {card.sequence?.map((val, idx) => (
            <span key={idx} className="text-xs md:text-sm font-bold">{card.isNegative ? '-' : ''}{val}</span>
          ))}
        </div>
      );
    } else if (card.type === 'gamble') {
      if (!card.isGambleRevealed) {
        bgClass = 'border-2 border-gray-400 shadow-[0_0_10px_rgba(156,163,175,0.4)]';
        bgStyle = 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)';
        content = (
          <div className="flex flex-row items-center justify-center gap-1 w-full h-full p-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onGambleChoice?.(card.id, 'positive', e); }}
              className="w-4 h-4 md:w-6 md:h-6 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white font-bold text-[10px] md:text-sm shadow-md transition-transform hover:scale-110"
              title={isSubtracting ? "Positive (Subtracts)" : "Positive"}
            >
              {isSubtracting ? '-' : '+'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onGambleChoice?.(card.id, 'negative', e); }}
              className="w-4 h-4 md:w-6 md:h-6 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white font-bold text-[10px] md:text-sm shadow-md transition-transform hover:scale-110"
              title={isSubtracting ? "Negative (Adds to Target)" : "Negative"}
            >
              {isSubtracting ? '+' : '-'}
            </button>
          </div>
        );
      } else {
        bgClass = card.gambleChoice === 'negative' ? 'border-2 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'border-2 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]';
        bgStyle = card.gambleChoice === 'negative' ? 'linear-gradient(135deg, #fca5a5 0%, #ef4444 100%)' : 'linear-gradient(135deg, #86efac 0%, #22c55e 100%)';
        const effectiveIsNegative = card.isNegative !== undefined ? card.isNegative : isSubtracting;
        content = (
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white">{effectiveIsNegative ? '-' : ''}{card.value}</span>
            <div className={`absolute -bottom-1 -right-1 text-xl font-bold ${card.gambleChoice === 'negative' ? 'text-red-200' : 'text-green-200'} drop-shadow-md`}>
              {card.gambleChoice === 'negative' ? (effectiveIsNegative ? '+' : '-') : (effectiveIsNegative ? '-' : '+')}
            </div>
          </div>
        );
      }
    }
  }

  const cardClasses = `relative ${bgClass} ${baseClasses} ${onClick ? playableClasses : ''} ${disabledClasses}`;

  return (
    <div 
      className={cardClasses} 
      onClick={(e) => onClick?.(card.id, e)}
      style={{ background: bgStyle }}
    >
      {!isHidden && content}
    </div>
  );
};

export default Card;
