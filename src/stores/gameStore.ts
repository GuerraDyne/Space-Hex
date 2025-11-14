/**
 * Game Store - Zustand store for reactive game state management
 * Handles game state, UI state, and actions
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { 
  GameState, 
  Ship, 
  HexCoordinate, 
  PlayerId, 
  GamePhase,
  ShipType
} from '../game/core/Types';
import { GameController } from '../game/core/GameController';
import { logger } from '../utils/Logger';

interface UIState {
  selectedShip: Ship | null;
  availableMoves: HexCoordinate[];
  hoveredHex: HexCoordinate | null;
  showFleetPanel: boolean;
  showGameMenu: boolean;
  animationsEnabled: boolean;
  soundEnabled: boolean;
  isLoading: boolean;
  error: string | null;
}

interface GameStore {
  // Game state
  gameState: GameState | null;
  gameController: GameController | null;
  playerId: PlayerId | null;
  playerName: string | null;

  // UI state
  ui: UIState;

  // Actions
  initializeGame: (gameId: string, playerId: PlayerId, playerName: string) => void;
  addPlayer: (playerId: PlayerId, playerName: string) => void;
  startDeployment: () => void;
  
  // Ship actions
  selectShip: (ship: Ship | null) => void;
  moveShip: (shipId: string, targetHex: HexCoordinate) => Promise<boolean>;
  deployShip: (shipId: string, position: HexCoordinate) => Promise<boolean>;
  
  // Mothership actions
  deployMothership: (dockHex: HexCoordinate) => Promise<boolean>;
  moveMothership: (targetHex: HexCoordinate) => Promise<boolean>;
  enterCockpit: (shipId: string) => Promise<boolean>;
  exitCockpit: () => Promise<boolean>;
  enterDock: (shipId: string) => Promise<boolean>;
  exitDock: (targetHex: HexCoordinate) => Promise<boolean>;

  // Turn actions
  endTurn: () => void;

  // UI actions
  setHoveredHex: (hex: HexCoordinate | null) => void;
  toggleFleetPanel: () => void;
  toggleGameMenu: () => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setError: (error: string | null) => void;

  // Getters
  getCurrentPlayer: () => PlayerId | null;
  isMyTurn: () => boolean;
  canMoveShip: (shipId: string) => boolean;
  canEndTurn: () => boolean;
}

export const useGameStore = create<GameStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      gameState: null,
      gameController: null,
      playerId: null,
      playerName: null,

      ui: {
        selectedShip: null,
        availableMoves: [],
        hoveredHex: null,
        showFleetPanel: false,
        showGameMenu: false,
        animationsEnabled: true,
        soundEnabled: true,
        isLoading: false,
        error: null
      },

      // Actions
      initializeGame: (gameId: string, playerId: PlayerId, playerName: string) => {
        logger.info('UI', 'Initializing game', { gameId, playerId, playerName });

        const gameController = new GameController(gameId, (newState) => {
          // Update store when game state changes
          set((state) => ({
            gameState: newState
          }));
        });

        set({
          gameController,
          playerId,
          playerName,
          ui: { ...get().ui, isLoading: false, error: null }
        });
      },

      addPlayer: (playerId: PlayerId, playerName: string) => {
        const { gameController } = get();
        if (!gameController) {
          logger.error('UI', 'Cannot add player - no game controller');
          return;
        }

        const success = gameController.addPlayer(playerId, playerName);
        if (!success) {
          set((state) => ({
            ui: { ...state.ui, error: 'Failed to add player' }
          }));
        }
      },

      startDeployment: () => {
        const { gameController } = get();
        if (!gameController) return;

        const success = gameController.startDeployment();
        if (!success) {
          set((state) => ({
            ui: { ...state.ui, error: 'Cannot start deployment' }
          }));
        }
      },

      selectShip: (ship: Ship | null) => {
        const { gameController } = get();
        
        let availableMoves: HexCoordinate[] = [];
        if (ship && gameController) {
          availableMoves = gameController.getAvailableMoves(ship.id);
        }

        set((state) => ({
          ui: {
            ...state.ui,
            selectedShip: ship,
            availableMoves
          }
        }));

        logger.debug('UI', 'Ship selected', { 
          shipId: ship?.id, 
          movesAvailable: availableMoves.length 
        });
      },

      moveShip: async (shipId: string, targetHex: HexCoordinate): Promise<boolean> => {
        const { gameController, playerId } = get();
        if (!gameController || !playerId) return false;

        set((state) => ({ ui: { ...state.ui, isLoading: true } }));

        try {
          const success = gameController.moveShip(playerId, shipId, targetHex);
          
          if (success) {
            // Clear selection after successful move
            set((state) => ({
              ui: {
                ...state.ui,
                selectedShip: null,
                availableMoves: [],
                isLoading: false
              }
            }));
            
            logger.info('UI', 'Ship moved successfully', { shipId, targetHex });
          } else {
            set((state) => ({
              ui: { ...state.ui, error: 'Invalid move', isLoading: false }
            }));
          }

          return success;
        } catch (error) {
          logger.error('UI', 'Error moving ship', { shipId, targetHex, error });
          set((state) => ({
            ui: { ...state.ui, error: 'Move failed', isLoading: false }
          }));
          return false;
        }
      },

      deployShip: async (shipId: string, position: HexCoordinate): Promise<boolean> => {
        const { gameController, playerId } = get();
        if (!gameController || !playerId) return false;

        set((state) => ({ ui: { ...state.ui, isLoading: true } }));

        try {
          const success = gameController.deployShip(playerId, shipId, position);
          
          set((state) => ({
            ui: { ...state.ui, isLoading: false, error: success ? null : 'Deployment failed' }
          }));

          if (success) {
            logger.info('UI', 'Ship deployed', { shipId, position });
          }

          return success;
        } catch (error) {
          logger.error('UI', 'Error deploying ship', { shipId, position, error });
          set((state) => ({
            ui: { ...state.ui, error: 'Deployment failed', isLoading: false }
          }));
          return false;
        }
      },

      deployMothership: async (dockHex: HexCoordinate): Promise<boolean> => {
        const { gameController, playerId } = get();
        if (!gameController || !playerId) return false;

        set((state) => ({ ui: { ...state.ui, isLoading: true } }));

        try {
          const success = gameController.deployMothership(playerId, dockHex);
          
          set((state) => ({
            ui: { ...state.ui, isLoading: false, error: success ? null : 'Mothership deployment failed' }
          }));

          if (success) {
            logger.info('UI', 'Mothership deployed', { playerId, dockHex });
          }

          return success;
        } catch (error) {
          logger.error('UI', 'Error deploying mothership', { playerId, dockHex, error });
          set((state) => ({
            ui: { ...state.ui, error: 'Mothership deployment failed', isLoading: false }
          }));
          return false;
        }
      },

      moveMothership: async (targetHex: HexCoordinate): Promise<boolean> => {
        const { gameController, playerId } = get();
        if (!gameController || !playerId) return false;

        set((state) => ({ ui: { ...state.ui, isLoading: true } }));

        try {
          const success = gameController.moveMothership(playerId, targetHex);
          
          set((state) => ({
            ui: { ...state.ui, isLoading: false, error: success ? null : 'Mothership move failed' }
          }));

          if (success) {
            logger.info('UI', 'Mothership moved', { playerId, targetHex });
          }

          return success;
        } catch (error) {
          logger.error('UI', 'Error moving mothership', { playerId, targetHex, error });
          set((state) => ({
            ui: { ...state.ui, error: 'Mothership move failed', isLoading: false }
          }));
          return false;
        }
      },

      enterCockpit: async (shipId: string): Promise<boolean> => {
        const { gameController, playerId } = get();
        if (!gameController || !playerId) return false;

        try {
          const success = gameController.enterCockpit(playerId, shipId);
          
          if (success) {
            logger.info('UI', 'Ship entered cockpit', { playerId, shipId });
          }

          return success;
        } catch (error) {
          logger.error('UI', 'Error entering cockpit', { playerId, shipId, error });
          return false;
        }
      },

      exitCockpit: async (): Promise<boolean> => {
        const { gameController, playerId } = get();
        if (!gameController || !playerId) return false;

        try {
          const success = gameController.exitCockpit(playerId);
          
          if (success) {
            logger.info('UI', 'Ship exited cockpit', { playerId });
          }

          return success;
        } catch (error) {
          logger.error('UI', 'Error exiting cockpit', { playerId, error });
          return false;
        }
      },

      enterDock: async (shipId: string): Promise<boolean> => {
        const { gameController, playerId } = get();
        if (!gameController || !playerId) return false;

        try {
          const success = gameController.enterDock(playerId, shipId);
          
          if (success) {
            logger.info('UI', 'Ship entered dock', { playerId, shipId });
          }

          return success;
        } catch (error) {
          logger.error('UI', 'Error entering dock', { playerId, shipId, error });
          return false;
        }
      },

      exitDock: async (targetHex: HexCoordinate): Promise<boolean> => {
        const { gameController, playerId } = get();
        if (!gameController || !playerId) return false;

        try {
          const success = gameController.exitDock(playerId, targetHex);
          
          if (success) {
            logger.info('UI', 'Ship exited dock', { playerId, targetHex });
          }

          return success;
        } catch (error) {
          logger.error('UI', 'Error exiting dock', { playerId, targetHex, error });
          return false;
        }
      },

      endTurn: () => {
        const { gameController } = get();
        if (!gameController) return;

        const success = gameController.endTurn();
        if (success) {
          // Clear selection when turn ends
          set((state) => ({
            ui: {
              ...state.ui,
              selectedShip: null,
              availableMoves: []
            }
          }));
          
          logger.info('UI', 'Turn ended');
        }
      },

      // UI Actions
      setHoveredHex: (hex: HexCoordinate | null) => {
        set((state) => ({
          ui: { ...state.ui, hoveredHex: hex }
        }));
      },

      toggleFleetPanel: () => {
        set((state) => ({
          ui: { ...state.ui, showFleetPanel: !state.ui.showFleetPanel }
        }));
      },

      toggleGameMenu: () => {
        set((state) => ({
          ui: { ...state.ui, showGameMenu: !state.ui.showGameMenu }
        }));
      },

      setAnimationsEnabled: (enabled: boolean) => {
        set((state) => ({
          ui: { ...state.ui, animationsEnabled: enabled }
        }));
        logger.info('UI', 'Animations toggled', { enabled });
      },

      setSoundEnabled: (enabled: boolean) => {
        set((state) => ({
          ui: { ...state.ui, soundEnabled: enabled }
        }));
        logger.info('UI', 'Sound toggled', { enabled });
      },

      setError: (error: string | null) => {
        set((state) => ({
          ui: { ...state.ui, error }
        }));
      },

      // Getters
      getCurrentPlayer: () => {
        const { gameState } = get();
        return gameState?.currentPlayerId || null;
      },

      isMyTurn: () => {
        const { gameState, playerId } = get();
        return gameState?.currentPlayerId === playerId;
      },

      canMoveShip: (shipId: string) => {
        const { gameState, playerId } = get();
        if (!gameState || !playerId || gameState.currentPlayerId !== playerId) {
          return false;
        }

        // Check if we can still make moves this turn
        return !gameState.movesThisTurn.otherShipMoved;
      },

      canEndTurn: () => {
        const { gameState, playerId } = get();
        if (!gameState || !playerId) return false;
        
        return gameState.currentPlayerId === playerId && 
               gameState.phase === GamePhase.PLAYING;
      }
    }),
    {
      name: 'space-hex-game-store',
      partialize: (state) => ({
        // Only persist UI preferences, not game state
        ui: {
          animationsEnabled: state.ui.animationsEnabled,
          soundEnabled: state.ui.soundEnabled
        }
      })
    }
  )
);

// Selector hooks for better performance
export const useGameState = () => useGameStore((state) => state.gameState);
export const useUIState = () => useGameStore((state) => state.ui);
export const useSelectedShip = () => useGameStore((state) => state.ui.selectedShip);
export const useSelectedShipId = () => useGameStore((state) => state.ui.selectedShip?.id);
export const useAvailableMoves = () => useGameStore((state) => state.ui.availableMoves);
export const useCurrentPlayer = () => useGameStore((state) => state.getCurrentPlayer());
export const useIsMyTurn = () => useGameStore((state) => state.isMyTurn());
export const useAnimationsEnabled = () => useGameStore((state) => state.ui.animationsEnabled);
export const useSoundEnabled = () => useGameStore((state) => state.ui.soundEnabled);