import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/game/gameStore';
import { Turn, Move, HexCoord, HexDirection } from '@/types/game';
import { soundManager } from '@/sounds/soundManager';

interface ReplayViewerProps {
  onClose: () => void;
}

export const ReplayViewer: React.FC<ReplayViewerProps> = ({ onClose }) => {
  const { gameState, goToTurn, addAnimation } = useGameStore();
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackTimerRef = useRef<number | null>(null);

  const turnHistory = gameState?.turnHistory || [];

  useEffect(() => {
    if (isPlaying && currentTurnIndex < turnHistory.length) {
      const delay = 2000 / playbackSpeed;
      playbackTimerRef.current = window.setTimeout(() => {
        playTurn(currentTurnIndex);
        setCurrentTurnIndex((prev) => {
          if (prev >= turnHistory.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, delay);
    }

    return () => {
      if (playbackTimerRef.current) {
        clearTimeout(playbackTimerRef.current);
      }
    };
  }, [isPlaying, currentTurnIndex, playbackSpeed, turnHistory.length]);

  const playTurn = (turnIndex: number) => {
    const turn = turnHistory[turnIndex];
    if (!turn) return;

    soundManager.play('turn_start');
    goToTurn(turnIndex);

    // Create animations for this turn
    let animationDelay = 0;
    turn.moves.forEach((move) => {
      if (move.type === 'move') {
        addAnimation({
          type: 'move',
          shipId: move.shipId,
          startTime: Date.now() + animationDelay,
          duration: 500,
          data: { from: move.from, to: move.to },
        });

        addAnimation({
          type: 'thruster',
          shipId: move.shipId,
          startTime: Date.now() + animationDelay,
          duration: 500,
          data: { from: move.from, to: move.to },
        });

        animationDelay += 600;
      } else if (move.type === 'turn') {
        addAnimation({
          type: 'turn',
          shipId: move.shipId,
          startTime: Date.now() + animationDelay,
          duration: 300,
          data: { from: move.from, to: move.to },
        });

        animationDelay += 400;
      }
    });
  };

  const handlePrevTurn = () => {
    setIsPlaying(false);
    if (currentTurnIndex > 0) {
      const newIndex = currentTurnIndex - 1;
      setCurrentTurnIndex(newIndex);
      playTurn(newIndex);
      soundManager.play('button_click');
    }
  };

  const handleNextTurn = () => {
    setIsPlaying(false);
    if (currentTurnIndex < turnHistory.length - 1) {
      const newIndex = currentTurnIndex + 1;
      setCurrentTurnIndex(newIndex);
      playTurn(newIndex);
      soundManager.play('button_click');
    }
  };

  const handlePlayPause = () => {
    soundManager.play('button_click');
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    soundManager.play('button_click');
    setIsPlaying(false);
    setCurrentTurnIndex(0);
    goToTurn(0);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsPlaying(false);
    const newIndex = Number(e.target.value);
    setCurrentTurnIndex(newIndex);
    playTurn(newIndex);
  };

  const formatMoveDescription = (move: Move): string => {
    if (move.type === 'move') {
      const from = move.from as HexCoord;
      const to = move.to as HexCoord;
      return `Move (${from.q},${from.r}) → (${to.q},${to.r})`;
    } else {
      const from = move.from as HexDirection;
      const to = move.to as HexDirection;
      const directions = ['E', 'SE', 'SW', 'W', 'NW', 'NE'];
      return `Turn ${directions[from]} → ${directions[to]}`;
    }
  };

  if (!gameState) return null;

  const currentTurn = turnHistory[currentTurnIndex];
  const currentPlayer = currentTurn
    ? gameState.players.find((p) => p.id === currentTurn.playerId)
    : null;

  return (
    <div className="replay-viewer">
      <div className="replay-header">
        <h2>Game Replay</h2>
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="replay-controls">
        <div className="playback-buttons">
          <button onClick={handleReset} title="Reset">
            ⏮
          </button>
          <button onClick={handlePrevTurn} disabled={currentTurnIndex === 0}>
            ⏪
          </button>
          <button onClick={handlePlayPause}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            onClick={handleNextTurn}
            disabled={currentTurnIndex >= turnHistory.length - 1}
          >
            ⏩
          </button>
        </div>

        <div className="turn-slider">
          <input
            type="range"
            min={0}
            max={Math.max(0, turnHistory.length - 1)}
            value={currentTurnIndex}
            onChange={handleSliderChange}
          />
          <div className="turn-counter">
            Turn {currentTurnIndex + 1} / {turnHistory.length}
          </div>
        </div>

        <div className="speed-control">
          <label>Speed:</label>
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </div>
      </div>

      {currentTurn && currentPlayer && (
        <div className="turn-info">
          <h3>
            {currentPlayer.name}'s Turn (#{currentTurn.turnNumber})
          </h3>
          <div className="move-list">
            {currentTurn.moves.map((move, index) => (
              <div key={index} className="move-item">
                {formatMoveDescription(move)} ({move.apCost} AP)
              </div>
            ))}
            {currentTurn.moves.length === 0 && <div>No moves</div>}
          </div>
        </div>
      )}
    </div>
  );
};
