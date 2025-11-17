import { create } from 'zustand';
import {
  GameState,
  Player,
  Ship,
  HexCoord,
  HexDirection,
  ShipType,
  SHIP_AP,
  SHIP_MOVEMENT,
  PLAYER_MAX_AP,
  Animation,
} from '@/types/game';
import { hexEqual, getNeighbor, calculateTurnCost, generateHexagonalBoard } from '@/engine/hexGrid';

interface PlannedAction {
  shipId: string;
  newPosition: HexCoord;
  newFacing: HexDirection;
  apCost: number;
}

interface Store {
  game: GameState | null;
  plannedActions: PlannedAction[];
  selectedShipId: string | null;
  boardHexes: HexCoord[];
  animations: Animation[];

  startGame: (vsAI: boolean) => void;
  selectShip: (shipId: string | null) => void;
  moveShip: (shipId: string, targetHex: HexCoord) => boolean;
  rotateShip: (shipId: string, newFacing: HexDirection) => boolean;
  undoLast: () => void;
  clearPlans: () => void;
  endTurn: () => void;
  returnToMenu: () => void;

  getValidMoves: (shipId: string) => HexCoord[];
  getPlannedPosition: (shipId: string) => HexCoord;
  getPlannedFacing: (shipId: string) => HexDirection;
  getTotalPlannedAP: () => number;
  getShipRemainingAP: (shipId: string) => number;
  getCurrentPlayer: () => Player | null;
  isMyTurn: () => boolean;
  addAnimation: (anim: Omit<Animation, 'id'>) => void;
  removeAnimation: (id: string) => void;
}

let idCounter = 0;
const genId = () => `${++idCounter}`;

