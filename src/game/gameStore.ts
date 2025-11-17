import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  GameState,
  GamePhase,
  Player,
  Ship,
  Move,
  Turn,
  HexCoord,
  HexDirection,
  DebrisField,
  GameSettings,
  SHIP_STATS,
  STARTING_FLEET,
  PLAYER_AP_PER_TURN,
  PendingAction,
  Animation,
} from '@/types/game';
import {
  hexEqual,
  hexToKey,
  calculateTurnCost,
  getNeighbor,
} from '@/engine/hexGrid';
import { generateDefaultMap } from './mapGenerator';

interface GameStore {
  // Core state
  gameState: GameState | null;
  localPlayerId: string | null;
  pendingActions: Map<string, PendingAction>;
  animations: Animation[];
  selectedShipId: string | null;

  // UI state
  isReplayMode: boolean;
  replayTurnIndex: number;
  isTutorialMode: boolean;
  tutorialStep: number;

  // Actions
  initGame: (settings: GameSettings, localPlayerId: string) => void;
  addPlayer: (name: string, color: string) => Player;
  removePlayer: (playerId: string) => void;

  // Dice roll phase
  rollDice: (playerId: string) => number;
  selectDeploymentZone: (playerId: string, zoneIndex: number) => void;

  // Deployment phase
  deployShip: (shipId: string, position: HexCoord, facing: HexDirection) => boolean;
  undeployShip: (shipId: string) => void;
  confirmDeployment: (playerId: string) => void;
  autoDeployRemaining: (playerId: string) => void;

  // Battle phase
  selectShip: (shipId: string | null) => void;
  addPendingMove: (shipId: string, targetHex: HexCoord) => boolean;
  addPendingTurn: (shipId: string, newFacing: HexDirection) => boolean;
  undoLastAction: (shipId: string) => void;
  undoAllActions: () => void;
  confirmTurn: () => void;

  // Animation
  addAnimation: (animation: Omit<Animation, 'id'>) => void;
  removeAnimation: (id: string) => void;
  clearAnimations: () => void;

  // Game flow
  nextPhase: () => void;
  endGame: (winnerId: string) => void;

  // Replay
  setReplayMode: (enabled: boolean) => void;
  goToTurn: (turnIndex: number) => void;

  // Time management
  updatePlayerTime: (playerId: string, timeRemaining: number) => void;

  // Utility
  getLocalPlayer: () => Player | null;
  getCurrentPlayer: () => Player | null;
  getShipById: (shipId: string) => Ship | null;
  isMyTurn: () => boolean;
  canAffordAP: (apCost: number) => boolean;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  localPlayerId: null,
  pendingActions: new Map(),
  animations: [],
  selectedShipId: null,
  isReplayMode: false,
  replayTurnIndex: 0,
  isTutorialMode: false,
  tutorialStep: 0,

  initGame: (settings, localPlayerId) => {
    const map = generateDefaultMap();
    const gameState: GameState = {
      id: uuidv4(),
      phase: 'lobby',
      settings,
      players: [],
      currentPlayerIndex: 0,
      turnNumber: 0,
      debris: [],
      map,
      turnHistory: [],
      winner: null,
    };

    set({ gameState, localPlayerId, pendingActions: new Map() });
  },

  addPlayer: (name, color) => {
    const { gameState } = get();
    if (!gameState) throw new Error('Game not initialized');

    const playerId = uuidv4();
    const ships: Ship[] = STARTING_FLEET.map((type) => ({
      id: uuidv4(),
      type,
      playerId,
      position: { q: 0, r: 0 },
      facing: 0,
      currentAP: SHIP_STATS[type].maxAP,
      maxAP: SHIP_STATS[type].maxAP,
      isDeployed: false,
      isDestroyed: false,
    }));

    const player: Player = {
      id: playerId,
      name,
      color: color as 'blue' | 'red' | 'green' | 'yellow',
      ships,
      totalAP: PLAYER_AP_PER_TURN,
      remainingAP: PLAYER_AP_PER_TURN,
      timeRemaining: gameState.settings.timeControl.gameTime,
      isEliminated: false,
      deploymentZone: null,
      diceRoll: null,
    };

    set({
      gameState: {
        ...gameState,
        players: [...gameState.players, player],
      },
    });

    return player;
  },

