/**
 * AIOpponent - Intelligent AI system for single-player and practice modes
 * Implements different difficulty levels and playing styles
 */

import { 
  GameState, 
  Ship, 
  HexCoordinate, 
  PlayerId, 
  ShipType,
  GamePhase 
} from '../game/core/Types';
import { 
  AIOpponent as AIOpponentType,
  AIDifficulty, 
  AIPersonality 
} from '../multiplayer/types';
import { GameController } from '../game/core/GameController';
import { MovementSystem } from '../game/systems/MovementSystem';
import { CombatSystem } from '../game/systems/CombatSystem';
import { logger } from '../utils/Logger';

interface AIMove {
  type: 'move' | 'deploy' | 'mothership_move' | 'mothership_deploy' | 'end_turn';
  shipId?: string;
  targetHex?: HexCoordinate;
  priority: number;
  reasoning: string;
}

interface AIStrategy {
  name: string;
  evaluate: (gameState: GameState, playerId: PlayerId) => number;
  selectMove: (gameState: GameState, playerId: PlayerId, availableMoves: AIMove[]) => AIMove | null;
}

export class AIOpponent {
  private aiConfig: AIOpponentType;
  private gameController: GameController | null = null;
  private personality: AIPersonality;
  private strategies: AIStrategy[] = [];
  private moveHistory: AIMove[] = [];
  private thinkingTime: number = 1000; // Base thinking time in ms

  constructor(aiConfig: AIOpponentType) {
    this.aiConfig = aiConfig;
    this.personality = aiConfig.personality;
    this.setupStrategies();
    this.calculateThinkingTime();
  }

  /**
   * Initialize the AI with a game controller
   */
  initialize(gameController: GameController): void {
    this.gameController = gameController;
    logger.info('AI', 'AI opponent initialized', { 
      name: this.aiConfig.name,
      difficulty: this.aiConfig.difficulty 
    });
  }

  /**
   * Make the AI's turn
   */
  async takeTurn(gameState: GameState, playerId: PlayerId): Promise<void> {
    if (!this.gameController) {
      logger.error('AI', 'Cannot take turn - no game controller');
      return;
    }

    logger.info('AI', 'AI taking turn', { 
      playerId, 
      turn: gameState.turn,
      phase: gameState.phase 
    });

    // Simulate thinking time
    await this.think();

    try {
      switch (gameState.phase) {
        case GamePhase.DEPLOYMENT:
          await this.handleDeploymentPhase(gameState, playerId);
          break;
        case GamePhase.PLAYING:
          await this.handlePlayingPhase(gameState, playerId);
          break;
        default:
          logger.warn('AI', 'Unknown game phase', { phase: gameState.phase });
      }
    } catch (error) {
      logger.error('AI', 'Error during AI turn', error);
      // Fallback: end turn
      this.gameController.endTurn();
    }
  }

  /**
   * Handle deployment phase decisions
   */
  private async handleDeploymentPhase(gameState: GameState, playerId: PlayerId): Promise<void> {
    if (!this.gameController) return;

    const player = gameState.players.get(playerId);
    if (!player) return;

    // First, deploy mothership if not deployed
    if (!player.mothership) {
      const deploymentZone = this.getDeploymentZone(gameState, playerId);
      const mothershipPosition = this.selectMothershipPosition(deploymentZone);
      
      if (mothershipPosition) {
        logger.info('AI', 'AI deploying mothership', { position: mothershipPosition });
        this.gameController.deployMothership(playerId, mothershipPosition);
        return;
      }
    }

    // Deploy remaining ships
    const undeployedShips = this.getUndeployedShips(gameState, playerId);
    if (undeployedShips.length > 0) {
      const ship = undeployedShips[0];
      const deploymentZone = this.getDeploymentZone(gameState, playerId);
      const position = this.selectShipDeploymentPosition(gameState, ship, deploymentZone);
      
      if (position) {
        logger.info('AI', 'AI deploying ship', { shipId: ship.id, position });
        this.gameController.deployShip(playerId, ship.id, position);
        return;
      }
    }

    // All ships deployed, end turn
    this.gameController.endTurn();
  }

