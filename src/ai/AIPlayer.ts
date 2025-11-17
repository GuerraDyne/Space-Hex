import {
  GameState,
  Player,
  Ship,
  HexCoord,
  HexDirection,
  Move,
  SHIP_STATS,
} from '@/types/game';
import {
  hexDistance,
  getNeighbors,
  hexEqual,
  hexToKey,
  calculateTurnCost,
  getNeighbor,
} from '@/engine/hexGrid';

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

interface AIEvaluation {
  shipId: string;
  moves: Move[];
  score: number;
}

export class AIPlayer {
  private difficulty: AIDifficulty;
  private playerId: string;

  constructor(playerId: string, difficulty: AIDifficulty = 'medium') {
    this.playerId = playerId;
    this.difficulty = difficulty;
  }

  // Main AI decision making
  calculateTurn(gameState: GameState): Move[] {
    const player = gameState.players.find((p) => p.id === this.playerId);
    if (!player) return [];

    const evaluations: AIEvaluation[] = [];

    // Evaluate possible actions for each ship
    player.ships.forEach((ship) => {
      if (ship.isDestroyed || !ship.isDeployed) return;

      const shipEvals = this.evaluateShipMoves(gameState, player, ship);
      evaluations.push(...shipEvals);
    });

    // Sort by score and select best moves within AP budget
    evaluations.sort((a, b) => b.score - a.score);

    const selectedMoves: Move[] = [];
    let remainingAP = player.remainingAP;
    const usedShips = new Set<string>();

    for (const evaluation of evaluations) {
      if (usedShips.has(evaluation.shipId)) continue;

      const totalCost = evaluation.moves.reduce((sum, m) => sum + m.apCost, 0);
      if (totalCost <= remainingAP) {
        selectedMoves.push(...evaluation.moves);
        remainingAP -= totalCost;
        usedShips.add(evaluation.shipId);

        // Stop if we've used enough AP based on difficulty
        if (this.shouldStopEarly(remainingAP, player.remainingAP)) {
          break;
        }
      }
    }

    return selectedMoves;
  }

  private shouldStopEarly(remainingAP: number, totalAP: number): boolean {
    switch (this.difficulty) {
      case 'easy':
        return remainingAP <= totalAP * 0.7; // Use only 30% of AP
      case 'medium':
        return remainingAP <= totalAP * 0.4; // Use 60% of AP
      case 'hard':
        return remainingAP <= totalAP * 0.1; // Use 90% of AP
      case 'expert':
        return remainingAP <= 0; // Use all AP
      default:
        return false;
    }
  }

  private evaluateShipMoves(
    gameState: GameState,
    player: Player,
    ship: Ship
  ): AIEvaluation[] {
    const evaluations: AIEvaluation[] = [];

    // Strategy 1: Attack enemy ships (prioritize high-value targets)
    const attackEvals = this.evaluateAttacks(gameState, player, ship);
    evaluations.push(...attackEvals);

    // Strategy 2: Move towards enemy mothership
    const approachEvals = this.evaluateApproach(gameState, player, ship);
    evaluations.push(...approachEvals);

    // Strategy 3: Protect own mothership
    const defenseEvals = this.evaluateDefense(gameState, player, ship);
    evaluations.push(...defenseEvals);

    // Strategy 4: Avoid danger (retreat low-value ships)
    if (this.difficulty !== 'easy') {
      const safetyEvals = this.evaluateSafety(gameState, player, ship);
      evaluations.push(...safetyEvals);
    }

    return evaluations;
  }

  private evaluateAttacks(
    gameState: GameState,
    player: Player,
    ship: Ship
  ): AIEvaluation[] {
    const evaluations: AIEvaluation[] = [];
    const enemies = this.getEnemyShips(gameState, player.id);

    enemies.forEach((enemy) => {
      const distance = hexDistance(ship.position, enemy.position);

      // Can we reach and destroy this enemy?
      if (distance <= ship.currentAP) {
        const path = this.findPathToAdjacent(gameState, ship.position, enemy.position);
        if (path && path.length <= ship.currentAP) {
          const moves = this.createMovesToPath(ship.id, ship.position, path);

          // Calculate score based on target value
          let score = this.getShipValue(enemy.type) * 100;

          // Bonus for attacking mothership
          if (enemy.type === 'mothership') {
            score += 10000;
          }

          // Bonus for using low-value ship to destroy high-value
          if (ship.maxAP < enemy.maxAP) {
            score += 50;
          }

          // Penalty for putting high-value ship at risk
          score -= this.getShipValue(ship.type) * 20;

          // Difficulty adjustment
          score *= this.getDifficultyMultiplier();

          evaluations.push({
            shipId: ship.id,
            moves,
            score,
          });
        }
      }
    });

    return evaluations;
  }

