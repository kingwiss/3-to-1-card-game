import { GameState, Player, Card } from '../types';
import { DECK_COMPOSITION, INITIAL_HAND_SIZE, TARGET_LINEUP_SIZE } from '../constants/index';

const createId = () => Math.random().toString(36).substr(2, 9);

const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const value in DECK_COMPOSITION) {
    for (let i = 0; i < DECK_COMPOSITION[value as any as keyof typeof DECK_COMPOSITION]; i++) {
      deck.push({ id: createId(), value: parseInt(value as string) });
    }
  }
  return deck;
};

const shuffleDeck = (deck: Card[]): Card[] => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const hasEligibleMoves = (player: Player, targetNumber: number): boolean => {
  for (const card of player.hand) {
    if (player.score + card.value > targetNumber) {
      continue;
    }
    if (!player.cleanSlate && player.row.length > 0 && player.row[player.row.length - 1].value === card.value) {
      continue;
    }
    if (card.value > 3 && !player.highCardsUnlocked) {
      continue;
    }
    return true;
  }
  return false;
};

export const reshuffleDeck = (gameState: GameState): GameState => {
  let cardsToReshuffle: Card[] = [...gameState.deck];
  
  const newPlayers = gameState.players.map(p => {
    cardsToReshuffle.push(...p.hand);
    cardsToReshuffle.push(...p.row);
    return {
      ...p,
      hand: [],
      row: [],
      cleanSlate: true,
    };
  });

  let newDeck = shuffleDeck(cardsToReshuffle);

  const finalPlayers = newPlayers.map(p => ({
    ...p,
    hand: newDeck.splice(0, INITIAL_HAND_SIZE),
  }));

  return {
    ...gameState,
    deck: newDeck,
    players: finalPlayers,
  };
};

export const endTurn = (gameState: GameState): GameState => {
  const { players, activePlayerIndex } = gameState;

  // Reset limitLifted for the player whose turn is ending
  const currentPlayer = { ...players[activePlayerIndex] };
  currentPlayer.limitLifted = false;
  const newPlayers = [...players];
  newPlayers[activePlayerIndex] = currentPlayer;

  const newActivePlayerIndex = (activePlayerIndex + 1) % players.length;
  return {
    ...gameState,
    players: newPlayers,
    activePlayerIndex: newActivePlayerIndex,
    playsThisTurn: 0,
    hasDrawnCardThisTurn: false,
  };
};

export const drawCard = (gameState: GameState): GameState => {
  let state = { ...gameState };
  if (state.hasDrawnCardThisTurn) return state;

  if (state.deck.length === 0) {
    state = reshuffleDeck(state);
  }

  const newDeck = [...state.deck];
  const card = newDeck.pop()!;

  let pendingTargetDecision = false;
  if (card.value >= 4 && card.value <= 6) {
    pendingTargetDecision = true;
  }

  return { ...state, deck: newDeck, drawnCard: card, hasDrawnCardThisTurn: true, pendingTargetDecision };
};

export const addDrawnCardToHand = (gameState: GameState): GameState => {
  const { players, activePlayerIndex, drawnCard } = gameState;
  if (!drawnCard) return gameState;

  const newPlayers = [...players];
  const player = { ...newPlayers[activePlayerIndex] };
  player.hand = [...player.hand, drawnCard];
  newPlayers[activePlayerIndex] = player;

  let newState: GameState = { ...gameState, players: newPlayers, drawnCard: null, pendingTargetDecision: false };

  if (!hasEligibleMoves(player, gameState.targetNumber)) {
    newState = endTurn(newState);
  }

  return newState;
};

export const addDrawnCardToTarget = (gameState: GameState): GameState => {
  const { drawnCard, targetNumber, targetLineup, activePlayerIndex, players } = gameState;
  if (!drawnCard) return gameState;

  let newState: GameState = { 
    ...gameState, 
    targetNumber: targetNumber + drawnCard.value,
    targetLineup: [...targetLineup, drawnCard],
    drawnCard: null,
    pendingTargetDecision: false
  };

  if (drawnCard.value >= 4) {
    const opponentIndex = (activePlayerIndex + 1) % newState.players.length;
    const opponent = { ...newState.players[opponentIndex] };
    opponent.limitLifted = true;
    const newPlayersWithLimitLift = [...newState.players];
    newPlayersWithLimitLift[opponentIndex] = opponent;
    newState.players = newPlayersWithLimitLift;
    newState.logs.push(`${players[activePlayerIndex].name} added a high card to the target, lifting the limit for ${opponent.name}!`);
  }

  const player = newState.players[newState.activePlayerIndex];
  if (!hasEligibleMoves(player, newState.targetNumber)) {
    newState = endTurn(newState);
  }

  return newState;
};

