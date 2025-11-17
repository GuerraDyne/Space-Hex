// Core game types - Complete hex-based turn-based strategy game

export interface HexCoord {
  q: number;
  r: number;
}

// Direction the ship is facing (determines movement options)
export type HexDirection = 0 | 1 | 2 | 3 | 4 | 5; // 0=E, 1=SE, 2=SW, 3=W, 4=NW, 5=NE

export type ShipType =
  | 'scout'
  | 'interceptor'
  | 'corvette'
  | 'frigate'
  | 'destroyer'
  | 'cruiser'
  | 'battleship'
  | 'artillery'
  | 'mothership';

export interface Ship {
  id: string;
  type: ShipType;
  ownerId: string;
  position: HexCoord;
  facing: HexDirection;
  deployed: boolean; // Whether ship has been placed on board
  destroyed: boolean;
}

export interface Player {
  id: string;
  name: string;
  color: 'blue' | 'red' | 'green' | 'yellow';
  isAI: boolean;
  diceRoll: number | null; // Result of zone selection dice roll
  selectedZone: number | null; // Which deployment zone they chose (0-3)
}

export interface Debris {
  id: string;
  position: HexCoord;
}

export interface DeploymentZone {
  id: number;
  name: string;
  hexes: HexCoord[];
  color: string;
  ownerId: string | null; // Player who claimed this zone
}

// Game phases - strict state machine
export type Phase =
  | 'menu'
  | 'setup' // Configure game settings
  | 'diceRoll' // Roll to determine zone selection order
  | 'zoneSelection' // Players pick deployment zones
  | 'deployment' // Place ships in chosen zone
  | 'battle' // Main gameplay
  | 'ended'; // Game over, show results

// Movement pattern for each ship type - based on ship's facing
export interface MovementPattern {
  maxForward: number;
  maxForwardSide: number;
  maxSide: number;
  maxBackward: number;
  rotationCostPerStep: number;
}

export const SHIP_MOVEMENT: Record<ShipType, MovementPattern> = {
  scout: { maxForward: 5, maxForwardSide: 3, maxSide: 2, maxBackward: 1, rotationCostPerStep: 1 },
  interceptor: { maxForward: 4, maxForwardSide: 3, maxSide: 1, maxBackward: 0, rotationCostPerStep: 1 },
  corvette: { maxForward: 3, maxForwardSide: 2, maxSide: 1, maxBackward: 1, rotationCostPerStep: 1 },
  frigate: { maxForward: 3, maxForwardSide: 2, maxSide: 1, maxBackward: 0, rotationCostPerStep: 1 },
  destroyer: { maxForward: 2, maxForwardSide: 1, maxSide: 0, maxBackward: 0, rotationCostPerStep: 1 },
  cruiser: { maxForward: 2, maxForwardSide: 1, maxSide: 0, maxBackward: 0, rotationCostPerStep: 1 },
  battleship: { maxForward: 2, maxForwardSide: 1, maxSide: 0, maxBackward: 0, rotationCostPerStep: 1 },
  artillery: { maxForward: 1, maxForwardSide: 1, maxSide: 0, maxBackward: 0, rotationCostPerStep: 1 },
  mothership: { maxForward: 1, maxForwardSide: 1, maxSide: 1, maxBackward: 1, rotationCostPerStep: 0 },
};

export const SHIP_AP: Record<ShipType, number> = {
  scout: 7,
  interceptor: 6,
  corvette: 6,
  frigate: 5,
  destroyer: 5,
  cruiser: 4,
  battleship: 3,
  artillery: 3,
  mothership: 2,
};

export const SHIP_NAMES: Record<ShipType, string> = {
  scout: 'Scout',
  interceptor: 'Interceptor',
  corvette: 'Corvette',
  frigate: 'Frigate',
  destroyer: 'Destroyer',
  cruiser: 'Cruiser',
  battleship: 'Battleship',
  artillery: 'Artillery',
  mothership: 'Mothership',
};

export const PLAYER_MAX_AP = 10;

export const PLAYER_COLORS: Record<string, string> = {
  blue: '#4488ff',
  red: '#ff4444',
  green: '#44ff44',
  yellow: '#ffff44',
};

export interface Animation {
  id: string;
  type: 'explosion' | 'thruster' | 'laser' | 'move';
  position: HexCoord;
  startTime: number;
  duration: number;
  direction?: HexDirection;
  fromPos?: HexCoord;
  toPos?: HexCoord;
}

export interface PlannedAction {
  shipId: string;
  type: 'move' | 'rotate';
  newPosition?: HexCoord;
  newFacing?: HexDirection;
  apCost: number;
}

export interface GameStats {
  turnCount: number;
  shipsDestroyed: Record<string, number>; // playerId -> count
  totalMovements: Record<string, number>; // playerId -> count
  gameDuration: number; // milliseconds
}

export interface ReplayAction {
  turn: number;
  playerId: string;
  actions: PlannedAction[];
  timestamp: number;
}

export interface GameState {
  phase: Phase;
  players: Player[];
  ships: Ship[];
  debris: Debris[];
  deploymentZones: DeploymentZone[];
  boardHexes: HexCoord[];
  boardRadius: number;
  currentPlayerId: string;
  turnNumber: number;
  playerAPRemaining: number;
  winnerId: string | null;

  // Phase-specific state
  zoneSelectionOrder: string[]; // Player IDs in order of zone selection
  currentZoneSelector: number; // Index into zoneSelectionOrder

  // Deployment state
  deployingPlayerId: string | null;
  shipToDeployId: string | null; // Current ship being placed

  // Battle state
  plannedActions: PlannedAction[];

  // Game history
  gameHistory: ReplayAction[];
  stats: GameStats;

  // Animations
  animations: Animation[];

  // Game timing
  startTime: number;
}
