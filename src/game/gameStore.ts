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
  DeploymentZone,
  PlannedAction,
  ReplayAction,
  Phase,
} from '@/types/game';
import {
  hexEqual,
  getNeighbor,
  calculateTurnCost,
  generateHexagonalBoard,
} from '@/engine/hexGrid';

interface Store {
  game: GameState | null;
  selectedShipId: string | null;

  // Menu actions
  startNewGame: (vsAI: boolean) => void;
  returnToMenu: () => void;

  // Dice roll phase
  rollDice: (playerId: string) => void;

  // Zone selection phase
  selectZone: (playerId: string, zoneId: number) => void;

  // Deployment phase
  selectShipToDeploy: (shipId: string) => void;
  deployShipToHex: (hex: HexCoord) => boolean;
  rotateDeployingShip: (direction: HexDirection) => void;
  confirmDeployment: () => void;
  autoDeployRemaining: () => void;

  // Battle phase
  selectShip: (shipId: string | null) => void;
  moveShip: (shipId: string, targetHex: HexCoord) => boolean;
  rotateShip: (shipId: string, newFacing: HexDirection) => boolean;
  undoLast: () => void;
  clearPlans: () => void;
  endTurn: () => void;

  // Game end
  playReplay: () => void;

  // Getters
  getValidMoves: (shipId: string) => HexCoord[];
  getPlannedPosition: (shipId: string) => HexCoord;
  getPlannedFacing: (shipId: string) => HexDirection;
  getTotalPlannedAP: () => number;
  getShipRemainingAP: (shipId: string) => number;
  getCurrentPlayer: () => Player | null;
  isMyTurn: () => boolean;
  getDeployableHexes: () => HexCoord[];
  getUndeployedShips: (playerId: string) => Ship[];

  // Animation
  addAnimation: (anim: Omit<Animation, 'id'>) => void;
  removeAnimation: (id: string) => void;
}

let idCounter = 0;
const genId = () => `${++idCounter}`;

// Generate deployment zones for the board
function createDeploymentZones(boardRadius: number): DeploymentZone[] {
  const zones: DeploymentZone[] = [];
  const allHexes = generateHexagonalBoard(boardRadius);

  // Create 4 zones - one on each edge
  const zoneNames = ['North', 'East', 'South', 'West'];
  const zoneColors = ['#88aaff', '#ffaa88', '#88ffaa', '#ffff88'];

  for (let i = 0; i < 4; i++) {
    const zoneHexes: HexCoord[] = [];

    for (const hex of allHexes) {
      // Define zones by edge positions
      let inZone = false;
      const edgeDepth = boardRadius - 2;

      switch (i) {
        case 0: // North - top of board
          inZone = hex.r <= -edgeDepth && Math.abs(hex.q) <= 2;
          break;
        case 1: // East - right side
          inZone = hex.q >= edgeDepth && Math.abs(hex.r) <= 2;
          break;
        case 2: // South - bottom of board
          inZone = hex.r >= edgeDepth && Math.abs(hex.q) <= 2;
          break;
        case 3: // West - left side
          inZone = hex.q <= -edgeDepth && Math.abs(hex.r) <= 2;
          break;
      }

      if (inZone) {
        zoneHexes.push(hex);
      }
    }

    zones.push({
      id: i,
      name: zoneNames[i],
      hexes: zoneHexes,
      color: zoneColors[i],
      ownerId: null,
    });
  }

  return zones;
}

// Create fleet for a player (ships not yet deployed)
function createFleet(ownerId: string): Ship[] {
  const types: ShipType[] = [
    'mothership',
    'scout',
    'interceptor',
    'corvette',
    'destroyer',
    'cruiser',
    'battleship',
    'artillery',
  ];

  return types.map((type) => ({
    id: genId(),
    type,
    ownerId,
    position: { q: 999, r: 999 }, // Off-board until deployed
    facing: 0 as HexDirection,
    deployed: false,
    destroyed: false,
  }));
}