  removePlayer: (playerId) => {
    const { gameState } = get();
    if (!gameState) return;

    set({
      gameState: {
        ...gameState,
        players: gameState.players.filter((p) => p.id !== playerId),
      },
    });
  },

  rollDice: (playerId) => {
    const { gameState } = get();
    if (!gameState) return 0;

    const roll = Math.floor(Math.random() * 6) + 1;
    const updatedPlayers = gameState.players.map((p) =>
      p.id === playerId ? { ...p, diceRoll: roll } : p
    );

    set({
      gameState: {
        ...gameState,
        players: updatedPlayers,
      },
    });

    return roll;
  },

  selectDeploymentZone: (playerId, zoneIndex) => {
    const { gameState } = get();
    if (!gameState) return;

    const updatedPlayers = gameState.players.map((p) =>
      p.id === playerId ? { ...p, deploymentZone: zoneIndex } : p
    );

    set({
      gameState: {
        ...gameState,
        players: updatedPlayers,
      },
    });
  },

  deployShip: (shipId, position, facing) => {
    const { gameState } = get();
    if (!gameState) return false;

    // Check if hex is valid and in deployment zone
    const updatedPlayers = gameState.players.map((player) => {
      const shipIndex = player.ships.findIndex((s) => s.id === shipId);
      if (shipIndex === -1) return player;

      // Check if position is in player's deployment zone
      if (player.deploymentZone === null) return player;
      const zoneHexes = gameState.map.deploymentZones[player.deploymentZone];
      const isInZone = zoneHexes.some((h) => hexEqual(h, position));
      if (!isInZone) return player;

      // Check if hex is not occupied
      const isOccupied = player.ships.some(
        (s) => s.isDeployed && !s.isDestroyed && hexEqual(s.position, position)
      );
      if (isOccupied) return player;

      const updatedShips = [...player.ships];
      updatedShips[shipIndex] = {
        ...updatedShips[shipIndex],
        position,
        facing,
        isDeployed: true,
      };

      return { ...player, ships: updatedShips };
    });

    set({
      gameState: {
        ...gameState,
        players: updatedPlayers,
      },
    });

    return true;
  },

  undeployShip: (shipId) => {
    const { gameState } = get();
    if (!gameState) return;

    const updatedPlayers = gameState.players.map((player) => {
      const shipIndex = player.ships.findIndex((s) => s.id === shipId);
      if (shipIndex === -1) return player;

      const updatedShips = [...player.ships];
      updatedShips[shipIndex] = {
        ...updatedShips[shipIndex],
        isDeployed: false,
      };

      return { ...player, ships: updatedShips };
    });

    set({
      gameState: {
        ...gameState,
        players: updatedPlayers,
      },
    });
  },

  confirmDeployment: (playerId) => {
    // Mark player as ready for battle
    const { gameState, autoDeployRemaining } = get();
    if (!gameState) return;

    // Auto-deploy any remaining ships
    autoDeployRemaining(playerId);
  },

  autoDeployRemaining: (playerId) => {
    const { gameState } = get();
    if (!gameState) return;

    const player = gameState.players.find((p) => p.id === playerId);
    if (!player || player.deploymentZone === null) return;

    const zoneHexes = gameState.map.deploymentZones[player.deploymentZone];
    const occupiedHexes = new Set<string>();

    // Get all occupied hexes
    gameState.players.forEach((p) => {
      p.ships.forEach((s) => {
        if (s.isDeployed && !s.isDestroyed) {
          occupiedHexes.add(hexToKey(s.position));
        }
      });
    });

    const undeployedShips = player.ships.filter((s) => !s.isDeployed);

    undeployedShips.forEach((ship) => {
      // Find random available hex in zone
      const availableHexes = zoneHexes.filter(
        (h) => !occupiedHexes.has(hexToKey(h))
      );
      if (availableHexes.length === 0) return;

      const randomHex =
        availableHexes[Math.floor(Math.random() * availableHexes.length)];
      const randomFacing = Math.floor(Math.random() * 6) as HexDirection;

      occupiedHexes.add(hexToKey(randomHex));

      // Deploy with random facing
      const { deployShip } = get();
      deployShip(ship.id, randomHex, randomFacing);
    });
  },

