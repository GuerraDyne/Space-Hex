/**
 * StateSyncManager - Handles game state synchronization across multiplayer clients
 * Ensures all players have consistent game state and handles conflict resolution
 */

import { GameState, PlayerId } from '../game/core/Types';
import { multiplayerService } from './MultiplayerService';
import { logger } from '../utils/Logger';

interface StateSync {
  sequenceNumber: number;
  gameState: GameState;
  checksum: string;
  timestamp: number;
  authorPlayerId: PlayerId;
}

interface PendingAction {
  actionId: string;
  playerId: PlayerId;
  action: any;
  timestamp: number;
  sequenceNumber: number;
}

interface SyncMetrics {
  lastSyncTime: number;
  syncLatency: number;
  desyncCount: number;
  conflictResolutions: number;
  checksumMismatches: number;
}

export class StateSyncManager {
  private currentState: GameState | null = null;
  private authoritative: boolean = false; // Is this client authoritative?
  private sequenceNumber: number = 0;
  private lastConfirmedSequence: number = 0;
  private pendingActions: Map<string, PendingAction> = new Map();
  private stateHistory: StateSync[] = [];
  private maxHistorySize: number = 100;
  private syncMetrics: SyncMetrics = {
    lastSyncTime: 0,
    syncLatency: 0,
    desyncCount: 0,
    conflictResolutions: 0,
    checksumMismatches: 0
  };
  private eventListeners: Map<string, Set<Function>> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly syncIntervalMs = 1000; // Sync every second
  private readonly maxRetries = 3;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Initialize the state sync manager
   */
  initialize(initialState: GameState, isAuthoritative = false): void {
    this.currentState = this.deepClone(initialState);
    this.authoritative = isAuthoritative;
    this.sequenceNumber = 0;
    this.lastConfirmedSequence = 0;
    this.pendingActions.clear();
    this.stateHistory = [];

    if (this.authoritative) {
      this.startSyncBroadcast();
    }

    logger.info('SYNC', 'State sync manager initialized', {
      isAuthoritative,
      initialSequence: this.sequenceNumber
    });

    this.emit('sync-initialized', { isAuthoritative, initialState });
  }

  /**
   * Apply a local action and broadcast to other clients
   */
  async applyLocalAction(action: any, playerId: PlayerId): Promise<boolean> {
    try {
      if (!this.currentState) {
        logger.error('SYNC', 'Cannot apply action - no current state');
        return false;
      }

      const actionId = this.generateActionId();
      const timestamp = Date.now();
      
      // Create pending action
      const pendingAction: PendingAction = {
        actionId,
        playerId,
        action,
        timestamp,
        sequenceNumber: this.sequenceNumber + 1
      };

      // Apply action optimistically to local state
      const newState = this.applyActionToState(this.currentState, action, playerId);
      if (!newState) {
        logger.error('SYNC', 'Failed to apply action to state', { action, playerId });
        return false;
      }

      // Store pending action
      this.pendingActions.set(actionId, pendingAction);

      // Update local state
      this.sequenceNumber++;
      this.currentState = newState;

      // Broadcast action to other clients
      if (this.authoritative) {
        await this.broadcastStateSync();
      } else {
        await this.sendActionToServer(pendingAction);
      }

      logger.debug('SYNC', 'Local action applied', {
        actionId,
        playerId,
        sequence: this.sequenceNumber
      });

      this.emit('action-applied', { action, playerId, sequence: this.sequenceNumber });
      return true;
    } catch (error) {
      logger.error('SYNC', 'Error applying local action', error);
      return false;
    }
  }

  /**
   * Handle incoming state sync from server/other clients
   */
  async handleIncomingSync(syncData: StateSync): Promise<void> {
    try {
      if (!this.currentState) {
        logger.warn('SYNC', 'Received sync but no current state');
        return;
      }

      // Verify checksum
      const expectedChecksum = this.calculateChecksum(syncData.gameState);
      if (syncData.checksum !== expectedChecksum) {
        this.syncMetrics.checksumMismatches++;
        logger.error('SYNC', 'Checksum mismatch detected', {
          expected: expectedChecksum,
          received: syncData.checksum,
          sequence: syncData.sequenceNumber
        });
        
        await this.requestStateResync();
        return;
      }

      // Check sequence order
      if (syncData.sequenceNumber <= this.lastConfirmedSequence) {
        logger.debug('SYNC', 'Received old sync, ignoring', {
          received: syncData.sequenceNumber,
          lastConfirmed: this.lastConfirmedSequence
        });
        return;
      }

      // Handle sequence gap
      if (syncData.sequenceNumber > this.lastConfirmedSequence + 1) {
        logger.warn('SYNC', 'Sequence gap detected', {
          received: syncData.sequenceNumber,
          expected: this.lastConfirmedSequence + 1
        });
        
        await this.requestStateResync();
        return;
      }

      // Apply the synchronized state
      await this.applySynchronizedState(syncData);

    } catch (error) {
      logger.error('SYNC', 'Error handling incoming sync', error);
      this.syncMetrics.desyncCount++;
    }
  }

