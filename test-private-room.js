const { Client } = require("colyseus.js");

async function testPrivateRoom() {
  const serverUrl = "ws://localhost:2567";
  
  try {
    const client1 = new Client(serverUrl);
    const client2 = new Client(serverUrl);
    
    console.log("Creating private room...");
    // Host creates a private room
    const room1 = await client1.create("hex_game", {
      name: "Host",
      isPublic: false
    });
    console.log("✅ Private room created!");
    console.log("   Room ID:", room1.roomId);
    console.log("   Room ID length:", room1.roomId.length);
    
    // Try to join with the room ID
    console.log("\nAttempting to join with room ID...");
    const room2 = await client2.joinById(room1.roomId, {
      name: "Player2"
    });
    console.log("✅ Successfully joined private room!");
    console.log("   Player 2 room ID:", room2.roomId);
    
    if (room1.roomId === room2.roomId) {
      console.log("\n✅ SUCCESS: Both players are in the same private room!");
    }
    
    // Check room state
    console.log("\nRoom state:");
    console.log("  isPublic:", room1.state.isPublic);
    console.log("  Players:", room1.state.players.size);
    
    // Clean up
    room1.leave();
    room2.leave();
    
    console.log("\n✅ Test completed successfully!");
    
  } catch (error) {
    console.error("Test failed:", error);
  }
  
  process.exit(0);
}

testPrivateRoom();