export const playCard = (gameState: GameState, cardId: string): GameState => {
  const { players, activePlayerIndex, targetNumber } = gameState;
  if (!gameState.hasDrawnCardThisTurn) return gameState;

  const player = players[activePlayerIndex];
  const cardIndex = player.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return gameState;

  const card = player.hand[cardIndex];

  if (!player.cleanSlate && player.row.length > 0 && player.row[player.row.length - 1].value === card.value) {
    return gameState;
  }

  if (card.value > 3 && !player.highCardsUnlocked) {
    return gameState;
  }

  if (player.score + card.value > targetNumber) {
    return gameState;
  }

  const newHand = [...player.hand];
  newHand.splice(cardIndex, 1);

  const newRow = [...player.row, card];
  const newScore = player.score + card.value;

  let newUnlockedNumbers = { ...player.unlockedNumbers };
  let newHighCardsUnlocked = player.highCardsUnlocked;

  if (card.value >= 1 && card.value <= 3) {
    newUnlockedNumbers[card.value as 1 | 2 | 3] = true;
  }

  if (newUnlockedNumbers[1] && newUnlockedNumbers[2] && newUnlockedNumbers[3]) {
    newHighCardsUnlocked = true;
  }

  if (card.value > 3) {
    newUnlockedNumbers = { 1: false, 2: false, 3: false };
    newHighCardsUnlocked = false;
  }

  const newPlayer = {
    ...player,
    hand: newHand,
    row: newRow,
    score: newScore,
    unlockedNumbers: newUnlockedNumbers,
    highCardsUnlocked: newHighCardsUnlocked,
    cleanSlate: false,
  };

  const newPlayers = [...players];
  newPlayers[activePlayerIndex] = newPlayer;

  let newState: GameState = { ...gameState, players: newPlayers, playsThisTurn: gameState.playsThisTurn + 1 };

  // Limit Lift Logic
  if (card.value >= 4) {
    const opponentIndex = (activePlayerIndex + 1) % newState.players.length;
    const opponent = { ...newState.players[opponentIndex] };

    opponent.limitLifted = true;

    const newPlayersWithLimitLift = [...newState.players];
    newPlayersWithLimitLift[opponentIndex] = opponent;

    newState.players = newPlayersWithLimitLift;
    newState.logs.push(`${newPlayer.name} lifted the limit for ${opponent.name}!`);
  }

  if (newScore === targetNumber) {
    newPlayer.persistentScore += 1;
    newState.status = 'roundOver';
    newState.winnerId = newPlayer.id;
    return newState;
  }

  const maxPlays = newPlayer.limitLifted ? Infinity : 2;
  if (newState.playsThisTurn >= maxPlays || !hasEligibleMoves(newPlayer, targetNumber)) {
    newState = endTurn(newState);
  }

  return newState;
};

export const findBestCardToPlay = (player: Player, targetNumber: number): Card | null => {
  const { hand, row, unlockedNumbers, highCardsUnlocked, score } = player;
  const lastCardInRow = row.length > 0 ? row[row.length - 1] : null;

  const isValidCard = (c: Card) => {
    if (score + c.value > targetNumber) return false;
    if (!player.cleanSlate && lastCardInRow && lastCardInRow.value === c.value) return false;
    if (c.value > 3 && !highCardsUnlocked) return false;
    return true;
  };

  // 1. Prioritize completing the 1-2-3 cycle
  for (let i = 1; i <= 3; i++) {
    if (!unlockedNumbers[i as 1 | 2 | 3]) {
      const cardToPlay = hand.find(c => c.value === i && isValidCard(c));
      if (cardToPlay) {
        return cardToPlay;
      }
    }
  }

  // 2. If cycle is complete, consider playing a high card
  if (highCardsUnlocked) {
    const highCard = hand.find(c => c.value > 3 && isValidCard(c));
    if (highCard) {
      return highCard;
    }
  }

  // 3. If no high card is suitable, play any other valid low card
  const lowCard = hand.find(c => c.value <= 3 && isValidCard(c));
  if (lowCard) {
    return lowCard;
  }

  return null;
};


export const startNextRound = (gameState: GameState): GameState => {
  const { players, round } = gameState;

  let deck = shuffleDeck(createDeck());

  const targetLineup = deck.splice(0, TARGET_LINEUP_SIZE);
  const targetNumber = targetLineup.reduce((sum, card) => sum + card.value, 0);

  const newPlayers: Player[] = players.map(p => ({
    ...p,
    hand: deck.splice(0, INITIAL_HAND_SIZE),
    row: [],
    score: 0,
    unlockedNumbers: { 1: false, 2: false, 3: false },
    cycleTracker: { 1: false, 2: false, 3: false },
    highCardsUnlocked: false,
    limitLifted: false,
    cleanSlate: false,
  }));

  return {
    ...gameState,
    players: newPlayers,
    deck,
    targetLineup,
    targetNumber,
    activePlayerIndex: 0,
    status: 'playing',
    winnerId: null,
    round: round + 1,
    playsThisTurn: 0,
    hasDrawnCardThisTurn: false,
    drawnCard: null,
    pendingTargetDecision: false,
  };
};

export const initGame = (isStrategicMode: boolean = false): GameState => {
  let deck = shuffleDeck(createDeck());

  const targetLineup = deck.splice(0, TARGET_LINEUP_SIZE);
  const targetNumber = targetLineup.reduce((sum, card) => sum + card.value, 0);

  const players: Player[] = [
    {
      id: 1,
      name: 'Player 1',
      hand: deck.splice(0, INITIAL_HAND_SIZE),
      row: [],
      score: 0,
      persistentScore: 0,
      unlockedNumbers: { 1: false, 2: false, 3: false },
      cycleTracker: { 1: false, 2: false, 3: false },
      highCardsUnlocked: false,
      limitLifted: false,
      cleanSlate: false,
    },
    {
      id: 2,
      name: 'Opponent',
      hand: deck.splice(0, INITIAL_HAND_SIZE),
      row: [],
      score: 0,
      persistentScore: 0,
      unlockedNumbers: { 1: false, 2: false, 3: false },
      cycleTracker: { 1: false, 2: false, 3: false },
      highCardsUnlocked: false,
      limitLifted: false,
      cleanSlate: false,
    },
  ];

  return {
    players,
    deck,
    targetLineup,
    targetNumber,
    activePlayerIndex: 0,
    currentPhase: 'BUILD',
    pendingCard: null,
    playsThisTurn: 0,
    limitLifted: false,
    status: 'playing',
    winnerId: null,
    logs: ['Game Started'],
    mode: 'AI',
    hasDrawnCardThisTurn: false,
    drawnCard: null,
    round: 1,
    pendingTargetDecision: false,
    isStrategicMode,
  };
};