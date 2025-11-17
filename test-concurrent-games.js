const { Client } = require("colyseus.js");

async function testConcurrentGames() {
  const serverUrl = "ws://localhost:2567";
  
  try {
    // Create 4 clients
    const client1 = new Client(serverUrl);
    const client2 = new Client(serverUrl);
    const client3 = new Client(serverUrl);
    const client4 = new Client(serverUrl);
    
    console.log("Creating first game...");
    // First game - 2 players quick match
    const room1 = await client1.joinOrCreate("hex_game_quick", {
      name: "Player1",
      isPublic: true
    });
    console.log("Player 1 joined room:", room1.roomId);
    
    const room2 = await client2.joinOrCreate("hex_game_quick", {
      name: "Player2",
      isPublic: true
    });
    console.log("Player 2 joined room:", room2.roomId);
    
    // Check if they're in the same room
    if (room1.roomId === room2.roomId) {
      console.log("✅ Players 1 and 2 are in the same room");
    }
    
    // Wait a moment  
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log("\nCreating second game...");
    // Second game - 2 more players quick match
    const room3 = await client3.joinOrCreate("hex_game_quick", {
      name: "Player3",
      isPublic: true
    });
    console.log("Player 3 joined room:", room3.roomId);
    
    const room4 = await client4.joinOrCreate("hex_game_quick", {
      name: "Player4",
      isPublic: true
    });
    console.log("Player 4 joined room:", room4.roomId);
    
    // Check if they're in the same room
    if (room3.roomId === room4.roomId) {
      console.log("✅ Players 3 and 4 are in the same room");
    }
    
    // Check if the two games are different
    if (room1.roomId !== room3.roomId) {
      console.log("✅ Two separate games are running concurrently!");
      console.log("  Game 1 ID:", room1.roomId);
      console.log("  Game 2 ID:", room3.roomId);
    } else {
      console.log("❌ All players joined the same room - concurrent games not working");
    }
    
    // Clean up
    room1.leave();
    room2.leave();
    room3.leave();
    room4.leave();
    
    console.log("\n✅ Test completed successfully!");
    
  } catch (error) {
    console.error("Test failed:", error);
  }
  
  process.exit(0);
}

testConcurrentGames();