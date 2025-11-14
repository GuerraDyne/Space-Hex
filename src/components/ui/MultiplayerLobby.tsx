/**
 * MultiplayerLobby - Main multiplayer lobby interface
 * Handles session creation, joining, and matchmaking
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Switch
} from 'react-native';
import {
  GameSession,
  GameSessionStatus,
  GameMode,
  TimeControl,
  SessionSettings,
  AIDifficulty,
  ConnectionState
} from '../../multiplayer/types';
import { sessionManager } from '../../services/SessionManager';
import { achievementManager } from '../../services/AchievementManager';
import { campaignManager } from '../../campaign/CampaignManager';
import { AIOpponentFactory } from '../../ai/AIOpponent';
import { logger } from '../../utils/Logger';

interface MultiplayerLobbyProps {
  onGameStart: (session: GameSession) => void;
  onCampaignStart: (campaignId: string, scenarioId: string) => void;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  onGameStart,
  onCampaignStart
}) => {
  // State
  const [activeTab, setActiveTab] = useState<'multiplayer' | 'campaign' | 'achievements'>('multiplayer');
  const [availableSessions, setAvailableSessions] = useState<GameSession[]>([]);
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0,
    ping: 0
  });
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [isMatchmaking, setIsMatchmaking] = useState(false);

  // Create session form state
  const [sessionName, setSessionName] = useState('');
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.CLASSIC);
  const [timeControl, setTimeControl] = useState<TimeControl>({ type: 'none' });
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowSpectators, setAllowSpectators] = useState(true);

  // Campaign state
  const [campaigns, setCampaigns] = useState(campaignManager.getAllCampaigns());
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  // Achievements state
  const [achievements, setAchievements] = useState(achievementManager.getAchievementsWithProgress());
  const [achievementStats, setAchievementStats] = useState(achievementManager.getAchievementStatistics());

  /**
   * Initialize the lobby
   */
  useEffect(() => {
    initializeLobby();
    setupEventListeners();

    return () => {
      cleanup();
    };
  }, []);

  const initializeLobby = async () => {
    try {
      logger.info('LOBBY', 'Initializing multiplayer lobby');
      
      // Initialize session manager
      const initialized = await sessionManager.initialize('Player1', 'player_1');
      if (initialized) {
        await sessionManager.refreshLobby();
        const lobbyState = sessionManager.getLobbyState();
        setAvailableSessions(lobbyState.availableSessions);
        setConnectionState(lobbyState.connectionState);
      }
    } catch (error) {
      logger.error('LOBBY', 'Failed to initialize lobby', error);
      Alert.alert('Connection Error', 'Failed to connect to game servers');
    }
  };

  const setupEventListeners = () => {
    sessionManager.on('session-created', handleSessionCreated);
    sessionManager.on('session-joined', handleSessionJoined);
    sessionManager.on('session-updated', handleSessionUpdated);
    sessionManager.on('lobby-updated', handleLobbyUpdated);
    sessionManager.on('connection-changed', handleConnectionChanged);
    sessionManager.on('error', handleError);

    campaignManager.on('scenario-started', handleScenarioStarted);
    achievementManager.on('achievement-unlocked', handleAchievementUnlocked);
  };

  const cleanup = () => {
    sessionManager.removeAllListeners();
    campaignManager.off('scenario-started', handleScenarioStarted);
    achievementManager.off('achievement-unlocked', handleAchievementUnlocked);
  };

  // Event handlers
  const handleSessionCreated = useCallback((session: GameSession) => {
    setCurrentSession(session);
    setShowCreateSession(false);
    logger.info('LOBBY', 'Session created successfully', { sessionId: session.sessionId });
  }, []);

  const handleSessionJoined = useCallback((session: GameSession) => {
    setCurrentSession(session);
    logger.info('LOBBY', 'Joined session successfully', { sessionId: session.sessionId });
  }, []);

  const handleSessionUpdated = useCallback((session: GameSession) => {
    if (currentSession?.sessionId === session.sessionId) {
      setCurrentSession(session);
    }
    
    // Update in available sessions
    setAvailableSessions(prev => 
      prev.map(s => s.sessionId === session.sessionId ? session : s)
    );

    // Check if game is starting
    if (session.status === GameSessionStatus.IN_PROGRESS) {
      onGameStart(session);
    }
  }, [currentSession, onGameStart]);

  const handleLobbyUpdated = useCallback((lobbyState: any) => {
    setAvailableSessions(lobbyState.availableSessions);
  }, []);

  const handleConnectionChanged = useCallback((newConnectionState: ConnectionState) => {
    setConnectionState(newConnectionState);
  }, []);

  const handleError = useCallback((error: any) => {
    logger.error('LOBBY', 'Lobby error', error);
    Alert.alert('Error', error.message || 'An unexpected error occurred');
  }, []);

  const handleScenarioStarted = useCallback((data: any) => {
    onCampaignStart(data.campaign.campaignId, data.scenario.scenarioId);
  }, [onCampaignStart]);

  const handleAchievementUnlocked = useCallback((achievement: any) => {
    Alert.alert(
      '🏆 Achievement Unlocked!',
      `${achievement.name}\n${achievement.description}`,
      [{ text: 'Awesome!', style: 'default' }]
    );
    
    // Refresh achievements
    setAchievements(achievementManager.getAchievementsWithProgress());
    setAchievementStats(achievementManager.getAchievementStatistics());
  }, []);

  // Action handlers
  const handleCreateSession = async () => {
    if (!sessionName.trim()) {
      Alert.alert('Error', 'Please enter a session name');
      return;
    }

    const settings: SessionSettings = {
      gameMode,
      timeControl,
      allowSpectators,
      allowReconnect: true,
      autoStart: false
    };

    const session = await sessionManager.createSession(sessionName, settings, isPrivate);
    if (!session) {
      Alert.alert('Error', 'Failed to create session');
    }
  };

  const handleJoinSession = async (sessionId: string) => {
    const success = await sessionManager.joinSession(sessionId);
    if (!success) {
      Alert.alert('Error', 'Failed to join session');
    }
  };

  const handleQuickMatch = async () => {
    setIsMatchmaking(true);
    
    try {
      const success = await sessionManager.findQuickMatch({
        gameMode: GameMode.CLASSIC,
        timeControl: { type: 'per_turn', timePerTurn: 300 }
      });
      
      if (!success) {
        Alert.alert('No Match Found', 'No suitable matches found. Try creating your own game!');
      }
    } finally {
      setIsMatchmaking(false);
    }
  };

  const handleStartSession = async () => {
    if (!currentSession) return;
    
    const success = await sessionManager.startSession();
    if (!success) {
      Alert.alert('Error', 'Failed to start session');
    }
  };

  const handleLeaveSession = async () => {
    await sessionManager.leaveSession();
    setCurrentSession(null);
  };

  const handleAddAI = async () => {
    if (!currentSession) return;
    
    // Show AI difficulty selection
    Alert.alert(
      'Add AI Opponent',
      'Select AI difficulty',
      [
        { text: 'Beginner', onPress: () => sessionManager.addAIOpponent('beginner') },
        { text: 'Intermediate', onPress: () => sessionManager.addAIOpponent('intermediate') },
        { text: 'Advanced', onPress: () => sessionManager.addAIOpponent('advanced') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleStartCampaign = async (campaignId: string, scenarioId: string) => {
    const success = await campaignManager.startScenario(campaignId, scenarioId);
    if (!success) {
      Alert.alert('Error', 'Failed to start scenario');
    }
  };

  // Render methods
  const renderMultiplayerTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Connection Status */}
      <View style={styles.connectionStatus}>
        <View style={[
          styles.connectionIndicator,
          { backgroundColor: connectionState.isConnected ? '#00ff00' : '#ff0000' }
        ]} />
        <Text style={styles.connectionText}>
          {connectionState.isConnected ? 'Connected' : 'Disconnected'}
          {connectionState.ping > 0 && ` (${connectionState.ping}ms)`}
        </Text>
      </View>

      {/* Current Session */}
      {currentSession ? (
        <View style={styles.currentSession}>
          <Text style={styles.sectionTitle}>Current Session</Text>
          <View style={styles.sessionCard}>
            <Text style={styles.sessionName}>{currentSession.gameId}</Text>
            <Text style={styles.sessionInfo}>
              Players: {currentSession.players.size}/{currentSession.maxPlayers}
            </Text>
            <Text style={styles.sessionInfo}>
              Status: {currentSession.status}
            </Text>
            <Text style={styles.sessionInfo}>
              Mode: {currentSession.settings.gameMode}
            </Text>
            
            <View style={styles.sessionActions}>
              {sessionManager.isSessionHost() && currentSession.status === GameSessionStatus.WAITING && (
                <>
                  <TouchableOpacity style={styles.actionButton} onPress={handleStartSession}>
                    <Text style={styles.actionButtonText}>Start Game</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryButton} onPress={handleAddAI}>
                    <Text style={styles.secondaryButtonText}>Add AI</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={styles.dangerButton} onPress={handleLeaveSession}>
                <Text style={styles.dangerButtonText}>Leave</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <>
          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={[styles.quickActionButton, isMatchmaking && styles.disabledButton]} 
              onPress={handleQuickMatch}
              disabled={isMatchmaking}
            >
              <Text style={styles.quickActionText}>
                {isMatchmaking ? 'Finding Match...' : '⚡ Quick Match'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.quickActionButton} onPress={() => setShowCreateSession(true)}>
              <Text style={styles.quickActionText}>🎮 Create Game</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.quickActionButton} onPress={() => handleStartAIPractice()}>
              <Text style={styles.quickActionText}>🤖 AI Practice</Text>
            </TouchableOpacity>
          </View>

          {/* Available Sessions */}
          <View style={styles.availableSessions}>
            <Text style={styles.sectionTitle}>Available Games</Text>
            {availableSessions.length === 0 ? (
              <Text style={styles.emptyText}>No games available. Create one!</Text>
            ) : (
              availableSessions.map(session => (
                <TouchableOpacity
                  key={session.sessionId}
                  style={styles.sessionCard}
                  onPress={() => handleJoinSession(session.sessionId)}
                >
                  <Text style={styles.sessionName}>{session.gameId}</Text>
                  <Text style={styles.sessionInfo}>
                    Players: {session.players.size}/{session.maxPlayers}
                  </Text>
                  <Text style={styles.sessionInfo}>Mode: {session.settings.gameMode}</Text>
                  <Text style={styles.sessionInfo}>Status: {session.status}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );

  const renderCampaignTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Campaign Mode</Text>
      
      {campaigns.map(campaign => (
        <View key={campaign.campaignId} style={styles.campaignCard}>
          <Text style={styles.campaignName}>{campaign.name}</Text>
          <Text style={styles.campaignDescription}>{campaign.description}</Text>
          
          <Text style={styles.campaignProgress}>
            Progress: {campaignManager.getCampaignProgress(campaign.campaignId)?.completedScenarios || 0}/
            {campaign.scenarios.length} scenarios
          </Text>
          
          {campaign.isUnlocked ? (
            <TouchableOpacity
              style={styles.campaignButton}
              onPress={() => setSelectedCampaign(
                selectedCampaign === campaign.campaignId ? null : campaign.campaignId
              )}
            >
              <Text style={styles.campaignButtonText}>
                {selectedCampaign === campaign.campaignId ? 'Hide Scenarios' : 'View Scenarios'}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.lockedText}>🔒 Locked</Text>
          )}
          
          {selectedCampaign === campaign.campaignId && (
            <View style={styles.scenarioList}>
              {campaign.scenarios.map(scenario => (
                <TouchableOpacity
                  key={scenario.scenarioId}
                  style={styles.scenarioCard}
                  onPress={() => handleStartCampaign(campaign.campaignId, scenario.scenarioId)}
                >
                  <Text style={styles.scenarioName}>{scenario.name}</Text>
                  <Text style={styles.scenarioDescription}>{scenario.description}</Text>
                  <Text style={styles.scenarioDifficulty}>Difficulty: {scenario.difficulty}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );

  const renderAchievementsTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Achievements</Text>
      
      <View style={styles.achievementStats}>
        <Text style={styles.statText}>
          Unlocked: {achievementStats.unlockedAchievements}/{achievementStats.totalAchievements}
        </Text>
        <Text style={styles.statText}>
          Progress: {achievementStats.unlockedPercentage.toFixed(1)}%
        </Text>
      </View>
      
      {achievements.map(achievement => (
        <View
          key={achievement.achievementId}
          style={[
            styles.achievementCard,
            achievementManager.isAchievementUnlocked(achievement.achievementId) && styles.unlockedAchievement
          ]}
        >
          <Text style={styles.achievementName}>{achievement.name}</Text>
          <Text style={styles.achievementDescription}>{achievement.description}</Text>
          <Text style={styles.achievementRarity}>{achievement.rarity}</Text>
          
          {achievement.progress && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                {achievement.progress.current}/{achievement.progress.target}
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${achievement.progress.percentage}%` }
                  ]}
                />
              </View>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );

  const handleStartAIPractice = () => {
    // Show AI opponent selection
    const aiOpponents = AIOpponentFactory.getAllOpponents();
    
    Alert.alert(
      'AI Practice',
      'Choose your opponent',
      aiOpponents.map(ai => ({
        text: `${ai.name} (${ai.difficulty})`,
        onPress: () => startAIPractice(ai.aiId)
      })).concat([{ text: 'Cancel', style: 'cancel' }])
    );
  };

  const startAIPractice = async (aiId: string) => {
    const settings: SessionSettings = {
      gameMode: GameMode.AI_PRACTICE,
      timeControl: { type: 'none' },
      allowSpectators: false,
      allowReconnect: true,
      autoStart: true
    };

    const session = await sessionManager.createSession('AI Practice', settings, true);
    if (session) {
      await sessionManager.addAIOpponent(aiId);
    }
  };

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
          style={[styles.tab, activeTab === 'campaign' && styles.activeTab]}
          onPress={() => setActiveTab('campaign')}
        >
          <Text style={[styles.tabText, activeTab === 'campaign' && styles.activeTabText]}>
            Campaign
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
      {activeTab === 'campaign' && renderCampaignTab()}
      {activeTab === 'achievements' && renderAchievementsTab()}

      {/* Create Session Modal */}
      <Modal visible={showCreateSession} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Game Session</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Session Name"
              value={sessionName}
              onChangeText={setSessionName}
              placeholderTextColor="#666"
            />
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Private Game</Text>
              <Switch value={isPrivate} onValueChange={setIsPrivate} />
            </View>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Allow Spectators</Text>
              <Switch value={allowSpectators} onValueChange={setAllowSpectators} />
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={handleCreateSession}>
                <Text style={styles.modalButtonText}>Create</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalCancelButton} 
                onPress={() => setShowCreateSession(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
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
  
  quickActions: {
    marginBottom: 24,
  },
  
  quickActionButton: {
    backgroundColor: '#4ECDC4',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  
  disabledButton: {
    backgroundColor: '#666',
  },
  
  quickActionText: {
    color: '#0a0a0a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  currentSession: {
    marginBottom: 24,
  },
  
  sessionCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  
  sessionName: {
    color: '#4ECDC4',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  
  sessionInfo: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 4,
  },
  
  sessionActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  
  actionButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  
  actionButtonText: {
    color: '#0a0a0a',
    fontWeight: 'bold',
  },
  
  secondaryButton: {
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  
  secondaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  
  dangerButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  
  dangerButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  
  availableSessions: {
    marginBottom: 24,
  },
  
  emptyText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  campaignCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  
  campaignName: {
    color: '#4ECDC4',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  
  campaignDescription: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
  },
  
  campaignProgress: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 12,
  },
  
  campaignButton: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  
  campaignButtonText: {
    color: '#4ECDC4',
    fontWeight: 'bold',
  },
  
  lockedText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  scenarioList: {
    marginTop: 12,
  },
  
  scenarioCard: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  
  scenarioName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  
  scenarioDescription: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 4,
  },
  
  scenarioDifficulty: {
    color: '#aaa',
    fontSize: 10,
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
  
  unlockedAchievement: {
    borderColor: '#4ECDC4',
    backgroundColor: '#1a2a2a',
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
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  modalContent: {
    backgroundColor: '#1a1a1a',
    padding: 24,
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
  },
  
  modalTitle: {
    color: '#4ECDC4',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  
  input: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
  },
  
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  
  settingLabel: {
    color: '#ccc',
    fontSize: 16,
  },
  
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  
  modalButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  
  modalButtonText: {
    color: '#0a0a0a',
    fontWeight: 'bold',
    fontSize: 16,
  },
  
  modalCancelButton: {
    backgroundColor: '#333',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  
  modalCancelText: {
    color: '#ccc',
    fontWeight: 'bold',
    fontSize: 16,
  },
});