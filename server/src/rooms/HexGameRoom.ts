import { Room, Client } from "@colyseus/core";
import { HexGameState, Player, Ship, GameMove } from "./schema/HexGameState";

export class HexGameRoom extends Room<HexGameState> {
  maxClients = 4;
  autoDispose = false; // We'll manually control disposal
  private zoneSelectionOrder: string[] = []; // Track order for zone selection
  private availableZones: number[] = [1, 2, 3, 4]; // Track available zones
  private deploymentTimers: Map<string, NodeJS.Timeout> = new Map(); // Track deployment timers
  private turnTimer: NodeJS.Timeout | null = null; // Current turn timer
  private timerInterval: NodeJS.Timeout | null = null; // Timer countdown interval
  private gameMode: '1v1' | 'ffa' | '2v2' = 'ffa'; // Game mode
  private teams: Map<string, number> = new Map(); // Player ID to team number mapping
  private teamTimers: Map<number, number> = new Map(); // Team number to remaining time
  
  // AI game properties
  private isAIGame: boolean = false;
  private aiDifficulty: 'easy' | 'medium' | 'hard' = 'medium';
  private aiPlayerId: string = 'ai_player';
  private deploymentTimeLimit: number = 180;
  private turnTimeLimit: number = 180;

  async onAuth(client: Client, options: any, request?: any) {
    // Allow joining
    return true;
  }