  selectShip: (shipId) => {
    set({ selectedShipId: shipId });
  },

  addPendingMove: (shipId, targetHex) => {
    const { gameState, pendingActions, localPlayerId } = get();
    if (!gameState || !localPlayerId) return false;

    const player = gameState.players.find((p) => p.id === localPlayerId);
    if (!player) return false;

    const ship = player.ships.find((s) => s.id === shipId);
    if (!ship || ship.isDestroyed) return false;

    // Get current pending actions for this ship
    let pending = pendingActions.get(shipId) || {
      shipId,
      moves: [],
      totalAPCost: 0,
    };

    // Check if this ship already engaged an enemy (movement ends after combat)
    const hasEngaged = pending.moves.some((m) => {
      if (m.type !== 'move') return false;
      const moveTarget = m.to as HexCoord;
      // Check if any enemy was at this position
      return gameState.players.some((p) => {
        if (p.id === localPlayerId) return false;
        return p.ships.some(
          (s) => !s.isDestroyed && hexEqual(s.position, moveTarget)
        );
      });
    });
    if (hasEngaged) return false; // Can't move after engaging enemy

    // Calculate current position after pending moves
    let currentPos = ship.position;
    pending.moves.forEach((move) => {
      if (move.type === 'move') {
        currentPos = move.to as HexCoord;
      }
    });

    // Check if target is adjacent (no jumping over hexes)
    let isAdjacent = false;
    for (let dir = 0; dir < 6; dir++) {
      const neighbor = getNeighbor(currentPos, dir as HexDirection);
      if (hexEqual(neighbor, targetHex)) {
        isAdjacent = true;
        break;
      }
    }

    if (!isAdjacent) return false;

    // Build set of occupied positions (considering pending moves)
    const occupiedPositions = new Map<string, { playerId: string; shipId: string }>();

    // Add all current ship positions
    gameState.players.forEach((p) => {
      p.ships.forEach((s) => {
        if (!s.isDestroyed && s.id !== shipId) {
          occupiedPositions.set(hexToKey(s.position), {
            playerId: p.id,
            shipId: s.id,
          });
        }
      });
    });

    // Update with pending moves from other ships in this turn
    pendingActions.forEach((action, actionShipId) => {
      if (actionShipId === shipId) return;
      let pos = gameState.players
        .flatMap((p) => p.ships)
        .find((s) => s.id === actionShipId)?.position;
      if (!pos) return;

      // Remove from old position
      occupiedPositions.delete(hexToKey(pos));

      // Track through moves
      action.moves.forEach((m) => {
        if (m.type === 'move') {
          pos = m.to as HexCoord;
        }
      });

      // Add to new position
      if (pos) {
        const ownerPlayer = gameState.players.find((p) =>
          p.ships.some((s) => s.id === actionShipId)
        );
        if (ownerPlayer) {
          occupiedPositions.set(hexToKey(pos), {
            playerId: ownerPlayer.id,
            shipId: actionShipId,
          });
        }
      }
    });

    // Check what's at the target hex
    const targetOccupant = occupiedPositions.get(hexToKey(targetHex));

    // Can't move onto friendly unit
    if (targetOccupant && targetOccupant.playerId === localPlayerId) {
      return false;
    }

    // Calculate AP cost
    const apCost = 1;
    const totalAPUsed = pending.totalAPCost + apCost;

    // Check if player has enough AP
    if (totalAPUsed > player.remainingAP) return false;

    // Check if ship has enough AP
    const shipAPUsed = pending.moves.reduce((sum, m) => sum + m.apCost, 0);
    if (shipAPUsed + apCost > ship.currentAP) return false;

    // Add move
    const move: Move = {
      shipId,
      type: 'move',
      from: currentPos,
      to: targetHex,
      apCost,
    };

    pending = {
      ...pending,
      moves: [...pending.moves, move],
      totalAPCost: totalAPUsed,
    };

    const newPendingActions = new Map(pendingActions);
    newPendingActions.set(shipId, pending);

    set({ pendingActions: newPendingActions });
    return true;
  },

