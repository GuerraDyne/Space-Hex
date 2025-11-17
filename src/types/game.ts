// Core game types - orientation-based movement system

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
  facing: HexDirection; // Which direction ship is pointing
  destroyed: boolean;
}

export interface Player {
  id: string;
  name: string;
  color: 'blue' | 'red' | 'green' | 'yellow';
  isAI: boolean;
}

export interface Debris {
  position: HexCoord;
}

// Movement pattern for each ship type - based on ship's facing
export interface MovementPattern {
  maxForward: number;      // Max hexes straight ahead
  maxForwardSide: number;  // Max hexes forward-diagonal
  maxSide: number;         // Max hexes directly sideways
  maxBackward: number;     // Max hexes straight back
  rotationCostPerStep: number; // AP cost per 60° rotation
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
  mothership: { maxForward: 1, maxForwardSide: 1, maxSide: 1, maxBackward: 1, rotationCostPerStep: 0 }, // Omnidirectional
};

// AP per ship type per turn
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

export type Phase = 'menu' | 'playing' | 'ended';

export interface Animation {
  id: string;
  type: 'thruster' | 'explosion' | 'laser';
  position: HexCoord;
  direction?: HexDirection;
  startTime: number;
  duration: number;
}

export interface GameState {
  phase: Phase;
  players: Player[];
  ships: Ship[];
  debris: Debris[];
  currentPlayerId: string;
  turnNumber: number;
  winnerId: string | null;
  playerAPRemaining: number;
  shipAPUsed: Map<string, number>; // Track AP used per ship this turn
}

export const PLAYER_MAX_AP = 10;
export const PLAYER_COLORS: Record<string, string> = {
  blue: '#4488ff',
  red: '#ff4444',
  green: '#44ff44',
  yellow: '#ffaa44',
};
