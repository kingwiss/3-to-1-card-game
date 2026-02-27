import React from 'react';
import Game from './components/Game';
import { GameProvider } from './contexts/GameContext';

const App: React.FC = () => {
  return (
    <GameProvider>
      <Game />
    </GameProvider>
  );
};

export default App;
