import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from './game/gameStore';
import { HexCoord, HexDirection, SHIP_STATS, PLAYER_MAX_AP } from './types/game';
import { hexToPixel, directionToAngle, hexEqual, getNeighbor } from './engine/hexGrid';
import './styles.css';

export const App: React.FC = () => {
  const {
    game,
    boardHexes,
    plannedActions,
    selectedShipId,
    startGame,
    selectShip,
    planMove,
    planRotate,
    undoLastPlan,
    clearPlans,
    endTurn,
    returnToMenu,
    getPlannedPosition,
    getPlannedFacing,
    getTotalPlannedAP,
    getShipPlannedAP,
    getCurrentPlayer,
    isCurrentPlayerAI,
  } = useGameStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const HEX_SIZE = 40;

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Render game board
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !game) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2 + cameraOffset.x, canvas.height / 2 + cameraOffset.y);

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
      if (selectedShipId) {
        const selectedPos = getPlannedPosition(selectedShipId);
        for (let dir = 0; dir < 6; dir++) {
          if (hexEqual(getNeighbor(selectedPos, dir as HexDirection), hex)) {
            fillColor = '#2a3a2a';
            break;
          }
        }
      }

      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = '#3a3a5a';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw debris
    game.debris.forEach((debris) => {
      const { x, y } = hexToPixel(debris.position, HEX_SIZE);
      ctx.fillStyle = '#555555';
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const dist = 10 + Math.sin(i * 2.3) * 5;
        ctx.fillRect(x + Math.cos(angle) * dist - 3, y + Math.sin(angle) * dist - 3, 6, 6);
      }
    });

    // Draw ships
    game.ships.forEach((ship) => {
      if (ship.destroyed) return;

      const pos = getPlannedPosition(ship.id);
      const facing = getPlannedFacing(ship.id);
      const { x, y } = hexToPixel(pos, HEX_SIZE);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((directionToAngle(facing) * Math.PI) / 180);

      // Ship shape
      ctx.beginPath();
      const size = HEX_SIZE * 0.6;
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.5, -size * 0.6);
      ctx.lineTo(-size * 0.3, 0);
      ctx.lineTo(-size * 0.5, size * 0.6);
      ctx.closePath();

      const owner = game.players.find((p) => p.id === ship.ownerId);
      ctx.fillStyle = owner?.color || '#ffffff';
      ctx.fill();

      // Mothership special marker
      if (ship.type === 'mothership') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();

      // Selection highlight
      if (ship.id === selectedShipId) {
        ctx.beginPath();
        ctx.arc(x, y, HEX_SIZE * 0.8, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Ship type label
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(SHIP_STATS[ship.type].name[0], x, y + HEX_SIZE + 12);
    });

    ctx.restore();
  }, [game, boardHexes, selectedShipId, cameraOffset, getPlannedPosition, getPlannedFacing]);

  useEffect(() => {
    render();
  }, [render, plannedActions]);

  // Handle canvas click
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!game || isCurrentPlayerAI()) return;

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
        planMove(selectedShipId, clickedHex);
      }
    },
    [game, boardHexes, cameraOffset, selectedShipId, selectShip, planMove, getPlannedPosition, isCurrentPlayerAI]
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
        <button onClick={returnToMenu}>Back to Menu</button>
      </div>
    );
  }

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
        <div style={{ color: currentPlayer?.color }}>
          {currentPlayer?.name}'s Turn
          {isCurrentPlayerAI() && ' (AI thinking...)'}
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
              <div>{SHIP_STATS[ship.type].name}</div>
              <div className="ship-ap">
                AP: {getShipPlannedAP(ship.id)} / {ship.maxAP}
              </div>
            </div>
          ))}
      </div>

      {/* Right panel - Controls */}
      {!isCurrentPlayerAI() && (
        <div className="right-panel">
          {selectedShipId && (
            <>
              <h3>Rotate Ship</h3>
              <div className="rotate-buttons">
                {([0, 1, 2, 3, 4, 5] as HexDirection[]).map((dir) => (
                  <button key={dir} onClick={() => planRotate(selectedShipId, dir)} className="rotate-btn">
                    {['E', 'SE', 'SW', 'W', 'NW', 'NE'][dir]}
                  </button>
                ))}
              </div>
            </>
          )}

          <h3>Actions</h3>
          <button onClick={undoLastPlan} disabled={plannedActions.length === 0}>
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
          Planned: {totalPlannedAP} AP
        </div>
      )}
    </div>
  );
};
