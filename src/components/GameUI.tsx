import React from 'react';
import { useGameStore } from '@/game/gameStore';
import { SHIP_STATS, ShipType, HexDirection } from '@/types/game';
import { soundManager } from '@/sounds/soundManager';
import { directionToAngle, DIRECTION_NAMES } from '@/engine/hexGrid';

export const GameUI: React.FC = () => {
  const {
    gameState,
    localPlayerId,
    selectedShipId,
    pendingActions,
    getLocalPlayer,
    getCurrentPlayer,
    isMyTurn,
    addPendingTurn,
    undoLastAction,
    undoAllActions,
    confirmTurn,
  } = useGameStore();

  const localPlayer = getLocalPlayer();
  const currentPlayer = getCurrentPlayer();

  if (!gameState || !localPlayer) {
    return <div className="game-ui">Loading...</div>;
  }

  const totalPendingAP = Array.from(pendingActions.values()).reduce(
    (sum, p) => sum + p.totalAPCost,
    0
  );

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTurnShip = (direction: HexDirection) => {
    if (selectedShipId) {
      addPendingTurn(selectedShipId, direction);
      soundManager.play('turn');
    }
  };

  const handleConfirmTurn = () => {
    confirmTurn();
    soundManager.play('turn_start');
  };

  const handleUndoAll = () => {
    undoAllActions();
    soundManager.play('button_click');
  };

  return (
    <div className="game-ui">
      {/* Top bar - Phase and Turn info */}
      <div className="top-bar">
        <div className="phase-info">
          Phase: <strong>{gameState.phase.replace('_', ' ').toUpperCase()}</strong>
        </div>
        <div className="turn-info">
          Turn: <strong>{gameState.turnNumber}</strong>
        </div>
        {currentPlayer && (
          <div className="current-player">
            Current: <strong style={{ color: getPlayerColor(currentPlayer.color) }}>
              {currentPlayer.name}
            </strong>
            {isMyTurn() && <span className="your-turn"> (YOUR TURN)</span>}
          </div>
        )}
      </div>

      {/* Left panel - Player info and ships */}
      <div className="left-panel">
        <div className="player-info">
          <h3 style={{ color: getPlayerColor(localPlayer.color) }}>
            {localPlayer.name}
          </h3>
          <div className="ap-display">
            AP: {localPlayer.remainingAP - totalPendingAP} / {localPlayer.totalAP}
            {totalPendingAP > 0 && (
              <span className="pending-ap"> (-{totalPendingAP} pending)</span>
            )}
          </div>
          <div className="time-display">
            Time: {formatTime(localPlayer.timeRemaining)}
          </div>
        </div>

        <div className="ship-list">
          <h4>Your Fleet</h4>
          {localPlayer.ships.map((ship) => (
            <div
              key={ship.id}
              className={`ship-item ${ship.id === selectedShipId ? 'selected' : ''} ${
                ship.isDestroyed ? 'destroyed' : ''
              }`}
              onClick={() => {
                if (!ship.isDestroyed && ship.isDeployed) {
                  useGameStore.getState().selectShip(ship.id);
                  soundManager.play('button_click');
                }
              }}
            >
              <div className="ship-name">{SHIP_STATS[ship.type].name}</div>
              <div className="ship-ap">
                AP: {ship.currentAP}/{ship.maxAP}
              </div>
              {ship.isDestroyed && <div className="destroyed-badge">DESTROYED</div>}
              {!ship.isDeployed && <div className="not-deployed">Not Deployed</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - Turn controls */}
      {gameState.phase === 'battle' && isMyTurn() && (
        <div className="right-panel">
          {selectedShipId && (
            <div className="turn-controls">
              <h4>Rotate Ship</h4>
              <div className="direction-buttons">
                {([0, 1, 2, 3, 4, 5] as HexDirection[]).map((dir) => (
                  <button
                    key={dir}
                    className="direction-btn"
                    onClick={() => handleTurnShip(dir)}
                    title={DIRECTION_NAMES[dir]}
                  >
                    <div
                      className="direction-arrow"
                      style={{
                        transform: `rotate(${directionToAngle(dir)}deg)`,
                      }}
                    >
                      →
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="action-buttons">
            <button
              className="undo-btn"
              onClick={handleUndoAll}
              disabled={pendingActions.size === 0}
            >
              Undo All
            </button>
            {selectedShipId && pendingActions.has(selectedShipId) && (
              <button
                className="undo-last-btn"
                onClick={() => {
                  undoLastAction(selectedShipId);
                  soundManager.play('button_click');
                }}
              >
                Undo Last
              </button>
            )}
            <button
              className="confirm-btn"
              onClick={handleConfirmTurn}
              disabled={totalPendingAP === 0}
            >
              Confirm Turn
            </button>
          </div>
        </div>
      )}

      {/* Bottom bar - Other players */}
      <div className="bottom-bar">
        {gameState.players
          .filter((p) => p.id !== localPlayerId)
          .map((player) => (
            <div
              key={player.id}
              className={`opponent-info ${player.isEliminated ? 'eliminated' : ''}`}
              style={{ borderColor: getPlayerColor(player.color) }}
            >
              <div className="opponent-name">{player.name}</div>
              <div className="opponent-ships">
                Ships: {player.ships.filter((s) => !s.isDestroyed).length}/{player.ships.length}
              </div>
              <div className="opponent-time">
                Time: {formatTime(player.timeRemaining)}
              </div>
            </div>
          ))}
      </div>

      {/* Winner overlay */}
      {gameState.winner && (
        <div className="winner-overlay">
          <div className="winner-box">
            <h2>
              {gameState.winner === localPlayerId ? 'VICTORY!' : 'DEFEAT'}
            </h2>
            <p>
              {gameState.winner === localPlayerId
                ? 'You have destroyed the enemy mothership!'
                : 'Your mothership has been destroyed!'}
            </p>
            <button
              onClick={() => {
                soundManager.play('button_click');
                useGameStore.getState().setReplayMode(true);
              }}
            >
              Watch Replay
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

function getPlayerColor(color: string): string {
  const colors: Record<string, string> = {
    blue: '#4488ff',
    red: '#ff4444',
    green: '#44ff44',
    yellow: '#ffff44',
  };
  return colors[color] || '#ffffff';
}
