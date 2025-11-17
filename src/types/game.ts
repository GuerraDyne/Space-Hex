// Core game types for Hexarch

export interface HexCoord {
  q: number; // column (axial coordinate)
  r: number; // row (axial coordinate)
}

export type HexDirection = 0 | 1 | 2 | 3 | 4 | 5; // 0=E, 1=SE, 2=SW, 3=W, 4=NW, 5=NE

export type ShipType =
  | 'scout'
  | 'interceptor'
  | 'corvette'
  | 'frigate'
  | 'destroyer'
  | 'cruiser'
  | 'artillery'
  | 'battleship'
  | 'mothership';

export type PlayerColor = 'blue' | 'red' | 'green' | 'yellow';

export interface Ship {
  id: string;
  type: ShipType;
  playerId: string;
  position: HexCoord;
  facing: HexDirection;
  currentAP: number;
  maxAP: number;
  isDeployed: boolean;
  isDestroyed: boolean;
}

export interface DebrisField {
  id: string;
  position: HexCoord;
  createdTurn: number;
}

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  ships: Ship[];
  totalAP: number;
  remainingAP: number;
  timeRemaining: number; // in seconds
  isEliminated: boolean;
  deploymentZone: number | null; // 0-3 for the 4 zones
  diceRoll: number | null;
}

export type GamePhase =
  | 'lobby'
  | 'dice_roll'
  | 'zone_selection'
  | 'deployment'
  | 'battle'
  | 'ended';

export type GameMode = '1v1' | 'ffa' | '2v2';

export interface TimeControl {
  deploymentTime: number; // seconds: 60, 180, 300
  gameTime: number; // seconds: 60, 180, 240, 600, 3600
}

export interface GameSettings {
  mode: GameMode;
  isPrivate: boolean;
  mapId: string;
  timeControl: TimeControl;
}

export interface Move {
  shipId: string;
  type: 'move' | 'turn';
  from: HexCoord | HexDirection;
  to: HexCoord | HexDirection;
  apCost: number;
}

export interface Turn {
  playerId: string;
  turnNumber: number;
  moves: Move[];
  timestamp: number;
}

export interface GameMap {
  id: string;
  name: string;
  hexes: HexCoord[];
  deploymentZones: HexCoord[][];
  initialDebris: HexCoord[];
}

export interface GameState {
  id: string;
  phase: GamePhase;
  settings: GameSettings;
  players: Player[];
  currentPlayerIndex: number;
  turnNumber: number;
  debris: DebrisField[];
  map: GameMap;
  turnHistory: Turn[];
  winner: string | null;
}

export interface Animation {
  id: string;
  type: 'move' | 'turn' | 'shoot' | 'explode' | 'thruster' | 'debris_spawn';
  shipId?: string;
  startTime: number;
  duration: number;
  data: Record<string, unknown>;
}

export interface PendingAction {
  shipId: string;
  moves: Move[];
  totalAPCost: number;
}

// Ship stats configuration
export const SHIP_STATS: Record<ShipType, { maxAP: number; name: string }> = {
  scout: { maxAP: 7, name: 'Scout' },
  interceptor: { maxAP: 6, name: 'Interceptor' },
  corvette: { maxAP: 6, name: 'Corvette' },
  frigate: { maxAP: 5, name: 'Frigate' },
  destroyer: { maxAP: 5, name: 'Destroyer' },
  cruiser: { maxAP: 4, name: 'Cruiser' },
  artillery: { maxAP: 3, name: 'Artillery' },
  battleship: { maxAP: 3, name: 'Battleship' },
  mothership: { maxAP: 2, name: 'Mothership' },
};

// Starting fleet composition
export const STARTING_FLEET: ShipType[] = [
  'mothership',
  'scout',
  'scout',
  'interceptor',
  'corvette',
  'frigate',
  'destroyer',
  'cruiser',
  'artillery',
  'battleship',
];

export const PLAYER_AP_PER_TURN = 10;
