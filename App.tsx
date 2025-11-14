/**
 * Space Hex Mobile - Main Application Entry Point
 * Phase 1: Core Setup with Game Engine and Basic Rendering
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Dimensions,
  Platform,
  StatusBar,
  TouchableOpacity,
  Alert
} from 'react-native';
import { logger } from './src/utils/Logger';
import { HexGameBoard } from './src/components/HexGameBoard';
import { SimpleLobby } from './src/components/ui/SimpleLobby';
import { FleetPool } from './src/components/ui/FleetPool';
import { MultiplayerMenu } from './src/components/ui/MultiplayerMenu';
import { SplashScreen } from './src/components/ui/SplashScreen';
import { MovementPatternEditor } from './src/components/MovementPatternEditor';
import { testMovementConsistency } from './src/utils/testMovementConsistency';
import { Client } from 'colyseus.js';

// Get initial screen dimensions
const initialDimensions = Dimensions.get('window');

// Create Colyseus client instance
const serverUrl = __DEV__ 
  ? 'ws://localhost:2567' 
  : 'wss://your-production-server.com';
const client = new Client(serverUrl);

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true); // Show splash screen on initial load
  const [showMultiplayer, setShowMultiplayer] = useState(true); // Default to multiplayer menu
  const [gamePhase, setGamePhase] = useState('lobby');
  const [playerCount, setPlayerCount] = useState(0);
  const [inActiveGame, setInActiveGame] = useState(false); // Track if we're in an actual game
  const [selectedShip, setSelectedShip] = useState<any>(null); // Selected ship for deployment
  const [players, setPlayers] = useState<any[]>([]); // Players in the game
  const [gameType, setGameType] = useState(''); // Track game type (ai, multiplayer, campaign)
  const [deployedShips, setDeployedShips] = useState<any[]>([]); // Track deployed ships
  const [allShipsDeployed, setAllShipsDeployed] = useState(false); // Track if all ships are deployed
  const [aiShipsToDeploy, setAIShipsToDeploy] = useState<any>(null); // AI ships to deploy
  const [mapType, setMapType] = useState('Classic'); // Track selected map type
  const [gameEnded, setGameEnded] = useState(false); // Track if game has ended
  const [gameResult, setGameResult] = useState(''); // Track game result (won/lost)
  const [pendingGameEnd, setPendingGameEnd] = useState<any>(null); // Store game end data while waiting for animations
  const [showDrawOffer, setShowDrawOffer] = useState(false); // Show draw offer from other player
  const [currentShipCounts, setCurrentShipCounts] = useState({ human: 0, ai: 0 }); // Track ship counts
  const [showMultiplayerMenu, setShowMultiplayerMenu] = useState<boolean | string>(false); // Show multiplayer menu with mode
  const [drawRefusalMessage, setDrawRefusalMessage] = useState(''); // Draw refusal message
  const [deploymentConfirmed, setDeploymentConfirmed] = useState(false);
  const [autoDeployTrigger, setAutoDeployTrigger] = useState(0); // Deployment confirmed flag
  const [showResignConfirm, setShowResignConfirm] = useState(false); // Show resign confirmation popup
  const [showAdminTool, setShowAdminTool] = useState(false); // Show admin movement pattern editor
  const [drawOfferFrom, setDrawOfferFrom] = useState(''); // Who offered the draw
  const [currentTurn, setCurrentTurn] = useState(''); // Whose turn it is
  const [turnNumber, setTurnNumber] = useState(0); // Current turn number
  const [isSpectator, setIsSpectator] = useState(false); // Whether player is spectating after resignation
  const [resignationMessage, setResignationMessage] = useState(''); // Message about who resigned
  const [gameReviewMode, setGameReviewMode] = useState(false); // Game review mode
  const [reviewMoveIndex, setReviewMoveIndex] = useState(0); // Current move index in review
  const [reviewShips, setReviewShips] = useState<any[]>([]); // Ships state during review
  const [initialShipsSnapshot, setInitialShipsSnapshot] = useState<any[]>([]); // Initial ships before any moves
  const [playerNotification, setPlayerNotification] = useState<{title: string, message: string} | null>(null); // Generic player notifications
  const [timerInfo, setTimerInfo] = useState<{currentTurn?: string, timers?: any, playerId?: string, timeRemaining?: number, phase: string} | null>(null); // Timer information
  const [dimensions, setDimensions] = useState(initialDimensions); // Dynamic dimensions tracking
  
  // Use refs to store functions that need access to latest state
  const gamePhaseRef = useRef(gamePhase);
  const playersRef = useRef(players);
  
  // Update refs when state changes
  useEffect(() => {
    gamePhaseRef.current = gamePhase;
  }, [gamePhase]);
  
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  // Listen for dimension changes
  useEffect(() => {
    const updateDimensions = ({ window }: { window: any }) => {
      setDimensions(window);
    };

    const subscription = Dimensions.addEventListener('change', updateDimensions);
    
    return () => {
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    // Initialize app
    initializeApp();
    
    // Set up global callbacks for HexGameBoard to notify us of game events
    (window as any).setGamePhaseCallback = (phase: string) => {
      logger.debug('Global setGamePhaseCallback called with phase:', phase);
      setGamePhase(phase);
    };
    
    (window as any).handleDrawOfferCallback = (data: any) => {
      logger.debug('Draw offer callback:', data);
      const fromPlayer = playersRef.current.find(p => p.id === data.from);
      setDrawOfferFrom(fromPlayer?.name || 'Opponent');
      setShowDrawOffer(true);
    };
    
    (window as any).handleDrawRefusedCallback = () => {
      setDrawRefusalMessage('Your draw offer was refused.');
    };
    
    (window as any).handleGameEndedCallback = (data: any) => {
      const room = (window as any).currentRoom;
      
      // IMPORTANT: Save game data for review before room potentially closes
      if (room && room.state) {
        // Save move history
        const moveHistoryArray: any[] = [];
        if (room.state.moveHistory) {
          room.state.moveHistory.forEach((move: any) => {
            moveHistoryArray.push({
              turnNumber: move.turnNumber,
              playerId: move.playerId,
              playerName: move.playerName,
              action: move.action,
              shipId: move.shipId,
              shipType: move.shipType,
              fromCol: move.fromCol,
              fromRow: move.fromRow,
              toCol: move.toCol,
              toRow: move.toRow,
              fromOrientation: move.fromOrientation,
              toOrientation: move.toOrientation,
              targetShipId: move.targetShipId,
              result: move.result,
              timestamp: move.timestamp
            });
          });
        }
        (window as any).savedMoveHistory = moveHistoryArray;
        logger.debug('Saved move history for review:', moveHistoryArray.length, 'moves');
        
        // Also save final ships state
        const finalShips: any[] = [];
        if (room.state.ships) {
          room.state.ships.forEach((ship: any) => {
            if (ship && ship.position) {
              finalShips.push({
                id: ship.id,
                type: ship.type,
                color: ship.color,
                owner: ship.owner,
                position: { col: ship.position.col, row: ship.position.row },
                orientation: ship.orientation || 0,
                rotation: ship.rotation || 0
              });
            }
          });
        }
        (window as any).finalShipState = finalShips;
      }
      
      // Store the game end data but don't show the screen yet
      setPendingGameEnd(data);
      setGamePhase('ended');
      // DON'T set inActiveGame to false yet - keep showing the game board
      // setInActiveGame(false); // Removed - wait for animations
      
      // Check if there are animations running
      const animatingShips = (window as any).animatingShipsCount || 0;
      if (animatingShips > 0) {
        // Wait for animations to complete via the callback
        logger.debug('Waiting for ship animations to complete before showing game end...');
      } else {
        // No animations, wait 2 seconds anyway for the death to be visible
        setTimeout(() => {
          setGameEnded(true);
        }, 2000);
      }
    };
    
    // Handle animations complete callback
    (window as any).onAnimationsComplete = () => {
      // If we have a pending game end and animations are done, show the screen
      if (pendingGameEnd && !gameEnded) {
        // Wait a moment for the destruction to be visible
        setTimeout(() => {
          setGameEnded(true);
        }, 1000);
      }
    };
    
    return () => {
      delete (window as any).setGamePhaseCallback;
      delete (window as any).handleDrawOfferCallback;
      delete (window as any).handleDrawRefusedCallback;
      delete (window as any).handleGameEndedCallback;
      delete (window as any).handlePlayerResignedCallback;
      delete (window as any).handlePlayerEliminatedCallback;
      delete (window as any).handleTurnChangeCallback;
      delete (window as any).onAnimationsComplete;
    };
  }, [pendingGameEnd, gameEnded]);
  
  // Process pending game end when it's time to show the screen
  useEffect(() => {
    if (gameEnded && pendingGameEnd) {
      const data = pendingGameEnd;
      const room = (window as any).currentRoom;
      
      if (data.result === 'draw') {
        setGameResult('Game ended in a draw.');
      } else if (data.reason === 'opponentTimeout') {
        // Game ended because opponent ran out of time
        if (room && data.winner === room.sessionId) {
          setGameResult('Victory! Your opponent ran out of time!');
        } else if (data.winningTeam && data.winningPlayers?.some((p: any) => p.id === room?.sessionId)) {
          setGameResult('Victory! The opposing team ran out of time!');
        } else {
          setGameResult('Defeat! You ran out of time.');
          setIsSpectator(true);
        }
      } else if (data.reason === 'teamVictory') {
        // Team victory (2v2)
        if (data.winningPlayers?.some((p: any) => p.id === room?.sessionId)) {
          setGameResult(`Victory! Team ${data.winningTeam} wins!`);
        } else {
          setGameResult(`Defeat! Team ${data.winningTeam} won the match.`);
          setIsSpectator(true);
        }
      } else if (data.reason === 'lastRemaining') {
        // Game ended because only one player remains (others eliminated or resigned)
        if (room && data.winner === room.sessionId) {
          setGameResult('Victory! You are the last player with ships remaining!');
        } else {
          setGameResult(`${data.winnerName || 'Another player'} won as the last survivor!`);
          setIsSpectator(true); // Allow spectating
        }
      } else if (data.reason === 'allEliminated') {
        // Everyone was eliminated somehow
        setGameResult('Game ended - all players eliminated!');
      } else if (data.reason === 'resignation') {
        // Old resignation logic (shouldn't happen with new system)
        const resignedPlayerId = data.resignedPlayerId || '';
        if (room && resignedPlayerId === room.sessionId) {
          setGameResult('You resigned. You lost!');
        } else if (room && data.winner === room.sessionId) {
          setGameResult(`You won! ${data.resignedPlayer} resigned.`);
        } else {
          setGameResult(`${data.winnerName} won! ${data.resignedPlayer} resigned.`);
        }
      }
      
      logger.info('UI', 'Game ended', data);
      setPendingGameEnd(null); // Clear pending data after processing
    }
  }, [gameEnded, pendingGameEnd]);
  
  useEffect(() => {
    // Additional game event handlers
    (window as any).handlePlayerResignedCallback = (data: any) => {
      const room = (window as any).currentRoom;
      if (room) {
        if (data.playerId === room.sessionId) {
          // This player resigned
          setIsSpectator(true);
          setGameEnded(true);
          setGameResult('You resigned. You lost!');
          logger.info('UI', 'You resigned', data);
        } else {
          // Another player resigned
          const message = `Player ${data.playerNumber} (${data.playerName}) has resigned. ${data.remainingPlayers} players remaining.`;
          setResignationMessage(message);
          logger.info('UI', 'Other player resigned', data);
          
          // Clear message after 5 seconds
          setTimeout(() => setResignationMessage(''), 5000);
        }
      }
    };
    
    (window as any).handlePlayerEliminatedCallback = (data: any) => {
      const room = (window as any).currentRoom;
      if (room) {
        if (data.playerId === room.sessionId) {
          // This player was eliminated
          setIsSpectator(true);
          setGameEnded(true);
          setGameResult('You have been eliminated! All your ships were destroyed.');
          logger.info('UI', 'You were eliminated', data);
        } else {
          // Another player was eliminated
          const message = `Player ${data.playerNumber} (${data.playerName}) has been eliminated!`;
          setPlayerNotification({
            title: 'Player Eliminated',
            message: message
          });
          logger.info('UI', 'Other player eliminated', data);
          
          // Clear notification after 5 seconds
          setTimeout(() => setPlayerNotification(null), 5000);
        }
      }
    };
    
    (window as any).handleTurnChangeCallback = (data: any) => {
      setCurrentTurn(data.currentTurn);
      setTurnNumber(data.turnNumber);
      logger.debug('Turn changed to:', data.currentTurn, 'Turn #', data.turnNumber);
    };
    
    (window as any).handleTimerUpdateCallback = (data: any) => {
      setTimerInfo(data);
    };
    
    return () => {
      delete (window as any).handlePlayerResignedCallback;
      delete (window as any).handlePlayerEliminatedCallback;
      delete (window as any).handleTurnChangeCallback;
      delete (window as any).handleTimerUpdateCallback;
    };
  }, []);

  const initializeApp = async () => {
    try {
      logger.info('UI', 'Initializing Feudal Space Mobile App');
      
      // Simple initialization - just set ready state
      setPlayerCount(0); // No players until a game starts
      setIsReady(true);
      
      logger.info('UI', 'App initialization complete');
    } catch (error) {
      logger.error('UI', 'App initialization failed', error);
      Alert.alert('Error', 'Failed to initialize game');
    }
  };

  const handleStartDeployment = () => {
    setGamePhase('deployment');
    logger.info('UI', 'Starting deployment phase');
  };

  const handleMultiplayerGameStart = (session: any) => {
    // Handle multiplayer game start (including AI games using multiplayer system)
    if (session.room) {
      const currentPlayerId = session.currentPlayerId || session.room.sessionId;
      
      // Get the initial players from the Colyseus server state
      let gamePlayers: any[] = [];
      if (session.room.state && session.room.state.players) {
        // Pull the names directly from Colyseus server state
        logger.debug('Getting players from Colyseus server state');
        session.room.state.players.forEach((player: any, id: string) => {
          logger.debug(`Colyseus Player ${id}: name="${player.name}", isHost=${player.isHost}, isAI=${player.isAI}`);
          gamePlayers.push({
            id: id,
            name: player.name,
            isAI: player.isAI || false,
            assignedZone: player.assignedZone,
            isCurrentPlayer: id === currentPlayerId,
            isHost: player.isHost
          });
        });
      }
      
      logger.debug('Setting players to:', gamePlayers);
      setPlayers(gamePlayers);
      setPlayerCount(gamePlayers.length);
      
      // Store current player ID and room for later use
      (window as any).currentPlayerId = currentPlayerId;
      (window as any).currentRoom = session.room;
      
      logger.debug('Multiplayer game started', { 
        currentPlayerId, 
        players: gamePlayers,
        room: session.room.id
      });
      
      // Start with dice roll phase for zone selection
      setGamePhase('diceRoll');
    }
  };

  const handleGameStart = async (session: any) => {
    logger.debug('handleGameStart called with session:', session);
    setShowMultiplayer(false);
    setInActiveGame(true);
    setGameType(session.type);
    setMapType(session.mapType || 'Classic');
    
    // Clear any previous game data when starting a new game
    (window as any).gameInitialShipState = null;
    (window as any).savedMoveHistory = null;
    (window as any).finalShipState = null;
    logger.debug('Cleared previous game data for new game');
    
    // Set up players based on game type
    if (session.type === 'ai') {
      // Connect to AI game room using the same multiplayer system
      try {
        const room = await client.joinOrCreate('ai_game', {
          difficulty: session.difficulty || 'medium',
          deploymentTime: session.deploymentTime || 180,
          turnTime: session.turnTime || 180,
          mapType: session.mapType || 'Classic'
        });
        
        logger.debug('Connected to AI game room:', (room as any).id);
        
        // Store room reference
        (window as any).currentRoom = room;
        
        // Keep game type as 'ai' but use multiplayer mechanics
        setGameType('ai');
        (window as any).gameType = 'ai';
        (window as any).isAIGame = true; // Flag for AI game
        
        // Set up session like multiplayer
        session.room = room;
        session.type = 'multiplayer';
        session.currentPlayerId = room.sessionId;
        
        // Continue with multiplayer setup
        handleMultiplayerGameStart(session);
        return;
      } catch (error) {
        console.error('Failed to connect to AI game:', error);
        Alert.alert('Connection Error', 'Failed to start AI game');
        return;
      }
    }
    
    if (session.type === 'ai_local') {
      const gamePlayers = [
        { id: 'player1', name: 'You', isAI: false, assignedZone: 1 },
        { id: 'ai1', name: 'AI Commander', isAI: true, assignedZone: 2 }
      ];
      setPlayers(gamePlayers);
      setPlayerCount(2);
      
      // Set initial turn to human player
      (window as any).currentTurn = 'player1';
      
      // Store game settings for timers
      if (session.deploymentTime) {
        (window as any).deploymentTime = session.deploymentTime;
      }
      if (session.turnTime) {
        (window as any).turnTime = session.turnTime;
      }
      
      // Store difficulty for AI controller
      (window as any).aiDifficulty = session.difficulty || 'medium';
      
      logger.debug('AI game initialized with settings:', {
        deploymentTime: session.deploymentTime,
        turnTime: session.turnTime,
        difficulty: session.difficulty
      });
      
      // Initialize human player ships for deployment
      const humanShips = [
        { id: 'human_mothership', type: 'mothership', color: 'Red' },
        { id: 'human_battleship', type: 'battleship', color: 'Red' },
        { id: 'human_cruiser1', type: 'cruiser', color: 'Red' },
        { id: 'human_cruiser2', type: 'cruiser', color: 'Red' },
        { id: 'human_destroyer1', type: 'destroyer', color: 'Red' },
        { id: 'human_destroyer2', type: 'destroyer', color: 'Red' },
        { id: 'human_corvette1', type: 'corvette', color: 'Red' },
        { id: 'human_corvette2', type: 'corvette', color: 'Red' },
        { id: 'human_interceptor1', type: 'interceptor', color: 'Red' },
        { id: 'human_interceptor2', type: 'interceptor', color: 'Red' },
        { id: 'human_scout1', type: 'scout', color: 'Red' },
        { id: 'human_scout2', type: 'scout', color: 'Red' },
        { id: 'human_frigate1', type: 'frigate', color: 'Red' },
        { id: 'human_frigate2', type: 'frigate', color: 'Red' }
      ];
      
      (window as any).shipsToPlace = humanShips;
      
      // Initialize AI ships for deployment
      const aiShips = [
        { id: 'ai_mothership', type: 'mothership', color: 'Blue' },
        { id: 'ai_battleship', type: 'battleship', color: 'Blue' },
        { id: 'ai_cruiser1', type: 'cruiser', color: 'Blue' },
        { id: 'ai_cruiser2', type: 'cruiser', color: 'Blue' },
        { id: 'ai_destroyer1', type: 'destroyer', color: 'Blue' },
        { id: 'ai_destroyer2', type: 'destroyer', color: 'Blue' },
        { id: 'ai_corvette1', type: 'corvette', color: 'Blue' },
        { id: 'ai_corvette2', type: 'corvette', color: 'Blue' },
        { id: 'ai_interceptor1', type: 'interceptor', color: 'Blue' },
        { id: 'ai_interceptor2', type: 'interceptor', color: 'Blue' },
        { id: 'ai_scout1', type: 'scout', color: 'Blue' },
        { id: 'ai_scout2', type: 'scout', color: 'Blue' },
        { id: 'ai_frigate1', type: 'frigate', color: 'Blue' },
        { id: 'ai_frigate2', type: 'frigate', color: 'Blue' }
      ];
      
      (window as any).aiShipsToDeploy = aiShips;
      setAIShipsToDeploy(aiShips);
    } else if (session.type === 'multiplayer' && session.players && session.room) {
      // Use actual multiplayer player data
      const currentPlayerId = session.currentPlayerId || session.room.sessionId;
      
      // Get the initial players from the Colyseus server state
      let gamePlayers: any[] = [];
      if (session.room.state && session.room.state.players) {
        // Pull the names directly from Colyseus server state
        logger.debug('Getting players from Colyseus server state');
        session.room.state.players.forEach((player: any, id: string) => {
          logger.debug(`Colyseus Player ${id}: name="${player.name}", isHost=${player.isHost}`);
          gamePlayers.push({
            id: id,
            name: player.name, // This is "Player 1", "Player 2" etc from Colyseus
            isAI: player.isAI || false,
            assignedZone: player.assignedZone,
            isCurrentPlayer: id === currentPlayerId,
            isHost: player.isHost
          });
        });
      } else {
        // Fallback if state not ready yet
        logger.debug('Colyseus state not ready, using session players');
        gamePlayers = session.players.map((p: any) => ({
          id: p.id,
          name: p.name,
          isAI: p.isAI || false,
          assignedZone: p.assignedZone,
          isCurrentPlayer: p.isCurrentPlayer || p.id === currentPlayerId
        }));
      }
      
      logger.debug('Setting players to:', gamePlayers);
      setPlayers(gamePlayers);
      setPlayerCount(gamePlayers.length);
      
      // Store current player ID and room for later use
      (window as any).currentPlayerId = currentPlayerId;
      (window as any).currentRoom = session.room;
      
      logger.debug('Multiplayer game started', { 
        currentPlayerId, 
        players: gamePlayers,
        room: session.room.id,
        roomObject: session.room
      });
      
      // Listen for player state changes to sync names from Colyseus
      if (session.room.state && session.room.state.players) {
        // Sync when a player is added
        session.room.state.players.onAdd = (player: any, key: string) => {
          logger.debug(`Colyseus onAdd - Player ${key}: name="${player.name}"`);
          setPlayers(prevPlayers => {
            // Check if player exists
            const existingIndex = prevPlayers.findIndex(p => p.id === key);
            if (existingIndex >= 0) {
              // Update existing player with Colyseus data
              const updated = [...prevPlayers];
              updated[existingIndex] = {
                ...updated[existingIndex],
                name: player.name, // Use the name from Colyseus
                assignedZone: player.assignedZone,
                isHost: player.isHost
              };
              logger.debug('Updated existing player:', updated[existingIndex]);
              return updated;
            } else {
              // Add new player from Colyseus
              const newPlayer = {
                id: key,
                name: player.name, // Use the name from Colyseus
                isAI: player.isAI || false,
                assignedZone: player.assignedZone,
                isCurrentPlayer: key === currentPlayerId,
                isHost: player.isHost
              };
              logger.debug('Added new player:', newPlayer);
              return [...prevPlayers, newPlayer];
            }
          });
        };
        
        // Sync when player data changes
        session.room.state.players.onChange = (player: any, key: string) => {
          logger.debug(`Colyseus onChange - Player ${key}: name="${player.name}", zone=${player.assignedZone}`);
          setPlayers(prevPlayers => {
            const updated = prevPlayers.map(p => 
              p.id === key 
                ? { 
                    ...p, 
                    name: player.name, // Always use the name from Colyseus
                    assignedZone: player.assignedZone,
                    isHost: player.isHost 
                  } 
                : p
            );
            logger.debug('Players after onChange:', updated);
            return updated;
          });
        };
        
        // Also listen for the full state change to ensure sync
        session.room.onStateChange((state: any) => {
          if (state.players) {
            logger.debug('Colyseus full state change - syncing all players');
            const syncedPlayers: any[] = [];
            state.players.forEach((player: any, id: string) => {
              logger.debug(`  Player ${id}: name="${player.name}"`);
              syncedPlayers.push({
                id: id,
                name: player.name, // Use Colyseus names
                isAI: player.isAI || false,
                assignedZone: player.assignedZone,
                isCurrentPlayer: id === currentPlayerId,
                isHost: player.isHost
              });
            });
            setPlayers(syncedPlayers);
          }
        });
      }
      
      // HexGameBoard will handle all the message listeners
      // We just store the room reference for later use
      logger.debug('Room stored in window.currentRoom, HexGameBoard will handle listeners');
    } else {
      // Default multiplayer setup
      setPlayers([
        { id: 'player1', name: 'Player 1', isAI: false },
        { id: 'player2', name: 'Player 2', isAI: false }
      ]);
      setPlayerCount(2);
    }
    
    setGamePhase('diceRoll');
    logger.info('UI', 'Starting game', { sessionId: session.sessionId, type: session.type, mapType: session.mapType });
  };

  const handleCampaignStart = (campaignId: string, scenarioId: string) => {
    setShowMultiplayer(false);
    setInActiveGame(true);
    setGameType('campaign');
    setPlayers([
      { id: 'player1', name: 'Cadet', isAI: false },
      { id: 'ai1', name: 'Training AI', isAI: true }
    ]);
    setPlayerCount(2);
    setGamePhase('deployment');
    logger.info('UI', 'Starting campaign scenario', { campaignId, scenarioId });
  };

  const deployAIFleet = async () => {
    // Deploy AI fleet to its assigned zone
    logger.info('UI', 'AI deploying fleet...');
    
    const aiPlayer = players.find(p => p.isAI);
    if (aiPlayer && aiPlayer.assignedZone) {
      // Create AI ships and notify HexGameBoard to deploy them
      const aiShips = [
        { type: 'mothership', count: 1 },
        { type: 'scout', count: 2 },
        { type: 'interceptor', count: 2 },
        { type: 'corvette', count: 2 },
        { type: 'frigate', count: 2 },
        { type: 'destroyer', count: 1 },
        { type: 'cruiser', count: 1 }
      ];
      
      // Signal to HexGameBoard to deploy AI ships
      setAIShipsToDeploy(aiShips);
    }
    
    // After AI deployment, start the game
    setTimeout(() => {
      setGamePhase('playing');
      logger.info('UI', 'Game started - moving to play phase');
    }, 2000);
  };

  const handleResign = () => {
    logger.debug('RESIGN BUTTON PRESSED');
    
    if (gameType === 'multiplayer') {
      // Send resign message to server
      const room = (window as any).currentRoom;
      if (room) {
        room.send("resign", {});
        logger.info('UI', 'Player resigned from multiplayer game');
        // Don't set the result here - let the server handle it via gameEnded message
        return;
      }
    }
    
    // Only for single player games
    setGameEnded(true);
    setGameResult('You resigned. You lost!');
    setGamePhase('ended');
    setInActiveGame(false);
    logger.info('UI', 'Player resigned from game');
  };

  const handleDrawOffer = () => {
    if (gameType === 'campaign') {
      setDrawRefusalMessage('AI refuses draw offers in campaign mode.');
      return;
    }
    
    if (gameType === 'multiplayer') {
      // Send draw offer to other players via Colyseus
      const room = (window as any).currentRoom;
      if (room) {
        room.send("offerDraw", {});
        setDrawRefusalMessage('Draw offer sent. Waiting for opponent response...');
        logger.info('UI', 'Draw offer sent to other players');
      }
      return;
    }

    // AI logic: refuse draw if it has equal or more ships
    const { human, ai } = currentShipCounts;
    const aiHasAdvantage = ai >= human;
    
    if (aiHasAdvantage) {
      setDrawRefusalMessage(`AI refuses your draw offer. (AI: ${ai} ships, You: ${human} ships)`);
      logger.info('UI', 'Draw offer refused by AI - has advantage', { human, ai });
    } else {
      // AI accepts if it's behind
      setGameEnded(true);
      setGameResult('Draw accepted. Game ended in a draw.');
      setGamePhase('ended');
      setInActiveGame(false);
      logger.info('UI', 'Draw offer accepted - AI was behind', { human, ai });
    }
  };
  
  const handleAcceptDraw = () => {
    const room = (window as any).currentRoom;
    if (room) {
      room.send("acceptDraw", {});
    }
    setShowDrawOffer(false);
    setGameEnded(true);
    setGameResult('Draw accepted. Game ended in a draw.');
    setGamePhase('ended');
    setInActiveGame(false);
    logger.info('UI', 'Draw offer accepted');
  };
  
  const handleRefuseDraw = () => {
    const room = (window as any).currentRoom;
    if (room) {
      room.send("refuseDraw", {});
    }
    setShowDrawOffer(false);
    logger.info('UI', 'Draw offer refused');
  };
  
  const handleAutoDeploy = () => {
    // Trigger auto-deploy in HexGameBoard by incrementing the trigger
    setAutoDeployTrigger(prev => prev + 1);
    logger.info('UI', 'Auto-deploy triggered');
  };
  

  // Function to group moves by turn
  const groupMovesByTurn = () => {
    const moveHistory = (window as any).savedMoveHistory;
    if (!moveHistory) return [];
    
    const turns = [];
    let currentTurn = [];
    let currentTurnNumber = -1;
    
    for (const move of moveHistory) {
      if (move.turnNumber !== currentTurnNumber) {
        if (currentTurn.length > 0) {
          turns.push(currentTurn);
        }
        currentTurn = [];
        currentTurnNumber = move.turnNumber;
      }
      currentTurn.push(move);
    }
    
    // Add the last turn (including the final move that takes the command ship)
    if (currentTurn.length > 0) {
      turns.push(currentTurn);
    }
    
    return turns;
  };

  // Function to reconstruct game state at a specific turn
  const reconstructGameStateAtTurn = (turnIndex: number, animate: boolean = true) => {
    // Use saved move history instead of room state (which might be gone)
    const moveHistory = (window as any).savedMoveHistory;
    if (!moveHistory) {
      logger.debug('No saved move history available');
      return;
    }
    
    const turns = groupMovesByTurn();
    logger.debug(`Reconstructing game state at turn ${turnIndex + 1} of ${turns.length}`);
    
    // Start with initial ships state - use the saved one from window or state
    const savedInitialState = (window as any).gameInitialShipState || initialShipsSnapshot;
    if (!savedInitialState || savedInitialState.length === 0) {
      console.error('No initial ship state available for reconstruction');
      return;
    }
    
    let currentShips = [...savedInitialState];
    let currentDebrisFields = []; // Track debris fields created up to this turn
    
    // If turnIndex is -1, show initial state
    if (turnIndex === -1) {
      setReviewShips(currentShips);
      if ((window as any).setReviewShipsCallback) {
        (window as any).setReviewShipsCallback(currentShips);
      }
      if ((window as any).setReviewDebrisFields) {
        (window as any).setReviewDebrisFields([]);
      }
      return;
    }
    
    // Apply all moves up to the end of the specified turn
    for (let t = 0; t <= turnIndex && t < turns.length; t++) {
      const turnMoves = turns[t];
      
      // If this is the current turn being viewed and animate is true, 
      // we'll animate these moves
      const isCurrentTurn = (t === turnIndex && animate);
      const movesToAnimate = [];
      
      for (const move of turnMoves) {
        if (!move) {
          console.warn(`Move is undefined`);
          continue;
        }
        
        // Store move for animation if it's the current turn
        if (isCurrentTurn && move.action !== 'endTurn') {
          movesToAnimate.push({...move, previousShips: [...currentShips]});
        }
        
        if (move.action === 'move') {
          // Find the ship and update its position
          const shipIndex = currentShips.findIndex(s => s.id === move.shipId);
          if (shipIndex !== -1 && move.toCol !== undefined && move.toRow !== undefined) {
            currentShips[shipIndex] = {
              ...currentShips[shipIndex],
              position: { col: move.toCol, row: move.toRow },
              orientation: move.toOrientation !== undefined ? move.toOrientation : currentShips[shipIndex].orientation
            };
          }
        } else if (move.action === 'combat') {
          // Remove destroyed ship if combat resulted in destruction
          if (move.result === 'destroyed' && move.targetShipId) {
            // Find the destroyed ship's position before removing it
            const destroyedShip = currentShips.find(s => s.id === move.targetShipId);
            if (destroyedShip) {
              // Add debris field at destroyed ship's location
              currentDebrisFields.push({
                col: destroyedShip.position.col,
                row: destroyedShip.position.row
              });
            }
            currentShips = currentShips.filter(s => s.id !== move.targetShipId);
          }
          // Also move the attacking ship
          const shipIndex = currentShips.findIndex(s => s.id === move.shipId);
          if (shipIndex !== -1 && move.toCol !== undefined && move.toRow !== undefined) {
            currentShips[shipIndex] = {
              ...currentShips[shipIndex],
              position: { col: move.toCol, row: move.toRow },
              orientation: move.toOrientation !== undefined ? move.toOrientation : currentShips[shipIndex].orientation
            };
          }
        } else if (move.action === 'rotate') {
          // Just update orientation
          const shipIndex = currentShips.findIndex(s => s.id === move.shipId);
          if (shipIndex !== -1 && move.toOrientation !== undefined) {
            currentShips[shipIndex] = {
              ...currentShips[shipIndex],
              orientation: move.toOrientation
            };
          }
        }
      }
      
      // If we have moves to animate for this turn, trigger animations
      if (movesToAnimate.length > 0 && (window as any).animateReviewMoves) {
        // Set debris fields before animation
        if ((window as any).setReviewDebrisFields) {
          (window as any).setReviewDebrisFields(currentDebrisFields);
        }
        (window as any).animateReviewMoves(movesToAnimate, currentShips);
        return; // The animation callback will update the ships when done
      }
    }
    
    // Update review ships state (for non-animated updates)
    setReviewShips(currentShips);
    
    // Call callback if exists
    if ((window as any).setReviewShipsCallback) {
      (window as any).setReviewShipsCallback(currentShips);
    }
    
    // Update debris fields for review
    if ((window as any).setReviewDebrisFields) {
      (window as any).setReviewDebrisFields(currentDebrisFields);
    }
  };
  
  // Keep the old function for compatibility but redirect to turn-based
  const reconstructGameStateAtMove = (moveIndex: number) => {
    // For initial migration, just call turn-based without animation
    const turns = groupMovesByTurn();
    
    // Find the turn this move belongs to
    let currentTurnIndex = -1;
    let moveCount = 0;
    
    for (let t = 0; t < turns.length; t++) {
      const turnMoveCount = turns[t].length;
      if (moveCount + turnMoveCount > moveIndex) {
        currentTurnIndex = t;
        break;
      }
      moveCount += turnMoveCount;
    }
    
    if (moveIndex === -1) {
      currentTurnIndex = -1;
    }
    
    reconstructGameStateAtTurn(currentTurnIndex, false);
  };

  const returnToMainMenu = () => {
    // Clean up multiplayer room connection
    const room = (window as any).currentRoom;
    if (room) {
      room.removeAllListeners(); // Remove all listeners to stop receiving messages
      room.hasListeners = false; // Reset the flag
      (window as any).currentRoom = null;
    }
    
    // Clear saved game data
    (window as any).gameInitialShipState = null;
    (window as any).savedMoveHistory = null;
    (window as any).finalShipState = null;
    (window as any).shipThatUsedAP = null;
    
    setShowMultiplayer(true);
    setInActiveGame(false);
    setGamePhase('lobby');
    setGameEnded(false);
    setGameResult('');
    setDeployedShips([]);
    setAllShipsDeployed(false);
    setAIShipsToDeploy(null);
    setDeploymentConfirmed(false);
    setPlayerCount(0); // Reset player count
    setPlayers([]); // Clear players
    setShowDrawOffer(false); // Reset draw offer state
    setDrawOfferFrom(''); // Reset draw offer from
    setDrawRefusalMessage(''); // Reset draw refusal message
    setIsSpectator(false); // Reset spectator state
    setResignationMessage(''); // Reset resignation message
    setGameReviewMode(false); // Reset review mode
    setReviewMoveIndex(0);
    setReviewShips([]);
    setInitialShipsSnapshot([]);
    logger.info('UI', 'Returned to main menu');
  };

  // Show splash screen on initial load
  if (showSplash) {
    return (
      <SplashScreen 
        onContinue={() => {
          setShowSplash(false);
          initializeApp();
        }}
      />
    );
  }

  // Show admin tool if requested
  if (showAdminTool) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setShowAdminTool(false)}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Movement Pattern Editor</Text>
          <TouchableOpacity 
            style={[styles.backButton, { position: 'absolute', right: 10 }]}
            onPress={() => {
              testMovementConsistency();
              Alert.alert('Test Complete', 'Check console for movement consistency test results');
            }}
          >
            <Text style={styles.backButtonText}>Test Consistency</Text>
          </TouchableOpacity>
        </View>
        <MovementPatternEditor />
      </SafeAreaView>
    );
  }

  if (!isReady) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Initializing...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      
      {/* Header - Only show when not in active game */}
      {!inActiveGame && (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>HEXARCH</Text>
          </View>
        </>
      )}

      {/* Main Content - Always show multiplayer menu when not in game */}
      {!inActiveGame ? (
        <>
          <SimpleLobby 
            onGameStart={handleGameStart}
            onCampaignStart={handleCampaignStart}
            onQuickMatch={() => setShowMultiplayerMenu('quickmatch')}
            onHostMatch={() => setShowMultiplayerMenu('host')}
            onJoinMatch={() => setShowMultiplayerMenu('join')}
          />
          {/* Admin Tool Button */}
          <TouchableOpacity 
            style={styles.adminButton}
            onPress={() => setShowAdminTool(true)}
          >
            <Text style={styles.adminButtonText}>⚙️ Admin: Movement Editor</Text>
          </TouchableOpacity>
        </>
      ) : (
        <HexGameBoard 
          style={styles.gameBoard}
          gamePhase={gamePhase}
          selectedShip={selectedShip}
          onShipSelect={setSelectedShip}
          players={players}
          onZoneSelected={(playerId, zone) => {
            setPlayers(prev => prev.map(p => 
              p.id === playerId ? { ...p, assignedZone: zone } : p
            ));
            logger.info('UI', 'Zone selected', { playerId, zone });
          }}
          aiShipsToDeploy={aiShipsToDeploy}
          mapType={mapType}
          deploymentConfirmed={deploymentConfirmed}
          autoDeployTrigger={autoDeployTrigger}
          isReviewMode={gameReviewMode}
          reviewShips={reviewShips}
          containerHeight={
            inActiveGame 
              ? (gamePhase === 'deployment' 
                  ? (allShipsDeployed ? dimensions.height - 80 : dimensions.height - 200) // Only fleet pool in active game
                  : dimensions.height - 50) // Full screen during battle
              : dimensions.height - 290 // Menu height when not in game
          }
          onHexTap={(hex) => {
            logger.debug('UI', 'Hex tapped', hex);
          }}
          onShipDeployed={(ship: any) => {
            // Check if this is an undeployment (type starts with -)
            if (ship.type.startsWith('-')) {
              // Remove ship from deployed list and add back to available count
              const actualType = ship.type.substring(1);
              setDeployedShips(prevShips => {
                const newShips = prevShips.filter(s => s.id !== ship.id);
                // Update allShipsDeployed state based on remaining ships and mothership
                const hasMothershipDeployed = newShips.some(s => s.type === 'mothership');
                if (newShips.length < 10 || !hasMothershipDeployed) {
                  setAllShipsDeployed(false);
                }
                return newShips;
              });
              logger.debug('UI', 'Ship undeployed', { type: actualType });
              return;
            }
            
            // Check if this is part of a batch (from auto-deploy)
            if (ship._batchIndex !== undefined) {
              setDeployedShips(prevShips => {
                // Add this ship to the array
                const newShips = [...prevShips, ship];
                
                // If this is the last ship in the batch, check if all deployed
                if (ship._batchIndex === ship._batchTotal - 1) {
                  // Check if we have at least 10 ships AND a mothership deployed
                  const hasMothershipDeployed = newShips.some(s => s.type === 'mothership');
                  if (newShips.length >= 10 && hasMothershipDeployed) {
                    setAllShipsDeployed(true);
                    setSelectedShip(null);
                  }
                }
                
                return newShips;
              });
            } else {
              // Regular single ship deployment
              const newDeployedShips = [...deployedShips, ship];
              setDeployedShips(newDeployedShips);
              
              // Check if all ships are deployed (total of 10 ships including mothership)
              const hasMothershipDeployed = newDeployedShips.some(s => s.type === 'mothership');
              if (newDeployedShips.length >= 10 && hasMothershipDeployed) {
                setAllShipsDeployed(true);
                setSelectedShip(null); // Clear selection only when all deployed
              }
            }
            
            logger.debug('UI', 'Ship deployed and tracked', ship);
          }}
          onShipTap={(ship) => {
            logger.debug('UI', 'Ship tapped', { shipId: ship.id });
          }}
          onShipCountsChanged={(humanCount, aiCount) => {
            setCurrentShipCounts({ human: humanCount, ai: aiCount });
          }}
        />
      )}

      {/* Deployment Phase - Only show during deployment phase */}
      {!showMultiplayer && inActiveGame && gamePhase === 'deployment' && (
        <>
          <FleetPool
            onShipSelect={(ship) => {
              setSelectedShip(ship);
              logger.debug('UI', 'Ship selected for deployment', ship);
            }}
            selectedShip={selectedShip}
            gamePhase={gamePhase}
            deployedShips={deployedShips}
            onAutoDeploy={handleAutoDeploy}
          />
          
          {/* Deployment Timer Display */}
          {timerInfo && timerInfo.phase === 'deployment' && (
            <View style={styles.deploymentTimerContainer}>
              <Text style={[styles.deploymentTimerText, (timerInfo.timeRemaining ?? 0) <= 30 && styles.timerTextWarning]}>
                Deployment Time: {Math.floor((timerInfo.timeRemaining ?? 0) / 60)}:{((timerInfo.timeRemaining ?? 0) % 60).toString().padStart(2, '0')}
              </Text>
            </View>
          )}
          
          {/* Deployment Status and Confirmation */}
          {gamePhase === 'deployment' && !deploymentConfirmed && (
            <View style={styles.deploymentConfirmContainer}>
              {allShipsDeployed && (
                <TouchableOpacity 
                  style={styles.deploymentConfirmButton}
                  onPress={() => {
                    setDeploymentConfirmed(true);
                    
                    if (gameType === 'multiplayer') {
                      // For multiplayer, send confirmation to server
                      const room = (window as any).currentRoom;
                      if (room) {
                        room.send("confirmDeployment", {});
                        logger.info('UI', 'Sent deployment confirmation to server');
                      }
                    } else {
                      // For AI games, deploy AI fleet
                      setTimeout(() => {
                        deployAIFleet();
                      }, 1000);
                    }
                  }}
                >
                  <Text style={styles.deploymentConfirmText}>✓ Confirm Deployment</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </>
      )}

      {/* Action Buttons - Only show when in active game */}
      {!showMultiplayer && inActiveGame && (
        <View style={[
          styles.actionContainer,
          gamePhase === 'playing' && (() => {
            // Add colored background when it's the player's turn
            const room = (window as any).currentRoom;
            if (!room) return {};
            
            const isMyTurn = currentTurn === room.sessionId;
            if (!isMyTurn) return {};
            
            // Get player color based on index
            const playerIds = Array.from(room.state?.players?.keys() || []);
            const myIndex = playerIds.indexOf(room.sessionId);
            let bgColor = 'rgba(0, 123, 255, 0.1)'; // blue
            
            switch(myIndex) {
              case 0: bgColor = 'rgba(0, 123, 255, 0.1)'; break; // blue
              case 1: bgColor = 'rgba(255, 0, 0, 0.1)'; break; // red
              case 2: bgColor = 'rgba(0, 255, 0, 0.1)'; break; // green
              case 3: bgColor = 'rgba(255, 255, 0, 0.1)'; break; // yellow
            }
            
            return { backgroundColor: bgColor };
          })()
        ]}>
          {gamePhase === 'deployment' && (
            <View style={styles.deploymentInfo}>
              <Text style={styles.actionText}>Deploy your fleet in the colored zones</Text>
              <Text style={styles.actionSubtext}>Tap hexes to place ships</Text>
            </View>
          )}
          
          {gamePhase === 'playing' && (
            <View style={styles.gameActionBar}>
              {/* Player timers */}
              <View style={styles.playerTimersContainer}>
                {players.map((player) => {
                  const room = (window as any).currentRoom;
                  const isMe = room && player.id === room.sessionId;
                  const isCurrentTurn = player.id === currentTurn;
                  const timeRemaining = timerInfo?.timers?.[player.id] || 0;
                  
                  return (
                    <View 
                      key={player.id} 
                      style={[
                        styles.playerTimerBox,
                        isCurrentTurn && styles.playerTimerBoxActive,
                        isMe && styles.playerTimerBoxMe
                      ]}
                    >
                      <Text style={styles.playerTimerName}>
                        {isMe ? 'You' : player.name}
                      </Text>
                      <Text style={[
                        styles.playerTimerTime,
                        timeRemaining <= 30 && styles.playerTimerWarning
                      ]}>
                        {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                      </Text>
                    </View>
                  );
                })}
              </View>
              
              {/* Game Control Buttons - Hide for spectators */}
              {!isSpectator && (
                <View style={styles.gameControlButtons}>
                  <TouchableOpacity 
                    style={styles.drawButton}
                    onPress={handleDrawOffer}
                  >
                    <Text style={styles.drawButtonText}>Offer Draw</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.resignButton}
                    onPress={() => setShowResignConfirm(true)}
                  >
                    <Text style={styles.resignButtonText}>Resign</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Resignation Message Popup */}
      {resignationMessage && (
        <View style={styles.gameEndOverlay}>
          <View style={styles.gameEndContainer}>
            <Text style={styles.gameEndTitle}>Player Resigned</Text>
            <Text style={styles.gameEndResult}>{resignationMessage}</Text>
            <TouchableOpacity 
              style={styles.returnToMenuButton}
              onPress={() => setResignationMessage('')}
            >
              <Text style={styles.returnToMenuText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {playerNotification && (
        <View style={styles.gameEndOverlay}>
          <View style={styles.gameEndContainer}>
            <Text style={styles.gameEndTitle}>{playerNotification.title}</Text>
            <Text style={styles.gameEndResult}>{playerNotification.message}</Text>
            <TouchableOpacity 
              style={styles.returnToMenuButton}
              onPress={() => setPlayerNotification(null)}
            >
              <Text style={styles.returnToMenuText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Draw Refusal Popup */}
      {drawRefusalMessage && (
        <View style={styles.gameEndOverlay}>
          <View style={styles.gameEndContainer}>
            <Text style={styles.gameEndTitle}>Draw Offer</Text>
            <Text style={styles.gameEndResult}>{drawRefusalMessage}</Text>
            <TouchableOpacity 
              style={styles.returnToMenuButton}
              onPress={() => setDrawRefusalMessage('')}
            >
              <Text style={styles.returnToMenuText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Draw Offer from Opponent Popup */}
      {showDrawOffer && (
        <View style={styles.gameEndOverlay}>
          <View style={styles.gameEndContainer}>
            <Text style={styles.gameEndTitle}>Draw Offer</Text>
            <Text style={styles.gameEndResult}>{drawOfferFrom} has offered a draw.</Text>
            <View style={styles.confirmButtonRow}>
              <TouchableOpacity 
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={handleRefuseDraw}
              >
                <Text style={styles.confirmButtonText}>Refuse</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmButton, { backgroundColor: '#00ff88' }]}
                onPress={handleAcceptDraw}
              >
                <Text style={[styles.confirmButtonText, { color: '#0a0a0a' }]}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      
      {/* Resign Confirmation Popup */}
      {showResignConfirm && (
        <View style={styles.gameEndOverlay}>
          <View style={styles.gameEndContainer}>
            <Text style={styles.gameEndTitle}>Confirm Resignation</Text>
            <Text style={styles.gameEndResult}>Are you sure you want to resign?</Text>
            <View style={styles.confirmButtonRow}>
              <TouchableOpacity 
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => setShowResignConfirm(false)}
              >
                <Text style={styles.confirmButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmButton, styles.resignConfirmButton]}
                onPress={() => {
                  setShowResignConfirm(false);
                  handleResign();
                }}
              >
                <Text style={styles.confirmButtonText}>Resign</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      
      {/* Game Review Controls */}
      {gameReviewMode && (
        <View style={styles.reviewControls}>
          <Text style={styles.reviewTitle}>Game Review</Text>
          <View style={styles.reviewButtonContainer}>
            <TouchableOpacity 
              style={[styles.reviewButton, reviewMoveIndex <= -1 && styles.reviewButtonDisabled]}
              onPress={() => {
                if (reviewMoveIndex > -1) {
                  const newIndex = reviewMoveIndex - 1;
                  setReviewMoveIndex(newIndex);
                  reconstructGameStateAtTurn(newIndex, true);
                }
              }}
              disabled={reviewMoveIndex <= -1}
            >
              <Text style={styles.reviewButtonText}>← Previous Turn</Text>
            </TouchableOpacity>
            
            <Text style={styles.reviewMoveText}>
              {reviewMoveIndex === -1 
                ? 'Initial State' 
                : `Turn ${reviewMoveIndex + 1} / ${groupMovesByTurn().length}`}
            </Text>
            
            <TouchableOpacity 
              style={[styles.reviewButton, reviewMoveIndex >= groupMovesByTurn().length - 1 && styles.reviewButtonDisabled]}
              onPress={() => {
                const maxTurns = groupMovesByTurn().length;
                if (reviewMoveIndex < maxTurns - 1) {
                  const newIndex = reviewMoveIndex + 1;
                  setReviewMoveIndex(newIndex);
                  reconstructGameStateAtTurn(newIndex, true);
                }
              }}
              disabled={reviewMoveIndex >= groupMovesByTurn().length - 1}
            >
              <Text style={styles.reviewButtonText}>Next Turn →</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={styles.reviewExitButton}
            onPress={() => {
              setGameReviewMode(false);
              setGameEnded(true);
            }}
          >
            <Text style={styles.reviewExitText}>Exit Review</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Game End Overlay */}
      {gameEnded && (
        <View style={styles.gameEndOverlay}>
          <View style={styles.gameEndContainer}>
            <Text style={styles.gameEndTitle}>Game Over</Text>
            <Text style={styles.gameEndResult}>{gameResult}</Text>
            {isSpectator && gamePhase !== 'ended' && (
              <>
                <TouchableOpacity 
                  style={[styles.returnToMenuButton, { marginBottom: 10 }]}
                  onPress={() => {
                    setGameEnded(false);
                    setIsSpectator(true);
                  }}
                >
                  <Text style={styles.returnToMenuText}>Watch Game</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.returnToMenuButton}
                  onPress={returnToMainMenu}
                >
                  <Text style={styles.returnToMenuText}>Return to Main Menu</Text>
                </TouchableOpacity>
              </>
            )}
            {(!isSpectator || gamePhase === 'ended') && (
              <>
                <TouchableOpacity 
                  style={[styles.returnToMenuButton, { marginBottom: 10 }]}
                  onPress={() => {
                    // Start game review mode
                    setGameEnded(false);
                    setGameReviewMode(true);
                    
                    // Use the saved initial ship state
                    let initialState = (window as any).gameInitialShipState || [];
                    const savedMoves = (window as any).savedMoveHistory || [];
                    
                    logger.debug('Review Game clicked - checking all data sources:', {
                      hasInitialState: initialState.length > 0,
                      initialShipCount: initialState.length,
                      hasSavedMoves: savedMoves.length > 0,
                      moveCount: savedMoves.length,
                      hasFinalState: ((window as any).finalShipState || []).length > 0,
                      windowKeys: Object.keys(window).filter(k => k.includes('ship') || k.includes('Ship') || k.includes('game') || k.includes('Game')).join(', ')
                    });
                    
                    if (initialState.length === 0) {
                      // Fallback - use final state if we don't have initial state
                      const finalState = (window as any).finalShipState;
                      if (finalState && finalState.length > 0) {
                        console.warn('No initial state saved, using final state as fallback');
                        initialState = [...finalState];
                        // We'll work backwards from the final state
                      } else {
                        console.error('No ship state available for review:', {
                          gameInitialShipState: (window as any).gameInitialShipState,
                          finalShipState: (window as any).finalShipState,
                          savedMoveHistory: (window as any).savedMoveHistory
                        });
                        
                        // Last resort - try to get current board state
                        const room = (window as any).currentRoom;
                        if (room && room.state && room.state.ships) {
                          logger.debug('Using current room state as last resort');
                          room.state.ships.forEach((ship: any) => {
                            if (ship && ship.position) {
                              initialState.push({
                                id: ship.id,
                                type: ship.type,
                                color: ship.color,
                                owner: ship.owner,
                                position: { col: ship.position.col, row: ship.position.row },
                                orientation: ship.orientation || 0,
                                rotation: ship.rotation || 0
                              });
                            }
                          });
                        }
                        
                        if (initialState.length === 0) {
                          alert('Unable to load game data for review. The game data may not have been saved properly.');
                          return;
                        }
                      }
                    }
                    
                    logger.debug('Starting review with initial state:', initialState);
                    setInitialShipsSnapshot(initialState);
                    setReviewShips(initialState);
                    
                    // Start at the beginning
                    setReviewMoveIndex(-1); // -1 means initial state
                    reconstructGameStateAtTurn(-1, false);
                  }}
                >
                  <Text style={styles.returnToMenuText}>Review Game</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.returnToMenuButton}
                  onPress={returnToMainMenu}
                >
                  <Text style={styles.returnToMenuText}>Return to Main Menu</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}
      
      {/* Multiplayer Menu Modal */}
      <MultiplayerMenu
        visible={!!showMultiplayerMenu}
        initialMode={typeof showMultiplayerMenu === 'string' ? showMultiplayerMenu : undefined}
        onClose={() => setShowMultiplayerMenu(false)}
        onStartGame={(players, room) => {
          logger.debug('Starting multiplayer game with players:', players, 'room:', room);
          setShowMultiplayerMenu(false);
          // Store the room for multiplayer actions
          (window as any).currentMultiplayerRoom = room;
          handleGameStart({ 
            sessionId: (room as any)?.id || 'mp_' + Date.now(), 
            type: 'multiplayer', 
            mapType: room?.state?.mapType || 'Classic',
            room: room,
            currentPlayerId: room?.sessionId,
            players: players
          });
        }}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a', // Deep space background
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  loadingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  
  backButton: {
    padding: 10,
  },
  
  backButtonText: {
    color: '#4ECDC4',
    fontSize: 16,
  },
  
  adminButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#2D3748',
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#4A5568',
  },
  
  adminButtonText: {
    color: '#CBD5E0',
    fontSize: 14,
  },
  
  subText: {
    fontSize: 16,
    color: '#aaaaaa',
  },
  
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },

  multiplayerToggle: {
    position: 'absolute',
    right: 16,
    top: 20,
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  toggleText: {
    color: '#0a0a0a',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4ECDC4', // Cyan accent
    letterSpacing: 2,
  },
  
  subtitle: {
    fontSize: 14,
    color: '#aaaaaa',
    marginTop: 4,
  },
  
  statusContainer: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  
  statusText: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 4,
  },
  
  gameBoard: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  
  boardText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 8,
  },
  
  boardSubtext: {
    fontSize: 16,
    color: '#aaaaaa',
    marginBottom: 4,
  },
  
  featureList: {
    marginTop: 20,
    alignItems: 'center',
  },
  
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00ff00',
    marginBottom: 12,
  },
  
  featureItem: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 6,
  },
  
  actionContainer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  
  actionButton: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
  },
  
  actionButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0a0a0a',
  },
  
  actionText: {
    fontSize: 16,
    color: '#4ECDC4',
    textAlign: 'center',
    fontStyle: 'italic',
  },

  deploymentInfo: {
    alignItems: 'center',
  },

  actionSubtext: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 4,
  },

  gameControlButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },

  drawButton: {
    backgroundColor: '#FFA500',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },

  drawButtonText: {
    color: '#0a0a0a',
    fontSize: 14,
    fontWeight: 'bold',
  },

  resignButton: {
    backgroundColor: '#FF4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },

  resignButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },

  gameEndOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },

  gameEndContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 32,
    borderWidth: 2,
    borderColor: '#4ECDC4',
    minWidth: 280,
    alignItems: 'center',
  },

  gameEndTitle: {
    color: '#4ECDC4',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },

  gameEndResult: {
    color: '#ffffff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },

  returnToMenuButton: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },

  returnToMenuText: {
    color: '#0a0a0a',
    fontSize: 16,
    fontWeight: 'bold',
  },

  deploymentConfirmContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  deploymentConfirmButton: {
    backgroundColor: '#00ff88',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#00cc66',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },

  deploymentConfirmText: {
    color: '#0a0a0a',
    fontSize: 18,
    fontWeight: 'bold',
  },

  deploymentStatusText: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },

  confirmButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },

  confirmButton: {
    flex: 0.45,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },

  cancelButton: {
    backgroundColor: '#666',
  },

  resignConfirmButton: {
    backgroundColor: '#FF4444',
  },

  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  gameActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  
  turnIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  
  playerTimersContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
    flex: 1,
  },
  
  playerTimerBox: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  
  playerTimerBoxActive: {
    borderColor: '#4ECDC4',
    backgroundColor: '#1a3a3a',
  },
  
  playerTimerBoxMe: {
    backgroundColor: '#1a2a3a',
  },
  
  playerTimerName: {
    fontSize: 12,
    color: '#ffffff',
    marginBottom: 4,
  },
  
  playerTimerTime: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4ECDC4',
  },
  
  playerTimerWarning: {
    color: '#FF6B6B',
  },
  
  turnText: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  timerText: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  
  timerTextWarning: {
    color: '#ff6b6b',
  },
  
  // Game Review styles
  reviewControls: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#00ff88',
    zIndex: 1001,
  },
  
  reviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00ff88',
    textAlign: 'center',
    marginBottom: 12,
  },
  
  reviewButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  
  reviewButton: {
    backgroundColor: '#0f3460',
    padding: 10,
    borderRadius: 8,
    minWidth: 90,
  },
  
  reviewButtonDisabled: {
    opacity: 0.5,
  },
  
  reviewButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  
  reviewMoveText: {
    color: '#ffffff',
    fontSize: 14,
  },
  
  reviewExitButton: {
    backgroundColor: '#ff6b6b',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  
  reviewExitText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  
  deploymentTimerContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(26, 26, 26, 0.9)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4ECDC4',
  },
  
  deploymentTimerText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: 'bold',
  },
  
});
