/**
 * CampaignManager - Manages single-player campaigns and scenarios
 * Provides structured progression and learning experiences
 */

import {
  Campaign,
  CampaignScenario,
  CampaignProgress,
  CampaignStatistics,
  CampaignReward,
  ScenarioObjective,
  ScenarioConstraint,
  AIDifficulty
} from '../multiplayer/types';
import { AIOpponentFactory } from '../ai/AIOpponent';
import { GameState, PlayerId, ShipType } from '../game/core/Types';
import { logger } from '../utils/Logger';

export class CampaignManager {
  private campaigns: Map<string, Campaign> = new Map();
  private playerProgress: CampaignProgress = {
    completedScenarios: new Set(),
    totalStars: 0,
    statistics: {
      gamesPlayed: 0,
      gamesWon: 0,
      totalPlayTime: 0,
      averageGameLength: 0,
      favoriteShipType: ShipType.SCOUT,
      bestWinStreak: 0
    }
  };
  private currentScenario: CampaignScenario | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor() {
    this.initializeCampaigns();
    this.loadPlayerProgress();
  }

  /**
   * Get all available campaigns
   */
  getAllCampaigns(): Campaign[] {
    return Array.from(this.campaigns.values());
  }

  /**
   * Get campaign by ID
   */
  getCampaign(campaignId: string): Campaign | null {
    return this.campaigns.get(campaignId) || null;
  }

  /**
   * Get unlocked campaigns for the player
   */
  getUnlockedCampaigns(): Campaign[] {
    return Array.from(this.campaigns.values()).filter(campaign => 
      this.isCampaignUnlocked(campaign)
    );
  }

  /**
   * Get current scenario
   */
  getCurrentScenario(): CampaignScenario | null {
    return this.currentScenario;
  }

  /**
   * Start a campaign scenario
   */
  async startScenario(campaignId: string, scenarioId: string): Promise<boolean> {
    try {
      const campaign = this.campaigns.get(campaignId);
      if (!campaign) {
        logger.error('CAMPAIGN', 'Campaign not found', { campaignId });
        return false;
      }

      const scenario = campaign.scenarios.find(s => s.scenarioId === scenarioId);
      if (!scenario) {
        logger.error('CAMPAIGN', 'Scenario not found', { campaignId, scenarioId });
        return false;
      }

      if (!this.isScenarioUnlocked(campaign, scenario)) {
        logger.error('CAMPAIGN', 'Scenario is locked', { campaignId, scenarioId });
        return false;
      }

      this.currentScenario = scenario;
      this.playerProgress.currentScenario = scenarioId;

      logger.info('CAMPAIGN', 'Starting scenario', { 
        campaignId, 
        scenarioId, 
        name: scenario.name 
      });

      this.emit('scenario-started', { campaign, scenario });
      return true;
    } catch (error) {
      logger.error('CAMPAIGN', 'Error starting scenario', error);
      return false;
    }
  }

  /**
   * Complete a scenario with results
   */
  async completeScenario(
    scenarioId: string, 
    won: boolean, 
    gameStats: any
  ): Promise<CampaignReward[]> {
    try {
      if (!this.currentScenario || this.currentScenario.scenarioId !== scenarioId) {
        logger.error('CAMPAIGN', 'No matching current scenario', { scenarioId });
        return [];
      }

      const scenario = this.currentScenario;
      const rewards: CampaignReward[] = [];

      // Update statistics
      this.updateStatistics(won, gameStats);

      // Mark scenario as completed
      this.playerProgress.completedScenarios.add(scenarioId);

      // Calculate rewards
      if (won) {
        rewards.push(...scenario.rewards);
        
        // Bonus rewards for objectives
        const completedObjectives = this.evaluateObjectives(scenario, gameStats);
        for (const objective of completedObjectives) {
          rewards.push({
            type: 'experience',
            amount: 100,
            description: `Completed objective: ${objective.description}`
          });
        }

        // Calculate stars (1-3 based on performance)
        const stars = this.calculateStars(scenario, gameStats);
        this.playerProgress.totalStars += stars;

        rewards.push({
          type: 'experience',
          amount: stars * 50,
          description: `${stars} star${stars > 1 ? 's' : ''} earned`
        });
      }

      // Apply rewards
      this.applyRewards(rewards);

      // Check for newly unlocked content
      this.checkUnlocks();

      this.currentScenario = null;
      this.playerProgress.currentScenario = undefined;

      logger.info('CAMPAIGN', 'Scenario completed', { 
        scenarioId, 
        won, 
        rewardsCount: rewards.length 
      });

      this.emit('scenario-completed', { 
        scenario, 
        won, 
        rewards,
        stats: gameStats 
      });

      this.savePlayerProgress();
      return rewards;
    } catch (error) {
      logger.error('CAMPAIGN', 'Error completing scenario', error);
      return [];
    }
  }

