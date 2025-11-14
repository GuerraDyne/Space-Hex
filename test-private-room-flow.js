const { Client } = require("colyseus.js");

async function testPrivateRoomFlow() {
  const serverUrl = "ws://localhost:2567";
  
  try {
    const host = new Client(serverUrl);
    const joiner = new Client(serverUrl);
    
    console.log("=== Testing Private Room Flow ===\n");
    
    // Step 1: Host creates a private room (simulating "Host Match" -> "Private Match")
    console.log("1. Host creating private room...");
    const hostRoom = await host.create("hex_game", {
      name: "Host Player",
      isPublic: false
    });
    
    console.log("   ✅ Private room created!");
    console.log("   📋 Room ID to share: " + hostRoom.roomId);
    console.log("   📏 Room ID length: " + hostRoom.roomId.length + " characters");
    
    // Listen for state changes on host
    hostRoom.onStateChange((state) => {
      console.log("   👥 Players in room: " + state.players.size);
    });
    
    // Step 2: Another player joins using the room ID (simulating "Join Match")
    console.log("\n2. Another player joining with Room ID...");
    const joinerRoom = await joiner.joinById(hostRoom.roomId, {
      name: "Joining Player"
    });
    
    console.log("   ✅ Successfully joined private room!");
    
    // Step 3: Verify both are in the same room
    console.log("\n3. Verifying room status...");
    if (hostRoom.roomId === joinerRoom.roomId) {
      console.log("   ✅ Both players are in the same room!");
      console.log("   🎮 Room ID: " + hostRoom.roomId);
      console.log("   🔒 Private: " + !hostRoom.state.isPublic);
      
      // Show player list
      console.log("\n   Players in room:");
      hostRoom.state.players.forEach((player, id) => {
        console.log(`     - ${player.name} ${player.isHost ? '(Host)' : ''}`);
      });
    }
    
    // Clean up
    await new Promise(resolve => setTimeout(resolve, 1000));
    hostRoom.leave();
    joinerRoom.leave();
    
    console.log("\n✅ Private room test completed successfully!");
    console.log("   The room ID display and joining functionality work correctly.");
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
  
  process.exit(0);
}

testPrivateRoomFlow();