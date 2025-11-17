import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/game/gameStore';
import { soundManager } from '@/sounds/soundManager';

interface DiceRollProps {
  onComplete: () => void;
}

export const DiceRoll: React.FC<DiceRollProps> = ({ onComplete }) => {
  const { gameState, localPlayerId, rollDice } = useGameStore();
  const [isRolling, setIsRolling] = useState(false);
  const [displayValue, setDisplayValue] = useState(1);
  const [finalValue, setFinalValue] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);

  const handleRoll = () => {
    if (isRolling || finalValue !== null) return;

    setIsRolling(true);
    soundManager.play('dice_roll');

    // Animate dice rolling
    let rollCount = 0;
    const maxRolls = 20;
    const rollInterval = setInterval(() => {
      setDisplayValue(Math.floor(Math.random() * 6) + 1);
      rollCount++;

      if (rollCount >= maxRolls) {
        clearInterval(rollInterval);
        const result = rollDice(localPlayerId!);
        setDisplayValue(result);
        setFinalValue(result);
        setIsRolling(false);

        // Auto-roll for AI players after local player rolls
        setTimeout(() => {
          gameState?.players.forEach((player) => {
            if (player.id !== localPlayerId && player.diceRoll === null) {
              // This is an AI player, auto-roll for them
              rollDice(player.id);
            }
          });

          // Check if all players have rolled
          setTimeout(() => {
            const updatedState = useGameStore.getState().gameState;
            const allRolled = updatedState?.players.every((p) => p.diceRoll !== null);
            if (allRolled) {
              setShowResults(true);
            }
          }, 500);
        }, 1000);
      }
    }, 100);
  };

  useEffect(() => {
    if (showResults) {
      const timer = setTimeout(() => {
        onComplete();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showResults, onComplete]);

  if (!gameState) return null;

  const localPlayer = gameState.players.find((p) => p.id === localPlayerId);
  const sortedPlayers = [...gameState.players].sort(
    (a, b) => (b.diceRoll || 0) - (a.diceRoll || 0)
  );

  return (
    <div className="dice-roll-screen">
      <h2>Roll for Turn Order</h2>

      <div className="dice-container">
        <div className={`dice ${isRolling ? 'rolling' : ''}`}>
          <div className="dice-face">{displayValue}</div>
        </div>

        {!finalValue && (
          <button
            className="roll-button"
            onClick={handleRoll}
            disabled={isRolling}
          >
            {isRolling ? 'Rolling...' : 'Roll Dice'}
          </button>
        )}

        {finalValue && (
          <div className="roll-result">
            Your roll: <strong>{finalValue}</strong>
          </div>
        )}
      </div>

      {showResults && (
        <div className="roll-results">
          <h3>Turn Order</h3>
          <ol>
            {sortedPlayers.map((player, index) => (
              <li
                key={player.id}
                className={player.id === localPlayerId ? 'local-player' : ''}
              >
                <span className="player-name">{player.name}</span>
                <span className="player-roll">Roll: {player.diceRoll}</span>
                {index === 0 && <span className="first-pick">First Pick!</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="other-players">
        <h4>Other Players</h4>
        {gameState.players
          .filter((p) => p.id !== localPlayerId)
          .map((player) => (
            <div key={player.id} className="other-player-roll">
              <span>{player.name}:</span>
              <span>
                {player.diceRoll !== null ? player.diceRoll : 'Waiting...'}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
};
