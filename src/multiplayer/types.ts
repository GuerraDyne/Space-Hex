/**
 * Multiplayer Types - Core types for real-time multiplayer functionality
 */

import { GameState, PlayerId, HexCoordinate } from '../game/core/Types';

// Player session information
export interface PlayerSession {
  playerId: PlayerId;
  playerName: string;
  isOnline: boolean;
  lastSeen: number;
  connectionId: string;
  avatar?: string;
  ranking?: number;
}

// Game session management
export interface GameSession {
  sessionId: string;
  gameId: string;
  hostPlayerId: PlayerId;
  players: Map<PlayerId, PlayerSession>;
  spectators: Map<string, PlayerSession>;
  isPrivate: boolean;
  maxPlayers: number;
  status: GameSessionStatus;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  gameState?: GameState;
  settings: SessionSettings;
}

export enum GameSessionStatus {
  WAITING = 'waiting',
  STARTING = 'starting', 
  IN_PROGRESS = 'in_progress',
  PAUSED = 'paused',
  FINISHED = 'finished',
  ABANDONED = 'abandoned'
}

export interface SessionSettings {
  gameMode: GameMode;
  timeControl: TimeControl;
  allowSpectators: boolean;
  allowReconnect: boolean;
  autoStart: boolean;
  customRules?: CustomRules;
}

export enum GameMode {
  CLASSIC = 'classic',
  BLITZ = 'blitz',
  CAMPAIGN = 'campaign',
  CUSTOM = 'custom',
  AI_PRACTICE = 'ai_practice'
}

export interface TimeControl {
  type: 'none' | 'per_turn' | 'total_game';
  timePerTurn?: number; // seconds
  totalTime?: number; // seconds per player
  increment?: number; // bonus seconds per move
}

export interface CustomRules {
  boardSize?: number;
  startingFleet?: any[];
  victoryConditions?: string[];
  specialRules?: string[];
}

// Network message types
export interface NetworkMessage {
  id: string;
  type: MessageType;
  senderId: PlayerId;
  sessionId: string;
  timestamp: number;
  data: any;
}

export enum MessageType {
  // Session management
  JOIN_SESSION = 'join_session',
  LEAVE_SESSION = 'leave_session',
  SESSION_UPDATE = 'session_update',
  PLAYER_JOINED = 'player_joined',
  PLAYER_LEFT = 'player_left',
  
  // Game flow
  GAME_START = 'game_start',
  GAME_END = 'game_end',
  GAME_PAUSE = 'game_pause',
  GAME_RESUME = 'game_resume',
  
  // Player actions
  SHIP_MOVE = 'ship_move',
  SHIP_DEPLOY = 'ship_deploy',
  MOTHERSHIP_DEPLOY = 'mothership_deploy',
  MOTHERSHIP_MOVE = 'mothership_move',
  COCKPIT_ENTER = 'cockpit_enter',
  COCKPIT_EXIT = 'cockpit_exit',
  DOCK_ENTER = 'dock_enter',
  DOCK_EXIT = 'dock_exit',
  END_TURN = 'end_turn',
  
  // Game state sync
  STATE_SYNC = 'state_sync',
  STATE_REQUEST = 'state_request',
  
  // Chat and social
  CHAT_MESSAGE = 'chat_message',
  EMOTE = 'emote',
  
  // System
  HEARTBEAT = 'heartbeat',
  ERROR = 'error',
  RECONNECT = 'reconnect'
}

// Specific message payloads
export interface JoinSessionMessage {
  sessionId: string;
  playerName: string;
  avatar?: string;
  spectateOnly?: boolean;
}

export interface ShipMoveMessage {
  shipId: string;
  targetHex: HexCoordinate;
  moveId: string; // For deduplication
}

export interface StateSyncMessage {
  gameState: GameState;
  sequenceNumber: number;
  checksum: string;
}

export interface ChatMessage {
  message: string;
  isPublic: boolean;
  targetPlayerId?: PlayerId;
}

export interface EmoteMessage {
  emoteId: string;
  targetHex?: HexCoordinate;
}

// Network connection status
export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  lastConnected?: number;
  reconnectAttempts: number;
  ping: number;
  serverRegion?: string;
}

// Lobby and matchmaking
export interface LobbyState {
  availableSessions: GameSession[];
  joinedSession: GameSession | null;
  connectionState: ConnectionState;
}

export interface MatchmakingCriteria {
  gameMode: GameMode;
  timeControl: TimeControl;
  skillRange?: [number, number];
  region?: string;
  customRules?: CustomRules;
}