  /**
   * Handle playing phase decisions
   */
  private async handlePlayingPhase(gameState: GameState, playerId: PlayerId): Promise<void> {
    if (!this.gameController) return;

    // Evaluate all possible moves
    const availableMoves = this.getAllAvailableMoves(gameState, playerId);
    
    if (availableMoves.length === 0) {
      logger.info('AI', 'No moves available, ending turn');
      this.gameController.endTurn();
      return;
    }

    // Select best move based on current strategy
    const selectedMove = this.selectBestMove(gameState, playerId, availableMoves);
    
    if (selectedMove) {
      await this.executeMove(selectedMove, playerId);
    } else {
      logger.info('AI', 'No suitable move found, ending turn');
      this.gameController.endTurn();
    }
  }

  /**
   * Execute the selected AI move
   */
  private async executeMove(move: AIMove, playerId: PlayerId): Promise<void> {
    if (!this.gameController) return;

    logger.info('AI', 'AI executing move', { 
      type: move.type, 
      reasoning: move.reasoning 
    });

    switch (move.type) {
      case 'move':
        if (move.shipId && move.targetHex) {
          this.gameController.moveShip(playerId, move.shipId, move.targetHex);
        }
        break;
      case 'mothership_move':
        if (move.targetHex) {
          this.gameController.moveMothership(playerId, move.targetHex);
        }
        break;
      case 'end_turn':
        this.gameController.endTurn();
        break;
    }

    this.moveHistory.push(move);
  }

  /**
   * Get all available moves for the AI player
   */
  private getAllAvailableMoves(gameState: GameState, playerId: PlayerId): AIMove[] {
    const moves: AIMove[] = [];
    const player = gameState.players.get(playerId);
    if (!player) return moves;

    // Ship moves
    for (const ship of player.ships.values()) {
      if (this.canMoveShip(gameState, playerId, ship)) {
        const availablePositions = this.getAvailableMovesForShip(gameState, ship);
        
        for (const position of availablePositions) {
          const priority = this.evaluateMove(gameState, ship, position);
          moves.push({
            type: 'move',
            shipId: ship.id,
            targetHex: position,
            priority,
            reasoning: `Move ${ship.type} to strategic position`
          });
        }
      }
    }

    // Mothership moves
    if (player.mothership && this.canMoveMothership(gameState, playerId)) {
      const mothershipMoves = this.getAvailableMothershipMoves(gameState, player.mothership);
      
      for (const position of mothershipMoves) {
        const priority = this.evaluateMothershipMove(gameState, player.mothership, position);
        moves.push({
          type: 'mothership_move',
          targetHex: position,
          priority,
          reasoning: 'Advance mothership strategically'
        });
      }
    }

    // Always include end turn option
    moves.push({
      type: 'end_turn',
      priority: this.evaluateEndTurn(gameState, playerId),
      reasoning: 'End turn to advance game'
    });

    return moves;
  }

  /**
   * Select the best move based on AI strategies and personality
   */
  private selectBestMove(gameState: GameState, playerId: PlayerId, availableMoves: AIMove[]): AIMove | null {
    if (availableMoves.length === 0) return null;

    // Apply strategy evaluation
    const evaluatedMoves = availableMoves.map(move => ({
      ...move,
      strategyScore: this.evaluateWithStrategies(gameState, playerId, move)
    }));

    // Apply personality modifiers
    const personalizedMoves = evaluatedMoves.map(move => ({
      ...move,
      finalScore: this.applyPersonality(move, move.strategyScore)
    }));

    // Add some randomness based on difficulty
    const randomizedMoves = personalizedMoves.map(move => ({
      ...move,
      finalScore: move.finalScore + this.getRandomVariation()
    }));

    // Sort by final score
    randomizedMoves.sort((a, b) => b.finalScore - a.finalScore);

    const selectedMove = randomizedMoves[0];
    logger.debug('AI', 'Move selected', { 
      type: selectedMove.type,
      score: selectedMove.finalScore,
      reasoning: selectedMove.reasoning 
    });

    return selectedMove;
  }