  /**
   * Get player's campaign progress
   */
  getPlayerProgress(): CampaignProgress {
    return { ...this.playerProgress };
  }

  /**
   * Get progress for specific campaign
   */
  getCampaignProgress(campaignId: string): any {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return null;

    const completedScenarios = campaign.scenarios.filter(scenario =>
      this.playerProgress.completedScenarios.has(scenario.scenarioId)
    );

    const totalStars = completedScenarios.reduce((sum, scenario) => {
      // Calculate stars for each completed scenario
      return sum + 1; // Placeholder - would calculate actual stars
    }, 0);

    return {
      campaignId,
      completedScenarios: completedScenarios.length,
      totalScenarios: campaign.scenarios.length,
      starsEarned: totalStars,
      maxStars: campaign.scenarios.length * 3,
      isCompleted: completedScenarios.length === campaign.scenarios.length
    };
  }

  /**
   * Reset campaign progress (for testing/replay)
   */
  resetCampaignProgress(campaignId: string): void {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return;

    // Remove completed scenarios for this campaign
    campaign.scenarios.forEach(scenario => {
      this.playerProgress.completedScenarios.delete(scenario.scenarioId);
    });

    this.savePlayerProgress();
    logger.info('CAMPAIGN', 'Campaign progress reset', { campaignId });
    this.emit('progress-reset', { campaignId });
  }

  /**
   * Get recommended next scenario
   */
  getRecommendedScenario(): { campaign: Campaign; scenario: CampaignScenario } | null {
    const unlockedCampaigns = this.getUnlockedCampaigns();
    
    for (const campaign of unlockedCampaigns) {
      const nextScenario = campaign.scenarios.find(scenario => 
        this.isScenarioUnlocked(campaign, scenario) && 
        !this.playerProgress.completedScenarios.has(scenario.scenarioId)
      );
      
      if (nextScenario) {
        return { campaign, scenario: nextScenario };
      }
    }

    return null;
  }

  /**
   * Add event listener
   */
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  // Private methods

  private initializeCampaigns(): void {
    // Tutorial Campaign
    const tutorialCampaign: Campaign = {
      campaignId: 'tutorial',
      name: 'Space Fleet Academy',
      description: 'Learn the basics of space fleet command',
      scenarios: this.createTutorialScenarios(),
      prerequisites: [],
      rewards: [
        {
          type: 'unlock',
          itemId: 'basic_campaign',
          description: 'Unlocks Basic Tactics campaign'
        }
      ],
      isUnlocked: true,
      progress: {
        completedScenarios: new Set(),
        totalStars: 0,
        statistics: {
          gamesPlayed: 0,
          gamesWon: 0,
          totalPlayTime: 0,
          averageGameLength: 0,
          favoriteShipType: ShipType.SCOUT,
          bestWinStreak: 0
        }
      }
    };

    // Basic Tactics Campaign
    const basicCampaign: Campaign = {
      campaignId: 'basic_tactics',
      name: 'Basic Fleet Tactics',
      description: 'Master fundamental fleet maneuvers and strategies',
      scenarios: this.createBasicTacticsScenarios(),
      prerequisites: ['tutorial'],
      rewards: [
        {
          type: 'unlock',
          itemId: 'advanced_campaign',
          description: 'Unlocks Advanced Warfare campaign'
        }
      ],
      isUnlocked: false,
      progress: {
        completedScenarios: new Set(),
        totalStars: 0,
        statistics: {
          gamesPlayed: 0,
          gamesWon: 0,
          totalPlayTime: 0,
          averageGameLength: 0,
          favoriteShipType: ShipType.SCOUT,
          bestWinStreak: 0
        }
      }
    };

    // Advanced Warfare Campaign
    const advancedCampaign: Campaign = {
      campaignId: 'advanced_warfare',
      name: 'Advanced Fleet Warfare',
      description: 'Face elite opponents with complex strategies',
      scenarios: this.createAdvancedWarfareScenarios(),
      prerequisites: ['basic_tactics'],
      rewards: [
        {
          type: 'achievement',
          itemId: 'campaign_master',
          description: 'Campaign Master achievement'
        }
      ],
      isUnlocked: false,
      progress: {
        completedScenarios: new Set(),
        totalStars: 0,
        statistics: {
          gamesPlayed: 0,
          gamesWon: 0,
          totalPlayTime: 0,
          averageGameLength: 0,
          favoriteShipType: ShipType.SCOUT,
          bestWinStreak: 0
        }
      }
    };

    this.campaigns.set('tutorial', tutorialCampaign);
    this.campaigns.set('basic_tactics', basicCampaign);
    this.campaigns.set('advanced_warfare', advancedCampaign);
  }

