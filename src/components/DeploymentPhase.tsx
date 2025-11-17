import React, { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '@/game/gameStore';
import { HexCoord, HexDirection, Ship, SHIP_STATS } from '@/types/game';
import { soundManager } from '@/sounds/soundManager';
import { hexToPixel, DIRECTION_NAMES, directionToAngle } from '@/engine/hexGrid';

interface DeploymentPhaseProps {
  hexSize: number;
  onComplete: () => void;
}

export const DeploymentPhase: React.FC<DeploymentPhaseProps> = ({
  hexSize,
  onComplete,
}) => {
  const {
    gameState,
    localPlayerId,
    deployShip,
    undeployShip,
    confirmDeployment,
    autoDeployRemaining,
    selectDeploymentZone,
    getLocalPlayer,
  } = useGameStore();

  const [selectedShipForDeploy, setSelectedShipForDeploy] = useState<Ship | null>(null);
  const [selectedHex, setSelectedHex] = useState<HexCoord | null>(null);
  const [selectedFacing, setSelectedFacing] = useState<HexDirection>(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isZoneSelection, setIsZoneSelection] = useState(true);

  const localPlayer = getLocalPlayer();

  useEffect(() => {
    if (gameState && localPlayer) {
      setTimeRemaining(gameState.settings.timeControl.deploymentTime);
      setIsZoneSelection(localPlayer.deploymentZone === null);
    }
  }, [gameState, localPlayer]);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) {
      // Auto deploy remaining ships
      if (localPlayer) {
        autoDeployRemaining(localPlayer.id);
        onComplete();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        if (prev <= 10) {
          soundManager.play('countdown');
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, localPlayer, autoDeployRemaining, onComplete]);

  const handleZoneSelect = (zoneIndex: number) => {
    if (!localPlayer || localPlayer.deploymentZone !== null) return;

    // Check if zone is already taken
    const zoneTaken = gameState?.players.some((p) => p.deploymentZone === zoneIndex);
    if (zoneTaken) return;

    selectDeploymentZone(localPlayer.id, zoneIndex);
    setIsZoneSelection(false);
    soundManager.play('button_click');
  };

  const handleShipSelect = (ship: Ship) => {
    setSelectedShipForDeploy(ship);
    setSelectedHex(null);
    soundManager.play('button_click');
  };

  const handleHexClick = useCallback(
    (hex: HexCoord) => {
      if (!selectedShipForDeploy || !localPlayer) return;

      // Check if hex is in deployment zone
      if (localPlayer.deploymentZone === null) return;
      const zoneHexes = gameState?.map.deploymentZones[localPlayer.deploymentZone];
      const isInZone = zoneHexes?.some((h) => h.q === hex.q && h.r === hex.r);
      if (!isInZone) return;

      setSelectedHex(hex);
    },
    [selectedShipForDeploy, localPlayer, gameState]
  );

  const handleConfirmPlacement = () => {
    if (!selectedShipForDeploy || !selectedHex) return;

    const success = deployShip(selectedShipForDeploy.id, selectedHex, selectedFacing);
    if (success) {
      soundManager.play('deploy');
      setSelectedShipForDeploy(null);
      setSelectedHex(null);
    }
  };

  const handleRemoveShip = (shipId: string) => {
    undeployShip(shipId);
    soundManager.play('button_click');
  };

  const handleConfirmAll = () => {
    if (!localPlayer) return;

    const undeployedShips = localPlayer.ships.filter((s) => !s.isDeployed);
    if (undeployedShips.length > 0) {
      if (!confirm('You still have ships to deploy. Auto-deploy remaining ships?')) {
        return;
      }
    }

    confirmDeployment(localPlayer.id);
    soundManager.play('turn_start');
    onComplete();
  };

  if (!gameState || !localPlayer) return null;

  const undeployedShips = localPlayer.ships.filter((s) => !s.isDeployed);
  const deployedShips = localPlayer.ships.filter((s) => s.isDeployed);

  return (
    <div className="deployment-phase">
      <div className="deployment-header">
        <h2>
          {isZoneSelection ? 'Select Deployment Zone' : 'Deploy Your Fleet'}
        </h2>
        <div className="timer">
          Time Remaining:{' '}
          <span className={timeRemaining <= 30 ? 'low-time' : ''}>
            {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {isZoneSelection ? (
        <div className="zone-selection">
          <p>Choose your deployment zone:</p>
          <div className="zone-buttons">
            {[0, 1, 2, 3].map((zoneIndex) => {
              const zoneTaken = gameState.players.some(
                (p) => p.deploymentZone === zoneIndex
              );
              const zoneNames = ['East', 'South', 'West', 'North'];
              return (
                <button
                  key={zoneIndex}
                  className={`zone-button ${zoneTaken ? 'taken' : ''}`}
                  onClick={() => handleZoneSelect(zoneIndex)}
                  disabled={zoneTaken}
                >
                  {zoneNames[zoneIndex]}
                  {zoneTaken && ' (Taken)'}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="deployment-content">
          <div className="undeployed-ships">
            <h3>Ships to Deploy ({undeployedShips.length})</h3>
            <div className="ship-list">
              {undeployedShips.map((ship) => (
                <div
                  key={ship.id}
                  className={`ship-card ${
                    selectedShipForDeploy?.id === ship.id ? 'selected' : ''
                  }`}
                  onClick={() => handleShipSelect(ship)}
                >
                  <div className="ship-name">{SHIP_STATS[ship.type].name}</div>
                  <div className="ship-stats">AP: {ship.maxAP}</div>
                </div>
              ))}
            </div>
          </div>

          {selectedShipForDeploy && selectedHex && (
            <div className="placement-controls">
              <h3>Set Facing Direction</h3>
              <div className="facing-selector">
                {([0, 1, 2, 3, 4, 5] as HexDirection[]).map((dir) => (
                  <button
                    key={dir}
                    className={`facing-btn ${selectedFacing === dir ? 'selected' : ''}`}
                    onClick={() => setSelectedFacing(dir)}
                    title={DIRECTION_NAMES[dir]}
                  >
                    <div
                      className="facing-arrow"
                      style={{
                        transform: `rotate(${directionToAngle(dir)}deg)`,
                      }}
                    >
                      ↑
                    </div>
                  </button>
                ))}
              </div>
              <button className="confirm-placement" onClick={handleConfirmPlacement}>
                Deploy {SHIP_STATS[selectedShipForDeploy.type].name}
              </button>
            </div>
          )}

          <div className="deployed-ships">
            <h3>Deployed Ships ({deployedShips.length})</h3>
            <div className="ship-list">
              {deployedShips.map((ship) => (
                <div key={ship.id} className="deployed-ship-card">
                  <div className="ship-name">{SHIP_STATS[ship.type].name}</div>
                  <div className="ship-position">
                    Pos: ({ship.position.q}, {ship.position.r})
                  </div>
                  <button
                    className="remove-btn"
                    onClick={() => handleRemoveShip(ship.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            className="confirm-all-btn"
            onClick={handleConfirmAll}
            disabled={undeployedShips.length === localPlayer.ships.length}
          >
            {undeployedShips.length === 0
              ? 'Start Battle'
              : `Confirm (${undeployedShips.length} ships auto-deployed)`}
          </button>
        </div>
      )}
    </div>
  );
};
