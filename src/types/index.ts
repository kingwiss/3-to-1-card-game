export type CardType = 'number' | 'golden' | 'permanent' | 'sequence' | 'gamble';

export interface Card {
  id: string;
  value: number;
  type?: CardType;
  sequence?: number[];
  permanentValue?: number;
  isGambleRevealed?: boolean;
  gambleChoice?: 'positive' | 'negative';
}

export interface Player {
  id: number;
  name: string;
  hand: Card[];
  row: Card[];
  score: number;
  persistentScore: number;
  unlockedNumbers: {
    1: boolean;
    2: boolean;
    3: boolean;
  };
  cycleTracker: {
    1: boolean;
    2: boolean;
    3: boolean;
  };
  highCardsUnlocked: boolean;
  limitLifted: boolean;
  cleanSlate: boolean;
}

// A simple card game
export interface GameState {
  players: Player[];
  deck: Card[];
  targetLineup: Card[];
  targetNumber: number;
  activePlayerIndex: number;
  currentPhase: string;
  pendingCard: Card | null;
  playsThisTurn: number;
  limitLifted: boolean;
  status: 'playing' | 'gameOver' | 'roundOver';
  winnerId: number | null;
  logs: string[];
  mode: string;
  gameMode: 'normal' | 'special';
  hasDrawnCardThisTurn: boolean;
  drawnCard: Card | null;
  round: number;
  pendingTargetDecision: boolean;
  pendingGambleDecision: boolean;
  isStrategicMode: boolean;
}