export const useGameStore = create<Store>((set, get) => ({
  game: null,
  plannedActions: [],
  selectedShipId: null,
  boardHexes: generateHexagonalBoard(4),
  animations: [],

  startGame: (vsAI) => {
    const boardHexes = generateHexagonalBoard(4);

    const p1: Player = { id: genId(), name: 'You', color: 'blue', isAI: false };
    const p2: Player = { id: genId(), name: vsAI ? 'AI' : 'Player 2', color: 'red', isAI: vsAI };

    // Full fleet for each player
    const createFleet = (ownerId: string, _color: 'blue' | 'red', startQ: number): Ship[] => {
      const types: ShipType[] = [
        'mothership', 'scout', 'interceptor', 'corvette', 'frigate', 'destroyer', 'cruiser', 'battleship', 'artillery',
      ];
      return types.map((type, i) => ({
        id: genId(),
        type,
        ownerId,
        position: { q: startQ, r: -4 + i },
        facing: (startQ > 0 ? 3 : 0) as HexDirection, // Face opponent
        destroyed: false,
      }));
    };

    const ships = [...createFleet(p1.id, 'blue', -3), ...createFleet(p2.id, 'red', 3)];

    const game: GameState = {
      phase: 'playing',
      players: [p1, p2],
      ships,
      debris: [],
      currentPlayerId: p1.id,
      turnNumber: 1,
      winnerId: null,
      playerAPRemaining: PLAYER_MAX_AP,
      shipAPUsed: new Map(),
    };

    set({ game, boardHexes, plannedActions: [], selectedShipId: null, animations: [] });
  },

  selectShip: (shipId) => set({ selectedShipId: shipId }),

  getValidMoves: (shipId) => {
    const { game, boardHexes, getPlannedPosition, getPlannedFacing, getShipRemainingAP } = get();
    if (!game) return [];

    const ship = game.ships.find((s) => s.id === shipId);
    if (!ship || ship.destroyed) return [];

    const pos = getPlannedPosition(shipId);
    const facing = getPlannedFacing(shipId);
    const remainingAP = getShipRemainingAP(shipId);
    const movement = SHIP_MOVEMENT[ship.type];

    if (remainingAP < 1) return [];

    const validHexes: HexCoord[] = [];

    // Check all 6 directions
    for (let dir = 0; dir < 6; dir++) {
      const neighbor = getNeighbor(pos, dir as HexDirection);

      // Check if hex exists on board
      if (!boardHexes.some((h) => hexEqual(h, neighbor))) continue;

      // Check if occupied by friendly (can move onto enemy to attack)
      const occupant = game.ships.find((s) => !s.destroyed && hexEqual(s.position, neighbor));
      if (occupant && occupant.ownerId === ship.ownerId) continue;

      // Calculate relative direction from ship's facing
      const relDir = getRelativeDirection(facing, dir as HexDirection);
      let maxDist = 0;

      switch (relDir) {
        case 'forward':
          maxDist = movement.maxForward;
          break;
        case 'forwardSide':
          maxDist = movement.maxForwardSide;
          break;
        case 'side':
          maxDist = movement.maxSide;
          break;
        case 'backward':
          maxDist = movement.maxBackward;
          break;
      }

      if (maxDist > 0) {
        validHexes.push(neighbor);
      }
    }

    return validHexes;
  },

  moveShip: (shipId, targetHex) => {
    const { game, plannedActions, getValidMoves, getShipRemainingAP, getTotalPlannedAP, getPlannedFacing, addAnimation, getPlannedPosition } = get();
    if (!game || game.phase !== 'playing') return false;

    const ship = game.ships.find((s) => s.id === shipId);
    if (!ship || ship.destroyed || ship.ownerId !== game.currentPlayerId) return false;

    const validMoves = getValidMoves(shipId);
    if (!validMoves.some((h) => hexEqual(h, targetHex))) return false;

    const moveCost = 1;
    if (getShipRemainingAP(shipId) < moveCost) return false;
    if (getTotalPlannedAP() + moveCost > game.playerAPRemaining) return false;

    const fromPos = getPlannedPosition(shipId);
    const existingIdx = plannedActions.findIndex((a) => a.shipId === shipId);
    const existing = existingIdx >= 0 ? plannedActions[existingIdx] : null;

    const newPlan: PlannedAction = {
      shipId,
      newPosition: targetHex,
      newFacing: existing ? existing.newFacing : ship.facing,
      apCost: (existing ? existing.apCost : 0) + moveCost,
    };

    const newPlans = [...plannedActions];
    if (existingIdx >= 0) {
      newPlans[existingIdx] = newPlan;
    } else {
      newPlans.push(newPlan);
    }

    // Add thruster animation
    addAnimation({
      type: 'thruster',
      position: fromPos,
      direction: getPlannedFacing(shipId),
      startTime: Date.now(),
      duration: 500,
    });

    set({ plannedActions: newPlans });
    return true;
  },

  rotateShip: (shipId, newFacing) => {
    const { game, plannedActions, getPlannedFacing, getShipRemainingAP, getTotalPlannedAP } = get();
    if (!game || game.phase !== 'playing') return false;

    const ship = game.ships.find((s) => s.id === shipId);
    if (!ship || ship.destroyed || ship.ownerId !== game.currentPlayerId) return false;

    const currentFacing = getPlannedFacing(shipId);
    if (currentFacing === newFacing) return false;

    const rotateCost = calculateTurnCost(currentFacing, newFacing) * SHIP_MOVEMENT[ship.type].rotationCostPerStep;
    if (getShipRemainingAP(shipId) < rotateCost) return false;
    if (getTotalPlannedAP() + rotateCost > game.playerAPRemaining) return false;

    const existingIdx = plannedActions.findIndex((a) => a.shipId === shipId);
    const existing = existingIdx >= 0 ? plannedActions[existingIdx] : null;

    const newPlan: PlannedAction = {
      shipId,
      newPosition: existing ? existing.newPosition : ship.position,
      newFacing,
      apCost: (existing ? existing.apCost : 0) + rotateCost,
    };

    const newPlans = [...plannedActions];
    if (existingIdx >= 0) {
      newPlans[existingIdx] = newPlan;
    } else {
      newPlans.push(newPlan);
    }

    set({ plannedActions: newPlans });
    return true;
  },

  undoLast: () => {
    const { plannedActions } = get();
    if (plannedActions.length === 0) return;
    set({ plannedActions: plannedActions.slice(0, -1) });
  },

  clearPlans: () => set({ plannedActions: [] }),

  endTurn: () => {
    const { game, plannedActions, addAnimation } = get();
    if (!game) return;

    // Apply planned actions
    const newShips = [...game.ships];
    const newDebris = [...game.debris];
    let totalAP = 0;

    for (const plan of plannedActions) {
      const idx = newShips.findIndex((s) => s.id === plan.shipId);
      if (idx < 0) continue;

      const ship = { ...newShips[idx] };

      // Check for combat
      const targetIdx = newShips.findIndex(
        (s) => !s.destroyed && hexEqual(s.position, plan.newPosition) && s.ownerId !== ship.ownerId
      );

      if (targetIdx >= 0) {
        // Combat - add explosion
        addAnimation({
          type: 'explosion',
          position: plan.newPosition,
          startTime: Date.now(),
          duration: 1000,
        });
        newShips[targetIdx] = { ...newShips[targetIdx], destroyed: true };
        newDebris.push({ position: plan.newPosition });
      }

      ship.position = plan.newPosition;
      ship.facing = plan.newFacing;
      newShips[idx] = ship;
      totalAP += plan.apCost;
    }

    // Check win condition
    let winnerId: string | null = null;
    for (const player of game.players) {
      const ms = newShips.find((s) => s.ownerId === player.id && s.type === 'mothership');
      if (ms?.destroyed) {
        const other = game.players.find((p) => p.id !== player.id);
        if (other) winnerId = other.id;
        break;
      }
    }

    // Switch to next player
    const currentIdx = game.players.findIndex((p) => p.id === game.currentPlayerId);
    const nextIdx = (currentIdx + 1) % game.players.length;
    const nextPlayer = game.players[nextIdx];

    const newGame: GameState = {
      ...game,
      ships: newShips,
      debris: newDebris,
      currentPlayerId: nextPlayer.id,
      turnNumber: nextIdx === 0 ? game.turnNumber + 1 : game.turnNumber,
      playerAPRemaining: PLAYER_MAX_AP,
      shipAPUsed: new Map(),
      winnerId,
      phase: winnerId ? 'ended' : game.phase,
    };

    set({ game: newGame, plannedActions: [], selectedShipId: null });

    // AI turn
    if (nextPlayer.isAI && !winnerId) {
      setTimeout(() => runAITurn(get, set), 1000);
    }
  },

  returnToMenu: () => set({ game: null, plannedActions: [], selectedShipId: null }),

  getPlannedPosition: (shipId) => {
    const { game, plannedActions } = get();
    if (!game) return { q: 0, r: 0 };
    const plan = plannedActions.find((a) => a.shipId === shipId);
    if (plan) return plan.newPosition;
    const ship = game.ships.find((s) => s.id === shipId);
    return ship ? ship.position : { q: 0, r: 0 };
  },

  getPlannedFacing: (shipId) => {
    const { game, plannedActions } = get();
    if (!game) return 0;
    const plan = plannedActions.find((a) => a.shipId === shipId);
    if (plan) return plan.newFacing;
    const ship = game.ships.find((s) => s.id === shipId);
    return ship ? ship.facing : 0;
  },

  getTotalPlannedAP: () => get().plannedActions.reduce((sum, p) => sum + p.apCost, 0),

  getShipRemainingAP: (shipId) => {
    const { game, plannedActions } = get();
    if (!game) return 0;
    const ship = game.ships.find((s) => s.id === shipId);
    if (!ship) return 0;
    const plan = plannedActions.find((a) => a.shipId === shipId);
    return SHIP_AP[ship.type] - (plan ? plan.apCost : 0);
  },

  getCurrentPlayer: () => {
    const { game } = get();
    if (!game) return null;
    return game.players.find((p) => p.id === game.currentPlayerId) || null;
  },

  isMyTurn: () => {
    const player = get().getCurrentPlayer();
    return player ? !player.isAI : false;
  },

  addAnimation: (anim) => {
    const { animations } = get();
    set({ animations: [...animations, { ...anim, id: genId() }] });
  },

  removeAnimation: (id) => {
    const { animations } = get();
    set({ animations: animations.filter((a) => a.id !== id) });
  },
}));