  /**
   * Request full state resynchronization
   */
  async requestStateResync(): Promise<void> {
    try {
      if (!multiplayerService.isConnected()) {
        logger.warn('SYNC', 'Cannot request resync - not connected');
        return;
      }

      logger.info('SYNC', 'Requesting state resync');
      await multiplayerService.requestStateSync();
      
      this.emit('resync-requested', {});
    } catch (error) {
      logger.error('SYNC', 'Error requesting state resync', error);
    }
  }

  /**
   * Get current game state
   */
  getCurrentState(): GameState | null {
    return this.currentState ? this.deepClone(this.currentState) : null;
  }

  /**
   * Get synchronization metrics
   */
  getSyncMetrics(): SyncMetrics {
    return { ...this.syncMetrics };
  }

  /**
   * Check if state is synchronized
   */
  isSynchronized(): boolean {
    const now = Date.now();
    const timeSinceLastSync = now - this.syncMetrics.lastSyncTime;
    
    // Consider synchronized if last sync was within 5 seconds
    return timeSinceLastSync < 5000 && this.syncMetrics.desyncCount === 0;
  }

  /**
   * Get pending actions count
   */
  getPendingActionsCount(): number {
    return this.pendingActions.size;
  }

  /**
   * Force state synchronization
   */
  async forceSynchronization(): Promise<void> {
    if (this.authoritative) {
      await this.broadcastStateSync();
    } else {
      await this.requestStateResync();
    }
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

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.stopSyncBroadcast();
    this.eventListeners.clear();
    this.pendingActions.clear();
    this.stateHistory = [];
    this.currentState = null;
    
    logger.info('SYNC', 'State sync manager destroyed');
  }

  // Private methods

  private setupEventListeners(): void {
    multiplayerService.on('move-received', (moveData) => {
      this.handleRemoteAction(moveData);
    });

    multiplayerService.on('game-started', (gameState) => {
      this.handleStateSync({
        sequenceNumber: 0,
        gameState,
        checksum: this.calculateChecksum(gameState),
        timestamp: Date.now(),
        authorPlayerId: 'server'
      });
    });
  }

  private async applySynchronizedState(syncData: StateSync): Promise<void> {
    try {
      // Rollback any pending actions
      await this.rollbackPendingActions(syncData.sequenceNumber);

      // Apply the synchronized state
      this.currentState = this.deepClone(syncData.gameState);
      this.lastConfirmedSequence = syncData.sequenceNumber;
      this.syncMetrics.lastSyncTime = Date.now();
      this.syncMetrics.syncLatency = Date.now() - syncData.timestamp;

      // Store in history
      this.addToHistory(syncData);

      // Reapply any remaining pending actions
      await this.reapplyPendingActions();

      logger.debug('SYNC', 'State synchronized', {
        sequence: syncData.sequenceNumber,
        latency: this.syncMetrics.syncLatency
      });

      this.emit('state-synchronized', {
        gameState: this.currentState,
        sequence: syncData.sequenceNumber
      });
    } catch (error) {
      logger.error('SYNC', 'Error applying synchronized state', error);
      throw error;
    }
  }

  private async rollbackPendingActions(toSequence: number): Promise<void> {
    const actionsToRollback = Array.from(this.pendingActions.values())
      .filter(action => action.sequenceNumber > toSequence)
      .sort((a, b) => b.sequenceNumber - a.sequenceNumber); // Reverse order

    for (const action of actionsToRollback) {
      // Remove from pending actions
      this.pendingActions.delete(action.actionId);
      logger.debug('SYNC', 'Rolled back pending action', {
        actionId: action.actionId,
        sequence: action.sequenceNumber
      });
    }
  }

  private async reapplyPendingActions(): Promise<void> {
    const actionsToReapply = Array.from(this.pendingActions.values())
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber); // Forward order

