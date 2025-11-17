import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from './game/gameStore';
import {
  HexDirection,
  SHIP_NAMES,
  SHIP_AP,
  PLAYER_MAX_AP,
  PLAYER_COLORS,
  ShipType,
} from './types/game';
import { hexToPixel, directionToAngle, hexEqual, pixelToHex } from './engine/hexGrid';
import './styles.css';

// Ship image cache
const shipImages = new Map<string, HTMLImageElement>();
const failedImages = new Set<string>();

function getShipImagePath(type: ShipType, color: string): string {
  const colorName = color.charAt(0).toUpperCase() + color.slice(1);
  if (type === 'mothership') return `/assets/ships/${colorName}_Command_Ship.png`;
  if (type === 'frigate') return '';
  const typeName = type.charAt(0).toUpperCase() + type.slice(1);
  return `/assets/ships/${colorName} ${typeName}.png`;
}

function preloadShipImages() {
  const colors = ['blue', 'red', 'green', 'yellow'];
  const types: ShipType[] = ['scout', 'interceptor', 'corvette', 'destroyer', 'cruiser', 'battleship', 'artillery', 'mothership'];
  colors.forEach((color) => {
    types.forEach((type) => {
      const key = `${color}_${type}`;
      if (!shipImages.has(key) && !failedImages.has(key)) {
        const img = new Image();
        const path = getShipImagePath(type, color);
        if (path) {
          img.onerror = () => failedImages.add(key);
          img.src = path;
          shipImages.set(key, img);
        }
      }
    });
  });
}

