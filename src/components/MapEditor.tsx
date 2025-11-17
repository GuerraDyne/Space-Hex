import React, { useState, useCallback, useRef, useEffect } from 'react';
import { HexCoord, GameMap } from '@/types/game';
import { hexToPixel, pixelToHex, generateHexagonalBoard, hexToKey, keyToHex } from '@/engine/hexGrid';
import { soundManager } from '@/sounds/soundManager';

interface MapEditorProps {
  onSave: (map: GameMap) => void;
  onClose: () => void;
}

type EditorTool = 'debris' | 'zone0' | 'zone1' | 'zone2' | 'zone3' | 'eraser';

export const MapEditor: React.FC<MapEditorProps> = ({ onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapName, setMapName] = useState('Custom Map');
  const [radius, setRadius] = useState(5);
  const [hexes, setHexes] = useState<HexCoord[]>([]);
  const [debris, setDebris] = useState<Set<string>>(new Set());
  const [zones, setZones] = useState<Set<string>[]>([
    new Set(),
    new Set(),
    new Set(),
    new Set(),
  ]);
  const [selectedTool, setSelectedTool] = useState<EditorTool>('debris');
  const hexSize = 30;

  // Generate initial hexes
  useEffect(() => {
    const newHexes = generateHexagonalBoard(radius);
    setHexes(newHexes);
    setDebris(new Set());
    setZones([new Set(), new Set(), new Set(), new Set()]);
  }, [radius]);

  // Render map
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);

    // Draw hexes
    hexes.forEach((hex) => {
      const { x, y } = hexToPixel(hex, hexSize);
      const key = hexToKey(hex);

      // Determine color
      let fillColor = '#1a1a2e';
      let strokeColor = '#16213e';

      // Check zones
      zones.forEach((zone, index) => {
        if (zone.has(key)) {
          const zoneColors = ['#224422', '#442222', '#222244', '#444422'];
          fillColor = zoneColors[index];
          strokeColor = zoneColors[index].replace(/2/g, '4');
        }
      });

      // Check debris
      if (debris.has(key)) {
        fillColor = '#444444';
        strokeColor = '#666666';
      }

      // Draw hex
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const hx = x + hexSize * Math.cos(angle);
        const hy = y + hexSize * Math.sin(angle);
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
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw debris marker
      if (debris.has(key)) {
        ctx.fillStyle = '#888888';
        ctx.fillText('D', x - 4, y + 4);
      }
    });

    ctx.restore();
  }, [hexes, debris, zones, hexSize]);

  useEffect(() => {
    render();
  }, [render]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - canvas.width / 2;
    const mouseY = e.clientY - rect.top - canvas.height / 2;

    const clickedHex = pixelToHex(mouseX, mouseY, hexSize);
    const key = hexToKey(clickedHex);

    // Check if hex exists in map
    const hexExists = hexes.some((h) => h.q === clickedHex.q && h.r === clickedHex.r);
    if (!hexExists) return;

    soundManager.play('button_click');

    if (selectedTool === 'debris') {
      const newDebris = new Set(debris);
      if (newDebris.has(key)) {
        newDebris.delete(key);
      } else {
        newDebris.add(key);
      }
      setDebris(newDebris);
    } else if (selectedTool === 'eraser') {
      // Remove from all
      const newDebris = new Set(debris);
      newDebris.delete(key);
      setDebris(newDebris);

      const newZones = zones.map((zone) => {
        const newZone = new Set(zone);
        newZone.delete(key);
        return newZone;
      });
      setZones(newZones);
    } else {
      // Zone tool
      const zoneIndex = parseInt(selectedTool.replace('zone', ''));
      const newZones = zones.map((zone, index) => {
        const newZone = new Set(zone);
        if (index === zoneIndex) {
          if (newZone.has(key)) {
            newZone.delete(key);
          } else {
            newZone.add(key);
          }
        }
        return newZone;
      });
      setZones(newZones);
    }
  };

  const handleSave = () => {
    const deploymentZones = zones.map((zone) =>
      Array.from(zone).map((key) => keyToHex(key))
    );

    const debrisPositions = Array.from(debris).map((key) => keyToHex(key));

    const map: GameMap = {
      id: `custom_${Date.now()}`,
      name: mapName,
      hexes,
      deploymentZones,
      initialDebris: debrisPositions,
    };

    soundManager.play('button_click');
    onSave(map);
  };

  const handleClear = () => {
    soundManager.play('button_click');
    setDebris(new Set());
    setZones([new Set(), new Set(), new Set(), new Set()]);
  };

  return (
    <div className="map-editor">
      <div className="editor-header">
        <h2>Map Editor</h2>
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="editor-content">
        <div className="editor-sidebar">
          <div className="setting-group">
            <label>Map Name:</label>
            <input
              type="text"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
              maxLength={30}
            />
          </div>

          <div className="setting-group">
            <label>Map Radius:</label>
            <input
              type="number"
              value={radius}
              onChange={(e) => setRadius(Math.max(3, Math.min(8, Number(e.target.value))))}
              min={3}
              max={8}
            />
          </div>

          <div className="tools">
            <h4>Tools</h4>
            <button
              className={`tool-btn ${selectedTool === 'debris' ? 'selected' : ''}`}
              onClick={() => setSelectedTool('debris')}
            >
              Debris Field
            </button>
            <button
              className={`tool-btn zone0 ${selectedTool === 'zone0' ? 'selected' : ''}`}
              onClick={() => setSelectedTool('zone0')}
            >
              Zone 1 (East)
            </button>
            <button
              className={`tool-btn zone1 ${selectedTool === 'zone1' ? 'selected' : ''}`}
              onClick={() => setSelectedTool('zone1')}
            >
              Zone 2 (South)
            </button>
            <button
              className={`tool-btn zone2 ${selectedTool === 'zone2' ? 'selected' : ''}`}
              onClick={() => setSelectedTool('zone2')}
            >
              Zone 3 (West)
            </button>
            <button
              className={`tool-btn zone3 ${selectedTool === 'zone3' ? 'selected' : ''}`}
              onClick={() => setSelectedTool('zone3')}
            >
              Zone 4 (North)
            </button>
            <button
              className={`tool-btn ${selectedTool === 'eraser' ? 'selected' : ''}`}
              onClick={() => setSelectedTool('eraser')}
            >
              Eraser
            </button>
          </div>

          <div className="editor-actions">
            <button className="action-btn" onClick={handleClear}>
              Clear All
            </button>
            <button className="action-btn primary" onClick={handleSave}>
              Save Map
            </button>
          </div>

          <div className="editor-info">
            <p>Debris: {debris.size}</p>
            <p>Zone 1: {zones[0].size} hexes</p>
            <p>Zone 2: {zones[1].size} hexes</p>
            <p>Zone 3: {zones[2].size} hexes</p>
            <p>Zone 4: {zones[3].size} hexes</p>
          </div>
        </div>

        <div className="editor-canvas-container">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            onClick={handleCanvasClick}
            style={{ backgroundColor: '#0a0a1a', cursor: 'crosshair' }}
          />
        </div>
      </div>
    </div>
  );
};