  private evaluateApproach(
    gameState: GameState,
    player: Player,
    ship: Ship
  ): AIEvaluation[] {
    const evaluations: AIEvaluation[] = [];
    const enemyMothership = this.getEnemyMothership(gameState, player.id);

    if (!enemyMothership) return evaluations;

    const currentDist = hexDistance(ship.position, enemyMothership.position);
    const neighbors = getNeighbors(ship.position);

    neighbors.forEach((neighbor) => {
      if (!this.isValidHex(gameState, neighbor)) return;
      if (this.isOccupied(gameState, neighbor, player.id)) return;

      const newDist = hexDistance(neighbor, enemyMothership.position);
      if (newDist < currentDist) {
        const moves: Move[] = [
          {
            shipId: ship.id,
            type: 'move',
            from: ship.position,
            to: neighbor,
            apCost: 1,
          },
        ];

        let score = (currentDist - newDist) * 30;
        score += this.getShipValue(ship.type) * 5; // Prefer moving valuable ships forward

        // Add turn if needed to face enemy
        const facingToEnemy = this.getDirectionTowards(neighbor, enemyMothership.position);
        if (facingToEnemy !== ship.facing) {
          const turnCost = calculateTurnCost(ship.facing, facingToEnemy);
          if (turnCost <= ship.currentAP - 1) {
            moves.push({
              shipId: ship.id,
              type: 'turn',
              from: ship.facing,
              to: facingToEnemy,
              apCost: turnCost,
            });
          }
        }

        score *= this.getDifficultyMultiplier() * 0.5;
        evaluations.push({ shipId: ship.id, moves, score });
      }
    });

    return evaluations;
  }

  private evaluateDefense(
    gameState: GameState,
    player: Player,
    ship: Ship
  ): AIEvaluation[] {
    const evaluations: AIEvaluation[] = [];
    const myMothership = player.ships.find((s) => s.type === 'mothership');

    if (!myMothership || ship.type === 'mothership') return evaluations;

    // Check if mothership is threatened
    const enemies = this.getEnemyShips(gameState, player.id);
    const threats = enemies.filter((enemy) => {
      const dist = hexDistance(enemy.position, myMothership.position);
      return dist <= enemy.currentAP + 2;
    });

    if (threats.length === 0) return evaluations;

    // Move to intercept threats
    threats.forEach((threat) => {
      const pathToThreat = this.findPathToAdjacent(gameState, ship.position, threat.position);
      if (pathToThreat && pathToThreat.length <= ship.currentAP) {
        const moves = this.createMovesToPath(ship.id, ship.position, pathToThreat);

        let score = 200; // Base defense priority
        score += (myMothership.maxAP - hexDistance(threat.position, myMothership.position)) * 50;
        score *= this.getDifficultyMultiplier();

        evaluations.push({ shipId: ship.id, moves, score });
      }
    });

    return evaluations;
  }

  private evaluateSafety(
    gameState: GameState,
    player: Player,
    ship: Ship
  ): AIEvaluation[] {
    const evaluations: AIEvaluation[] = [];

    // Check if this ship is in danger
    const enemies = this.getEnemyShips(gameState, player.id);
    const inDanger = enemies.some((enemy) => {
      const dist = hexDistance(enemy.position, ship.position);
      return dist <= enemy.currentAP;
    });

    if (!inDanger) return evaluations;

    // Find safer position
    const neighbors = getNeighbors(ship.position);
    neighbors.forEach((neighbor) => {
      if (!this.isValidHex(gameState, neighbor)) return;
      if (this.isOccupied(gameState, neighbor, player.id)) return;

      const isSafer = enemies.every((enemy) => {
        const currentDist = hexDistance(enemy.position, ship.position);
        const newDist = hexDistance(enemy.position, neighbor);
        return newDist >= currentDist;
      });

      if (isSafer) {
        const moves: Move[] = [
          {
            shipId: ship.id,
            type: 'move',
            from: ship.position,
            to: neighbor,
            apCost: 1,
          },
        ];

        let score = 80;
        score -= this.getShipValue(ship.type) * 10; // Prioritize saving valuable ships
        score *= this.getDifficultyMultiplier() * 0.3;

        evaluations.push({ shipId: ship.id, moves, score });
      }
    });

    return evaluations;
  }