export const App: React.FC = () => {
  const store = useGameStore();
  const {
    game,
    selectedShipId,
    startNewGame,
    returnToMenu,
    rollDice,
    selectZone,
    selectShipToDeploy,
    deployShipToHex,
    rotateDeployingShip,
    confirmDeployment,
    selectShip,
    moveShip,
    rotateShip,
    undoLast,
    clearPlans,
    endTurn,
    getValidMoves,
    getPlannedPosition,
    getPlannedFacing,
    getTotalPlannedAP,
    getShipRemainingAP,
    getCurrentPlayer,
    isMyTurn,
    getDeployableHexes,
    getUndeployedShips,
    removeAnimation,
  } = store;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [diceAnimation, setDiceAnimation] = useState<number | null>(null);
  const HEX_SIZE = 40;

  useEffect(() => {
    preloadShipImages();
    setTimeout(() => setImagesLoaded(true), 500);
  }, []);

  useEffect(() => {
    const handleResize = () => setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!game) return;
    const interval = setInterval(() => {
      const now = Date.now();
      game.animations.forEach((anim) => {
        if (now - anim.startTime > anim.duration) removeAnimation(anim.id);
      });
    }, 100);
    return () => clearInterval(interval);
  }, [game, removeAnimation]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !game) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2 + cameraOffset.x, canvas.height / 2 + cameraOffset.y);

    const validMoves = selectedShipId && game.phase === 'battle' ? getValidMoves(selectedShipId) : [];
    const deployableHexes = game.phase === 'deployment' ? getDeployableHexes() : [];

    // Draw all hexes
    game.boardHexes.forEach((hex) => {
      const { x, y } = hexToPixel(hex, HEX_SIZE);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const hx = x + HEX_SIZE * Math.cos(angle);
        const hy = y + HEX_SIZE * Math.sin(angle);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();

      let fillColor = '#1a1a2e';

      // Highlight deployment zones
      if (game.phase === 'zoneSelection' || game.phase === 'deployment') {
        for (const zone of game.deploymentZones) {
          if (zone.hexes.some((zh) => hexEqual(zh, hex))) {
            ctx.globalAlpha = 0.3;
            fillColor = zone.color;
            if (zone.ownerId) ctx.globalAlpha = 0.5;
          }
        }
      }

      // Highlight deployable hexes
      if (deployableHexes.some((dh) => hexEqual(dh, hex))) {
        fillColor = '#2a5a2a';
        ctx.globalAlpha = 0.8;
      }

      // Highlight valid battle moves
      if (validMoves.some((m) => hexEqual(m, hex))) {
        const hasEnemy = game.ships.some(
          (s) => s.deployed && !s.destroyed && hexEqual(s.position, hex) && s.ownerId !== game.currentPlayerId
        );
        fillColor = hasEnemy ? '#5a2a2a' : '#2a5a2a';
        ctx.globalAlpha = 0.8;
      }

      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#3a3a5a';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw debris
    game.debris.forEach((debris) => {
      const { x, y } = hexToPixel(debris.position, HEX_SIZE);
      ctx.fillStyle = '#666666';
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const dist = 8 + Math.sin(i * 2.3) * 6;
        ctx.fillRect(x + Math.cos(angle) * dist - 2, y + Math.sin(angle) * dist - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
    });

    // Draw ships
    game.ships.forEach((ship) => {
      if (!ship.deployed || ship.destroyed) return;

      const pos = game.phase === 'battle' ? getPlannedPosition(ship.id) : ship.position;
      const facing = game.phase === 'battle' ? getPlannedFacing(ship.id) : ship.facing;
      const { x, y } = hexToPixel(pos, HEX_SIZE);
      const owner = game.players.find((p) => p.id === ship.ownerId);
      const colorName = owner?.color || 'blue';
      const imageKey = `${colorName}_${ship.type}`;
      const shipImage = shipImages.get(imageKey);

      ctx.save();
      ctx.translate(x, y);
      const rotation = (directionToAngle(facing) * Math.PI) / 180;
      ctx.rotate(rotation);

      if (shipImage && shipImage.complete && shipImage.naturalWidth > 0 && imagesLoaded && !failedImages.has(imageKey)) {
        const imgSize = HEX_SIZE * 1.4;
        ctx.drawImage(shipImage, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
      } else {
        ctx.beginPath();
        const size = HEX_SIZE * 0.6;
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.5, -size * 0.6);
        ctx.lineTo(-size * 0.3, 0);
        ctx.lineTo(-size * 0.5, size * 0.6);
        ctx.closePath();
        ctx.fillStyle = PLAYER_COLORS[colorName] || '#ffffff';
        ctx.fill();
        if (ship.type === 'mothership') {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      ctx.restore();

      // Selection highlight
      if (ship.id === selectedShipId || ship.id === game.shipToDeployId) {
        ctx.beginPath();
        ctx.arc(x, y, HEX_SIZE * 0.9, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Ship label
      ctx.fillStyle = '#cccccc';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(SHIP_NAMES[ship.type].substring(0, 3), x, y + HEX_SIZE + 12);
    });

    // Draw animations
    const now = Date.now();
    game.animations.forEach((anim) => {
      const elapsed = now - anim.startTime;
      const progress = Math.min(elapsed / anim.duration, 1);
      const { x, y } = hexToPixel(anim.position, HEX_SIZE);

      if (anim.type === 'explosion') {
        const radius = HEX_SIZE * (0.5 + progress * 1.5);
        ctx.save();
        ctx.globalAlpha = 1 - progress;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, '#ffaa00');
        gradient.addColorStop(0.5, '#ff4400');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (anim.type === 'thruster' && anim.direction !== undefined) {
        const flameLength = HEX_SIZE * 0.8 * (1 - progress);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(((directionToAngle(anim.direction) + 180) * Math.PI) / 180);
        ctx.globalAlpha = 1 - progress;
        const gradient = ctx.createLinearGradient(0, 0, flameLength, 0);
        gradient.addColorStop(0, '#00aaff');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(flameLength, 0);
        ctx.lineTo(0, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    });

    ctx.restore();
  }, [game, selectedShipId, cameraOffset, imagesLoaded, getPlannedPosition, getPlannedFacing, getValidMoves, getDeployableHexes]);

  useEffect(() => {
    render();
  }, [render]);

  useEffect(() => {
    if (!game || game.animations.length === 0) return;
    let frame: number;
    const animate = () => {
      render();
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [game?.animations.length, render]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!game) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - canvas.width / 2 - cameraOffset.x;
      const mouseY = e.clientY - rect.top - canvas.height / 2 - cameraOffset.y;

      const clickedHex = pixelToHex(mouseX, mouseY, HEX_SIZE);

      if (game.phase === 'zoneSelection') {
        // Check if clicked a zone
        const currentSelector = game.zoneSelectionOrder[game.currentZoneSelector];
        const currentPlayer = game.players.find((p) => p.id === currentSelector);
        if (currentPlayer && !currentPlayer.isAI) {
          for (const zone of game.deploymentZones) {
            if (zone.ownerId === null && zone.hexes.some((h) => hexEqual(h, clickedHex))) {
              selectZone(currentSelector, zone.id);
              break;
            }
          }
        }
      } else if (game.phase === 'deployment') {
        const deployableHexes = getDeployableHexes();
        if (deployableHexes.some((h) => hexEqual(h, clickedHex))) {
          deployShipToHex(clickedHex);
        }
      } else if (game.phase === 'battle' && isMyTurn()) {
        const clickedShip = game.ships.find(
          (s) => s.deployed && !s.destroyed && hexEqual(getPlannedPosition(s.id), clickedHex)
        );
        if (clickedShip && clickedShip.ownerId === game.currentPlayerId) {
          selectShip(clickedShip.id);
        } else if (selectedShipId) {
          moveShip(selectedShipId, clickedHex);
        }
      }
    },
    [game, cameraOffset, selectZone, deployShipToHex, selectShip, moveShip, selectedShipId, isMyTurn, getPlannedPosition, getDeployableHexes]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) {
      setIsDragging(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setCameraOffset((prev) => ({
        x: prev.x + e.clientX - lastMouse.x,
        y: prev.y + e.clientY - lastMouse.y,
      }));
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleContextMenu = (e: React.MouseEvent) => e.preventDefault();

  const handleDiceRoll = () => {
    if (!game) return;
    const localPlayer = game.players.find((p) => !p.isAI);
    if (localPlayer && localPlayer.diceRoll === null) {
      setDiceAnimation(1);
      let count = 0;
      const interval = setInterval(() => {
        setDiceAnimation(Math.floor(Math.random() * 6) + 1);
        count++;
        if (count > 10) {
          clearInterval(interval);
          rollDice(localPlayer.id);
          setDiceAnimation(null);
        }
      }, 100);
    }
  };

  // RENDER BASED ON PHASE
  if (!game) {
    return (
      <div className="menu">
        <h1>HEXARCH</h1>
        <h2>Strategic Hex-Based Combat</h2>
        <div className="menu-buttons">
          <button onClick={() => startNewGame(true)}>Play vs AI</button>
          <button onClick={() => startNewGame(false)}>Local 2 Player</button>
        </div>
        <div className="menu-info">
          <p>Roll dice to determine deployment order</p>
          <p>Choose your deployment zone strategically</p>
          <p>Place your fleet in your zone</p>
          <p>Destroy the enemy Mothership to win!</p>
        </div>
      </div>
    );
  }

  if (game.phase === 'diceRoll') {
    return (
      <div className="phase-screen">
        <h2>Roll for Initiative</h2>
        <p>Higher roll selects deployment zone first</p>
        <div className="dice-area">
          {game.players.map((player) => (
            <div key={player.id} className="player-dice">
              <h3 style={{ color: PLAYER_COLORS[player.color] }}>{player.name}</h3>
              {player.diceRoll !== null ? (
                <div className="dice-result">{player.diceRoll}</div>
              ) : player.isAI ? (
                <div className="dice-waiting">Rolling...</div>
              ) : (
                <button onClick={handleDiceRoll} className="roll-button">
                  {diceAnimation !== null ? diceAnimation : 'Roll Dice'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (game.phase === 'zoneSelection') {
    const currentSelector = game.zoneSelectionOrder[game.currentZoneSelector];
    const currentPlayer = game.players.find((p) => p.id === currentSelector);

    return (
      <div className="game">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={handleContextMenu}
        />
        <div className="phase-overlay">
          <h2>Zone Selection</h2>
          <p style={{ color: PLAYER_COLORS[currentPlayer?.color || 'blue'] }}>
            {currentPlayer?.name}'s turn to select zone
          </p>
          {currentPlayer?.isAI ? (
            <p>AI is choosing...</p>
          ) : (
            <p>Click on a highlighted zone to claim it</p>
          )}
          <div className="zone-list">
            {game.deploymentZones.map((zone) => (
              <div key={zone.id} className="zone-item" style={{ borderColor: zone.color }}>
                {zone.name}: {zone.ownerId ? game.players.find((p) => p.id === zone.ownerId)?.name : 'Available'}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (game.phase === 'deployment') {
    const deployingPlayer = game.players.find((p) => p.id === game.deployingPlayerId);
    const undeployedShips = game.deployingPlayerId ? getUndeployedShips(game.deployingPlayerId) : [];
    const currentShip = game.ships.find((s) => s.id === game.shipToDeployId);

    return (
      <div className="game">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={handleContextMenu}
        />
        <div className="deployment-panel">
          <h2>Deployment Phase</h2>
          <p style={{ color: PLAYER_COLORS[deployingPlayer?.color || 'blue'] }}>
            {deployingPlayer?.name} deploying
          </p>
          {deployingPlayer?.isAI ? (
            <p>AI is deploying fleet...</p>
          ) : (
            <>
              {currentShip && (
                <div className="current-ship">
                  <h3>Placing: {SHIP_NAMES[currentShip.type]}</h3>
                  <p>Click on a green hex to place</p>
                  {currentShip.deployed && (
                    <div className="rotation-controls">
                      <p>Rotate ship:</p>
                      <div className="rotate-buttons">
                        {[0, 1, 2, 3, 4, 5].map((dir) => (
                          <button
                            key={dir}
                            onClick={() => rotateDeployingShip(dir as HexDirection)}
                            className={currentShip.facing === dir ? 'active' : ''}
                          >
                            {['E', 'SE', 'SW', 'W', 'NW', 'NE'][dir]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="ship-queue">
                <h4>Ships to deploy: {undeployedShips.length}</h4>
                {undeployedShips.map((ship) => (
                  <div
                    key={ship.id}
                    className={`queue-ship ${ship.id === game.shipToDeployId ? 'selected' : ''}`}
                    onClick={() => selectShipToDeploy(ship.id)}
                  >
                    {SHIP_NAMES[ship.type]}
                  </div>
                ))}
              </div>
              {undeployedShips.length === 0 && (
                <button onClick={confirmDeployment} className="confirm-button">
                  Confirm Deployment
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (game.phase === 'battle') {
    const currentPlayer = getCurrentPlayer();
    const totalPlannedAP = getTotalPlannedAP();
    const remainingAP = game.playerAPRemaining - totalPlannedAP;
    const selectedShip = selectedShipId ? game.ships.find((s) => s.id === selectedShipId) : null;

    return (
      <div className="game">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={handleContextMenu}
        />
        <div className="top-bar">
          <div>Turn: {game.turnNumber}</div>
          <div style={{ color: PLAYER_COLORS[currentPlayer?.color || 'blue'] }}>
            {currentPlayer?.name}'s Turn
            {!isMyTurn() && ' (AI thinking...)'}
          </div>
          <div>
            AP: {remainingAP} / {PLAYER_MAX_AP}
          </div>
        </div>

        <div className="left-panel">
          <h3>Your Fleet</h3>
          {game.ships
            .filter((s) => s.ownerId === game.currentPlayerId && s.deployed && !s.destroyed)
            .map((ship) => (
              <div
                key={ship.id}
                className={`ship-item ${ship.id === selectedShipId ? 'selected' : ''}`}
                onClick={() => selectShip(ship.id)}
              >
                <div>{SHIP_NAMES[ship.type]}</div>
                <div className="ship-ap">
                  AP: {getShipRemainingAP(ship.id)} / {SHIP_AP[ship.type]}
                </div>
              </div>
            ))}
        </div>

        {isMyTurn() && (
          <div className="right-panel">
            {selectedShip && (
              <>
                <h3>Rotate {SHIP_NAMES[selectedShip.type]}</h3>
                <div className="rotate-grid">
                  {[5, 0, 1, 4, -1, 2, 3].map((dir, idx) => {
                    if (dir === -1) return <div key={idx} />;
                    const labels = ['E', 'SE', 'SW', 'W', 'NW', 'NE'];
                    const currentFacing = getPlannedFacing(selectedShipId!);
                    return (
                      <button
                        key={dir}
                        onClick={() => rotateShip(selectedShipId!, dir as HexDirection)}
                        disabled={currentFacing === dir}
                        className={currentFacing === dir ? 'current' : ''}
                      >
                        {labels[dir]}
                      </button>
                    );
                  })}
                </div>
                <div className="facing-info">
                  Facing: {['East', 'SE', 'SW', 'West', 'NW', 'NE'][getPlannedFacing(selectedShipId!)]}
                </div>
              </>
            )}
            <h3>Actions</h3>
            <button onClick={undoLast} disabled={game.plannedActions.length === 0}>
              Undo Last
            </button>
            <button onClick={clearPlans} disabled={game.plannedActions.length === 0}>
              Clear All
            </button>
            <button onClick={endTurn} className="end-turn-btn">
              End Turn
            </button>
            <button onClick={returnToMenu} className="quit-btn">
              Quit Game
            </button>
          </div>
        )}

        {totalPlannedAP > 0 && (
          <div className="planned-indicator">
            Planned: {totalPlannedAP} AP | {game.plannedActions.length} action(s)
          </div>
        )}
      </div>
    );
  }

  if (game.phase === 'ended') {
    const winner = game.players.find((p) => p.id === game.winnerId);
    const duration = Math.floor(game.stats.gameDuration / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    return (
      <div className="end-screen">
        <h1 style={{ color: PLAYER_COLORS[winner?.color || 'blue'] }}>{winner?.name} Wins!</h1>
        <div className="game-stats">
          <h3>Game Statistics</h3>
          <p>Total Turns: {game.stats.turnCount}</p>
          <p>
            Duration: {minutes}:{seconds.toString().padStart(2, '0')}
          </p>
          <div className="player-stats">
            {game.players.map((player) => (
              <div key={player.id} className="stat-block">
                <h4 style={{ color: PLAYER_COLORS[player.color] }}>{player.name}</h4>
                <p>Ships Destroyed: {game.stats.shipsDestroyed[player.id] || 0}</p>
                <p>Movements Made: {game.stats.totalMovements[player.id] || 0}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="end-buttons">
          <button onClick={returnToMenu}>Return to Menu</button>
          <button onClick={() => startNewGame(game.players.some((p) => p.isAI))}>Play Again</button>
        </div>
      </div>
    );
  }

  return <div>Unknown phase: {game.phase}</div>;
};
