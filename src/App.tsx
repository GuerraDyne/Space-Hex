import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from './game/gameStore';
import {
  HexCoord,
  HexDirection,
  SHIP_NAMES,
  SHIP_AP,
  PLAYER_MAX_AP,
  PLAYER_COLORS,
  ShipType,
} from './types/game';
import { hexToPixel, directionToAngle, hexEqual } from './engine/hexGrid';
import './styles.css';

// Ship image cache
const shipImages = new Map<string, HTMLImageElement>();
const failedImages = new Set<string>();

// Get ship image path
function getShipImagePath(type: ShipType, color: string): string {
  const colorName = color.charAt(0).toUpperCase() + color.slice(1);

  // Handle special naming for mothership (Command_Ship)
  if (type === 'mothership') {
    return `/assets/ships/${colorName}_Command_Ship.png`;
  }

  // No frigate assets exist, skip
  if (type === 'frigate') {
    return '';
  }

  const typeName = type.charAt(0).toUpperCase() + type.slice(1);
  return `/assets/ships/${colorName} ${typeName}.png`;
}

// Preload ship images
function preloadShipImages() {
  const colors = ['blue', 'red', 'green', 'yellow'];
  const types: ShipType[] = [
    'scout', 'interceptor', 'corvette', 'destroyer',
    'cruiser', 'battleship', 'artillery', 'mothership'
  ];

  colors.forEach((color) => {
    types.forEach((type) => {
      const key = `${color}_${type}`;
      if (!shipImages.has(key) && !failedImages.has(key)) {
        const img = new Image();
        const path = getShipImagePath(type, color);
        if (path) {
          img.onerror = () => {
            failedImages.add(key);
          };
          img.src = path;
          shipImages.set(key, img);
        }
      }
    });
  });
}