  /**
   * Setup AI strategies based on difficulty and personality
   */
  private setupStrategies(): void {
    // Aggressive strategy - prioritize attacks
    this.strategies.push({
      name: 'aggressive',
      evaluate: (gameState, playerId) => {
        return this.personality.aggressiveness * this.evaluateAttackOpportunities(gameState, playerId);
      },
      selectMove: (gameState, playerId, moves) => {
        const attackMoves = moves.filter(m => this.isAttackMove(gameState, m));
        return attackMoves.length > 0 ? attackMoves[0] : null;
      }
    });

    // Defensive strategy - protect key positions
    this.strategies.push({
      name: 'defensive',
      evaluate: (gameState, playerId) => {
        return (1 - this.personality.aggressiveness) * this.evaluateDefensivePositions(gameState, playerId);
      },
      selectMove: (gameState, playerId, moves) => {
        const defensiveMoves = moves.filter(m => this.isDefensiveMove(gameState, m));
        return defensiveMoves.length > 0 ? defensiveMoves[0] : null;
      }
    });

    // Territorial strategy - control space
    this.strategies.push({
      name: 'territorial',
      evaluate: (gameState, playerId) => {
        return this.evaluateTerritorialControl(gameState, playerId);
      },
      selectMove: (gameState, playerId, moves) => {
        const territorialMoves = moves.filter(m => this.expandsTerritory(gameState, m));
        return territorialMoves.length > 0 ? territorialMoves[0] : null;
      }
    });
  }

  /**
   * Calculate thinking time based on difficulty
   */
  private calculateThinkingTime(): void {
    const baseTime = 1000;
    const difficultyMultipliers = {
      [AIDifficulty.BEGINNER]: 0.5,
      [AIDifficulty.INTERMEDIATE]: 1.0,
      [AIDifficulty.ADVANCED]: 1.5,
      [AIDifficulty.EXPERT]: 2.0,
      [AIDifficulty.MASTER]: 2.5
    };

    this.thinkingTime = baseTime * difficultyMultipliers[this.aiConfig.difficulty];
  }

  /**
   * Simulate AI thinking time
   */
  private async think(): Promise<void> {
    const actualThinkingTime = this.thinkingTime + (Math.random() * 1000);
    await new Promise(resolve => setTimeout(resolve, actualThinkingTime));
  }

  // Helper methods (simplified implementations)

  private getDeploymentZone(gameState: GameState, playerId: PlayerId): HexCoordinate[] {
    // Return deployment zone for the player
    return []; // Placeholder
  }

  private selectMothershipPosition(deploymentZone: HexCoordinate[]): HexCoordinate | null {
    // Select best mothership position
    return deploymentZone.length > 0 ? deploymentZone[0] : null;
  }

  private selectShipDeploymentPosition(gameState: GameState, ship: Ship, deploymentZone: HexCoordinate[]): HexCoordinate | null {
    // Select best deployment position for ship
    return deploymentZone.length > 0 ? deploymentZone[Math.floor(Math.random() * deploymentZone.length)] : null;
  }

  private getUndeployedShips(gameState: GameState, playerId: PlayerId): Ship[] {
    const player = gameState.players.get(playerId);
    if (!player) return [];

    return Array.from(player.ships.values()).filter(ship => !ship.position);
  }

  private canMoveShip(gameState: GameState, playerId: PlayerId, ship: Ship): boolean {
    // Check if ship can move this turn
    return true; // Placeholder
  }

