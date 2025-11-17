const { Client } = require('colyseus.js');

async function testAIGame() {
  const client = new Client('ws://localhost:2567');
  
  console.log('Connecting to AI game...');
  
  try {
    const room = await client.joinOrCreate('ai_game', {
      difficulty: 'medium',
      deploymentTime: 180,
      turnTime: 180,
      mapType: 'Classic'
    });
    
    console.log('✅ Connected to AI game room:', room.id);
    console.log('Session ID:', room.sessionId);
    
    // Listen for state changes
    room.state.onChange = (changes) => {
      console.log('State changed:', changes);
    };
    
    // Check if players exists before setting onAdd
    if (room.state.players) {
      room.state.players.onAdd = (player, key) => {
        console.log(`Player added: ${key}`, {
          name: player.name,
          isAI: player.isAI,
          assignedZone: player.assignedZone,
          ready: player.ready
        });
      };
    } else {
      console.log('Players state not available yet');
    }
    
    room.onMessage('gamePhaseChange', (data) => {
      console.log('Game phase changed:', data);
    });
    
    room.onMessage('diceRolls', (data) => {
      console.log('Dice rolls:', data);
      
      // If human wins, select a zone
      if (data.winner === room.sessionId) {
        console.log('Human won dice roll, selecting zone 1');
        setTimeout(() => {
          console.log('Sending zone selection...');
          room.send('selectZone', { zone: 1 });
        }, 2000);
      }
    });
    
    room.onMessage('zoneSelected', (data) => {
      console.log('Zone selected:', data);
    });
    
    room.onMessage('deploymentStarted', () => {
      console.log('Deployment phase started!');
      console.log('Current game phase:', room.state.gamePhase);
      
      // Test auto-deploy after a few seconds
      setTimeout(() => {
        console.log('Sending auto-deploy request...');
        room.send('autoDeploy');
      }, 3000);
    });
    
    room.onMessage('shipDeployed', (data) => {
      console.log('Ship deployed:', data);
    });
    
    room.onMessage('allShipsDeployed', (data) => {
      console.log('All ships deployed for player:', data);
      
      // If human deployed, confirm deployment
      if (data.playerId === room.sessionId) {
        console.log('Confirming deployment...');
        room.send('confirmDeployment');
      }
    });
    
    room.onMessage('gameStarted', () => {
      console.log('Game started!');
    });
    
    room.onMessage('turnChanged', (data) => {
      console.log('Turn changed:', data);
      
      // If it's human's turn, end turn after a delay
      if (data.currentTurn === room.sessionId) {
        setTimeout(() => {
          console.log('Ending human turn...');
          room.send('endTurn');
        }, 2000);
      }
    });
    
    room.onMessage('deploymentComplete', (data) => {
      console.log('Deployment complete, game started!');
      console.log('First turn:', data.firstTurn);
      
      // If it's human's turn, end turn after a delay
      if (data.firstTurn === room.sessionId) {
        setTimeout(() => {
          console.log('Ending human turn...');
          room.send('endTurn');
        }, 3000);
      }
    });
    
    // Send ready message
    setTimeout(() => {
      console.log('Sending ready message...');
      room.send('ready');
    }, 1000);
    
    // Keep the connection alive
    process.on('SIGINT', () => {
      console.log('\nDisconnecting...');
      room.leave();
      process.exit();
    });
    
  } catch (error) {
    console.error('❌ Failed to connect:', error);
  }
}

testAIGame();