import React from 'react';
import { Card as CardType } from '../types';

interface CardProps {
  card: CardType;
  onClick?: (id: string, e?: React.MouseEvent) => void;
  isPlayable?: boolean;
  isHidden?: boolean;
  isDisabled?: boolean;
}

const Card: React.FC<CardProps> = ({ card, onClick, isPlayable = false, isHidden = false, isDisabled = false }) => {
  const baseClasses = 'w-10 h-14 md:w-14 md:h-20 rounded-lg shadow-lg transform transition-all duration-300 flex-shrink-0 overflow-hidden';
  const playableClasses = isPlayable ? 'cursor-pointer hover:scale-105' : 'cursor-default';
  const disabledClasses = isDisabled ? 'opacity-50 grayscale' : '';
  
  const tealToBlueGradient = 'linear-gradient(135deg, #14b8a6 0%, #0f766e 40%, #1e3a8a 100%)';
  
  let bgClass = 'border-2 border-[var(--theme-700)]';
  let bgStyle = tealToBlueGradient;
  let content = <span className="absolute top-0.5 left-1.5 text-base md:text-lg font-bold text-white">{card.value}</span>;

  if (!isHidden) {
    if (card.type === 'golden') {
      bgClass = 'border-2 border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.6)]';
      // "Actual color gold" - using a rich metallic gradient
      bgStyle = 'linear-gradient(135deg, #FFD700 0%, #B8860B 40%, #FFD700 70%, #DAA520 100%)';
      content = (
        <div className="flex flex-col items-center justify-center w-full h-full">
          <span className="text-3xl font-extrabold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">?</span>
          <div className="absolute inset-0 bg-white/20 animate-pulse rounded-lg"></div>
        </div>
      );
    } else if (card.type === 'permanent') {
      bgClass = 'border-2 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]';
      // Darker purple background for contrast
      bgStyle = 'linear-gradient(to bottom right, #2e1065, #581c87)';
      content = (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{card.permanentValue}</span>
          <div className="absolute -bottom-1 -right-1 text-2xl font-bold text-purple-300 drop-shadow-md">∞</div>
        </div>
      );
    } else if (card.type === 'sequence') {
      bgClass = 'border-2 border-blue-400';
      bgStyle = tealToBlueGradient;
      content = (
        <div className="flex flex-col items-center justify-center w-full h-full leading-tight text-white">
          {card.sequence?.map((val, idx) => (
            <span key={idx} className="text-xs md:text-sm font-bold">{val}</span>
          ))}
        </div>
      );
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