// Events for reactive updates
export interface MultiplayerEvents {
  'session-updated': (session: GameSession) => void;
  'player-joined': (player: PlayerSession) => void;
  'player-left': (playerId: PlayerId) => void;
  'game-started': (gameState: GameState) => void;
  'game-ended': (result: GameResult) => void;
  'move-received': (move: any) => void;
  'chat-received': (message: ChatMessage & { senderName: string }) => void;
  'connection-changed': (state: ConnectionState) => void;
  'error': (error: MultiplayerError) => void;
}

export interface GameResult {
  winnerId?: PlayerId;
  reason: 'victory' | 'resignation' | 'timeout' | 'disconnection';
  finalState: GameState;
  statistics: GameStatistics;
}

export interface GameStatistics {
  duration: number; // milliseconds
  turns: number;
  movesPerPlayer: Map<PlayerId, number>;
  shipsLostPerPlayer: Map<PlayerId, number>;
  combatEvents: number;
}

export interface MultiplayerError {
  code: ErrorCode;
  message: string;
  details?: any;
  recoverable: boolean;
}

export enum ErrorCode {
  CONNECTION_FAILED = 'connection_failed',
  SESSION_NOT_FOUND = 'session_not_found',
  SESSION_FULL = 'session_full',
  PERMISSION_DENIED = 'permission_denied',
  INVALID_MOVE = 'invalid_move',
  PLAYER_NOT_FOUND = 'player_not_found',
  GAME_STATE_MISMATCH = 'game_state_mismatch',
  TIMEOUT = 'timeout',
  UNKNOWN_ERROR = 'unknown_error'
}

// Replay system
export interface GameReplay {
  replayId: string;
  sessionId: string;
  gameId: string;
  players: PlayerSession[];
  startState: GameState;
  moves: ReplayMove[];
  result: GameResult;
  metadata: ReplayMetadata;
}

export interface ReplayMove {
  sequenceNumber: number;
  playerId: PlayerId;
  timestamp: number;
  action: any;
  resultingState?: GameState; // Optional for compression
}

export interface ReplayMetadata {
  version: string;
  createdAt: number;
  gameMode: GameMode;
  duration: number;
  isPublic: boolean;
  tags: string[];
}

// AI opponent types
export interface AIOpponent {
  aiId: string;
  name: string;
  difficulty: AIDifficulty;
  personality: AIPersonality;
  avatar: string;
  description: string;
  winRate: number;
  specialties: string[];
}

export enum AIDifficulty {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
  MASTER = 'master'
}

export interface AIPersonality {
  aggressiveness: number; // 0-1
  riskTaking: number; // 0-1
  adaptability: number; // 0-1
  favoriteShips: string[];
  favoriteStrategies: string[];
}

// Campaign system
export interface Campaign {
  campaignId: string;
  name: string;
  description: string;
  scenarios: CampaignScenario[];
  prerequisites: string[];
  rewards: CampaignReward[];
  isUnlocked: boolean;
  progress: CampaignProgress;
}

export interface CampaignScenario {
  scenarioId: string;
  name: string;
  description: string;
  difficulty: AIDifficulty;
  objectives: ScenarioObjective[];
  constraints: ScenarioConstraint[];
  customSetup: any;
  aiOpponent: AIOpponent;
  rewards: CampaignReward[];
}

export interface ScenarioObjective {
  id: string;
  type: 'victory' | 'survival' | 'elimination' | 'capture' | 'custom';
  description: string;
  target?: any;
  timeLimit?: number;
  required: boolean;
}

export interface ScenarioConstraint {
  type: 'fleet_size' | 'ship_types' | 'turn_limit' | 'no_mothership' | 'custom';
  description: string;
  parameters: any;
}

export interface CampaignProgress {
  completedScenarios: Set<string>;
  currentScenario?: string;
  totalStars: number;
  statistics: CampaignStatistics;
}

export interface CampaignStatistics {
  gamesPlayed: number;
  gamesWon: number;
  totalPlayTime: number;
  averageGameLength: number;
  favoriteShipType: string;
  bestWinStreak: number;
}

export interface CampaignReward {
  type: 'experience' | 'achievement' | 'unlock' | 'cosmetic';
  amount?: number;
  itemId?: string;
  description: string;
}

// Achievement system
export interface Achievement {
  achievementId: string;
  name: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  icon: string;
  requirements: AchievementRequirement[];
  rewards: CampaignReward[];
  isSecret: boolean;
  unlockedAt?: number;
  progress?: AchievementProgress;
}

export enum AchievementCategory {
  COMBAT = 'combat',
  STRATEGY = 'strategy',
  EXPLORATION = 'exploration',
  SOCIAL = 'social',
  COLLECTION = 'collection',
  MASTERY = 'mastery'
}

export enum AchievementRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary'
}

export interface AchievementRequirement {
  type: string;
  target: number;
  current: number;
  parameters?: any;
}

export interface AchievementProgress {
  current: number;
  target: number;
  percentage: number;
  lastUpdated: number;
}