// Action Point System Configuration

export interface ActionPointConfig {
  maxActionPoints: number;
  movementCost: number; // Cost per hex moved forward
  rotationCost: number; // Cost per 60° rotation
  canMoveBackward: boolean;
  backwardCost?: number;
  isOmnidirectional: boolean; // For mothership - can move any direction without rotating
  attackCost?: number; // Future: ranged attack cost
}

export interface ActionType {
  type: 'move' | 'rotate' | 'attack';
  cost: number;
  data?: any; // Additional data like target hex, rotation direction, etc.
}

export interface PlannedAction {
  type: 'move' | 'rotate' | 'attack';
  cost: number;
  fromHex?: { col: string; row: number };
  toHex?: { col: string; row: number };
  fromRotation?: number;
  toRotation?: number;
}

// Ship action point configurations
export const SHIP_ACTION_POINTS: Record<string, ActionPointConfig> = {
  scout: {
    maxActionPoints: 3,
    movementCost: 1,
    rotationCost: 1,
    canMoveBackward: false,
    isOmnidirectional: false
  },
  interceptor: {
    maxActionPoints: 4,
    movementCost: 1,
    rotationCost: 1,
    canMoveBackward: false,
    isOmnidirectional: false
  },
  corvette: {
    maxActionPoints: 5,
    movementCost: 1,
    rotationCost: 1,
    canMoveBackward: false,
    isOmnidirectional: false
  },
  frigate: {
    maxActionPoints: 6,
    movementCost: 1,
    rotationCost: 1,
    canMoveBackward: false,
    isOmnidirectional: false
  },
  destroyer: {
    maxActionPoints: 7,
    movementCost: 1,
    rotationCost: 1,
    canMoveBackward: false,
    isOmnidirectional: false
  },
  cruiser: {
    maxActionPoints: 7,
    movementCost: 1,
    rotationCost: 1,
    canMoveBackward: false,
    isOmnidirectional: false
  },
  mothership: {
    maxActionPoints: 1,
    movementCost: 1,
    rotationCost: 0, // No rotation needed
    canMoveBackward: true, // Can move any direction
    isOmnidirectional: true // Special case - no orientation required
  }
};

// Calculate rotation steps needed between two rotations in degrees
export function calculateRotationSteps(fromRotation: number, toRotation: number): number {
  // Calculate shortest rotation distance (can go either direction)
  // Each step is 60 degrees
  const diff = Math.abs(toRotation - fromRotation);
  const shortestDiff = Math.min(diff, 360 - diff);
  return Math.round(shortestDiff / 60);
}

// Calculate action points needed for a rotation
export function calculateRotationCost(fromRotation: number, toRotation: number, shipType: string): number {
  const config = SHIP_ACTION_POINTS[shipType];
  if (!config || config.isOmnidirectional) return 0;
  
  const steps = calculateRotationSteps(fromRotation, toRotation);
  return steps * config.rotationCost;
}

// Check if ship can perform planned actions
export function canPerformActions(
  plannedActions: PlannedAction[], 
  shipType: string
): { valid: boolean; totalCost: number; remainingAP: number } {
  const config = SHIP_ACTION_POINTS[shipType];
  if (!config) return { valid: false, totalCost: 0, remainingAP: 0 };
  
  const totalCost = plannedActions.reduce((sum, action) => sum + action.cost, 0);
  const remainingAP = config.maxActionPoints - totalCost;
  
  return {
    valid: totalCost <= config.maxActionPoints,
    totalCost,
    remainingAP
  };
}

// Get forward hex based on current rotation in degrees
export function getForwardHex(
  currentQ: number, 
  currentR: number, 
  rotation: number
): { q: number; r: number } {
  // Convert rotation degrees to direction index
  // rotation: 0°=N, 60°=NE, 120°=SE, 180°=S, 240°=SW, 300°=NW
  const directionIndex = Math.round(rotation / 60) % 6;
  
  // Direction vectors for each rotation (in degrees)
  // For flat-top hexagons with axial coordinates
  const directions = [
    { q: 0, r: -1 },  // 0°: N (North)
    { q: 1, r: -1 },  // 60°: NE (Northeast)
    { q: 1, r: 0 },   // 120°: SE (Southeast) 
    { q: 0, r: 1 },   // 180°: S (South)
    { q: -1, r: 1 },  // 240°: SW (Southwest)
    { q: -1, r: 0 }   // 300°: NW (Northwest)
  ];
  
  const dir = directions[directionIndex];
  return {
    q: currentQ + dir.q,
    r: currentR + dir.r
  };
}

// Get all adjacent hexes (for omnidirectional movement)
export function getAdjacentHexes(
  currentQ: number,
  currentR: number
): Array<{ q: number; r: number; orientation: number }> {
  return [
    { q: currentQ + 1, r: currentR, orientation: 0 },      // E
    { q: currentQ, r: currentR + 1, orientation: 1 },      // SE
    { q: currentQ - 1, r: currentR + 1, orientation: 2 },  // SW
    { q: currentQ - 1, r: currentR, orientation: 3 },      // W
    { q: currentQ, r: currentR - 1, orientation: 4 },      // NW
    { q: currentQ + 1, r: currentR - 1, orientation: 5 }   // NE
  ];
}