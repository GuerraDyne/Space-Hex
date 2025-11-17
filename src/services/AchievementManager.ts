/**
 * AchievementManager - Handles player achievements and progression
 * Tracks player statistics and unlocks achievements
 */

import {
  Achievement,
  AchievementCategory,
  AchievementRarity,
  AchievementRequirement,
  AchievementProgress,
  CampaignReward
} from '../multiplayer/types';
import { GameState, PlayerId, ShipType } from '../game/core/Types';
import { logger } from '../utils/Logger';

interface PlayerStats {
  totalGamesPlayed: number;
  totalGamesWon: number;
  totalPlayTime: number;
  shipsDestroyed: Map<ShipType, number>;
  shipsLost: Map<ShipType, number>;
  mothershipsCaptured: number;
  mothershipMovements: number;
  longestWinStreak: number;
  currentWinStreak: number;
  campaignScenariosCompleted: number;
  multiplayerWins: number;
  aiWins: Map<string, number>; // AI difficulty -> wins
  perfectGames: number; // Games won without losing any ships
  fastestVictory: number; // Shortest game time for victory
  combatInitiations: number;
  territoryControlled: number;
  averageGameLength: number;
}

export class AchievementManager {
  private achievements: Map<string, Achievement> = new Map();
  private playerStats: PlayerStats = this.getDefaultStats();
  private unlockedAchievements: Set<string> = new Set();
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor() {
    this.initializeAchievements();
    this.loadPlayerData();
  }

  /**
   * Get all achievements
   */
  getAllAchievements(): Achievement[] {
    return Array.from(this.achievements.values());
  }

  /**
   * Get achievements by category
   */
  getAchievementsByCategory(category: AchievementCategory): Achievement[] {
    return Array.from(this.achievements.values()).filter(
      achievement => achievement.category === category
    );
  }

  /**
   * Get unlocked achievements
   */
  getUnlockedAchievements(): Achievement[] {
    return Array.from(this.achievements.values()).filter(
      achievement => this.unlockedAchievements.has(achievement.achievementId)
    );
  }

  /**
   * Get locked achievements
   */
  getLockedAchievements(): Achievement[] {
    return Array.from(this.achievements.values()).filter(
      achievement => !this.unlockedAchievements.has(achievement.achievementId)
    );
  }

  /**
   * Get achievements with progress
   */
  getAchievementsWithProgress(): Achievement[] {
    return Array.from(this.achievements.values()).map(achievement => ({
      ...achievement,
      progress: this.calculateAchievementProgress(achievement)
    }));
  }

  /**
   * Update player statistics after a game
   */
  updateGameStatistics(gameResult: {
    won: boolean;
    gameTime: number;
    shipsDestroyed: Map<ShipType, number>;
    shipsLost: Map<ShipType, number>;
    mothershipCaptured: boolean;
    mothershipMoves: number;
    opponentType: 'human' | 'ai';
    aiDifficulty?: string;
    perfectGame: boolean;
    combatInitiated: boolean;
  }): void {
    try {
      // Update basic stats
      this.playerStats.totalGamesPlayed++;
      this.playerStats.totalPlayTime += gameResult.gameTime;
      this.playerStats.averageGameLength = this.playerStats.totalPlayTime / this.playerStats.totalGamesPlayed;

      if (gameResult.won) {
        this.playerStats.totalGamesWon++;
        this.playerStats.currentWinStreak++;
        this.playerStats.longestWinStreak = Math.max(
          this.playerStats.longestWinStreak,
          this.playerStats.currentWinStreak
        );

        // Track fastest victory
        if (this.playerStats.fastestVictory === 0 || gameResult.gameTime < this.playerStats.fastestVictory) {
          this.playerStats.fastestVictory = gameResult.gameTime;
        }

        // Track opponent-specific wins
        if (gameResult.opponentType === 'ai' && gameResult.aiDifficulty) {
          const currentWins = this.playerStats.aiWins.get(gameResult.aiDifficulty) || 0;
          this.playerStats.aiWins.set(gameResult.aiDifficulty, currentWins + 1);
        } else if (gameResult.opponentType === 'human') {
          this.playerStats.multiplayerWins++;
        }

        if (gameResult.perfectGame) {
          this.playerStats.perfectGames++;
        }
      } else {
        this.playerStats.currentWinStreak = 0;
      }

      // Update ship statistics
      gameResult.shipsDestroyed.forEach((count, shipType) => {
        const current = this.playerStats.shipsDestroyed.get(shipType) || 0;
        this.playerStats.shipsDestroyed.set(shipType, current + count);
      });

      gameResult.shipsLost.forEach((count, shipType) => {
        const current = this.playerStats.shipsLost.get(shipType) || 0;
        this.playerStats.shipsLost.set(shipType, current + count);
      });

      // Update other stats
      if (gameResult.mothershipCaptured) {
        this.playerStats.mothershipsCaptured++;
      }

      this.playerStats.mothershipMovements += gameResult.mothershipMoves;

      if (gameResult.combatInitiated) {
        this.playerStats.combatInitiations++;
      }

      // Check for newly unlocked achievements
      this.checkAchievements();

      // Save updated stats
      this.savePlayerData();

      logger.info('ACHIEVEMENTS', 'Game statistics updated', {
        won: gameResult.won,
        totalGames: this.playerStats.totalGamesPlayed
      });
    } catch (error) {
      logger.error('ACHIEVEMENTS', 'Error updating game statistics', error);
    }
  }

