// HexarchAI - Intelligent AI opponent for Space Hex game
// This AI understands:
// 1. Action Point (AP) system for movement and rotation
// 2. Goal is to kill the enemy command unit (mothership)
// 3. Trading pieces strategically based on AP values
// 4. Protecting own command unit
// 5. Using combined arms tactics

interface Ship {
  id: string;
  type: string;
  color: string;
  owner: string;
  position: { col: string; row: number };
  orientation: number;
  currentAP?: number;
  maxAP?: number;
}

interface HexCoordinate {
  col: string;
  row: number;
}

interface Move {
  ship: Ship;
  from: HexCoordinate;
  to: HexCoordinate;
  action: 'move' | 'rotate' | 'combat';
  priority: number;
  apCost: number;
  targetShip?: Ship;
}

interface GameState {
  ships: Ship[];
  currentPlayer: string;
  boardHexes: HexCoordinate[];
  debrisFields: HexCoordinate[];
  meteors?: HexCoordinate[];
}

export class HexarchAI {
  private readonly SHIP_VALUES: { [key: string]: number } = {
    'mothership': 1000,  // Command unit - infinite value
    'battleship': 8,      // High AP, strong piece
    'cruiser': 6,
    'destroyer': 5,
    'corvette': 4,
    'interceptor': 3,
    'scout': 2,
    'frigate': 2
  };

  private readonly SHIP_AP: { [key: string]: number } = {
    'mothership': 3,
    'battleship': 3,
    'cruiser': 4,
    'destroyer': 5,
    'corvette': 6,
    'interceptor': 7,
    'scout': 8,
    'frigate': 8
  };

  private readonly COMBAT_STRENGTH: { [key: string]: number } = {
    'mothership': 0,  // Can't attack
    'battleship': 4,
    'cruiser': 3,
    'destroyer': 2,
    'corvette': 1,
    'interceptor': 0,
    'scout': -1,
    'frigate': -1
  };

  private aiColor: string;
  private enemyColor: string;
  private difficultyLevel: 'easy' | 'medium' | 'hard';

  constructor(aiColor: string, enemyColor: string, difficulty: 'easy' | 'medium' | 'hard' = 'medium') {
    this.aiColor = aiColor;
    this.enemyColor = enemyColor;
    this.difficultyLevel = difficulty;
  }

  // Main AI decision function
  public makeMove(gameState: GameState): Move[] {
    const myShips = gameState.ships.filter(s => s.color === this.aiColor);
    const enemyShips = gameState.ships.filter(s => s.color === this.enemyColor);
    
    // Find command units
    const myMothership = myShips.find(s => s.type === 'mothership');
    const enemyMothership = enemyShips.find(s => s.type === 'mothership');
    
    if (!myMothership) {
      console.error('AI: No mothership found!');
      return [];
    }

    // Evaluate board state
    const boardEvaluation = this.evaluateBoardState(myShips, enemyShips, gameState);
    
    // Generate all possible moves
    const possibleMoves = this.generateAllMoves(myShips, enemyShips, gameState);
    
    // Score and sort moves
    const scoredMoves = possibleMoves.map(move => ({
      ...move,
      score: this.scoreMove(move, myShips, enemyShips, myMothership, enemyMothership, gameState)
    }));
    
    scoredMoves.sort((a, b) => b.score - a.score);
    
    // Select best moves within AP budget
    return this.selectBestMoves(scoredMoves, myShips);
  }

  // Evaluate overall board position
  private evaluateBoardState(myShips: Ship[], enemyShips: Ship[], gameState: GameState): number {
    let evaluation = 0;
    
    // Material advantage
    const myMaterial = myShips.reduce((sum, ship) => sum + this.SHIP_VALUES[ship.type], 0);
    const enemyMaterial = enemyShips.reduce((sum, ship) => sum + this.SHIP_VALUES[ship.type], 0);
    evaluation += (myMaterial - enemyMaterial) * 10;
    
    // Mothership safety
    const myMothership = myShips.find(s => s.type === 'mothership');
    const enemyMothership = enemyShips.find(s => s.type === 'mothership');
    
    if (myMothership && enemyMothership) {
      // Check threats to our mothership
      const threatsToMyMothership = this.getThreatsToShip(myMothership, enemyShips);
      evaluation -= threatsToMyMothership.length * 50;
      
      // Check threats to enemy mothership
      const threatsToEnemyMothership = this.getThreatsToShip(enemyMothership, myShips);
      evaluation += threatsToEnemyMothership.length * 100;
      
      // Distance to enemy mothership (closer is better for attacking)
      const avgDistanceToEnemyMothership = myShips.reduce((sum, ship) => {
        return sum + this.getDistance(ship.position, enemyMothership.position);
      }, 0) / myShips.length;
      evaluation -= avgDistanceToEnemyMothership;
    }
    
    return evaluation;
  }

