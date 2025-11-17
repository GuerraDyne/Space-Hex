import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { colyseusService } from '../../services/ColyseusService';
import { Room } from 'colyseus.js';
import { logger } from '../../utils/Logger';

interface MultiplayerMenuProps {
  visible: boolean;
  initialMode?: string;
  onClose: () => void;
  onStartGame: (players: any[], room?: Room) => void;
}

interface QueuedPlayer {
  id: string;
  name: string;
  isHost?: boolean;
  team?: number;
}

export const MultiplayerMenu: React.FC<MultiplayerMenuProps> = ({
  visible,
  initialMode,
  onClose,
  onStartGame
}) => {
  const [menuMode, setMenuMode] = useState<'main' | 'queue' | 'host' | 'host-select' | 'game-mode' | 'map-select' | 'time-select' | 'join'>('main');
  const [queuedPlayers, setQueuedPlayers] = useState<QueuedPlayer[]>([]);
  const [roomId, setRoomId] = useState<string>('');
  const [inputRoomId, setInputRoomId] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [gameStarting, setGameStarting] = useState(false); // Track if we're starting a game
  const [selectedMap, setSelectedMap] = useState<'Classic' | 'Graveyard' | 'Meteor Shower' | 'Random' | 'Any'>('Any');
  const [deploymentTime, setDeploymentTime] = useState<60 | 180 | 300>(180); // seconds
  const [turnTime, setTurnTime] = useState<60 | 180 | 240 | 600 | 3600>(180); // seconds
  const [gameMode, setGameMode] = useState<'1v1' | 'ffa' | '2v2'>('ffa'); // Default to free for all
  const [teamAssignments, setTeamAssignments] = useState<{[playerId: string]: number}>({});

  // Handle initial mode when menu opens
  useEffect(() => {
    if (visible && initialMode) {
      if (initialMode === 'quickmatch') {
        // Actually call handleQuickMatch to connect
        handleQuickMatch();
      } else if (initialMode === 'host') {
        // Show host selection screen
        setMenuMode('host-select');
      } else if (initialMode === 'join') {
        setMenuMode('join');
      }
    } else if (!visible) {
      // Reset when closing
      setMenuMode('main');
      setQueuedPlayers([]);
      setRoomId('');
      setInputRoomId('');
      setIsSearching(false);
      setIsHost(false);
      
      // DON'T leave room if game has started or is starting - we need it for the game!
      // Only leave room if we're canceling before game starts
      // gameStarted flag is set true when dice roll begins, before deployment phase
      const gameStarted = gameStarting || // We're in the process of starting
                         currentRoom?.state?.gameStarted || 
                         currentRoom?.state?.gamePhase === 'deployment' || 
                         currentRoom?.state?.gamePhase === 'playing';
      
      if (currentRoom && !gameStarted) {
        logger.debug('Leaving room because game has not started');
        colyseusService.leaveRoom();
        setCurrentRoom(null);
      } else if (currentRoom && gameStarted) {
        logger.debug('NOT leaving room - game is active or starting', {
          gameStarting: gameStarting,
          gameStarted: currentRoom.state?.gameStarted,
          gamePhase: currentRoom.state?.gamePhase
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialMode]);

  // Generate random room ID
  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleQuickMatch = async () => {
    logger.debug("handleQuickMatch called");
    setMenuMode('queue');
    setIsSearching(true);
    
    try {
      logger.debug("Starting Quick Match...");
      logger.debug("colyseusService:", colyseusService);
      const room = await colyseusService.quickMatch('');
      logger.debug("Joined room:", room);
      setCurrentRoom(room);
      setRoomId(room.roomId);
      
      // Listen for state changes
      room.onStateChange((state) => {
        // Update players list
        const players: QueuedPlayer[] = [];
        let foundHost = false;
        state.players.forEach((player: any, id: string) => {
          const isThisPlayerHost = player.isHost;
          if (isThisPlayerHost) foundHost = true;
          
          players.push({
            id: id,
            name: player.name,
            isHost: isThisPlayerHost,
            team: player.team
          });
          
          // Check if this is the current player and they are the host
          if (id === room.sessionId && isThisPlayerHost) {
            setIsHost(true);
            logger.debug("You are the host!");
          }
        });
        setQueuedPlayers(players);
        setIsSearching(false); // Stop searching once we have players
        
        // Don't start game here - wait for gameStarted message
      });
      
      room.onMessage("canStartGame", () => {
        setIsSearching(false);
      });
      
      room.onMessage("gameStarted", (data) => {
        logger.debug("Game started message received:", data);
        logger.debug("Room session ID:", room.sessionId);
        
        // Mark that we're starting the game
        setGameStarting(true);
        
        // Get the latest players from room state
        const latestPlayers: QueuedPlayer[] = [];
        room.state.players.forEach((player: any, id: string) => {
          latestPlayers.push({
            id: id,
            name: player.name,
            isHost: player.isHost,
            isCurrentPlayer: id === room.sessionId
          });
        });
        
        logger.debug("Starting game with players:", latestPlayers);
        onStartGame(latestPlayers, room);
      });
      
      // Add error handler
      room.onError((code, message) => {
        logger.error("Room error:", code, message);
      });
      
      // Add leave handler
      room.onLeave((code) => {
        logger.debug("Left room with code:", code);
        if (code > 1000) { // Abnormal closure
          Alert.alert("Connection Lost", "Lost connection to game server");
        }
      });
      
    } catch (error) {
      logger.error("Failed to join quick match:", error);
      Alert.alert("Connection Error", "Failed to connect to game server");
      setIsSearching(false);
      onClose();
    }
  };

  // Host and join match are now handled in useEffect

  const attemptJoinRoom = async () => {
    if (inputRoomId.length < 1) {
      Alert.alert('Invalid Room ID', 'Please enter a Room ID');
      return;
    }
    
    setIsSearching(true);
    
    try {
      const room = await colyseusService.joinMatch(inputRoomId, '');
      setCurrentRoom(room);
      setRoomId(room.roomId);
      setMenuMode('queue');
      
      // Listen for state changes
      room.onStateChange((state) => {
        // Update players list
        const players: QueuedPlayer[] = [];
        state.players.forEach((player: any, id: string) => {
          players.push({
            id: id,
            name: player.name,
            isHost: player.isHost,
            team: player.team
          });
          
          // Check if this is the current player and they are the host
          if (id === room.sessionId && player.isHost) {
            setIsHost(true);
            logger.debug("You are the host!");
          }
        });
        setQueuedPlayers(players);
        
        // Don't start game here - wait for gameStarted message
      });
      
      // Listen for game start
      room.onMessage("gameStarted", (data) => {
        logger.debug("Game started message received in join:", data);
        setGameStarting(true);
        
        // Get the latest players from room state
        const latestPlayers: QueuedPlayer[] = [];
        room.state.players.forEach((player: any, id: string) => {
          latestPlayers.push({
            id: id,
            name: player.name,
            isHost: player.isHost,
            isCurrentPlayer: id === room.sessionId
          });
        });
        
        onStartGame(latestPlayers, room);
      });
      
      setIsSearching(false);
      
    } catch (error: any) {
      setIsSearching(false);
      Alert.alert(
        'Room Not Found', 
        `No active game found with Room ID: ${inputRoomId}`,
        [
          { text: 'Try Again', style: 'default' },
          { text: 'Cancel', style: 'cancel', onPress: onClose }
        ]
      );
      setInputRoomId('');
    }
  };

  const startGameFromQueue = () => {
    if (queuedPlayers.length >= 2 && currentRoom && isHost) {
      logger.debug("Host starting game...");
      // Send start game message to server
      currentRoom.send("startGame", {});
      // Don't call onStartGame here - wait for the server to broadcast gameStarted
      // The gameStarted handler will call onStartGame for all players
    }
  };

  // No main menu needed - we go directly to the appropriate mode
  
  const renderHostSelect = () => (
    <View style={styles.menuContent}>
      <Text style={styles.title}>Host Match</Text>
      <Text style={styles.instructionText}>Choose match visibility:</Text>
      
      <TouchableOpacity 
        style={[styles.menuButton, { marginVertical: 10 }]}
        onPress={() => {
          setIsPublic(true);
          setMenuMode('game-mode');
        }}
      >
        <Text style={styles.menuButtonText}>Public Match</Text>
        <Text style={styles.menuButtonSubtext}>Anyone can join via Quick Match</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.menuButton, { marginVertical: 10 }]}
        onPress={() => {
          setIsPublic(false);
          setMenuMode('game-mode');
        }}
      >
        <Text style={styles.menuButtonText}>Private Match</Text>
        <Text style={styles.menuButtonSubtext}>Players need Room ID to join</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderQueue = () => (
    <View style={styles.menuContent}>
      <Text style={styles.title}>Game Queue</Text>
      
      {roomId && (
        <View style={styles.roomIdContainer}>
          <Text style={styles.roomIdLabel}>Room ID: </Text>
          <Text style={styles.roomId}>{roomId}</Text>
        </View>
      )}
      
      <View style={styles.playerList}>
        <Text style={styles.playerListTitle}>
          Players ({queuedPlayers.length}/{gameMode === '1v1' ? 2 : 4}):
          {gameMode === '2v2' && ' (Teams)'}
        </Text>
        {queuedPlayers.map(player => (
          <View key={player.id} style={[
            styles.playerItem,
            gameMode === '2v2' && player.team === 1 && { borderLeftWidth: 4, borderLeftColor: '#4ECDC4' },
            gameMode === '2v2' && player.team === 2 && { borderLeftWidth: 4, borderLeftColor: '#ff6b6b' }
          ]}>
            <Text style={styles.playerName}>
              {gameMode === '2v2' && player.team && `[Team ${player.team}] `}
              {player.name} {player.isHost && '👑'}
            </Text>
          </View>
        ))}
      </View>
      
      {isSearching && (
        <View style={styles.searchingContainer}>
          <ActivityIndicator size="large" color="#00ff88" />
          <Text style={styles.searchingText}>Searching for players...</Text>
        </View>
      )}
      
      {isHost && queuedPlayers.length >= 2 && (
        <TouchableOpacity style={styles.startButton} onPress={startGameFromQueue}>
          <Text style={styles.startButtonText}>Start Game</Text>
        </TouchableOpacity>
      )}
      
      {!isHost && queuedPlayers.length >= 2 && (
        <Text style={styles.waitingText}>Waiting for host to start...</Text>
      )}
      
      {/* Debug info */}
      <Text style={styles.noteText}>Debug: isHost={isHost.toString()}, players={queuedPlayers.length}</Text>
      
      <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
        <Text style={styles.cancelButtonText}>Leave Queue</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHostMenu = () => (
    <View style={styles.menuContent}>
      <Text style={styles.title}>Hosting {isPublic ? 'Public' : 'Private'} Match</Text>
      
      <View style={styles.roomIdContainer}>
        <Text style={styles.roomIdLabel}>Room ID: </Text>
        <Text style={styles.roomId}>{roomId}</Text>
      </View>
      
      <Text style={styles.instructionText}>
        {isPublic 
          ? 'Your game is public. Players can join via Quick Match or Room ID.'
          : 'Your game is private. Only players with the Room ID can join.'}
      </Text>
      
      <View style={styles.playerList}>
        <Text style={styles.playerListTitle}>
          Players ({queuedPlayers.length}/{gameMode === '1v1' ? 2 : 4}):
          {gameMode === '2v2' && ' (Teams)'}
        </Text>
        {queuedPlayers.map(player => (
          <View key={player.id} style={[
            styles.playerItem,
            gameMode === '2v2' && player.team === 1 && { borderLeftWidth: 4, borderLeftColor: '#4ECDC4' },
            gameMode === '2v2' && player.team === 2 && { borderLeftWidth: 4, borderLeftColor: '#ff6b6b' }
          ]}>
            <Text style={styles.playerName}>
              {gameMode === '2v2' && player.team && `[Team ${player.team}] `}
              {player.name} {player.isHost && '👑'}
            </Text>
          </View>
        ))}
      </View>
      
      {queuedPlayers.length >= 2 && (
        <TouchableOpacity style={styles.startButton} onPress={startGameFromQueue}>
          <Text style={styles.startButtonText}>Start Game</Text>
        </TouchableOpacity>
      )}
      
      <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
        <Text style={styles.cancelButtonText}>Cancel Host</Text>
      </TouchableOpacity>
    </View>
  );

  const renderJoinMenu = () => (
    <View style={styles.menuContent}>
      <Text style={styles.title}>Join Match</Text>
      
      <Text style={styles.instructionText}>Enter the Room ID:</Text>
      
      <TextInput
        style={styles.roomIdInput}
        value={inputRoomId}
        onChangeText={setInputRoomId}
        placeholder="Room ID"
        placeholderTextColor="#666"
        autoCapitalize="characters"
        maxLength={12}
      />
      
      {isSearching ? (
        <ActivityIndicator size="large" color="#00ff88" />
      ) : (
        <TouchableOpacity 
          style={[styles.joinButton, inputRoomId.length < 1 && styles.disabledButton]}
          onPress={attemptJoinRoom}
          disabled={inputRoomId.length < 1}
        >
          <Text style={styles.joinButtonText}>Join Room</Text>
        </TouchableOpacity>
      )}
      
      <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderGameModeSelect = () => (
    <View style={styles.menuContent}>
      <Text style={styles.title}>Select Game Mode</Text>
      <Text style={styles.instructionText}>Choose the type of match:</Text>
      
      <TouchableOpacity
        style={[
          styles.menuButton,
          { marginVertical: 5 },
          gameMode === '1v1' && { borderColor: '#00ff88', borderWidth: 2 }
        ]}
        onPress={() => {
          setGameMode('1v1');
          setMenuMode('map-select');
        }}
      >
        <Text style={styles.menuButtonText}>1v1 Duel</Text>
        <Text style={styles.menuButtonSubtext}>Classic 2-player match</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.menuButton,
          { marginVertical: 5 },
          gameMode === 'ffa' && { borderColor: '#00ff88', borderWidth: 2 }
        ]}
        onPress={() => {
          setGameMode('ffa');
          setMenuMode('map-select');
        }}
      >
        <Text style={styles.menuButtonText}>Free For All</Text>
        <Text style={styles.menuButtonSubtext}>2-4 players, every commander for themselves</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.menuButton,
          { marginVertical: 5 },
          gameMode === '2v2' && { borderColor: '#00ff88', borderWidth: 2 }
        ]}
        onPress={() => {
          setGameMode('2v2');
          setMenuMode('map-select');
        }}
      >
        <Text style={styles.menuButtonText}>2v2 Teams</Text>
        <Text style={styles.menuButtonSubtext}>4 players in two teams, coordinate to win</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.cancelButton} onPress={() => setMenuMode('host-select')}>
        <Text style={styles.cancelButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMapSelect = () => (
    <View style={styles.menuContent}>
      <Text style={styles.title}>Select Map</Text>
      <Text style={styles.instructionText}>Choose a battlefield for your match:</Text>
      
      {(['Any', 'Classic', 'Graveyard', 'Meteor Shower', 'Random'] as const).map((mapType) => (
        <TouchableOpacity
          key={mapType}
          style={[
            styles.menuButton,
            { marginVertical: 5 },
            selectedMap === mapType && { borderColor: '#00ff88', borderWidth: 2 }
          ]}
          onPress={() => {
            setSelectedMap(mapType);
            setMenuMode('time-select');
          }}
        >
          <Text style={styles.menuButtonText}>{mapType}</Text>
          <Text style={styles.menuButtonSubtext}>
            {mapType === 'Any' && 'Let matchmaking decide'}
            {mapType === 'Classic' && 'Standard battlefield'}
            {mapType === 'Graveyard' && 'Debris fields block movement'}
            {mapType === 'Meteor Shower' && 'Meteors deal damage'}
            {mapType === 'Random' && 'Random mix of hazards'}
          </Text>
        </TouchableOpacity>
      ))}
      
      <TouchableOpacity style={styles.cancelButton} onPress={() => setMenuMode('host-select')}>
        <Text style={styles.cancelButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTimeSelect = () => (
    <View style={styles.menuContent}>
      <Text style={styles.title}>Time Controls</Text>
      
      <Text style={styles.sectionTitle}>Deployment Time</Text>
      <Text style={styles.instructionText}>Time for placing units during deployment:</Text>
      <View style={styles.buttonRow}>
        {[60, 180, 300].map((time) => (
          <TouchableOpacity
            key={time}
            style={[
              styles.timeButton,
              deploymentTime === time && styles.selectedTimeButton
            ]}
            onPress={() => setDeploymentTime(time)}
          >
            <Text style={[
              styles.timeButtonText,
              deploymentTime === time && styles.selectedTimeButtonText
            ]}>
              {time === 60 && '1 min'}
              {time === 180 && '3 min'}
              {time === 300 && '5 min'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Turn Time</Text>
      <Text style={styles.instructionText}>Time per turn during gameplay:</Text>
      <View style={styles.buttonGrid}>
        {[60, 180, 240, 600, 3600].map((time) => (
          <TouchableOpacity
            key={time}
            style={[
              styles.timeButton,
              turnTime === time && styles.selectedTimeButton
            ]}
            onPress={() => setTurnTime(time)}
          >
            <Text style={[
              styles.timeButtonText,
              turnTime === time && styles.selectedTimeButtonText
            ]}>
              {time === 60 && '1 min'}
              {time === 180 && '3 min'}
              {time === 240 && '4 min'}
              {time === 600 && '10 min'}
              {time === 3600 && '1 hour'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <TouchableOpacity 
        style={[styles.startButton, { marginTop: 20 }]}
        onPress={async () => {
          setIsSearching(true);
          try {
            const room = await colyseusService.hostMatch('', isPublic, {
              mapType: selectedMap,
              deploymentTime,
              turnTime,
              gameMode
            });
            setCurrentRoom(room);
            setRoomId(room.roomId);
            setIsHost(true);
            setMenuMode('host');
            logger.debug(`${isPublic ? 'Public' : 'Private'} room created with ID:`, room.roomId);
            
            // Listen for state changes
            room.onStateChange((state) => {
              const players: QueuedPlayer[] = [];
              state.players.forEach((player: any, id: string) => {
                players.push({
                  id: id,
                  name: player.name,
                  isHost: player.isHost,
                  team: player.team
                });
              });
              setQueuedPlayers(players);
              
              // Update game mode from state if available
              if (state.gameMode) {
                setGameMode(state.gameMode);
              }
            });
            
            // Listen for game start
            room.onMessage("gameStarted", (data) => {
              logger.debug("Game started message received in host:", data);
              setGameStarting(true);
              
              // Get the latest players from room state
              const latestPlayers: QueuedPlayer[] = [];
              room.state.players.forEach((player: any, id: string) => {
                latestPlayers.push({
                  id: id,
                  name: player.name,
                  isHost: player.isHost,
                  isCurrentPlayer: id === room.sessionId
                });
              });
              
              onStartGame(latestPlayers, room);
            });
            
            setIsSearching(false);
          } catch (error) {
            Alert.alert("Error", "Failed to create room");
            setIsSearching(false);
            onClose();
          }
        }}
      >
        <Text style={styles.startButtonText}>Create Room</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.cancelButton} onPress={() => setMenuMode('map-select')}>
        <Text style={styles.cancelButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    switch (menuMode) {
      case 'queue':
        return renderQueue();
      case 'host-select':
        return renderHostSelect();
      case 'game-mode':
        return renderGameModeSelect();
      case 'map-select':
        return renderMapSelect();
      case 'time-select':
        return renderTimeSelect();
      case 'host':
        return renderHostMenu();
      case 'join':
        return renderJoinMenu();
      default:
        // If no mode set, close the menu
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {renderContent() || <View />}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#00ff88',
  },
  
  menuContent: {
    alignItems: 'center',
  },
  
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00ff88',
    marginBottom: 20,
  },
  
  menuButton: {
    backgroundColor: '#0f3460',
    padding: 15,
    borderRadius: 8,
    marginVertical: 5,
    width: '100%',
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  
  halfButton: {
    width: '48%',
  },
  
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 5,
  },
  
  menuButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  
  menuButtonSubtext: {
    color: '#aaaaaa',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  
  cancelButton: {
    marginTop: 20,
    padding: 10,
  },
  
  cancelButtonText: {
    color: '#ff6b6b',
    fontSize: 16,
  },
  
  roomIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
    padding: 10,
    backgroundColor: '#0f3460',
    borderRadius: 8,
  },
  
  roomIdLabel: {
    color: '#aaaaaa',
    fontSize: 16,
  },
  
  roomId: {
    color: '#00ff88',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  
  playerList: {
    width: '100%',
    marginVertical: 15,
  },
  
  playerListTitle: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 10,
  },
  
  playerItem: {
    backgroundColor: '#0f3460',
    padding: 10,
    borderRadius: 6,
    marginVertical: 2,
  },
  
  playerName: {
    color: '#ffffff',
    fontSize: 14,
  },
  
  searchingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  
  searchingText: {
    color: '#aaaaaa',
    marginTop: 10,
  },
  
  startButton: {
    backgroundColor: '#00ff88',
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
    width: '100%',
  },
  
  startButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  
  waitingText: {
    color: '#aaaaaa',
    fontSize: 14,
    marginVertical: 10,
  },
  
  instructionText: {
    color: '#aaaaaa',
    fontSize: 14,
    marginVertical: 10,
    textAlign: 'center',
  },
  
  roomIdInput: {
    backgroundColor: '#0f3460',
    color: '#ffffff',
    fontSize: 20,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff88',
    width: '100%',
    textAlign: 'center',
    marginVertical: 15,
    letterSpacing: 2,
  },
  
  joinButton: {
    backgroundColor: '#00ff88',
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
    width: '100%',
  },
  
  joinButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  
  disabledButton: {
    backgroundColor: '#444444',
    opacity: 0.5,
  },
  
  noteText: {
    color: '#666666',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 5,
    textAlign: 'center',
  },
  
  sectionTitle: {
    color: '#00ff88',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  
  timeButton: {
    backgroundColor: '#0f3460',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 5,
    flex: 1,
    borderWidth: 1,
    borderColor: '#555',
  },
  
  selectedTimeButton: {
    borderColor: '#00ff88',
    borderWidth: 2,
    backgroundColor: '#1a4d2e',
  },
  
  timeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  
  selectedTimeButtonText: {
    color: '#00ff88',
  },
  
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 5,
  },
});