  private canMoveMothership(gameState: GameState, playerId: PlayerId): boolean {
    // Check if mothership can move this turn
    return true; // Placeholder
  }

  private getAvailableMovesForShip(gameState: GameState, ship: Ship): HexCoordinate[] {
    // Get all valid moves for the ship
    return []; // Placeholder
  }

  private getAvailableMothershipMoves(gameState: GameState, mothership: any): HexCoordinate[] {
    // Get all valid mothership moves
    return []; // Placeholder
  }

  private evaluateMove(gameState: GameState, ship: Ship, targetHex: HexCoordinate): number {
    // Evaluate move quality
    return Math.random() * 100; // Placeholder
  }

  private evaluateMothershipMove(gameState: GameState, mothership: any, targetHex: HexCoordinate): number {
    // Evaluate mothership move quality
    return Math.random() * 100; // Placeholder
  }

  private evaluateEndTurn(gameState: GameState, playerId: PlayerId): number {
    // Evaluate whether to end turn
    return 10; // Low priority
  }

  private evaluateWithStrategies(gameState: GameState, playerId: PlayerId, move: AIMove): number {
    let totalScore = move.priority;
    
    for (const strategy of this.strategies) {
      const strategyScore = strategy.evaluate(gameState, playerId);
      totalScore += strategyScore;
    }
    
    return totalScore;
  }

  private applyPersonality(move: AIMove, baseScore: number): number {
    let score = baseScore;
    
    // Apply personality modifiers
    if (this.isAttackMove({} as GameState, move)) {
      score *= (1 + this.personality.aggressiveness);
    }
    
    if (this.isRiskyMove(move)) {
      score *= (1 + this.personality.riskTaking);
    }
    
    return score;
  }

  private getRandomVariation(): number {
    const difficultyVariations = {
      [AIDifficulty.BEGINNER]: 20,
      [AIDifficulty.INTERMEDIATE]: 15,
      [AIDifficulty.ADVANCED]: 10,
      [AIDifficulty.EXPERT]: 5,
      [AIDifficulty.MASTER]: 2
    };

    const variation = difficultyVariations[this.aiConfig.difficulty];
    return (Math.random() - 0.5) * variation;
  }

  // Evaluation helper methods

  private evaluateAttackOpportunities(gameState: GameState, playerId: PlayerId): number {
    // Evaluate attack opportunities
    return Math.random() * 50; // Placeholder
  }

  private evaluateDefensivePositions(gameState: GameState, playerId: PlayerId): number {
    // Evaluate defensive positioning
    return Math.random() * 50; // Placeholder
  }

  private evaluateTerritorialControl(gameState: GameState, playerId: PlayerId): number {
    // Evaluate territorial control
    return Math.random() * 50; // Placeholder
  }

  private isAttackMove(gameState: GameState, move: AIMove): boolean {
    // Determine if move is aggressive
    return move.type === 'move' && Math.random() > 0.5; // Placeholder
  }

  private isDefensiveMove(gameState: GameState, move: AIMove): boolean {
    // Determine if move is defensive
    return move.type === 'move' && Math.random() > 0.5; // Placeholder
  }

  private isRiskyMove(move: AIMove): boolean {
    // Determine if move is risky
    return Math.random() > 0.7; // Placeholder
  }

  private expandsTerritory(gameState: GameState, move: AIMove): boolean {
    // Determine if move expands territorial control
    return move.type === 'move' && Math.random() > 0.6; // Placeholder
  }
}

/**
 * AI Opponent Factory - Creates pre-configured AI opponents
 */
