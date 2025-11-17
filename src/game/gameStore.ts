import { create } from 'zustand';
import {
  GameState,
  Phase,
  Player,
  Ship,
  Debris,
  HexCoord,
  HexDirection,
  ShipType,
  SHIP_STATS,
  PLAYER_MAX_AP,
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

  startGame: (vsAI: boolean) => void;
  selectShip: (shipId: string | null) => void;
  planMove: (shipId: string, targetHex: HexCoord) => boolean;
  planRotate: (shipId: string, newFacing: HexDirection) => boolean;
  undoLastPlan: () => void;
  clearPlans: () => void;
  confirmTurn: () => void;
  endTurn: () => void;
  returnToMenu: () => void;

  getShipAt: (hex: HexCoord) => Ship | null;
  getPlannedPosition: (shipId: string) => HexCoord;
  getPlannedFacing: (shipId: string) => HexDirection;
  getTotalPlannedAP: () => number;
  getShipPlannedAP: (shipId: string) => number;
  canMoveShip: (shipId: string) => boolean;
  isValidHex: (hex: HexCoord) => boolean;
  getCurrentPlayer: () => Player | null;
  isCurrentPlayerAI: () => boolean;
  runAITurn: () => void;
}

let idCounter = 0;
const genId = () => `id_${++idCounter}`;