  // Generate all possible moves for AI ships
  private generateAllMoves(myShips: Ship[], enemyShips: Ship[], gameState: GameState): Move[] {
    const moves: Move[] = [];
    
    for (const ship of myShips) {
      const currentAP = ship.currentAP ?? this.SHIP_AP[ship.type];
      
      // Skip ships with no AP
      if (currentAP <= 0) continue;
      
      // Get all reachable hexes
      const reachableHexes = this.getReachableHexes(ship, currentAP, gameState);
      
      for (const hex of reachableHexes) {
        const enemyAtHex = enemyShips.find(e => 
          e.position.col === hex.col && e.position.row === hex.row
        );
        
        if (enemyAtHex) {
          // Combat move
          moves.push({
            ship,
            from: ship.position,
            to: hex,
            action: 'combat',
            priority: 0,
            apCost: this.getMoveCost(ship.position, hex),
            targetShip: enemyAtHex
          });
        } else {
          // Regular move
          moves.push({
            ship,
            from: ship.position,
            to: hex,
            action: 'move',
            priority: 0,
            apCost: this.getMoveCost(ship.position, hex)
          });
        }
      }
      
      // Add rotation moves (if ship has AP for it)
      if (currentAP >= 1) {
        for (let orientation = 0; orientation < 6; orientation++) {
          if (orientation !== ship.orientation) {
            moves.push({
              ship,
              from: ship.position,
              to: ship.position,
              action: 'rotate',
              priority: 0,
              apCost: 1
            });
          }
        }
      }
    }
    
    return moves;
  }

  // Score a move based on strategic value
  private scoreMove(
    move: Move, 
    myShips: Ship[], 
    enemyShips: Ship[], 
    myMothership: Ship,
    enemyMothership: Ship | undefined,
    gameState: GameState
  ): number {
    let score = 0;
    
    // Combat moves
    if (move.action === 'combat' && move.targetShip) {
      // Attacking the mothership is highest priority
      if (move.targetShip.type === 'mothership') {
        score += 10000;
      } else {
        // Value of target
        const targetValue = this.SHIP_VALUES[move.targetShip.type];
        const myValue = this.SHIP_VALUES[move.ship.type];
        
        // Good trade if we're taking a more valuable piece
        if (targetValue > myValue) {
          score += (targetValue - myValue) * 100;
        } else if (targetValue === myValue) {
          score += 50; // Neutral trade
        } else {
          // Bad trade, but might be worth it for position
          score += (targetValue - myValue) * 10;
        }
        
        // Consider combat strength
        const combatAdvantage = this.COMBAT_STRENGTH[move.ship.type] - 
                               this.COMBAT_STRENGTH[move.targetShip.type];
        score += combatAdvantage * 50;
      }
    }
    
    // Movement moves
    if (move.action === 'move') {
      const newPosition = move.to;
      
      // Moving towards enemy mothership is good
      if (enemyMothership) {
        const currentDist = this.getDistance(move.from, enemyMothership.position);
        const newDist = this.getDistance(newPosition, enemyMothership.position);
        score += (currentDist - newDist) * 20;
        
        // Bonus for getting within striking range
        if (newDist === 1 && move.ship.type !== 'mothership') {
          score += 200;
        }
      }
      
      // Protecting our mothership
      const threatsToMothership = this.getThreatsToShip(myMothership, enemyShips);
      if (threatsToMothership.length > 0) {
        const newDistToMothership = this.getDistance(newPosition, myMothership.position);
        if (newDistToMothership <= 2) {
          score += 100; // Defend the mothership
        }
      }
      
      // Control center of board
      const centerCol = 'f';
      const centerRow = 6;
      const distToCenter = this.getDistance(newPosition, { col: centerCol, row: centerRow });
      score += (6 - distToCenter) * 5;
    }
    
    // Rotation moves (lower priority)
    if (move.action === 'rotate') {
      // Only rotate if it helps us face threats or targets
      const facingEnemies = this.getShipsInDirection(move.ship, enemyShips, move.ship.orientation);
      score += facingEnemies.length * 10;
    }
    
    // Penalize moves that use too much AP early
    score -= move.apCost * 2;
    
    // Add some randomness based on difficulty
    if (this.difficultyLevel === 'easy') {
      score += Math.random() * 50 - 25;
    } else if (this.difficultyLevel === 'medium') {
      score += Math.random() * 20 - 10;
    }
    
    return score;
  }

