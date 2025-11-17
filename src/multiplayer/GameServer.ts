import { GameState, GameSettings, Move, Turn, Player } from '@/types/game';

export type MessageType =
  | 'join_room'
  | 'leave_room'
  | 'player_joined'
  | 'player_left'
  | 'game_start'
  | 'dice_roll'
  | 'zone_selected'
  | 'ship_deployed'
  | 'deployment_complete'
  | 'turn_submitted'
  | 'game_state_update'
  | 'chat_message'
  | 'error';

export interface GameMessage {
  type: MessageType;
  playerId?: string;
  data?: unknown;
  timestamp: number;
}

export interface RoomInfo {
  id: string;
  hostName: string;
  settings: GameSettings;
  playerCount: number;
  maxPlayers: number;
  isPrivate: boolean;
}

// Client-side multiplayer manager
export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private roomId: string | null = null;
  private playerId: string | null = null;
  private messageHandlers: Map<MessageType, (data: unknown) => void> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(private serverUrl: string = 'ws://localhost:8080') {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: GameMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (e) {
            console.error('Failed to parse message:', e);
          }
        };

        this.ws.onclose = () => {
          this.handleDisconnect();
        };

        this.ws.onerror = (error) => {
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.roomId = null;
    this.playerId = null;
  }

  private handleDisconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;
      setTimeout(() => this.connect(), delay);
    }
  }

  private handleMessage(message: GameMessage): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message.data);
    }
  }

  onMessage(type: MessageType, handler: (data: unknown) => void): void {
    this.messageHandlers.set(type, handler);
  }

  send(type: MessageType, data?: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    const message: GameMessage = {
      type,
      playerId: this.playerId || undefined,
      data,
      timestamp: Date.now(),
    };

    this.ws.send(JSON.stringify(message));
  }

  // Room management
  createRoom(settings: GameSettings, playerName: string): void {
    this.send('join_room', { action: 'create', settings, playerName });
  }

  joinRoom(roomId: string, playerName: string): void {
    this.send('join_room', { action: 'join', roomId, playerName });
  }

  quickMatch(playerName: string): void {
    this.send('join_room', { action: 'quickmatch', playerName });
  }

  leaveRoom(): void {
    this.send('leave_room', {});
    this.roomId = null;
  }

  // Game actions
  submitDiceRoll(roll: number): void {
    this.send('dice_roll', { roll });
  }

  selectZone(zoneIndex: number): void {
    this.send('zone_selected', { zoneIndex });
  }

  deployShip(shipId: string, position: { q: number; r: number }, facing: number): void {
    this.send('ship_deployed', { shipId, position, facing });
  }

  confirmDeployment(): void {
    this.send('deployment_complete', {});
  }

  submitTurn(moves: Move[]): void {
    this.send('turn_submitted', { moves });
  }

  sendChat(message: string): void {
    this.send('chat_message', { message });
  }

  setPlayerId(id: string): void {
    this.playerId = id;
  }

  setRoomId(id: string): void {
    this.roomId = id;
  }

  getRoomId(): string | null {
    return this.roomId;
  }

  getPlayerId(): string | null {
    return this.playerId;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
export const multiplayerClient = new MultiplayerClient();

// Mock server for local play (simulates server responses)
export class MockServer {
  private rooms: Map<string, { settings: GameSettings; players: string[] }> = new Map();
  private waitingRoom: string | null = null;

  createRoom(settings: GameSettings): string {
    const roomId = Math.random().toString(36).substring(7);
    this.rooms.set(roomId, { settings, players: [] });
    if (!settings.isPrivate) {
      this.waitingRoom = roomId;
    }
    return roomId;
  }

  findQuickMatch(): string | null {
    return this.waitingRoom;
  }

  joinRoom(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const maxPlayers = room.settings.mode === '1v1' ? 2 : room.settings.mode === '2v2' ? 4 : 4;
    if (room.players.length >= maxPlayers) return false;

    room.players.push(playerId);

    // Clear waiting room if full
    if (room.players.length >= maxPlayers && roomId === this.waitingRoom) {
      this.waitingRoom = null;
    }

    return true;
  }
}

export const mockServer = new MockServer();