export class AIOpponentFactory {
  private static prebuiltOpponents: AIOpponentType[] = [
    {
      aiId: 'cadet',
      name: 'Cadet Nova',
      difficulty: AIDifficulty.BEGINNER,
      personality: {
        aggressiveness: 0.3,
        riskTaking: 0.2,
        adaptability: 0.4,
        favoriteShips: [ShipType.SCOUT, ShipType.CORVETTE],
        favoriteStrategies: ['defensive', 'territorial']
      },
      avatar: 'cadet_avatar',
      description: 'A careful and methodical beginner AI',
      winRate: 0.15,
      specialties: ['Defense', 'Learning']
    },
    {
      aiId: 'lieutenant',
      name: 'Lieutenant Astro',
      difficulty: AIDifficulty.INTERMEDIATE,
      personality: {
        aggressiveness: 0.5,
        riskTaking: 0.4,
        adaptability: 0.6,
        favoriteShips: [ShipType.DESTROYER, ShipType.INTERCEPTOR],
        favoriteStrategies: ['balanced', 'opportunistic']
      },
      avatar: 'lieutenant_avatar',
      description: 'A balanced AI with moderate aggression',
      winRate: 0.45,
      specialties: ['Balanced Play', 'Adaptability']
    },
    {
      aiId: 'commander',
      name: 'Commander Vega',
      difficulty: AIDifficulty.ADVANCED,
      personality: {
        aggressiveness: 0.7,
        riskTaking: 0.6,
        adaptability: 0.8,
        favoriteShips: [ShipType.CAPTAIN, ShipType.ARTILLERY],
        favoriteStrategies: ['aggressive', 'tactical']
      },
      avatar: 'commander_avatar',
      description: 'An aggressive AI that favors bold strategies',
      winRate: 0.70,
      specialties: ['Aggressive Tactics', 'Strategic Depth']
    },
    {
      aiId: 'admiral',
      name: 'Admiral Nexus',
      difficulty: AIDifficulty.EXPERT,
      personality: {
        aggressiveness: 0.6,
        riskTaking: 0.8,
        adaptability: 0.9,
        favoriteShips: [ShipType.FLEET_ADMIRAL, ShipType.DESTROYER],
        favoriteStrategies: ['strategic', 'adaptive', 'territorial']
      },
      avatar: 'admiral_avatar',
      description: 'A highly strategic AI with deep game understanding',
      winRate: 0.85,
      specialties: ['Strategic Mastery', 'Advanced Tactics']
    },
    {
      aiId: 'grandmaster',
      name: 'Grandmaster Cosmos',
      difficulty: AIDifficulty.MASTER,
      personality: {
        aggressiveness: 0.8,
        riskTaking: 0.9,
        adaptability: 1.0,
        favoriteShips: [ShipType.FLEET_ADMIRAL, ShipType.CAPTAIN, ShipType.ARTILLERY],
        favoriteStrategies: ['masterful', 'adaptive', 'psychological']
      },
      avatar: 'grandmaster_avatar',
      description: 'The ultimate AI opponent with perfect game understanding',
      winRate: 0.95,
      specialties: ['Perfect Play', 'Psychological Warfare', 'Endgame Mastery']
    }
  ];

  static getAllOpponents(): AIOpponentType[] {
    return [...this.prebuiltOpponents];
  }

  static getOpponentById(aiId: string): AIOpponentType | null {
    return this.prebuiltOpponents.find(ai => ai.aiId === aiId) || null;
  }

  static getOpponentsByDifficulty(difficulty: AIDifficulty): AIOpponentType[] {
    return this.prebuiltOpponents.filter(ai => ai.difficulty === difficulty);
  }

  static createAIOpponent(config: AIOpponentType): AIOpponent {
    return new AIOpponent(config);
  }

  static createRandomOpponent(difficulty: AIDifficulty): AIOpponent {
    const opponents = this.getOpponentsByDifficulty(difficulty);
    if (opponents.length === 0) {
      throw new Error(`No AI opponents available for difficulty: ${difficulty}`);
    }
    
    const randomOpponent = opponents[Math.floor(Math.random() * opponents.length)];
    return new AIOpponent(randomOpponent);
  }
}