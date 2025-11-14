/**
 * SimpleLobby - Simplified lobby for testing
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert
} from 'react-native';
import { logger } from '../../utils/Logger';
import { AISetupMenu, AIGameSettings } from './AISetupMenu';

interface SimpleLobbyProps {
  onGameStart: (session: any) => void;
  onCampaignStart: (campaignId: string, scenarioId: string) => void;
  onQuickMatch?: () => void;
  onHostMatch?: () => void;
  onJoinMatch?: () => void;
}

export const SimpleLobby: React.FC<SimpleLobbyProps> = ({
  onGameStart,
  onCampaignStart,
  onQuickMatch,
  onHostMatch,
  onJoinMatch
}) => {
  const [activeTab, setActiveTab] = useState<'multiplayer' | 'training' | 'achievements'>('multiplayer');
  const [showAISetup, setShowAISetup] = useState(false);

  const handleQuickMatch = () => {
    logger.info('LOBBY', 'Quick match requested');
    onQuickMatch?.();
  };

  const handleAIPractice = () => {
    logger.info('LOBBY', 'AI practice setup opened');
    setShowAISetup(true);
  };

  const handleAIGameStart = (settings: AIGameSettings) => {
    logger.info('LOBBY', 'AI game starting with settings:', settings);
    setShowAISetup(false);
    onGameStart({ 
      sessionId: 'ai_practice_' + Date.now(), 
      type: 'ai', 
      mapType: settings.mapType,
      difficulty: settings.difficulty,
      deploymentTime: settings.deploymentTime,
      turnTime: settings.turnTime
    });
  };

  const handleTraining = () => {
    logger.info('LOBBY', 'Training requested - Space Fleet Academy');
    onCampaignStart('space_fleet_academy', 'basic_movement');
  };

  const getMapDescription = (mapType: string): string => {
    switch (mapType) {
      case 'Classic':
        return 'Standard battlefield';
      case 'Graveyard':
        return 'Debris fields block movement';
      case 'Meteor Shower':
        return 'Meteors deal damage';
      case 'Random':
        return 'Random mix of hazards';
      default:
        return 'Unknown map type';
    }
  };

  const renderMultiplayerTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Multiplayer Options</Text>
      
      <View style={styles.connectionStatus}>
        <View style={[styles.connectionIndicator, { backgroundColor: '#00ff00' }]} />
        <Text style={styles.connectionText}>Ready to Play</Text>
      </View>


      <TouchableOpacity style={styles.quickActionButton} onPress={handleQuickMatch}>
        <Text style={styles.quickActionText}>⚡ Quick Match</Text>
      </TouchableOpacity>
      
      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.halfButton, styles.hostButton]} onPress={() => onHostMatch?.()}>
          <Text style={styles.buttonText}>🏠 Host Match</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.halfButton, styles.joinButton]} onPress={() => onJoinMatch?.()}>
          <Text style={styles.buttonText}>🔗 Join Match</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.disabledContainer}>
        <TouchableOpacity style={[styles.quickActionButton, styles.disabledButton]} disabled={true}>
          <Text style={[styles.quickActionText, styles.disabledText]}>🤖 AI Practice</Text>
        </TouchableOpacity>
        <View style={styles.comingSoonOverlay}>
          <Text style={styles.comingSoonText}>Coming Soon</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderTrainingTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Training Mode</Text>
      
      <View style={styles.disabledContainer}>
        <TouchableOpacity style={[styles.trainingCard, styles.disabledCard]} disabled={true}>
          <Text style={[styles.trainingName, styles.disabledText]}>Space Fleet Academy</Text>
          <Text style={[styles.trainingDescription, styles.disabledText]}>Learn the basics of space fleet command</Text>
          <Text style={[styles.trainingProgress, styles.disabledText]}>Progress: 0/3 scenarios</Text>
        </TouchableOpacity>
        <View style={styles.comingSoonOverlay}>
          <Text style={styles.comingSoonText}>Coming Soon</Text>
        </View>
      </View>

      <View style={styles.disabledContainer}>
        <View style={[styles.trainingCard, styles.disabledCard]}>
          <Text style={[styles.trainingName, styles.disabledText]}>Basic Fleet Tactics</Text>
          <Text style={[styles.trainingDescription, styles.disabledText]}>Master fundamental fleet maneuvers</Text>
          <Text style={[styles.lockedText, styles.disabledText]}>🔒 Complete Academy first</Text>
        </View>
        <View style={styles.comingSoonOverlay}>
          <Text style={styles.comingSoonText}>Coming Soon</Text>
        </View>
      </View>

      <View style={styles.disabledContainer}>
        <View style={[styles.trainingCard, styles.disabledCard]}>
          <Text style={[styles.trainingName, styles.disabledText]}>Advanced Fleet Warfare</Text>
          <Text style={[styles.trainingDescription, styles.disabledText]}>Face elite opponents with complex strategies</Text>
          <Text style={[styles.lockedText, styles.disabledText]}>🔒 Complete Basic Tactics first</Text>
        </View>
        <View style={styles.comingSoonOverlay}>
          <Text style={styles.comingSoonText}>Coming Soon</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderAchievementsTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Achievements</Text>
      
      <View style={styles.achievementStats}>
        <Text style={styles.statText}>Unlocked: 0/50+</Text>
        <Text style={styles.statText}>Progress: 0%</Text>
      </View>

      <View style={styles.disabledContainer}>
        <View style={[styles.achievementCard, styles.disabledCard]}>
          <Text style={[styles.achievementName, styles.disabledText]}>First Victory</Text>
          <Text style={[styles.achievementDescription, styles.disabledText]}>Win your first game</Text>
          <Text style={[styles.achievementRarity, styles.disabledText]}>COMMON</Text>
          <View style={styles.progressContainer}>
            <Text style={[styles.progressText, styles.disabledText]}>0/1</Text>
            <View style={[styles.progressBar, styles.disabledProgressBar]}>
              <View style={[styles.progressFill, { width: '0%' }]} />
            </View>
          </View>
        </View>
        <View style={styles.comingSoonOverlay}>
          <Text style={styles.comingSoonText}>Coming Soon</Text>
        </View>
      </View>

      <View style={styles.disabledContainer}>
        <View style={[styles.achievementCard, styles.disabledCard]}>
          <Text style={[styles.achievementName, styles.disabledText]}>Perfect Strategist</Text>
          <Text style={[styles.achievementDescription, styles.disabledText]}>Win a game without losing any ships</Text>
          <Text style={[styles.achievementRarity, styles.disabledText]}>UNCOMMON</Text>
          <View style={styles.progressContainer}>
            <Text style={[styles.progressText, styles.disabledText]}>0/1</Text>
            <View style={[styles.progressBar, styles.disabledProgressBar]}>
              <View style={[styles.progressFill, { width: '0%' }]} />
            </View>
          </View>
        </View>
        <View style={styles.comingSoonOverlay}>
          <Text style={styles.comingSoonText}>Coming Soon</Text>
        </View>
      </View>

      <View style={styles.disabledContainer}>
        <View style={[styles.achievementCard, styles.disabledCard]}>
          <Text style={[styles.achievementName, styles.disabledText]}>Unstoppable Force</Text>
          <Text style={[styles.achievementDescription, styles.disabledText]}>Win 10 games in a row</Text>
          <Text style={[styles.achievementRarity, styles.disabledText]}>LEGENDARY</Text>
          <View style={styles.progressContainer}>
            <Text style={[styles.progressText, styles.disabledText]}>0/10</Text>
            <View style={[styles.progressBar, styles.disabledProgressBar]}>
              <View style={[styles.progressFill, { width: '0%' }]} />
            </View>
          </View>
        </View>
        <View style={styles.comingSoonOverlay}>
          <Text style={styles.comingSoonText}>Coming Soon</Text>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'multiplayer' && styles.activeTab]}
          onPress={() => setActiveTab('multiplayer')}
        >
          <Text style={[styles.tabText, activeTab === 'multiplayer' && styles.activeTabText]}>
            Multiplayer
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'training' && styles.activeTab]}
          onPress={() => setActiveTab('training')}
        >
          <Text style={[styles.tabText, activeTab === 'training' && styles.activeTabText]}>
            Training
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'achievements' && styles.activeTab]}
          onPress={() => setActiveTab('achievements')}
        >
          <Text style={[styles.tabText, activeTab === 'achievements' && styles.activeTabText]}>
            Achievements
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'multiplayer' && renderMultiplayerTab()}
      {activeTab === 'training' && renderTrainingTab()}
      {activeTab === 'achievements' && renderAchievementsTab()}
      
      {/* AI Setup Menu */}
      <AISetupMenu
        visible={showAISetup}
        onClose={() => setShowAISetup(false)}
        onStartGame={handleAIGameStart}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  
  halfButton: {
    flex: 0.48,
    backgroundColor: '#0f3460',
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#00ff88',
    alignItems: 'center',
  },
  
  hostButton: {
    borderColor: '#88ff00',
  },
  
  joinButton: {
    borderColor: '#00ffff',
  },
  
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4ECDC4',
  },
  
  tabText: {
    color: '#aaa',
    fontSize: 16,
    fontWeight: '500',
  },
  
  activeTabText: {
    color: '#4ECDC4',
  },
  
  tabContent: {
    flex: 1,
    padding: 16,
  },
  
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  
  connectionIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  
  connectionText: {
    color: '#fff',
    fontSize: 14,
  },
  
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 16,
  },
  
  quickActionButton: {
    backgroundColor: '#4ECDC4',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  
  quickActionText: {
    color: '#0a0a0a',
    fontSize: 16,
    fontWeight: 'bold',
  },

  infoBox: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#333',
  },

  infoTitle: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  infoText: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 4,
    paddingLeft: 8,
  },
  
  trainingCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  
  trainingName: {
    color: '#4ECDC4',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  
  trainingDescription: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
  },
  
  trainingProgress: {
    color: '#aaa',
    fontSize: 12,
  },
  
  lockedText: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
  },
  
  achievementStats: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  
  statText: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  achievementCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  
  achievementName: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  
  achievementDescription: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
  },
  
  achievementRarity: {
    color: '#aaa',
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  
  progressContainer: {
    marginTop: 8,
  },
  
  progressText: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 4,
  },
  
  progressBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  
  progressFill: {
    height: '100%',
    backgroundColor: '#4ECDC4',
  },

  mapSelection: {
    marginBottom: 20,
  },

  mapSelectionTitle: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },

  mapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  mapCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    width: '48%',
    minHeight: 80,
  },

  selectedMapCard: {
    borderColor: '#4ECDC4',
    backgroundColor: '#1a3a3a',
  },

  mapName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },

  mapDescription: {
    color: '#aaa',
    fontSize: 12,
    lineHeight: 16,
  },

  selectedMapText: {
    color: '#4ECDC4',
  },
  
  disabledContainer: {
    position: 'relative',
  },
  
  disabledButton: {
    opacity: 0.4,
  },
  
  disabledCard: {
    opacity: 0.4,
  },
  
  disabledText: {
    opacity: 0.6,
  },
  
  disabledProgressBar: {
    opacity: 0.3,
  },
  
  comingSoonOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -10 }],
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#4ECDC4',
    zIndex: 10,
  },
  
  comingSoonText: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});