    for (const pendingAction of actionsToReapply) {
      if (this.currentState) {
        const newState = this.applyActionToState(
          this.currentState,
          pendingAction.action,
          pendingAction.playerId
        );
        
        if (newState) {
          this.currentState = newState;
          this.sequenceNumber = pendingAction.sequenceNumber;
        } else {
          // Action no longer valid, remove it
          this.pendingActions.delete(pendingAction.actionId);
        }
      }
    }
  }

  private async handleRemoteAction(actionData: any): Promise<void> {
    try {
      if (!this.currentState) return;

      // Apply the remote action
      const newState = this.applyActionToState(
        this.currentState,
        actionData.action,
        actionData.playerId
      );

      if (newState) {
        this.currentState = newState;
        this.sequenceNumber++;
        
        // Remove any conflicting pending actions
        this.resolvePendingActionConflicts(actionData);

        logger.debug('SYNC', 'Remote action applied', {
          playerId: actionData.playerId,
          sequence: this.sequenceNumber
        });

        this.emit('remote-action-applied', actionData);
      }
    } catch (error) {
      logger.error('SYNC', 'Error handling remote action', error);
    }
  }

  private resolvePendingActionConflicts(remoteAction: any): void {
    // Find and remove conflicting pending actions
    const conflictingActions: string[] = [];

    this.pendingActions.forEach((pendingAction, actionId) => {
      if (this.actionsConflict(pendingAction.action, remoteAction.action)) {
        conflictingActions.push(actionId);
      }
    });

    conflictingActions.forEach(actionId => {
      this.pendingActions.delete(actionId);
      this.syncMetrics.conflictResolutions++;
      logger.debug('SYNC', 'Resolved pending action conflict', { actionId });
    });
  }

  private actionsConflict(action1: any, action2: any): boolean {
    // Simplified conflict detection
    // In a real implementation, this would check for specific conflicts
    // like moving the same ship, occupying the same hex, etc.
    
    if (action1.type === 'ship_move' && action2.type === 'ship_move') {
      return action1.shipId === action2.shipId;
    }
    
    if (action1.type === 'mothership_move' && action2.type === 'mothership_move') {
      return action1.playerId === action2.playerId;
    }

    return false;
  }

  private applyActionToState(state: GameState, action: any, playerId: PlayerId): GameState | null {
    try {
      // Create a deep copy of the state
      const newState = this.deepClone(state);

      // Apply the action based on its type
      switch (action.type) {
        case 'ship_move':
          return this.applyShipMove(newState, action, playerId);
        case 'mothership_move':
          return this.applyMothershipMove(newState, action, playerId);
        case 'end_turn':
          return this.applyEndTurn(newState, playerId);
        default:
          logger.warn('SYNC', 'Unknown action type', { type: action.type });
          return null;
      }
    } catch (error) {
      logger.error('SYNC', 'Error applying action to state', error);
      return null;
    }
  }

  private applyShipMove(state: GameState, action: any, playerId: PlayerId): GameState | null {
    // Simplified ship move application
    // In a real implementation, this would use the game controller
    const player = state.players.get(playerId);
    if (!player) return null;

    const ship = player.ships.get(action.shipId);
    if (!ship) return null;

    // Update ship position
    ship.position = action.targetHex;
    
    // Update turn state
    state.movesThisTurn.otherShipMoved = true;

    return state;
  }

  private applyMothershipMove(state: GameState, action: any, playerId: PlayerId): GameState | null {
    // Simplified mothership move application
    const player = state.players.get(playerId);
    if (!player || !player.mothership) return null;

    // Update mothership position
    player.mothership.dockPosition = action.targetHex;
    
    // Update turn state
    state.movesThisTurn.mothershipMoved = true;

    return state;
  }

  private applyEndTurn(state: GameState, playerId: PlayerId): GameState | null {
    if (state.currentPlayerId !== playerId) return null;

    // Advance to next player
    const playerIds = Array.from(state.players.keys());
    const currentIndex = playerIds.indexOf(playerId);
    const nextIndex = (currentIndex + 1) % playerIds.length;
    
    state.currentPlayerId = playerIds[nextIndex];
    
    // Reset turn state
    state.movesThisTurn = {
      mothershipMoved: false,
      otherShipMoved: false
    };

    // Increment turn if back to first player
    if (nextIndex === 0) {
      state.turn++;
    }

    return state;
  }

  private async broadcastStateSync(): Promise<void> {
    if (!this.currentState || !this.authoritative) return;

    try {
      const syncData: StateSync = {
        sequenceNumber: this.sequenceNumber,
        gameState: this.currentState,
        checksum: this.calculateChecksum(this.currentState),
        timestamp: Date.now(),
        authorPlayerId: 'server' // Would be actual player ID
      };

      // Broadcast to all clients
      // This would use the multiplayer service to send the sync
      logger.debug('SYNC', 'Broadcasting state sync', {
        sequence: syncData.sequenceNumber,
        checksum: syncData.checksum
      });

      this.addToHistory(syncData);
    } catch (error) {
      logger.error('SYNC', 'Error broadcasting state sync', error);
    }
  }

  private async sendActionToServer(action: PendingAction): Promise<void> {
    try {
      // Send action to server for validation and broadcasting
      // This would use the multiplayer service
      logger.debug('SYNC', 'Sending action to server', {
        actionId: action.actionId,
        sequence: action.sequenceNumber
      });
    } catch (error) {
      logger.error('SYNC', 'Error sending action to server', error);
    }
  }

  private startSyncBroadcast(): void {
    this.stopSyncBroadcast();
    
    this.syncInterval = setInterval(() => {
      this.broadcastStateSync();
    }, this.syncIntervalMs);
  }

  private stopSyncBroadcast(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private calculateChecksum(state: GameState): string {
    // Simple checksum calculation
    // In production, would use a proper hashing algorithm
    const stateString = JSON.stringify(state);
    let hash = 0;
    
    for (let i = 0; i < stateString.length; i++) {
      const char = stateString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }

  private addToHistory(syncData: StateSync): void {
    this.stateHistory.push(syncData);
    
    // Limit history size
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          logger.error('SYNC', 'Error in event listener', { event, error });
        }
      });
    }
  }
}

// Singleton instance
export const stateSyncManager = new StateSyncManager();