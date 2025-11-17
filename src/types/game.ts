// Simplified, robust game types

export interface HexCoord {
  q: number;
  r: number;
}

export type HexDirection = 0 | 1 | 2 | 3 | 4 | 5; // 0=E, 1=SE, 2=SW, 3=W, 4=NW, 5=NE

export type ShipType = 'scout' | 'frigate' | 'cruiser' | 'mothership';

export interface Ship {
  id: string;
  type: ShipType;
  ownerId: string;
  position: HexCoord;
  facing: HexDirection;
  maxAP: number;
  destroyed: boolean;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  isAI: boolean;
}

export interface Debris {
  position: HexCoord;
}

export type Phase = 'menu' | 'deployment' | 'playing' | 'ended';

export interface GameState {
  phase: Phase;
  players: Player[];
  ships: Ship[];
  debris: Debris[];
  currentPlayerId: string;
  turnNumber: number;
  winnerId: string | null;
  playerAPRemaining: number;
  shipsMovedThisTurn: Set<string>;
}

export const SHIP_STATS: Record<ShipType, { maxAP: number; name: string }> = {
  scout: { maxAP: 5, name: 'Scout' },
  frigate: { maxAP: 4, name: 'Frigate' },
  cruiser: { maxAP: 3, name: 'Cruiser' },
  mothership: { maxAP: 2, name: 'Mothership' },
};

export const PLAYER_MAX_AP = 10;
