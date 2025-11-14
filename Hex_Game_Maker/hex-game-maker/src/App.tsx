import { useState } from 'react'
import './App.css'
import HexMapEditor from './components/HexMapEditor'
import ControlPanel from './components/ControlPanel'
import type { MapData, HexType } from './types'

function App() {
  const [mapData, setMapData] = useState<MapData>({
    name: 'New Map',
    description: '',
    hexes: [],
    deploymentZones: {},
    gameConfig: {
      maxPlayers: 2,
      actionPointsPerTurn: 5,
      winCondition: 'elimination',
      unitTypes: ['scout', 'interceptor', 'corvette', 'frigate', 'destroyer', 'cruiser', 'mothership'],
      turnTimer: 180,
      deploymentTimer: 180
    }
  })

  const [selectedTool, setSelectedTool] = useState<HexType>('normal')
  const [selectedZone, setSelectedZone] = useState<number>(1)
  const [showGrid, setShowGrid] = useState(true)
  const [symmetryMode, setSymmetryMode] = useState<'none' | 'horizontal' | 'vertical' | 'rotational'>('none')

  const handleSaveMap = () => {
    const json = JSON.stringify(mapData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${mapData.name.replace(/\s+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLoadMap = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string)
          setMapData(data)
        } catch (error) {
          alert('Invalid map file')
        }
      }
      reader.readAsText(file)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Hex Game Map Maker</h1>
        <div className="header-actions">
          <button onClick={handleSaveMap}>Save Map</button>
          <label className="load-button">
            Load Map
            <input type="file" accept=".json" onChange={handleLoadMap} hidden />
          </label>
        </div>
      </header>
      
      <div className="editor-container">
        <ControlPanel
          mapData={mapData}
          setMapData={setMapData}
          selectedTool={selectedTool}
          setSelectedTool={setSelectedTool}
          selectedZone={selectedZone}
          setSelectedZone={setSelectedZone}
          showGrid={showGrid}
          setShowGrid={setShowGrid}
          symmetryMode={symmetryMode}
          setSymmetryMode={setSymmetryMode}
        />
        
        <HexMapEditor
          mapData={mapData}
          setMapData={setMapData}
          selectedTool={selectedTool}
          selectedZone={selectedZone}
          showGrid={showGrid}
          symmetryMode={symmetryMode}
        />
      </div>
    </div>
  )
}

export default App