  private createTutorialScenarios(): CampaignScenario[] {
    return [
      {
        scenarioId: 'tutorial_01',
        name: 'First Command',
        description: 'Learn basic ship movement and deployment',
        difficulty: AIDifficulty.BEGINNER,
        objectives: [
          {
            id: 'move_ship',
            type: 'custom',
            description: 'Move any ship 3 hexes',
            required: true
          },
          {
            id: 'deploy_mothership',
            type: 'custom',
            description: 'Deploy your mothership',
            required: true
          }
        ],
        constraints: [
          {
            type: 'fleet_size',
            description: 'Only 3 ships available',
            parameters: { maxShips: 3 }
          }
        ],
        customSetup: {
          boardSize: 10,
          limitedFleet: [ShipType.SCOUT, ShipType.CORVETTE, ShipType.CORVETTE]
        },
        aiOpponent: AIOpponentFactory.getOpponentById('cadet')!,
        rewards: [
          {
            type: 'experience',
            amount: 100,
            description: 'First lesson completed'
          }
        ]
      },
      {
        scenarioId: 'tutorial_02',
        name: 'Combat Basics',
        description: 'Learn ship combat and destruction',
        difficulty: AIDifficulty.BEGINNER,
        objectives: [
          {
            id: 'destroy_enemy',
            type: 'elimination',
            description: 'Destroy an enemy ship',
            required: true
          }
        ],
        constraints: [],
        customSetup: {
          boardSize: 12,
          startingPositions: 'close'
        },
        aiOpponent: AIOpponentFactory.getOpponentById('cadet')!,
        rewards: [
          {
            type: 'experience',
            amount: 150,
            description: 'Combat training completed'
          }
        ]
      },
      {
        scenarioId: 'tutorial_03',
        name: 'Mothership Mastery',
        description: 'Learn mothership mechanics and victory conditions',
        difficulty: AIDifficulty.BEGINNER,
        objectives: [
          {
            id: 'capture_cockpit',
            type: 'capture',
            description: 'Capture enemy mothership cockpit',
            required: true
          }
        ],
        constraints: [],
        customSetup: {
          focusOnMotherships: true
        },
        aiOpponent: AIOpponentFactory.getOpponentById('cadet')!,
        rewards: [
          {
            type: 'experience',
            amount: 200,
            description: 'Mothership tactics mastered'
          }
        ]
      }
    ];
  }

  private createBasicTacticsScenarios(): CampaignScenario[] {
    return [
      {
        scenarioId: 'basic_01',
        name: 'Flanking Maneuvers',
        description: 'Master the art of flanking attacks',
        difficulty: AIDifficulty.INTERMEDIATE,
        objectives: [
          {
            id: 'flank_attack',
            type: 'custom',
            description: 'Attack from two different sides',
            required: true
          },
          {
            id: 'win_battle',
            type: 'victory',
            description: 'Achieve victory',
            required: true
          }
        ],
        constraints: [],
        customSetup: {
          enemyFormation: 'defensive_line'
        },
        aiOpponent: AIOpponentFactory.getOpponentById('lieutenant')!,
        rewards: [
          {
            type: 'experience',
            amount: 250,
            description: 'Flanking tactics learned'
          }
        ]
      },
      {
        scenarioId: 'basic_02',
        name: 'Artillery Support',
        description: 'Use artillery ships effectively',
        difficulty: AIDifficulty.INTERMEDIATE,
        objectives: [
          {
            id: 'artillery_kills',
            type: 'custom',
            description: 'Destroy 2 ships with artillery',
            target: 2,
            required: true
          }
        ],
        constraints: [
          {
            type: 'ship_types',
            description: 'Must include 2 artillery ships',
            parameters: { requiredShips: [ShipType.ARTILLERY, ShipType.ARTILLERY] }
          }
        ],
        customSetup: {
          terrainType: 'artillery_favorable'
        },
        aiOpponent: AIOpponentFactory.getOpponentById('lieutenant')!,
        rewards: [
          {
            type: 'experience',
            amount: 300,
            description: 'Artillery tactics mastered'
          }
        ]
      }
    ];
  }

