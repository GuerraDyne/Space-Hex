import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") id: string;
  @type("string") name: string;
  @type("boolean") isHost: boolean = false;
  @type("boolean") isReady: boolean = false;
  @type("number") assignedZone: number = 0;
  @type("boolean") isAI: boolean = false;
  @type("boolean") isEliminated: boolean = false;
  @type("boolean") deployed: boolean = false;
  @type("number") deploymentTimeRemaining: number = 0; // seconds
  @type("number") turnTimeRemaining: number = 0; // seconds
  @type("number") team: number = 0; // 0 for no team (FFA/1v1), 1 or 2 for team games
  @type("string") eliminationReason: string = ""; // "timer_expired", "no_ships", etc.
}

export class Ship extends Schema {
  @type("string") id: string;
  @type("string") type: string; // scout, interceptor, corvette, etc.
  @type("string") owner: string; // player id
  @type("string") color: string; // blue, red, etc.
  @type("string") col: string; // hex column (a-l)
  @type("number") row: number; // hex row (1-11)
  @type("number") health: number = 100;
  @type("number") orientation: number = 0; // 0-5, direction ship is orientation (0=E, 1=SE, 2=SW, 3=W, 4=NW, 5=NE)
  @type("number") rotation: number = 90; // Visual rotation in degrees (0-360)
}

export class GameMove extends Schema {
  @type("number") turnNumber: number;
  @type("string") playerId: string;
  @type("string") playerName: string;
  @type("string") action: string; // "move", "rotate", "combat", "endTurn"
  @type("string") shipId: string;
  @type("string") shipType: string;
  @type("string") fromCol: string;
  @type("number") fromRow: number;
  @type("string") toCol: string;
  @type("number") toRow: number;
  @type("number") fromOrientation: number;
  @type("number") toOrientation: number;
  @type("string") targetShipId: string = ""; // For combat
  @type("string") result: string = ""; // Combat result or other outcomes
  @type("number") timestamp: number;
}

export class HexGameState extends Schema {
  @type("string") roomId: string;
  @type("boolean") isPublic: boolean = true;
  @type("string") gamePhase: string = "waiting"; // waiting, deployment, playing, ended
  @type("string") currentTurn: string; // player id of current turn
  @type("number") turnNumber: number = 0;
  @type("string") mapType: string = "Classic";
  @type("string") gameMode: string = "ffa"; // 1v1, ffa, 2v2
  
  @type({ map: Player }) players = new MapSchema<Player>();
  @type([Ship]) ships = new ArraySchema<Ship>();
  @type([GameMove]) moveHistory = new ArraySchema<GameMove>();
  
  @type("number") maxPlayers: number = 4;
  @type("number") minPlayers: number = 2;
  
  @type("string") winner: string = ""; // player id of winner
  @type("boolean") gameStarted: boolean = false;
  @type("boolean") deploymentConfirmed: boolean = false;
  
  // Time controls
  @type("number") deploymentTime: number = 180; // seconds per player for deployment
  @type("number") turnTime: number = 180; // seconds per turn
}