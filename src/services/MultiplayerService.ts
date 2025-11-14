/**
 * MultiplayerService - Core networking service for real-time multiplayer
 * Handles WebSocket connections, session management, and message routing
 */

import { io, Socket } from 'socket.io-client';
import { 
  NetworkMessage, 
  MessageType, 
  GameSession, 
  PlayerSession,
  ConnectionState,
  MultiplayerEvents,
  MultiplayerError,
  ErrorCode,
  JoinSessionMessage,
  ShipMoveMessage,
  StateSyncMessage,
  ChatMessage,
  EmoteMessage,
  GameSessionStatus
} from '../multiplayer/types';
import { GameState, PlayerId } from '../game/core/Types';
import { logger } from '../utils/Logger';

export class MultiplayerService {
  private socket: Socket | null = null;
  private currentSession: GameSession | null = null;
  private connectionState: ConnectionState = {
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0,
    ping: 0
  };
  private eventListeners: Map<keyof MultiplayerEvents, Set<Function>> = new Map();
  private messageQueue: NetworkMessage[] = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  // Configuration
  private readonly serverUrl: string;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 2000;
  private readonly heartbeatInterval_ms = 30000;

  constructor(serverUrl: string = 'ws://localhost:3001') {
    this.serverUrl = serverUrl;
    this.setupEventListeners();
  }

  /**
   * Connect to the multiplayer server
   */
  async connect(playerName: string, playerId: PlayerId): Promise<boolean> {
    if (this.connectionState.isConnected || this.connectionState.isConnecting) {
      logger.warn('MULTIPLAYER', 'Already connected or connecting');
      return true;
    }

    try {
      this.setConnectionState({ 
        ...this.connectionState, 
        isConnecting: true 
      });

      logger.info('MULTIPLAYER', 'Connecting to server', { serverUrl: this.serverUrl });

      this.socket = io(this.serverUrl, {
        timeout: 10000,
        autoConnect: false,
        auth: {
          playerName,
          playerId
        }
      });

      this.setupSocketListeners();
      this.socket.connect();

      // Wait for connection or timeout
      const connected = await this.waitForConnection();
      
      if (connected) {
        this.startHeartbeat();
        this.processMessageQueue();
        logger.info('MULTIPLAYER', 'Connected to server successfully');
      }

      return connected;
    } catch (error) {
      logger.error('MULTIPLAYER', 'Connection failed', error);
      this.setConnectionState({ 
        ...this.connectionState, 
        isConnecting: false 
      });
      this.emitError(ErrorCode.CONNECTION_FAILED, 'Failed to connect to server', error);
      return false;
    }
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.stopHeartbeat();
    this.stopReconnect();
    
    this.setConnectionState({
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0,
      ping: 0
    });

    this.currentSession = null;
    logger.info('MULTIPLAYER', 'Disconnected from server');
  }

  /**
   * Join a game session
   */
  async joinSession(sessionId: string, playerName: string, spectateOnly = false): Promise<boolean> {
    if (!this.isConnected()) {
      this.emitError(ErrorCode.CONNECTION_FAILED, 'Not connected to server');
      return false;
    }

    try {
      const message: JoinSessionMessage = {
        sessionId,
        playerName,
        spectateOnly
      };

      const response = await this.sendMessage(MessageType.JOIN_SESSION, message);
      
      if (response.success) {
        logger.info('MULTIPLAYER', 'Joined session successfully', { sessionId });
        return true;
      } else {
        this.emitError(response.error.code, response.error.message);
        return false;
      }
    } catch (error) {
      logger.error('MULTIPLAYER', 'Failed to join session', { sessionId, error });
      this.emitError(ErrorCode.UNKNOWN_ERROR, 'Failed to join session', error);
      return false;
    }
  }

  /**
   * Leave the current session
   */
  async leaveSession(): Promise<void> {
    if (!this.currentSession) {
      logger.warn('MULTIPLAYER', 'No session to leave');
      return;
    }

    try {
      await this.sendMessage(MessageType.LEAVE_SESSION, {
        sessionId: this.currentSession.sessionId
      });

      this.currentSession = null;
      logger.info('MULTIPLAYER', 'Left session successfully');
    } catch (error) {
      logger.error('MULTIPLAYER', 'Failed to leave session', error);
    }
  }

