import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  HexCoord,
  HexDirection,
  Ship,
  DebrisField,
  Animation,
  PlayerColor,
} from '@/types/game';
import { hexToPixel, directionToAngle, hexToKey } from '@/engine/hexGrid';
import { useGameStore } from '@/game/gameStore';
import { soundManager } from '@/sounds/soundManager';

interface HexRendererProps {
  width: number;
  height: number;
  hexSize: number;
}

const PLAYER_COLORS: Record<PlayerColor, string> = {
  blue: '#4488ff',
  red: '#ff4444',
  green: '#44ff44',
  yellow: '#ffff44',
};

export const HexRenderer: React.FC<HexRendererProps> = ({
  width,
  height,
  hexSize,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  const {
    gameState,
    selectedShipId,
    pendingActions,
    animations,
    selectShip,
    addPendingMove,
    addPendingTurn,
    removeAnimation,
  } = useGameStore();

  // Ship image cache
  const shipImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Load ship images
  useEffect(() => {
    if (!gameState) return;

    const shipTypes = [
      'scout',
      'interceptor',
      'corvette',
      'frigate',
      'destroyer',
      'cruiser',
      'artillery',
      'battleship',
      'mothership',
    ];
    const colors = ['blue', 'red', 'green', 'yellow'];
    const toLoad: { key: string; src: string }[] = [];

    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    colors.forEach((color) => {
      shipTypes.forEach((type) => {
        const key = `${color}_${type}`;
        let fileName: string;

        if (type === 'mothership') {
          // Command ships use underscores: Blue_Command_Ship.png
          fileName = `${capitalize(color)}_Command_Ship.png`;
        } else {
          // Regular ships use spaces: Blue Artillery.png
          fileName = `${capitalize(color)} ${capitalize(type)}.png`;
        }

        toLoad.push({ key, src: `/assets/ships/${encodeURIComponent(fileName)}` });
      });
    });

    let loadedCount = 0;
    toLoad.forEach(({ key, src }) => {
      const img = new Image();
      img.onload = () => {
        shipImagesRef.current.set(key, img);
        loadedCount++;
        if (loadedCount === toLoad.length) {
          setImagesLoaded(true);
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === toLoad.length) {
          setImagesLoaded(true);
        }
      };
      img.src = src;
    });
  }, [gameState]);

  // Draw a single hex
  const drawHex = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      size: number,
      fillColor: string,
      strokeColor: string,
      lineWidth: number = 1
    ) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const hx = x + size * Math.cos(angle);
        const hy = y + size * Math.sin(angle);
        if (i === 0) {
          ctx.moveTo(hx, hy);
        } else {
          ctx.lineTo(hx, hy);
        }
      }
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    },
    []
  );

  // Draw thruster flame effect
  const drawThruster = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      angle: number,
      intensity: number
    ) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((angle * Math.PI) / 180 + Math.PI); // Opposite direction of movement

      const flameLength = 20 * intensity;
      const flameWidth = 8;

      // Outer flame (orange/red)
      const gradient = ctx.createLinearGradient(0, 0, flameLength, 0);
      gradient.addColorStop(0, 'rgba(255, 100, 0, 0.8)');
      gradient.addColorStop(0.5, 'rgba(255, 200, 0, 0.6)');
      gradient.addColorStop(1, 'rgba(255, 255, 100, 0)');

      ctx.beginPath();
      ctx.moveTo(0, -flameWidth);
      ctx.lineTo(flameLength, 0);
      ctx.lineTo(0, flameWidth);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Inner flame (white/yellow)
      const innerGradient = ctx.createLinearGradient(0, 0, flameLength * 0.6, 0);
      innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      innerGradient.addColorStop(1, 'rgba(255, 255, 200, 0)');

      ctx.beginPath();
      ctx.moveTo(0, -flameWidth * 0.5);
      ctx.lineTo(flameLength * 0.6, 0);
      ctx.lineTo(0, flameWidth * 0.5);
      ctx.closePath();
      ctx.fillStyle = innerGradient;
      ctx.fill();

      ctx.restore();
    },
    []
  );

  // Draw explosion effect
  const drawExplosion = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      progress: number // 0 to 1
    ) => {
      const maxRadius = hexSize * 1.5;
      const radius = maxRadius * progress;

      // Multiple expanding rings
      for (let ring = 0; ring < 3; ring++) {
        const ringProgress = Math.max(0, progress - ring * 0.15);
        if (ringProgress <= 0) continue;

        const ringRadius = maxRadius * ringProgress;
        const alpha = Math.max(0, 1 - ringProgress);

        ctx.beginPath();
        ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, ${150 - ring * 50}, 0, ${alpha})`;
        ctx.lineWidth = 3 - ring;
        ctx.stroke();
      }

      // Central flash
      if (progress < 0.3) {
        const flashIntensity = 1 - progress / 0.3;
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 200, ${flashIntensity})`;
        ctx.fill();
      }

      // Particle debris
      const numParticles = 12;
      for (let i = 0; i < numParticles; i++) {
        const angle = (i / numParticles) * Math.PI * 2;
        const particleRadius = radius * (0.8 + Math.random() * 0.4);
        const px = x + Math.cos(angle) * particleRadius;
        const py = y + Math.sin(angle) * particleRadius;
        const alpha = Math.max(0, 1 - progress);

        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, ${100 + Math.random() * 100}, 0, ${alpha})`;
        ctx.fill();
      }
    },
    [hexSize]
  );

  // Draw laser shot
  const drawLaser = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      progress: number
    ) => {
      const dx = toX - fromX;
      const dy = toY - fromY;

      // Laser beam
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(fromX + dx * progress, fromY + dy * progress);
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Glow effect
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(fromX + dx * progress, fromY + dy * progress);
      ctx.strokeStyle = 'rgba(255, 100, 100, 0.4)';
      ctx.lineWidth = 8;
      ctx.stroke();
    },
    []
  );

  // Draw debris field
  const drawDebris = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      ctx.save();
      ctx.translate(x, y);

      // Draw scattered debris pieces
      const debrisPieces = 8;
      for (let i = 0; i < debrisPieces; i++) {
        const angle = (i / debrisPieces) * Math.PI * 2;
        const dist = hexSize * 0.3 + Math.sin(i * 1.7) * hexSize * 0.2;
        const px = Math.cos(angle) * dist;
        const py = Math.sin(angle) * dist;
        const size = 3 + Math.sin(i * 2.3) * 2;

        ctx.fillStyle = '#666666';
        ctx.fillRect(px - size / 2, py - size / 2, size, size);
      }

      ctx.restore();
    },
    [hexSize]
  );

  // Main render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    // Apply camera transform
    ctx.translate(width / 2 + cameraOffset.x, height / 2 + cameraOffset.y);
    ctx.scale(zoom, zoom);

    // Draw hex grid
    const hexes = gameState.map.hexes;
    hexes.forEach((hex) => {
      const { x, y } = hexToPixel(hex, hexSize);

      // Determine hex color based on state
      let fillColor = '#1a1a2e';
      let strokeColor = '#16213e';
      let lineWidth = 1;

      // Check if in deployment zone
      if (gameState.phase === 'deployment' || gameState.phase === 'zone_selection') {
        gameState.map.deploymentZones.forEach((zone, index) => {
          if (zone.some((h) => h.q === hex.q && h.r === hex.r)) {
            const player = gameState.players.find((p) => p.deploymentZone === index);
            if (player) {
              fillColor = PLAYER_COLORS[player.color] + '33';
              strokeColor = PLAYER_COLORS[player.color];
            } else {
              fillColor = '#2a2a4e';
              strokeColor = '#4a4a6e';
            }
          }
        });
      }

      // Highlight selected ship's possible moves
      if (selectedShipId) {
        const ship = gameState.players
          .flatMap((p) => p.ships)
          .find((s) => s.id === selectedShipId);
        if (ship) {
          // Get current position considering pending moves
          let currentPos = ship.position;
          const pending = pendingActions.get(selectedShipId);
          if (pending) {
            pending.moves.forEach((move) => {
              if (move.type === 'move') {
                currentPos = move.to as HexCoord;
              }
            });
          }

          // Highlight adjacent hexes
          const dist = Math.abs(hex.q - currentPos.q) + Math.abs(hex.r - currentPos.r);
          if (dist === 1 || (hex.q !== currentPos.q && hex.r !== currentPos.r && dist === 2)) {
            // Check if adjacent (axial distance = 1)
            const isAdjacent =
              (Math.abs(hex.q - currentPos.q) <= 1 &&
                Math.abs(hex.r - currentPos.r) <= 1 &&
                Math.abs(hex.q - currentPos.q + hex.r - currentPos.r) <= 1);
            if (isAdjacent && (hex.q !== currentPos.q || hex.r !== currentPos.r)) {
              fillColor = '#3a5a3a';
              strokeColor = '#5a9a5a';
              lineWidth = 2;
            }
          }
        }
      }

      drawHex(ctx, x, y, hexSize, fillColor, strokeColor, lineWidth);
    });

    // Draw debris fields
    gameState.debris.forEach((debris) => {
      const { x, y } = hexToPixel(debris.position, hexSize);
      drawDebris(ctx, x, y);
    });

    // Draw ships
    gameState.players.forEach((player) => {
      player.ships.forEach((ship) => {
        if (!ship.isDeployed || ship.isDestroyed) return;

        // Get current position/rotation considering animations
        let pos = ship.position;
        let rotation = directionToAngle(ship.facing);

        // Check for pending moves (preview)
        const pending = pendingActions.get(ship.id);
        if (pending) {
          pending.moves.forEach((move) => {
            if (move.type === 'move') {
              pos = move.to as HexCoord;
            } else if (move.type === 'turn') {
              rotation = directionToAngle(move.to as HexDirection);
            }
          });
        }

        const { x, y } = hexToPixel(pos, hexSize);

        // Draw ship
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((rotation * Math.PI) / 180);

        const imageKey = `${player.color}_${ship.type}`;
        const shipImage = shipImagesRef.current.get(imageKey);

        if (shipImage && imagesLoaded) {
          const shipSize = hexSize * 1.5;
          ctx.drawImage(
            shipImage,
            -shipSize / 2,
            -shipSize / 2,
            shipSize,
            shipSize
          );
        } else {
          // Fallback: draw colored triangle
          ctx.beginPath();
          ctx.moveTo(hexSize * 0.6, 0);
          ctx.lineTo(-hexSize * 0.3, -hexSize * 0.4);
          ctx.lineTo(-hexSize * 0.3, hexSize * 0.4);
          ctx.closePath();
          ctx.fillStyle = PLAYER_COLORS[player.color];
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.restore();

        // Highlight selected ship
        if (ship.id === selectedShipId) {
          ctx.beginPath();
          ctx.arc(x, y, hexSize * 0.8, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    });

    // Process animations
    const currentTime = Date.now();
    animations.forEach((anim) => {
      const elapsed = currentTime - anim.startTime;
      if (elapsed < 0) return; // Not started yet

      const progress = Math.min(1, elapsed / anim.duration);

      if (progress >= 1) {
        removeAnimation(anim.id);
        return;
      }

      switch (anim.type) {
        case 'thruster': {
          const from = anim.data.from as HexCoord;
          const to = anim.data.to as HexCoord;
          const { x: fromX, y: fromY } = hexToPixel(from, hexSize);
          const { x: toX, y: toY } = hexToPixel(to, hexSize);
          const angle = Math.atan2(toY - fromY, toX - fromX) * (180 / Math.PI);
          const currentX = fromX + (toX - fromX) * progress;
          const currentY = fromY + (toY - fromY) * progress;
          drawThruster(ctx, currentX, currentY, angle, 1 - progress * 0.5);
          if (progress < 0.1) soundManager.play('thruster');
          break;
        }
        case 'explode': {
          const pos = anim.data.position as HexCoord;
          const { x, y } = hexToPixel(pos, hexSize);
          drawExplosion(ctx, x, y, progress);
          if (progress < 0.1) soundManager.play('explosion');
          break;
        }
        case 'shoot': {
          const from = anim.data.from as HexCoord;
          const to = anim.data.to as HexCoord;
          const { x: fromX, y: fromY } = hexToPixel(from, hexSize);
          const { x: toX, y: toY } = hexToPixel(to, hexSize);
          drawLaser(ctx, fromX, fromY, toX, toY, progress);
          if (progress < 0.1) soundManager.play('laser');
          break;
        }
      }
    });

    ctx.restore();

    animationFrameRef.current = requestAnimationFrame(render);
  }, [
    gameState,
    width,
    height,
    hexSize,
    cameraOffset,
    zoom,
    selectedShipId,
    pendingActions,
    animations,
    imagesLoaded,
    drawHex,
    drawThruster,
    drawExplosion,
    drawLaser,
    drawDebris,
    removeAnimation,
  ]);

  // Start render loop
  useEffect(() => {
    render();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [render]);

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setCameraOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!gameState || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Convert to world coordinates
      const worldX = (mouseX - width / 2 - cameraOffset.x) / zoom;
      const worldY = (mouseY - height / 2 - cameraOffset.y) / zoom;

      // Find clicked hex
      let clickedHex: HexCoord | null = null;
      let minDist = Infinity;

      gameState.map.hexes.forEach((hex) => {
        const { x, y } = hexToPixel(hex, hexSize);
        const dist = Math.sqrt((worldX - x) ** 2 + (worldY - y) ** 2);
        if (dist < hexSize && dist < minDist) {
          minDist = dist;
          clickedHex = hex;
        }
      });

      if (!clickedHex) return;

      // Check if clicked on a ship
      let clickedShip: Ship | null = null;
      gameState.players.forEach((player) => {
        player.ships.forEach((ship) => {
          if (
            ship.isDeployed &&
            !ship.isDestroyed &&
            ship.position.q === clickedHex!.q &&
            ship.position.r === clickedHex!.r
          ) {
            clickedShip = ship;
          }
        });
      });

      if (clickedShip) {
        selectShip(clickedShip.id);
        soundManager.play('button_click');
      } else if (selectedShipId) {
        // Try to move selected ship to clicked hex
        const success = addPendingMove(selectedShipId, clickedHex);
        if (success) {
          soundManager.play('button_click');
        }
      }
    },
    [
      gameState,
      width,
      height,
      cameraOffset,
      zoom,
      hexSize,
      selectedShipId,
      selectShip,
      addPendingMove,
    ]
  );

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.max(0.5, Math.min(2, prev * delta)));
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
      onWheel={handleWheel}
      style={{
        cursor: isDragging ? 'grabbing' : 'grab',
        backgroundColor: '#0a0a1a',
      }}
    />
  );
};