  // Deployment AI
  calculateDeployment(
    gameState: GameState,
    zoneHexes: HexCoord[]
  ): { position: HexCoord; facing: HexDirection }[] {
    const player = gameState.players.find((p) => p.id === this.playerId);
    if (!player) return [];

    const placements: { position: HexCoord; facing: HexDirection }[] = [];
    const usedHexes = new Set<string>();

    // Get enemy direction
    const enemyPlayer = gameState.players.find((p) => p.id !== this.playerId);
    let enemyDirection: HexCoord = { q: 0, r: 0 };
    if (enemyPlayer && enemyPlayer.deploymentZone !== null) {
      const enemyZone = gameState.map.deploymentZones[enemyPlayer.deploymentZone];
      if (enemyZone.length > 0) {
        enemyDirection = enemyZone[Math.floor(enemyZone.length / 2)];
      }
    }

    // Sort ships by importance (mothership first, then by value)
    const sortedShips = [...player.ships]
      .filter((s) => !s.isDeployed)
      .sort((a, b) => {
        if (a.type === 'mothership') return -1;
        if (b.type === 'mothership') return 1;
        return this.getShipValue(b.type) - this.getShipValue(a.type);
      });

    sortedShips.forEach((ship) => {
      const availableHexes = zoneHexes.filter((h) => !usedHexes.has(hexToKey(h)));
      if (availableHexes.length === 0) return;

      let bestHex = availableHexes[0];
      let bestScore = -Infinity;

      availableHexes.forEach((hex) => {
        let score = 0;

        if (ship.type === 'mothership') {
          // Mothership should be protected, away from enemy
          const distToEnemy = hexDistance(hex, enemyDirection);
          score += distToEnemy * 10;

          // Prefer center of zone
          const distToZoneCenter = hexDistance(hex, zoneHexes[Math.floor(zoneHexes.length / 2)]);
          score -= distToZoneCenter * 5;
        } else {
          // Combat ships should be forward
          const distToEnemy = hexDistance(hex, enemyDirection);
          score -= distToEnemy * 5; // Closer is better

          // But not too exposed
          score += Math.min(distToEnemy, 5) * 2;
        }

        if (score > bestScore) {
          bestScore = score;
          bestHex = hex;
        }
      });

      const facing = this.getDirectionTowards(bestHex, enemyDirection);
      placements.push({ position: bestHex, facing });
      usedHexes.add(hexToKey(bestHex));
    });

    return placements;
  }

  // Helper functions
  private getEnemyShips(gameState: GameState, myPlayerId: string): Ship[] {
    const enemies: Ship[] = [];
    gameState.players.forEach((p) => {
      if (p.id !== myPlayerId) {
        enemies.push(...p.ships.filter((s) => !s.isDestroyed && s.isDeployed));
      }
    });
    return enemies;
  }

  private getEnemyMothership(gameState: GameState, myPlayerId: string): Ship | null {
    for (const player of gameState.players) {
      if (player.id === myPlayerId) continue;
      const mothership = player.ships.find(
        (s) => s.type === 'mothership' && !s.isDestroyed
      );
      if (mothership) return mothership;
    }
    return null;
  }

  private getShipValue(type: string): number {
    const values: Record<string, number> = {
      mothership: 1000,
      battleship: 50,
      artillery: 45,
      cruiser: 40,
      destroyer: 35,
      frigate: 30,
      corvette: 25,
      interceptor: 20,
      scout: 15,
    };
    return values[type] || 10;
  }

  private getDifficultyMultiplier(): number {
    switch (this.difficulty) {
      case 'easy':
        return 0.5 + Math.random() * 0.5; // Random factor
      case 'medium':
        return 0.8 + Math.random() * 0.2;
      case 'hard':
        return 1.0;
      case 'expert':
        return 1.2;
      default:
        return 1.0;
    }
  }

  private isValidHex(gameState: GameState, hex: HexCoord): boolean {
    return gameState.map.hexes.some((h) => h.q === hex.q && h.r === hex.r);
  }

  private isOccupied(gameState: GameState, hex: HexCoord, exceptPlayerId: string): boolean {
    return gameState.players.some((p) => {
      if (p.id === exceptPlayerId) {
        // Check friendly ships (can't move there)
        return p.ships.some(
          (s) => !s.isDestroyed && s.isDeployed && hexEqual(s.position, hex)
        );
      }
      return false;
    });
  }

  private getDirectionTowards(from: HexCoord, to: HexCoord): HexDirection {
    const dx = to.q - from.q;
    const dy = to.r - from.r;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Convert angle to hex direction (0-5)
    const normalized = ((angle + 360) % 360);
    return Math.round(normalized / 60) % 6 as HexDirection;
  }

  private findPathToAdjacent(
    gameState: GameState,
    from: HexCoord,
    target: HexCoord
  ): HexCoord[] | null {
    // Simple BFS to find path to adjacent hex of target
    const queue: { hex: HexCoord; path: HexCoord[] }[] = [{ hex: from, path: [] }];
    const visited = new Set<string>();
    visited.add(hexToKey(from));

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Check if we're adjacent to target
      if (hexDistance(current.hex, target) === 1) {
        return [...current.path, target];
      }

      // Don't go too far
      if (current.path.length >= 10) continue;

      const neighbors = getNeighbors(current.hex);
      for (const neighbor of neighbors) {
        const key = hexToKey(neighbor);
        if (visited.has(key)) continue;
        if (!this.isValidHex(gameState, neighbor)) continue;

        // Can move through empty hexes
        const isBlocked = gameState.players.some((p) =>
          p.ships.some(
            (s) =>
              !s.isDestroyed &&
              s.isDeployed &&
              hexEqual(s.position, neighbor) &&
              !hexEqual(neighbor, target)
          )
        );
        if (isBlocked) continue;

        visited.add(key);
        queue.push({
          hex: neighbor,
          path: [...current.path, neighbor],
        });
      }
    }

    return null;
  }

  private createMovesToPath(shipId: string, start: HexCoord, path: HexCoord[]): Move[] {
    const moves: Move[] = [];
    let current = start;

    path.forEach((next) => {
      moves.push({
        shipId,
        type: 'move',
        from: current,
        to: next,
        apCost: 1,
      });
      current = next;
    });

    return moves;
  }
}