export const App: React.FC = () => {
  const {
    game,
    boardHexes,
    plannedActions,
    selectedShipId,
    animations,
    startGame,
    selectShip,
    moveShip,
    rotateShip,
    undoLast,
    clearPlans,
    endTurn,
    returnToMenu,
    getValidMoves,
    getPlannedPosition,
    getPlannedFacing,
    getTotalPlannedAP,
    getShipRemainingAP,
    getCurrentPlayer,
    isMyTurn,
    removeAnimation,
  } = useGameStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const HEX_SIZE = 45;

  // Preload images on mount
  useEffect(() => {
    preloadShipImages();
    // Give images time to load
    setTimeout(() => setImagesLoaded(true), 500);
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Clean up expired animations
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      animations.forEach((anim) => {
        if (now - anim.startTime > anim.duration) {
          removeAnimation(anim.id);
        }
      });
    }, 100);
    return () => clearInterval(interval);
  }, [animations, removeAnimation]);

  // Render game board
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !game) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2 + cameraOffset.x, canvas.height / 2 + cameraOffset.y);

    // Get valid moves for selected ship
    const validMoves = selectedShipId ? getValidMoves(selectedShipId) : [];

    // Draw hexes
    boardHexes.forEach((hex) => {
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

      // Highlight valid moves for selected ship
      let fillColor = '#1a1a2e';
      if (validMoves.some((m) => hexEqual(m, hex))) {
        // Check if this hex has an enemy (attack move)
        const hasEnemy = game.ships.some(
          (s) => !s.destroyed && hexEqual(s.position, hex) && s.ownerId !== game.currentPlayerId
        );
        fillColor = hasEnemy ? '#4a2a2a' : '#2a4a2a'; // Red for attack, green for move
      }

      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = '#3a3a5a';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw hex coordinates (debug)
      // ctx.fillStyle = '#555';
      // ctx.font = '10px monospace';
      // ctx.textAlign = 'center';
      // ctx.fillText(`${hex.q},${hex.r}`, x, y);
    });

    // Draw debris
    game.debris.forEach((debris) => {
      const { x, y } = hexToPixel(debris.position, HEX_SIZE);
      ctx.fillStyle = '#666666';
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + Math.sin(i * 1.7) * 0.3;
        const dist = 8 + Math.sin(i * 2.3) * 6;
        const size = 3 + Math.cos(i * 1.5) * 2;
        ctx.fillRect(
          x + Math.cos(angle) * dist - size / 2,
          y + Math.sin(angle) * dist - size / 2,
          size,
          size
        );
      }
      ctx.globalAlpha = 1;
    });

    // Draw ships
    game.ships.forEach((ship) => {
      if (ship.destroyed) return;

      const pos = getPlannedPosition(ship.id);
      const facing = getPlannedFacing(ship.id);
      const { x, y } = hexToPixel(pos, HEX_SIZE);

      const owner = game.players.find((p) => p.id === ship.ownerId);
      const colorName = owner?.color || 'blue';
      const imageKey = `${colorName}_${ship.type}`;
      const shipImage = shipImages.get(imageKey);

      ctx.save();
      ctx.translate(x, y);

      // Rotate based on facing direction
      // Ship images point East (0 degrees) by default, so rotate accordingly
      const rotation = (directionToAngle(facing) * Math.PI) / 180;
      ctx.rotate(rotation);

      // Draw ship image or fallback to shape
      if (shipImage && shipImage.complete && shipImage.naturalWidth > 0 && imagesLoaded && !failedImages.has(imageKey)) {
        const imgSize = HEX_SIZE * 1.4;
        ctx.drawImage(shipImage, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
      } else {
        // Fallback triangle shape
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
      if (ship.id === selectedShipId) {
        ctx.beginPath();
        ctx.arc(x, y, HEX_SIZE * 0.9, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Facing direction indicator (small arrow)
      ctx.save();
      ctx.translate(x, y);
      const indicatorAngle = (directionToAngle(facing) * Math.PI) / 180;
      ctx.rotate(indicatorAngle);
      ctx.beginPath();
      ctx.moveTo(HEX_SIZE * 0.8, 0);
      ctx.lineTo(HEX_SIZE * 0.6, -4);
      ctx.lineTo(HEX_SIZE * 0.6, 4);
      ctx.closePath();
      ctx.fillStyle = PLAYER_COLORS[colorName] || '#ffffff';
      ctx.globalAlpha = 0.8;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();

      // Ship type label
      ctx.fillStyle = '#cccccc';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(SHIP_NAMES[ship.type].substring(0, 3), x, y + HEX_SIZE + 14);
    });

    // Draw animations
    const now = Date.now();
    animations.forEach((anim) => {
      const elapsed = now - anim.startTime;
      const progress = Math.min(elapsed / anim.duration, 1);
      const { x, y } = hexToPixel(anim.position, HEX_SIZE);

      if (anim.type === 'explosion') {
        // Explosion animation
        const radius = HEX_SIZE * (0.5 + progress * 1.5);
        const alpha = 1 - progress;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Orange/red explosion
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, '#ffaa00');
        gradient.addColorStop(0.5, '#ff4400');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Sparks
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          const sparkDist = radius * (0.8 + Math.random() * 0.4);
          ctx.fillStyle = '#ffcc00';
          ctx.fillRect(
            x + Math.cos(angle) * sparkDist - 2,
            y + Math.sin(angle) * sparkDist - 2,
            4,
            4
          );
        }

        ctx.restore();
      } else if (anim.type === 'thruster' && anim.direction !== undefined) {
        // Thruster flame animation
        const flameLength = HEX_SIZE * 0.8 * (1 - progress);
        const alpha = 1 - progress;

        ctx.save();
        ctx.translate(x, y);
        // Thruster points opposite to movement direction
        const thrusterAngle = ((directionToAngle(anim.direction) + 180) * Math.PI) / 180;
        ctx.rotate(thrusterAngle);

        ctx.globalAlpha = alpha;
        const gradient = ctx.createLinearGradient(0, 0, flameLength, 0);
        gradient.addColorStop(0, '#00aaff');
        gradient.addColorStop(0.5, '#0066ff');
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(flameLength, 0);
        ctx.lineTo(0, 6);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      } else if (anim.type === 'laser' && anim.direction !== undefined) {
        // Laser beam animation
        const alpha = 1 - progress;
        ctx.save();
        ctx.translate(x, y);
        const laserAngle = (directionToAngle(anim.direction) * Math.PI) / 180;
        ctx.rotate(laserAngle);

        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(HEX_SIZE * 3, 0);
        ctx.stroke();

        ctx.restore();
      }
    });

    ctx.restore();
  }, [
    game,
    boardHexes,
    selectedShipId,
    cameraOffset,
    animations,
    imagesLoaded,
    getPlannedPosition,
    getPlannedFacing,
    getValidMoves,
  ]);

  useEffect(() => {
    render();
  }, [render, plannedActions]);

  // Animation frame loop for smooth animations
  useEffect(() => {
    if (animations.length === 0) return;

    let animationFrame: number;
    const animate = () => {
      render();
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [animations.length, render]);

  // Handle canvas click
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!game || !isMyTurn()) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - canvas.width / 2 - cameraOffset.x;
      const mouseY = e.clientY - rect.top - canvas.height / 2 - cameraOffset.y;

      // Find clicked hex
      let clickedHex: HexCoord | null = null;
      let minDist = Infinity;

      boardHexes.forEach((hex) => {
        const { x, y } = hexToPixel(hex, HEX_SIZE);
        const dist = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);
        if (dist < HEX_SIZE && dist < minDist) {
          minDist = dist;
          clickedHex = hex;
        }
      });

      if (!clickedHex) return;

      // Check if clicked on a ship
      const clickedShip = game.ships.find(
        (s) => !s.destroyed && hexEqual(getPlannedPosition(s.id), clickedHex!)
      );

      if (clickedShip && clickedShip.ownerId === game.currentPlayerId) {
        selectShip(clickedShip.id);
      } else if (selectedShipId) {
        // Try to move selected ship
        moveShip(selectedShipId, clickedHex);
      }
    },
    [game, boardHexes, cameraOffset, selectedShipId, selectShip, moveShip, getPlannedPosition, isMyTurn]
  );

  // Camera drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
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

  const currentPlayer = getCurrentPlayer();
  const totalPlannedAP = getTotalPlannedAP();
  const remainingAP = game ? game.playerAPRemaining - totalPlannedAP : 0;

  // Main menu
  if (!game) {
    return (
      <div className="menu">
        <h1>HEXARCH</h1>
        <h2>Strategic Hex Combat</h2>
        <button onClick={() => startGame(true)}>Play vs AI</button>
        <button onClick={() => startGame(false)}>Local 2 Player</button>
      </div>
    );
  }

  // Game ended
  if (game.winnerId) {
    const winner = game.players.find((p) => p.id === game.winnerId);
    return (
      <div className="menu">
        <h1>{winner?.name} Wins!</h1>
        <h2>Turn {game.turnNumber}</h2>
        <button onClick={returnToMenu}>Back to Menu</button>
      </div>
    );
  }

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
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      />

      {/* Top bar */}
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

      {/* Left panel - Ship list */}
      <div className="left-panel">
        <h3>Your Ships</h3>
        {game.ships
          .filter((s) => s.ownerId === game.currentPlayerId && !s.destroyed)
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

      {/* Right panel - Controls */}
      {isMyTurn() && (
        <div className="right-panel">
          {selectedShip && (
            <>
              <h3>Rotate {SHIP_NAMES[selectedShip.type]}</h3>
              <div className="rotate-buttons">
                {([5, 0, 1, 4, -1, 2] as (HexDirection | -1)[]).map((dir, idx) => {
                  if (dir === -1) return <div key={idx} />;
                  const dirLabels = ['E', 'SE', 'SW', 'W', 'NW', 'NE'];
                  const currentFacing = getPlannedFacing(selectedShipId!);
                  const isCurrentDir = currentFacing === dir;
                  return (
                    <button
                      key={dir}
                      onClick={() => rotateShip(selectedShipId!, dir)}
                      className="rotate-btn"
                      disabled={isCurrentDir}
                      style={{ opacity: isCurrentDir ? 0.5 : 1 }}
                    >
                      {dirLabels[dir]}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: '12px', marginBottom: '10px', color: '#888' }}>
                Facing: {['East', 'SE', 'SW', 'West', 'NW', 'NE'][getPlannedFacing(selectedShipId!)]}
              </div>
            </>
          )}

          <h3>Actions</h3>
          <button onClick={undoLast} disabled={plannedActions.length === 0}>
            Undo Last
          </button>
          <button onClick={clearPlans} disabled={plannedActions.length === 0}>
            Clear All
          </button>
          <button onClick={endTurn} className="end-turn-btn">
            End Turn
          </button>
          <button onClick={returnToMenu}>Quit Game</button>
        </div>
      )}

      {/* Planned moves indicator */}
      {totalPlannedAP > 0 && (
        <div className="planned-indicator">
          Planned: {totalPlannedAP} AP | {plannedActions.length} action(s)
        </div>
      )}
    </div>
  );
};
