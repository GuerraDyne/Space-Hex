import React from 'react'
import type { MapData, HexType } from '../types'
import './ControlPanel.css'

interface Props {
  mapData: MapData
  setMapData: React.Dispatch<React.SetStateAction<MapData>>
  selectedTool: HexType
  setSelectedTool: React.Dispatch<React.SetStateAction<HexType>>
  selectedZone: number
  setSelectedZone: React.Dispatch<React.SetStateAction<number>>
  showGrid: boolean
  setShowGrid: React.Dispatch<React.SetStateAction<boolean>>
  symmetryMode: 'none' | 'horizontal' | 'vertical' | 'rotational'
  setSymmetryMode: React.Dispatch<React.SetStateAction<'none' | 'horizontal' | 'vertical' | 'rotational'>>
}

const ControlPanel: React.FC<Props> = ({
  mapData,
  setMapData,
  selectedTool,
  setSelectedTool,
  selectedZone,
  setSelectedZone,
  showGrid,
  setShowGrid,
  symmetryMode,
  setSymmetryMode
}) => {
  const hexTypes: HexType[] = [
    'normal',
    'corridor',
    'room',
    'obstacle',
    'door',
    'deployment',
    'spawn',
    'objective',
    'exit',
    'debris',
    'overwatch'
  ]

  const handleClearMap = () => {
    if (confirm('Clear all hexes from the map?')) {
      setMapData(prev => ({
        ...prev,
        hexes: [],
        deploymentZones: {}
      }))
    }
  }

  const handleGenerateTemplate = (template: string) => {
    switch (template) {
      case 'standard':
        // Generate standard 91-hex map
        generateStandardMap()
        break
      case '2player':
        // Generate 2-player competitive map
        generate2PlayerMap()
        break
      case '4player':
        // Generate 4-player FFA map
        generate4PlayerMap()
        break
      case 'capture':
        // Generate capture point map
        generateCaptureMap()
        break
    }
  }

  const generateStandardMap = () => {
    const hexes: MapData['hexes'] = []
    const zones: MapData['deploymentZones'] = {}
    
    // Create the standard 91-hex pattern (matching the game)
    const pattern = [
      { row: 1, cols: ['d', 'e', 'f', 'g', 'h'] },
      { row: 2, cols: ['c', 'd', 'e', 'f', 'g', 'h', 'i'] },
      { row: 3, cols: ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] },
      { row: 4, cols: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'] },
      { row: 5, cols: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'] },
      { row: 6, cols: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'] },
      { row: 7, cols: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'] },
      { row: 8, cols: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'] },
      { row: 9, cols: ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] },
      { row: 10, cols: ['c', 'd', 'e', 'f', 'g', 'h', 'i'] },
      { row: 11, cols: ['d', 'e', 'f', 'g', 'h'] }
    ]
    
    pattern.forEach(({ row, cols }) => {
      cols.forEach(col => {
        const colIndex = col.charCodeAt(0) - 'a'.charCodeAt(0)
        const q = colIndex - Math.floor(row / 2)
        const r = row
        hexes.push({
          col,
          row,
          q,
          r,
          type: 'normal'
        })
      })
    })
    
    setMapData(prev => ({
      ...prev,
      hexes,
      deploymentZones: zones
    }))
  }

  const generate2PlayerMap = () => {
    generateStandardMap()
    
    // Add deployment zones on opposite sides
    setMapData(prev => {
      const newHexes = [...prev.hexes]
      const zones: MapData['deploymentZones'] = {}
      
      // Zone 1 (East)
      const zone1Hexes = ['i3', 'j3', 'j4', 'k4', 'k5', 'k6', 'k7', 'k8', 'j8', 'j9', 'i9']
      zone1Hexes.forEach(hex => {
        const [col, row] = [hex[0], parseInt(hex.substring(1))]
        const idx = newHexes.findIndex(h => h.col === col && h.row === row)
        if (idx !== -1) {
          newHexes[idx].type = 'deployment'
          newHexes[idx].zone = 1
        }
      })
      
      zones[1] = {
        zone: 1,
        name: 'East Zone',
        color: '#4444ff',
        hexes: zone1Hexes.map(h => h.replace('', ',')),
        spawnPoints: 10,
        isStartingZone: true
      }
      
      // Zone 2 (West)
      const zone2Hexes = ['b3', 'c3', 'a4', 'a5', 'a6', 'a7', 'a8', 'b9', 'c9']
      zone2Hexes.forEach(hex => {
        const [col, row] = [hex[0], parseInt(hex.substring(1))]
        const idx = newHexes.findIndex(h => h.col === col && h.row === row)
        if (idx !== -1) {
          newHexes[idx].type = 'deployment'
          newHexes[idx].zone = 2
        }
      })
      
      zones[2] = {
        zone: 2,
        name: 'West Zone',
        color: '#ff4444',
        hexes: zone2Hexes.map(h => h.replace('', ',')),
        spawnPoints: 10,
        isStartingZone: true
      }
      
      return {
        ...prev,
        hexes: newHexes,
        deploymentZones: zones
      }
    })
  }

  const generate4PlayerMap = () => {
    generateStandardMap()
    
    // Add 4 deployment zones in corners
    setMapData(prev => {
      const newHexes = [...prev.hexes]
      const zones: MapData['deploymentZones'] = {}
      
      // Zone 1 (NE)
      const zone1Hexes = ['g1', 'h1', 'h2', 'i2', 'i3', 'j3']
      // Zone 2 (SE)
      const zone2Hexes = ['i9', 'j9', 'h10', 'i10', 'g11', 'h11']
      // Zone 3 (SW)
      const zone3Hexes = ['b9', 'c9', 'c10', 'd10', 'd11', 'e11']
      // Zone 4 (NW)
      const zone4Hexes = ['d1', 'e1', 'c2', 'd2', 'b3', 'c3']
      
      const allZones = [
        { id: 1, hexes: zone1Hexes, name: 'Northeast' },
        { id: 2, hexes: zone2Hexes, name: 'Southeast' },
        { id: 3, hexes: zone3Hexes, name: 'Southwest' },
        { id: 4, hexes: zone4Hexes, name: 'Northwest' }
      ]
      
      allZones.forEach(zone => {
        zone.hexes.forEach(hex => {
          const [col, row] = [hex[0], parseInt(hex.substring(1))]
          const idx = newHexes.findIndex(h => h.col === col && h.row === row)
          if (idx !== -1) {
            newHexes[idx].type = 'deployment'
            newHexes[idx].zone = zone.id
          }
        })
        
        zones[zone.id] = {
          zone: zone.id,
          name: zone.name,
          color: ['#4444ff', '#ff4444', '#44ff44', '#ffff44'][zone.id - 1],
          hexes: zone.hexes.map(h => h.replace('', ',')),
          spawnPoints: 7,
          isStartingZone: true
        }
      })
      
      return {
        ...prev,
        hexes: newHexes,
        deploymentZones: zones,
        gameConfig: {
          ...prev.gameConfig,
          maxPlayers: 4
        }
      }
    })
  }

  const generateCaptureMap = () => {
    generate2PlayerMap()
    
    // Add capture points in the center
    setMapData(prev => {
      const newHexes = [...prev.hexes]
      const capturePoints = ['e5', 'f5', 'g5', 'e6', 'f6', 'g6', 'e7', 'f7', 'g7']
      
      capturePoints.forEach(hex => {
        const [col, row] = [hex[0], parseInt(hex.substring(1))]
        const idx = newHexes.findIndex(h => h.col === col && h.row === row)
        if (idx !== -1) {
          newHexes[idx].type = 'objective'
        }
      })
      
      return {
        ...prev,
        hexes: newHexes,
        gameConfig: {
          ...prev.gameConfig,
          winCondition: 'capture',
          specialRules: {
            ...prev.gameConfig.specialRules,
            capturePoints
          }
        }
      }
    })
  }

  const generateSpaceHulkTemplate = () => {
    // Clear existing map
    const newHexes: MapData['hexes'] = []
    const zones: MapData['deploymentZones'] = {}
    
    // Create a Space Hulk Tactics-style corridor map
    // Main corridor running east-west through center
    for (let col = 'c'; col <= 'i'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
      const colIndex = col.charCodeAt(0) - 'a'.charCodeAt(0)
      const q = colIndex - Math.floor(6 / 2)
      const r = 6
      newHexes.push({
        col,
        row: 6,
        q,
        r,
        type: 'corridor'
      })
    }
    
    // North-south corridor at column 'f'
    for (let row = 3; row <= 9; row++) {
      const colIndex = 'f'.charCodeAt(0) - 'a'.charCodeAt(0)
      const q = colIndex - Math.floor(row / 2)
      const r = row
      if (row !== 6) { // Skip center as it's already added
        newHexes.push({
          col: 'f',
          row,
          q,
          r,
          type: 'corridor'
        })
      }
    }
    
    // Add rooms at intersections
    const rooms = [
      { col: 'c', row: 6, size: 'small' },
      { col: 'i', row: 6, size: 'small' },
      { col: 'f', row: 3, size: 'medium' },
      { col: 'f', row: 9, size: 'medium' }
    ]
    
    rooms.forEach(room => {
      // Add room hexes around the specified center
      const neighbors = [
        { dCol: 0, dRow: 0 },
        { dCol: -1, dRow: 0 },
        { dCol: 1, dRow: 0 },
        { dCol: 0, dRow: -1 },
        { dCol: 0, dRow: 1 }
      ]
      
      neighbors.forEach(n => {
        const newCol = String.fromCharCode(room.col.charCodeAt(0) + n.dCol)
        const newRow = room.row + n.dRow
        
        if (newCol >= 'a' && newCol <= 'k' && newRow >= 1 && newRow <= 11) {
          const colIndex = newCol.charCodeAt(0) - 'a'.charCodeAt(0)
          const q = colIndex - Math.floor(newRow / 2)
          const r = newRow
          
          // Check if hex already exists
          const exists = newHexes.some(h => h.col === newCol && h.row === newRow)
          if (!exists) {
            newHexes.push({
              col: newCol,
              row: newRow,
              q,
              r,
              type: 'room'
            })
          }
        }
      })
    })
    
    // Add doors at room entrances
    const doors = [
      { col: 'd', row: 6 },
      { col: 'h', row: 6 },
      { col: 'f', row: 4 },
      { col: 'f', row: 8 }
    ]
    
    doors.forEach(door => {
      const idx = newHexes.findIndex(h => h.col === door.col && h.row === door.row)
      if (idx !== -1) {
        newHexes[idx].type = 'door'
      }
    })
    
    // Add deployment zones
    zones[1] = {
      zone: 1,
      name: 'Entry Point',
      color: '#001aff',
      hexes: ['b6', 'c5', 'c7'],
      spawnPoints: 5,
      isStartingZone: true
    }
    
    zones[2] = {
      zone: 2,
      name: 'Exit Point',
      color: '#ff0000',
      hexes: ['i5', 'i7', 'j6'],
      spawnPoints: 5,
      isStartingZone: false
    }
    
    // Mark deployment hexes
    zones[1].hexes.forEach(hex => {
      const [col, row] = [hex[0], parseInt(hex.substring(1))]
      const colIndex = col.charCodeAt(0) - 'a'.charCodeAt(0)
      const q = colIndex - Math.floor(row / 2)
      const r = row
      newHexes.push({
        col,
        row,
        q,
        r,
        type: 'deployment',
        zone: 1
      })
    })
    
    zones[2].hexes.forEach(hex => {
      const [col, row] = [hex[0], parseInt(hex.substring(1))]
      const colIndex = col.charCodeAt(0) - 'a'.charCodeAt(0)
      const q = colIndex - Math.floor(row / 2)
      const r = row
      newHexes.push({
        col,
        row,
        q,
        r,
        type: 'exit'
      })
    })
    
    // Add some objectives
    newHexes.push({
      col: 'f',
      row: 6,
      q: 5 - Math.floor(6 / 2),
      r: 6,
      type: 'objective'
    })
    
    setMapData(prev => ({
      ...prev,
      name: 'Space Hulk Corridor',
      description: 'Tactical corridor combat map inspired by Space Hulk',
      hexes: newHexes,
      deploymentZones: zones,
      gameConfig: {
        ...prev.gameConfig,
        maxPlayers: 2,
        winCondition: 'objective',
        actionPointsPerTurn: 4
      }
    }))
  }

  return (
    <div className="control-panel">
      <div className="panel-section">
        <h3>Map Properties</h3>
        <input
          type="text"
          placeholder="Map Name"
          value={mapData.name}
          onChange={e => setMapData(prev => ({ ...prev, name: e.target.value }))}
        />
        <textarea
          placeholder="Map Description"
          value={mapData.description}
          onChange={e => setMapData(prev => ({ ...prev, description: e.target.value }))}
        />
      </div>

      <div className="panel-section">
        <h3>Hex Types</h3>
        <div className="tool-grid">
          {hexTypes.map(type => (
            <button
              key={type}
              className={`tool-button ${selectedTool === type ? 'selected' : ''}`}
              onClick={() => setSelectedTool(type)}
              title={type}
            >
              <div className="tool-preview" style={{ 
                backgroundColor: type === 'deployment' 
                  ? `${['#4444ff', '#ff4444', '#44ff44', '#ffff44'][selectedZone - 1]}88`
                  : {
                    normal: '#1a1a2e',
                    corridor: '#2a2a3e',
                    room: '#16213e',
                    obstacle: '#000000',
                    door: '#8b4513',
                    debris: '#4a4a4a',
                    spawn: '#9932cc',
                    objective: '#ffd700',
                    exit: '#00ff00',
                    overwatch: '#ff6600'
                  }[type] || '#1a1a2e'
              }} />
              <span>{type}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedTool === 'deployment' && (
        <div className="panel-section">
          <h3>Deployment Zone</h3>
          <div className="zone-selector">
            {[1, 2, 3, 4, 5, 6].map(zone => (
              <button
                key={zone}
                className={`zone-button ${selectedZone === zone ? 'selected' : ''}`}
                onClick={() => setSelectedZone(zone)}
                style={{ 
                  backgroundColor: ['#4444ff', '#ff4444', '#44ff44', '#ffff44', '#ff44ff', '#44ffff'][zone - 1] 
                }}
              >
                Zone {zone}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="panel-section">
        <h3>Templates</h3>
        <button onClick={() => handleGenerateTemplate('standard')}>Standard Map (91 hexes)</button>
        <button onClick={() => handleGenerateTemplate('2player')}>2-Player Competitive</button>
        <button onClick={() => handleGenerateTemplate('4player')}>4-Player FFA</button>
        <button onClick={() => handleGenerateTemplate('capture')}>Capture Points</button>
        <button onClick={generateSpaceHulkTemplate} style={{backgroundColor: '#4a148c', color: '#fff'}}>
          Space Hulk Corridor
        </button>
      </div>

      <div className="panel-section">
        <h3>Symmetry</h3>
        <div className="symmetry-options">
          {(['none', 'horizontal', 'vertical', 'rotational'] as const).map(mode => (
            <button
              key={mode}
              className={symmetryMode === mode ? 'selected' : ''}
              onClick={() => setSymmetryMode(mode)}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <h3>Game Config</h3>
        <label>
          Max Players:
          <input
            type="number"
            min="2"
            max="6"
            value={mapData.gameConfig.maxPlayers}
            onChange={e => setMapData(prev => ({
              ...prev,
              gameConfig: { ...prev.gameConfig, maxPlayers: parseInt(e.target.value) }
            }))}
          />
        </label>
        <label>
          Action Points per Turn:
          <input
            type="number"
            min="1"
            max="10"
            value={mapData.gameConfig.actionPointsPerTurn}
            onChange={e => setMapData(prev => ({
              ...prev,
              gameConfig: { ...prev.gameConfig, actionPointsPerTurn: parseInt(e.target.value) }
            }))}
          />
        </label>
        <label>
          Win Condition:
          <select
            value={mapData.gameConfig.winCondition}
            onChange={e => setMapData(prev => ({
              ...prev,
              gameConfig: { 
                ...prev.gameConfig, 
                winCondition: e.target.value as 'elimination' | 'capture' | 'survival' | 'points'
              }
            }))}
          >
            <option value="elimination">Elimination</option>
            <option value="capture">Capture Points</option>
            <option value="survival">Survival</option>
            <option value="points">Points</option>
          </select>
        </label>
      </div>

      <div className="panel-section">
        <h3>View Options</h3>
        <label>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={e => setShowGrid(e.target.checked)}
          />
          Show Grid
        </label>
      </div>

      <div className="panel-section">
        <h3>Actions</h3>
        <button onClick={handleClearMap} className="danger">Clear Map</button>
      </div>

      <div className="panel-section">
        <h3>Statistics</h3>
        <div className="stats">
          <div>Total Hexes: {mapData.hexes.length}</div>
          <div>Deployment Zones: {Object.keys(mapData.deploymentZones).length}</div>
          <div>
            Hex Types:
            <ul>
              {Object.entries(
                mapData.hexes.reduce((acc, hex) => {
                  acc[hex.type] = (acc[hex.type] || 0) + 1
                  return acc
                }, {} as Record<string, number>)
              ).map(([type, count]) => (
                <li key={type}>{type}: {count}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ControlPanel