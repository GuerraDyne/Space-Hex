export type HexType = 
  | 'normal'      // Walkable floor
  | 'deployment'  // Starting zones
  | 'obstacle'    // Wall/impassable
  | 'debris'      // Slows movement
  | 'door'        // Doorway (can be opened/closed)
  | 'corridor'    // Narrow passage
  | 'room'        // Open room area
  | 'objective'   // Mission objective
  | 'overwatch'   // Overwatch lane marker
  | 'spawn'       // Enemy spawn point
  | 'exit'        // Exit/extraction point

export interface HexData {
  col: string
  row: number
  q: number
  r: number
  type: HexType
  zone?: number // For deployment zones
  metadata?: {
    [key: string]: any // Additional properties for special hex types
  }
}

export interface DeploymentZone {
  zone: number
  name: string
  color: string
  hexes: string[] // Array of "col,row" strings
  spawnPoints: number // How many units can spawn here
  isStartingZone: boolean
}

export interface GameConfig {
  maxPlayers: number
  actionPointsPerTurn: number
  winCondition: 'elimination' | 'capture' | 'survival' | 'points'
  unitTypes: string[]
  turnTimer: number
  deploymentTimer: number
  specialRules?: {
    meteorShowers?: boolean
    debrisSlowdown?: boolean
    wormholeTravel?: boolean
    capturePoints?: string[] // hex locations
    respawnEnabled?: boolean
    teamMode?: boolean
  }
}

export interface MapData {
  name: string
  description: string
  hexes: HexData[]
  deploymentZones: { [key: number]: DeploymentZone }
  gameConfig: GameConfig
  metadata?: {
    author?: string
    version?: string
    createdAt?: string
    modifiedAt?: string
    symmetry?: 'none' | 'horizontal' | 'vertical' | 'rotational'
    recommended?: {
      playerCount?: number
      gameMode?: string
    }
  }
}

export interface EditorState {
  selectedTool: HexType
  selectedZone: number
  showGrid: boolean
  symmetryMode: 'none' | 'horizontal' | 'vertical' | 'rotational'
  highlightedHexes: Set<string>
}

// Helper function to convert col,row to string key
export const hexKey = (col: string, row: number): string => `${col},${row}`

// Helper function to parse hex key back to col,row
export const parseHexKey = (key: string): { col: string; row: number } => {
  const [col, row] = key.split(',')
  return { col, row: parseInt(row) }
}

// Axial to cube coordinates
export const axialToCube = (q: number, r: number) => {
  const x = q
  const z = r
  const y = -x - z
  return { x, y, z }
}

// Cube to axial coordinates
export const cubeToAxial = (x: number, y: number, z: number) => {
  const q = x
  const r = z
  return { q, r }
}

// Convert offset coordinates to axial for flat-top hexagons
export const offsetToAxial = (col: string, row: number) => {
  const colIndex = col.charCodeAt(0) - 'a'.charCodeAt(0)
  const q = colIndex - Math.floor(row / 2)
  const r = row
  return { q, r }
}

// Convert axial to offset coordinates
export const axialToOffset = (q: number, r: number) => {
  const colIndex = q + Math.floor(r / 2)
  const col = String.fromCharCode('a'.charCodeAt(0) + colIndex)
  const row = r
  return { col, row }
}