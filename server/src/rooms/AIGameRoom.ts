import { HexGameRoom } from './HexGameRoom';
import { Client } from '@colyseus/core';
import { HexarchAI } from '../ai/HexarchAI';

export class AIGameRoom extends HexGameRoom {
  private aiController: HexarchAI;
  private aiPlayerId: string = 'ai_player';
  private aiProcessing: boolean = false;
  private difficulty: 'easy' | 'medium' | 'hard' = 'medium';

  async onCreate(options: any) {
    console.log("AIGameRoom created with options:", options);
    
    // Store difficulty
    this.difficulty = options.difficulty || 'medium';
    
    // Call parent onCreate
    await super.onCreate(options);
    
    // Set deployment and turn times from options
    if (options.deploymentTime) {
      this.deploymentTimeLimit = options.deploymentTime;
    }
    if (options.turnTime) {
      this.turnTimeLimit = options.turnTime;
    }
  }

  async onJoin(client: Client, options?: any) {
    console.log("Human player joined AI game:", client.sessionId);
    
    // Join human player
    await super.onJoin(client, options);
    
    // Add AI player
    this.addAIPlayer();
  }

  private addAIPlayer() {
    // Create AI player
    const aiPlayer = this.state.players.get(this.aiPlayerId) || this.state.addPlayer(this.aiPlayerId);
    aiPlayer.name = "AI Commander";
    aiPlayer.isAI = true;
    aiPlayer.connected = true;
    
    // Don't pre-assign zones - let the dice roll determine that
    const humanPlayer = Array.from(this.state.players.values()).find(p => !p.isAI);
    if (humanPlayer) {
      // Initialize AI controller with correct colors
      // Human is player 1 (blue), AI is player 2 (red)
      const aiColor = 'red';
      const humanColor = 'blue';
      this.aiController = new HexarchAI(aiColor, humanColor, this.difficulty);
      console.log("AI controller initialized with colors - AI: red, Human: blue");
    }
    
    // Set player count
    this.playerCount = 2;
    
    // Auto-ready AI player
    aiPlayer.ready = true;
    // Call the parent's checkStartGame method
    this.checkStartGame();
  }

  protected async executeAITurn() {
    console.log(`executeAITurn called - gamePhase: ${this.state.gamePhase}, aiProcessing: ${this.aiProcessing}`);
    if (this.aiProcessing || this.state.gamePhase !== 'playing') {
      console.log(`AI turn skipped - aiProcessing: ${this.aiProcessing}, gamePhase: ${this.state.gamePhase}`);
      return;
    }
    
    this.aiProcessing = true;
    console.log("AI taking turn...");
    
    // Check if AI controller exists
    if (!this.aiController) {
      console.error("AI controller not initialized!");
      this.aiProcessing = false;
      return;
    }
    
    try {
      // Build game state for AI
      const gameState = {
        ships: this.state.ships.map(ship => ({
          id: ship.id,
          type: ship.type,
          color: ship.color,
          owner: ship.owner,
          position: { col: ship.col, row: ship.row },
          orientation: ship.orientation,
          currentAP: 3, // Default AP for ships
          maxAP: 3
        })),
        currentPlayer: this.aiPlayerId,
        boardHexes: [], // AI doesn't need hex details
        debrisFields: [], // No debris tracking yet
        meteors: []
      };
      
      // Get AI moves
      const aiMoves = this.aiController.makeMove(gameState);
      
      // Execute moves with delays for visibility
      for (const move of aiMoves) {
        await this.delay(1000);
        
        if (move.action === 'move' || move.action === 'combat') {
          // Find the ship
          const ship = this.state.ships.find(s => s.id === move.ship.id);
          if (ship && move.to) {
            // Check for combat
            const targetShip = this.state.ships.find(s => 
              s.col === move.to.col && s.row === move.to.row && s.owner !== this.aiPlayerId
            );
            
            if (targetShip) {
              // Combat move
              this.handleCombat(ship, targetShip);
            } else {
              // Regular move
              this.moveShip(ship.id, move.to.col, move.to.row);
            }
          }
        } else if (move.action === 'rotate') {
          const ship = this.state.ships.find(s => s.id === move.ship.id);
          if (ship) {
            // Calculate new orientation (simplified)
            const newOrientation = (ship.orientation + 1) % 6;
            this.rotateShip(ship.id, newOrientation);
          }
        }
      }
      
      // End AI turn
      await this.delay(1000);
      this.endCurrentTurn();
      
    } catch (error) {
      console.error("AI turn error:", error);
    } finally {
      this.aiProcessing = false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private handleCombat(attacker: Ship, target: Ship) {
    // Remove target ship from state
    const remainingShips = this.state.ships.filter(ship => ship.id !== target.id);
    this.state.ships.clear();
    remainingShips.forEach(ship => this.state.ships.push(ship));
    
    console.log(`AI Combat: ${attacker.id} destroyed ${target.id}`);
    
    // Broadcast combat result
    this.broadcast("shipDestroyed", {
      attackerId: attacker.id,
      targetId: target.id,
      position: { col: target.col, row: target.row }
    });
  }
  
  private moveShip(shipId: string, toCol: string, toRow: number) {
    const ship = this.state.ships.find(s => s.id === shipId);
    if (!ship) return;
    
    const fromCol = ship.col;
    const fromRow = ship.row;
    
    // Update ship position
    ship.col = toCol;
    ship.row = toRow;
    
    console.log(`AI moved ship ${shipId} from ${fromCol}${fromRow} to ${toCol}${toRow}`);
    
    // Broadcast ship movement
    this.broadcast("shipMoved", {
      shipId: shipId,
      from: { col: fromCol, row: fromRow },
      to: { col: toCol, row: toRow },
      owner: this.aiPlayerId
    });
  }
  
  private rotateShip(shipId: string, newOrientation: number) {
    const ship = this.state.ships.find(s => s.id === shipId);
    if (!ship) return;
    
    ship.orientation = newOrientation;
    console.log(`AI rotated ship ${shipId} to orientation ${newOrientation}`);
    
    // Broadcast rotation
    this.broadcast("shipRotated", {
      shipId: shipId,
      orientation: newOrientation,
      owner: this.aiPlayerId
    });
  }
  
  private endCurrentTurn() {
    console.log("AI ending turn");
    this.moveToNextTurn();
    
    // Broadcast turn change
    this.broadcast("turnChanged", {
      currentTurn: this.state.currentTurn,
      turnNumber: this.state.turnNumber
    });
  }

  // No need to override - base class handles AI deployment
}