  /**
   * Send a ship move to the server
   */
  async sendShipMove(shipId: string, targetHex: any, moveId: string): Promise<boolean> {
    if (!this.currentSession) {
      this.emitError(ErrorCode.SESSION_NOT_FOUND, 'No active session');
      return false;
    }

    const message: ShipMoveMessage = {
      shipId,
      targetHex,
      moveId
    };

    try {
      const response = await this.sendMessage(MessageType.SHIP_MOVE, message);
      return response.success;
    } catch (error) {
      logger.error('MULTIPLAYER', 'Failed to send ship move', { shipId, targetHex, error });
      return false;
    }
  }

  /**
   * Request game state synchronization
   */
  async requestStateSync(): Promise<void> {
    if (!this.currentSession) return;

    try {
      await this.sendMessage(MessageType.STATE_REQUEST, {
        sessionId: this.currentSession.sessionId
      });
    } catch (error) {
      logger.error('MULTIPLAYER', 'Failed to request state sync', error);
    }
  }

  /**
   * Send a chat message
   */
  async sendChatMessage(message: string, isPublic = true, targetPlayerId?: PlayerId): Promise<void> {
    if (!this.currentSession) return;

    const chatMessage: ChatMessage = {
      message,
      isPublic,
      targetPlayerId
    };

    try {
      await this.sendMessage(MessageType.CHAT_MESSAGE, chatMessage);
    } catch (error) {
      logger.error('MULTIPLAYER', 'Failed to send chat message', error);
    }
  }

  /**
   * Send an emote
   */
  async sendEmote(emoteId: string, targetHex?: any): Promise<void> {
    if (!this.currentSession) return;

    const emoteMessage: EmoteMessage = {
      emoteId,
      targetHex
    };

    try {
      await this.sendMessage(MessageType.EMOTE, emoteMessage);
    } catch (error) {
      logger.error('MULTIPLAYER', 'Failed to send emote', error);
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Get current session
   */
  getCurrentSession(): GameSession | null {
    return this.currentSession;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState.isConnected && this.socket?.connected === true;
  }

  /**
   * Add event listener
   */
  on<K extends keyof MultiplayerEvents>(event: K, listener: MultiplayerEvents[K]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof MultiplayerEvents>(event: K, listener: MultiplayerEvents[K]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.eventListeners.clear();
  }

  // Private methods

  private setupEventListeners(): void {
    // Setup default event listeners for the service
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      logger.info('MULTIPLAYER', 'Socket connected');
      this.setConnectionState({
        ...this.connectionState,
        isConnected: true,
        isConnecting: false,
        reconnectAttempts: 0,
        lastConnected: Date.now()
      });
    });

    this.socket.on('disconnect', (reason) => {
      logger.warn('MULTIPLAYER', 'Socket disconnected', { reason });
      this.setConnectionState({
        ...this.connectionState,
        isConnected: false,
        isConnecting: false
      });

      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect automatically
        this.currentSession = null;
      } else {
        // Connection lost, attempt to reconnect
        this.attemptReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      logger.error('MULTIPLAYER', 'Connection error', error);
      this.setConnectionState({
        ...this.connectionState,
        isConnected: false,
        isConnecting: false
      });
    });

    // Game messages
    this.socket.on('message', (data: NetworkMessage) => {
      this.handleMessage(data);
    });

    // Session updates
    this.socket.on('session_update', (session: GameSession) => {
      this.currentSession = session;
      this.emit('session-updated', session);
    });

    // Player events
    this.socket.on('player_joined', (player: PlayerSession) => {
      this.emit('player-joined', player);
    });

    this.socket.on('player_left', (playerId: PlayerId) => {
      this.emit('player-left', playerId);
    });

    // Game state sync
    this.socket.on('state_sync', (data: StateSyncMessage) => {
      this.emit('game-started', data.gameState);
    });

    // Chat
    this.socket.on('chat_message', (data: any) => {
      this.emit('chat-received', data);
    });

    // Pong for heartbeat
    this.socket.on('pong', (timestamp: number) => {
      const ping = Date.now() - timestamp;
      this.setConnectionState({
        ...this.connectionState,
        ping
      });
    });

    // Error handling
    this.socket.on('error', (error: any) => {
      logger.error('MULTIPLAYER', 'Socket error', error);
      this.emitError(ErrorCode.UNKNOWN_ERROR, 'Socket error', error);
    });
  }

  private async waitForConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve(false);
        return;
      }

