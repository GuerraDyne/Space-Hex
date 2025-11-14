// Server-side HexarchAI implementation
// Simplified version for server use

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
    'mothership': 1000,
    'battleship': 8,
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

  private aiColor: string;
  private enemyColor: string;
  private difficultyLevel: 'easy' | 'medium' | 'hard';

  constructor(aiColor: string, enemyColor: string, difficulty: 'easy' | 'medium' | 'hard' = 'medium') {
    this.aiColor = aiColor;
    this.enemyColor = enemyColor;
    this.difficultyLevel = difficulty;
  }

  public makeMove(gameState: GameState): Move[] {
    const myShips = gameState.ships.filter(s => s.color === this.aiColor);
    const enemyShips = gameState.ships.filter(s => s.color === this.enemyColor);
    
    const myMothership = myShips.find(s => s.type === 'mothership');
    const enemyMothership = enemyShips.find(s => s.type === 'mothership');
    
    if (!myMothership) {
      console.error('AI: No mothership found!');
      return [];
    }

    const possibleMoves = this.generateAllMoves(myShips, enemyShips, gameState);
    
    const scoredMoves = possibleMoves.map(move => ({
      ...move,
      score: this.scoreMove(move, myShips, enemyShips, myMothership, enemyMothership, gameState)
    }));
    
    scoredMoves.sort((a, b) => b.score - a.score);
    
    return this.selectBestMoves(scoredMoves, myShips);
  }

  private generateAllMoves(myShips: Ship[], enemyShips: Ship[], gameState: GameState): Move[] {
    const moves: Move[] = [];
    
    for (const ship of myShips) {
      const currentAP = ship.currentAP ?? this.SHIP_AP[ship.type];
      
      if (currentAP <= 0) continue;
      
      const reachableHexes = this.getReachableHexes(ship, currentAP, gameState);
      
      for (const hex of reachableHexes) {
        const enemyAtHex = enemyShips.find(e => 
          e.position.col === hex.col && e.position.row === hex.row
        );
        
        if (enemyAtHex) {
          moves.push({
            ship,
            from: ship.position,
            to: hex,
            action: 'combat',
            priority: 0,
            apCost: this.getDistance(ship.position, hex),
            targetShip: enemyAtHex
          });
        } else {
          moves.push({
            ship,
            from: ship.position,
            to: hex,
            action: 'move',
            priority: 0,
            apCost: this.getDistance(ship.position, hex)
          });
        }
      }
    }
    
    return moves;
  }

  private scoreMove(
    move: Move, 
    myShips: Ship[], 
    enemyShips: Ship[], 
    myMothership: Ship,
    enemyMothership: Ship | undefined,
    gameState: GameState
  ): number {
    let score = 0;
    
    if (move.action === 'combat' && move.targetShip) {
      if (move.targetShip.type === 'mothership') {
        score += 10000;
      } else {
        const targetValue = this.SHIP_VALUES[move.targetShip.type];
        const myValue = this.SHIP_VALUES[move.ship.type];
        
        if (targetValue > myValue) {
          score += (targetValue - myValue) * 100;
        } else if (targetValue === myValue) {
          score += 50;
        } else {
          score += (targetValue - myValue) * 10;
        }
      }
    }
    
    if (move.action === 'move') {
      if (enemyMothership) {
        const currentDist = this.getDistance(move.from, enemyMothership.position);
        const newDist = this.getDistance(move.to, enemyMothership.position);
        score += (currentDist - newDist) * 20;
        
        if (newDist === 1 && move.ship.type !== 'mothership') {
          score += 200;
        }
      }
      
      const threatsToMothership = this.getThreatsToShip(myMothership, enemyShips);
      if (threatsToMothership.length > 0) {
        const newDistToMothership = this.getDistance(move.to, myMothership.position);
        if (newDistToMothership <= 2) {
          score += 100;
        }
      }
    }
    
    score -= move.apCost * 2;
    
    if (this.difficultyLevel === 'easy') {
      score += Math.random() * 50 - 25;
    } else if (this.difficultyLevel === 'medium') {
      score += Math.random() * 20 - 10;
    }
    
    return score;
  }

  private selectBestMoves(scoredMoves: any[], myShips: Ship[]): Move[] {
    const selectedMoves: Move[] = [];
    const shipAPUsed: Map<string, number> = new Map();
    
    myShips.forEach(ship => {
      shipAPUsed.set(ship.id, 0);
    });
    
    for (const move of scoredMoves) {
      const usedAP = shipAPUsed.get(move.ship.id) || 0;
      const availableAP = (move.ship.currentAP ?? this.SHIP_AP[move.ship.type]) - usedAP;
      
      if (move.apCost <= availableAP) {
        selectedMoves.push(move);
        shipAPUsed.set(move.ship.id, usedAP + move.apCost);
        
        if (move.action === 'move' || move.action === 'combat') {
          move.ship.position = move.to;
        }
        
        const maxMoves = this.difficultyLevel === 'easy' ? 3 : 
                        this.difficultyLevel === 'medium' ? 5 : 10;
        if (selectedMoves.length >= maxMoves) break;
      }
    }
    
    return selectedMoves;
  }

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
        const neighbors = this.getNeighbors(hex);
        for (const neighbor of neighbors) {
          const neighborKey = `${neighbor.col}${neighbor.row}`;
          if (!visited.has(neighborKey)) {
            const moveCost = 1;
            if (cost + moveCost <= ap) {
              queue.push({ hex: neighbor, cost: cost + moveCost });
            }
          }
        }
      }
    }
    
    return reachable;
  }

  private getNeighbors(hex: HexCoordinate): HexCoordinate[] {
    const neighbors: HexCoordinate[] = [];
    const col = hex.col.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = hex.row;
    
    const directions = [
      { dcol: 1, drow: 0 },
      { dcol: 1, drow: -1 },
      { dcol: 0, drow: -1 },
      { dcol: -1, drow: 0 },
      { dcol: -1, drow: 1 },
      { dcol: 0, drow: 1 }
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

  private getDistance(from: HexCoordinate, to: HexCoordinate): number {
    const fromCol = from.col.charCodeAt(0) - 'a'.charCodeAt(0);
    const toCol = to.col.charCodeAt(0) - 'a'.charCodeAt(0);
    const fromRow = from.row;
    const toRow = to.row;
    
    const fromX = fromCol;
    const fromZ = fromRow - (fromCol - (fromCol & 1)) / 2;
    const fromY = -fromX - fromZ;
    
    const toX = toCol;
    const toZ = toRow - (toCol - (toCol & 1)) / 2;
    const toY = -toX - toZ;
    
    return (Math.abs(fromX - toX) + Math.abs(fromY - toY) + Math.abs(fromZ - toZ)) / 2;
  }

  private getThreatsToShip(ship: Ship, enemyShips: Ship[]): Ship[] {
    const threats: Ship[] = [];
    
    for (const enemy of enemyShips) {
      const distance = this.getDistance(ship.position, enemy.position);
      const enemyAP = enemy.currentAP ?? this.SHIP_AP[enemy.type];
      
      if (distance <= enemyAP && enemy.type !== 'mothership') {
        threats.push(enemy);
      }
    }
    
    return threats;
  }
}