  onCreate(options: any) {
    this.setState(new HexGameState());
    
    // Set room options
    this.state.roomId = this.roomId;
    this.state.isPublic = options.isPublic !== undefined ? options.isPublic : false;
    this.state.mapType = options.mapType || "Classic";
    
    // Check if this is an AI game
    this.isAIGame = options.difficulty !== undefined;
    if (this.isAIGame) {
      this.aiDifficulty = options.difficulty || 'medium';
      this.state.isPublic = false; // AI games are always private
      if (options.deploymentTime) {
        this.deploymentTimeLimit = options.deploymentTime;
      }
      if (options.turnTime) {
        this.turnTimeLimit = options.turnTime;
      }
    }
    
    // Set game mode
    this.gameMode = this.isAIGame ? '1v1' : (options.gameMode || 'ffa');
    this.state.gameMode = this.gameMode;
    
    // Set max clients based on game mode
    if (this.gameMode === '1v1') {
      this.maxClients = 2;
    } else if (this.gameMode === '2v2') {
      this.maxClients = 4;
    } else { // ffa
      this.maxClients = 4;
    }
    
    // Set time controls
    this.state.deploymentTime = options.deploymentTime || 180;
    this.state.turnTime = options.turnTime || 180;
    
    // Set metadata for room listing/filtering
    this.setMetadata({
      gameStarted: false,
      gamePhase: "waiting",
      isPublic: this.state.isPublic,
      gameMode: this.gameMode
    });

    // Set up message handlers
    this.onMessage("ready", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.isReady = true;
        this.checkStartGame();
      }
    });

    this.onMessage("selectZone", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      // Only allow zone selection if it's this player's turn, zone is available, and player hasn't already selected
      if (player && message.zone && this.state.currentTurn === client.sessionId && 
          this.availableZones.includes(message.zone) && !player.assignedZone) {
        console.log(`Player ${player.name} (${client.sessionId}) selected zone ${message.zone}`);
        player.assignedZone = message.zone;
        // Remove selected zone from available zones
        this.availableZones = this.availableZones.filter(z => z !== message.zone);
        console.log(`Available zones remaining: ${this.availableZones}`);
        
        this.broadcast("zoneSelected", { 
          playerId: client.sessionId,
          playerName: player.name,
          zone: message.zone 
        });
        
        const players = Array.from(this.state.players.entries());
        
        // In 2-player game, automatically assign opposite zone to other player
        if (players.length === 2) {
          const otherPlayer = players.find(([id]) => id !== client.sessionId);
          if (otherPlayer) {
            const oppositeZone = this.getOppositeZone(message.zone);
            otherPlayer[1].assignedZone = oppositeZone;
            console.log(`Auto-assigning opposite zone ${oppositeZone} to ${otherPlayer[1].name}`);
            this.broadcast("zoneSelected", {
              playerId: otherPlayer[0],
              playerName: otherPlayer[1].name,
              zone: oppositeZone
            });
          }
          // Only proceed to deployment if both players have zones (or it's not an AI game)
          if (!this.isAIGame || (players.every(([id, p]) => p.assignedZone))) {
            // Zones are assigned, move to deployment
            // Reset isReady for deployment phase
            this.state.players.forEach(p => {
              p.isReady = false;
              // Start deployment timer for each player (except AI)
              if (!p.isAI) {
                this.startDeploymentTimer(p.id);
              }
            });
            this.state.gamePhase = "deployment";
            this.broadcast("deploymentStarted");
            
            // Auto-deploy AI ships if this is an AI game
            if (this.isAIGame) {
              setTimeout(() => {
                this.autoDeployAIShips();
              }, 1000);
            }
          }
        } else {
          // For 3+ players, move to next player in selection order
          const currentIndex = this.zoneSelectionOrder.indexOf(client.sessionId);
          console.log(`Current player index: ${currentIndex}, Total players: ${this.zoneSelectionOrder.length}`);
          
          if (currentIndex < this.zoneSelectionOrder.length - 1) {
            // Move to next player
            const nextPlayerId = this.zoneSelectionOrder[currentIndex + 1];
            this.state.currentTurn = nextPlayerId;
            const nextPlayer = this.state.players.get(nextPlayerId);
            console.log(`Zone selection: Moving to player ${currentIndex + 2}/${this.zoneSelectionOrder.length} - ${nextPlayer?.name} (${nextPlayerId})`);
            
            // Notify clients of turn change
            this.broadcast("zoneSelectionTurn", {
              playerId: nextPlayerId,
              playerName: nextPlayer?.name,
              availableZones: this.availableZones
            });
          } else {
            // All players have selected zones, move to deployment
            console.log("All zones selected, moving to deployment");
            console.log("Final zone assignments:", Array.from(this.state.players.entries()).map(([id, p]) => `${p.name}: zone ${p.assignedZone}`));
            this.state.players.forEach(p => {
              p.isReady = false;
              // Start deployment timer for each player
              this.startDeploymentTimer(p.id);
            });
            this.broadcast("zonesAssigned", {});
          }
        }
      }
    });

    this.onMessage("deployShip", (client, message) => {
      if (this.state.gamePhase !== "deployment") return;
      
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Check if ship already exists at this position for this player
      const existingShip = this.state.ships.find(s => 
        s.owner === client.sessionId && 
        s.col === message.col && 
        s.row === message.row
      );
      
      if (existingShip) {
        console.log(`Ship already exists at ${message.col}${message.row} for ${client.sessionId}`);
        client.send("shipDeploymentAck", {
          shipId: existingShip.id,
          position: { col: existingShip.col, row: existingShip.row }
        });
        return;
      }

      // Determine ship color based on player order
      const playerIds = Array.from(this.state.players.keys());
      const playerIndex = playerIds.indexOf(client.sessionId);
      
      // Assign colors based on player index: 0=blue, 1=red, 2=green, 3=yellow
      let shipColor = "blue";
      switch(playerIndex) {
        case 0: shipColor = "blue"; break;
        case 1: shipColor = "red"; break;
        case 2: shipColor = "green"; break;
        case 3: shipColor = "yellow"; break;
        default: shipColor = "blue"; break;
      }
      
      const ship = new Ship();
      ship.id = `${client.sessionId}_${Date.now()}_${Math.random()}`;
      ship.type = message.type;
      ship.owner = client.sessionId;
      ship.color = shipColor;
      ship.col = message.col;
      ship.row = message.row;
      
      // Use the orientation and rotation from the client if provided
      ship.orientation = message.orientation !== undefined ? message.orientation : 0;
      ship.rotation = message.rotation !== undefined ? message.rotation : 90; // Default to East (90°)
      
      console.log(`📍 Ship deployed: ${ship.id} at ${ship.col}${ship.row} with orientation ${ship.orientation}, rotation ${ship.rotation}`);
      
      this.state.ships.push(ship);
      
      // DON'T broadcast ship deployments until all players confirm
      // Just acknowledge to the deploying player with position for ID mapping
      client.send("shipDeploymentAck", {
        shipId: ship.id,
        position: { col: ship.col, row: ship.row }
      });
    });

    this.onMessage("updateShipOrientation", (client, message) => {
      // Update ship orientation during deployment AND gameplay
      const ship = this.state.ships.find(s => s.id === message.shipId);
      if (ship && ship.owner === client.sessionId) {
        const oldOrientation = ship.orientation;
        ship.orientation = message.orientation;
        // Also update visual rotation if provided
        if (message.rotation !== undefined) {
          ship.rotation = message.rotation;
        }
        
        // During gameplay, broadcast the rotation to other players
        if (this.state.gamePhase === "playing") {
          this.broadcast("shipRotated", {
            shipId: ship.id,
            rotation: ship.rotation,
            owner: client.sessionId
          }, { except: client });
        }
        
        console.log(`🔄 Updated ship orientation: ${ship.id} from ${oldOrientation} to ${message.orientation}`);
      } else {
        console.log(`⚠️ Failed to update orientation: ship ${message.shipId} not found or not owned by ${client.sessionId}`);
      }
    });

    this.onMessage("confirmDeployment", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.isReady = true;
        player.deployed = true;  // Mark player as deployed
        console.log(`${player.name} confirmed deployment`);
        
        // Clear deployment timer for this player
        this.clearDeploymentTimer(client.sessionId);
        
        // Notify other players that this player is ready
        this.broadcast("playerDeploymentReady", {
          playerId: client.sessionId,
          playerName: player.name
        }, { except: client });
        
        this.checkAllPlayersDeployed();
      }
    });

    // Auto-deploy handler for quick deployment
    this.onMessage("autoDeploy", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || this.state.gamePhase !== "deployment") {
        console.log(`Cannot auto-deploy: player=${player?.name}, phase=${this.state.gamePhase}`);
        return;
      }
      
      console.log(`Auto-deploying for player ${player.name} in zone ${player.assignedZone}`);
      
      // Get deployment zone hexes
      const zoneHexes = this.getDeploymentZoneHexes(player.assignedZone);
      if (zoneHexes.length === 0) {
        console.error(`No deployment hexes for zone ${player.assignedZone}`);
        return;
      }
      
      // Define the ships to deploy with correct colors based on zone
      // Zone 1 = blue, Zone 2 = red, Zone 3 = green, Zone 4 = yellow
      const zoneColors: {[key: number]: string} = {
        1: 'blue',
        2: 'red',
        3: 'green',
        4: 'yellow'
      };
      const playerColor = zoneColors[player.assignedZone] || 'blue';
      const shipsToPlace = [
        { type: 'mothership', count: 1 },
        { type: 'scout', count: 2 },
        { type: 'interceptor', count: 2 },
        { type: 'corvette', count: 2 },
        { type: 'frigate', count: 2 },
        { type: 'destroyer', count: 1 },
        { type: 'cruiser', count: 1 }
      ];
      
      let hexIndex = 0;
      shipsToPlace.forEach(({ type, count }) => {
        for (let i = 0; i < count && hexIndex < zoneHexes.length; i++) {
          const hex = zoneHexes[hexIndex++];
          const ship = new Ship();
          ship.id = `${client.sessionId}_${type}_${i}`;
          ship.type = type;
          ship.color = playerColor;
          ship.owner = client.sessionId;
          ship.col = hex.col;
          ship.row = hex.row;
          ship.orientation = Math.floor(Math.random() * 6); // Random orientation
          
          this.state.ships.push(ship);
          
          this.broadcast("shipDeployed", {
            id: ship.id,
            type: ship.type,
            color: ship.color,
            owner: ship.owner,
            col: ship.col,
            row: ship.row,
            orientation: ship.orientation
          });
        }
      });
      
      // Mark player as deployed
      player.deployed = true;
      this.broadcast("allShipsDeployed", { playerId: client.sessionId });
      
      // Check if all players deployed
      this.checkAllPlayersDeployed();
    });

    this.onMessage("startGame", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.isHost) {
        this.startGame();
      }
    });
    
    this.onMessage("rollDice", (client) => {
      // Only host can initiate dice rolls
      const player = this.state.players.get(client.sessionId);
      if (player && player.isHost) {
        this.rollDiceForZoneSelection();
      }
    });

    this.onMessage("resign", (client) => {
      this.handlePlayerResign(client.sessionId);
    });

    this.onMessage("offerDraw", (client) => {
      console.log(`Draw offer from ${client.sessionId}`);
      // Broadcast draw offer to other players
      this.broadcast("drawOffered", {
        from: client.sessionId
      }, { except: client });
      console.log("Draw offer broadcast to other players");
    });

    this.onMessage("acceptDraw", (client) => {
      // End game in draw
      this.state.gamePhase = "ended";
      this.broadcast("gameEnded", {
        result: "draw",
        acceptedBy: client.sessionId
      });
      
      // Dispose room after a short delay to allow clients to receive the message
      setTimeout(() => {
        console.log("Game ended in draw - disposing room");
        this.disconnect();
      }, 5000);
    });

    this.onMessage("refuseDraw", (client) => {
      // Notify that draw was refused
      this.broadcast("drawRefused", {
        refusedBy: client.sessionId
      }, { except: client });
    });

    this.onMessage("endTurn", (client) => {
      // Verify it's the player's turn
      if (this.state.currentTurn !== client.sessionId) {
        console.log(`Not player's turn. Current turn: ${this.state.currentTurn}`);
        client.send("error", { message: "Not your turn!" });
        return;
      }
      
      // Record end turn in history
      const move = new GameMove();
      move.turnNumber = this.state.turnNumber;
      move.playerId = client.sessionId;
      move.playerName = this.state.players.get(client.sessionId)?.name || "Unknown";
      move.action = "endTurn";
      move.shipId = "";
      move.shipType = "";
      move.fromCol = "";
      move.fromRow = 0;
      move.toCol = "";
      move.toRow = 0;
      move.fromOrientation = 0;
      move.toOrientation = 0;
      move.timestamp = Date.now();
      this.state.moveHistory.push(move);
      
      console.log(`Player ${client.sessionId} ended their turn`);
      this.moveToNextTurn();
      
      // Check if next player is AI and trigger AI turn
      if (this.isAIGame) {
        const nextPlayer = this.state.players.get(this.state.currentTurn);
        if (nextPlayer?.isAI) {
          console.log("Next turn is AI player, triggering AI turn");
          setTimeout(() => this.executeAITurn(), 1500);
        }
      }
    });

    this.onMessage("moveShip", (client, message) => {
      console.log(`Move request from ${client.sessionId}: ship ${message.shipId} from ${message.from.col}${message.from.row} to ${message.to.col}${message.to.row}`);
      
      // Verify it's the player's turn
      if (this.state.currentTurn !== client.sessionId) {
        console.log(`Not player's turn. Current turn: ${this.state.currentTurn}`);
        client.send("error", { message: "Not your turn!" });
        return;
      }
      
      // Check if the player is eliminated (shouldn't happen but double-check)
      const player = this.state.players.get(client.sessionId);
      if (player?.isEliminated) {
        client.send("error", { message: "You have been eliminated!" });
        return;
      }
      
      // Verify the ship exists and belongs to the player
      const movingShip = this.state.ships.find(ship => ship.id === message.shipId);
      if (!movingShip) {
        console.error(`Ship not found: ${message.shipId}`);
        console.log(`Available ships:`, this.state.ships.map(s => ({ id: s.id, owner: s.owner, pos: `${s.col}${s.row}` })));
        client.send("error", { message: "Ship not found!" });
        return;
      }
      
      if (movingShip.owner !== client.sessionId) {
        console.error(`Ship ${message.shipId} doesn't belong to ${client.sessionId} (owner: ${movingShip.owner})`);
        client.send("error", { message: "Not your ship!" });
        return;
      }
      
      // Check if there's another ship at the target location
      const targetShip = this.state.ships.find(ship => 
        ship.col === message.to.col && 
        ship.row === message.to.row &&
        ship.owner !== client.sessionId
      );
      
      let isCombat = false;
      let defeatedPlayerId: string | null = null;
      
      if (targetShip) {
        // In 2v2 mode, check if target is a teammate
        if (this.gameMode === '2v2') {
          const attackerTeam = this.teams.get(client.sessionId);
          const targetTeam = this.teams.get(targetShip.owner);
          
          if (attackerTeam === targetTeam) {
            console.log(`Blocking friendly fire: Team ${attackerTeam} cannot attack teammate`);
            client.send("error", { message: "Cannot attack teammates!" });
            return;
          }
        }
        
        // Combat! Remove the enemy ship from server state
        const remainingShips = this.state.ships.filter(ship => ship.id !== targetShip.id);
        this.state.ships.clear();
        remainingShips.forEach(ship => this.state.ships.push(ship));
        isCombat = true;
        console.log(`Combat! Ship ${message.shipId} destroyed ${targetShip.id} (type: ${targetShip.type}) at ${message.to.col}${message.to.row}`);
        
        // Check if destroyed ship was a mothership/command ship - instant loss
        if (targetShip.type === 'mothership') {
          console.log(`GAME OVER! ${targetShip.owner}'s mothership was destroyed!`);
          defeatedPlayerId = targetShip.owner;
          this.handlePlayerEliminated(targetShip.owner);
        } else {
          // Check if the defeated player has any ships left
          const defeatedPlayerShips = this.state.ships.filter(ship => ship.owner === targetShip.owner);
          if (defeatedPlayerShips.length === 0) {
            defeatedPlayerId = targetShip.owner;
            this.handlePlayerEliminated(targetShip.owner);
          }
        }
      }
      
      // Update the moving ship's position and rotation in server state
      const oldCol = movingShip.col;
      const oldRow = movingShip.row;
      const oldOrientation = movingShip.orientation;
      const oldRotation = movingShip.rotation || 0;
      movingShip.col = message.to.col;
      movingShip.row = message.to.row;
      
      // Ships maintain their rotation when moving (they've already been rotated via AP if needed)
      // Only omnidirectional ships (mothership) or ships without rotation should auto-rotate
      if (movingShip.type === 'mothership') {
        // Motherships don't rotate
        console.log(`Mothership ${movingShip.id} moved from ${oldCol}${oldRow} to ${message.to.col}${message.to.row}, rotation unchanged: ${movingShip.rotation}°`);
      } else {
        // Regular ships keep their current rotation
        // The client has already handled rotation via action points
        console.log(`Ship ${movingShip.id} moved from ${oldCol}${oldRow} to ${message.to.col}${message.to.row}, maintaining rotation: ${movingShip.rotation}°`);
      }
      
      console.log(`Updated ship ${movingShip.id} position to ${movingShip.col}${movingShip.row}, orientation: ${movingShip.orientation}`);
      
      // Record the move in history
      const move = new GameMove();
      move.turnNumber = this.state.turnNumber;
      move.playerId = client.sessionId;
      move.playerName = this.state.players.get(client.sessionId)?.name || "Unknown";
      move.action = isCombat ? "combat" : "move";
      move.shipId = movingShip.id;
      move.shipType = movingShip.type;
      move.fromCol = oldCol;
      move.fromRow = oldRow;
      move.toCol = message.to.col;
      move.toRow = message.to.row;
      move.fromOrientation = oldOrientation;
      move.toOrientation = movingShip.orientation;
      if (isCombat && targetShip) {
        move.targetShipId = targetShip.id;
        move.result = `Destroyed ${targetShip.type}`;
      }
      move.timestamp = Date.now();
      this.state.moveHistory.push(move);
      
      // Broadcast ship movement to all players (includes combat info implicitly)
      console.log(`Broadcasting shipMoved: ship ${message.shipId} to ${message.to.col}${message.to.row}`);
      this.broadcast("shipMoved", {
        shipId: message.shipId,
        from: message.from,
        to: message.to,
        playerId: client.sessionId,
        combat: isCombat,
        destroyedShipId: targetShip?.id,
        orientation: movingShip.orientation,
        rotation: movingShip.rotation
      });
      
      // Don't automatically end turn - let client manage action points
      // The client will send an endTurn message when out of AP or player chooses to end
      // this.moveToNextTurn();
    });

    console.log(`HexGameRoom ${this.roomId} created!`);
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined!");
    
    // Don't allow joining if game has already started
    if (this.state.gameStarted) {
      console.log("Rejecting join - game already started");
      client.leave(4000, "Game already in progress");
      return;
    }
    
    // Don't allow joining if room is full
    if (this.state.players.size >= this.maxClients) {
      console.log("Rejecting join - room full");
      client.leave(4001, "Room is full");
      return;
    }

    const player = new Player();
    player.id = client.sessionId;
    player.name = options.name || `Player ${this.state.players.size + 1}`;
    player.isHost = this.state.players.size === 0;
    
    // If this is an AI game, add the AI player after the human joins
    if (this.isAIGame && this.state.players.size === 0) {
      // Human player joins first
      this.state.players.set(client.sessionId, player);
      
      // Add AI player
      const aiPlayer = new Player();
      aiPlayer.id = this.aiPlayerId;
      aiPlayer.name = "AI Commander";
      aiPlayer.isAI = true;
      aiPlayer.isReady = true; // AI is always ready
      this.state.players.set(this.aiPlayerId, aiPlayer);
      
      console.log("AI game setup - Human and AI players added");
      
      // Start the game with zone selection
      setTimeout(() => {
        // Mark human as ready to trigger game start
        player.isReady = true;
        this.checkStartGame(); // This will trigger dice roll for zone selection
      }, 1000);
      
      return;
    }
    
    // Assign teams for 2v2 mode
    if (this.gameMode === '2v2') {
      // Players 1 & 3 are Team 1, Players 2 & 4 are Team 2
      const playerNumber = this.state.players.size + 1;
      const teamNumber = (playerNumber % 2 === 1) ? 1 : 2;
      this.teams.set(client.sessionId, teamNumber);
      player.team = teamNumber;
      console.log(`Player ${player.name} assigned to Team ${teamNumber}`);
    }
    
    this.state.players.set(client.sessionId, player);

    // If room is full enough, notify players
    if (this.state.players.size >= this.state.minPlayers) {
      this.broadcast("canStartGame", { ready: true });
    }
  }

  onLeave(client: Client, consented: boolean) {
    console.log(client.sessionId, "left!");

    if (this.state.gameStarted) {
      // Handle in-game disconnection
      const player = this.state.players.get(client.sessionId);
      if (player) {
        // During zone selection, if a player leaves, dispose the room
        if (this.state.gamePhase === "deployment" && !player.assignedZone) {
          console.log("Player left during zone selection - disposing room");
          this.disconnect();
          return;
        }
        // Mark as AI for now (could implement reconnection)
        player.isAI = true;
      }
      
      // Check if all human players have left
      const humanPlayers = Array.from(this.state.players.values()).filter(p => !p.isAI);
      if (humanPlayers.length === 0) {
        console.log("All human players left - disposing room");
        this.disconnect();
      }
    } else {
      // Remove player if game hasn't started
      this.state.players.delete(client.sessionId);
      
      // Reassign host if needed
      if (this.state.players.size > 0) {
        const firstPlayer = Array.from(this.state.players.values())[0];
        firstPlayer.isHost = true;
      } else {
        // No players left - dispose room
        console.log("No players left - disposing room");
        this.disconnect();
      }
    }
  }

  onDispose() {
    console.log(`Room ${this.roomId} disposing...`);
  }

  protected checkStartGame() {
    const allReady = Array.from(this.state.players.values()).every(p => p.isReady);
    const hasEnoughPlayers = this.state.players.size >= this.state.minPlayers;
    
    if (allReady && hasEnoughPlayers && !this.state.gameStarted) {
      this.startGame();
    }
  }

  private startGame() {
    this.state.gameStarted = true;
    this.state.gamePhase = "deployment";
    
    // Lock the room to prevent new joins
    this.lock();
    
    // Update metadata for room listing
    this.setMetadata({
      gameStarted: true,
      gamePhase: "deployment",
      isPublic: this.state.isPublic
    });
    
    // Don't auto-dispose the room once game starts
    this.autoDispose = false;
    
    this.broadcast("gameStarted", {
      phase: "deployment"
    });
    console.log(`Game started in room ${this.roomId} - room locked, auto-dispose disabled`);
    
    // Immediately roll dice for zone selection
    this.rollDiceForZoneSelection();
  }
  
  private rollDiceForZoneSelection() {
    if (!this.state || !this.state.players) {
      console.log("Cannot roll dice - room disposed");
      return;
    }
    
    const players = Array.from(this.state.players.entries());
    if (players.length === 0) {
      console.log("Cannot roll dice - no players");
      return;
    }
    
    const diceRolls = players.map(([id, player]) => ({
      playerId: id,
      playerName: player.name || "Player",
      roll: Math.floor(Math.random() * 6) + 1
    }));
    
    // Sort by roll to determine order
    diceRolls.sort((a, b) => b.roll - a.roll);
    
    console.log(`Rolling dice for ${players.length} players:`, diceRolls);
    
    // Check for ties
    if (players.length === 2 && diceRolls[0].roll === diceRolls[1].roll) {
      console.log("Tie detected! Re-rolling...");
      // Broadcast tie and re-roll after a delay
      this.broadcast("diceTie", {
        rolls: diceRolls
      });
      
      // Re-roll after 2 seconds
      setTimeout(() => {
        this.rollDiceForZoneSelection();
      }, 2000);
      return;
    }
    
    // Store zone selection order based on dice rolls
    this.zoneSelectionOrder = diceRolls.map(roll => roll.playerId);
    
    // Broadcast dice rolls to all players
    this.broadcast("diceRolls", {
      rolls: diceRolls,
      winner: diceRolls[0].playerId,
      selectionOrder: this.zoneSelectionOrder
    });
    
    // Set the first player's turn for zone selection
    this.state.currentTurn = diceRolls[0].playerId;
    console.log(`Dice rolls complete. ${diceRolls[0].playerName} goes first with roll of ${diceRolls[0].roll}`);
    console.log(`Zone selection order:`, this.zoneSelectionOrder);
    
    // If AI goes first in zone selection, have it select automatically
    if (this.isAIGame && this.state.currentTurn === this.aiPlayerId) {
      setTimeout(() => {
        this.handleAIZoneSelection();
      }, 2000);
    }
  }
  
  private getOppositeZone(zone: number): number {
    // Zone opposites: 1↔2, 3↔4
    switch(zone) {
      case 1: return 2;
      case 2: return 1;
      case 3: return 4;
      case 4: return 3;
      default: return 1;
    }
  }
  
  private handleAIZoneSelection() {
    const aiPlayer = this.state.players.get(this.aiPlayerId);
    if (!aiPlayer || aiPlayer.assignedZone) return;
    
    console.log(`AI's turn to select zone. Available zones: ${this.availableZones}`);
    
    // AI randomly picks from available zones
    if (this.availableZones.length > 0) {
      const randomIndex = Math.floor(Math.random() * this.availableZones.length);
      const selectedZone = this.availableZones[randomIndex];
      
      console.log(`AI selecting zone ${selectedZone} (random from available)`);
      aiPlayer.assignedZone = selectedZone;
      this.availableZones = this.availableZones.filter(z => z !== selectedZone);
      
      this.broadcast("zoneSelected", { 
        playerId: this.aiPlayerId,
        playerName: aiPlayer.name,
        zone: selectedZone 
      });
      
      // In 2-player game, automatically assign opposite zone to human
      const humanPlayer = Array.from(this.state.players.values()).find(p => !p.isAI);
      if (humanPlayer && !humanPlayer.assignedZone && this.state.players.size === 2) {
        const oppositeZone = this.getOppositeZone(selectedZone);
        humanPlayer.assignedZone = oppositeZone;
        console.log(`Auto-assigning opposite zone ${oppositeZone} to ${humanPlayer.name}`);
        this.broadcast("zoneSelected", {
          playerId: humanPlayer.id,
          playerName: humanPlayer.name,
          zone: oppositeZone
        });
      }
      
      // Both have selected, move to deployment
      if (humanPlayer && humanPlayer.assignedZone && aiPlayer.assignedZone) {
        console.log("Both players have selected zones, moving to deployment");
        
        this.state.players.forEach(p => {
          p.isReady = false;
          if (!p.isAI) {
            this.startDeploymentTimer(p.id);
          }
        });
        this.state.gamePhase = "deployment";
        this.broadcast("deploymentStarted");
        
        // Auto-deploy AI ships
        setTimeout(() => {
          this.autoDeployAIShips();
        }, 1000);
      }
    }
  }
  
  private autoDeployAIShips() {
    const aiPlayer = this.state.players.get(this.aiPlayerId);
    if (!aiPlayer || !aiPlayer.assignedZone) return;
    
    console.log(`Auto-deploying AI ships in zone ${aiPlayer.assignedZone}`);
    
    const zoneHexes = this.getDeploymentZoneHexes(aiPlayer.assignedZone);
    const shipTypes = [
      'mothership',
      'scout', 'scout',
      'interceptor', 'interceptor',
      'corvette', 'corvette',
      'frigate', 'frigate',
      'destroyer',
      'cruiser'
    ];
    
    // Deploy each ship
    let hexIndex = 0;
    shipTypes.forEach((type, index) => {
      if (hexIndex < zoneHexes.length) {
        const hex = zoneHexes[hexIndex];
        const ship = new Ship();
        ship.id = `ai_${type}_${index}`;
        ship.type = type;
        ship.owner = this.aiPlayerId;
        ship.col = hex.col;
        ship.row = hex.row;
        ship.orientation = 0;
        ship.rotation = 0;
        
        // Set ship color based on zone
        const zoneColors: {[key: number]: string} = {
          1: 'blue',
          2: 'red',
          3: 'green',
          4: 'yellow'
        };
        ship.color = zoneColors[aiPlayer.assignedZone] || 'red';
        
        this.state.ships.push(ship);
        hexIndex++;
      }
    });
    
    // Mark AI as deployed
    aiPlayer.deployed = true;
    this.checkAllPlayersDeployed();
  }

  protected checkAllPlayersDeployed() {
    const players = Array.from(this.state.players.values());
    console.log("Checking if all players deployed:", players.map(p => ({ id: p.id, deployed: p.deployed })));
    
    const allDeployed = players.every(p => p.deployed);
    
    if (allDeployed) {
      console.log("All players deployed! Starting game phase...");
      
      // Clear all deployment timers
      this.state.players.forEach((player, id) => {
        this.clearDeploymentTimer(id);
      });
      
      this.state.gamePhase = "playing";
      
      // Update metadata for room listing
      this.setMetadata({
        gameStarted: true,
        gamePhase: "playing",
        isPublic: this.state.isPublic
      });
      
      // Set first player's turn for gameplay
      // In 4-player games, we should start fresh with the first player in zone selection order
      // (the winner of the dice roll) rather than whoever was last to select zones
      if (this.zoneSelectionOrder && this.zoneSelectionOrder.length > 0) {
        this.state.currentTurn = this.zoneSelectionOrder[0]; // Winner of dice roll goes first
        console.log(`Setting first turn to ${this.zoneSelectionOrder[0]} (dice roll winner)`);
      } else if (!this.state.currentTurn) {
        const firstPlayer = players[0];
        this.state.currentTurn = firstPlayer.id;
        console.log(`Setting first turn to ${firstPlayer.id} (fallback)`);
      }
      this.state.turnNumber = 1;
      
      // Initialize all players' turn timers
      this.state.players.forEach((player) => {
        player.turnTimeRemaining = this.state.turnTime;
      });
      
      // Start turn timer for the first player
      this.startTurnTimer();
      
      // Now broadcast all deployed ships to all players
      // Ships keep their actual colors (blue for player 1, red for player 2)
      const allShips = this.state.ships.map(ship => {
        console.log(`🚢 Final ship state: ${ship.id} at ${ship.col}${ship.row} rotation: ${ship.rotation} (type: ${ship.type}, owner: ${ship.owner})`);
        return {
          id: ship.id,
          type: ship.type,
          owner: ship.owner,
          color: ship.color, // Keep the actual color from deployment
          col: ship.col,
          row: ship.row,
          rotation: ship.rotation // Include the rotation value set during deployment
        };
      });
      
      console.log(`Broadcasting deploymentComplete with ${allShips.length} ships`);
      console.log("Ship breakdown by owner:");
      const shipsByOwner: {[key: string]: number} = {};
      allShips.forEach(ship => {
        shipsByOwner[ship.owner] = (shipsByOwner[ship.owner] || 0) + 1;
      });
      for (const [owner, count] of Object.entries(shipsByOwner)) {
        console.log(`  ${owner}: ${count} ships`);
      }
      
      // Include player zones for proper ship rotation
      const playerZones: {[key: string]: number} = {};
      this.state.players.forEach((player, playerId) => {
        playerZones[playerId] = player.assignedZone;
      });
      
      // Send deployment complete with all ships (same for all players)
      const currentPlayer = this.state.players.get(this.state.currentTurn);
      console.log(`Broadcasting deploymentComplete - First turn: ${currentPlayer?.name} (${this.state.currentTurn})`);
      this.broadcast("deploymentComplete", {
        phase: "playing",
        currentTurn: this.state.currentTurn,
        turnNumber: this.state.turnNumber,
        ships: allShips,
        playerZones: playerZones
      });
      
      // If it's an AI game and the AI goes first, trigger its turn
      if (this.isAIGame && this.state.currentTurn === this.aiPlayerId) {
        console.log("AI goes first, triggering AI turn");
        setTimeout(() => this.executeAITurn(), 2000);
      }
    } else {
      console.log("Not all players deployed yet");
    }
  }

  protected moveToNextTurn() {
    const playerIds = Array.from(this.state.players.keys());
    const currentIndex = playerIds.indexOf(this.state.currentTurn);
    
    // Log current player states for debugging
    console.log("moveToNextTurn - Player states:");
    playerIds.forEach(id => {
      const p = this.state.players.get(id);
      console.log(`  ${id}: isEliminated=${p?.isEliminated}, name=${p?.name}`);
    });
    
    // Find next active (non-eliminated) player
    let nextIndex = (currentIndex + 1) % playerIds.length;
    let attempts = 0;
    
    while (attempts < playerIds.length) {
      const nextPlayer = this.state.players.get(playerIds[nextIndex]);
      console.log(`Checking player ${playerIds[nextIndex]}: isEliminated=${nextPlayer?.isEliminated}`);
      
      if (nextPlayer && !nextPlayer.isEliminated) {
        this.state.currentTurn = playerIds[nextIndex];
        this.state.turnNumber++;
        
        // Start turn timer for the new player
        this.startTurnTimer();
        
        // Notify all players of turn change
        this.broadcast("turnChanged", {
          currentTurn: this.state.currentTurn,
          turnNumber: this.state.turnNumber
        });
        
        console.log(`Turn ${this.state.turnNumber}: Now ${this.state.currentTurn}'s turn (${nextPlayer.name})`);
        return;
      }
      nextIndex = (nextIndex + 1) % playerIds.length;
      attempts++;
    }
    
    // No active players found (shouldn't happen as game should end)
    console.error("No active players found for next turn!");
  }
  
  private handlePlayerEliminated(playerId: string) {
    const player = this.state.players.get(playerId);
    if (!player || player.isEliminated) return;
    
    console.log(`Player ${player.name} (${playerId}) eliminated - no ships remaining`);
    player.isEliminated = true;
    
    // Get player number
    const playerIds = Array.from(this.state.players.keys());
    const playerNumber = playerIds.indexOf(playerId) + 1;
    
    // Notify all players about the elimination
    this.broadcast("playerEliminated", {
      playerId: playerId,
      playerName: player.name,
      playerNumber: playerNumber,
      reason: "no_ships"
    });
    
    // Check for victory
    this.checkForVictory();
  }
  
  // Stub method for AI turn execution - override in AIGameRoom
  protected async executeAITurn(): Promise<void> {
    // This method is overridden in AIGameRoom
    // Base implementation does nothing
  }
  
  private checkForVictory(eliminationReason?: string) {
    const activePlayers = Array.from(this.state.players.values()).filter(p => !p.isEliminated);
    console.log(`Active players remaining: ${activePlayers.length}`);
    
    // Handle team victory in 2v2 mode
    if (this.gameMode === '2v2' && activePlayers.length > 0) {
      const activeTeams = new Set<number>();
      const eliminatedTeams = new Set<number>();
      
      // Track active and eliminated teams
      this.state.players.forEach((player, id) => {
        const team = this.teams.get(id);
        if (team) {
          if (player.isEliminated) {
            eliminatedTeams.add(team);
          } else {
            activeTeams.add(team);
          }
        }
      });
      
      if (activeTeams.size === 1) {
        // Only one team remains - they win!
        const winningTeam = Array.from(activeTeams)[0];
        const winners = activePlayers.filter(p => this.teams.get(p.id) === winningTeam);
        
        // Check if the eliminated team lost due to timeout
        const wasTimeout = eliminationReason === "timer_expired";
        
        this.state.winner = `Team ${winningTeam}`;
        this.state.gamePhase = "ended";
        
        console.log(`Game ended - Team ${winningTeam} wins!`);
        
        this.broadcast("gameEnded", {
          winner: this.state.winner,
          winnerName: `Team ${winningTeam}`,
          winningTeam: winningTeam,
          winningPlayers: winners.map(p => ({ id: p.id, name: p.name })),
          reason: wasTimeout ? "opponentTimeout" : "teamVictory"
        });
        
        // Dispose room after a delay
        setTimeout(() => {
          console.log("Game ended - disposing room");
          this.disconnect();
        }, 30000); // 30 seconds for spectators
        return;
      }
    }
    
    // Handle solo victory (1v1 or FFA)
    if (activePlayers.length === 1) {
      // Last remaining player wins
      const winner = activePlayers[0];
      this.state.winner = winner.id;
      this.state.gamePhase = "ended";
      
      // Check if opponent lost due to timeout
      const wasTimeout = eliminationReason === "timer_expired";
      
      console.log(`Game ended - ${winner.name} wins as last survivor`);
      
      this.broadcast("gameEnded", {
        winner: this.state.winner,
        winnerName: winner.name,
        reason: wasTimeout ? "opponentTimeout" : "lastRemaining"
      });
      
      // Dispose room after a delay
      setTimeout(() => {
        console.log("Game ended - disposing room");
        this.disconnect();
      }, 30000); // 30 seconds for spectators
    } else if (activePlayers.length === 0) {
      // Everyone eliminated somehow
      this.state.gamePhase = "ended";
      this.broadcast("gameEnded", {
        reason: "allEliminated"
      });
      
      setTimeout(() => {
        this.disconnect();
      }, 5000);
    }
  }
  
  private handlePlayerResign(playerId: string) {
    const player = this.state.players.get(playerId);
    if (!player || player.isEliminated) return; // Don't resign twice

    console.log(`Player ${player.name} (${playerId}) resigned`);
    
    // Mark the resigned player as eliminated
    player.isEliminated = true;
    console.log(`Marking player ${player.name} (${playerId}) as eliminated: isEliminated=${player.isEliminated}`);
    
    // Remove player's ships
    const remainingShips = this.state.ships.filter(ship => ship.owner !== playerId);
    this.state.ships.clear();
    remainingShips.forEach(ship => this.state.ships.push(ship));
    
    // Count remaining active players (not eliminated)
    const activePlayers = Array.from(this.state.players.values()).filter(p => !p.isEliminated);
    console.log(`Active players remaining: ${activePlayers.length}`);
    
    // Get player number for the resigned player
    const playerIds = Array.from(this.state.players.keys());
    const playerNumber = playerIds.indexOf(playerId) + 1;
    
    // Notify all players about the resignation
    this.broadcast("playerResigned", {
      playerId: playerId,
      playerName: player.name,
      playerNumber: playerNumber,
      remainingPlayers: activePlayers.length
    });
    
    // If current turn was the resigned player, move to next player
    if (this.state.currentTurn === playerId && activePlayers.length > 1) {
      this.moveToNextTurn();
    }
    
    // Check for victory conditions
    this.checkForVictory();
  }
  
  private startDeploymentTimer(playerId: string) {
    const player = this.state.players.get(playerId);
    if (!player) return;
    
    // Set initial time
    player.deploymentTimeRemaining = this.state.deploymentTime;
    
    // Clear any existing timer
    this.clearDeploymentTimer(playerId);
    
    // Start countdown
    const timer = setInterval(() => {
      const p = this.state.players.get(playerId);
      if (!p) {
        clearInterval(timer);
        return;
      }
      
      p.deploymentTimeRemaining--;
      
      // Broadcast time update
      this.broadcast("timerUpdate", {
        playerId: playerId,
        timeRemaining: p.deploymentTimeRemaining,
        phase: "deployment"
      });
      
      // Check if time expired
      if (p.deploymentTimeRemaining <= 0) {
        console.log(`Deployment timer expired for ${p.name}`);
        this.clearDeploymentTimer(playerId);
        this.autoDeployShips(playerId);
      }
    }, 1000); // Update every second
    
    this.deploymentTimers.set(playerId, timer);
  }
  
  private clearDeploymentTimer(playerId: string) {
    const timer = this.deploymentTimers.get(playerId);
    if (timer) {
      clearInterval(timer);
      this.deploymentTimers.delete(playerId);
    }
  }
  
  private calculateOrientationFromMovement(fromCol: string, fromRow: number, toCol: string, toRow: number): number {
    // For FLAT-TOP hexagons with odd-r offset coordinates
    // (odd rows are shifted right by half a hex width)
    
    const fromColIndex = fromCol.charCodeAt(0) - 'a'.charCodeAt(0);
    const toColIndex = toCol.charCodeAt(0) - 'a'.charCodeAt(0);
    
    const dCol = toColIndex - fromColIndex;
    const dRow = toRow - fromRow;
    
    // Check if we're on an odd row (affects neighbor positions)
    const fromRowIsOdd = fromRow % 2 === 1;
    
    // Direction mapping for our rotation system:
    // 0 = North (0°), 1 = NE (60°), 2 = SE (120°), 3 = S (180°), 4 = SW (240°), 5 = NW (300°)
    
    // Check for exact neighbor directions first
    // For flat-top hexes with our rotation system:
    // 0=N(0°), 1=NE(60°), 2=SE(120°), 3=S(180°), 4=SW(240°), 5=NW(300°)
    if (fromRowIsOdd) {
      // Odd row - shifted right by half a hex
      if (dCol === 0 && dRow === -1) return 5;  // NW (up-left) = 300°
      if (dCol === 1 && dRow === -1) return 1;  // NE (up-right) = 60°
      if (dCol === 1 && dRow === 0) return 2;   // E (right) = SE 120°
      if (dCol === 1 && dRow === 1) return 3;   // SE (down-right) = S 180°
      if (dCol === 0 && dRow === 1) return 4;   // SW (down-left) = 240°
      if (dCol === -1 && dRow === 0) return 5;  // W (left) = NW 300°
    } else {
      // Even row - not shifted
      if (dCol === -1 && dRow === -1) return 5; // NW (up-left) = 300°
      if (dCol === 0 && dRow === -1) return 1;  // NE (up-right) = 60°
      if (dCol === 1 && dRow === 0) return 2;   // E (right) = SE 120°
      if (dCol === 0 && dRow === 1) return 3;   // SE (down-right) = S 180°
      if (dCol === -1 && dRow === 1) return 4;  // SW (down-left) = 240°
      if (dCol === -1 && dRow === 0) return 5;  // W (left) = NW 300°
    }
    
    // For non-adjacent hexes, calculate the general direction
    // Convert to cube coordinates for better angle calculation
    const offsetToCube = (col: number, row: number) => {
      const x = col - (row - (row & 1)) / 2;
      const z = row;
      const y = -x - z;
      return { x, y, z };
    };
    
    const fromCube = offsetToCube(fromColIndex, fromRow);
    const toCube = offsetToCube(toColIndex, toRow);
    
    const dx = toCube.x - fromCube.x;
    const dy = toCube.y - fromCube.y;
    const dz = toCube.z - fromCube.z;
    
    // Find the dominant axis
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const absDz = Math.abs(dz);
    
    // Determine direction based on which axis has the largest magnitude
    // Using our rotation mapping: 0=N(0°), 1=NE(60°), 2=SE(120°), 3=S(180°), 4=SW(240°), 5=NW(300°)
    if (absDx >= absDy && absDx >= absDz) {
      // X axis is dominant (East-West)
      return dx > 0 ? 2 : 5; // E maps to SE(120°), W maps to NW(300°)
    } else if (absDz >= absDx && absDz >= absDy) {
      // Z axis is dominant (North-South on rows)
      if (dz > 0) {
        // Moving south (down in rows)
        // Check if moving more straight down vs diagonal
        if (Math.abs(dx) < absDz / 2) {
          return 3; // Mostly straight south = S(180°)
        }
        return dx >= 0 ? 3 : 4; // SE becomes S(180°) or SW(240°)
      } else {
        // Moving north (up in rows)
        if (Math.abs(dx) < absDz / 2) {
          return 0; // Mostly straight north = N(0°)
        }
        return dx > 0 ? 1 : 5; // NE(60°) or NW(300°)
      }
    } else {
      // Y axis is dominant
      if (dy > 0) {
        // Moving in +y direction (northwest in hex terms)
        return 5; // NW(300°)
      } else {
        // Moving in -y direction (southeast in hex terms)
        return 2; // SE(120°)
      }
    }
  }
  
  private startTurnTimer() {
    const currentPlayer = this.state.players.get(this.state.currentTurn);
    if (!currentPlayer) return;
    
    // Clear any existing timer
    this.clearTurnTimer();
    
    // In 2v2 mode, use shared team timers
    if (this.gameMode === '2v2') {
      const currentTeam = this.teams.get(this.state.currentTurn);
      if (!currentTeam) return;
      
      // Initialize team timer if needed
      if (!this.teamTimers.has(currentTeam) || this.teamTimers.get(currentTeam) === 0) {
        this.teamTimers.set(currentTeam, this.state.turnTime);
      }
      
      // Start countdown
      this.turnTimer = setInterval(() => {
        const team = this.teams.get(this.state.currentTurn);
        if (!team) {
          this.clearTurnTimer();
          return;
        }
        
        const currentTime = this.teamTimers.get(team) || 0;
        this.teamTimers.set(team, currentTime - 1);
        
        // Update all team members' timers for display
        this.state.players.forEach((p, id) => {
          if (this.teams.get(id) === team) {
            p.turnTimeRemaining = currentTime - 1;
          }
        });
        
        // Broadcast timer update
        const allTimers: any = {};
        this.state.players.forEach((p, id) => {
          allTimers[id] = p.turnTimeRemaining;
        });
        
        this.broadcast("timerUpdate", {
          currentTurn: this.state.currentTurn,
          timers: allTimers,
          teamTimers: Array.from(this.teamTimers.entries()),
          phase: "turn"
        });
        
        // Check if time expired for team
        if (currentTime - 1 <= 0) {
          console.log(`Team ${team} timer expired - eliminating all team members`);
          this.clearTurnTimer();
          // Eliminate all players on this team
          const teamPlayers: string[] = [];
          this.state.players.forEach((p, id) => {
            if (this.teams.get(id) === team && !p.isEliminated) {
              teamPlayers.push(id);
            }
          });
          
          // Eliminate all team members
          teamPlayers.forEach(playerId => {
            const player = this.state.players.get(playerId);
            if (player && !player.isEliminated) {
              console.log(`Eliminating team member ${player.name} due to team timeout`);
              player.isEliminated = true;
              player.eliminationReason = "timer_expired";
              
              // Remove player's ships
              const remainingShips = this.state.ships.filter(ship => ship.owner !== playerId);
              this.state.ships.clear();
              remainingShips.forEach(ship => this.state.ships.push(ship));
              
              // Notify all players
              this.broadcast("playerEliminated", {
                playerId: playerId,
                playerName: player.name,
                reason: "timer_expired",
                teamTimeout: true
              });
            }
          });
          
          // Move to next turn
          this.moveToNextTurn();
          
          // Check for victory with timeout context
          this.checkForVictory("timer_expired");
        }
      }, 1000);
    } else {
      // Original individual timer logic for non-team games
      // Initialize time on first turn only
      if (currentPlayer.turnTimeRemaining === 0 || currentPlayer.turnTimeRemaining === undefined) {
        currentPlayer.turnTimeRemaining = this.state.turnTime;
      }
      // Otherwise continue with existing time
      
      // Start countdown
      this.turnTimer = setInterval(() => {
        const player = this.state.players.get(this.state.currentTurn);
        if (!player) {
          this.clearTurnTimer();
          return;
        }
        
        player.turnTimeRemaining--;
        
        // Broadcast all players' timer info
        const allTimers: any = {};
        this.state.players.forEach((p, id) => {
          allTimers[id] = p.turnTimeRemaining;
        });
        
        this.broadcast("timerUpdate", {
          currentTurn: this.state.currentTurn,
          timers: allTimers,
          phase: "turn"
        });
        
        // Check if time expired
        if (player.turnTimeRemaining <= 0) {
          console.log(`Turn timer expired for ${player.name} - eliminating player`);
          this.clearTurnTimer();
          this.handleTimerExpiredElimination(this.state.currentTurn);
        }
      }, 1000);
    }
  }
  
  private clearTurnTimer() {
    if (this.turnTimer) {
      clearInterval(this.turnTimer);
      this.turnTimer = null;
    }
  }
  
  private autoDeployShips(playerId: string) {
    const player = this.state.players.get(playerId);
    if (!player || !player.assignedZone) return;
    
    console.log(`Deployment timer expired for ${player.name} - auto-deploying`);
    
    // Get zone hexes
    const zoneHexes = this.getDeploymentZoneHexes(player.assignedZone);
    
    // Get ship types to deploy - matches FleetPool (11 ships total including mothership)
    const shipTypes = ['mothership', 'scout', 'scout', 'interceptor', 'interceptor', 
                      'corvette', 'corvette', 'frigate', 'frigate', 'destroyer', 'cruiser'];
    
    // Check already deployed ships
    const deployedShips = this.state.ships.filter(s => s.owner === playerId);
    const remainingTypes = shipTypes.slice(deployedShips.length);
    
    // If player has deployed some ships but not all, deploy the rest
    if (remainingTypes.length > 0) {
      // Determine ship color based on player order
      const playerIds = Array.from(this.state.players.keys());
      const playerIndex = playerIds.indexOf(playerId);
      let shipColor = "blue";
      switch(playerIndex) {
        case 0: shipColor = "blue"; break;
        case 1: shipColor = "red"; break;
        case 2: shipColor = "green"; break;
        case 3: shipColor = "yellow"; break;
      }
      
      // Deploy remaining ships to random hexes
      const usedHexes = deployedShips.map(s => `${s.col}${s.row}`);
      const availableHexes = zoneHexes.filter(h => !usedHexes.includes(`${h.col}${h.row}`));
      
      remainingTypes.forEach((type, index) => {
        if (index < availableHexes.length) {
          const hex = availableHexes[index];
          const ship = new Ship();
          ship.id = `${playerId}_auto_${Date.now()}_${Math.random()}`;
          ship.type = type;
          ship.owner = playerId;
          ship.color = shipColor;
          ship.col = hex.col;
          ship.row = hex.row;
          
          // Set initial orientation based on zone (0-5 for hex sides)
          // 0=NE, 1=E, 2=SE, 3=SW, 4=W, 5=NW
          const playerZone = player.assignedZone;
          if (playerZone === 1) ship.orientation = 4; // East zone faces West toward center
          else if (playerZone === 2) ship.orientation = 1; // West zone faces East toward center
          else if (playerZone === 3) ship.orientation = 2; // North zone faces Southeast toward center
          else if (playerZone === 4) ship.orientation = 5; // South zone faces Northwest toward center
          else ship.orientation = 0; // Default to Northeast
          
          this.state.ships.push(ship);
        }
      });
    }
    
    // Mark player as ready and deployed
    player.isReady = true;
    player.deployed = true;
    
    // Notify all players that timer expired and ships were auto-deployed
    this.broadcast("deploymentTimerExpired", {
      playerId: playerId,
      playerName: player.name
    });
    
    this.checkAllPlayersDeployed();
  }
  
  private getDeploymentZoneHexes(zone: number): Array<{col: string, row: number}> {
    // Define deployment zones
    const zones: { [key: number]: Array<{col: string, row: number}> } = {
      1: [ // East zone - expanded to 16 hexes
        {col: 'k', row: 3}, {col: 'k', row: 4}, {col: 'k', row: 5}, {col: 'k', row: 6}, 
        {col: 'k', row: 7}, {col: 'k', row: 8}, {col: 'k', row: 9},
        {col: 'j', row: 3}, {col: 'j', row: 4}, {col: 'j', row: 5}, {col: 'j', row: 6},
        {col: 'j', row: 7}, {col: 'j', row: 8}, {col: 'j', row: 9},
        {col: 'i', row: 5}, {col: 'i', row: 6}
      ],
      2: [ // West zone - expanded to 16 hexes
        {col: 'a', row: 3}, {col: 'a', row: 4}, {col: 'a', row: 5}, {col: 'a', row: 6}, 
        {col: 'a', row: 7}, {col: 'a', row: 8}, {col: 'a', row: 9},
        {col: 'b', row: 3}, {col: 'b', row: 4}, {col: 'b', row: 5}, {col: 'b', row: 6},
        {col: 'b', row: 7}, {col: 'b', row: 8}, {col: 'b', row: 9},
        {col: 'c', row: 5}, {col: 'c', row: 6}
      ],
      3: [ // North zone - expanded to 16 hexes
        {col: 'c', row: 1}, {col: 'd', row: 1}, {col: 'e', row: 1}, {col: 'f', row: 1}, 
        {col: 'g', row: 1}, {col: 'h', row: 1}, {col: 'i', row: 1},
        {col: 'c', row: 2}, {col: 'd', row: 2}, {col: 'e', row: 2}, {col: 'f', row: 2},
        {col: 'g', row: 2}, {col: 'h', row: 2}, {col: 'i', row: 2},
        {col: 'e', row: 3}, {col: 'f', row: 3}
      ],
      4: [ // South zone - expanded to 16 hexes
        {col: 'c', row: 10}, {col: 'd', row: 10}, {col: 'e', row: 10}, {col: 'f', row: 10}, 
        {col: 'g', row: 10}, {col: 'h', row: 10}, {col: 'i', row: 10},
        {col: 'c', row: 11}, {col: 'd', row: 11}, {col: 'e', row: 11}, {col: 'f', row: 11},
        {col: 'g', row: 11}, {col: 'h', row: 11}, {col: 'i', row: 11},
        {col: 'e', row: 9}, {col: 'f', row: 9}
      ]
    };
    
    return zones[zone] || [];
  }
  
  private handleTimerExpiredElimination(playerId: string) {
    const player = this.state.players.get(playerId);
    if (!player || player.isEliminated) return;
    
    console.log(`Player ${player.name} eliminated due to timer expiration`);
    player.isEliminated = true;
    player.eliminationReason = "timer_expired"; // Track elimination reason
    
    // Remove player's ships
    const remainingShips = this.state.ships.filter(ship => ship.owner !== playerId);
    this.state.ships.clear();
    remainingShips.forEach(ship => this.state.ships.push(ship));
    
    // Notify all players
    this.broadcast("playerEliminated", {
      playerId: playerId,
      playerName: player.name,
      reason: "timer_expired"
    });
    
    // Move to next turn
    this.moveToNextTurn();
    
    // Check for victory with timeout context
    this.checkForVictory("timer_expired");
  }
}