  private createAdvancedWarfareScenarios(): CampaignScenario[] {
    return [
      {
        scenarioId: 'advanced_01',
        name: 'The Gauntlet',
        description: 'Survive against overwhelming odds',
        difficulty: AIDifficulty.EXPERT,
        objectives: [
          {
            id: 'survive_turns',
            type: 'survival',
            description: 'Survive for 15 turns',
            target: 15,
            required: true
          }
        ],
        constraints: [
          {
            type: 'fleet_size',
            description: 'Only 6 ships vs 12 enemy ships',
            parameters: { maxShips: 6 }
          }
        ],
        customSetup: {
          enemyAdvantage: 2,
          reinforcementWaves: true
        },
        aiOpponent: AIOpponentFactory.getOpponentById('commander')!,
        rewards: [
          {
            type: 'experience',
            amount: 500,
            description: 'Survival specialist'
          },
          {
            type: 'achievement',
            itemId: 'against_all_odds',
            description: 'Against All Odds achievement'
          }
        ]
      }
    ];
  }

  private isCampaignUnlocked(campaign: Campaign): boolean {
    if (campaign.isUnlocked) return true;
    
    return campaign.prerequisites.every(prereq => {
      const prereqCampaign = this.campaigns.get(prereq);
      return prereqCampaign && this.isCampaignCompleted(prereqCampaign);
    });
  }

  private isCampaignCompleted(campaign: Campaign): boolean {
    return campaign.scenarios.every(scenario =>
      this.playerProgress.completedScenarios.has(scenario.scenarioId)
    );
  }

  private isScenarioUnlocked(campaign: Campaign, scenario: CampaignScenario): boolean {
    const scenarioIndex = campaign.scenarios.indexOf(scenario);
    if (scenarioIndex === 0) return true; // First scenario always unlocked
    
    // Check if previous scenario is completed
    const previousScenario = campaign.scenarios[scenarioIndex - 1];
    return this.playerProgress.completedScenarios.has(previousScenario.scenarioId);
  }

  private updateStatistics(won: boolean, gameStats: any): void {
    this.playerProgress.statistics.gamesPlayed++;
    if (won) {
      this.playerProgress.statistics.gamesWon++;
    }
    
    // Update other statistics based on gameStats
    if (gameStats.duration) {
      this.playerProgress.statistics.totalPlayTime += gameStats.duration;
      this.playerProgress.statistics.averageGameLength = 
        this.playerProgress.statistics.totalPlayTime / this.playerProgress.statistics.gamesPlayed;
    }
  }

  private evaluateObjectives(scenario: CampaignScenario, gameStats: any): ScenarioObjective[] {
    // Evaluate which objectives were completed
    return scenario.objectives.filter(objective => {
      // Simplified evaluation logic
      return Math.random() > 0.3; // Placeholder
    });
  }

  private calculateStars(scenario: CampaignScenario, gameStats: any): number {
    // Calculate star rating (1-3) based on performance
    const completedObjectives = this.evaluateObjectives(scenario, gameStats);
    const objectiveRatio = completedObjectives.length / scenario.objectives.length;
    
    if (objectiveRatio === 1) return 3;
    if (objectiveRatio >= 0.7) return 2;
    return 1;
  }

  private applyRewards(rewards: CampaignReward[]): void {
    // Apply rewards to player account
    rewards.forEach(reward => {
      switch (reward.type) {
        case 'experience':
          logger.info('CAMPAIGN', 'Experience gained', { amount: reward.amount });
          break;
        case 'unlock':
          logger.info('CAMPAIGN', 'Content unlocked', { itemId: reward.itemId });
          break;
        case 'achievement':
          logger.info('CAMPAIGN', 'Achievement earned', { itemId: reward.itemId });
          break;
      }
    });
  }

  private checkUnlocks(): void {
    // Check for newly unlocked campaigns/content
    this.campaigns.forEach(campaign => {
      if (!campaign.isUnlocked && this.isCampaignUnlocked(campaign)) {
        campaign.isUnlocked = true;
        logger.info('CAMPAIGN', 'Campaign unlocked', { campaignId: campaign.campaignId });
        this.emit('campaign-unlocked', campaign);
      }
    });
  }

  private loadPlayerProgress(): void {
    // Load progress from storage
    try {
      const saved = localStorage.getItem('spaceHex_campaign_progress');
      if (saved) {
        const data = JSON.parse(saved);
        this.playerProgress = {
          ...this.playerProgress,
          ...data,
          completedScenarios: new Set(data.completedScenarios || [])
        };
      }
    } catch (error) {
      logger.error('CAMPAIGN', 'Failed to load progress', error);
    }
  }

  private savePlayerProgress(): void {
    // Save progress to storage
    try {
      const data = {
        ...this.playerProgress,
        completedScenarios: Array.from(this.playerProgress.completedScenarios)
      };
      localStorage.setItem('spaceHex_campaign_progress', JSON.stringify(data));
    } catch (error) {
      logger.error('CAMPAIGN', 'Failed to save progress', error);
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          logger.error('CAMPAIGN', 'Error in event listener', { event, error });
        }
      });
    }
  }
}

// Singleton instance
export const campaignManager = new CampaignManager();