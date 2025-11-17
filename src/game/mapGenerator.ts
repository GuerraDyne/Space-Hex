import { GameMap, HexCoord } from '@/types/game';
import { generateHexagonalBoard, generateDeploymentZones, hexToKey } from '@/engine/hexGrid';

export function generateDefaultMap(): GameMap {
  const radius = 5;
  const hexes = generateHexagonalBoard(radius);
  const deploymentZones = generateDeploymentZones(radius);

  return {
    id: 'default',
    name: 'Classic Arena',
    hexes,
    deploymentZones,
    initialDebris: [],
  };
}

export function generateMapWithDebris(debrisPositions: HexCoord[]): GameMap {
  const baseMap = generateDefaultMap();
  return {
    ...baseMap,
    id: 'custom',
    name: 'Custom Map',
    initialDebris: debrisPositions,
  };
}

// Map presets
export const MAP_PRESETS: Record<string, () => GameMap> = {
  classic: () => generateDefaultMap(),

  asteroid_field: () => {
    const baseMap = generateDefaultMap();
    // Add scattered debris
    const debrisPositions: HexCoord[] = [
      { q: 0, r: 0 },
      { q: 1, r: -1 },
      { q: -1, r: 1 },
      { q: 2, r: 0 },
      { q: -2, r: 0 },
    ];
    return {
      ...baseMap,
      id: 'asteroid_field',
      name: 'Asteroid Field',
      initialDebris: debrisPositions,
    };
  },

  narrow_passage: () => {
    const baseMap = generateDefaultMap();
    // Create walls of debris
    const debrisPositions: HexCoord[] = [];
    for (let r = -3; r <= 3; r++) {
      if (r !== 0) {
        debrisPositions.push({ q: -1, r });
        debrisPositions.push({ q: 1, r });
      }
    }
    return {
      ...baseMap,
      id: 'narrow_passage',
      name: 'Narrow Passage',
      initialDebris: debrisPositions,
    };
  },

  fortified: () => {
    const baseMap = generateDefaultMap();
    // Debris protecting center
    const debrisPositions: HexCoord[] = [
      { q: 1, r: 0 },
      { q: 0, r: 1 },
      { q: -1, r: 1 },
      { q: -1, r: 0 },
      { q: 0, r: -1 },
      { q: 1, r: -1 },
    ];
    return {
      ...baseMap,
      id: 'fortified',
      name: 'Fortified Center',
      initialDebris: debrisPositions,
    };
  },
};

export function getAvailableMaps(): { id: string; name: string }[] {
  return Object.keys(MAP_PRESETS).map((id) => {
    const map = MAP_PRESETS[id]();
    return { id: map.id, name: map.name };
  });
}