      const timeout = setTimeout(() => {
        resolve(false);
      }, 10000);

      this.socket.once('connect', () => {
        clearTimeout(timeout);
        resolve(true);
      });

      this.socket.once('connect_error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  }

  private async sendMessage(type: MessageType, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected()) {
        // Queue message if not connected
        const message: NetworkMessage = {
          id: this.generateMessageId(),
          type,
          senderId: 'current_player', // Would be set properly
          sessionId: this.currentSession?.sessionId || '',
          timestamp: Date.now(),
          data
        };
        this.messageQueue.push(message);
        reject(new Error('Not connected'));
        return;
      }

      const messageId = this.generateMessageId();
      const timeout = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, 10000);

      this.socket.emit('message', {
        id: messageId,
        type,
        data
      }, (response: any) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });
  }

  private handleMessage(message: NetworkMessage): void {
    logger.debug('MULTIPLAYER', 'Received message', { type: message.type });

    switch (message.type) {
      case MessageType.SHIP_MOVE:
        this.emit('move-received', message.data);
        break;
      case MessageType.GAME_START:
        this.emit('game-started', message.data);
        break;
      case MessageType.GAME_END:
        this.emit('game-ended', message.data);
        break;
      case MessageType.STATE_SYNC:
        this.emit('game-started', message.data.gameState);
        break;
      case MessageType.CHAT_MESSAGE:
        this.emit('chat-received', message.data);
        break;
      case MessageType.ERROR:
        this.emitError(message.data.code, message.data.message, message.data.details);
        break;
      default:
        logger.debug('MULTIPLAYER', 'Unhandled message type', { type: message.type });
    }
  }

  private processMessageQueue(): void {
    if (!this.isConnected()) return;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      this.sendMessage(message.type, message.data).catch(error => {
        logger.error('MULTIPLAYER', 'Failed to send queued message', { message, error });
      });
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.isConnected()) {
        this.socket.emit('ping', Date.now());
      }
    }, this.heartbeatInterval_ms);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this.connectionState.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('MULTIPLAYER', 'Max reconnect attempts reached');
      this.emitError(ErrorCode.CONNECTION_FAILED, 'Failed to reconnect after multiple attempts');
      return;
    }

    this.setConnectionState({
      ...this.connectionState,
      reconnectAttempts: this.connectionState.reconnectAttempts + 1,
      isConnecting: true
    });

    const delay = this.reconnectDelay * Math.pow(2, this.connectionState.reconnectAttempts - 1);
    logger.info('MULTIPLAYER', 'Attempting to reconnect', { 
      attempt: this.connectionState.reconnectAttempts,
      delay 
    });

    this.reconnectTimeout = setTimeout(() => {
      if (this.socket) {
        this.socket.connect();
      }
    }, delay);
  }

  private stopReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private setConnectionState(newState: ConnectionState): void {
    this.connectionState = newState;
    this.emit('connection-changed', newState);
  }

  private emit<K extends keyof MultiplayerEvents>(event: K, data: Parameters<MultiplayerEvents[K]>[0]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          (listener as any)(data);
        } catch (error) {
          logger.error('MULTIPLAYER', 'Error in event listener', { event, error });
        }
      });
    }
  }

  private emitError(code: ErrorCode, message: string, details?: any): void {
    const error: MultiplayerError = {
      code,
      message,
      details,
      recoverable: code !== ErrorCode.PERMISSION_DENIED
    };
    this.emit('error', error);
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const multiplayerService = new MultiplayerService();