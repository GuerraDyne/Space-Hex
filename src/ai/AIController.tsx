// AI Controller - Manages AI turns and integrates with the game board
import { HexarchAI } from './HexarchAI';

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

interface AIMove {
  shipId: string;
  action: 'move' | 'rotate' | 'combat' | 'endTurn';
  from?: { col: string; row: number };
  to?: { col: string; row: number };
  targetOrientation?: number;
  targetShipId?: string;
}

export class AIController {
  private ai: HexarchAI;
  private isProcessing: boolean = false;
  private moveDelay: number = 1000; // Delay between AI moves for visibility
  
  constructor(aiColor: string, enemyColor: string, difficulty: 'easy' | 'medium' | 'hard' = 'medium') {
    this.ai = new HexarchAI(aiColor, enemyColor, difficulty);
    
    // Adjust move delay based on difficulty
    this.moveDelay = difficulty === 'easy' ? 1500 : 
                     difficulty === 'medium' ? 1000 : 
                     difficulty === 'hard' ? 500 : 1000;
  }

  // Main function to execute AI turn
  public async executeAITurn(
    ships: Ship[],
    currentPlayer: string,
    onMove: (move: AIMove) => Promise<void>,
    boardHexes?: any[],
    debrisFields?: any[],
    meteors?: any[]
  ): Promise<void> {
    if (this.isProcessing) {
      console.log('AI: Already processing turn');
      return;
    }

    this.isProcessing = true;
    console.log('AI: Starting turn analysis...');

    try {
      // Build game state
      const gameState = {
        ships,
        currentPlayer,
        boardHexes: boardHexes || [],
        debrisFields: debrisFields || [],
        meteors: meteors || []
      };

      // Get AI moves
      const aiMoves = this.ai.makeMove(gameState);
      console.log(`AI: Generated ${aiMoves.length} moves`);

      // Execute moves sequentially with delays
      for (const move of aiMoves) {
        await this.delay(this.moveDelay);
        
        const aiMove: AIMove = {
          shipId: move.ship.id,
          action: move.action,
          from: move.from,
          to: move.to
        };

        if (move.action === 'combat' && move.targetShip) {
          aiMove.targetShipId = move.targetShip.id;
        }

        console.log('AI: Executing move:', aiMove);
        await onMove(aiMove);
      }

      // End turn
      await this.delay(this.moveDelay);
      const endTurnMove: AIMove = {
        shipId: '',
        action: 'endTurn'
      };
      console.log('AI: Ending turn');
      await onMove(endTurnMove);

    } catch (error) {
      console.error('AI: Error during turn execution:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Helper to add delay between moves
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Check if AI should take turn
  public shouldTakeTurn(currentPlayer: string, aiPlayer: string): boolean {
    return currentPlayer === aiPlayer && !this.isProcessing;
  }

  // Reset AI state
  public reset(): void {
    this.isProcessing = false;
  }
}