  /**
   * Update campaign progress
   */
  updateCampaignProgress(scenariosCompleted: number): void {
    this.playerStats.campaignScenariosCompleted = scenariosCompleted;
    this.checkAchievements();
    this.savePlayerData();
  }

  /**
   * Get player statistics
   */
  getPlayerStatistics(): PlayerStats {
    return { ...this.playerStats };
  }

  /**
   * Get achievement progress for a specific achievement
   */
  getAchievementProgress(achievementId: string): AchievementProgress | null {
    const achievement = this.achievements.get(achievementId);
    if (!achievement) return null;

    return this.calculateAchievementProgress(achievement);
  }

  /**
   * Check if achievement is unlocked
   */
  isAchievementUnlocked(achievementId: string): boolean {
    return this.unlockedAchievements.has(achievementId);
  }

  /**
   * Get achievement statistics
   */
  getAchievementStatistics(): {
    totalAchievements: number;
    unlockedAchievements: number;
    unlockedPercentage: number;
    rarityBreakdown: Record<AchievementRarity, { total: number; unlocked: number }>;
    categoryBreakdown: Record<AchievementCategory, { total: number; unlocked: number }>;
  } {
    const total = this.achievements.size;
    const unlocked = this.unlockedAchievements.size;

    const rarityBreakdown = {} as Record<AchievementRarity, { total: number; unocked: number }>;
    const categoryBreakdown = {} as Record<AchievementCategory, { total: number; unlocked: number }>;

    // Initialize breakdowns
    Object.values(AchievementRarity).forEach(rarity => {
      rarityBreakdown[rarity] = { total: 0, unlocked: 0 };
    });

    Object.values(AchievementCategory).forEach(category => {
      categoryBreakdown[category] = { total: 0, unlocked: 0 };
    });

    // Calculate breakdowns
    Array.from(this.achievements.values()).forEach(achievement => {
      rarityBreakdown[achievement.rarity].total++;
      categoryBreakdown[achievement.category].total++;

      if (this.unlockedAchievements.has(achievement.achievementId)) {
        rarityBreakdown[achievement.rarity].unlocked++;
        categoryBreakdown[achievement.category].unlocked++;
      }
    });

    return {
      totalAchievements: total,
      unlockedAchievements: unlocked,
      unlockedPercentage: (unlocked / total) * 100,
      rarityBreakdown,
      categoryBreakdown
    };
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

  private initializeAchievements(): void {
    const achievements: Achievement[] = [
      // Combat Achievements
      {
        achievementId: 'first_victory',
        name: 'First Victory',
        description: 'Win your first game',
        category: AchievementCategory.COMBAT,
        rarity: AchievementRarity.COMMON,
        icon: 'first_victory',
        requirements: [
          { type: 'games_won', target: 1, current: 0 }
        ],
        rewards: [
          { type: 'experience', amount: 100, description: 'Victory bonus' }
        ],
        isSecret: false
      },
      {
        achievementId: 'destroyer_of_worlds',
        name: 'Destroyer of Worlds',
        description: 'Destroy 100 enemy ships',
        category: AchievementCategory.COMBAT,
        rarity: AchievementRarity.RARE,
        icon: 'destroyer_of_worlds',
        requirements: [
          { type: 'ships_destroyed', target: 100, current: 0 }
        ],
        rewards: [
          { type: 'achievement', itemId: 'destroyer_title', description: 'Destroyer title' }
        ],
        isSecret: false
      },
      {
        achievementId: 'mothership_hunter',
        name: 'Mothership Hunter',
        description: 'Capture 10 enemy motherships',
        category: AchievementCategory.COMBAT,
        rarity: AchievementRarity.EPIC,
        icon: 'mothership_hunter',
        requirements: [
          { type: 'mothershipsCaptured', target: 10, current: 0 }
        ],
        rewards: [
          { type: 'cosmetic', itemId: 'hunter_badge', description: 'Hunter badge' }
        ],
        isSecret: false
      },

      // Strategy Achievements
      {
        achievementId: 'perfect_strategist',
        name: 'Perfect Strategist',
        description: 'Win a game without losing any ships',
        category: AchievementCategory.STRATEGY,
        rarity: AchievementRarity.UNCOMMON,
        icon: 'perfect_strategist',
        requirements: [
          { type: 'perfect_games', target: 1, current: 0 }
        ],
        rewards: [
          { type: 'experience', amount: 250, description: 'Strategic mastery bonus' }
        ],
        isSecret: false
      },
      {
        achievementId: 'speed_demon',
        name: 'Speed Demon',
        description: 'Win a game in under 10 minutes',
        category: AchievementCategory.STRATEGY,
        rarity: AchievementRarity.RARE,
        icon: 'speed_demon',
        requirements: [
          { type: 'fastest_victory', target: 600000, current: 0, parameters: { comparison: 'less_than' } }
        ],
        rewards: [
          { type: 'achievement', itemId: 'speed_title', description: 'Speed title' }
        ],
        isSecret: false
      },
      {
        achievementId: 'unstoppable_force',
        name: 'Unstoppable Force',
        description: 'Win 10 games in a row',
        category: AchievementCategory.STRATEGY,
        rarity: AchievementRarity.LEGENDARY,
        icon: 'unstoppable_force',
        requirements: [
          { type: 'win_streak', target: 10, current: 0 }
        ],
        rewards: [
          { type: 'cosmetic', itemId: 'unstoppable_emblem', description: 'Unstoppable emblem' },
          { type: 'experience', amount: 1000, description: 'Legendary bonus' }
        ],
        isSecret: false
      },

      // Collection Achievements
      {
        achievementId: 'ship_specialist_scout',
        name: 'Scout Specialist',
        description: 'Destroy 50 ships using Scouts',
        category: AchievementCategory.COLLECTION,
        rarity: AchievementRarity.UNCOMMON,
        icon: 'scout_specialist',
        requirements: [
          { type: 'ships_destroyed_with', target: 50, current: 0, parameters: { shipType: ShipType.SCOUT } }
        ],
        rewards: [
          { type: 'cosmetic', itemId: 'scout_emblem', description: 'Scout emblem' }
        ],
        isSecret: false
      },
      {
        achievementId: 'artillery_master',
        name: 'Artillery Master',
        description: 'Destroy 25 ships using Artillery',
        category: AchievementCategory.COLLECTION,
        rarity: AchievementRarity.RARE,
        icon: 'artillery_master',
        requirements: [
          { type: 'ships_destroyed_with', target: 25, current: 0, parameters: { shipType: ShipType.ARTILLERY } }
        ],
        rewards: [
          { type: 'achievement', itemId: 'artillery_title', description: 'Artillery Master title' }
        ],
        isSecret: false
      },

      // Social Achievements
      {
        achievementId: 'multiplayer_veteran',
        name: 'Multiplayer Veteran',
        description: 'Win 50 multiplayer games',
        category: AchievementCategory.SOCIAL,
        rarity: AchievementRarity.EPIC,
        icon: 'multiplayer_veteran',
        requirements: [
          { type: 'multiplayer_wins', target: 50, current: 0 }
        ],
        rewards: [
          { type: 'cosmetic', itemId: 'veteran_badge', description: 'Veteran badge' }
        ],
        isSecret: false
      },

      // Mastery Achievements
      {
        achievementId: 'ai_conqueror_master',
        name: 'AI Conqueror',
        description: 'Defeat all AI difficulties',
        category: AchievementCategory.MASTERY,
        rarity: AchievementRarity.LEGENDARY,
        icon: 'ai_conqueror',
        requirements: [
          { type: 'defeat_all_ai', target: 5, current: 0 }
        ],
        rewards: [
          { type: 'achievement', itemId: 'ai_conqueror_title', description: 'AI Conqueror title' },
          { type: 'experience', amount: 2000, description: 'Mastery bonus' }
        ],
        isSecret: false
      },

      // Secret Achievements
      {
        achievementId: 'david_vs_goliath',
        name: 'David vs Goliath',
        description: 'Win against overwhelming odds',
        category: AchievementCategory.STRATEGY,
        rarity: AchievementRarity.LEGENDARY,
        icon: 'david_goliath',
        requirements: [
          { type: 'underdog_victory', target: 1, current: 0 }
        ],
        rewards: [
          { type: 'achievement', itemId: 'underdog_title', description: 'Underdog title' }
        ],
        isSecret: true
      }
    ];

    achievements.forEach(achievement => {
      this.achievements.set(achievement.achievementId, achievement);
    });

    logger.info('ACHIEVEMENTS', 'Achievements initialized', { 
      count: achievements.length 
    });
  }

  private calculateAchievementProgress(achievement: Achievement): AchievementProgress {
    const requirement = achievement.requirements[0]; // Simplified to one requirement
    const current = this.getStatValue(requirement.type, requirement.parameters);
    
    return {
      current: Math.min(current, requirement.target),
      target: requirement.target,
      percentage: Math.min((current / requirement.target) * 100, 100),
      lastUpdated: Date.now()
    };
  }

  private getStatValue(statType: string, parameters?: any): number {
    switch (statType) {
      case 'games_won':
        return this.playerStats.totalGamesWon;
      case 'ships_destroyed':
        return Array.from(this.playerStats.shipsDestroyed.values()).reduce((sum, count) => sum + count, 0);
      case 'mothershipsCaptured':
        return this.playerStats.mothershipsCaptured;
      case 'perfect_games':
        return this.playerStats.perfectGames;
      case 'fastest_victory':
        return this.playerStats.fastestVictory;
      case 'win_streak':
        return this.playerStats.longestWinStreak;
      case 'multiplayer_wins':
        return this.playerStats.multiplayerWins;
      case 'ships_destroyed_with':
        if (parameters?.shipType) {
          return this.playerStats.shipsDestroyed.get(parameters.shipType) || 0;
        }
        return 0;
      case 'defeat_all_ai':
        // Count how many different AI difficulties have been defeated
        return this.playerStats.aiWins.size;
      case 'underdog_victory':
        // This would be tracked separately based on specific game conditions
        return 0; // Placeholder
      default:
        return 0;
    }
  }

  private checkAchievements(): void {
    const newlyUnlocked: Achievement[] = [];

    this.achievements.forEach(achievement => {
      if (this.unlockedAchievements.has(achievement.achievementId)) {
        return; // Already unlocked
      }

      // Check if all requirements are met
      const allRequirementsMet = achievement.requirements.every(requirement => {
        const current = this.getStatValue(requirement.type, requirement.parameters);
        
        if (requirement.parameters?.comparison === 'less_than') {
          return current > 0 && current <= requirement.target;
        }
        
        return current >= requirement.target;
      });

      if (allRequirementsMet) {
        this.unlockAchievement(achievement);
        newlyUnlocked.push(achievement);
      }
    });

    if (newlyUnlocked.length > 0) {
      this.emit('achievements-unlocked', newlyUnlocked);
    }
  }

  private unlockAchievement(achievement: Achievement): void {
    this.unlockedAchievements.add(achievement.achievementId);
    achievement.unlockedAt = Date.now();

    // Apply rewards
    achievement.rewards.forEach(reward => {
      this.applyReward(reward);
    });

    logger.info('ACHIEVEMENTS', 'Achievement unlocked', {
      achievementId: achievement.achievementId,
      name: achievement.name,
      rarity: achievement.rarity
    });

    this.emit('achievement-unlocked', achievement);
  }

  private applyReward(reward: CampaignReward): void {
    switch (reward.type) {
      case 'experience':
        logger.info('ACHIEVEMENTS', 'Experience reward applied', { amount: reward.amount });
        break;
      case 'achievement':
        logger.info('ACHIEVEMENTS', 'Title/Badge reward applied', { itemId: reward.itemId });
        break;
      case 'cosmetic':
        logger.info('ACHIEVEMENTS', 'Cosmetic reward applied', { itemId: reward.itemId });
        break;
      case 'unlock':
        logger.info('ACHIEVEMENTS', 'Content unlocked', { itemId: reward.itemId });
        break;
    }
  }

  private getDefaultStats(): PlayerStats {
    return {
      totalGamesPlayed: 0,
      totalGamesWon: 0,
      totalPlayTime: 0,
      shipsDestroyed: new Map(),
      shipsLost: new Map(),
      mothershipsCaptured: 0,
      mothershipMovements: 0,
      longestWinStreak: 0,
      currentWinStreak: 0,
      campaignScenariosCompleted: 0,
      multiplayerWins: 0,
      aiWins: new Map(),
      perfectGames: 0,
      fastestVictory: 0,
      combatInitiations: 0,
      territoryControlled: 0,
      averageGameLength: 0
    };
  }

  private loadPlayerData(): void {
    try {
      const statsData = localStorage.getItem('spaceHex_player_stats');
      const achievementsData = localStorage.getItem('spaceHex_unlocked_achievements');

      if (statsData) {
        const parsed = JSON.parse(statsData);
        this.playerStats = {
          ...this.getDefaultStats(),
          ...parsed,
          shipsDestroyed: new Map(parsed.shipsDestroyed || []),
          shipsLost: new Map(parsed.shipsLost || []),
          aiWins: new Map(parsed.aiWins || [])
        };
      }

      if (achievementsData) {
        const parsed = JSON.parse(achievementsData);
        this.unlockedAchievements = new Set(parsed);
      }

      logger.info('ACHIEVEMENTS', 'Player data loaded', {
        statsLoaded: !!statsData,
        achievementsLoaded: !!achievementsData
      });
    } catch (error) {
      logger.error('ACHIEVEMENTS', 'Failed to load player data', error);
    }
  }

  private savePlayerData(): void {
    try {
      const statsData = {
        ...this.playerStats,
        shipsDestroyed: Array.from(this.playerStats.shipsDestroyed.entries()),
        shipsLost: Array.from(this.playerStats.shipsLost.entries()),
        aiWins: Array.from(this.playerStats.aiWins.entries())
      };

      localStorage.setItem('spaceHex_player_stats', JSON.stringify(statsData));
      localStorage.setItem('spaceHex_unlocked_achievements', JSON.stringify(Array.from(this.unlockedAchievements)));
    } catch (error) {
      logger.error('ACHIEVEMENTS', 'Failed to save player data', error);
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          logger.error('ACHIEVEMENTS', 'Error in event listener', { event, error });
        }
      });
    }
  }
}

// Singleton instance
export const achievementManager = new AchievementManager();