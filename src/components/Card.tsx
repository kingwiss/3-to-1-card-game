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
  const bgClass = isHidden ? 'bg-slate-700 border-2 border-slate-500' : 'bg-slate-800 border-2 border-slate-600';
  const cardClasses = `relative ${bgClass} ${baseClasses} ${onClick ? playableClasses : ''} ${disabledClasses}`;

  return (
    <div className={cardClasses} onClick={(e) => onClick?.(card.id, e)}>
      {!isHidden && <span className="absolute top-0.5 left-1.5 text-base md:text-lg font-bold">{card.value}</span>}
    </div>
  );
};

export default Card;
