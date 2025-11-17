// Hex grid engine with axial coordinates (flat-top hexagons)
import { HexCoord, HexDirection } from '@/types/game';

// Direction vectors for flat-top hexagons in axial coordinates
// 0=E, 1=SE, 2=SW, 3=W, 4=NW, 5=NE
export const DIRECTION_VECTORS: Record<HexDirection, HexCoord> = {
  0: { q: 1, r: 0 },   // East
  1: { q: 0, r: 1 },   // Southeast
  2: { q: -1, r: 1 },  // Southwest
  3: { q: -1, r: 0 },  // West
  4: { q: 0, r: -1 },  // Northwest
  5: { q: 1, r: -1 },  // Northeast
};

export const DIRECTION_NAMES: Record<HexDirection, string> = {
  0: 'East',
  1: 'Southeast',
  2: 'Southwest',
  3: 'West',
  4: 'Northwest',
  5: 'Northeast',
};

// Convert hex direction to rotation angle in degrees (for rendering)
export function directionToAngle(direction: HexDirection): number {
  return direction * 60;
}

// Convert angle to hex direction
export function angleToDirection(angle: number): HexDirection {
  const normalized = ((angle % 360) + 360) % 360;
  return Math.round(normalized / 60) % 6 as HexDirection;
}

// Calculate minimum turns needed to change facing
export function calculateTurnCost(from: HexDirection, to: HexDirection): number {
  const diff = Math.abs(to - from);
  // Minimum of going clockwise or counter-clockwise
  return Math.min(diff, 6 - diff);
}

// Get the next direction when turning clockwise
export function turnClockwise(direction: HexDirection): HexDirection {
  return ((direction + 1) % 6) as HexDirection;
}

// Get the next direction when turning counter-clockwise
export function turnCounterClockwise(direction: HexDirection): HexDirection {
  return ((direction + 5) % 6) as HexDirection;
}

// Get the opposite direction
export function oppositeDirection(direction: HexDirection): HexDirection {
  return ((direction + 3) % 6) as HexDirection;
}

// Get neighbor hex in a given direction
export function getNeighbor(hex: HexCoord, direction: HexDirection): HexCoord {
  const delta = DIRECTION_VECTORS[direction];
  return { q: hex.q + delta.q, r: hex.r + delta.r };
}

// Get all 6 neighbors of a hex
export function getNeighbors(hex: HexCoord): HexCoord[] {
  return [0, 1, 2, 3, 4, 5].map((dir) => getNeighbor(hex, dir as HexDirection));
}

// Calculate distance between two hexes
export function hexDistance(a: HexCoord, b: HexCoord): number {
  // In axial coordinates, distance formula using cube coordinates
  const dq = b.q - a.q;
  const dr = b.r - a.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

// Check if two hex coordinates are the same
export function hexEqual(a: HexCoord, b: HexCoord): boolean {
  return a.q === b.q && a.r === b.r;
}

// Convert hex coordinate to string key (for maps/sets)
export function hexToKey(hex: HexCoord): string {
  return `${hex.q},${hex.r}`;
}

// Convert string key back to hex coordinate
export function keyToHex(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

// Convert axial to pixel coordinates (for rendering)
export function hexToPixel(hex: HexCoord, size: number): { x: number; y: number } {
  // Flat-top hexagon
  const x = size * (3 / 2 * hex.q);
  const y = size * (Math.sqrt(3) / 2 * hex.q + Math.sqrt(3) * hex.r);
  return { x, y };
}

// Convert pixel to hex coordinates (for click detection)
export function pixelToHex(x: number, y: number, size: number): HexCoord {
  // Flat-top hexagon
  const q = (2 / 3 * x) / size;
  const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / size;
  return hexRound({ q, r });
}

// Round fractional hex coordinates to nearest hex
export function hexRound(hex: { q: number; r: number }): HexCoord {
  // Convert to cube coordinates
  const s = -hex.q - hex.r;

  let rq = Math.round(hex.q);
  let rr = Math.round(hex.r);
  let rs = Math.round(s);

  const qDiff = Math.abs(rq - hex.q);
  const rDiff = Math.abs(rr - hex.r);
  const sDiff = Math.abs(rs - s);

  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs;
  } else if (rDiff > sDiff) {
    rr = -rq - rs;
  }

  return { q: rq, r: rr };
}

// Generate a hexagonal-shaped board
export function generateHexagonalBoard(radius: number): HexCoord[] {
  const hexes: HexCoord[] = [];

  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      hexes.push({ q, r });
    }
  }

  return hexes;
}

