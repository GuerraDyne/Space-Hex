/**
 * SessionManager - Manages game sessions, lobbies, and matchmaking
 */

import { 
  GameSession, 
  PlayerSession, 
  GameSessionStatus, 
  SessionSettings,
  GameMode,
  TimeControl,
  MatchmakingCriteria,
  LobbyState
} from '../multiplayer/types';
import { PlayerId } from '../game/core/Types';
import { multiplayerService } from './MultiplayerService';
import { logger } from '../utils/Logger';

export class SessionManager {
  private lobbyState: LobbyState = {
    availableSessions: [],
    joinedSession: null,
    connectionState: {
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0,
      ping: 0
    }
  };

  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Initialize the session manager
   */
  async initialize(playerName: string, playerId: PlayerId): Promise<boolean> {
    try {
      const connected = await multiplayerService.connect(playerName, playerId);
      if (connected) {
        await this.refreshLobby();
        logger.info('SESSION', 'Session manager initialized successfully');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('SESSION', 'Failed to initialize session manager', error);
      return false;
    }
  }

  /**
   * Create a new game session
   */
  async createSession(
    sessionName: string,
    settings: SessionSettings,
    isPrivate = false
  ): Promise<GameSession | null> {
    try {
      logger.info('SESSION', 'Creating new session', { sessionName, settings, isPrivate });

      const sessionData = {
        name: sessionName,
        settings,
        isPrivate,
        maxPlayers: settings.gameMode === GameMode.AI_PRACTICE ? 1 : 4
      };

      // Send create session request to server
      const response = await this.sendRequest('create_session', sessionData);
      
      if (response.success) {
        const session: GameSession = response.data;
        this.lobbyState.joinedSession = session;
        this.emit('session-created', session);
        logger.info('SESSION', 'Session created successfully', { sessionId: session.sessionId });
        return session;
      } else {
        logger.error('SESSION', 'Failed to create session', response.error);
        return null;
      }
    } catch (error) {
      logger.error('SESSION', 'Error creating session', error);
      return null;
    }
  }

  /**
   * Join an existing session
   */
  async joinSession(sessionId: string, spectateOnly = false): Promise<boolean> {
    try {
      const session = this.findSessionById(sessionId);
      if (!session) {
        logger.error('SESSION', 'Session not found', { sessionId });
        return false;
      }

      if (!spectateOnly && session.players.size >= session.maxPlayers) {
        logger.error('SESSION', 'Session is full', { sessionId });
        return false;
      }

      const success = await multiplayerService.joinSession(
        sessionId, 
        'current_player_name', // Would be actual player name
        spectateOnly
      );

      if (success) {
        this.lobbyState.joinedSession = session;
        this.emit('session-joined', session);
        logger.info('SESSION', 'Joined session successfully', { sessionId, spectateOnly });
      }

      return success;
    } catch (error) {
      logger.error('SESSION', 'Error joining session', { sessionId, error });
      return false;
    }
  }

  /**
   * Leave the current session
   */
  async leaveSession(): Promise<void> {
    try {
      if (!this.lobbyState.joinedSession) {
        logger.warn('SESSION', 'No session to leave');
        return;
      }

      const sessionId = this.lobbyState.joinedSession.sessionId;
      await multiplayerService.leaveSession();
      
      this.lobbyState.joinedSession = null;
      this.emit('session-left', sessionId);
      
      logger.info('SESSION', 'Left session successfully', { sessionId });
    } catch (error) {
      logger.error('SESSION', 'Error leaving session', error);
    }
  }

  /**
   * Start the current session
   */
  async startSession(): Promise<boolean> {
    try {
      const session = this.lobbyState.joinedSession;
      if (!session) {
        logger.error('SESSION', 'No session to start');
        return false;
      }

      if (session.status !== GameSessionStatus.WAITING) {
        logger.error('SESSION', 'Session is not in waiting status', { 
          status: session.status 
        });
        return false;
      }

      const response = await this.sendRequest('start_session', {
        sessionId: session.sessionId
      });

      if (response.success) {
        logger.info('SESSION', 'Session started successfully', { 
          sessionId: session.sessionId 
        });
        return true;
      } else {
        logger.error('SESSION', 'Failed to start session', response.error);
        return false;
      }
    } catch (error) {
      logger.error('SESSION', 'Error starting session', error);
      return false;
    }
  }

  /**
   * Find and join a quick match
   */
  async findQuickMatch(criteria: MatchmakingCriteria): Promise<boolean> {
    try {
      logger.info('SESSION', 'Starting quick match search', criteria);

      const response = await this.sendRequest('find_match', criteria);
      
      if (response.success) {
        const sessionId = response.data.sessionId;
        return await this.joinSession(sessionId);
      } else {
        logger.error('SESSION', 'No suitable match found', response.error);
        return false;
      }
    } catch (error) {
      logger.error('SESSION', 'Error finding quick match', error);
      return false;
    }
  }

  /**
   * Cancel matchmaking
   */
  async cancelMatchmaking(): Promise<void> {
    try {
      await this.sendRequest('cancel_matchmaking', {});
      logger.info('SESSION', 'Matchmaking cancelled');
    } catch (error) {
      logger.error('SESSION', 'Error cancelling matchmaking', error);
    }
  }

  /**
   * Refresh the lobby with available sessions
   */
  async refreshLobby(): Promise<void> {
    try {
      const response = await this.sendRequest('get_lobby', {});
      
      if (response.success) {
        this.lobbyState.availableSessions = response.data.sessions || [];
        this.emit('lobby-updated', this.lobbyState);
        logger.debug('SESSION', 'Lobby refreshed', { 
          sessionCount: this.lobbyState.availableSessions.length 
        });
      }
    } catch (error) {
      logger.error('SESSION', 'Error refreshing lobby', error);
    }
  }

  /**
   * Invite a player to the current session
   */
  async invitePlayer(playerId: PlayerId): Promise<boolean> {
    try {
      const session = this.lobbyState.joinedSession;
      if (!session) {
        logger.error('SESSION', 'No session to invite player to');
        return false;
      }

      const response = await this.sendRequest('invite_player', {
        sessionId: session.sessionId,
        playerId
      });

      if (response.success) {
        logger.info('SESSION', 'Player invited successfully', { playerId });
        return true;
      } else {
        logger.error('SESSION', 'Failed to invite player', response.error);
        return false;
      }
    } catch (error) {
      logger.error('SESSION', 'Error inviting player', { playerId, error });
      return false;
    }
  }

  /**
   * Kick a player from the current session
   */
  async kickPlayer(playerId: PlayerId): Promise<boolean> {
    try {
      const session = this.lobbyState.joinedSession;
      if (!session) {
        logger.error('SESSION', 'No session to kick player from');
        return false;
      }

      const response = await this.sendRequest('kick_player', {
        sessionId: session.sessionId,
        playerId
      });

      if (response.success) {
        logger.info('SESSION', 'Player kicked successfully', { playerId });
        return true;
      } else {
        logger.error('SESSION', 'Failed to kick player', response.error);
        return false;
      }
    } catch (error) {
      logger.error('SESSION', 'Error kicking player', { playerId, error });
      return false;
    }
  }

  /**
   * Update session settings (host only)
   */
  async updateSessionSettings(settings: Partial<SessionSettings>): Promise<boolean> {
    try {
      const session = this.lobbyState.joinedSession;
      if (!session) {
        logger.error('SESSION', 'No session to update');
        return false;
      }

      const response = await this.sendRequest('update_session', {
        sessionId: session.sessionId,
        settings
      });

      if (response.success) {
        logger.info('SESSION', 'Session settings updated', settings);
        return true;
      } else {
        logger.error('SESSION', 'Failed to update session settings', response.error);
        return false;
      }
    } catch (error) {
      logger.error('SESSION', 'Error updating session settings', error);
      return false;
    }
  }

  /**
   * Add AI opponent to session
   */
  async addAIOpponent(difficulty: string): Promise<boolean> {
    try {
      const session = this.lobbyState.joinedSession;
      if (!session) {
        logger.error('SESSION', 'No session to add AI to');
        return false;
      }

      const response = await this.sendRequest('add_ai', {
        sessionId: session.sessionId,
        difficulty
      });

      if (response.success) {
        logger.info('SESSION', 'AI opponent added', { difficulty });
        return true;
      } else {
        logger.error('SESSION', 'Failed to add AI opponent', response.error);
        return false;
      }
    } catch (error) {
      logger.error('SESSION', 'Error adding AI opponent', error);
      return false;
    }
  }

  /**
   * Get current lobby state
   */
  getLobbyState(): LobbyState {
    return { ...this.lobbyState };
  }

  /**
   * Get current session
   */
  getCurrentSession(): GameSession | null {
    return this.lobbyState.joinedSession;
  }

  /**
   * Check if player is session host
   */
  isSessionHost(): boolean {
    const session = this.lobbyState.joinedSession;
    if (!session) return false;
    
    // Would check against current player ID
    return true; // Placeholder
  }

  /**
   * Get available game modes
   */
  getAvailableGameModes(): GameMode[] {
    return [
      GameMode.CLASSIC,
      GameMode.BLITZ,
      GameMode.AI_PRACTICE,
      GameMode.CUSTOM
    ];
  }

  /**
   * Get default time controls for game modes
   */
  getTimeControlPresets(): Record<GameMode, TimeControl[]> {
    return {
      [GameMode.CLASSIC]: [
        { type: 'none' },
        { type: 'per_turn', timePerTurn: 300 }, // 5 minutes per turn
        { type: 'total_game', totalTime: 1800, increment: 30 } // 30 min + 30s increment
      ],
      [GameMode.BLITZ]: [
        { type: 'per_turn', timePerTurn: 60 }, // 1 minute per turn
        { type: 'total_game', totalTime: 600, increment: 10 } // 10 min + 10s increment
      ],
      [GameMode.AI_PRACTICE]: [
        { type: 'none' },
        { type: 'per_turn', timePerTurn: 600 } // 10 minutes for learning
      ],
      [GameMode.CUSTOM]: [
        { type: 'none' },
        { type: 'per_turn', timePerTurn: 300 },
        { type: 'total_game', totalTime: 1800, increment: 30 }
      ]
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

  private setupEventListeners(): void {
    multiplayerService.on('session-updated', (session: GameSession) => {
      if (this.lobbyState.joinedSession?.sessionId === session.sessionId) {
        this.lobbyState.joinedSession = session;
      }
      
      // Update in available sessions list
      const index = this.lobbyState.availableSessions.findIndex(
        s => s.sessionId === session.sessionId
      );
      if (index >= 0) {
        this.lobbyState.availableSessions[index] = session;
      }
      
      this.emit('session-updated', session);
    });

    multiplayerService.on('player-joined', (player: PlayerSession) => {
      this.emit('player-joined', player);
    });

    multiplayerService.on('player-left', (playerId: PlayerId) => {
      this.emit('player-left', playerId);
    });

    multiplayerService.on('connection-changed', (connectionState) => {
      this.lobbyState.connectionState = connectionState;
      this.emit('connection-changed', connectionState);
    });

    multiplayerService.on('error', (error) => {
      this.emit('error', error);
    });
  }

  private findSessionById(sessionId: string): GameSession | null {
    return this.lobbyState.availableSessions.find(s => s.sessionId === sessionId) || null;
  }

  private async sendRequest(endpoint: string, data: any): Promise<any> {
    // This would make HTTP requests to the game server
    // For now, return mock responses
    logger.debug('SESSION', 'Sending request', { endpoint, data });
    
    // Mock successful responses
    switch (endpoint) {
      case 'create_session':
        return {
          success: true,
          data: {
            sessionId: `session_${Date.now()}`,
            gameId: `game_${Date.now()}`,
            hostPlayerId: 'current_player',
            players: new Map(),
            spectators: new Map(),
            isPrivate: data.isPrivate,
            maxPlayers: data.maxPlayers,
            status: GameSessionStatus.WAITING,
            createdAt: Date.now(),
            settings: data.settings
          }
        };
      
      case 'get_lobby':
        return {
          success: true,
          data: {
            sessions: []
          }
        };
      
      default:
        return {
          success: true,
          data: {}
        };
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          logger.error('SESSION', 'Error in event listener', { event, error });
        }
      });
    }
  }
}

// Singleton instance
export const sessionManager = new SessionManager();