// Get relative direction from ship's facing
function getRelativeDirection(shipFacing: HexDirection, targetDir: HexDirection): string {
  const diff = (targetDir - shipFacing + 6) % 6;
  switch (diff) {
    case 0:
      return 'forward';
    case 1:
    case 5:
      return 'forwardSide';
    case 2:
    case 4:
      return 'side';
    case 3:
      return 'backward';
    default:
      return 'forward';
  }
}

// AI turn logic
function runAITurn(get: () => Store, _set: (s: Partial<Store>) => void) {
  const { game, moveShip, endTurn, getValidMoves } = get();
  if (!game) return;

  const aiPlayer = game.players.find((p) => p.isAI);
  if (!aiPlayer) return;

  const enemyMS = game.ships.find((s) => s.type === 'mothership' && s.ownerId !== aiPlayer.id && !s.destroyed);
  if (!enemyMS) {
    endTurn();
    return;
  }

  const aiShips = game.ships.filter((s) => s.ownerId === aiPlayer.id && !s.destroyed);

  // Move each ship toward enemy mothership
  for (const ship of aiShips) {
    const validMoves = getValidMoves(ship.id);
    if (validMoves.length === 0) continue;

    // Find move closest to enemy mothership
    let bestMove = validMoves[0];
    let bestDist = Infinity;
    for (const move of validMoves) {
      const dist = Math.abs(move.q - enemyMS.position.q) + Math.abs(move.r - enemyMS.position.r);
      if (dist < bestDist) {
        bestDist = dist;
        bestMove = move;
      }
    }

    moveShip(ship.id, bestMove);

    if (get().getTotalPlannedAP() >= 8) break;
  }

  setTimeout(() => endTurn(), 1500);
}