// Generate deployment zones for a hexagonal board
export function generateDeploymentZones(radius: number): HexCoord[][] {
  const zones: HexCoord[][] = [[], [], [], []];

  // Zone 0: East side
  // Zone 1: South side
  // Zone 2: West side
  // Zone 3: North side

  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);

    for (let r = r1; r <= r2; r++) {
      const hex = { q, r };
      const pixel = hexToPixel(hex, 1);

      // Determine which zone based on position
      const angle = Math.atan2(pixel.y, pixel.x) * 180 / Math.PI;

      // East zone: -45 to 45 degrees
      if (angle >= -45 && angle < 45 && q > radius - 3) {
        zones[0].push(hex);
      }
      // South zone: 45 to 135 degrees
      else if (angle >= 45 && angle < 135 && r > radius - 3) {
        zones[1].push(hex);
      }
      // West zone: 135 to -135 degrees
      else if ((angle >= 135 || angle < -135) && q < -radius + 3) {
        zones[2].push(hex);
      }
      // North zone: -135 to -45 degrees
      else if (angle >= -135 && angle < -45 && r < -radius + 3) {
        zones[3].push(hex);
      }
    }
  }

  return zones;
}

// Get all hexes in a line from start in a direction (for movement visualization)
export function getHexLine(start: HexCoord, direction: HexDirection, length: number): HexCoord[] {
  const line: HexCoord[] = [];
  let current = start;

  for (let i = 0; i < length; i++) {
    current = getNeighbor(current, direction);
    line.push(current);
  }

  return line;
}

// Find shortest path between two hexes (A* pathfinding)
export function findPath(
  start: HexCoord,
  end: HexCoord,
  blocked: Set<string>
): HexCoord[] | null {
  if (hexEqual(start, end)) return [];

  const openSet = new Map<string, { hex: HexCoord; f: number; g: number }>();
  const closedSet = new Set<string>();
  const cameFrom = new Map<string, HexCoord>();

  const startKey = hexToKey(start);
  openSet.set(startKey, { hex: start, f: hexDistance(start, end), g: 0 });

  while (openSet.size > 0) {
    // Find node with lowest f score
    let currentKey = '';
    let lowestF = Infinity;
    for (const [key, node] of openSet) {
      if (node.f < lowestF) {
        lowestF = node.f;
        currentKey = key;
      }
    }

    const current = openSet.get(currentKey)!;

    if (hexEqual(current.hex, end)) {
      // Reconstruct path
      const path: HexCoord[] = [end];
      let pathKey = hexToKey(end);
      while (cameFrom.has(pathKey)) {
        const prev = cameFrom.get(pathKey)!;
        path.unshift(prev);
        pathKey = hexToKey(prev);
      }
      return path.slice(1); // Remove start from path
    }

    openSet.delete(currentKey);
    closedSet.add(currentKey);

    for (const neighbor of getNeighbors(current.hex)) {
      const neighborKey = hexToKey(neighbor);

      if (closedSet.has(neighborKey) || blocked.has(neighborKey)) {
        continue;
      }

      const tentativeG = current.g + 1;

      if (!openSet.has(neighborKey)) {
        openSet.set(neighborKey, {
          hex: neighbor,
          g: tentativeG,
          f: tentativeG + hexDistance(neighbor, end),
        });
        cameFrom.set(neighborKey, current.hex);
      } else {
        const existing = openSet.get(neighborKey)!;
        if (tentativeG < existing.g) {
          existing.g = tentativeG;
          existing.f = tentativeG + hexDistance(neighbor, end);
          cameFrom.set(neighborKey, current.hex);
        }
      }
    }
  }

  return null; // No path found
}