  addPendingTurn: (shipId, newFacing) => {
    const { gameState, pendingActions, localPlayerId } = get();
    if (!gameState || !localPlayerId) return false;

    const player = gameState.players.find((p) => p.id === localPlayerId);
    if (!player) return false;

    const ship = player.ships.find((s) => s.id === shipId);
    if (!ship || ship.isDestroyed) return false;

    let pending = pendingActions.get(shipId) || {
      shipId,
      moves: [],
      totalAPCost: 0,
    };

    // Get current facing after pending turns
    let currentFacing = ship.facing;
    pending.moves.forEach((move) => {
      if (move.type === 'turn') {
        currentFacing = move.to as HexDirection;
      }
    });

    if (currentFacing === newFacing) return false;

    // Calculate minimum turn cost
    const apCost = calculateTurnCost(currentFacing, newFacing);
    const totalAPUsed = pending.totalAPCost + apCost;

    if (totalAPUsed > player.remainingAP) return false;

    const shipAPUsed = pending.moves.reduce((sum, m) => sum + m.apCost, 0);
    if (shipAPUsed + apCost > ship.currentAP) return false;

    const move: Move = {
      shipId,
      type: 'turn',
      from: currentFacing,
      to: newFacing,
      apCost,
    };

    pending = {
      ...pending,
      moves: [...pending.moves, move],
      totalAPCost: totalAPUsed,
    };

    const newPendingActions = new Map(pendingActions);
    newPendingActions.set(shipId, pending);

    set({ pendingActions: newPendingActions });
    return true;
  },

  undoLastAction: (shipId) => {
    const { pendingActions } = get();
    const pending = pendingActions.get(shipId);
    if (!pending || pending.moves.length === 0) return;

    const lastMove = pending.moves[pending.moves.length - 1];
    const newMoves = pending.moves.slice(0, -1);
    const newTotalCost = pending.totalAPCost - lastMove.apCost;

    const newPendingActions = new Map(pendingActions);

    if (newMoves.length === 0) {
      newPendingActions.delete(shipId);
    } else {
      newPendingActions.set(shipId, {
        ...pending,
        moves: newMoves,
        totalAPCost: newTotalCost,
      });
    }

    set({ pendingActions: newPendingActions });
  },

  undoAllActions: () => {
    set({ pendingActions: new Map() });
  },

