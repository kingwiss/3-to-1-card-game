import { GameState, Player, Card } from '../types';
import { DECK_COMPOSITION, INITIAL_HAND_SIZE, TARGET_LINEUP_SIZE } from '../constants/index';

const createId = () => Math.random().toString(36).substr(2, 9);

const createDeck = (gameMode: 'normal' | 'special' = 'normal'): Card[] => {
  const deck: Card[] = [];
  for (const value in DECK_COMPOSITION) {
    for (let i = 0; i < DECK_COMPOSITION[value as any as keyof typeof DECK_COMPOSITION]; i++) {
      deck.push({ id: createId(), value: parseInt(value as string), type: 'number' });
    }
  }

  if (gameMode === 'special') {
    // Add 2 Golden Cards
    for (let i = 0; i < 2; i++) {
      deck.push({ id: createId(), value: 0, type: 'golden' });
    }

    // Add Permanent Cards (2 of each 1, 2, 3)
    for (let i = 0; i < 2; i++) {
      deck.push({ id: createId(), value: 1, type: 'permanent', permanentValue: 1 });
      deck.push({ id: createId(), value: 2, type: 'permanent', permanentValue: 2 });
      deck.push({ id: createId(), value: 3, type: 'permanent', permanentValue: 3 });
    }

    // Add Sequence Cards
    const sequences = [
      [1, 2, 1], [2, 3, 2], [1, 2, 3],
      [1, 3, 1], [2, 1, 2], [3, 1, 3]
    ];
    
    sequences.forEach(seq => {
      // Value is the first number for sorting/display purposes
      deck.push({ id: createId(), value: seq[0], type: 'sequence', sequence: seq });
    });
  }

  // Replace 5 random number cards with gamble cards
  const numberCardIndices = deck.map((c, i) => c.type === 'number' ? i : -1).filter(i => i !== -1);
  const gambleCount = 5;
  for (let i = 0; i < gambleCount; i++) {
    if (numberCardIndices.length === 0) break;
    const randomIndex = Math.floor(Math.random() * numberCardIndices.length);
    const deckIndex = numberCardIndices[randomIndex];
    deck[deckIndex].type = 'gamble';
    deck[deckIndex].isGambleRevealed = false;
    numberCardIndices.splice(randomIndex, 1);
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
    // Special card logic for eligibility
    if (card.type === 'golden') return true; // Can always play golden card (assuming player chooses valid number)
    
    if (card.type === 'permanent' && card.permanentValue) {
       if (player.score + card.permanentValue > targetNumber) continue;
       if (!player.cleanSlate && player.row.length > 0 && player.row[player.row.length - 1].value === card.permanentValue) continue;
       return true;
    }

    if (card.type === 'sequence' && card.sequence) {
       const seqSum = card.sequence.reduce((a, b) => a + b, 0);
       if (player.score + seqSum > targetNumber) continue;
       if (!player.cleanSlate && player.row.length > 0 && player.row[player.row.length - 1].value === card.sequence[0]) continue;
       return true;
    }

    // Normal card logic
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
    // Permanent cards stay in hand? No, reshuffle usually happens when deck is empty.
    // But permanent cards are permanent in hand. They shouldn't be discarded to reshuffle unless the game logic dictates.
    // However, reshuffleDeck is called when deck is empty to refill it from discard pile (which we simulate by taking from players? No, this logic seems to take everything back?)
    // The current reshuffleDeck implementation takes ALL cards from hands and rows to reform the deck.
    // If we want permanent cards to persist, we should filter them out from being reshuffled if they are in hand.
    // But wait, reshuffleDeck here seems to be a "restart round" or "refill deck" logic that is quite aggressive (taking hands too).
    // Actually, looking at drawCard: if (state.deck.length === 0) { state = reshuffleDeck(state); }
    // This reshuffleDeck implementation resets the game state effectively (clearing rows/hands).
    // This seems to be a "Deck Empty -> Reset Hands/Rows" logic which is a bit unusual for standard card games but might be the rule here.
    // If so, we should probably keep it consistent.
    
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
    pendingGambleDecision: false,
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
  let pendingGambleDecision = false;
  
  if (card.type === 'number' && card.value >= 4 && card.value <= 6) {
    pendingTargetDecision = true;
  } else if (card.type === 'gamble') {
    pendingGambleDecision = true;
  }

  return { ...state, deck: newDeck, drawnCard: card, hasDrawnCardThisTurn: true, pendingTargetDecision, pendingGambleDecision };
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

export const handleGambleChoice = (gameState: GameState, cardId: string, choice: 'positive' | 'negative'): GameState => {
  const { players, activePlayerIndex, drawnCard } = gameState;
  if (!drawnCard || drawnCard.id !== cardId || drawnCard.type !== 'gamble' || drawnCard.isGambleRevealed) {
    return gameState;
  }

  const player = players[activePlayerIndex];
  let newState = { ...gameState, pendingGambleDecision: false };
  const newPlayers = [...players];
  const newPlayer = { ...player };

  // Reveal the card
  const revealedCard = { ...drawnCard, isGambleRevealed: true, gambleChoice: choice };
  newState.drawnCard = null; // Clear drawn card as it's processed

  if (choice === 'positive') {
    // Goes to hand, revealed as positive
    newPlayer.hand = [...newPlayer.hand, revealedCard];
    newPlayers[activePlayerIndex] = newPlayer;
    newState.players = newPlayers;
    newState.logs = [...newState.logs, `${newPlayer.name} chose Positive for a Gamble Card and revealed a ${revealedCard.value}! It goes to their hand.`];
    
    if (!hasEligibleMoves(newPlayer, newState.targetNumber)) {
      newState = endTurn(newState);
    }
    return newState;
  } else {
    // Negative choice: must be played immediately to row, bypassing normal restrictions
    newState.logs = [...newState.logs, `${newPlayer.name} chose Negative for a Gamble Card and revealed a ${revealedCard.value}! It is played immediately.`];
    
    // Add to row
    const newRow = [...newPlayer.row, revealedCard];
    const newScore = newPlayer.score; // Negative gamble card does not add to score
    const newTargetNumber = newState.targetNumber - revealedCard.value;
    
    let newUnlockedNumbers = { ...newPlayer.unlockedNumbers };
    let newHighCardsUnlocked = newPlayer.highCardsUnlocked;

    if (revealedCard.value >= 1 && revealedCard.value <= 3) {
      newUnlockedNumbers[revealedCard.value as 1 | 2 | 3] = true;
    }

    if (newUnlockedNumbers[1] && newUnlockedNumbers[2] && newUnlockedNumbers[3]) {
      newHighCardsUnlocked = true;
    }

    if (revealedCard.value > 3) {
      newUnlockedNumbers = { 1: false, 2: false, 3: false };
      newHighCardsUnlocked = false;
    }

    newPlayer.row = newRow;
    newPlayer.score = newScore;
    newPlayer.unlockedNumbers = newUnlockedNumbers;
    newPlayer.highCardsUnlocked = newHighCardsUnlocked;
    newPlayer.cleanSlate = false;
    newPlayers[activePlayerIndex] = newPlayer;
    newState.players = newPlayers;
    
    // Limit Lift Logic
    if (revealedCard.value >= 4) {
      const opponentIndex = (activePlayerIndex + 1) % newState.players.length;
      const opponent = { ...newState.players[opponentIndex] };
      opponent.limitLifted = true;
      const newPlayersWithLimitLift = [...newState.players];
      newPlayersWithLimitLift[opponentIndex] = opponent;
      newState.players = newPlayersWithLimitLift;
      newState.logs.push(`${newPlayer.name} lifted the limit for ${opponent.name} with a high Gamble Card!`);
    }

    newState.targetNumber = newTargetNumber;
    newState.logs = [...newState.logs, `The target number is reduced by ${revealedCard.value} to ${newTargetNumber}! ${newPlayer.name}'s score is now ${newScore}.`];

    // Check win/loss
    if (newTargetNumber < newScore) {
      newState.logs = [...newState.logs, `${newPlayer.name} busted because the target number (${newTargetNumber}) fell below their score (${newScore})! They lose the round.`];
      newState.status = 'roundOver';
      // Opponent wins
      const opponentIndex = (activePlayerIndex + 1) % players.length;
      newState.winnerId = players[opponentIndex].id;
      players[opponentIndex].persistentScore += 1;
      return newState;
    } else if (newScore === newTargetNumber) {
      newState.logs = [...newState.logs, `${newPlayer.name} hit the target number exactly! They win the round.`];
      newPlayer.persistentScore += 1;
      newState.status = 'roundOver';
      newState.winnerId = newPlayer.id;
      return newState;
    }

    // If game continues, it counts as a play
    newState.playsThisTurn += 1;
    const maxPlays = newPlayer.limitLifted ? Infinity : 2;
    if (newState.playsThisTurn >= maxPlays || !hasEligibleMoves(newPlayer, newTargetNumber)) {
      newState = endTurn(newState);
    }
    
    return newState;
  }
};

export const playCard = (gameState: GameState, cardId: string, selectedValue?: number): GameState => {
  const { players, activePlayerIndex, targetNumber } = gameState;
  if (!gameState.hasDrawnCardThisTurn) return gameState;

  const player = players[activePlayerIndex];
  const cardIndex = player.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return gameState;

  const card = player.hand[cardIndex];
  
  // Special Card Logic
  if (card.type === 'golden') {
    if (!selectedValue) return gameState; // Should have a selected value
    
    // Golden card logic: Can be any number 1-9.
    // "They can add it to their row even if they have not completed the one, two, three cycle."
    // "They can add it to their row whenever they want."
    // Golden Card bypasses the consecutive duplicate rule.
    
    if (player.score + selectedValue > targetNumber) {
      return gameState;
    }

    const newHand = [...player.hand];
    newHand.splice(cardIndex, 1);

    // Create a "played" version of the golden card with the selected value
    const playedCard = { ...card, value: selectedValue };
    
    const newRow = [...player.row, playedCard];
    const newScore = player.score + selectedValue;
    
    // Update cycle tracker if applicable (1, 2, 3)
    let newUnlockedNumbers = { ...player.unlockedNumbers };
    let newHighCardsUnlocked = player.highCardsUnlocked;

    if (selectedValue >= 1 && selectedValue <= 3) {
      newUnlockedNumbers[selectedValue as 1 | 2 | 3] = true;
    }
    if (newUnlockedNumbers[1] && newUnlockedNumbers[2] && newUnlockedNumbers[3]) {
      newHighCardsUnlocked = true;
    }
    
    // Golden card doesn't reset cycle if > 3 because it bypasses rules? 
    // "They can add it to their row even if they have not completed the one, two, three cycle."
    // It doesn't explicitly say it *breaks* the cycle if they pick 5. 
    // But usually playing a high card resets the cycle. 
    // Let's assume if they pick > 3, it behaves like a high card regarding cycle reset.
    if (selectedValue > 3) {
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
    
    // Limit Lift Logic for Golden Card?
    if (selectedValue >= 4) {
       const opponentIndex = (activePlayerIndex + 1) % newState.players.length;
       const opponent = { ...newState.players[opponentIndex] };
       opponent.limitLifted = true;
       const newPlayersWithLimitLift = [...newState.players];
       newPlayersWithLimitLift[opponentIndex] = opponent;
       newState.players = newPlayersWithLimitLift;
       newState.logs.push(`${newPlayer.name} lifted the limit for ${opponent.name} with a Golden Card!`);
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
  }

  if (card.type === 'permanent') {
    const value = card.permanentValue!;
    
    if (!player.cleanSlate && player.row.length > 0 && player.row[player.row.length - 1].value === value) {
      return gameState;
    }
    if (player.score + value > targetNumber) {
      return gameState;
    }
    
    // Permanent card stays in hand!
    // We add a copy to the row.
    const playedCard = { ...card, id: createId(), value: value }; // New ID for the row instance
    
    const newRow = [...player.row, playedCard];
    const newScore = player.score + value;
    
    let newUnlockedNumbers = { ...player.unlockedNumbers };
    let newHighCardsUnlocked = player.highCardsUnlocked;

    if (value >= 1 && value <= 3) {
      newUnlockedNumbers[value as 1 | 2 | 3] = true;
    }
    if (newUnlockedNumbers[1] && newUnlockedNumbers[2] && newUnlockedNumbers[3]) {
      newHighCardsUnlocked = true;
    }

    const newPlayer = {
      ...player,
      // Hand is NOT modified
      row: newRow,
      score: newScore,
      unlockedNumbers: newUnlockedNumbers,
      highCardsUnlocked: newHighCardsUnlocked,
      cleanSlate: false,
    };
    
    const newPlayers = [...players];
    newPlayers[activePlayerIndex] = newPlayer;
    
    let newState: GameState = { ...gameState, players: newPlayers, playsThisTurn: gameState.playsThisTurn + 1 };
    
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
  }

  if (card.type === 'sequence') {
    const sequence = card.sequence!;
    
    // Check first number against last card
    if (!player.cleanSlate && player.row.length > 0 && player.row[player.row.length - 1].value === sequence[0]) {
      return gameState;
    }
    
    const seqSum = sequence.reduce((a, b) => a + b, 0);
    if (player.score + seqSum > targetNumber) {
      return gameState;
    }

    const newHand = [...player.hand];
    newHand.splice(cardIndex, 1);
    
    // Add all cards in sequence to row
    const cardsToAdd = sequence.map(val => ({ id: createId(), value: val, type: 'number' as const }));
    const newRow = [...player.row, ...cardsToAdd];
    const newScore = player.score + seqSum;
    
    let newUnlockedNumbers = { ...player.unlockedNumbers };
    let newHighCardsUnlocked = player.highCardsUnlocked;

    // Process each number in sequence for unlocking
    sequence.forEach(val => {
      if (val >= 1 && val <= 3) {
        newUnlockedNumbers[val as 1 | 2 | 3] = true;
      }
    });
    
    if (newUnlockedNumbers[1] && newUnlockedNumbers[2] && newUnlockedNumbers[3]) {
      newHighCardsUnlocked = true;
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
  }

  // Normal Card Logic
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
    if (c.type === 'golden') {
      // AI can play golden card if at least value 1 fits
      return score + 1 <= targetNumber;
    }
    
    if (c.type === 'permanent' && c.permanentValue) {
       if (score + c.permanentValue > targetNumber) return false;
       if (!player.cleanSlate && lastCardInRow && lastCardInRow.value === c.permanentValue) return false;
       return true;
    }

    if (c.type === 'sequence' && c.sequence) {
       const seqSum = c.sequence.reduce((a, b) => a + b, 0);
       if (score + seqSum > targetNumber) return false;
       if (!player.cleanSlate && lastCardInRow && lastCardInRow.value === c.sequence[0]) return false;
       return true;
    }

    if (score + c.value > targetNumber) return false;
    if (!player.cleanSlate && lastCardInRow && lastCardInRow.value === c.value) return false;
    if (c.value > 3 && !highCardsUnlocked) return false;
    return true;
  };

  // 1. Prioritize completing the 1-2-3 cycle
  for (let i = 1; i <= 3; i++) {
    if (!unlockedNumbers[i as 1 | 2 | 3]) {
      // Check for normal cards
      const cardToPlay = hand.find(c => c.value === i && (!c.type || c.type === 'number' || (c.type === 'gamble' && c.isGambleRevealed && c.gambleChoice === 'positive')) && isValidCard(c));
      if (cardToPlay) return cardToPlay;
      
      // Check for permanent cards
      const permCard = hand.find(c => c.type === 'permanent' && c.permanentValue === i && isValidCard(c));
      if (permCard) return permCard;
    }
  }

  // 2. If cycle is complete, consider playing a high card
  if (highCardsUnlocked) {
    const highCard = hand.find(c => c.value > 3 && (!c.type || c.type === 'number' || (c.type === 'gamble' && c.isGambleRevealed && c.gambleChoice === 'positive')) && isValidCard(c));
    if (highCard) return highCard;
  }
  
  // 3. Play Sequence cards if valid
  const seqCard = hand.find(c => c.type === 'sequence' && isValidCard(c));
  if (seqCard) return seqCard;

  // 4. Play Golden card if available
  const goldenCard = hand.find(c => c.type === 'golden');
  if (goldenCard) return goldenCard;

  // 5. If no high card is suitable, play any other valid low card
  const lowCard = hand.find(c => c.value <= 3 && (!c.type || c.type === 'number' || (c.type === 'gamble' && c.isGambleRevealed && c.gambleChoice === 'positive')) && isValidCard(c));
  if (lowCard) return lowCard;

  return null;
};

export const getBestGoldenCardValue = (player: Player, targetNumber: number): number => {
  const { unlockedNumbers, score } = player;
  
  // 1. Try to complete cycle
  for (let i = 1; i <= 3; i++) {
    if (!unlockedNumbers[i as 1 | 2 | 3]) {
      if (score + i <= targetNumber) return i;
    }
  }
  
  // 2. If cycle complete, play high card (e.g. 9) if fits
  if (player.highCardsUnlocked) {
    for (let i = 9; i >= 4; i--) {
      if (score + i <= targetNumber) return i;
    }
  }
  
  // 3. Otherwise play highest possible low card
  for (let i = 3; i >= 1; i--) {
    if (score + i <= targetNumber) return i;
  }
  
  return 1; // Fallback
};

export const startNextRound = (gameState: GameState): GameState => {
  const { players, round, gameMode } = gameState;

  let deck = shuffleDeck(createDeck(gameMode));

  const targetLineup = deck.splice(0, TARGET_LINEUP_SIZE);
  const targetNumber = targetLineup.reduce((sum, card) => sum + (card.value || 0), 0); // Handle golden cards having 0 value initially

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
    pendingGambleDecision: false,
  };
};

export const initGame = (isStrategicMode: boolean = false, gameMode: 'normal' | 'special' = 'normal'): GameState => {
  let deck = shuffleDeck(createDeck(gameMode));

  const targetLineup = deck.splice(0, TARGET_LINEUP_SIZE);
  const targetNumber = targetLineup.reduce((sum, card) => sum + (card.value || 0), 0);

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
    pendingGambleDecision: false,
    isStrategicMode,
    gameMode,
  };
};