export const useGameStore = create<Store>((set, get) => ({
  game: null,
  plannedActions: [],
  selectedShipId: null,
  boardHexes: generateHexagonalBoard(4),

  startGame: (vsAI: boolean) => {
    const boardHexes = generateHexagonalBoard(4);

    const player1: Player = {
      id: genId(),
      name: 'You',
      color: '#4488ff',
      isAI: false,
    };

    const player2: Player = {
      id: genId(),
      name: vsAI ? 'AI' : 'Player 2',
      color: '#ff4444',
      isAI: vsAI,
    };

    const createFleet = (ownerId: string, startQ: number): Ship[] => {
      const types: ShipType[] = ['mothership', 'cruiser', 'frigate', 'scout'];
      return types.map((type, i) => ({
        id: genId(),
        type,
        ownerId,
        position: { q: startQ, r: -2 + i },
        facing: (startQ > 0 ? 3 : 0) as HexDirection,
        maxAP: SHIP_STATS[type].maxAP,
        destroyed: false,
      }));
    };

    const ships = [...createFleet(player1.id, -3), ...createFleet(player2.id, 3)];

    const game: GameState = {
      phase: 'playing',
      players: [player1, player2],
      ships,
      debris: [],
      currentPlayerId: player1.id,
      turnNumber: 1,
      winnerId: null,
      playerAPRemaining: PLAYER_MAX_AP,
      shipsMovedThisTurn: new Set(),
    };

    set({ game, boardHexes, plannedActions: [], selectedShipId: null });
  },

  selectShip: (shipId) => set({ selectedShipId: shipId }),

  planMove: (shipId, targetHex) => {
    const { game, plannedActions, isValidHex, getPlannedPosition, getShipPlannedAP, getTotalPlannedAP, canMoveShip } = get();
    if (!game || game.phase !== 'playing') return false;

    const ship = game.ships.find((s) => s.id === shipId);
    if (!ship || ship.destroyed || ship.ownerId !== game.currentPlayerId) return false;
    if (!canMoveShip(shipId)) return false;
    if (!isValidHex(targetHex)) return false;

    const currentPos = getPlannedPosition(shipId);

    // Must be adjacent
    let isAdjacent = false;
    for (let dir = 0; dir < 6; dir++) {
      if (hexEqual(getNeighbor(currentPos, dir as HexDirection), targetHex)) {
        isAdjacent = true;
        break;
      }
    }
    if (!isAdjacent) return false;

    // Check if occupied by friendly
    const occupant = get().getShipAt(targetHex);
    if (occupant && !occupant.destroyed && occupant.ownerId === game.currentPlayerId) {
      return false;
    }

    // Check AP
    const moveCost = 1;
    const shipAP = getShipPlannedAP(shipId);
    const totalAP = getTotalPlannedAP();

    if (moveCost > shipAP) return false;
    if (totalAP + moveCost > game.playerAPRemaining) return false;

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

    set({ plannedActions: newPlans });
    return true;
  },

  planRotate: (shipId, newFacing) => {
    const { game, plannedActions, getPlannedFacing, getShipPlannedAP, getTotalPlannedAP, canMoveShip } = get();
    if (!game || game.phase !== 'playing') return false;

    const ship = game.ships.find((s) => s.id === shipId);
    if (!ship || ship.destroyed || ship.ownerId !== game.currentPlayerId) return false;
    if (!canMoveShip(shipId)) return false;

    const currentFacing = getPlannedFacing(shipId);
    if (currentFacing === newFacing) return false;

    const rotateCost = calculateTurnCost(currentFacing, newFacing);
    const shipAP = getShipPlannedAP(shipId);
    const totalAP = getTotalPlannedAP();

    if (rotateCost > shipAP) return false;
    if (totalAP + rotateCost > game.playerAPRemaining) return false;

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

  undoLastPlan: () => {
    const { plannedActions } = get();
    if (plannedActions.length === 0) return;
    set({ plannedActions: plannedActions.slice(0, -1) });
  },

  clearPlans: () => set({ plannedActions: [] }),

  confirmTurn: () => {
    const { game, plannedActions } = get();
    if (!game || plannedActions.length === 0) return;

    const newShips = [...game.ships];
    const newDebris = [...game.debris];
    let totalAPUsed = 0;
    const shipsUsed = new Set<string>();

    for (const plan of plannedActions) {
      const shipIdx = newShips.findIndex((s) => s.id === plan.shipId);
      if (shipIdx < 0) continue;

      const ship = { ...newShips[shipIdx] };

      // Combat check
      const targetIdx = newShips.findIndex(
        (s) => !s.destroyed && hexEqual(s.position, plan.newPosition) && s.ownerId !== ship.ownerId
      );

      if (targetIdx >= 0) {
        newShips[targetIdx] = { ...newShips[targetIdx], destroyed: true };
        newDebris.push({ position: plan.newPosition });
      }

      ship.position = plan.newPosition;
      ship.facing = plan.newFacing;
      newShips[shipIdx] = ship;
      totalAPUsed += plan.apCost;
      shipsUsed.add(plan.shipId);
    }

    // Win check
    let winnerId: string | null = null;
    for (const player of game.players) {
      const mothership = newShips.find((s) => s.ownerId === player.id && s.type === 'mothership');
      if (mothership?.destroyed) {
        const other = game.players.find((p) => p.id !== player.id);
        if (other) winnerId = other.id;
        break;
      }
    }

    const newGame: GameState = {
      ...game,
      ships: newShips,
      debris: newDebris,
      playerAPRemaining: game.playerAPRemaining - totalAPUsed,
      shipsMovedThisTurn: new Set([...game.shipsMovedThisTurn, ...shipsUsed]),
      winnerId,
      phase: winnerId ? 'ended' : game.phase,
    };

    set({ game: newGame, plannedActions: [] });
  },

  endTurn: () => {
    const { game, confirmTurn } = get();
    if (!game) return;

    confirmTurn();

    const currentGame = get().game;
    if (!currentGame || currentGame.winnerId) return;

    const currentIdx = currentGame.players.findIndex((p) => p.id === currentGame.currentPlayerId);
    const nextIdx = (currentIdx + 1) % currentGame.players.length;
    const nextPlayer = currentGame.players[nextIdx];
    const newTurnNumber = nextIdx === 0 ? currentGame.turnNumber + 1 : currentGame.turnNumber;

    const newGame: GameState = {
      ...currentGame,
      currentPlayerId: nextPlayer.id,
      turnNumber: newTurnNumber,
      playerAPRemaining: PLAYER_MAX_AP,
      shipsMovedThisTurn: new Set(),
    };

    set({ game: newGame, plannedActions: [], selectedShipId: null });

    if (nextPlayer.isAI) {
      setTimeout(() => get().runAITurn(), 1000);
    }
  },

  returnToMenu: () => set({ game: null, plannedActions: [], selectedShipId: null }),

  getShipAt: (hex) => {
    const { game, plannedActions } = get();
    if (!game) return null;

    for (const plan of plannedActions) {
      if (hexEqual(plan.newPosition, hex)) {
        const ship = game.ships.find((s) => s.id === plan.shipId);
        if (ship && !ship.destroyed) return ship;
      }
    }

    const plannedIds = new Set(plannedActions.map((p) => p.shipId));
    for (const ship of game.ships) {
      if (!ship.destroyed && !plannedIds.has(ship.id) && hexEqual(ship.position, hex)) {
        return ship;
      }
    }

    return null;
  },

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

  getShipPlannedAP: (shipId) => {
    const { game, plannedActions } = get();
    if (!game) return 0;
    const ship = game.ships.find((s) => s.id === shipId);
    if (!ship) return 0;
    const plan = plannedActions.find((a) => a.shipId === shipId);
    return ship.maxAP - (plan ? plan.apCost : 0);
  },

  canMoveShip: (shipId) => {
    const { game } = get();
    if (!game) return false;
    const ship = game.ships.find((s) => s.id === shipId);
    if (!ship || ship.destroyed) return false;
    const isInDebris = game.debris.some((d) => hexEqual(d.position, ship.position));
    if (isInDebris && game.shipsMovedThisTurn.has(shipId)) return false;
    return true;
  },

  isValidHex: (hex) => get().boardHexes.some((h) => hexEqual(h, hex)),

  getCurrentPlayer: () => {
    const { game } = get();
    if (!game) return null;
    return game.players.find((p) => p.id === game.currentPlayerId) || null;
  },

  isCurrentPlayerAI: () => get().getCurrentPlayer()?.isAI || false,

  runAITurn: () => {
    const { game, planMove, endTurn } = get();
    if (!game || !get().isCurrentPlayerAI()) return;

    const aiPlayer = get().getCurrentPlayer();
    if (!aiPlayer) return;

    const enemyMothership = game.ships.find(
      (s) => s.type === 'mothership' && s.ownerId !== aiPlayer.id && !s.destroyed
    );

    if (!enemyMothership) {
      endTurn();
      return;
    }

    const aiShips = game.ships.filter((s) => s.ownerId === aiPlayer.id && !s.destroyed);

    for (const ship of aiShips) {
      const currentPos = get().getPlannedPosition(ship.id);
      let bestHex: HexCoord | null = null;
      let bestDist = Infinity;

      for (let dir = 0; dir < 6; dir++) {
        const neighbor = getNeighbor(currentPos, dir as HexDirection);
        if (!get().isValidHex(neighbor)) continue;
        const dist = Math.abs(neighbor.q - enemyMothership.position.q) + Math.abs(neighbor.r - enemyMothership.position.r);
        if (dist < bestDist) {
          bestDist = dist;
          bestHex = neighbor;
        }
      }

      if (bestHex) planMove(ship.id, bestHex);
      if (get().getTotalPlannedAP() >= 8) break;
    }

    setTimeout(() => {
      get().confirmTurn();
      setTimeout(() => get().endTurn(), 500);
    }, 1000);
  },
}));