  confirmTurn: () => {
    const { gameState, pendingActions, localPlayerId, addAnimation } = get();
    if (!gameState || !localPlayerId) return;

    const player = gameState.players.find((p) => p.id === localPlayerId);
    if (!player) return;

    // Create turn record
    const allMoves: Move[] = [];
    pendingActions.forEach((pending) => {
      allMoves.push(...pending.moves);
    });

    const turn: Turn = {
      playerId: localPlayerId,
      turnNumber: gameState.turnNumber,
      moves: allMoves,
      timestamp: Date.now(),
    };

    // Apply moves and create animations
    let animationDelay = 0;
    const updatedPlayers = [...gameState.players];
    const playerIndex = updatedPlayers.findIndex((p) => p.id === localPlayerId);
    const updatedPlayer = { ...updatedPlayers[playerIndex] };
    const updatedShips = [...updatedPlayer.ships];
    const newDebris: DebrisField[] = [];

    pendingActions.forEach((pending) => {
      const shipIndex = updatedShips.findIndex((s) => s.id === pending.shipId);
      if (shipIndex === -1) return;

      let currentShip = { ...updatedShips[shipIndex] };

      pending.moves.forEach((move) => {
        if (move.type === 'move') {
          const fromPos = move.from as HexCoord;
          const toPos = move.to as HexCoord;

          // Add thruster animation
          addAnimation({
            type: 'thruster',
            shipId: pending.shipId,
            startTime: Date.now() + animationDelay,
            duration: 500,
            data: { from: fromPos, to: toPos },
          });

          // Check for collision (combat)
          let hitEnemy = false;
          updatedPlayers.forEach((enemyPlayer, enemyPlayerIndex) => {
            if (enemyPlayer.id === localPlayerId) return;

            enemyPlayer.ships.forEach((enemyShip, enemyShipIndex) => {
              if (
                !enemyShip.isDestroyed &&
                hexEqual(enemyShip.position, toPos)
              ) {
                hitEnemy = true;

                // Add shooting animation
                addAnimation({
                  type: 'shoot',
                  shipId: pending.shipId,
                  startTime: Date.now() + animationDelay + 200,
                  duration: 300,
                  data: { from: fromPos, to: toPos },
                });

                // Add explosion animation
                addAnimation({
                  type: 'explode',
                  shipId: enemyShip.id,
                  startTime: Date.now() + animationDelay + 400,
                  duration: 800,
                  data: { position: toPos },
                });

                // Destroy enemy ship
                const updatedEnemyPlayer = { ...updatedPlayers[enemyPlayerIndex] };
                const updatedEnemyShips = [...updatedEnemyPlayer.ships];
                updatedEnemyShips[enemyShipIndex] = {
                  ...enemyShip,
                  isDestroyed: true,
                };
                updatedEnemyPlayer.ships = updatedEnemyShips;
                updatedPlayers[enemyPlayerIndex] = updatedEnemyPlayer;

                // Create debris
                newDebris.push({
                  id: uuidv4(),
                  position: toPos,
                  createdTurn: gameState.turnNumber,
                });

                // Add debris spawn animation
                addAnimation({
                  type: 'debris_spawn',
                  startTime: Date.now() + animationDelay + 1000,
                  duration: 500,
                  data: { position: toPos },
                });

                // Check if mothership was destroyed (win condition)
                if (enemyShip.type === 'mothership') {
                  // Winner!
                }
              }
            });
          });

          // Add move animation
          addAnimation({
            type: 'move',
            shipId: pending.shipId,
            startTime: Date.now() + animationDelay,
            duration: 500,
            data: { from: fromPos, to: toPos },
          });

          // Update ship position
          currentShip.position = toPos;

          // Check if entering debris field
          const isInDebris = [...gameState.debris, ...newDebris].some((d) =>
            hexEqual(d.position, toPos)
          );
          if (isInDebris) {
            // AP reduced to 0 for this ship this turn
            currentShip.currentAP = 0;
          }

          animationDelay += 600;
        } else if (move.type === 'turn') {
          const fromFacing = move.from as HexDirection;
          const toFacing = move.to as HexDirection;

          addAnimation({
            type: 'turn',
            shipId: pending.shipId,
            startTime: Date.now() + animationDelay,
            duration: 300,
            data: { from: fromFacing, to: toFacing },
          });

          currentShip.facing = toFacing;
          animationDelay += 400;
        }
      });

      updatedShips[shipIndex] = currentShip;
    });

    // Update player's remaining AP
    const totalAPUsed = Array.from(pendingActions.values()).reduce(
      (sum, p) => sum + p.totalAPCost,
      0
    );
    updatedPlayer.remainingAP -= totalAPUsed;
    updatedPlayer.ships = updatedShips;
    updatedPlayers[playerIndex] = updatedPlayer;

    // Move to next player
    const nextPlayerIndex =
      (gameState.currentPlayerIndex + 1) % gameState.players.length;

    // Reset next player's AP
    const nextPlayer = { ...updatedPlayers[nextPlayerIndex] };
    nextPlayer.remainingAP = PLAYER_AP_PER_TURN;
    nextPlayer.ships = nextPlayer.ships.map((s) => ({
      ...s,
      currentAP: s.maxAP,
    }));
    updatedPlayers[nextPlayerIndex] = nextPlayer;

    // Check for win condition
    let winner: string | null = null;
    updatedPlayers.forEach((p) => {
      const mothership = p.ships.find((s) => s.type === 'mothership');
      if (mothership?.isDestroyed) {
        p.isEliminated = true;
      }
    });

    const activePlayers = updatedPlayers.filter((p) => !p.isEliminated);
    if (activePlayers.length === 1) {
      winner = activePlayers[0].id;
    }

    set({
      gameState: {
        ...gameState,
        players: updatedPlayers,
        currentPlayerIndex: nextPlayerIndex,
        turnNumber:
          nextPlayerIndex === 0
            ? gameState.turnNumber + 1
            : gameState.turnNumber,
        debris: [...gameState.debris, ...newDebris],
        turnHistory: [...gameState.turnHistory, turn],
        winner,
        phase: winner ? 'ended' : gameState.phase,
      },
      pendingActions: new Map(),
    });
  },

