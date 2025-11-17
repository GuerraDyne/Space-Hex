import React, { useState, useEffect, useCallback } from 'react';
import { Lobby } from './components/Lobby';
import { HexRenderer } from './components/HexRenderer';
import { GameUI } from './components/GameUI';
import { DiceRoll } from './components/DiceRoll';
import { DeploymentPhase } from './components/DeploymentPhase';
import { MapEditor } from './components/MapEditor';
import { ReplayViewer } from './components/ReplayViewer';
import { Tutorial } from './components/Tutorial';
import { useGameStore } from './game/gameStore';
import { GameSettings, GameMap, SHIP_STATS } from './types/game';
import { AIPlayer, AIDifficulty } from './ai/AIPlayer';
import { soundManager } from './sounds/soundManager';
import { MAP_PRESETS } from './game/mapGenerator';
import './styles.css';

type Screen = 'lobby' | 'game' | 'mapEditor';

export const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('lobby');
  const [showMapEditor, setShowMapEditor] = useState(false);
  const [aiPlayer, setAiPlayer] = useState<AIPlayer | null>(null);
  const [isTutorial, setIsTutorial] = useState(false);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const {
    gameState,
    localPlayerId,
    initGame,
    addPlayer,
    nextPhase,
    rollDice,
    selectDeploymentZone,
    isReplayMode,
    setReplayMode,
    confirmTurn,
    isMyTurn,
    getCurrentPlayer,
  } = useGameStore();

  // Initialize sound system
  useEffect(() => {
    soundManager.init();
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // AI turn handling
  useEffect(() => {
    if (!gameState || !aiPlayer || gameState.phase !== 'battle') return;

    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer || currentPlayer.id === localPlayerId) return;

    // AI's turn
    const aiPlayerObj = gameState.players.find((p) => p.id !== localPlayerId);
    if (!aiPlayerObj) return;

    // Small delay for AI thinking
    const timer = setTimeout(() => {
      const moves = aiPlayer.calculateTurn(gameState);

      // Apply AI moves
      moves.forEach((move) => {
        useGameStore.getState().addPendingMove(
          move.shipId,
          move.to as { q: number; r: number }
        );
      });

      // Confirm AI turn
      setTimeout(() => {
        confirmTurn();
      }, 1000);
    }, 1500);

    return () => clearTimeout(timer);
  }, [gameState, aiPlayer, localPlayerId, getCurrentPlayer, confirmTurn]);

  // Time countdown
  useEffect(() => {
    if (!gameState || gameState.phase !== 'battle') return;

    const timer = setInterval(() => {
      const currentPlayer = getCurrentPlayer();
      if (!currentPlayer) return;

      useGameStore.getState().updatePlayerTime(
        currentPlayer.id,
        currentPlayer.timeRemaining - 1
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, getCurrentPlayer]);

  const handleStartGame = useCallback(
    (settings: GameSettings, isAI: boolean, aiDifficulty?: string) => {
      // Initialize game
      const playerId = 'local_player';
      initGame(settings, playerId);

      // Add local player
      const localPlayer = addPlayer('Player', 'blue');
      useGameStore.getState().localPlayerId = localPlayer.id;

      if (isAI) {
        // Add AI player
        const difficulty = (aiDifficulty as AIDifficulty) || 'medium';
        const aiPlayerObj = addPlayer(
          `AI (${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)})`,
          'red'
        );

        if (aiDifficulty === 'tutorial') {
          setIsTutorial(true);
          setAiPlayer(new AIPlayer(aiPlayerObj.id, 'easy'));
        } else {
          setAiPlayer(new AIPlayer(aiPlayerObj.id, difficulty));
        }
      }

      // Set the map
      if (MAP_PRESETS[settings.mapId]) {
        const map = MAP_PRESETS[settings.mapId]();
        useGameStore.setState((state) => ({
          gameState: state.gameState
            ? { ...state.gameState, map }
            : null,
        }));
      }

      setScreen('game');
      nextPhase(); // Move to dice roll
    },
    [initGame, addPlayer, nextPhase]
  );

  const handleQuickMatch = useCallback(() => {
    // For demo, just start a game against AI
    handleStartGame(
      {
        mode: '1v1',
        isPrivate: false,
        mapId: 'classic',
        timeControl: { deploymentTime: 180, gameTime: 600 },
      },
      true,
      'medium'
    );
  }, [handleStartGame]);

  const handleHostMatch = useCallback((settings: GameSettings) => {
    // For demo, start an AI game with these settings
    handleStartGame(settings, true, 'medium');
  }, [handleStartGame]);

  const handleJoinMatch = useCallback((code: string) => {
    // For demo, just start a game
    handleQuickMatch();
  }, [handleQuickMatch]);

  const handleDiceRollComplete = useCallback(() => {
    if (!gameState) return;

    // Auto-select zones based on dice rolls (highest gets first pick)
    const sortedPlayers = [...gameState.players].sort(
      (a, b) => (b.diceRoll || 0) - (a.diceRoll || 0)
    );

    sortedPlayers.forEach((player, index) => {
      // Assign opposite zones for 1v1
      if (index === 0) {
        selectDeploymentZone(player.id, 0); // East
      } else {
        selectDeploymentZone(player.id, 2); // West (opposite)
      }
    });

    nextPhase(); // Move to zone selection
    setTimeout(() => nextPhase(), 500); // Then to deployment
  }, [gameState, selectDeploymentZone, nextPhase]);

  const handleDeploymentComplete = useCallback(() => {
    nextPhase(); // Move to battle phase
    soundManager.play('turn_start');
  }, [nextPhase]);

  const handleSaveMap = useCallback((map: GameMap) => {
    // In a real app, this would save to server/storage
    console.log('Map saved:', map);
    setShowMapEditor(false);
  }, []);

  const handleTutorialComplete = useCallback(() => {
    setIsTutorial(false);
  }, []);

  const handleExitGame = useCallback(() => {
    setScreen('lobby');
    setAiPlayer(null);
    setIsTutorial(false);
    useGameStore.setState({
      gameState: null,
      localPlayerId: null,
      pendingActions: new Map(),
      animations: [],
      selectedShipId: null,
    });
  }, []);

  return (
    <div className="app">
      {screen === 'lobby' && (
        <Lobby
          onStartGame={handleStartGame}
          onQuickMatch={handleQuickMatch}
          onHostMatch={handleHostMatch}
          onJoinMatch={handleJoinMatch}
        />
      )}

      {screen === 'game' && gameState && (
        <div className="game-container">
          <HexRenderer width={windowSize.width} height={windowSize.height} hexSize={40} />

          {gameState.phase === 'dice_roll' && (
            <DiceRoll onComplete={handleDiceRollComplete} />
          )}

          {gameState.phase === 'deployment' && (
            <DeploymentPhase hexSize={40} onComplete={handleDeploymentComplete} />
          )}

          {(gameState.phase === 'battle' || gameState.phase === 'ended') && (
            <GameUI />
          )}

          {isReplayMode && <ReplayViewer onClose={() => setReplayMode(false)} />}

          {isTutorial && <Tutorial onComplete={handleTutorialComplete} />}

          <button className="exit-game-btn" onClick={handleExitGame}>
            Exit Game
          </button>

          <button
            className="map-editor-btn"
            onClick={() => setShowMapEditor(true)}
          >
            Map Editor
          </button>
        </div>
      )}

      {showMapEditor && (
        <MapEditor onSave={handleSaveMap} onClose={() => setShowMapEditor(false)} />
      )}
    </div>
  );
};
