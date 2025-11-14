import { Client, Room } from "colyseus.js";

class ColyseusService {
  private client: Client;
  private currentRoom: Room | null = null;
  private serverUrl: string;

  constructor() {
    // In development, connect to local server
    // In production, this would be your deployed server URL
    this.serverUrl = "ws://localhost:2567";
    
    console.log("Connecting to Colyseus server at:", this.serverUrl);
    this.client = new Client(this.serverUrl);
  }

  async quickMatch(playerName: string): Promise<Room> {
    try {
      console.log("Attempting to join quick match...");
      
      // Use joinOrCreate on hex_game which will:
      // 1. Try to join an existing public room that hasn't started
      // 2. Create a new public room if no suitable room exists
      // Don't send a name - let the server assign "Player 1", "Player 2", etc.
      // Set default time controls: 3 min deployment, 10 min turns
      const room = await this.client.joinOrCreate("hex_game", {
        isPublic: true,
        deploymentTime: 180,  // 3 minutes
        turnTime: 600         // 10 minutes
      });
      
      console.log("Successfully joined room:", room.id);
      this.currentRoom = room;
      return room;
    } catch (error) {
      console.error("Failed to join quick match:", error);
      throw error;
    }
  }

  async hostMatch(playerName: string, isPublic: boolean, options: any = {}): Promise<Room> {
    try {
      // Don't send a name - let the server assign "Player 1", "Player 2", etc.
      const room = await this.client.create("hex_game", {
        isPublic: isPublic,
        ...options
      });
      
      this.currentRoom = room;
      return room;
    } catch (error) {
      console.error("Failed to create room:", error);
      throw error;
    }
  }

  async joinMatch(roomId: string, playerName: string): Promise<Room> {
    try {
      // Don't send a name - let the server assign "Player 1", "Player 2", etc.
      const room = await this.client.joinById(roomId, {});
      
      this.currentRoom = room;
      return room;
    } catch (error) {
      console.error("Failed to join room:", error);
      throw error;
    }
  }

  async getAvailableRooms(): Promise<any[]> {
    try {
      const rooms = await this.client.getAvailableRooms("hex_game");
      return rooms;
    } catch (error) {
      console.error("Failed to get available rooms:", error);
      return [];
    }
  }

  leaveRoom() {
    if (this.currentRoom) {
      this.currentRoom.leave();
      this.currentRoom = null;
    }
  }

  getCurrentRoom(): Room | null {
    return this.currentRoom;
  }

  sendMessage(type: string, data: any) {
    if (this.currentRoom) {
      this.currentRoom.send(type, data);
    }
  }
}

// Export singleton instance
export const colyseusService = new ColyseusService();