  addAnimation: (animation) => {
    const { animations } = get();
    const newAnimation: Animation = {
      ...animation,
      id: uuidv4(),
    };
    set({ animations: [...animations, newAnimation] });
  },

  removeAnimation: (id) => {
    const { animations } = get();
    set({ animations: animations.filter((a) => a.id !== id) });
  },

  clearAnimations: () => {
    set({ animations: [] });
  },

  nextPhase: () => {
    const { gameState } = get();
    if (!gameState) return;

    const phaseOrder: GamePhase[] = [
      'lobby',
      'dice_roll',
      'zone_selection',
      'deployment',
      'battle',
      'ended',
    ];

    const currentIndex = phaseOrder.indexOf(gameState.phase);
    const nextPhase = phaseOrder[currentIndex + 1] || 'ended';

    set({
      gameState: {
        ...gameState,
        phase: nextPhase,
      },
    });
  },

  endGame: (winnerId) => {
    const { gameState } = get();
    if (!gameState) return;

    set({
      gameState: {
        ...gameState,
        phase: 'ended',
        winner: winnerId,
      },
    });
  },

  setReplayMode: (enabled) => {
    set({ isReplayMode: enabled, replayTurnIndex: 0 });
  },

  goToTurn: (turnIndex) => {
    set({ replayTurnIndex: turnIndex });
  },

  updatePlayerTime: (playerId, timeRemaining) => {
    const { gameState } = get();
    if (!gameState) return;

    const updatedPlayers = gameState.players.map((p) =>
      p.id === playerId ? { ...p, timeRemaining } : p
    );

    // Check if time ran out
    const player = updatedPlayers.find((p) => p.id === playerId);
    if (player && player.timeRemaining <= 0) {
      player.isEliminated = true;
    }

    set({
      gameState: {
        ...gameState,
        players: updatedPlayers,
      },
    });
  },

  getLocalPlayer: () => {
    const { gameState, localPlayerId } = get();
    if (!gameState || !localPlayerId) return null;
    return gameState.players.find((p) => p.id === localPlayerId) || null;
  },

  getCurrentPlayer: () => {
    const { gameState } = get();
    if (!gameState) return null;
    return gameState.players[gameState.currentPlayerIndex] || null;
  },

  getShipById: (shipId) => {
    const { gameState } = get();
    if (!gameState) return null;

    for (const player of gameState.players) {
      const ship = player.ships.find((s) => s.id === shipId);
      if (ship) return ship;
    }
    return null;
  },

  isMyTurn: () => {
    const { gameState, localPlayerId } = get();
    if (!gameState || !localPlayerId) return false;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    return currentPlayer?.id === localPlayerId;
  },

  canAffordAP: (apCost) => {
    const { getLocalPlayer, pendingActions } = get();
    const player = getLocalPlayer();
    if (!player) return false;

    const currentlyUsed = Array.from(pendingActions.values()).reduce(
      (sum, p) => sum + p.totalAPCost,
      0
    );
    return player.remainingAP - currentlyUsed >= apCost;
  },
}));