export const useGameStore = create<Store>((set, get) => ({
  game: null,
  selectedShipId: null,

  startNewGame: (vsAI) => {
    const boardRadius = 5;
    const boardHexes = generateHexagonalBoard(boardRadius);
    const deploymentZones = createDeploymentZones(boardRadius);

    const p1: Player = {
      id: genId(),
      name: 'You',
      color: 'blue',
      isAI: false,
      diceRoll: null,
      selectedZone: null,
    };
    const p2: Player = {
      id: genId(),
      name: vsAI ? 'AI' : 'Player 2',
      color: 'red',
      isAI: vsAI,
      diceRoll: null,
      selectedZone: null,
    };

    const ships = [...createFleet(p1.id), ...createFleet(p2.id)];

    const game: GameState = {
      phase: 'diceRoll',
      players: [p1, p2],
      ships,
      debris: [],
      deploymentZones,
      boardHexes,
      boardRadius,
      currentPlayerId: p1.id,
      turnNumber: 0,
      playerAPRemaining: PLAYER_MAX_AP,
      winnerId: null,

      zoneSelectionOrder: [],
      currentZoneSelector: 0,

      deployingPlayerId: null,
      shipToDeployId: null,

      plannedActions: [],

      gameHistory: [],
      stats: {
        turnCount: 0,
        shipsDestroyed: { [p1.id]: 0, [p2.id]: 0 },
        totalMovements: { [p1.id]: 0, [p2.id]: 0 },
        gameDuration: 0,
      },

      animations: [],
      startTime: Date.now(),
    };

    set({ game, selectedShipId: null });

    // If playing vs AI, AI rolls automatically after a delay
    if (vsAI) {
      setTimeout(() => {
        const { game: g } = get();
        if (g && g.phase === 'diceRoll' && g.players[1].diceRoll === null) {
          get().rollDice(g.players[1].id);
        }
      }, 1000);
    }
  },

  returnToMenu: () => set({ game: null, selectedShipId: null }),

  rollDice: (playerId) => {
    const { game } = get();
    if (!game || game.phase !== 'diceRoll') return;

    const player = game.players.find((p) => p.id === playerId);
    if (!player || player.diceRoll !== null) return;

    const roll = Math.floor(Math.random() * 6) + 1;
    const newPlayers = game.players.map((p) =>
      p.id === playerId ? { ...p, diceRoll: roll } : p
    );

    const newGame = { ...game, players: newPlayers };

    // Check if all players have rolled
    const allRolled = newPlayers.every((p) => p.diceRoll !== null);

    if (allRolled) {
      // Determine zone selection order (highest roll first)
      const sorted = [...newPlayers].sort((a, b) => (b.diceRoll || 0) - (a.diceRoll || 0));
      newGame.zoneSelectionOrder = sorted.map((p) => p.id);
      newGame.currentZoneSelector = 0;
      newGame.phase = 'zoneSelection';

      // AI selects zone automatically
      setTimeout(() => {
        const { game: g } = get();
        if (g && g.phase === 'zoneSelection') {
          const currentSelector = g.zoneSelectionOrder[g.currentZoneSelector];
          const selectorPlayer = g.players.find((p) => p.id === currentSelector);
          if (selectorPlayer?.isAI) {
            const availableZones = g.deploymentZones.filter((z) => z.ownerId === null);
            if (availableZones.length > 0) {
              get().selectZone(currentSelector, availableZones[0].id);
            }
          }
        }
      }, 1000);
    }

    set({ game: newGame });
  },

  selectZone: (playerId, zoneId) => {
    const { game } = get();
    if (!game || game.phase !== 'zoneSelection') return;

    const currentSelector = game.zoneSelectionOrder[game.currentZoneSelector];
    if (currentSelector !== playerId) return;

    const zone = game.deploymentZones.find((z) => z.id === zoneId);
    if (!zone || zone.ownerId !== null) return;

    const newZones = game.deploymentZones.map((z) =>
      z.id === zoneId ? { ...z, ownerId: playerId } : z
    );

    const newPlayers = game.players.map((p) =>
      p.id === playerId ? { ...p, selectedZone: zoneId } : p
    );

    const newGame = {
      ...game,
      deploymentZones: newZones,
      players: newPlayers,
      currentZoneSelector: game.currentZoneSelector + 1,
    };

    // Check if all players have selected zones
    if (newGame.currentZoneSelector >= game.players.length) {
      newGame.phase = 'deployment';
      newGame.deployingPlayerId = game.players[0].id;

      // Set first ship to deploy
      const firstPlayer = game.players[0];
      const undeployed = game.ships.filter((s) => s.ownerId === firstPlayer.id && !s.deployed);
      if (undeployed.length > 0) {
        newGame.shipToDeployId = undeployed[0].id;
      }
    }

    set({ game: newGame });

    // AI selects zone automatically for next selector
    setTimeout(() => {
      const { game: g } = get();
      if (g && g.phase === 'zoneSelection') {
        const nextSelector = g.zoneSelectionOrder[g.currentZoneSelector];
        const nextPlayer = g.players.find((p) => p.id === nextSelector);
        if (nextPlayer?.isAI) {
          const availableZones = g.deploymentZones.filter((z) => z.ownerId === null);
          if (availableZones.length > 0) {
            get().selectZone(nextSelector, availableZones[0].id);
          }
        }
      } else if (g && g.phase === 'deployment') {
        // AI auto-deploys
        const deployer = g.players.find((p) => p.id === g.deployingPlayerId);
        if (deployer?.isAI) {
          get().autoDeployRemaining();
        }
      }
    }, 500);
  },

  selectShipToDeploy: (shipId) => {
    const { game } = get();
    if (!game || game.phase !== 'deployment') return;

    const ship = game.ships.find((s) => s.id === shipId);
    if (!ship || ship.deployed || ship.ownerId !== game.deployingPlayerId) return;

    set({ game: { ...game, shipToDeployId: shipId } });
  },

  getDeployableHexes: () => {
    const { game } = get();
    if (!game || game.phase !== 'deployment' || !game.deployingPlayerId) return [];

    const player = game.players.find((p) => p.id === game.deployingPlayerId);
    if (!player || player.selectedZone === null) return [];

    const zone = game.deploymentZones.find((z) => z.id === player.selectedZone);
    if (!zone) return [];

    // Filter out hexes already occupied
    return zone.hexes.filter((hex) => {
      const occupied = game.ships.some(
        (s) => s.deployed && !s.destroyed && hexEqual(s.position, hex)
      );
      return !occupied;
    });
  },

  deployShipToHex: (hex) => {
    const { game, getDeployableHexes } = get();
    if (!game || game.phase !== 'deployment' || !game.shipToDeployId) return false;

    const deployableHexes = getDeployableHexes();
    if (!deployableHexes.some((h) => hexEqual(h, hex))) return false;

    const shipIdx = game.ships.findIndex((s) => s.id === game.shipToDeployId);
    if (shipIdx < 0) return false;

    const ship = game.ships[shipIdx];

    // Calculate default facing (toward center of board)
    const toCenter = Math.atan2(-hex.r, -hex.q);
    const angleToDir = (angle: number): HexDirection => {
      const deg = ((angle * 180) / Math.PI + 360) % 360;
      return (Math.round(deg / 60) % 6) as HexDirection;
    };

    const newShips = [...game.ships];
    newShips[shipIdx] = {
      ...ship,
      position: hex,
      facing: angleToDir(toCenter),
      deployed: true,
    };

    // Find next ship to deploy
    const remaining = newShips.filter(
      (s) => s.ownerId === game.deployingPlayerId && !s.deployed
    );

    const newGame = {
      ...game,
      ships: newShips,
      shipToDeployId: remaining.length > 0 ? remaining[0].id : null,
    };

    set({ game: newGame });
    return true;
  },

  rotateDeployingShip: (direction) => {
    const { game } = get();
    if (!game || game.phase !== 'deployment' || !game.shipToDeployId) return;

    const shipIdx = game.ships.findIndex((s) => s.id === game.shipToDeployId);
    if (shipIdx < 0) return;

    const ship = game.ships[shipIdx];
    if (!ship.deployed) return; // Can only rotate after placement

    const newShips = [...game.ships];
    newShips[shipIdx] = { ...ship, facing: direction };

    set({ game: { ...game, ships: newShips } });
  },

  confirmDeployment: () => {
    const { game } = get();
    if (!game || game.phase !== 'deployment') return;

    const undeployed = game.ships.filter(
      (s) => s.ownerId === game.deployingPlayerId && !s.deployed
    );
    if (undeployed.length > 0) return; // Must deploy all ships first

    // Move to next player's deployment
    const currentIdx = game.players.findIndex((p) => p.id === game.deployingPlayerId);
    const nextIdx = currentIdx + 1;

    if (nextIdx < game.players.length) {
      const nextPlayer = game.players[nextIdx];
      const nextUndeployed = game.ships.filter(
        (s) => s.ownerId === nextPlayer.id && !s.deployed
      );

      const newGame = {
        ...game,
        deployingPlayerId: nextPlayer.id,
        shipToDeployId: nextUndeployed.length > 0 ? nextUndeployed[0].id : null,
      };

      set({ game: newGame });

      // AI auto-deploys
      if (nextPlayer.isAI) {
        setTimeout(() => get().autoDeployRemaining(), 500);
      }
    } else {
      // All players deployed - start battle
      const newGame = {
        ...game,
        phase: 'battle' as Phase,
        deployingPlayerId: null,
        shipToDeployId: null,
        currentPlayerId: game.players[0].id,
        turnNumber: 1,
      };

      set({ game: newGame });
    }
  },

  autoDeployRemaining: () => {
    const { game, getDeployableHexes, deployShipToHex, confirmDeployment } = get();
    if (!game || game.phase !== 'deployment' || !game.deployingPlayerId) return;

    const undeployed = game.ships.filter(
      (s) => s.ownerId === game.deployingPlayerId && !s.deployed
    );

    for (const ship of undeployed) {
      const hexes = getDeployableHexes();
      if (hexes.length > 0) {
        // Pick a random hex
        const hex = hexes[Math.floor(Math.random() * hexes.length)];
        set({ game: { ...get().game!, shipToDeployId: ship.id } });
        deployShipToHex(hex);
      }
    }

    setTimeout(() => confirmDeployment(), 500);
  },

  getUndeployedShips: (playerId) => {
    const { game } = get();
    if (!game) return [];
    return game.ships.filter((s) => s.ownerId === playerId && !s.deployed);
  },

  selectShip: (shipId) => set({ selectedShipId: shipId }),

  getValidMoves: (shipId) => {
    const { game, getPlannedPosition, getPlannedFacing, getShipRemainingAP } = get();
    if (!game || game.phase !== 'battle') return [];

    const ship = game.ships.find((s) => s.id === shipId);
    if (!ship || ship.destroyed || !ship.deployed) return [];

    const pos = getPlannedPosition(shipId);
    const facing = getPlannedFacing(shipId);
    const remainingAP = getShipRemainingAP(shipId);
    const movement = SHIP_MOVEMENT[ship.type];

    if (remainingAP < 1) return [];

    const validHexes: HexCoord[] = [];

    for (let dir = 0; dir < 6; dir++) {
      const neighbor = getNeighbor(pos, dir as HexDirection);

      if (!game.boardHexes.some((h) => hexEqual(h, neighbor))) continue;

      const occupant = game.ships.find(
        (s) => s.deployed && !s.destroyed && hexEqual(s.position, neighbor)
      );
      if (occupant && occupant.ownerId === ship.ownerId) continue;

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
    const { game, getValidMoves, getShipRemainingAP, getTotalPlannedAP, getPlannedFacing, addAnimation, getPlannedPosition } = get();
    if (!game || game.phase !== 'battle') return false;

    const ship = game.ships.find((s) => s.id === shipId);
    if (!ship || ship.destroyed || ship.ownerId !== game.currentPlayerId) return false;

    const validMoves = getValidMoves(shipId);
    if (!validMoves.some((h) => hexEqual(h, targetHex))) return false;

    const moveCost = 1;
    if (getShipRemainingAP(shipId) < moveCost) return false;
    if (getTotalPlannedAP() + moveCost > game.playerAPRemaining) return false;

    const fromPos = getPlannedPosition(shipId);
    const existingIdx = game.plannedActions.findIndex((a) => a.shipId === shipId);
    const existing = existingIdx >= 0 ? game.plannedActions[existingIdx] : null;

    const newPlan: PlannedAction = {
      shipId,
      type: 'move',
      newPosition: targetHex,
      newFacing: existing?.newFacing || ship.facing,
      apCost: (existing ? existing.apCost : 0) + moveCost,
    };

    const newPlans = [...game.plannedActions];
    if (existingIdx >= 0) {
      newPlans[existingIdx] = newPlan;
    } else {
      newPlans.push(newPlan);
    }

    addAnimation({
      type: 'thruster',
      position: fromPos,
      direction: getPlannedFacing(shipId),
      startTime: Date.now(),
      duration: 500,
    });

    set({ game: { ...game, plannedActions: newPlans } });
    return true;
  },

  rotateShip: (shipId, newFacing) => {
    const { game, getPlannedFacing, getShipRemainingAP, getTotalPlannedAP } = get();
    if (!game || game.phase !== 'battle') return false;

    const ship = game.ships.find((s) => s.id === shipId);
    if (!ship || ship.destroyed || ship.ownerId !== game.currentPlayerId) return false;

    const currentFacing = getPlannedFacing(shipId);
    if (currentFacing === newFacing) return false;

    const rotateCost =
      calculateTurnCost(currentFacing, newFacing) * SHIP_MOVEMENT[ship.type].rotationCostPerStep;
    if (getShipRemainingAP(shipId) < rotateCost) return false;
    if (getTotalPlannedAP() + rotateCost > game.playerAPRemaining) return false;

    const existingIdx = game.plannedActions.findIndex((a) => a.shipId === shipId);
    const existing = existingIdx >= 0 ? game.plannedActions[existingIdx] : null;

    const newPlan: PlannedAction = {
      shipId,
      type: 'rotate',
      newPosition: existing?.newPosition || ship.position,
      newFacing,
      apCost: (existing ? existing.apCost : 0) + rotateCost,
    };

    const newPlans = [...game.plannedActions];
    if (existingIdx >= 0) {
      newPlans[existingIdx] = newPlan;
    } else {
      newPlans.push(newPlan);
    }

    set({ game: { ...game, plannedActions: newPlans } });
    return true;
  },

  undoLast: () => {
    const { game } = get();
    if (!game || game.plannedActions.length === 0) return;
    set({ game: { ...game, plannedActions: game.plannedActions.slice(0, -1) } });
  },

  clearPlans: () => {
    const { game } = get();
    if (!game) return;
    set({ game: { ...game, plannedActions: [] } });
  },

  endTurn: () => {
    const { game, addAnimation } = get();
    if (!game || game.phase !== 'battle') return;

    const newShips = [...game.ships];
    const newDebris = [...game.debris];
    const newStats = { ...game.stats };
    let totalAP = 0;

    // Save to replay history
    const replayAction: ReplayAction = {
      turn: game.turnNumber,
      playerId: game.currentPlayerId,
      actions: [...game.plannedActions],
      timestamp: Date.now(),
    };

    // Apply planned actions
    for (const plan of game.plannedActions) {
      const idx = newShips.findIndex((s) => s.id === plan.shipId);
      if (idx < 0) continue;

      const ship = { ...newShips[idx] };

      if (plan.newPosition) {
        const targetIdx = newShips.findIndex(
          (s) =>
            s.deployed &&
            !s.destroyed &&
            hexEqual(s.position, plan.newPosition!) &&
            s.ownerId !== ship.ownerId
        );

        if (targetIdx >= 0) {
          addAnimation({
            type: 'explosion',
            position: plan.newPosition,
            startTime: Date.now(),
            duration: 1200,
          });
          newShips[targetIdx] = { ...newShips[targetIdx], destroyed: true };
          newDebris.push({ id: genId(), position: plan.newPosition });
          newStats.shipsDestroyed[game.currentPlayerId] =
            (newStats.shipsDestroyed[game.currentPlayerId] || 0) + 1;
        }

        ship.position = plan.newPosition;
        newStats.totalMovements[game.currentPlayerId] =
          (newStats.totalMovements[game.currentPlayerId] || 0) + 1;
      }

      if (plan.newFacing !== undefined) {
        ship.facing = plan.newFacing;
      }

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

    // Wait for animations to finish before ending game
    const animationDelay = winnerId ? 1500 : 0;

    setTimeout(() => {
      const { game: currentGame } = get();
      if (!currentGame) return;

      const currentIdx = currentGame.players.findIndex((p) => p.id === currentGame.currentPlayerId);
      const nextIdx = (currentIdx + 1) % currentGame.players.length;
      const nextPlayer = currentGame.players[nextIdx];

      const finalStats = {
        ...newStats,
        turnCount: nextIdx === 0 ? currentGame.turnNumber + 1 : currentGame.turnNumber,
        gameDuration: Date.now() - currentGame.startTime,
      };

      const newGame: GameState = {
        ...currentGame,
        ships: newShips,
        debris: newDebris,
        currentPlayerId: nextPlayer.id,
        turnNumber: nextIdx === 0 ? currentGame.turnNumber + 1 : currentGame.turnNumber,
        playerAPRemaining: PLAYER_MAX_AP,
        winnerId,
        phase: winnerId ? 'ended' : currentGame.phase,
        plannedActions: [],
        gameHistory: [...currentGame.gameHistory, replayAction],
        stats: finalStats,
      };

      set({ game: newGame, selectedShipId: null });

      // AI turn
      if (nextPlayer.isAI && !winnerId) {
        setTimeout(() => runAITurn(get, set), 1000);
      }
    }, animationDelay);
  },

  playReplay: () => {
    // Placeholder for replay functionality
    console.log('Replay feature not yet implemented');
  },

  getPlannedPosition: (shipId) => {
    const { game } = get();
    if (!game) return { q: 0, r: 0 };
    const plan = game.plannedActions.find((a) => a.shipId === shipId);
    if (plan?.newPosition) return plan.newPosition;
    const ship = game.ships.find((s) => s.id === shipId);
    return ship ? ship.position : { q: 0, r: 0 };
  },

  getPlannedFacing: (shipId) => {
    const { game } = get();
    if (!game) return 0;
    const plan = game.plannedActions.find((a) => a.shipId === shipId);
    if (plan?.newFacing !== undefined) return plan.newFacing;
    const ship = game.ships.find((s) => s.id === shipId);
    return ship ? ship.facing : 0;
  },

  getTotalPlannedAP: () => {
    const { game } = get();
    if (!game) return 0;
    return game.plannedActions.reduce((sum, p) => sum + p.apCost, 0);
  },

  getShipRemainingAP: (shipId) => {
    const { game } = get();
    if (!game) return 0;
    const ship = game.ships.find((s) => s.id === shipId);
    if (!ship) return 0;
    const plan = game.plannedActions.find((a) => a.shipId === shipId);
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
    const { game } = get();
    if (!game) return;
    set({ game: { ...game, animations: [...game.animations, { ...anim, id: genId() }] } });
  },

  removeAnimation: (id) => {
    const { game } = get();
    if (!game) return;
    set({ game: { ...game, animations: game.animations.filter((a) => a.id !== id) } });
  },
}));

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

function runAITurn(get: () => Store, _set: (s: Partial<Store>) => void) {
  const { game, moveShip, endTurn, getValidMoves, getTotalPlannedAP } = get();
  if (!game || game.phase !== 'battle') return;

  const aiPlayer = game.players.find((p) => p.isAI);
  if (!aiPlayer) return;

  const enemyMS = game.ships.find(
    (s) => s.type === 'mothership' && s.ownerId !== aiPlayer.id && !s.destroyed && s.deployed
  );
  if (!enemyMS) {
    endTurn();
    return;
  }

  const aiShips = game.ships.filter((s) => s.ownerId === aiPlayer.id && !s.destroyed && s.deployed);

  for (const ship of aiShips) {
    if (getTotalPlannedAP() >= 8) break;

    const validMoves = getValidMoves(ship.id);
    if (validMoves.length === 0) continue;

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
  }

  setTimeout(() => endTurn(), 1500);
}