  // Select best moves within AP constraints
  private selectBestMoves(scoredMoves: any[], myShips: Ship[]): Move[] {
    const selectedMoves: Move[] = [];
    const shipAPUsed: Map<string, number> = new Map();
    
    // Initialize AP tracking
    myShips.forEach(ship => {
      shipAPUsed.set(ship.id, 0);
    });
    
    for (const move of scoredMoves) {
      const usedAP = shipAPUsed.get(move.ship.id) || 0;
      const availableAP = (move.ship.currentAP ?? this.SHIP_AP[move.ship.type]) - usedAP;
      
      if (move.apCost <= availableAP) {
        selectedMoves.push(move);
        shipAPUsed.set(move.ship.id, usedAP + move.apCost);
        
        // Update ship position for subsequent moves
        if (move.action === 'move' || move.action === 'combat') {
          move.ship.position = move.to;
        }
        
        // Stop if we've made enough moves (based on difficulty)
        const maxMoves = this.difficultyLevel === 'easy' ? 3 : 
                        this.difficultyLevel === 'medium' ? 5 : 10;
        if (selectedMoves.length >= maxMoves) break;
      }
    }
    
    return selectedMoves;
  }

  // Helper: Get hexes reachable with given AP
  private getReachableHexes(ship: Ship, ap: number, gameState: GameState): HexCoordinate[] {
    const reachable: HexCoordinate[] = [];
    const visited = new Set<string>();
    const queue: { hex: HexCoordinate, cost: number }[] = [
      { hex: ship.position, cost: 0 }
    ];
    
    while (queue.length > 0) {
      const { hex, cost } = queue.shift()!;
      const key = `${hex.col}${hex.row}`;
      
      if (visited.has(key)) continue;
      visited.add(key);
      
      if (cost > 0) {
        reachable.push(hex);
      }
      
      if (cost < ap) {
        // Add neighbors
        const neighbors = this.getNeighbors(hex);
        for (const neighbor of neighbors) {
          const neighborKey = `${neighbor.col}${neighbor.row}`;
          if (!visited.has(neighborKey)) {
            const moveCost = this.getMoveCost(hex, neighbor);
            if (cost + moveCost <= ap) {
              queue.push({ hex: neighbor, cost: cost + moveCost });
            }
          }
        }
      }
    }
    
    return reachable;
  }

  // Helper: Get neighboring hexes
  private getNeighbors(hex: HexCoordinate): HexCoordinate[] {
    const neighbors: HexCoordinate[] = [];
    const col = hex.col.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = hex.row;
    
    // Six directions in hex grid
    const directions = [
      { dcol: 1, drow: 0 },   // E
      { dcol: 1, drow: -1 },  // NE
      { dcol: 0, drow: -1 },  // NW
      { dcol: -1, drow: 0 },  // W
      { dcol: -1, drow: 1 },  // SW
      { dcol: 0, drow: 1 }    // SE
    ];
    
    for (const dir of directions) {
      const newCol = col + dir.dcol;
      const newRow = row + dir.drow;
      
      if (newCol >= 0 && newCol <= 10 && newRow >= 1 && newRow <= 11) {
        neighbors.push({
          col: String.fromCharCode('a'.charCodeAt(0) + newCol),
          row: newRow
        });
      }
    }
    
    return neighbors;
  }

  // Helper: Calculate distance between hexes
  private getDistance(from: HexCoordinate, to: HexCoordinate): number {
    const fromCol = from.col.charCodeAt(0) - 'a'.charCodeAt(0);
    const toCol = to.col.charCodeAt(0) - 'a'.charCodeAt(0);
    const fromRow = from.row;
    const toRow = to.row;
    
    // Convert to cube coordinates
    const fromX = fromCol;
    const fromZ = fromRow - (fromCol - (fromCol & 1)) / 2;
    const fromY = -fromX - fromZ;
    
    const toX = toCol;
    const toZ = toRow - (toCol - (toCol & 1)) / 2;
    const toY = -toX - toZ;
    
    // Manhattan distance in cube coordinates
    return (Math.abs(fromX - toX) + Math.abs(fromY - toY) + Math.abs(fromZ - toZ)) / 2;
  }

  // Helper: Get move cost (considering orientation)
  private getMoveCost(from: HexCoordinate, to: HexCoordinate): number {
    // Base cost is distance
    return this.getDistance(from, to);
  }

  // Helper: Find threats to a ship
  private getThreatsToShip(ship: Ship, enemyShips: Ship[]): Ship[] {
    const threats: Ship[] = [];
    
    for (const enemy of enemyShips) {
      const distance = this.getDistance(ship.position, enemy.position);
      const enemyAP = enemy.currentAP ?? this.SHIP_AP[enemy.type];
      
      // Can the enemy reach us?
      if (distance <= enemyAP && enemy.type !== 'mothership') {
        threats.push(enemy);
      }
    }
    
    return threats;
  }

  // Helper: Get ships in a given direction
  private getShipsInDirection(ship: Ship, targets: Ship[], direction: number): Ship[] {
    const inDirection: Ship[] = [];
    
    // This would need proper hex direction calculation
    // Simplified for now
    for (const target of targets) {
      const distance = this.getDistance(ship.position, target.position);
      if (distance <= 3) {
        inDirection.push(target);
      }
    }
    
    return inDirection;
  }
}