// Ship Movement Pattern Configuration
// Defines how each ship type can move based on orientation direction

export interface MovementPattern {
  forward: number;       // Max hexes straight ahead
  forwardSide: number;   // Max hexes diagonally forward (left/right)
  side: number;          // Max hexes directly to sides
  backSide: number;      // Max hexes diagonally back
  backward: number;      // Max hexes straight back
  canRotateInPlace: boolean;   // Can change orientation without moving
  rotationCost: number;  // Movement points used for rotation (0 = free)
  canRotateWhileMoving: boolean; // Can combine rotation with movement
  maxRotationPerMove: number;    // Max 60° rotations per move (1 = 60°, 2 = 120°)
}

export const SHIP_MOVEMENT_PATTERNS: Record<string, MovementPattern> = {
  scout: {
    forward: 5,
    forwardSide: 3,
    side: 2,
    backSide: 0,
    backward: 1,
    canRotateInPlace: true,
    rotationCost: 0,  // Free rotation
    canRotateWhileMoving: true,
    maxRotationPerMove: 2  // Can turn up to 120° while moving
  },
  interceptor: {
    forward: 4,
    forwardSide: 3,
    side: 1,
    backSide: 0,
    backward: 0,
    canRotateInPlace: true,
    rotationCost: 0,
    canRotateWhileMoving: true,
    maxRotationPerMove: 1  // Can turn 60° while moving
  },
  corvette: {
    forward: 3,
    forwardSide: 2,
    side: 1,
    backSide: 0,
    backward: 1,
    canRotateInPlace: true,
    rotationCost: 0,
    canRotateWhileMoving: true,
    maxRotationPerMove: 1
  },
  frigate: {
    forward: 3,
    forwardSide: 2,
    side: 1,
    backSide: 0,
    backward: 0,
    canRotateInPlace: true,
    rotationCost: 1,  // Uses turn to rotate
    canRotateWhileMoving: false,
    maxRotationPerMove: 0
  },
  destroyer: {
    forward: 2,
    forwardSide: 1,
    side: 0,
    backSide: 0,
    backward: 0,
    canRotateInPlace: true,
    rotationCost: 1,
    canRotateWhileMoving: false,
    maxRotationPerMove: 0
  },
  cruiser: {
    forward: 2,
    forwardSide: 1,
    side: 0,
    backSide: 0,
    backward: 0,
    canRotateInPlace: false,  // Cannot rotate in place
    rotationCost: 1,
    canRotateWhileMoving: false,
    maxRotationPerMove: 0
  }
};

// Hex direction mappings matching server schema
// These correspond to the 6 flat sides of a pointy-top hex
export enum HexDirection {
  E = 0,   // East (right)
  SE = 1,  // Southeast (bottom-right)
  SW = 2,  // Southwest (bottom-left)  
  W = 3,   // West (left)
  NW = 4,  // Northwest (top-left)
  NE = 5   // Northeast (top-right)
}

// Get relative direction from ship's orientation
export function getRelativeDirection(shipOrientation: number, targetDirection: number): string {
  // Calculate the difference between target and ship orientation
  let diff = (targetDirection - shipOrientation + 6) % 6;
  
  switch(diff) {
    case 0: return 'forward';
    case 1: 
    case 5: return 'forwardSide';
    case 2:
    case 4: return 'side';
    case 3: return 'backward';
    default: return 'forward';
  }
}

// Calculate direction from one hex to another using proper hex grid math
export function getHexDirection(fromCol: string, fromRow: number, toCol: string, toRow: number): number {
  // For FLAT-TOP hexagons with odd-r offset coordinates
  // (odd rows are shifted right by half a hex width)
  
  const fromColIndex = fromCol.charCodeAt(0) - 'a'.charCodeAt(0);
  const toColIndex = toCol.charCodeAt(0) - 'a'.charCodeAt(0);
  
  const dCol = toColIndex - fromColIndex;
  const dRow = toRow - fromRow;
  
  // Check if we're on an odd row (affects neighbor positions)
  const fromRowIsOdd = fromRow % 2 === 1;
  
  // Direction mapping: 0=E, 1=SE, 2=SW, 3=W, 4=NW, 5=NE
  
  // Check for exact neighbor directions first
  if (fromRowIsOdd) {
    // Odd row - shifted right
    if (dCol === 1 && dRow === 0) return 0;  // E
    if (dCol === 1 && dRow === 1) return 1;  // SE
    if (dCol === 0 && dRow === 1) return 2;  // SW
    if (dCol === -1 && dRow === 0) return 3; // W
    if (dCol === 0 && dRow === -1) return 4; // NW
    if (dCol === 1 && dRow === -1) return 5; // NE
  } else {
    // Even row - not shifted
    if (dCol === 1 && dRow === 0) return 0;  // E
    if (dCol === 0 && dRow === 1) return 1;  // SE
    if (dCol === -1 && dRow === 1) return 2; // SW
    if (dCol === -1 && dRow === 0) return 3; // W
    if (dCol === -1 && dRow === -1) return 4; // NW
    if (dCol === 0 && dRow === -1) return 5; // NE
  }
  
  // For non-adjacent hexes, calculate the general direction
  // Convert to cube coordinates for better angle calculation
  const offsetToCube = (col: number, row: number) => {
    const x = col - (row - (row & 1)) / 2;
    const z = row;
    const y = -x - z;
    return { x, y, z };
  };
  
  const fromCube = offsetToCube(fromColIndex, fromRow);
  const toCube = offsetToCube(toColIndex, toRow);
  
  const dx = toCube.x - fromCube.x;
  const dy = toCube.y - fromCube.y;
  const dz = toCube.z - fromCube.z;
  
  // Find the dominant axis
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const absDz = Math.abs(dz);
  
  // Determine direction based on which axis has the largest magnitude
  // For flat-top hexagons: 0=E, 1=SE, 2=SW, 3=W, 4=NW, 5=NE
  if (absDx >= absDy && absDx >= absDz) {
    // X axis is dominant (East-West)
    return dx > 0 ? 0 : 3; // E or W
  } else if (absDz >= absDx && absDz >= absDy) {
    // Z axis is dominant (North-South on rows)
    if (dz > 0) {
      // Moving south
      return dx >= 0 ? 1 : 2; // SE or SW
    } else {
      // Moving north
      return dx > 0 ? 5 : 4; // NE or NW
    }
  } else {
    // Y axis is dominant
    if (dy > 0) {
      // Moving in +y direction
      return dz >= 0 ? 2 : 4; // SW or NW
    } else {
      // Moving in -y direction
      return dz > 0 ? 1 : 5; // SE or NE
    }
  }
}

// Check if a move is valid based on ship's movement pattern and orientation
export function isValidDirectionalMove(
  shipType: string,
  shipOrientation: number,
  fromCol: string,
  fromRow: number,
  toCol: string,
  toRow: number,
  distance: number
): boolean {
  const pattern = SHIP_MOVEMENT_PATTERNS[shipType];
  if (!pattern) return false;
  
  // Get the direction of movement
  const moveDirection = getHexDirection(fromCol, fromRow, toCol, toRow);
  
  // Get relative direction based on ship's orientation
  const relativeDir = getRelativeDirection(shipOrientation, moveDirection);
  
  // Check if distance is within allowed range for this direction
  switch(relativeDir) {
    case 'forward':
      return distance <= pattern.forward;
    case 'forwardSide':
      return distance <= pattern.forwardSide;
    case 'side':
      return distance <= pattern.side;
    case 'backward':
      return distance <= pattern.backward;
    default:
      return false;
  }
}