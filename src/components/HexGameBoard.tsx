/**
 * HexGameBoard - PROPER hexagonal game board with ACTUAL hexagon shapes
 * 91 hexagons arranged in a larger hexagon shape - like hexagonal chess
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  ScrollView,
  PanResponder,
  GestureResponderEvent
} from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { logger } from '../utils/Logger';
import { SHIP_MOVEMENT_PATTERNS, getHexDirection, getRelativeDirection } from '../config/shipMovementPatterns';
import { GameTimer } from './ui/GameTimer';
import { SHIP_ACTION_POINTS, getForwardHex, getAdjacentHexes, PlannedAction } from '../config/actionPointConfig';
import { ActionPointMovement } from './ActionPointMovement';

// Hex coordinate system
interface HexCoordinate {
  col: string; // a-l
  row: number; // 1-11
  q: number; // axial coordinate q
  r: number; // axial coordinate r
  x: number; // screen x
  y: number; // screen y
}

// Asset imports
const SHIP_IMAGES = {
  BLUE_ARTILLERY: require('../assets/ships/Blue Artillery.png'),
  BLUE_CAPTAIN: require('../assets/ships/Blue Battleship.png'),
  BLUE_FLEET_ADMIRAL: require('../assets/ships/Blue Cruiser.png'),
  BLUE_CORVETTE: require('../assets/ships/Blue Corvette.png'),
  BLUE_DESTROYER: require('../assets/ships/Blue Destroyer.png'),
  BLUE_INTERCEPTOR: require('../assets/ships/Blue Interceptor.png'),
  BLUE_SCOUT: require('../assets/ships/Blue Scout.png'),
  BLUE_MOTHERSHIP: require('../assets/ships/Blue_Command_Ship.png'),
  // Red ships
  RED_ARTILLERY: require('../assets/ships/Red Artillery.png'),
  RED_CAPTAIN: require('../assets/ships/Red Battleship.png'),
  RED_FLEET_ADMIRAL: require('../assets/ships/Red Cruiser.png'),
  RED_CORVETTE: require('../assets/ships/Red Corvette.png'),
  RED_DESTROYER: require('../assets/ships/Red Destroyer.png'),
  RED_INTERCEPTOR: require('../assets/ships/Red Interceptor.png'),
  RED_SCOUT: require('../assets/ships/Red Scout.png'),
  RED_MOTHERSHIP: require('../assets/ships/Red_Command_Ship.png'),
  // Green ships
  GREEN_ARTILLERY: require('../assets/ships/Green Artillery.png'),
  GREEN_CAPTAIN: require('../assets/ships/Green Battleship.png'),
  GREEN_FLEET_ADMIRAL: require('../assets/ships/Green Cruiser.png'),
  GREEN_CORVETTE: require('../assets/ships/Green Corvette.png'),
  GREEN_MOTHERSHIP: require('../assets/ships/Green_Command_Ship.png'),
  GREEN_DESTROYER: require('../assets/ships/Green Destroyer.png'),
  GREEN_INTERCEPTOR: require('../assets/ships/Green Interceptor.png'),
  GREEN_SCOUT: require('../assets/ships/Green Scout.png'),
  // Yellow ships
  YELLOW_ARTILLERY: require('../assets/ships/Yellow Artillery.png'),
  YELLOW_CAPTAIN: require('../assets/ships/Yellow Battleship.png'),
  YELLOW_FLEET_ADMIRAL: require('../assets/ships/Yellow Cruiser.png'),
  YELLOW_CORVETTE: require('../assets/ships/Yellow Corvette.png'),
  YELLOW_DESTROYER: require('../assets/ships/Yellow Destroyer.png'),
  YELLOW_INTERCEPTOR: require('../assets/ships/Yellow Interceptor.png'),
  YELLOW_SCOUT: require('../assets/ships/Yellow Scout.png'),
  YELLOW_MOTHERSHIP: require('../assets/ships/Yellow_Command_Ship.png'),
};

// Meteor images for visual variety
const METEOR_IMAGES = [
  require('../assets/Meteor_01.png'),
  require('../assets/Meteor_02.png'),
  require('../assets/Meteor_03.png'),
  require('../assets/Meteor_04.png'),
  require('../assets/Meteor_05.png'),
  require('../assets/Meteor_06.png'),
  require('../assets/Meteor_07.png'),
  require('../assets/Meteor_08.png'),
  require('../assets/Meteor_09.png'),
  require('../assets/Meteor_10.png'),
];

// Debris field image
const DEBRIS_IMAGE = require('../assets/Debris.png');

interface Ship {
  id: string;
  type: string;
  color: string;
  position: HexCoordinate;
  owner?: string; // Session ID of the owner (for multiplayer)
  rotation: number; // Rotation in degrees (0=N, 60=NE, 120=SE, 180=S, 240=SW, 300=NW)
}

interface Player {
  id: string;
  name: string;
  assignedZone?: number; // 1, 2, 3, or 4
  isAI?: boolean;
  isCurrentPlayer?: boolean; // True for the current player in multiplayer
}

interface DiceRoll {
  playerId: string;
  playerName: string;
  roll: number;
}

interface HexGameBoardProps {
  style?: any;
  onHexTap?: (hex: HexCoordinate) => void;
  onShipTap?: (ship: Ship) => void;
  players?: Player[];
  gamePhase?: string;
  onZoneSelected?: (playerId: string, zoneNumber: number) => void;
  containerHeight?: number;
  containerWidth?: number;
  selectedShip?: any;
  onShipDeployed?: (ship: Ship) => void;
  onShipSelect?: (ship: any) => void; // Add callback to update selectedShip
  aiShipsToDeploy?: any;
  mapType?: string;
  onShipCountsChanged?: (humanCount: number, aiCount: number) => void;
  deploymentConfirmed?: boolean;
  autoDeployTrigger?: number; // Increment to trigger auto-deploy
  isReviewMode?: boolean;
  reviewShips?: Ship[];
}

// Helper function to convert col/row to axial coordinates
const colRowToAxial = (col: string, row: number): { q: number, r: number } => {
  const colIndex = col.charCodeAt(0) - 'a'.charCodeAt(0);
  const centerCol = 5; // 'f' is the center column
  const centerRow = 6; // Row 6 is the center
  
  // Calculate q based on column
  const q = colIndex - centerCol;
  
  // Calculate r based on row and column offset
  const r = row - centerRow - Math.floor((colIndex - centerCol) / 2);
  
  return { q, r };
};

export const HexGameBoard: React.FC<HexGameBoardProps> = ({
  style,
  onHexTap,
  onShipTap,
  players = [],
  gamePhase = 'lobby',
  onZoneSelected,
  containerHeight,
  containerWidth,
  selectedShip,
  onShipDeployed,
  onShipSelect,
  aiShipsToDeploy,
  mapType = 'Classic',
  onShipCountsChanged,
  deploymentConfirmed = false,
  autoDeployTrigger = 0,
  isReviewMode = false,
  reviewShips = []
}) => {
  const containerRef = useRef<View>(null);
  const [boardHexes, setBoardHexes] = useState<HexCoordinate[]>([]);
  const boardHexesRef = useRef<HexCoordinate[]>([]);
  const shipsRef = useRef<Ship[]>([]);
  const [deploymentZones, setDeploymentZones] = useState<{
    topLeft: HexCoordinate[];
    topRight: HexCoordinate[];
    bottomLeft: HexCoordinate[];
    bottomRight: HexCoordinate[];
  }>({ topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] });
  const [selectedHex, setSelectedHex] = useState<HexCoordinate | null>(null);
  const [ships, setShips] = useState<Ship[]>([]);
  
  // Keep shipsRef in sync with ships state
  useEffect(() => {
    shipsRef.current = ships;
  }, [ships]);
  const [boardDimensions, setBoardDimensions] = useState({ 
    width: 0, 
    height: 0, 
    fitsVertically: true, 
    fitsHorizontally: true 
  });
  const [screenDimensions, setScreenDimensions] = useState(Dimensions.get('window'));
  const [animatingShips, setAnimatingShips] = useState<Map<string, {
    fromPos: { x: number, y: number },
    toPos: { x: number, y: number },
    targetHex: { col: string, row: number },
    fromRotation: number,
    toRotation: number,
    progress: number
  }>>(new Map());
  
  // State to track pending rotations after animations complete
  const [pendingRotations, setPendingRotations] = useState<Map<string, number>>(new Map());
  
  // Zone selection system
  const [diceRolls, setDiceRolls] = useState<DiceRoll[]>([]);
  const [zoneSelectionOrder, setZoneSelectionOrder] = useState<string[]>([]);
  const [currentPlayerSelectingZone, setCurrentPlayerSelectingZone] = useState<string | null>(null);
  const [availableZones, setAvailableZones] = useState<number[]>([1, 2, 3, 4]);
  const [zoneSelectionPhase, setZoneSelectionPhase] = useState<'rolling' | 'selecting' | 'complete'>('rolling');
  const [meteors, setMeteors] = useState<HexCoordinate[]>([]);
  const [isTieReroll, setIsTieReroll] = useState(false);
  const [mapDebrisFields, setMapDebrisFields] = useState<HexCoordinate[]>([]); // Original map debris
  const [combatDebrisFields, setCombatDebrisFields] = useState<HexCoordinate[]>([]); // Combat-created debris
  const [meteorImages, setMeteorImages] = useState<{[key: string]: any}>({});
  
  // Combined debris fields for rendering
  const debrisFields = [...mapDebrisFields, ...combatDebrisFields];
  
  // Handle review mode ships
  React.useEffect(() => {
    if (isReviewMode && reviewShips.length > 0) {
      // In review mode, use the review ships instead of live ships
      setShips(reviewShips);
    }
  }, [isReviewMode, reviewShips]);
  
  // Save initial ship state when game transitions to playing phase
  React.useEffect(() => {
    // GamePhase changed
    
    if (gamePhase === 'playing' && !(window as any).gameInitialShipState) {
      // Attempting to save initial ship state
      // Save initial ship state for game review
      const room = (window as any).currentRoom;
      if (room && room.state && room.state.ships) {
        const initialShipState = [];
        room.state.ships.forEach((ship: any) => {
          if (ship && ship.col && ship.row !== undefined) {
            initialShipState.push({
              id: ship.id,
              type: ship.type,
              color: ship.color,
              owner: ship.owner,
              position: { col: ship.col, row: ship.row },
              rotation: normalizeRotation(ship.rotation || 0)
            });
          }
        });
        
        if (initialShipState.length > 0) {
          (window as any).gameInitialShipState = initialShipState;
          // Saved initial ship state when game started playing
        }
      } else if (ships.length > 0) {
        // Fallback: use local ships state
        const initialShipState = ships.map(ship => ({
          id: ship.id,
          type: ship.type,
          color: ship.color,
          owner: ship.owner,
          position: { col: ship.position.col, row: ship.position.row },
          rotation: normalizeRotation(ship.rotation || 0)
        }));
        (window as any).gameInitialShipState = initialShipState;
        // Saved initial ship state from local state
      }
    }
  }, [gamePhase, ships]);
  
  
  
  // Set up callback for review mode
  React.useEffect(() => {
    (window as any).setReviewShipsCallback = (ships: Ship[]) => {
      if (isReviewMode) {
        setShips(ships);
      }
    };
    
    // Callback for review mode debris fields
    (window as any).setReviewDebrisFields = (debrisFields: HexCoordinate[]) => {
      if (isReviewMode) {
        setCombatDebrisFields(debrisFields || []);
      }
    };
    
    // Animation handler for review mode moves
    (window as any).animateReviewMoves = (moves: any[], finalShips: Ship[]) => {
      if (!isReviewMode) return;
      
      // Animating review moves
      
      // Process moves sequentially with animations
      let moveIndex = 0;
      
      const animateNextMove = () => {
        if (moveIndex >= moves.length) {
          // All moves animated, set final state
          setShips(finalShips);
          if ((window as any).setReviewShipsCallback) {
            (window as any).setReviewShipsCallback(finalShips);
          }
          return;
        }
        
        const move = moves[moveIndex];
        moveIndex++;
        
        // Set the ships to the state before this move
        if (move.previousShips) {
          setShips(move.previousShips);
        }
        
        // Animate the move
        setTimeout(() => {
          if (move.action === 'move' || move.action === 'combat') {
            // Find the ship that's moving
            const ship = ships.find(s => s.id === move.shipId);
            if (ship && move.fromCol !== undefined && move.fromRow !== undefined) {
              // Start animation from current position to target
              const fromHex = { col: move.fromCol, row: move.fromRow };
              const toHex = { col: move.toCol, row: move.toRow };
              const fromRotation = move.fromRotation || 0;
              const toRotation = move.toRotation || fromRotation;
              
              // Get screen positions for animation
              const fromPos = hexToScreenPosition(move.fromCol, move.fromRow);
              const toPos = hexToScreenPosition(move.toCol, move.toRow);
              
              setAnimatingShips(new Map([[
                move.shipId,
                {
                  fromHex,
                  targetHex: toHex,
                  fromPos,
                  toPos,
                  fromRotation,
                  toRotation,
                  duration: 1500,
                  startTime: Date.now(),
                  progress: 0,
                  phase: 'rotating'
                }
              ]]));
              
              // Wait for animation to complete, then continue
              setTimeout(animateNextMove, 1500);
            } else {
              // No animation needed, continue immediately
              animateNextMove();
            }
          } else if (move.action === 'rotate') {
            // Just rotation animation
            const ship = ships.find(s => s.id === move.shipId);
            if (ship) {
              const fromRotation = move.fromRotation || 0;
              const toRotation = move.toRotation || 0;
              
              // Get screen position for rotation animation
              const pos = hexToScreenPosition(ship.position.col, ship.position.row);
              
              setAnimatingShips(new Map([[
                move.shipId,
                {
                  fromHex: ship.position,
                  targetHex: ship.position,
                  fromPos: pos,
                  toPos: pos,
                  fromRotation,
                  toRotation,
                  duration: 800,
                  startTime: Date.now(),
                  progress: 0,
                  phase: 'rotating'
                }
              ]]));
              
              // Wait for rotation to complete
              setTimeout(animateNextMove, 800);
            } else {
              animateNextMove();
            }
          } else {
            // Unknown action, skip
            animateNextMove();
          }
        }, 200); // Small delay between moves for clarity
      };
      
      // Start the animation sequence
      animateNextMove();
    };
    
    return () => {
      delete (window as any).setReviewShipsCallback;
      delete (window as any).setReviewDebrisFields;
      delete (window as any).animateReviewMoves;
    };
  }, [isReviewMode, ships]);

  // Animation loop for ship movements  
  React.useEffect(() => {
    // Track the number of animating ships globally
    (window as any).animatingShipsCount = animatingShips.size;
    
    if (animatingShips.size === 0) {
      // Notify parent that animations are complete
      if ((window as any).onAnimationsComplete) {
        (window as any).onAnimationsComplete();
      }
      return;
    }
    
    logger.debug('Animation loop running, animating ships:', animatingShips.size);
    
    let animationId: number;
    
    const animate = () => {
      const now = Date.now();
      
      setAnimatingShips(prev => {
        const newMap = new Map(prev);
        const completed: { shipId: string, toPos: { col: string, row: number }, toRotation: number }[] = [];
        
        newMap.forEach((animation, shipId) => {
          // Calculate progress based on elapsed time
          const elapsed = now - animation.startTime;
          const progress = Math.min(1, elapsed / animation.duration);
          animation.progress = progress;
          
          // Check if animation is complete
          if (progress >= 1) {
            // Animation complete - store data for position update
            completed.push({ 
              shipId, 
              toPos: animation.targetHex,
              toRotation: animation.toRotation 
            });
          }
        });
        
        // Update ship positions when animations complete
        if (completed.length > 0) {
          setShips(prevShips => prevShips.map(ship => {
            const completedAnim = completed.find(c => c.shipId === ship.id);
            if (completedAnim && completedAnim.toPos.col) {
              // Calculate final rotation angle
              const rotationToFacingMap: { [key: number]: number } = {
                30: 5,    // NE
                90: 0,    // E
                150: 1,   // SE
                210: 2,   // SW
                270: 3,   // W
                330: 4    // NW
              };
              
              // Find the closest rotation angle (snap to 60° increments starting at 30°)
              const normalizedRotation = ((completedAnim.toRotation % 360) + 360) % 360;
              // Map to closest hex direction angle
              let closestAngle = 30;
              let minDiff = 360;
              for (const angle of [30, 90, 150, 210, 270, 330]) {
                const diff = Math.abs(normalizedRotation - angle);
                const wrapDiff = Math.abs(normalizedRotation - (angle + 360));
                const actualDiff = Math.min(diff, wrapDiff, Math.abs(normalizedRotation + 360 - angle));
                if (actualDiff < minDiff) {
                  minDiff = actualDiff;
                  closestAngle = angle;
                }
              }
              const calculatedFacing = rotationToFacingMap[closestAngle] ?? 0;
              
              // For own ships during action phase, always use the current local rotation
              // This ensures we get the most recent rotation even if ship was rotated after move started
              let finalRotation = ship.rotation;
              
              // Check if this is the player's own ship during action phase
              const room = (window as any).currentRoom;
              let isOwnShip = false;
              
              if (room && room.sessionId) {
                // Determine if this ship belongs to the current player
                // Ships have an owner property that matches the sessionId
                isOwnShip = ship.owner === room.sessionId;
              }
              
              // Check if we're in a phase where the ship can be actively controlled
              const isActivePhase = gamePhase === 'action' || gamePhase === 'playing';
              
              if (isOwnShip && isActivePhase) {
                // Find the most current rotation from the local ship state
                // This handles cases where ship was rotated multiple times after movement started
                const currentShips = shipsRef.current || ships;
                const currentShip = currentShips.find(s => s.id === ship.id);
                if (currentShip && currentShip.rotation !== undefined) {
                  finalRotation = normalizeRotation(currentShip.rotation);
                }
              } else {
                // For other players' ships or non-action phases, use pending rotation if available
                finalRotation = pendingRotations.get(ship.id) ?? ship.rotation;
              }
              
              // Animation complete - updating ship
              
              return {
                ...ship,
                position: completedAnim.toPos,
                rotation: finalRotation
              };
            }
            return ship;
          }));
          
          // Clear any pending rotation updates
          if (pendingRotations.size > 0) {
            setPendingRotations(prev => {
              const newMap = new Map(prev);
              completed.forEach(c => {
                newMap.delete(c.shipId);
              });
              return newMap;
            });
          }
        }
        
        // Remove completed animations
        completed.forEach(c => newMap.delete(c.shipId));
        
        if (newMap.size > 0) {
          animationId = requestAnimationFrame(animate);
        }
        
        return newMap;
      });
    };
    
    animationId = requestAnimationFrame(animate);
    
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [animatingShips.size]);
  
  // Debug log only when debris fields change
  useEffect(() => {
    if (combatDebrisFields.length > 0) {
      // Combat debris fields update
    }
  }, [combatDebrisFields.length]);
  const [selectedShipForMovement, setSelectedShipForMovement] = useState<Ship | null>(null);
  const [validMoveTargets, setValidMoveTargets] = useState<HexCoordinate[]>([]);
  const [showActionPointUI, setShowActionPointUI] = useState(false);
  const [useActionPoints, setUseActionPoints] = useState(true); // Toggle between old and new system
  const [currentAP, setCurrentAP] = useState(0);
  const [maxAP, setMaxAP] = useState(0);
  const [hasUsedAP, setHasUsedAP] = useState(false); // Track if any AP has been used this turn
  const [viewingEnemyShip, setViewingEnemyShip] = useState<Ship | null>(null); // For viewing enemy unit info
  const [shipRotation, setShipRotation] = useState(0);
  const [plannedActions, setPlannedActions] = useState<PlannedAction[]>([]);
  const [deploymentRotationShip, setDeploymentRotationShip] = useState<Ship | null>(null);
  const [isProcessingClick, setIsProcessingClick] = useState(false); // Prevent rapid clicks
  
  // Touch rotation state
  const [isDraggingRotation, setIsDraggingRotation] = useState(false);
  const [dragStartRotation, setDragStartRotation] = useState<number | null>(null);
  const [originalRotation, setOriginalRotation] = useState<number | null>(null); // Original rotation when ship was selected
  const [previewRotation, setPreviewRotation] = useState<number | null>(null);
  const [rotationAPCost, setRotationAPCost] = useState(0);
  const [shipThatUsedAP, setShipThatUsedAP] = useState<string | null>(null); // Track which ship used AP this turn
  
  // Animation event states (for future sprite animations)
  const [animationEvents, setAnimationEvents] = useState<{
    thrusters: { shipId: string, active: boolean }[];
    lasers: { from: HexCoordinate, to: HexCoordinate, shipId: string }[];
    rockets: { from: HexCoordinate, to: HexCoordinate, shipId: string }[];
    explosions: { position: HexCoordinate, timestamp: number }[];
  }>({
    thrusters: [],
    lasers: [],
    rockets: [],
    explosions: []
  });
  
  // Helper function for ship initial rotation based on deployment zone
  const getInitialRotationForZone = (zone: number): number => {
    // Ships face toward center - using proper 60° increments
    switch(zone) {
      case 1: return 240; // Zone 1 (East) faces SW toward center
      case 2: return 60;  // Zone 2 (West) faces NE toward center
      case 3: return 120; // Zone 3 (North) faces SE toward center
      case 4: return 300; // Zone 4 (South) faces NW toward center
      default: return 0;  // Default to North
    }
  };
  
  // Helper function to get screen position of a hex
  const hexToScreenPosition = (col: string, row: number): { x: number, y: number } => {
    // Use boardHexesRef.current for consistency in message handlers
    const hexArray = boardHexesRef.current.length > 0 ? boardHexesRef.current : boardHexes;
    const hex = hexArray.find(h => h.col === col && h.row === row);
    if (!hex || hex.x === undefined || hex.y === undefined) {
      logger.error(`Hex not found or invalid: ${col}${row}`, hex);
      logger.error('Available hexes:', hexArray.length);
      // Return a visible position as fallback instead of 0,0
      return { x: 300, y: 300 };
    }
    return { x: hex.x, y: hex.y };
  };

  // Normalize rotation to valid hex direction (0, 60, 120, 180, 240, 300)
  const normalizeRotation = (rotation: number): number => {
    // Normalize to 0-360 range
    const normalized = ((rotation % 360) + 360) % 360;
    
    // Round to nearest 60 degree increment
    const step = 60;
    return Math.round(normalized / step) * step % 360;
  };
  
  // Get the direction vector for a given rotation
  const getDirectionFromRotation = (rotation: number): { q: number, r: number } => {
    const normalized = normalizeRotation(rotation);
    
    // Map rotation to hex direction vectors
    // 0° = North, 60° = NE, 120° = SE, 180° = S, 240° = SW, 300° = NW
    const directions: { [key: number]: { q: number, r: number } } = {
      0:   { q: 0, r: -1 },  // North
      60:  { q: 1, r: -1 },  // Northeast
      120: { q: 1, r: 0 },   // Southeast  
      180: { q: 0, r: 1 },   // South
      240: { q: -1, r: 1 },  // Southwest
      300: { q: -1, r: 0 }   // Northwest
    };
    
    return directions[normalized] || { q: 0, r: -1 };
  };
  
  // Calculate the shortest rotation path between two angles in degrees
  const calculateShortestRotation = (from: number, to: number): number => {
    // Normalize angles to 0-360
    from = ((from % 360) + 360) % 360;
    to = ((to % 360) + 360) % 360;
    
    // Calculate difference
    let diff = to - from;
    
    // Adjust for shortest path (should be between -180 and 180)
    if (diff > 180) {
      diff -= 360;
    } else if (diff < -180) {
      diff += 360;
    }
    
    return diff;
  };
  
  // Calculate AP cost for rotation (minimum path)
  const calculateRotationAPCost = (from: number, to: number): number => {
    const rotation = calculateShortestRotation(from, to);
    // Each 60° rotation costs 1 AP
    return Math.abs(Math.round(rotation / 60));
  };

  // Calculate rotation angle based on movement direction using screen coordinates
  const calculateRotationForMovement = (from: HexCoordinate, to: HexCoordinate): number => {
    // If we already have x,y coordinates, use them directly
    let fromX = from.x;
    let fromY = from.y;
    let toX = to.x;
    let toY = to.y;
    
    // If x,y not available, calculate from col/row
    if (fromX === undefined || fromY === undefined) {
      const fromPos = hexToScreenPosition(from.col, from.row);
      fromX = fromPos.x;
      fromY = fromPos.y;
    }
    if (toX === undefined || toY === undefined) {
      const toPos = hexToScreenPosition(to.col, to.row);
      toX = toPos.x;
      toY = toPos.y;
    }
    
    // Calculate angle using screen coordinates
    const dx = toX - fromX;
    const dy = toY - fromY;
    
    // Calculate angle in degrees (0° is right, increases clockwise)
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    
    // Adjust so 0° is up (north) and increases clockwise
    // atan2 gives: right=0°, down=90°, left=180°/-180°, up=-90°
    // We want: up=0°, right=90°, down=180°, left=270°
    angle = (angle + 90 + 360) % 360;
    
    // Return exact angle - no snapping!
    // Ship will face exactly toward target
    return angle;
  };
  
  // Animation trigger functions (for future sprite animations)
  const triggerThrusterAnimation = (shipId: string, duration: number = 1000) => {
    setAnimationEvents(prev => ({
      ...prev,
      thrusters: [...prev.thrusters, { shipId, active: true }]
    }));
    
    // Auto-clear after duration
    setTimeout(() => {
      setAnimationEvents(prev => ({
        ...prev,
        thrusters: prev.thrusters.filter(t => t.shipId !== shipId)
      }));
    }, duration);
    
    // Thruster animation triggered
  };
  
  const triggerLaserAnimation = (from: HexCoordinate, to: HexCoordinate, shipId: string) => {
    setAnimationEvents(prev => ({
      ...prev,
      lasers: [...prev.lasers, { from, to, shipId }]
    }));
    
    // Clear after animation duration
    setTimeout(() => {
      setAnimationEvents(prev => ({
        ...prev,
        lasers: prev.lasers.filter(l => l.shipId !== shipId)
      }));
    }, 500);
    
    // Laser animation triggered
  };
  
  const triggerRocketAnimation = (from: HexCoordinate, to: HexCoordinate, shipId: string) => {
    setAnimationEvents(prev => ({
      ...prev,
      rockets: [...prev.rockets, { from, to, shipId }]
    }));
    
    // Clear after animation duration
    setTimeout(() => {
      setAnimationEvents(prev => ({
        ...prev,
        rockets: prev.rockets.filter(r => r.shipId !== shipId)
      }));
    }, 800);
    
    // Rocket animation triggered
  };
  
  const triggerExplosionAnimation = (position: HexCoordinate) => {
    const timestamp = Date.now();
    setAnimationEvents(prev => ({
      ...prev,
      explosions: [...prev.explosions, { position, timestamp }]
    }));
    
    // Clear after animation duration
    setTimeout(() => {
      setAnimationEvents(prev => ({
        ...prev,
        explosions: prev.explosions.filter(e => e.timestamp !== timestamp)
      }));
    }, 1000);
    
    // Explosion animation triggered
  };
  
  const [showDiceResults, setShowDiceResults] = useState(false);
  const [shipsStoppedInDebris, setShipsStoppedInDebris] = useState<string[]>([]); // Ship IDs stopped in debris
  const [aiShipsDeployed, setAiShipsDeployed] = useState(false); // Track if AI ships have been deployed

  // Simple, stable dimension calculations
  const effectiveWidth = containerWidth || screenDimensions.width;
  const effectiveHeight = containerHeight || screenDimensions.height;
  const fleetPoolHeight = gamePhase === 'deployment' ? 140 : 0;
  const availableWidth = effectiveWidth - 20;
  const availableHeight = effectiveHeight - 20 - fleetPoolHeight;
  
  // Calculate hex radius with memoization to prevent unnecessary recalculations
  const hexRadius = useMemo(() => {
    // Scale hex size more aggressively for better responsiveness
    // The hexagonal board has 11 hexes at the widest point and approximately 11 rows
    // Board needs approximately 11 * 1.5 * radius width and 11 * sqrt(3) * radius height
    const boardRequiredWidth = 11 * 1.5; // Hex width with spacing
    const boardRequiredHeight = 11 * Math.sqrt(3) * 0.85; // Hex height with vertical overlap
    
    const widthScale = availableWidth / boardRequiredWidth;
    const heightScale = availableHeight / boardRequiredHeight;
    
    // Use the smaller of the two to ensure board fits both dimensions
    const baseHexRadius = Math.min(widthScale, heightScale) * 0.9; // 90% to add margin
    const maxHexRadius = 50; // Maximum hex size for larger screens
    const calculatedRadius = Math.max(Math.min(baseHexRadius, maxHexRadius), 8); // Minimum readable size
    
    // Log dimension changes for debugging
    logger.debug('HEX_BOARD', 'Hex radius calculation', {
      availableWidth,
      availableHeight,
      widthScale,
      heightScale,
      baseHexRadius,
      calculatedRadius
    });
    
    return calculatedRadius;
  }, [availableWidth, availableHeight]);
  
  const isLandscape = screenDimensions.width > screenDimensions.height;

  // Hexagon geometry
  const HEX_WIDTH = hexRadius * 2;
  const HEX_HEIGHT = hexRadius * Math.sqrt(3);
  const HEX_HORIZONTAL_SPACING = HEX_WIDTH * 0.75;
  const HEX_VERTICAL_SPACING = HEX_HEIGHT;

  // Listen for dimension changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenDimensions(window);
    });
    
    return () => subscription?.remove();
  }, []);

  // Store previous hex radius to detect changes
  const prevHexRadiusRef = useRef(hexRadius);
  
  // Generate the 91-hex hexagonal board
  // Generate board only when essential values change
  useEffect(() => {
    const width = containerWidth || screenDimensions.width || 800;
    const height = containerHeight || screenDimensions.height || 600;
    
    // Always generate board if it's empty
    if (boardHexes.length === 0 && width > 0 && height > 0) {
      generateHexagonalBoard();
      prevHexRadiusRef.current = hexRadius;
      return;
    }
    
    // Check if hex radius changed significantly (more than 1 pixel)
    const radiusChanged = Math.abs(hexRadius - prevHexRadiusRef.current) > 1;
    
    logger.debug('HEX_BOARD', 'Board generation check', {
      boardHexesLength: boardHexes.length,
      prevRadius: prevHexRadiusRef.current,
      currentRadius: hexRadius,
      radiusChanged,
      width,
      height
    });
    
    // Regenerate board if hex radius changed significantly
    if (radiusChanged && width > 0 && height > 0) {
      logger.info('HEX_BOARD', 'Regenerating board due to dimension change', {
        prevRadius: prevHexRadiusRef.current,
        newRadius: hexRadius
      });
      generateHexagonalBoard();
      prevHexRadiusRef.current = hexRadius;
    }
  }, [containerWidth, containerHeight, screenDimensions.width, screenDimensions.height, mapType, isReviewMode, hexRadius]);

  // Generate map features when mapType changes or board is ready
  useEffect(() => {
    if (boardHexes.length > 0) {
      generateMapFeatures(boardHexes);
    }
  }, [mapType, boardHexes.length]);

  // Initialize zone selection when players change
  useEffect(() => {
    if (players.length > 0 && gamePhase === 'deployment' && zoneSelectionPhase === 'rolling') {
      // Reset AI deployment flag for new game
      setAiShipsDeployed(false);
      
      // Check if this is a multiplayer game
      const room = (window as any).currentRoom;
      if (room) {
        // Multiplayer - dice rolls handled by server
        // Waiting for server dice rolls
      } else {
        // AI game - do local dice rolls
        rollDiceForAllPlayers();
      }
    }
  }, [players, gamePhase]);

  // Handle AI deployment - only deploy once
  useEffect(() => {
    if (aiShipsToDeploy && boardHexes.length > 0 && !aiShipsDeployed && players.length > 0) {
      // AI deployment check
      
      // Make sure deployment zones are ready
      if (Object.keys(deploymentZones).every(key => deploymentZones[key].length > 0)) {
        deployAIShips();
        setAiShipsDeployed(true);
      }
    }
  }, [aiShipsToDeploy, boardHexes.length, aiShipsDeployed, players, deploymentZones]);

  // Track ship counts and report to parent
  useEffect(() => {
    if (onShipCountsChanged && gamePhase === 'playing') {
      const humanShips = ships.filter(ship => ship.color === 'blue').length;
      const aiShips = ships.filter(ship => ship.color === 'red').length;
      onShipCountsChanged(humanShips, aiShips);
    }
  }, [ships.length, gamePhase]);
  
  // Debug: Log when ships array changes
  useEffect(() => {
    logger.debug('=== Ships array changed ===');
    logger.debug('Total ships:', ships.length);
    ships.forEach(ship => {
      logger.debug(`Ship ${ship.id} (${ship.color}) at ${ship.position.col}${ship.position.row} owner: ${ship.owner}`);
    });
    // Make ships globally accessible for debugging
    (window as any).currentShips = ships;
    
    // Also expose animatingShips for debugging
    (window as any).debugAnimatingShips = animatingShips;
  }, [ships, animatingShips]);
  
  // Function to sync ships from gameStarted message
  const syncShipsFromGameStart = useCallback(() => {
    const pendingSync = (window as any).pendingGameStartSync;
    if (!pendingSync) return;
    
    const { room } = pendingSync;
    
    logger.debug('Attempting to sync ships from gameStarted...');
    logger.debug('Board hexes available:', boardHexes.length);
    
    if (boardHexes.length === 0) {
      logger.debug('Board not ready yet, will retry when hexes are loaded');
      return;
    }
    
    if (room.state && room.state.ships) {
      logger.debug('Server ships to sync:', room.state.ships.size || room.state.ships.length);
      const allShipsFromServer: Ship[] = [];
      
      room.state.ships.forEach((serverShip: any) => {
        if (serverShip && serverShip.col && serverShip.row !== undefined) {
          // Find the hex for complete coordinates
          const hex = boardHexes.find(h => 
            h.col === serverShip.col && 
            h.row === serverShip.row
          );
          
          if (hex) {
            allShipsFromServer.push({
              id: serverShip.id,
              type: serverShip.type,
              color: serverShip.color,
              position: {
                col: serverShip.col,
                row: serverShip.row,
                q: hex.q,
                r: hex.r,
                x: hex.x,
                y: hex.y
              },
              owner: serverShip.owner,
              rotation: normalizeRotation(serverShip.rotation || 0)
            });
          } else {
            logger.warn(`Could not find hex for ship at ${serverShip.col}${serverShip.row}`);
          }
        }
      });
      
      logger.log(`Syncing ${allShipsFromServer.length} ships from server to local state`);
      logger.log('Ships being synced:', allShipsFromServer.map(s => ({
        id: s.id, 
        owner: s.owner,
        pos: `${s.position.col}${s.position.row}`,
        color: s.color
      })));
      
      setShips(allShipsFromServer);
      
      // Clear the pending sync
      (window as any).pendingGameStartSync = null;
      
      // Save initial ship state for game review
      const initialShipState = allShipsFromServer.map(ship => ({
        id: ship.id,
        type: ship.type,
        color: ship.color,
        owner: ship.owner,
        position: { col: ship.position.col, row: ship.position.row },
        rotation: normalizeRotation(ship.rotation || 0)
      }));
      
      if (initialShipState.length > 0) {
        (window as any).gameInitialShipState = initialShipState;
        logger.log('Saved initial ship state for review from gameStarted');
      }
    }
  }, [boardHexes]);
  
  // Try to sync ships when board hexes are loaded
  useEffect(() => {
    if (boardHexes.length > 0 && (window as any).pendingGameStartSync) {
      logger.log('Board hexes loaded, attempting pending ship sync...');
      syncShipsFromGameStart();
    }
  }, [boardHexes.length, syncShipsFromGameStart]);
  
  // Keep boardHexesRef in sync with boardHexes
  useEffect(() => {
    boardHexesRef.current = boardHexes;
  }, [boardHexes]);
  
  // Sync ships from server when game phase changes to playing
  useEffect(() => {
    if (gamePhase === 'playing') {
      const room = (window as any).currentRoom;
      if (room && room.state && room.state.ships && ships.length === 0) {
        logger.log('Game phase changed to playing, syncing ships from server');
        const allShipsFromServer: Ship[] = [];
        room.state.ships.forEach((serverShip: any) => {
          if (serverShip && serverShip.col && serverShip.row !== undefined) {
            // Find the hex for complete coordinates
            const hex = boardHexes.find(h => 
              h.col === serverShip.col && 
              h.row === serverShip.row
            );
            
            if (hex) {
              allShipsFromServer.push({
                id: serverShip.id,
                type: serverShip.type,
                color: serverShip.color,
                position: {
                  col: serverShip.col,
                  row: serverShip.row,
                  q: hex.q,
                  r: hex.r,
                  x: hex.x,
                  y: hex.y
                },
                owner: serverShip.owner,
                rotation: normalizeRotation(serverShip.rotation || 0)
              });
            }
          }
        });
        
        if (allShipsFromServer.length > 0) {
          logger.log(`Syncing ${allShipsFromServer.length} ships from server on phase change`);
          setShips(allShipsFromServer);
        }
      }
    }
  }, [gamePhase, boardHexes]);
  
  // Track if we've already processed this trigger
  const [lastProcessedTrigger, setLastProcessedTrigger] = useState(0);
  
  // Handle auto-deploy trigger from parent
  useEffect(() => {
    if (autoDeployTrigger > 0 && autoDeployTrigger > lastProcessedTrigger && gamePhase === 'deployment') {
      setLastProcessedTrigger(autoDeployTrigger);
      const room = (window as any).currentRoom;
      if (!room) return;
      
      // Get player's assigned zone
      const playerZone = room.state?.players?.get(room.sessionId)?.assignedZone;
      if (!playerZone) {
        logger.error('HEX_BOARD', 'No assigned zone for auto-deploy');
        return;
      }
      
      // Get the correct deployment zone hexes based on zone number
      // Server zones: 1=East(k cols), 2=West(a cols), 3=North, 4=South
      // HexGameBoard: topLeft=a cols, topRight=k cols, bottomLeft=zone3, bottomRight=zone4
      const zoneKey = playerZone === 1 ? 'topRight' :    // Zone 1 (East/k columns) = topRight
                     playerZone === 2 ? 'topLeft' :      // Zone 2 (West/a columns) = topLeft
                     playerZone === 3 ? 'bottomLeft' :   // Zone 3 (North)
                     'bottomRight';                      // Zone 4 (South)
      
      const zoneHexes = deploymentZones[zoneKey];
      if (!zoneHexes || zoneHexes.length === 0) {
        logger.error('HEX_BOARD', 'No hexes in deployment zone', { zone: playerZone, zoneKey });
        return;
      }
      
      // Ship types to deploy (10 total)
      const shipTypes = ['mothership', 'scout', 'scout', 'interceptor', 'interceptor', 'corvette', 'corvette', 
                        'frigate', 'frigate', 'destroyer', 'cruiser'];
      
      // Get player color
      const playerIds = Array.from(room.state.players.keys());
      const playerIndex = playerIds.indexOf(room.sessionId);
      const myColor = playerIndex === 0 ? 'blue' : playerIndex === 1 ? 'red' : 
                     playerIndex === 2 ? 'green' : 'yellow';
      
      // Get already deployed ships for this player using state callback
      setShips(currentShips => {
        const myShips = currentShips.filter(s => s.owner === room.sessionId);
        const shipsToPlace = shipTypes.slice(myShips.length);
        
        if (shipsToPlace.length === 0) {
          logger.info('HEX_BOARD', 'All ships already deployed');
          return currentShips; // No change
        }
        
        // Get available hexes (not occupied)
        const occupiedHexes = currentShips.map(s => `${s.position.col}${s.position.row}`);
        const availableHexes = zoneHexes.filter(h => !occupiedHexes.includes(`${h.col}${h.row}`));
        
        // Randomly place ships
        const shuffledHexes = [...availableHexes].sort(() => Math.random() - 0.5);
        const newShips: Ship[] = [];
        
        shipsToPlace.forEach((type, index) => {
          if (index < shuffledHexes.length) {
            const hex = shuffledHexes[index];
            const tempId = `temp_auto_${Date.now()}_${index}_${Math.random()}`;
            const newShip: Ship = {
              id: tempId,
              type,
              color: myColor,
              owner: room.sessionId,
              position: hex,
              rotation: getInitialRotationForZone(playerZone)
            };
            
            newShips.push(newShip);
            
            // Store mapping for later ID update
            if (!(window as any).tempShipMap) {
              (window as any).tempShipMap = new Map();
            }
            const posKey = `${hex.col}${hex.row}`;
            (window as any).tempShipMap.set(posKey, tempId);
            
            // Send to server with rotation
            room.send("deployShip", {
              type,
              col: hex.col,
              row: hex.row,
              rotation: newShip.rotation
            });
          }
        });
        
        // Add all new ships to state at once
        if (newShips.length > 0) {
          // Notify parent about all deployed ships
          // Use a special batch indicator to handle them all at once
          newShips.forEach((ship, index) => {
            // Add batch info to help parent handle properly
            const shipWithBatch = {
              ...ship,
              _batchIndex: index,
              _batchTotal: newShips.length
            };
            onShipDeployed?.(shipWithBatch);
          });
          
          logger.info('HEX_BOARD', 'Auto-deployed ships', {
            count: newShips.length,
            zone: playerZone,
            color: myColor
          });
          
          // Return the updated ships array
          return [...currentShips, ...newShips];
        }
        
        return currentShips; // No change if no new ships
      });
    }
  }, [autoDeployTrigger, gamePhase, deploymentZones, lastProcessedTrigger]);
  
  // Listen for multiplayer events from server
  useEffect(() => {
    const room = (window as any).currentRoom;
    // Check if we have a room (indicates multiplayer game)
    if (room) {
      // Setting up multiplayer listeners in HexGameBoard
      
      // Add connection close handler
      room.onLeave((code: number) => {
        logger.error('Room connection lost!', { code });
      });
      
      // Handle dice rolls from server
      const handleDiceRolls = (data: any) => {
        // Received dice rolls from server
        setDiceRolls(data.rolls);
        setShowDiceResults(true);
        setIsTieReroll(false);
        
        // Store selection order if provided (for 3+ players)
        if (data.selectionOrder) {
          setZoneSelectionOrder(data.selectionOrder);
        }
        
        // Hide dice results after 3 seconds
        setTimeout(() => {
          setShowDiceResults(false);
          // Set who is selecting first
          setCurrentPlayerSelectingZone(data.winner);
          setZoneSelectionPhase('selecting');
        }, 3000);
      };
      
      const handleZoneSelected = (data: any) => {
        // Zone selected
        // Update the zone for any player who selected
        onZoneSelected?.(data.playerId, data.zone);
        
        // Remove zone from available zones
        setAvailableZones(prev => prev.filter(z => z !== data.zone));
      };
      
      const handleZoneSelectionTurn = (data: any) => {
        // Zone selection turn
        // Update who is selecting next and available zones
        setCurrentPlayerSelectingZone(data.playerId);
        setAvailableZones(data.availableZones || []);
      };
      
      const handleZonesAssigned = () => {
        // All zones assigned
        // All zones assigned, move to deployment
        setZoneSelectionPhase('complete');
        setCurrentPlayerSelectingZone(null);
      };
      
      const handleDeploymentStarted = () => {
        // Deployment phase started
        // Move to deployment phase
        setZoneSelectionPhase('complete');
        setCurrentPlayerSelectingZone(null);
        // Use the global callback to update game phase in parent
        if ((window as any).setGamePhaseCallback) {
          (window as any).setGamePhaseCallback('deployment');
        }
      };
      
      const handleDiceTie = (data: any) => {
        // Dice tie detected
        setDiceRolls(data.rolls);
        setShowDiceResults(true);
        setIsTieReroll(true); // Mark this as a tie
        // Show tie message
        setTimeout(() => {
          setShowDiceResults(false);
        }, 2000);
      };
      
      // Remove individual ship deployment handler - we'll reveal all at once
      
      const handleDeploymentComplete = (data: any) => {
        // Deployment complete in HexGameBoard
        // Ship orientations received from server
        logger.info('MULTIPLAYER', 'Deployment complete - revealing all ships', data);
        
        if (data.ships && data.playerZones) {
          // Use zones from server message (simpler and more reliable)
          const playerZones = data.playerZones;
          // Player zones from server
          
          // Save initial ship state immediately after deployment completes
          // This is the true initial state before any moves
          const initialShipState = data.ships.map((ship: any) => ({
            id: ship.id,
            type: ship.type,
            color: ship.color,
            owner: ship.owner,
            position: { col: ship.col, row: ship.row },
            rotation: normalizeRotation(ship.rotation || 0)
          }));
          
          (window as any).gameInitialShipState = initialShipState;
          // Saved initial ship state after deployment complete
          
          // Add all ships with owner information and proper coordinates
          const allShips = data.ships.map((ship: any) => {
            // Processing ship from server
            // Find the hex at this position to get q,r coordinates
            const hex = boardHexesRef.current.find(h => h.col === ship.col && h.row === ship.row);
            if (!hex) {
              logger.error('Could not find hex for ship position:', ship.col, ship.row);
              // Fallback: calculate q,r from col,row
              const { q, r } = colRowToAxial(ship.col, ship.row);
              return {
                id: ship.id,
                type: ship.type,
                color: ship.color,
                owner: ship.owner,
                position: {
                  col: ship.col,
                  row: ship.row,
                  q,
                  r
                },
                rotation: ship.rotation !== undefined ? ship.rotation : normalizeRotation(ship.rotation ?? 0)
              };
            }
            return {
              id: ship.id,
              type: ship.type,
              color: ship.color,
              owner: ship.owner, // Include owner for multiplayer ownership checks
              position: hex, // Use the full hex object with q,r,col,row
              rotation: ship.rotation !== undefined ? ship.rotation : normalizeRotation(ship.rotation ?? 0)
            };
          });
          
          // Ships with owners and positions
          
          // When deploymentComplete is received, it means ALL players have finished deploying
          // and the server is sending the authoritative list of all ships with proper IDs
          // We MUST replace our local ships with server ships to ensure IDs match
          setShips(() => {
            // DeploymentComplete: Replacing all ships from server
            // Final ships being set with orientations
            return allShips;
          });
          
          // Additional backup: Save the initial state from allShips after they're set
          setTimeout(() => {
            if (!(window as any).gameInitialShipState || (window as any).gameInitialShipState.length === 0) {
              // Get current ships state
              const currentShipsState = ships.length > 0 ? ships : allShips;
              if (currentShipsState && currentShipsState.length > 0) {
                const backupInitialState = currentShipsState.map((ship: any) => ({
                  id: ship.id,
                  type: ship.type,
                  color: ship.color,
                  owner: ship.owner,
                  position: { col: ship.position.col, row: ship.position.row },
                  rotation: normalizeRotation(ship.rotation || 0)
                }));
                (window as any).gameInitialShipState = backupInitialState;
                // Backup: Saved initial state after setShips
              }
            }
          }, 100);
        }
        
        // IMPORTANT: Notify parent component about phase change
        // We need to trigger the phase change in App.tsx
        if ((window as any).setGamePhaseCallback) {
          // Calling setGamePhaseCallback to change to playing phase
          (window as any).setGamePhaseCallback('playing');
        }
        
        // Set the initial turn from the server data
        if (data.currentTurn) {
          (window as any).currentTurn = data.currentTurn;
          (window as any).turnNumber = data.turnNumber || 1;
          // Initial turn set
          
          // IMPORTANT: Also update the App.tsx state
          if ((window as any).handleTurnChangeCallback) {
            (window as any).handleTurnChangeCallback({
              currentTurn: data.currentTurn,
              turnNumber: data.turnNumber || 1
            });
          }
        }
      };
      
      room.onMessage("diceRolls", handleDiceRolls);
      room.onMessage("diceTie", handleDiceTie);
      room.onMessage("zoneSelected", handleZoneSelected);
      room.onMessage("zoneSelectionTurn", handleZoneSelectionTurn);
      room.onMessage("zonesAssigned", handleZonesAssigned);
      room.onMessage("deploymentStarted", handleDeploymentStarted);
      room.onMessage("deploymentComplete", handleDeploymentComplete);
      room.onMessage("shipDeploymentAck", (data: any) => {
        // Ship deployment acknowledged
        // Server has acknowledged the deployment with the real ship ID
        // Update the ship ID in our local state to match the server's ID
        if (data.shipId && data.position) {
          const posKey = `${data.position.col}${data.position.row}`;
          const tempId = (window as any).tempShipMap?.get(posKey);
          
          if (tempId) {
            // Update the ship ID in local state
            setShips(prevShips => prevShips.map(ship => {
              if (ship.id === tempId) {
                // Updating ship ID
                return { ...ship, id: data.shipId };
              }
              return ship;
            }));
            
            // Also update deploymentRotationShip if it's the same ship
            if (deploymentRotationShip?.id === tempId) {
              setDeploymentRotationShip(prev => prev ? { ...prev, id: data.shipId } : null);
            }
            
            // Clean up the temp map entry
            (window as any).tempShipMap?.delete(posKey);
          }
        }
      });
      room.onMessage("playerDeploymentReady", (data: any) => {
        // Player ready for deployment
        logger.info('MULTIPLAYER', 'Player deployment ready', data);
      });
      room.onMessage("gameStarted", (data: any) => {
        // Game started
        logger.log('gameStarted message received, will sync ships when board is ready');
        
        // Store the game start data globally to process when board is ready
        (window as any).pendingGameStartSync = {
          room: room,
          data: data
        };
        
        // The sync will be triggered by the useEffect that watches boardHexes
      });
      room.onMessage("canStartGame", (data: any) => {
        // Can start game
      });
      
      // Handle draw and resignation messages here too since App.tsx listeners aren't working
      room.onMessage("drawOffered", (data: any) => {
        // Draw offer received in HexGameBoard
        if ((window as any).handleDrawOfferCallback) {
          (window as any).handleDrawOfferCallback(data);
        }
      });
      
      room.onMessage("drawRefused", (data: any) => {
        // Draw refused in HexGameBoard
        if ((window as any).handleDrawRefusedCallback) {
          (window as any).handleDrawRefusedCallback();
        }
      });
      
      room.onMessage("gameEnded", (data: any) => {
        // Game ended in HexGameBoard
        if ((window as any).handleGameEndedCallback) {
          (window as any).handleGameEndedCallback(data);
        }
      });
      
      room.onMessage("playerResigned", (data: any) => {
        // Player resigned in HexGameBoard
        if ((window as any).handlePlayerResignedCallback) {
          (window as any).handlePlayerResignedCallback(data);
        }
      });
      
      room.onMessage("playerEliminated", (data: any) => {
        // Player eliminated in HexGameBoard
        if ((window as any).handlePlayerEliminatedCallback) {
          (window as any).handlePlayerEliminatedCallback(data);
        }
      });
      
      // Handle ship movements from other players
      room.onMessage("shipMoved", (data: any) => {
        logger.log('=== ShipMoved message received ===');
        logger.log('Data:', JSON.stringify(data));
        logger.log('Current player sessionId:', room.sessionId);
        logger.log('Message from player:', data.playerId);
        logger.log('Is combat?', data.combat);
        logger.log('Moving ship:', data.shipId, 'from', data.from, 'to', data.to);
        
        // Save initial state on first move if not already saved
        if (!(window as any).gameInitialShipState && room.state && room.state.ships) {
          const initialShipState = [];
          room.state.ships.forEach((ship: any) => {
            if (ship && ship.col && ship.row !== undefined) {
              // This captures state BEFORE this move
              initialShipState.push({
                id: ship.id,
                type: ship.type,
                color: ship.color,
                owner: ship.owner,
                position: { col: ship.col, row: ship.row },
                rotation: normalizeRotation(ship.rotation || 0),
                rotation: ship.rotation || 0
              });
            }
          });
          
          if (initialShipState.length > 0) {
            (window as any).gameInitialShipState = initialShipState;
            // Saved initial ship state on first move
          }
        }
        
        // Find the hex at the new position
        const targetHex = boardHexesRef.current.find(h => 
          h.col === data.to.col && h.row === data.to.row
        );
        
        if (!targetHex) {
          logger.error('Target hex not found:', data.to);
          return;
        }
        
        // Handle combat if a ship was destroyed
        if (data.combat && data.destroyedShipId) {
          // Combat occurred, destroying ship
          
          // Trigger combat animations and update ships
          setShips(prevShips => {
            // Current ships before combat
            
            const movingShip = prevShips.find(s => s.id === data.shipId);
            if (movingShip) {
              // Start movement animation
              const fromLayout = hexToScreenPosition(movingShip.position.col, movingShip.position.row);
              const toLayout = hexToScreenPosition(targetHex.col, targetHex.row);
              const targetRotation = calculateRotationForMovement(movingShip.position, targetHex);
              
              // Use the ship's stored rotation if available
              const currentRotation = movingShip.rotation !== undefined 
                ? movingShip.rotation 
                : normalizeRotation(movingShip.rotation || 0);
              
              const animationData = {
                fromPos: { x: fromLayout.x, y: fromLayout.y },
                toPos: { x: toLayout.x, y: toLayout.y },
                targetHex: targetHex, // Use full targetHex with all coordinates
                fromRotation: currentRotation,
                toRotation: targetRotation,
                duration: 1500,
                startTime: Date.now(),
                progress: 0
              };
              
              setAnimatingShips(prev => {
                const newMap = new Map(prev);
                newMap.set(data.shipId, animationData);
                return newMap;
              });
              
              // Trigger weapon animation (laser or rocket based on ship type)
              if (movingShip.type === 'corvette' || movingShip.type === 'frigate') {
                triggerRocketAnimation(movingShip.position, targetHex, data.shipId);
              } else {
                triggerLaserAnimation(movingShip.position, targetHex, data.shipId);
              }
              
              // Trigger thruster animation
              triggerThrusterAnimation(data.shipId);
              
              // Trigger explosion at enemy position
              setTimeout(() => {
                triggerExplosionAnimation(targetHex);
              }, 300); // Delay explosion slightly
            } else {
              logger.error('Moving ship not found:', data.shipId);
            }
            
            // Don't update position immediately - wait for animation to complete
            // Animation completion will handle the actual position update
            return prevShips;
          });
          
          // Ship position will be updated when animation completes
          // Just remove the destroyed ship immediately
          if (data.destroyedShipId) {
            setShips(prevShips => 
              prevShips.filter(ship => ship.id !== data.destroyedShipId)
            );
          }
          
          // Create debris field at combat location
          setCombatDebrisFields(prev => {
            const debrisExists = prev.some(debris => 
              debris.col === targetHex.col && debris.row === targetHex.row
            );
            
            if (!debrisExists) {
              const newDebris = [...prev, targetHex];
              // Creating debris field from combat
              return newDebris;
            }
            return prev;
          });
        } else {
          // Normal movement (no combat)
          // logger.log('Normal movement for ship:', data.shipId);
          
          // Check if this is the current player's ship or an opponent's ship
          const room = (window as any).currentRoom;
          const isOwnShip = data.playerId === room?.sessionId;
          logger.log('Is own ship?', isOwnShip, 'data.playerId:', data.playerId, 'sessionId:', room?.sessionId);
          
          if (!isOwnShip) {
            // For opponent ships, we need to handle animation differently
            // The server has already updated the position, so we'll animate from old to new
            logger.log('Processing opponent ship movement!');
            logger.log('ShipId:', data.shipId, 'From:', data.from, 'To:', data.to);
            
            // Find hexes for animation
            const fromHex = boardHexesRef.current.find(h => h.col === data.from.col && h.row === data.from.row);
            const targetHex = boardHexesRef.current.find(h => h.col === data.to.col && h.row === data.to.row);
            
            if (!fromHex || !targetHex) {
              logger.error('Cannot find hex positions for animation');
              logger.error('From hex:', data.from, 'found:', fromHex);
              logger.error('To hex:', data.to, 'found:', targetHex);
              logger.error('Available hexes:', boardHexesRef.current.length);
              return;
            }
            
            // Verify hexes have coordinates
            if (fromHex.x === undefined || fromHex.y === undefined) {
              logger.error('From hex missing coordinates:', fromHex);
              return;
            }
            if (targetHex.x === undefined || targetHex.y === undefined) {
              logger.error('Target hex missing coordinates:', targetHex);
              return;
            }
            
            const fromLayout = { x: fromHex.x, y: fromHex.y };
            const toLayout = { x: targetHex.x, y: targetHex.y };
            
            logger.log('Animation positions:');
            logger.log('From:', `${data.from.col}${data.from.row}`, 'at', fromLayout);
            logger.log('To:', `${data.to.col}${data.to.row}`, 'at', toLayout);
            
            // Calculate exact rotation angle to face target
            const targetRotation = calculateRotationForMovement(
              { col: data.from.col, row: data.from.row },
              { col: data.to.col, row: data.to.row }
            );
            logger.log(`[shipMoved] Movement from ${data.from.col}${data.from.row} to ${data.to.col}${data.to.row}`);
            logger.log(`[shipMoved] Target rotation: ${targetRotation}°`);
            
            // Get current rotation from existing ship or server state
            let currentRotation = normalizeRotation(0); // Default fallback
            
            // Check if ship exists in our local state
            const existingShip = ships.find(s => s.id === data.shipId);
            
            if (existingShip) {
              // Ship exists, get its current rotation (should always be defined)
              currentRotation = normalizeRotation(existingShip.rotation || 0);
              logger.log('Existing ship found at:', `${existingShip.position.col}${existingShip.position.row}`, 'rotation:', currentRotation);
            } else {
              // Ship doesn't exist locally, need to sync from server
              logger.log('Ship not in local state, syncing from server');
              
              if (room && room.state && room.state.ships) {
                const serverShip = Array.from(room.state.ships).find((s: any) => s.id === data.shipId);
                if (serverShip) {
                  logger.log('Found ship in server state at:', `${serverShip.col}${serverShip.row}`);
                  
                  // Get the rotation from the original position (before move)
                  // The server ship is already at the new position, but we need its rotation from before
                  currentRotation = normalizeRotation(serverShip.rotation || 0);
                  
                  // Add ship at destination (it's already moved on server)
                  const newShip: Ship = {
                    id: serverShip.id,
                    type: serverShip.type,
                    color: serverShip.color,
                    position: {
                      col: data.to.col,  // Use destination position
                      row: data.to.row,
                      q: targetHex.q,
                      r: targetHex.r,
                      x: targetHex.x,
                      y: targetHex.y
                    },
                    owner: serverShip.owner,
                    rotation: normalizeRotation(data.rotation || serverShip.rotation || 0)
                  };
                  
                  // Add the ship at destination
                  setShips(prev => [...prev, newShip]);
                  logger.log('Added ship to local state at destination with rotation:', newShip.rotation);
                }
              }
            }
            
            // Create animation data
            const animationData = {
              fromPos: { 
                x: fromLayout.x, 
                y: fromLayout.y 
              },
              toPos: { 
                x: toLayout.x, 
                y: toLayout.y 
              },
              targetHex: targetHex, // Use full targetHex with all coordinates
              fromRotation: currentRotation,
              toRotation: targetRotation,
              duration: 1500,
              startTime: Date.now(),
              progress: 0
            };
            
            logger.log('Starting animation');
            logger.log('Animation from:', `${data.from.col}${data.from.row}`, 'to:', `${data.to.col}${data.to.row}`);
            
            // Start the animation
            setAnimatingShips(prev => {
              const newMap = new Map(prev);
              newMap.set(data.shipId, animationData);
              logger.log('Animation started, total animating:', newMap.size);
              return newMap;
            });
            
            // Store the final rotation for when animation completes
            if (data.rotation !== undefined) {
              setPendingRotations(prev => {
                const newMap = new Map(prev);
                newMap.set(data.shipId, normalizeRotation(data.rotation));
                return newMap;
              });
            }
          } else {
            // For own ship during action phase, we don't need to store in pendingRotations
            // The animation completion will use the current ship state directly
            // This prevents stale rotation values when ship is rotated after movement starts
            
            const localShip = ships.find(s => s.id === data.shipId);
            
            const isActivePhase = gamePhase === 'action' || gamePhase === 'playing';
            if (!isActivePhase) {
              // During deployment or other phases, still use pendingRotations
              let newRotation = normalizeRotation(data.rotation || 0);
              
              if (localShip && localShip.rotation !== undefined) {
                newRotation = normalizeRotation(localShip.rotation);
              }
              
              setPendingRotations(prev => {
                const newMap = new Map(prev);
                newMap.set(data.shipId, newRotation);
                return newMap;
              });
            }
            // During active phase, we'll use the current state when animation completes
          }
        }
      });
      
      // Handle turn changes
      room.onMessage("turnChanged", (data: any) => {
        // Turn changed
        // Store current turn for UI display
        (window as any).currentTurn = data.currentTurn;
        (window as any).turnNumber = data.turnNumber;
        
        // Reset all action point state for the new turn
        setHasUsedAP(false);
        window.shipThatUsedAP = null; // Clear the ship that used AP
        setViewingEnemyShip(null);
        setSelectedShipForMovement(null);
        setShowActionPointUI(false);
        setValidMoveTargets([]);
        setCurrentAP(0);
        setMaxAP(0);
        setIsProcessingClick(false);
        
        // Notify UI to update turn display
        if ((window as any).handleTurnChangeCallback) {
          (window as any).handleTurnChangeCallback(data);
        }
      });
      
      // Handle error messages (like "not your turn")
      room.onMessage("error", (data: any) => {
        logger.error('Game error:', data.message);
        logger.warn('MULTIPLAYER', data.message);
      });
      
      // Handle timer updates
      room.onMessage("timerUpdate", (data: any) => {
        // Timer update received
        if ((window as any).handleTimerUpdateCallback) {
          (window as any).handleTimerUpdateCallback(data);
        }
      });
      
      // Handle ship rotation from other players
      room.onMessage("shipRotated", (data: any) => {
        // Update ship rotation for other players' ships
        // Server already filters with { except: client } so we receive only other players' rotations
        if (data.shipId && data.rotation !== undefined) {
          setShips(prevShips => {
            return prevShips.map(ship => {
              if (ship.id === data.shipId) {
                return { ...ship, rotation: normalizeRotation(data.rotation) };
              }
              return ship;
            });
          });
        }
      });
      
      // Handle auto-deploy completion
      room.onMessage("autoDeployComplete", (data: any) => {
        // Auto-deploy complete
        logger.info('MULTIPLAYER', 'Auto-deploy complete for player', data);
        // Ships will be synced through state change
      });
      
      return () => {
        room.removeAllListeners("diceRolls");
        room.removeAllListeners("diceTie");
        room.removeAllListeners("zoneSelected");
        room.removeAllListeners("zonesAssigned");
        room.removeAllListeners("deploymentStarted");
        room.removeAllListeners("deploymentComplete");
        room.removeAllListeners("shipDeploymentAck");
        room.removeAllListeners("playerDeploymentReady");
        room.removeAllListeners("gameStarted");
        room.removeAllListeners("canStartGame");
        room.removeAllListeners("drawOffered");
        room.removeAllListeners("drawRefused");
        room.removeAllListeners("gameEnded");
        room.removeAllListeners("playerResigned");
        room.removeAllListeners("shipMoved");
        room.removeAllListeners("turnChanged");
        room.removeAllListeners("error");
      };
    }
  }, []);

  // Dice rolling system
  const rollDice = (): number => {
    return Math.floor(Math.random() * 6) + 1;
  };

  const rollDiceForAllPlayers = () => {
    const rolls: DiceRoll[] = players.map(player => ({
      playerId: player.id,
      playerName: player.name,
      roll: rollDice()
    }));

    setDiceRolls(rolls);
    setShowDiceResults(true);
    
    // Hide dice results after 3 seconds and process results
    setTimeout(() => {
      setShowDiceResults(false);
      processRollResults(rolls);
    }, 3000);
  };

  const processRollResults = (rolls: DiceRoll[]) => {
    // Sort by highest roll, handle ties
    const sortedRolls = [...rolls].sort((a, b) => b.roll - a.roll);
    
    // Check for ties and handle re-rolls
    const tieGroups: DiceRoll[][] = [];
    let currentGroup: DiceRoll[] = [sortedRolls[0]];
    
    for (let i = 1; i < sortedRolls.length; i++) {
      if (sortedRolls[i].roll === currentGroup[0].roll) {
        currentGroup.push(sortedRolls[i]);
      } else {
        if (currentGroup.length > 1) {
          tieGroups.push([...currentGroup]);
        }
        currentGroup = [sortedRolls[i]];
      }
    }
    if (currentGroup.length > 1) {
      tieGroups.push(currentGroup);
    }

    if (tieGroups.length > 0) {
      // Handle re-rolls for ties
      logger.info('ZONE_SELECTION', 'Ties detected, re-rolling', { tieGroups });
      handleTieRerolls(sortedRolls, tieGroups);
    } else {
      // No ties, proceed with zone selection
      const selectionOrder = sortedRolls.map(roll => roll.playerId);
      setZoneSelectionOrder(selectionOrder);
      
      // Check if winner is human or AI
      const winner = players.find(p => p.id === selectionOrder[0]);
      const loser = players.find(p => p.id === selectionOrder[1]);
      
      if (winner?.isAI) {
        // AI won - AI randomly picks a zone, human gets the opposite
        const aiZones = [1, 2, 3, 4];
        const randomAIZone = aiZones[Math.floor(Math.random() * aiZones.length)];
        const humanZone = getOppositeZone(randomAIZone);
        
        onZoneSelected?.(winner.id, randomAIZone);
        onZoneSelected?.(loser.id, humanZone);
        setZoneSelectionPhase('complete');
        setCurrentPlayerSelectingZone(null);
        logger.info('ZONE_SELECTION', 'AI won dice roll', { 
          aiZone: randomAIZone, 
          humanZone: humanZone,
          aiRoll: sortedRolls[0].roll,
          humanRoll: sortedRolls[1].roll
        });
      } else {
        // Human won - human can pick any zone
        setCurrentPlayerSelectingZone(selectionOrder[0]);
        setZoneSelectionPhase('selecting');
        logger.info('ZONE_SELECTION', 'Human won dice roll - can select zone', {
          humanRoll: sortedRolls[0].roll,
          aiRoll: sortedRolls[1].roll
        });
      }
    }
  };

  const handleTieRerolls = (originalRolls: DiceRoll[], tieGroups: DiceRoll[][]) => {
    // For now, just randomly resolve ties
    // In a real implementation, you'd re-roll just the tied players
    const resolvedRolls = originalRolls.map(roll => {
      const isInTie = tieGroups.some(group => group.some(r => r.playerId === roll.playerId));
      if (isInTie) {
        return { ...roll, roll: rollDice() };
      }
      return roll;
    });
    
    setDiceRolls(resolvedRolls);
    processRollResults(resolvedRolls);
  };

  const selectZone = (zoneNumber: number) => {
    if (!currentPlayerSelectingZone) return;
    
    // Check if this is a multiplayer game
    const room = (window as any).currentRoom;
    const isMultiplayer = !!room;
    
    if (isMultiplayer) {
      // In multiplayer, only the winner (whose ID matches currentPlayerSelectingZone) can select
      // and only if they are the current player viewing this screen
      const currentPlayerId = room.sessionId;
      if (currentPlayerId !== currentPlayerSelectingZone) {
        logger.info('ZONE_SELECTION', 'Not your turn to select zones', {
          currentPlayerSelectingZone,
          yourId: currentPlayerId
        });
        return;
      }
    }
    
    const updatedPlayers = players.map(p => 
      p.id === currentPlayerSelectingZone 
        ? { ...p, assignedZone: zoneNumber }
        : p
    );

    // Remove selected zone from available zones
    const newAvailableZones = availableZones.filter(z => z !== zoneNumber);
    setAvailableZones(newAvailableZones);

    // Notify parent component
    onZoneSelected?.(currentPlayerSelectingZone, zoneNumber);
    
    // In multiplayer, send zone selection to server
    if (room && isMultiplayer) {
      try {
        if (room.connection?.isOpen) {
          room.send("selectZone", { zone: zoneNumber });
          // Sent zone selection to server
        } else {
          logger.error('Cannot send zone selection - WebSocket is not open', {
            state: room.connection?.readyState,
            isOpen: room.connection?.isOpen
          });
        }
      } catch (error) {
        logger.error('Error sending zone selection:', error);
      }
      // Server will handle zone assignment and broadcast results
      return; // Don't do any local zone assignment
    }

    // Only handle local zone assignment for AI games
    if (players.length === 2 && !isMultiplayer) {
      // AI game - assign opposite zone to second player
      const oppositeZone = getOppositeZone(zoneNumber);
      const secondPlayerId = zoneSelectionOrder[1];
      
      onZoneSelected?.(secondPlayerId, oppositeZone);
      setZoneSelectionPhase('complete');
      setCurrentPlayerSelectingZone(null);
    } else if (!isMultiplayer) {
      // Multi-player: Move to next player
      const currentIndex = zoneSelectionOrder.indexOf(currentPlayerSelectingZone);
      if (currentIndex < zoneSelectionOrder.length - 1) {
        setCurrentPlayerSelectingZone(zoneSelectionOrder[currentIndex + 1]);
      } else {
        setZoneSelectionPhase('complete');
        setCurrentPlayerSelectingZone(null);
      }
    }
  };

  const getOppositeZone = (zone: number): number => {
    // Zone opposites: 1↔2, 3↔4 (1 and 2 are opposite sides, 3 and 4 are opposite sides)
    switch (zone) {
      case 1: return 2;
      case 2: return 1;
      case 3: return 4;
      case 4: return 3;
      default: return 2;
    }
  };

  const autoAssignZonesForAI = () => {
    // Assign player to zone 1, AI to zone 3 (opposites)
    // In multiplayer, use isCurrentPlayer flag; in AI games, find non-AI player
    const humanPlayer = players.find(p => p.isCurrentPlayer) || players.find(p => !p.isAI);
    const aiPlayer = players.find(p => p.isAI);
    
    if (humanPlayer && aiPlayer) {
      // Assign zones
      onZoneSelected?.(humanPlayer.id, 1);
      onZoneSelected?.(aiPlayer.id, 3);
      
      // Mark zone selection as complete
      setZoneSelectionPhase('complete');
      setCurrentPlayerSelectingZone(null);
      
      // Update available zones
      setAvailableZones([2, 4]); // Only zones 2 and 4 remain
      
      logger.info('ZONE_SELECTION', 'Auto-assigned zones for AI game', {
        humanPlayer: humanPlayer.id,
        humanZone: 1,
        aiPlayer: aiPlayer.id,
        aiZone: 3
      });
    }
  };

  const deployAIShips = () => {
    const aiPlayer = players.find(p => p.isAI);
    if (!aiPlayer || !aiPlayer.assignedZone) return;

    // Get AI deployment zone hexes
    const aiZoneKey = aiPlayer.assignedZone === 1 ? 'topLeft' :
                      aiPlayer.assignedZone === 2 ? 'topRight' :
                      aiPlayer.assignedZone === 3 ? 'bottomLeft' : 'bottomRight';
    
    const aiZoneHexes = deploymentZones[aiZoneKey];
    if (!aiZoneHexes.length) return;

    const newAIShips: Ship[] = [];
    let hexIndex = 0;

    // Deploy each ship type
    aiShipsToDeploy.forEach((shipGroup: any) => {
      for (let i = 0; i < shipGroup.count; i++) {
        if (hexIndex < aiZoneHexes.length) {
          const hex = aiZoneHexes[hexIndex];
          const aiShip: Ship = {
            id: `ai_ship_${Date.now()}_${hexIndex}`,
            type: shipGroup.type,
            color: 'red', // AI ships are red
            position: hex,
            rotation: getInitialRotationForZone(aiPlayer.assignedZone || 2) // AI faces based on their zone
          };
          newAIShips.push(aiShip);
          hexIndex++;
        }
      }
    });

    // Add AI ships to the board
    setShips(prevShips => [...prevShips, ...newAIShips]);
    
    logger.info('HEX_BOARD', 'AI ships deployed', {
      count: newAIShips.length,
      zone: aiPlayer.assignedZone,
      totalShips: ships.length + newAIShips.length,
      aiShips: newAIShips.map(s => ({ id: s.id, type: s.type, position: `${s.position.col}${s.position.row}` }))
    });
  };

  const generateHexagonalBoard = () => {
    const hexes: HexCoordinate[] = [];
    
    // Ensure we have a valid hexRadius
    const currentHexRadius = hexRadius || 30; // Use default if not calculated yet
    
    // Create proper hexagonal board layout - 91 hexes in hexagon shape
    // Using axial coordinates (q, r) then converting to screen coordinates
    const BOARD_RADIUS = 5; // Creates a hexagon with 91 hexes
    let hexCount = 0;
    
    for (let q = -BOARD_RADIUS; q <= BOARD_RADIUS; q++) {
      const r1 = Math.max(-BOARD_RADIUS, -q - BOARD_RADIUS);
      const r2 = Math.min(BOARD_RADIUS, -q + BOARD_RADIUS);
      
      for (let r = r1; r <= r2; r++) {
        // Convert axial to cube coordinates for easier calculation
        const s = -q - r;
        
        // Convert to screen coordinates (proper hexagon layout)
        const x = currentHexRadius * (3/2 * q);
        const y = currentHexRadius * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
        
        // Generate row/column labels based on position
        const colIndex = q + BOARD_RADIUS;
        const rowIndex = r + BOARD_RADIUS;
        const columns = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];
        
        hexes.push({
          col: columns[Math.min(colIndex, 10)] || 'z',
          row: Math.min(rowIndex + 1, 11),
          q,
          r,
          x,
          y
        });
        
        hexCount++;
      }
    }

    // Calculate board bounds for centering
    if (hexes.length === 0) {
      logger.warn('No hexes generated for board');
      return;
    }
    
    // Filter out any hexes without x/y coordinates
    const validHexes = hexes.filter(h => h.x !== undefined && h.y !== undefined);
    if (validHexes.length === 0) {
      logger.error('No valid hexes with x/y coordinates');
      return;
    }
    
    const minX = Math.min(...validHexes.map(h => h.x));
    const maxX = Math.max(...validHexes.map(h => h.x));
    const minY = Math.min(...validHexes.map(h => h.y));
    const maxY = Math.max(...validHexes.map(h => h.y));
    
    const boardWidth = maxX - minX + (currentHexRadius * 2);
    const boardHeight = maxY - minY + (currentHexRadius * Math.sqrt(3));
    
    // Center the board properly
    const currentAvailableWidth = availableWidth || screenDimensions.width || 800;
    const currentAvailableHeight = availableHeight || screenDimensions.height || 600;
    const currentHexHeight = currentHexRadius * Math.sqrt(3);
    
    const boardCenterX = currentAvailableWidth / 2;
    const centerOffsetX = boardCenterX - (minX + maxX) / 2;
    
    // Ensure board stays within bounds - responsive to available height
    const boardActualHeight = maxY - minY + currentHexHeight;
    
    // Calculate responsive top margin based on available space
    const remainingSpace = currentAvailableHeight - boardActualHeight;
    let topMargin;
    
    if (remainingSpace > 100) {
      // Lots of space - center vertically with small offset
      topMargin = Math.max(30, remainingSpace * 0.2);
    } else if (remainingSpace > 20) {
      // Limited space - small margin
      topMargin = Math.max(15, remainingSpace * 0.3);
    } else {
      // Very tight - minimal margin
      topMargin = Math.max(5, remainingSpace * 0.5);
    }
    
    // Add extra margin to ensure top hex is fully visible (half hex radius for safety)
    topMargin += currentHexRadius * 0.5;
    
    const centerOffsetY = topMargin - minY;
    
    // Apply centering offset to all hexes
    hexes.forEach(hex => {
      hex.x += centerOffsetX;
      hex.y += centerOffsetY;
    });

    // Check if board fits within available space (with minimal margin for tolerance)
    const boardFitsVertically = boardHeight <= (currentAvailableHeight - 10);
    const boardFitsHorizontally = boardWidth <= (currentAvailableWidth - 10);
    
    setBoardDimensions({ 
      width: boardWidth, 
      height: boardHeight,
      fitsVertically: boardFitsVertically,
      fitsHorizontally: boardFitsHorizontally
    });
    setBoardHexes(hexes);
    defineDeploymentZones(hexes);
    
    logger.info('HEX_BOARD', 'Generated hexagonal board', { 
      totalHexes: hexes.length,
      expectedHexes: 91,
      boardWidth,
      boardHeight,
      availableWidth,
      availableHeight,
      hexRadius,
      fitsVertically: boardFitsVertically,
      fitsHorizontally: boardFitsHorizontally,
      mapType
    });
  };

  const defineDeploymentZones = (hexes: HexCoordinate[]) => {
    // Define 4 deployment zones with exact coordinates provided
    const zone1Coords = ['a6', 'a7', 'a8', 'a9', 'a10', 'a11', 'b6', 'b7', 'b8', 'b9', 'b10', 'c6', 'c7', 'c8', 'c9'];
    const zone2Coords = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'j2', 'j3', 'j4', 'j5', 'j6', 'i3', 'i4', 'i5', 'i6'];
    // FIX: Zone 3 is NORTH (top of board, low row numbers), Zone 4 is SOUTH (bottom of board, high row numbers)
    const zone3Coords = ['f1', 'f2', 'f3', 'e2', 'e3', 'e4', 'g1', 'g2', 'g3', 'h1', 'h2', 'i1', 'd3', 'd4', 'c4'];  // North zone (rows 1-4)
    const zone4Coords = ['f11', 'f10', 'f9', 'e11', 'e10', 'e9', 'g10', 'g9', 'g8', 'h9', 'h8', 'i8', 'd11', 'd10', 'c11']; // South zone (rows 8-11)
    
    const zone1: HexCoordinate[] = [];
    const zone2: HexCoordinate[] = [];
    const zone3: HexCoordinate[] = [];
    const zone4: HexCoordinate[] = [];

    hexes.forEach(hex => {
      const coord = `${hex.col}${hex.row}`;
      
      if (zone1Coords.includes(coord)) {
        zone1.push(hex);
      } else if (zone2Coords.includes(coord)) {
        zone2.push(hex);
      } else if (zone3Coords.includes(coord)) {
        zone3.push(hex);
      } else if (zone4Coords.includes(coord)) {
        zone4.push(hex);
      }
    });

    setDeploymentZones({ 
      topLeft: zone1,    // This has 'a' columns (west) - server zone 2
      topRight: zone2,   // This has 'k' columns (east) - server zone 1  
      bottomLeft: zone3, // Zone 3  
      bottomRight: zone4 // Zone 4
    });
    
    logger.info('HEX_BOARD', 'Deployment zones defined', {
      zone1: zone1.length,
      zone2: zone2.length,
      zone3: zone3.length,
      zone4: zone4.length,
      total: zone1.length + zone2.length + zone3.length + zone4.length
    });
  };

  const generateMapFeatures = (hexes: HexCoordinate[]) => {
    // Get neutral hexes (not in deployment zones)
    const allZoneCoords = [
      ...['a6', 'a7', 'a8', 'a9', 'a10', 'a11', 'b6', 'b7', 'b8', 'b9', 'b10', 'c6', 'c7', 'c8', 'c9'],
      ...['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'j2', 'j3', 'j4', 'j5', 'j6', 'i3', 'i4', 'i5', 'i6'],
      ...['f1', 'f2', 'f3', 'e2', 'e3', 'e4', 'g1', 'g2', 'g3', 'h1', 'h2', 'i1', 'd3', 'd4', 'c4'],  // Zone 3 North
      ...['f11', 'f10', 'f9', 'e11', 'e10', 'e9', 'g10', 'g9', 'g8', 'h9', 'h8', 'i8', 'd11', 'd10', 'c11'] // Zone 4 South
    ];
    
    const neutralHexes = hexes.filter(hex => {
      const coord = `${hex.col}${hex.row}`;
      return !allZoneCoords.includes(coord);
    });

    let newMeteors: HexCoordinate[] = [];
    let newDebrisFields: HexCoordinate[] = [];
    let newMeteorImages: {[key: string]: any} = {};

    switch (mapType) {
      case 'Classic':
        // Classic: Meteors at c5, c10, i7, i2, e6, e7, g6, g5 and debris at f4, f8, d7, h5
        const classicMeteorCoords = ['c5', 'c10', 'i7', 'i2', 'e6', 'e7', 'g6', 'g5'];
        const classicDebrisCoords = ['f4', 'f8', 'd7', 'h5'];
        
        newMeteors = hexes.filter(hex => {
          const coord = `${hex.col}${hex.row}`;
          return classicMeteorCoords.includes(coord);
        });
        
        newDebrisFields = hexes.filter(hex => {
          const coord = `${hex.col}${hex.row}`;
          return classicDebrisCoords.includes(coord);
        });
        
        // Assign random meteor images
        newMeteors.forEach(meteor => {
          const coord = `${meteor.col}${meteor.row}`;
          const randomIndex = Math.floor(Math.random() * METEOR_IMAGES.length);
          newMeteorImages[coord] = METEOR_IMAGES[randomIndex];
        });
        break;
        
      case 'Graveyard':
        // Graveyard: No meteors, debris at f6, b5, d5, b11, d9, j7, h7, h3, j1, d7, h5, f4, f8
        const graveyardDebrisCoords = ['f6', 'b5', 'd5', 'b11', 'd9', 'j7', 'h7', 'h3', 'j1', 'd7', 'h5', 'f4', 'f8'];
        
        newDebrisFields = hexes.filter(hex => {
          const coord = `${hex.col}${hex.row}`;
          return graveyardDebrisCoords.includes(coord);
        });
        break;
        
      case 'Meteor Shower':
        // Meteor Shower: Meteors at f6, e7, f7, g6, g5, f5, e6, b5, d5, h3, j1, j7, h7, b11, d9
        const meteorShowerCoords = ['f6', 'e7', 'f7', 'g6', 'g5', 'f5', 'e6', 'b5', 'd5', 'h3', 'j1', 'j7', 'h7', 'b11', 'd9'];
        
        newMeteors = hexes.filter(hex => {
          const coord = `${hex.col}${hex.row}`;
          return meteorShowerCoords.includes(coord);
        });
        
        // Assign random meteor images
        newMeteors.forEach(meteor => {
          const coord = `${meteor.col}${meteor.row}`;
          const randomIndex = Math.floor(Math.random() * METEOR_IMAGES.length);
          newMeteorImages[coord] = METEOR_IMAGES[randomIndex];
        });
        break;
        
      case 'Random':
        // Random: Mix classic meteors and graveyard debris randomly
        const randomMeteorCoords = ['c5', 'c10', 'i7', 'i2', 'e6', 'e7', 'g6', 'g5'];
        const randomDebrisCoords = ['f6', 'b5', 'd5', 'b11', 'd9', 'j7', 'h7', 'h3', 'j1', 'd7', 'h5', 'f4', 'f8'];
        
        // Randomly select some meteors and debris
        const selectedMeteorCoords = randomMeteorCoords.filter(() => Math.random() > 0.5);
        const selectedDebrisCoords = randomDebrisCoords.filter(() => Math.random() > 0.4);
        
        newMeteors = hexes.filter(hex => {
          const coord = `${hex.col}${hex.row}`;
          return selectedMeteorCoords.includes(coord);
        });
        
        newDebrisFields = hexes.filter(hex => {
          const coord = `${hex.col}${hex.row}`;
          return selectedDebrisCoords.includes(coord);
        });
        
        // Assign random meteor images
        newMeteors.forEach(meteor => {
          const coord = `${meteor.col}${meteor.row}`;
          const randomIndex = Math.floor(Math.random() * METEOR_IMAGES.length);
          newMeteorImages[coord] = METEOR_IMAGES[randomIndex];
        });
        break;
    }

    setMeteors(newMeteors);
    setMapDebrisFields(newDebrisFields);
    setMeteorImages(newMeteorImages);
    
    logger.info('HEX_BOARD', 'Map features generated', {
      mapType,
      meteors: newMeteors.length,
      debrisFields: newDebrisFields.length,
      neutralHexes: neutralHexes.length,
      totalHexes: hexes.length,
      meteorCoords: newMeteors.map(m => `${m.col}${m.row}`),
      debrisCoords: newDebrisFields.map(d => `${d.col}${d.row}`)
    });
  };

  const calculateValidMoves = (ship: Ship): HexCoordinate[] => {
    const validMoves: HexCoordinate[] = [];
    const startHex = ship.position;
    
    // Find the hex data with q/r coordinates
    const startHexData = boardHexes.find(h => h.col === startHex.col && h.row === startHex.row);
    if (!startHexData) {
      logger.error('Could not find hex data for ship position:', startHex);
      return [];
    }
    
    // Calculating valid moves for ship
    
    // Get movement pattern for this ship type
    const pattern = SHIP_MOVEMENT_PATTERNS[ship.type] || SHIP_MOVEMENT_PATTERNS['corvette'];
    
    // Use the ship's rotation (in degrees)
    const shipRotation = normalizeRotation(ship.rotation || 0);
    
    // Get all six hex directions with their angles
    const directions = [
      { q: 0, r: -1, angle: 0 },    // North
      { q: 1, r: -1, angle: 60 },   // Northeast
      { q: 1, r: 0, angle: 120 },   // Southeast
      { q: 0, r: 1, angle: 180 },   // South
      { q: -1, r: 1, angle: 240 },  // Southwest
      { q: -1, r: 0, angle: 300 }    // Northwest
    ];

    directions.forEach(direction => {
      // Calculate relative angle from ship's rotation
      let relativeAngle = direction.angle - shipRotation;
      // Normalize to -180 to 180
      if (relativeAngle < -180) relativeAngle += 360;
      if (relativeAngle > 180) relativeAngle -= 360;
      const absAngle = Math.abs(relativeAngle);
      
      // Determine max distance based on relative angle
      let maxDistance = 0;
      if (absAngle <= 30) {
        maxDistance = pattern.forward; // Straight ahead (within 30°)
      } else if (absAngle <= 90) {
        maxDistance = pattern.forwardSide; // Diagonal forward (30-90°)
      } else if (absAngle <= 150) {
        maxDistance = pattern.side; // Direct sides (90-150°)
      } else {
        maxDistance = pattern.backward; // Straight back (150-180°)
      }
      
      // Check each hex in this direction up to max distance
      for (let distance = 1; distance <= maxDistance; distance++) {
        const targetQ = startHexData.q + (direction.q * distance);
        const targetR = startHexData.r + (direction.r * distance);
        
        // Find the hex at this position
        const targetHex = boardHexes.find(hex => hex.q === targetQ && hex.r === targetR);
        
        if (!targetHex) {
          // Hex doesn't exist, stop movement in this direction
          break;
        }
        
        // Check if hex is blocked by another ship
        const shipAtHex = ships.find(s => 
          s.position.col === targetHex.col && s.position.row === targetHex.row
        );
        
        if (shipAtHex) {
          if (shipAtHex.color === ship.color) {
            // Can't move through friendly ships, stop movement in this direction
            break;
          } else {
            // Enemy ship - can attack and move to this position
            validMoves.push(targetHex);
            break;
          }
        }
        
        // Check if hex is blocked by meteor (impassable)
        const blockedByMeteor = meteors.some(meteor => 
          meteor.col === targetHex.col && meteor.row === targetHex.row
        );
        
        if (blockedByMeteor) {
          // Can't move through meteors, stop movement in this direction
          break;
        }
        
        // Check if hex has debris field
        const hasDebris = debrisFields.some(debris => 
          debris.col === targetHex.col && debris.row === targetHex.row
        );
        
        // Hex is valid for movement
        validMoves.push(targetHex);
        
        // If this hex has debris, ships must stop here (can't continue past it this turn)
        if (hasDebris) {
          break;
        }
      }
    });
    
    return validMoves;
  };

  const selectShipForMovement = (ship: Ship) => {
    if (gamePhase !== 'playing') return;
    
    // Only allow player to select their own ships
    const room = (window as any).currentRoom;
    const isMyShip = room ? ship.owner === room.sessionId : ship.color === 'blue';
    if (!isMyShip) return;
    
    // Check if it's the player's turn
    if (room) {
      const currentTurn = (window as any).currentTurn;
      if (currentTurn && currentTurn !== room.sessionId) {
        logger.info('HEX_BOARD', 'Not your turn!', { currentTurn, myId: room.sessionId });
        return;
      }
    }
    
    // Track which ship used AP this turn (store it globally)
    if (!window.shipThatUsedAP && hasUsedAP && selectedShipForMovement) {
      window.shipThatUsedAP = selectedShipForMovement.id;
    }
    
    // Don't allow selection if AP has been used by a DIFFERENT ship
    if (hasUsedAP && window.shipThatUsedAP && window.shipThatUsedAP !== ship.id) {
      logger.info('HEX_BOARD', 'Cannot select - AP already used by another ship', {
        shipThatUsedAP: shipThatUsedAP,
        attemptedShip: ship.id
      });
      return;
    }
    
    // Check if ship is stopped in debris
    if (shipsStoppedInDebris.includes(ship.id)) {
      // Ship cannot move this turn, but can be freed next turn
      setShipsStoppedInDebris(prev => prev.filter(id => id !== ship.id));
      logger.info('HEX_BOARD', 'Ship freed from debris', {
        shipId: ship.id,
        shipType: ship.type
      });
      return;
    }
    
    setSelectedShipForMovement(ship);
    
    if (useActionPoints) {
      // Use new action point system
      const config = SHIP_ACTION_POINTS[ship.type];
      if (config) {
        setMaxAP(config.maxActionPoints);
        // Each ship gets its own AP pool when selected
        setCurrentAP(config.maxActionPoints);
        setShipRotation(normalizeRotation(ship.rotation || 0));
        setOriginalRotation(normalizeRotation(ship.rotation || 0)); // Store original rotation for AP calculation
        setPlannedActions([]);
        setRotationAPCost(0); // Reset rotation cost
        
        // Calculate initial valid moves with the full AP
        const moves = calculateAPValidMoves(ship, config.maxActionPoints);
        setValidMoveTargets(moves);
      }
      setShowActionPointUI(true);
      logger.info('HEX_BOARD', 'Ship selected for action point movement', {
        shipId: ship.id,
        shipType: ship.type,
        actionPoints: config?.maxActionPoints || 0
      });
    } else {
      // Use old movement pattern system
      const moves = calculateValidMoves(ship);
      setValidMoveTargets(moves);
      logger.info('HEX_BOARD', 'Ship selected for movement', {
        shipId: ship.id,
        shipType: ship.type,
        validMoves: moves.length
      });
    }
  };

  const moveShipToHex = (targetHex: HexCoordinate) => {
    if (!selectedShipForMovement) return;
    
    // Check if the target hex is a valid move
    const isValidMove = validMoveTargets.some(hex => 
      hex.col === targetHex.col && hex.row === targetHex.row
    );
    
    if (!isValidMove) return;
    
    // Calculate exact rotation angle to face target
    const targetRotation = calculateRotationForMovement(
      selectedShipForMovement.position,
      targetHex
    );
    
    // Start animation
    const fromLayout = hexToScreenPosition(selectedShipForMovement.position.col, selectedShipForMovement.position.row);
    const toLayout = hexToScreenPosition(targetHex.col, targetHex.row);
    
    // Use the ship's stored rotation if available, otherwise calculate from orientation
    const currentRotation = selectedShipForMovement.rotation !== undefined 
      ? selectedShipForMovement.rotation 
      : normalizeRotation(selectedShipForMovement.orientation || 0);
    
    // Setting up animation
    
    const animationData = {
      fromPos: { 
        x: fromLayout.x, 
        y: fromLayout.y 
      },
      toPos: { 
        x: toLayout.x, 
        y: toLayout.y 
      },
      targetHex: { col: targetHex.col, row: targetHex.row },
      fromRotation: currentRotation,
      toRotation: targetRotation,
      duration: 1500,
      startTime: Date.now(),
      progress: 0
    };
    
    setAnimatingShips(prev => {
      const newMap = new Map(prev);
      newMap.set(selectedShipForMovement.id, animationData);
      return newMap;
    });
    
    // For multiplayer, send move to server
    const room = (window as any).currentRoom;
    if (room) {
      room.send("moveShip", {
        shipId: selectedShipForMovement.id,
        from: {
          col: selectedShipForMovement.position.col,
          row: selectedShipForMovement.position.row
        },
        to: {
          col: targetHex.col,
          row: targetHex.row
        }
      });
      
      // Clear selection immediately for responsive UI
      setSelectedShipForMovement(null);
      setValidMoveTargets([]);
      return; // Server will handle the actual movement
    }
    
    // Check if there's an enemy ship at the target hex
    const enemyShip = ships.find(ship => 
      ship.position.col === targetHex.col && 
      ship.position.row === targetHex.row &&
      ship.color !== selectedShipForMovement.color
    );
    
    if (enemyShip) {
      // Attack: Destroy enemy ship, create debris field, move attacker to the position
      
      // Trigger combat animations
      if (selectedShipForMovement.type === 'corvette' || selectedShipForMovement.type === 'frigate') {
        triggerRocketAnimation(selectedShipForMovement.position, targetHex, selectedShipForMovement.id);
      } else {
        triggerLaserAnimation(selectedShipForMovement.position, targetHex, selectedShipForMovement.id);
      }
      
      triggerThrusterAnimation(selectedShipForMovement.id);
      
      // Delay explosion slightly
      setTimeout(() => {
        triggerExplosionAnimation(targetHex);
      }, 300);
      
      // First remove the enemy ship and move the attacking ship
      setShips(prevShips => {
        const updatedShips = prevShips
          .filter(ship => ship.id !== enemyShip.id) // Remove enemy ship
          .map(ship => {
            if (ship.id === selectedShipForMovement.id) {
              const newRotation = calculateRotationForMovement(ship.position, targetHex);
              return { 
                ...ship, 
                position: targetHex, // Move attacking ship to enemy position
                rotation: newRotation
              };
            }
            return ship;
          });
        
        logger.info('HEX_BOARD', 'Ships after combat', {
          before: prevShips.length,
          after: updatedShips.length,
          destroyedShip: enemyShip.id,
          destroyedShipType: enemyShip.type,
          remainingShips: updatedShips.map(s => ({ id: s.id, type: s.type, position: `${s.position.col}${s.position.row}` }))
        });
        
        return updatedShips;
      });
      
      // Create debris field where enemy was destroyed
      // Use the enemy ship's position directly since it's already a HexCoordinate
      const debrisPosition = enemyShip.position;
      
      setCombatDebrisFields(prevCombatDebris => {
        const newCombatDebris = [...prevCombatDebris, debrisPosition];
        // Combat debris created
        logger.info('HEX_BOARD', 'Debris field created from combat', {
          position: `${targetHex.col}${targetHex.row}`,
          totalCombatDebris: newCombatDebris.length,
          totalMapDebris: mapDebrisFields.length,
          totalDebrisFields: mapDebrisFields.length + newCombatDebris.length,
          allDebrisPositions: [...mapDebrisFields, ...newCombatDebris].map(d => `${d.col}${d.row}`)
        });
        return newCombatDebris;
      });
      
      setSelectedShipForMovement(null);
      setValidMoveTargets([]);
      
      logger.info('HEX_BOARD', 'Combat: Enemy ship destroyed', {
        attackerId: selectedShipForMovement.id,
        attackerType: selectedShipForMovement.type,
        defenderId: enemyShip.id,
        defenderType: enemyShip.type,
        position: `${targetHex.col}${targetHex.row}`
      });
      return;
    }
    
    // No enemy ship - normal movement
    // Trigger thruster animation for movement
    triggerThrusterAnimation(selectedShipForMovement.id);
    
    setShips(prevShips => 
      prevShips.map(ship => {
        if (ship.id === selectedShipForMovement.id) {
          const newRotation = calculateRotationForMovement(ship.position, targetHex);
          return { 
            ...ship, 
            position: targetHex,
            rotation: newRotation
          };
        }
        return ship;
      })
    );
    
    // Check if ship landed on debris (must stop for one turn)
    const landedOnDebris = debrisFields.some(debris => 
      debris.col === targetHex.col && debris.row === targetHex.row
    );
    
    if (landedOnDebris) {
      // Mark ship as stopped in debris
      setShipsStoppedInDebris(prev => [...prev, selectedShipForMovement.id]);
    } else {
      // Remove ship from stopped list if it was previously stopped
      setShipsStoppedInDebris(prev => prev.filter(id => id !== selectedShipForMovement.id));
    }
    
    // Clear selection
    setSelectedShipForMovement(null);
    setValidMoveTargets([]);
    
    logger.info('HEX_BOARD', 'Ship moved', {
      shipId: selectedShipForMovement.id,
      from: `${selectedShipForMovement.position.col}${selectedShipForMovement.position.row}`,
      to: `${targetHex.col}${targetHex.row}`,
      landedOnDebris
    });
  };
  
  // Handle ship destruction and check for victory
  const handleShipDestruction = (destroyedShip: Ship, location: HexCoordinate) => {
    // Remove the destroyed ship
    setShips(prevShips => prevShips.filter(s => s.id !== destroyedShip.id));
    
    // Create debris field at destruction location
    setCombatDebrisFields(prev => [...prev, location]);
    
    // Check if destroyed ship was a mothership (victory condition)
    if (destroyedShip.type === 'mothership') {
      logger.info('HEX_BOARD', 'MOTHERSHIP DESTROYED - GAME OVER', {
        destroyedColor: destroyedShip.color,
        winner: destroyedShip.color === 'blue' ? 'AI' : 'Human'
      });
      
      // Notify parent component of game end
      if (onGameEnd) {
        const winner = destroyedShip.color === 'blue' ? 'ai' : 'human';
        onGameEnd(winner);
      }
    }
    
    logger.info('HEX_BOARD', 'Ship destroyed', {
      shipId: destroyedShip.id,
      shipType: destroyedShip.type,
      location: `${location.col}${location.row}`
    });
  };
  
  // Calculate valid moves for action points - shows all hexes ship can reach with current AP
  const calculateAPValidMoves = (ship: Ship, availableAP?: number): HexCoordinate[] => {
    const config = SHIP_ACTION_POINTS[ship.type];
    const apToUse = availableAP !== undefined ? availableAP : currentAP;
    if (!config || apToUse < 1) return [];
    
    const shipHex = boardHexes.find(h => h.col === ship.position.col && h.row === ship.position.row);
    if (!shipHex) return [];
    
    const validMoves: HexCoordinate[] = [];
    
    if (config.isOmnidirectional) {
      // Mothership - can move to any adjacent hex
      const adjacent = getAdjacentHexes(shipHex.q, shipHex.r);
      adjacent.forEach(adj => {
        const hex = boardHexes.find(h => h.q === adj.q && h.r === adj.r);
        if (hex) {
          // Check if hex is occupied by another ship
          const occupyingShip = ships.find(s => 
            s.id !== ship.id && s.position.col === hex.col && s.position.row === hex.row
          );
          
          if (occupyingShip) {
            // Check if it's an enemy ship (can capture) or friendly (blocked)
            const room = (window as any).currentRoom;
            const isEnemy = room ? 
              occupyingShip.owner !== room.sessionId : 
              occupyingShip.color !== ship.color;
            
            if (isEnemy) {
              // Can capture enemy ship
              validMoves.push(hex);
            }
            // Don't add friendly occupied hexes
          } else {
            // Empty hex - can move there
            validMoves.push(hex);
          }
        }
      });
    } else {
      // Regular ships - show path of hexes in front based on available AP
      // Use the ship's rotation in degrees directly
      const currentRotation = ship.rotation !== undefined 
        ? normalizeRotation(ship.rotation)
        : 0;
      let currentQ = shipHex.q;
      let currentR = shipHex.r;
      
      // Get up to apToUse hexes in the forward direction
      let remainingAP = apToUse;
      for (let i = 0; i < apToUse && i < config.maxActionPoints; i++) {
        const forward = getForwardHex(currentQ, currentR, currentRotation);
        const hex = boardHexes.find(h => h.q === forward.q && h.r === forward.r);
        
        if (hex) {
          // Check hex type
          const hexType = getHexType(hex);
          
          // Check for meteor (impassable)
          if (hexType === 'meteor') {
            // Stop at meteors - can't pass through
            break;
          }
          
          // Check if hex is occupied by another ship
          const occupyingShip = ships.find(s => 
            s.id !== ship.id && 
            s.position.col === hex.col && 
            s.position.row === hex.row
          );
          
          if (occupyingShip) {
            // Check if it's an enemy ship (can capture) or friendly (blocked)
            const room = (window as any).currentRoom;
            const isEnemy = room ? 
              occupyingShip.owner !== room.sessionId : 
              occupyingShip.color !== ship.color;
            
            if (isEnemy) {
              // Can capture enemy ship - add as valid move but can't move past
              validMoves.push(hex);
            }
            // Stop at any ship (can't move past)
            break;
          }
          
          // Add hex as valid move if not occupied
          validMoves.push(hex);
          
          // Check for debris field (consumes all remaining AP)
          if (hexType === 'debris') {
            // Can enter debris field but it consumes all remaining AP
            // So stop showing further hexes
            break;
          }
          
          currentQ = forward.q;
          currentR = forward.r;
          remainingAP--;
        } else {
          // Hit edge of board
          break;
        }
      }
    }
    
    logger.debug('HEX_BOARD', 'Calculated AP valid moves', {
      shipId: ship.id,
      shipRotation: ship.rotation !== undefined ? normalizeRotation(ship.rotation) : shipRotation,
      availableAP: apToUse,
      validMoves: validMoves.map(h => `${h.col}${h.row}`)
    });
    
    return validMoves;
  };
  
  // Note: handleAPRotation removed - using touch/drag rotation instead
  
  // Handle hex click during action point mode - move directly to clicked hex
  const handleActionPointHexClick = (hex: HexCoordinate) => {
    if (!selectedShipForMovement || currentAP < 1) return;
    
    // Check if this is a valid move
    const validIndex = validMoveTargets.findIndex(h => h.col === hex.col && h.row === hex.row);
    if (validIndex === -1) return;
    
    // Calculate cost (distance in hexes)
    const config = SHIP_ACTION_POINTS[selectedShipForMovement.type];
    const moveCost = config?.isOmnidirectional ? 1 : validIndex + 1; // Omnidirectional ships always cost 1 AP per move
    if (moveCost > currentAP) return;
    
    // Execute the move
    const room = (window as any).currentRoom;
    if (room) {
      // Send move to server
      room.send("moveShip", {
        shipId: selectedShipForMovement.id,
        from: { col: selectedShipForMovement.position.col, row: selectedShipForMovement.position.row },
        to: { col: hex.col, row: hex.row }
      });
    }
    
    // Start animation
    const fromLayout = hexToScreenPosition(selectedShipForMovement.position.col, selectedShipForMovement.position.row);
    const toLayout = hexToScreenPosition(hex.col, hex.row);
    // Ships maintain their current rotation when moving (rotation is handled separately via AP)
    const isOmnidirectional = config?.isOmnidirectional;
    const currentRotation = selectedShipForMovement.rotation !== undefined 
      ? selectedShipForMovement.rotation 
      : normalizeRotation(selectedShipForMovement.orientation || 0);
    // Ships keep their current rotation when moving (no auto-rotation)
    const targetRotation = currentRotation;
    
    const animationData = {
      fromPos: { x: fromLayout.x, y: fromLayout.y },
      toPos: { x: toLayout.x, y: toLayout.y },
      targetHex: { col: hex.col, row: hex.row },
      fromRotation: currentRotation,
      toRotation: targetRotation,
      duration: 1000,
      startTime: Date.now(),
      progress: 0
    };
    
    setAnimatingShips(new Map(animatingShips.set(selectedShipForMovement.id, animationData)));
    
    // Check if moving into debris or combat
    const hexType = getHexType(hex);
    const isDebrisField = hexType === 'debris' || combatDebrisFields.some(
      d => d.col === hex.col && d.row === hex.row
    );
    
    // Check if there's an enemy ship at target (combat)
    const enemyShip = ships.find(s => 
      s.position.col === hex.col && 
      s.position.row === hex.row &&
      s.owner !== (room?.sessionId || 'player1')
    );
    const isCombat = !!enemyShip;
    
    // Mark that AP has been used and track which ship used it
    setHasUsedAP(true);
    window.shipThatUsedAP = selectedShipForMovement.id;
    
    // Update AP after move but keep selection if AP remains
    // Debris and combat consume ALL remaining AP
    const remainingAP = (isDebrisField || isCombat) ? 0 : currentAP - moveCost;
    setCurrentAP(remainingAP);
    
    if (isDebrisField) {
      logger.info('HEX_BOARD', 'Ship entered debris field - all AP consumed', {
        shipId: selectedShipForMovement.id,
        hex: `${hex.col}${hex.row}`
      });
    }
    
    if (isCombat) {
      logger.info('HEX_BOARD', 'Combat occurred - all AP consumed', {
        shipId: selectedShipForMovement.id,
        enemyId: enemyShip?.id,
        hex: `${hex.col}${hex.row}`
      });
    }
    
    if (remainingAP > 0) {
      // Keep the ship selected and update valid moves from new position
      // Also update the orientation to face the direction of movement
      const movedShip = { 
        ...selectedShipForMovement, 
        position: hex,
        rotation: targetRotation
      };
      setSelectedShipForMovement(movedShip);
      const newMoves = calculateAPValidMoves(movedShip, remainingAP);
      setValidMoveTargets(newMoves);
      logger.info('HEX_BOARD', 'Ship has remaining AP', {
        shipId: selectedShipForMovement.id,
        remainingAP
      });
    } else {
      // No AP left, clear selection and end turn
      setSelectedShipForMovement(null);
      setShowActionPointUI(false);
      setValidMoveTargets([]);
      setHasUsedAP(false); // Reset for next turn
      
      // Send endTurn message to server
      const room = (window as any).currentRoom;
      if (room) {
        // No AP remaining, ending turn
        room.send("endTurn");
      }
    }
  };
  
  // Handle action point based movement
  const handleActionPointMove = (ship: Ship, actions: PlannedAction[]) => {
    if (!ship) return;
    
    logger.info('HEX_BOARD', 'Processing action point moves', {
      shipId: ship.id,
      actionCount: actions.length,
      actions
    });
    
    let currentPos = ship.position;
    let currentRotation = ship.rotation || 0;
    
    // Process each action in sequence
    actions.forEach((action, index) => {
      if (action.type === 'rotate') {
        currentRotation = action.toRotation!;
      } else if (action.type === 'move' && action.toHex) {
        // Find the hex for the move
        const targetHex = boardHexes.find(h => 
          h.col === action.toHex!.col && h.row === action.toHex!.row
        );
        
        if (targetHex) {
          // Check for enemy ship at target
          const enemyShip = ships.find(s => 
            s.position.col === targetHex.col && 
            s.position.row === targetHex.row &&
            s.color !== ship.color
          );
          
          if (enemyShip) {
            // Destroy enemy ship
            handleShipDestruction(enemyShip, targetHex);
          }
          
          currentPos = targetHex;
        }
      }
    });
    
    // Update ship with final position and rotation
    const finalRotation = normalizeRotation(currentRotation);
    
    setShips(prevShips =>
      prevShips.map(s => {
        if (s.id === ship.id) {
          return {
            ...s,
            position: currentPos,
            rotation: finalRotation
          };
        }
        return s;
      })
    );
    
    // Clear selection and UI
    setSelectedShipForMovement(null);
    setShowActionPointUI(false);
    setValidMoveTargets([]);
    
    logger.info('HEX_BOARD', 'Action point move complete', {
      shipId: ship.id,
      finalPosition: `${currentPos.col}${currentPos.row}`,
      finalRotation: finalRotation
    });
  };

  const handleMeteorDamage = (ship: Ship) => {
    // Simple damage system: meteors destroy scouts and interceptors, damage larger ships
    let shipDestroyed = false;
    
    if (ship.type === 'scout' || ship.type === 'interceptor') {
      // Small ships are destroyed by meteors
      shipDestroyed = true;
      setShips(prevShips => prevShips.filter(s => s.id !== ship.id));
      
      // Create debris field where ship was destroyed
      const newDebrisField = ship.position;
      setCombatDebrisFields(prevCombatDebris => [...prevCombatDebris, newDebrisField]);
      
      logger.info('HEX_BOARD', 'Ship destroyed by meteor', {
        shipId: ship.id,
        shipType: ship.type,
        position: `${ship.position.col}${ship.position.row}`
      });
    } else {
      // Larger ships take damage but survive
      logger.info('HEX_BOARD', 'Ship damaged by meteor', {
        shipId: ship.id,
        shipType: ship.type,
        position: `${ship.position.col}${ship.position.row}`
      });
      // TODO: Implement ship health system for partial damage
    }
    
    return shipDestroyed;
  };

  const handleCombat = (attackingShip: Ship, defendingShip: Ship): { attackerWins: boolean, defenderDestroyed: boolean } => {
    // Simple combat system based on ship types
    const shipCombatValues = {
      scout: 1,
      interceptor: 2,
      corvette: 3,
      destroyer: 4,
      cruiser: 5,
      battleship: 6,
      artillery: 4 // High damage but vulnerable
    };
    
    const attackerValue = shipCombatValues[attackingShip.type] || 1;
    const defenderValue = shipCombatValues[defendingShip.type] || 1;
    
    // Add some randomness to combat
    const attackerRoll = Math.random();
    const defenderRoll = Math.random();
    
    const attackerTotal = attackerValue + attackerRoll;
    const defenderTotal = defenderValue + defenderRoll;
    
    const attackerWins = attackerTotal > defenderTotal;
    
    if (attackerWins) {
      // Defender is destroyed
      setShips(prevShips => prevShips.filter(s => s.id !== defendingShip.id));
      
      // Create debris field where defender was destroyed
      const newDebrisField = defendingShip.position;
      setCombatDebrisFields(prevCombatDebris => [...prevCombatDebris, newDebrisField]);
      
      logger.info('HEX_BOARD', 'Combat result: Attacker wins', {
        attacker: { id: attackingShip.id, type: attackingShip.type, roll: attackerRoll, total: attackerTotal },
        defender: { id: defendingShip.id, type: defendingShip.type, roll: defenderRoll, total: defenderTotal },
        position: `${defendingShip.position.col}${defendingShip.position.row}`
      });
      
      return { attackerWins: true, defenderDestroyed: true };
    } else {
      // Attacker is destroyed or retreated
      logger.info('HEX_BOARD', 'Combat result: Defender wins', {
        attacker: { id: attackingShip.id, type: attackingShip.type, roll: attackerRoll, total: attackerTotal },
        defender: { id: defendingShip.id, type: defendingShip.type, roll: defenderRoll, total: defenderTotal },
        position: `${defendingShip.position.col}${defendingShip.position.row}`
      });
      
      return { attackerWins: false, defenderDestroyed: false };
    }
  };

  // Generate hexagon points for SVG polygon
  const getHexagonPoints = (centerX: number, centerY: number, radius: number): string => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  };

  const getHexType = (hex: HexCoordinate): 'zone1' | 'zone2' | 'zone3' | 'zone4' | 'meteor' | 'debris' | 'neutral' => {
    // Check for debris fields FIRST (highest priority - debris can override zones)
    const isDebris = debrisFields.some(d => d.col === hex.col && d.row === hex.row);
    if (isDebris) {
      return 'debris';
    }
    
    // Then check for meteors
    if (meteors.some(m => m.col === hex.col && m.row === hex.row)) {
      return 'meteor';
    }
    
    // Finally check for deployment zones (lowest priority)
    // topLeft has 'a' columns (west) = server zone 2
    // topRight has 'k' columns (east) = server zone 1
    if (deploymentZones.topLeft.some(h => h.col === hex.col && h.row === hex.row)) {
      return 'zone2';  // West zone
    }
    if (deploymentZones.topRight.some(h => h.col === hex.col && h.row === hex.row)) {
      return 'zone1';  // East zone
    }
    if (deploymentZones.bottomLeft.some(h => h.col === hex.col && h.row === hex.row)) {
      return 'zone3';
    }
    if (deploymentZones.bottomRight.some(h => h.col === hex.col && h.row === hex.row)) {
      return 'zone4';
    }
    
    return 'neutral';
  };

  const getZoneNumber = (hexType: string): number | null => {
    switch (hexType) {
      case 'zone1': return 1;
      case 'zone2': return 2;
      case 'zone3': return 3;
      case 'zone4': return 4;
      default: return null;
    }
  };

  const getShipImage = (shipType: string, color: string = 'blue') => {
    const colorPrefix = color.toUpperCase();
    switch (shipType) {
      case 'scout': return SHIP_IMAGES[`${colorPrefix}_SCOUT`];
      case 'interceptor': return SHIP_IMAGES[`${colorPrefix}_INTERCEPTOR`];
      case 'corvette': return SHIP_IMAGES[`${colorPrefix}_CORVETTE`];
      case 'frigate': return SHIP_IMAGES[`${colorPrefix}_CAPTAIN`]; // Using battleship image for frigate
      case 'destroyer': return SHIP_IMAGES[`${colorPrefix}_DESTROYER`];
      case 'cruiser': return SHIP_IMAGES[`${colorPrefix}_FLEET_ADMIRAL`];
      case 'battleship': return SHIP_IMAGES[`${colorPrefix}_CAPTAIN`];
      case 'artillery': return SHIP_IMAGES[`${colorPrefix}_ARTILLERY`];
      case 'mothership': return SHIP_IMAGES[`${colorPrefix}_MOTHERSHIP`];
      default: return SHIP_IMAGES[`${colorPrefix}_SCOUT`];
    }
  };

  const isZoneAvailableForSelection = (zoneNumber: number): boolean => {
    if (zoneSelectionPhase !== 'selecting') return false;
    
    // Check if it's this player's turn to select in multiplayer
    const room = (window as any).currentRoom;
    if (room && currentPlayerSelectingZone !== room.sessionId) {
      return false; // Don't highlight zones if it's not your turn
    }
    
    return availableZones.includes(zoneNumber);
  };

  const handleHexPress = (hex: HexCoordinate) => {
    // Prevent rapid clicks from causing issues
    if (isProcessingClick) {
      // Ignoring click - still processing previous click
      return;
    }
    
    const hexType = getHexType(hex);
    const zoneNumber = getZoneNumber(hexType);
    
    // Check if there's a ship at this hex FIRST, before action point handling
    const shipAtHex = ships.find(ship => 
      ship.position.col === hex.col && ship.position.row === hex.row
    );
    
    // If clicking on a ship during playing phase, handle ship selection/deselection
    if (gamePhase === 'playing' && shipAtHex) {
      const room = (window as any).currentRoom;
      const isMyShip = room ? shipAtHex?.owner === room.sessionId : shipAtHex?.color === 'blue';
      
      if (isMyShip) {
        // Set processing flag with timeout
        setIsProcessingClick(true);
        setTimeout(() => setIsProcessingClick(false), 300); // 300ms debounce
        
        // Clicking on own ship
        if (selectedShipForMovement?.id === shipAtHex.id) {
          // Clicking same ship that's already selected
          if (hasUsedAP) {
            // If AP has been used, DON'T deselect - player needs to finish their turn
            logger.info('HEX_BOARD', 'Cannot deselect - AP already used, must finish turn', {
              shipId: shipAtHex.id,
              currentAP: currentAP,
              hasUsedAP: hasUsedAP
            });
            return; // Keep the ship selected
          } else {
            // Only allow deselection if no AP has been used yet
            setSelectedShipForMovement(null);
            setValidMoveTargets([]);
            setShowActionPointUI(false);
            setViewingEnemyShip(null);
            setCurrentAP(0);
            return;
          }
        } else if (!hasUsedAP) {
          // Can select a different ship if no AP used yet
          selectShipForMovement(shipAtHex);
          setViewingEnemyShip(null);
          return;
        } else {
          // Already used AP - check if this is the ship that used it
          if (window.shipThatUsedAP && shipAtHex.id === window.shipThatUsedAP) {
            // Re-selecting the ship that used AP - this is allowed
            selectShipForMovement(shipAtHex);
            return;
          }
          logger.info('HEX_BOARD', 'Cannot switch ships - AP already used', {
            shipThatUsedAP: shipThatUsedAP,
            attemptedShip: shipAtHex.id,
            hasUsedAP: hasUsedAP
          });
          return;
        }
      } else {
        // Enemy ship - check if this is a valid attack target first
        const isValidTarget = selectedShipForMovement && validMoveTargets.some(target => 
          target.col === hex.col && target.row === hex.row
        );
        
        if (isValidTarget) {
          // This is a valid attack move - let it proceed to movement handler
          // Don't return here, let it fall through to action point handler
        } else {
          // Not a valid target, just show enemy info
          setViewingEnemyShip(shipAtHex);
          return;
        }
      }
    }
    
    // If action point UI is showing and we didn't click on a ship, handle movement
    if (showActionPointUI && selectedShipForMovement) {
      handleActionPointHexClick(hex);
      return;
    }
    
    // Handle zone selection during deployment setup
    if (zoneSelectionPhase === 'selecting' && zoneNumber && isZoneAvailableForSelection(zoneNumber)) {
      selectZone(zoneNumber);
      return;
    }
    
    // Handle ship deployment phase
    if (gamePhase === 'deployment') {
      // In multiplayer, use isCurrentPlayer flag; in AI games, find non-AI player
    const humanPlayer = players.find(p => p.isCurrentPlayer) || players.find(p => !p.isAI);
      const isPlayerZone = humanPlayer?.assignedZone && getZoneNumber(hexType) === humanPlayer.assignedZone;
      
      // Check if there's a ship at this hex
      const shipAtHex = ships.find(ship => 
        ship.position.col === hex.col && ship.position.row === hex.row
      );
      
      // If clicking on an already deployed ship
      const room = (window as any).currentRoom;
      const isMyShip = room ? shipAtHex?.owner === room.sessionId : shipAtHex?.color === 'blue';
      if (shipAtHex && isMyShip) {
        // Don't process click if we're currently dragging for rotation
        if (isDraggingRotation) {
          return;
        }
        
        // If deployment confirmed, just show rotation controls
        if (deploymentConfirmed) {
          setDeploymentRotationShip(shipAtHex);
          logger.info('HEX_BOARD', 'Selected ship for rotation', {
            ship: shipAtHex,
            hex: `${hex.col}${hex.row}`
          });
          return;
        }
        
        // If not confirmed, show rotation controls first, undeploy on second click
        if (deploymentRotationShip?.id === shipAtHex.id) {
          // Second click - undeploy
          setShips(prevShips => prevShips.filter(ship => ship.id !== shipAtHex.id));
          setDeploymentRotationShip(null);
          // Notify parent to add ship back to pool
          if (onShipDeployed) {
            // Use negative signal to indicate undeployment
            onShipDeployed({ ...shipAtHex, type: `-${shipAtHex.type}` } as any);
          }
          
          // Auto-select the undeployed ship type for easy re-deployment
        if (onShipSelect) {
          // Get the max count for this ship type
          const shipTypeMaxCounts: {[key: string]: number} = {
            'scout': 2,
            'interceptor': 2,
            'corvette': 2,
            'frigate': 2,
            'destroyer': 1,
            'cruiser': 1
          };
          
          const shipTypeToSelect = {
            id: shipAtHex.type,
            type: shipAtHex.type,
            name: shipAtHex.type.charAt(0).toUpperCase() + shipAtHex.type.slice(1),
            maxCount: shipTypeMaxCounts[shipAtHex.type] || 1
          };
          onShipSelect(shipTypeToSelect);
          logger.info('HEX_BOARD', 'Auto-selected undeployed ship type', {
            type: shipAtHex.type,
            maxCount: shipTypeToSelect.maxCount
          });
        }
        
        logger.info('HEX_BOARD', 'Ship undeployed', {
          ship: shipAtHex,
          hex: `${hex.col}${hex.row}`
        });
        } else {
          // First click - show rotation controls
          setDeploymentRotationShip(shipAtHex);
          logger.info('HEX_BOARD', 'Selected ship for rotation', {
            ship: shipAtHex,
            hex: `${hex.col}${hex.row}`
          });
        }
        return;
      }
      
      // If we have a selected ship type and clicking in valid zone, deploy it
      if (selectedShip && isPlayerZone && !shipAtHex) {
        // Prevent new deployments if deployment has been confirmed
        if (deploymentConfirmed) {
          logger.info('HEX_BOARD', 'Cannot deploy - deployment confirmed');
          return;
        }
        
        // Check if we've reached the limit for this ship type
        // Need to count ships of my color
        const room = (window as any).currentRoom;
        let myColor = 'blue'; // default for AI games
        
        if (room && room.state && room.state.players) {
          const playerIds = Array.from(room.state.players.keys());
          const myIndex = playerIds.indexOf(room.sessionId);
          // Assign colors based on player index: 0=blue, 1=red, 2=green, 3=yellow
          switch(myIndex) {
            case 0: myColor = 'blue'; break;
            case 1: myColor = 'red'; break;
            case 2: myColor = 'green'; break;
            case 3: myColor = 'yellow'; break;
            default: myColor = 'blue'; break;
          }
        }
        
        const myShipsOfType = ships.filter(s => s.type === selectedShip.type && s.color === myColor);
        const deployedOfType = myShipsOfType.length;
        const maxAllowed = selectedShip.maxCount || 0;
        
        // Deployment check
        
        if (deployedOfType >= maxAllowed) {
          // Cannot deploy - ship limit reached
          // Actually we want to allow maxCount ships total (0 to maxCount-1 indices = maxCount ships)
          // So this check is correct - if we have 3 deployed and max is 3, we can't deploy more
          return;
        }
        
        // Deploy ship to this hex
        // We already determined myColor above
        const playerZone = humanPlayer?.assignedZone || 1;
        const tempId = `temp_${Date.now()}_${Math.random()}`;
        const newShip: Ship = {
          id: tempId, // Temporary ID for local display
          type: selectedShip.type,
          color: myColor,
          owner: room?.sessionId || 'player1', // Add owner for multiplayer
          position: hex,
          rotation: getInitialRotationForZone(playerZone) // Set initial rotation based on zone
        };
        
        // Show rotation controls for this ship
        setDeploymentRotationShip(newShip);
        
        // For multiplayer games, send deployment to server
        const isMultiplayer = !!room; // If room exists, it's multiplayer
        
        if (isMultiplayer) {
          // Store mapping of position to temp ID so we can update it later
          if (!(window as any).tempShipMap) {
            (window as any).tempShipMap = new Map();
          }
          const posKey = `${hex.col}${hex.row}`;
          (window as any).tempShipMap.set(posKey, tempId);
          
          // Send ship deployment to server with orientation
          room.send("deployShip", {
            type: selectedShip.type,
            col: hex.col,
            row: hex.row,
            rotation: newShip.rotation
          });
          logger.info('HEX_BOARD', 'Sent ship deployment to server', {
            type: selectedShip.type,
            hex: `${hex.col}${hex.row}`,
            tempId: tempId
          });
        }
        
        setShips(prevShips => [...prevShips, newShip]);
        onShipDeployed?.(newShip); // Notify parent component
        
        // Check if we've reached the limit for this ship type
        const newDeployedOfType = deployedOfType + 1;
        if (newDeployedOfType >= maxAllowed) {
          // This type is maxed out, auto-select next available type
          const shipTypes = [
            { type: 'mothership', maxCount: 1 },
            { type: 'scout', maxCount: 2 },
            { type: 'interceptor', maxCount: 2 },
            { type: 'corvette', maxCount: 2 },
            { type: 'frigate', maxCount: 2 },
            { type: 'destroyer', maxCount: 1 },
            { type: 'cruiser', maxCount: 1 }
          ];
          
          // Find the next available ship type
          let nextAvailableShip = null;
          for (const shipType of shipTypes) {
            const deployedCount = ships.filter(s => 
              s.type === shipType.type && s.color === myColor
            ).length + (shipType.type === selectedShip.type ? 1 : 0); // Add 1 for the just-deployed ship
            
            if (deployedCount < shipType.maxCount) {
              nextAvailableShip = {
                ...shipType,
                id: shipType.type,
                name: shipType.type.charAt(0).toUpperCase() + shipType.type.slice(1)
              };
              break;
            }
          }
          
          if (nextAvailableShip) {
            // Auto-select the next available ship type
            if (onShipSelect) {
              onShipSelect(nextAvailableShip);
              logger.info('HEX_BOARD', 'Auto-selected next ship type', {
                previousType: selectedShip.type,
                newType: nextAvailableShip.type
              });
            }
          } else {
            // No more ships available, clear selection
            if (onShipSelect) {
              onShipSelect(null);
              logger.info('HEX_BOARD', 'All ships deployed - clearing selection');
            }
          }
        }
        // Otherwise keep current selection for multiple deployments
        
        logger.info('HEX_BOARD', 'Ship deployed', {
          ship: newShip,
          hex: `${hex.col}${hex.row}`
        });
      } else if (selectedShip && !isPlayerZone) {
        logger.warn('HEX_BOARD', 'Cannot deploy - not in player zone', {
          hex: `${hex.col}${hex.row}`,
          hexType
        });
      }
    }
    
    // Handle movement during playing phase (ship selection is now handled at the top)
    if (gamePhase === 'playing') {
      // Legacy movement system (if action points disabled and ship selected)
      if (selectedShipForMovement && !showActionPointUI) {
        moveShipToHex(hex);
        return;
      }
    }
    
    setSelectedHex(hex);
    onHexTap?.(hex);
    logger.debug('HEX_BOARD', 'Hex tapped', { 
      coordinate: `${hex.col}${hex.row}`,
      axial: `(${hex.q}, ${hex.r})`,
      type: hexType,
      zoneNumber
    });
  };

  const renderHex = (hex: HexCoordinate) => {
    // Safety check for hex coordinates
    if (!hex || hex.x === undefined || hex.y === undefined) {
      logger.warn('Invalid hex in renderHex:', hex);
      return null;
    }
    
    const hexType = getHexType(hex);
    const isSelected = selectedHex?.q === hex.q && selectedHex?.r === hex.r;
    
    
    // Find ship at this position
    // BUT if the ship is animating, we should not show it at its stored position
    const shipAtHex = ships.find(ship => {
      // If ship is animating, don't show it at its stored position
      if (animatingShips.has(ship.id)) {
        return false; // Ship is animating, handled separately
      }
      // Otherwise, check normal position
      return ship.position.col === hex.col && ship.position.row === hex.row;
    });
    
    // Debug log for specific test positions
    if (hex.col === 'f' && hex.row === 6) {
      logger.log(`Rendering hex f6: shipAtHex=${shipAtHex?.id || 'none'}, total ships=${ships.length}`);
      const shipsAtF6 = ships.filter(s => s.position.col === 'f' && s.position.row === 6);
      if (shipsAtF6.length > 0) {
        logger.log('Ships at f6:', shipsAtF6);
      }
    }
    
      // Debug logging for combat issues (only for specific hexes to avoid spam)
    if (shipAtHex && gamePhase === 'playing' && (hex.col === 'f' && hex.row === 6)) {
      logger.debug('HEX_BOARD', 'Ship found at test hex f6', {
        hex: `${hex.col}${hex.row}`,
        shipId: shipAtHex.id,
        shipType: shipAtHex.type,
        shipColor: shipAtHex.color,
        totalShips: ships.length,
        allShipIds: ships.map(s => s.id)
      });
    }

    // Check if this hex is a valid move target
    const isValidMoveTarget = validMoveTargets.some(target => 
      target.col === hex.col && target.row === hex.row
    );

    // Check if this hex contains an enemy ship that can be attacked
    const isAttackTarget = isValidMoveTarget && shipAtHex && 
      selectedShipForMovement && shipAtHex.color !== selectedShipForMovement.color;

    // Check if this ship is selected for movement
    const isSelectedForMovement = selectedShipForMovement && shipAtHex && 
      shipAtHex.id === selectedShipForMovement.id;
    
    // During deployment, highlight player ships that can be undeployed
    const room = (window as any).currentRoom;
    const isMyShip = room ? shipAtHex?.owner === room.sessionId : shipAtHex?.color === 'blue';
    const canUndeploy = gamePhase === 'deployment' && shipAtHex && isMyShip;

    // Check if this ship is stopped in debris
    const isStoppedInDebris = shipAtHex && shipsStoppedInDebris.includes(shipAtHex.id);
    
    // Check if this hex has both a ship and debris (from combat)
    const hasShipAndDebris = shipAtHex && hexType === 'debris';

    // Color based on hex type and zone selection state
    let fillColor = '#1a1a2e'; // Default neutral
    let strokeColor = '#0f3460';
    const zoneNumber = getZoneNumber(hexType);
    
    // Only highlight zones during deployment phase
    // In multiplayer, use isCurrentPlayer flag; in AI games, find non-AI player
    const humanPlayer = players.find(p => p.isCurrentPlayer) || players.find(p => !p.isAI);
    const aiPlayer = players.find(p => p.isAI);
    
    // Determine which zones are assigned to which player (only during deployment)
    const humanZone = gamePhase === 'deployment' ? humanPlayer?.assignedZone : null;
    const aiZone = gamePhase === 'deployment' ? aiPlayer?.assignedZone : null;
    
    const isHumanZone = humanZone && getZoneNumber(hexType) === humanZone;
    const isAIZone = aiZone && getZoneNumber(hexType) === aiZone;
    
    if (isHumanZone) {
      fillColor = '#2a4a4a'; // Dark teal - player's zone
      strokeColor = '#4ECDC4';
    } else if (isAIZone) {
      fillColor = '#2a2a2a'; // Dark red - AI zone (less visible)
      strokeColor = '#666666';
    } else if (hexType.startsWith('zone')) {
      fillColor = '#1a1a1a'; // Very dark - unused zones
      strokeColor = '#333333';
    } else if (hexType === 'meteor') {
      fillColor = '#4a2a1a'; // Dark orange/brown - meteors
      strokeColor = '#FF6B35'; // Orange border
    } else if (hexType === 'debris') {
      fillColor = '#2a2a3a'; // Dark purple/gray - debris fields
      strokeColor = '#666666'; // Gray border
    }
    
    // Highlight available zones during selection (for non-AI games)
    if (zoneNumber && isZoneAvailableForSelection(zoneNumber)) {
      fillColor = '#FFD700'; // Gold for selectable zones
      strokeColor = '#FFA500';
    }
    
    // Highlight valid move targets with directional color coding
    if (isValidMoveTarget && !isAttackTarget && selectedShipForMovement && selectedShipForMovement.position) {
      // Get the direction of this hex relative to the selected ship's orientation
      const fromCol = selectedShipForMovement.position.col;
      const fromRow = selectedShipForMovement.position.row;
      const shipRotation = normalizeRotation(selectedShipForMovement.rotation || 0);
      
      // Only calculate direction if we have valid from coordinates
      if (fromCol && fromRow !== undefined && fromRow !== null) {
        const moveDirection = getHexDirection(fromCol, fromRow, hex.col, hex.row);
        const relativeDir = getRelativeDirection(Math.round(shipRotation / 60), moveDirection);
        
        // Color code based on relative direction
        switch(relativeDir) {
          case 'forward':
          case 'forwardSide':
            fillColor = '#2a4a2a'; // Dark green for forward moves
            strokeColor = '#00FF00'; // Bright green border
            break;
          case 'side':
            fillColor = '#4a4a2a'; // Dark yellow for side moves
            strokeColor = '#FFFF00'; // Yellow border
            break;
          case 'backward':
            fillColor = '#4a2a2a'; // Dark red for backward moves
            strokeColor = '#FF6600'; // Orange border
            break;
          default:
            fillColor = '#2a4a2a'; // Default green
            strokeColor = '#00FF00';
        }
      } else {
        // Fallback if position data is missing
        fillColor = '#2a4a2a'; // Dark green for valid moves
        strokeColor = '#00FF00'; // Bright green border
      }
    } else if (isValidMoveTarget && !isAttackTarget) {
      // Fallback for when no ship is selected
      fillColor = '#2a4a2a'; // Dark green for valid moves
      strokeColor = '#00FF00'; // Bright green border
    }
    
    // Highlight attack targets
    if (isAttackTarget) {
      fillColor = '#4a2a2a'; // Dark red for attack targets
      strokeColor = '#FF0000'; // Red border
    }
    
    // Highlight selected ship for movement
    if (isSelectedForMovement) {
      fillColor = '#4a4a2a'; // Dark yellow for selected ship
      strokeColor = '#FFFF00'; // Yellow border
    }
    
    // Highlight ships stopped in debris
    if (isStoppedInDebris) {
      fillColor = '#3a2a2a'; // Dark orange for stopped ships
      strokeColor = '#FF8800'; // Orange border
    }
    
    // Highlight ships on debris fields (from combat)
    if (hasShipAndDebris) {
      fillColor = '#2a2a3a'; // Dark purple for ships on debris
      strokeColor = '#8800FF'; // Purple border to indicate debris underneath
    }
    
    // During deployment, highlight ships that can be undeployed
    if (canUndeploy) {
      strokeColor = '#00FF88'; // Green border to show clickable for undeployment
      strokeWidth = 3;
    }
    
    if (isSelected) {
      fillColor = '#FFD700';
      strokeColor = '#FFA500';
    }

    return (
      <View key={`${hex.q}_${hex.r}`} style={{ position: 'absolute', left: hex.x - hexRadius, top: hex.y - hexRadius }}>
        <TouchableOpacity 
          onPress={() => handleHexPress(hex)}
          onPressIn={() => {
            // Start rotation when pressing on a selected ship
            if (shipAtHex && shipAtHex.type !== 'mothership') {
              const isSelectedShip = selectedShipForMovement?.id === shipAtHex.id || 
                                    deploymentRotationShip?.id === shipAtHex.id;
              
              if (isSelectedShip) {
                if (gamePhase === 'playing' && showActionPointUI) {
                  setOriginalRotation(normalizeRotation(shipAtHex.rotation || 0));
                  setDragStartRotation(normalizeRotation(shipAtHex.rotation || 0));
                  setIsDraggingRotation(true);
                } else if (gamePhase === 'deployment') {
                  // During deployment, only start drag rotation after a delay to allow double-click
                  setDragStartRotation(normalizeRotation(shipAtHex.rotation || 0));
                  setTimeout(() => {
                    setIsDraggingRotation(true);
                  }, 200); // Small delay to allow double-click detection
                }
              }
            }
          }}>
          <Svg width={hexRadius * 2} height={hexRadius * 2}>
            <Polygon
              points={getHexagonPoints(hexRadius, hexRadius, hexRadius * 0.9)}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth="2"
            />
          </Svg>
          <View style={styles.hexContent}>
            <Text style={styles.hexLabel}>{hex.col}{hex.row}</Text>
            {hexType === 'meteor' && (
              <Image
                source={meteorImages[`${hex.col}${hex.row}`] || METEOR_IMAGES[0]}
                style={[
                  styles.hazardImage,
                  {
                    width: hexRadius * 1.2,
                    height: hexRadius * 1.2,
                    marginTop: -(hexRadius * 0.6),
                    marginLeft: -(hexRadius * 0.6),
                  }
                ]}
                resizeMode="contain"
              />
            )}
            {hexType === 'debris' && !shipAtHex && (
              <Image
                source={DEBRIS_IMAGE}
                style={{
                  position: 'absolute',
                  width: hexRadius * 1.2,
                  height: hexRadius * 1.2,
                  top: '50%',
                  left: '50%',
                  marginTop: -(hexRadius * 0.6),
                  marginLeft: -(hexRadius * 0.6),
                  zIndex: 3
                }}
                resizeMode="contain"
              />
            )}
            {hexType === 'debris' && shipAtHex && (
              <Image
                source={DEBRIS_IMAGE}
                style={[
                  styles.debrisUnderShip,
                  {
                    width: hexRadius * 0.8,
                    height: hexRadius * 0.8,
                    marginTop: -(hexRadius * 0.4),
                    marginLeft: -(hexRadius * 0.4),
                  }
                ]}
                resizeMode="contain"
              />
            )}
            {shipAtHex && !animatingShips.has(shipAtHex.id) && (
              <View
                onMouseDown={(e: any) => {
                  // Handle mouse down for web
                  if (shipAtHex.type === 'mothership') return; // Mothership doesn't rotate
                  
                  const isSelectedShip = selectedShipForMovement?.id === shipAtHex.id || 
                                        deploymentRotationShip?.id === shipAtHex.id;
                  
                  if (!isSelectedShip) return;
                  
                  if (gamePhase === 'playing' && showActionPointUI) {
                    // Store original orientation when starting drag
                    setOriginalOrientation(shipAtHex.orientation || 0);
                    setDragStartRotation(normalizeRotation(shipAtHex.rotation || 0));
                    setIsDraggingRotation(true);
                    e.preventDefault();
                  } else if (gamePhase === 'deployment') {
                    // During deployment, rotation is free
                    setDragStartRotation(normalizeRotation(shipAtHex.rotation || 0));
                    setIsDraggingRotation(true);
                    e.preventDefault();
                  }
                }}
                onTouchStart={(e: any) => {
                  // Handle touch start for mobile
                  if (shipAtHex.type === 'mothership') return; // Mothership doesn't rotate
                  
                  const isSelectedShip = selectedShipForMovement?.id === shipAtHex.id || 
                                        deploymentRotationShip?.id === shipAtHex.id;
                  
                  if (!isSelectedShip) return;
                  
                  if (gamePhase === 'playing' && showActionPointUI) {
                    // Store original orientation when starting drag
                    setOriginalOrientation(shipAtHex.orientation || 0);
                    setDragStartRotation(normalizeRotation(shipAtHex.rotation || 0));
                    setIsDraggingRotation(true);
                  } else if (gamePhase === 'deployment') {
                    // During deployment, rotation is free
                    setDragStartRotation(normalizeRotation(shipAtHex.rotation || 0));
                    setIsDraggingRotation(true);
                  }
                }}>
                <Image
                  source={getShipImage(shipAtHex.type, shipAtHex.color)}
                  style={[
                    styles.shipImage,
                    {
                      width: hexRadius * 1.4,
                      height: hexRadius * 1.4,
                      marginTop: -(hexRadius * 0.7),
                      marginLeft: -(hexRadius * 0.7),
                      // Use stored rotation if available, otherwise calculate from orientation
                      transform: [{ 
                        rotate: shipAtHex.type === 'mothership' 
                          ? '0deg' 
                          : `${shipAtHex.rotation ?? normalizeRotation(shipAtHex.orientation || 0)}deg` 
                      }]
                    }
                  ]}
                  resizeMode="contain"
                  pointerEvents="none"
                />
              </View>
            )}
          </View>
        </TouchableOpacity>
        
      </View>
    );
  };

  // Handle mouse/touch move globally
  const handleRotationMove = (clientX: number, clientY: number, locationX?: number, locationY?: number) => {
    if (!isDraggingRotation || !selectedShipForMovement && !deploymentRotationShip) return;
    
    const activeShip = selectedShipForMovement || deploymentRotationShip;
    if (!activeShip) return;
    
    // Find the hex where the ship is
    const shipHex = boardHexes.find(h => 
      h.col === activeShip.position.col && h.row === activeShip.position.row
    );
    if (!shipHex) return;
    
    // For React Native touch events, use locationX/Y which are relative to the container
    // For web mouse events, we need to calculate relative position
    let relativeX: number, relativeY: number;
    
    if (locationX !== undefined && locationY !== undefined) {
      // React Native touch event - coordinates are already relative to container
      relativeX = locationX;
      relativeY = locationY;
    } else {
      // Web mouse event - need to get position relative to container
      // Since shipHex.x and shipHex.y are already relative to container, we can use client coordinates
      // and adjust based on the hex's screen position
      relativeX = clientX;
      relativeY = clientY;
    }
    
    // Calculate angle from ship center to touch/mouse point
    const angle = Math.atan2(relativeY - shipHex.y, relativeX - shipHex.x);
    // Convert to degrees (0° is pointing right, we want 0° to be pointing up)
    const degrees = (angle * 180 / Math.PI + 90 + 360) % 360;
    
    // Now we need to map degrees to orientation values
    // Degrees: 0°=up, 60°=up-right, 120°=down-right, 180°=down, 240°=down-left, 300°=up-left
    // Orientation: 5=NE(0°), 0=E(60°), 1=SE(120°), 2=SW(180°), 3=W(240°), 4=NW(300°)
    
    // First snap to nearest 60° increment
    const snappedDegrees = Math.round(degrees / 60) * 60 % 360;
    
    // Map snapped degrees to orientation
    // Since 0° means sprite points up (north), we need to find which orientation that corresponds to
    // Looking at our mapping: NE=45°, E=90°, SE=135°, SW=225°, W=270°, NW=315°
    // So 0° doesn't directly map to any orientation - it's between NW (315°) and NE (45°)
    // We'll use the closest orientation
    let newRotation: number = snappedDegrees;
    
    if (gamePhase === 'playing' && originalRotation !== null) {
      // Calculate AP cost for this rotation
      const apCost = calculateRotationAPCost(originalRotation, newRotation);
      
      // Check if we have enough AP
      if (apCost <= currentAP) {
        setPreviewRotation(newRotation);
        setRotationAPCost(apCost);
        
        // Update ship preview rotation
        setShips(prevShips => 
          prevShips.map(s => {
            if (s.id === activeShip.id) {
              return { ...s, rotation: newRotation };
            }
            return s;
          })
        );
        
        // Update valid moves based on new orientation
        const updatedShip = { ...activeShip, rotation: newRotation };
        const moves = calculateAPValidMoves(updatedShip, currentAP - apCost);
        setValidMoveTargets(moves);
      }
    } else if (gamePhase === 'deployment') {
      // Free rotation during deployment
      setShips(prevShips => 
        prevShips.map(s => {
          if (s.id === activeShip.id) {
            return { 
              ...s, 
              rotation: newRotation, 
              rotation: newRotation 
            };
          }
          return s;
        })
      );
      
      if (deploymentRotationShip) {
        setDeploymentRotationShip({
          ...deploymentRotationShip,
          rotation: newRotation,
          rotation: newRotation
        });
      }
    }
  };
  
  // Handle mouse/touch release globally
  const handleRotationEnd = () => {
    if (!isDraggingRotation) return;
    
    const activeShip = selectedShipForMovement || deploymentRotationShip;
    if (!activeShip) return;
    
    // Set a flag to prevent immediate click handling
    setIsProcessingClick(true);
    setTimeout(() => setIsProcessingClick(false), 500);
    
    if (gamePhase === 'playing' && previewRotation !== null && originalRotation !== null) {
      // Apply the rotation and consume AP
      const apCost = calculateRotationAPCost(originalRotation, previewRotation);
      
      // Send rotation update to server
      const room = (window as any).currentRoom;
      if (room) {
        room.send("updateShipOrientation", {
          shipId: activeShip.id,
          rotation: previewRotation
        });
      }
      
      setShips(prevShips => 
        prevShips.map(s => {
          if (s.id === activeShip.id) {
            return { 
              ...s, 
              rotation: previewRotation
            };
          }
          return s;
        })
      );
      
      const remainingAP = currentAP - apCost;
      setCurrentAP(remainingAP);
      setHasUsedAP(true); // Mark AP as used after rotation
      window.shipThatUsedAP = selectedShipForMovement?.id;
      setShipRotation(previewRotation);
      
      // Update selected ship's rotation and recalculate valid moves
      if (selectedShipForMovement) {
        const updatedShip = {
          ...selectedShipForMovement,
          rotation: previewRotation
        };
        setSelectedShipForMovement(updatedShip);
        
        // Recalculate valid moves with the new rotation
        const moves = calculateAPValidMoves(updatedShip, remainingAP);
        setValidMoveTargets(moves);
      }
      
      // Check if out of AP after rotation
      if (remainingAP <= 0) {
        // No AP left, clear selection and end turn
        setSelectedShipForMovement(null);
        setShowActionPointUI(false);
        setValidMoveTargets([]);
        setHasUsedAP(false); // Reset for next turn
        
        // Send endTurn message to server
        const room = (window as any).currentRoom;
        if (room) {
          // No AP remaining after rotation, ending turn
          room.send("endTurn");
        }
      }
    } else if (gamePhase === 'deployment' && deploymentRotationShip) {
      // During deployment, send the updated orientation to the server
      const room = (window as any).currentRoom;
      if (room) {
        // Find the final orientation of the ship
        const finalShip = ships.find(s => s.id === deploymentRotationShip.id);
        if (finalShip) {
          room.send("updateShipOrientation", {
            shipId: deploymentRotationShip.id,
            orientation: finalShip.orientation,
            rotation: finalShip.rotation
          });
          logger.info('HEX_BOARD', 'Sent orientation update to server', {
            shipId: deploymentRotationShip.id,
            orientation: finalShip.orientation
          });
        }
      }
    }
    
    // Reset drag state
    setIsDraggingRotation(false);
    setDragStartRotation(null);
    setPreviewRotation(null);
    setRotationAPCost(0);
    
    // Clear deployment rotation ship to prevent accidental undeploy
    if (gamePhase === 'deployment') {
      setDeploymentRotationShip(null);
    }
  };

  return (
    <View 
      style={[styles.container, style]}
      ref={containerRef}
      onMouseMove={(e: any) => {
        if (isDraggingRotation) {
          // For web, use locationX/Y which are relative to the target element
          handleRotationMove(e.nativeEvent.clientX, e.nativeEvent.clientY, e.nativeEvent.locationX, e.nativeEvent.locationY);
        }
      }}
      onMouseUp={handleRotationEnd}
      onMouseLeave={handleRotationEnd}
      onTouchMove={(e: any) => {
        if (isDraggingRotation && e.nativeEvent.touches.length > 0) {
          const touch = e.nativeEvent.touches[0];
          // For touch, use locationX/Y which are relative to the target element
          handleRotationMove(touch.clientX, touch.clientY, touch.locationX, touch.locationY);
        }
      }}
      onTouchEnd={handleRotationEnd}
      onTouchCancel={handleRotationEnd}>
      
      
      {/* Enemy Ship Info UI */}
      {viewingEnemyShip && (
        <>
          {/* Invisible overlay to capture outside clicks */}
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
            activeOpacity={1}
            onPress={() => setViewingEnemyShip(null)}
          />
          
          {/* The actual popup */}
          <View style={{ 
            position: 'absolute', 
            top: 100, 
            left: '50%',
            transform: [{ translateX: -150 }],
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            padding: 16,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: '#ff6b35',
            minWidth: 300,
            zIndex: 1000,
            pointerEvents: 'auto'
          }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#ff6b35', fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
                Enemy {viewingEnemyShip.type.charAt(0).toUpperCase() + viewingEnemyShip.type.slice(1)}
              </Text>
              <Text style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>
                Owner: {(() => {
                  const room = (window as any).currentRoom;
                  if (room && room.state && room.state.players) {
                    const player = room.state.players.get(viewingEnemyShip.owner);
                    return player?.name || 'Unknown';
                  }
                  return 'Unknown';
                })()}
              </Text>
              <Text style={{ color: '#4ECDC4', fontSize: 16, fontWeight: 'bold', marginTop: 8 }}>
                Max AP: {SHIP_ACTION_POINTS[viewingEnemyShip.type]?.maxActionPoints || 0}
              </Text>
              <Text style={{ color: '#aaa', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                Movement Cost: {SHIP_ACTION_POINTS[viewingEnemyShip.type]?.movementCost || 1} AP/hex
              </Text>
              <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                Rotation Cost: {SHIP_ACTION_POINTS[viewingEnemyShip.type]?.rotationCost || 1} AP/60°
              </Text>
              {SHIP_ACTION_POINTS[viewingEnemyShip.type]?.isOmnidirectional && (
                <Text style={{ color: '#ffaa00', fontSize: 12, marginTop: 8, fontStyle: 'italic' }}>
                  Omnidirectional Movement
                </Text>
              )}
            </View>
          </View>
        </>
      )}
      
      {/* Action Point UI */}
      {showActionPointUI && selectedShipForMovement && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000, pointerEvents: 'box-none' }}>
          {/* AP Display - positioned above game controls */}
          <View style={{
            position: 'absolute',
            bottom: 80, // Position above the game controls bar
            left: '50%',
            transform: [{ translateX: -150 }], // Center horizontally
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            padding: 12,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#4299E1',
            minWidth: 300,
            alignItems: 'center',
          }}>
            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
              AP: {currentAP - rotationAPCost} / {maxAP}
              {rotationAPCost > 0 && (
                <Text style={{ color: '#ff6b35' }}> (-{rotationAPCost} rotation)</Text>
              )}
            </Text>
            <Text style={{ color: '#4299E1', fontSize: 14 }}>
              {selectedShipForMovement.type.toUpperCase()}
            </Text>
            {/* Show timer for AI games */}
            {(window as any).gameType === 'ai' && !isAITurn && (
              <View style={{ marginTop: 5, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: '#00ff88', fontSize: 14, fontWeight: 'bold' }}>
                  Turn Timer Active
                </Text>
              </View>
            )}
            <Text style={{ color: '#aaa', fontSize: 12, marginTop: 5 }}>
              {SHIP_ACTION_POINTS[selectedShipForMovement.type]?.isOmnidirectional 
                ? 'Click any adjacent hex to move'
                : isDraggingRotation 
                  ? 'Drag to rotate ship' 
                  : 'Hold & drag ship to rotate • Click hex to move'}
            </Text>
            {currentAP > 0 && (
              <TouchableOpacity
                style={{
                  backgroundColor: '#ff6b35',
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 5,
                  marginTop: 10,
                  alignItems: 'center',
                  minWidth: 120
                }}
                onPress={() => {
                  // End turn manually
                  setSelectedShipForMovement(null);
                  setShowActionPointUI(false);
                  setValidMoveTargets([]);
                  setCurrentAP(0);
                  setHasUsedAP(false); // Reset for next turn
                  window.shipThatUsedAP = null;
                  setViewingEnemyShip(null);
                  
                  const room = (window as any).currentRoom;
                  const gameType = (window as any).gameType;
                  
                  if (gameType === 'ai') {
                    // For AI games, handle turn switching locally
                    // Human player ended turn in AI game
                    const humanPlayer = players.find(p => !p.isAI);
                    const aiPlayer = players.find(p => p.isAI);
                    
                    if (humanPlayer && aiPlayer) {
                      // Switch to AI turn
                      (window as any).currentTurn = aiPlayer.id;
                      setIsAITurn(true);
                      setHasUsedAP(false);
                      setSelectedShipForMovement(null);
                      
                      // Reset all ships' AP for the new turn
                      const updatedShips = ships.map(ship => ({
                        ...ship,
                        currentAP: SHIP_ACTION_POINTS[ship.type] || 0
                      }));
                      setShips(updatedShips);
                    }
                  } else if (room) {
                    // Player ended turn manually
                    room.send("endTurn");
                  }
                }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold' }}>End Turn</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      
      {/* Deployment Helper Text */}
      {gamePhase === 'deployment' && deploymentRotationShip && (
        <View style={{ 
          position: 'absolute', 
          bottom: 100, 
          left: 0, 
          right: 0, 
          zIndex: 1000,
          alignItems: 'center',
          pointerEvents: 'none'
        }}>
          <View style={{
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 10,
            borderRadius: 5,
          }}>
            <Text style={{ color: 'white', fontSize: 14 }}>
              {deploymentRotationShip.type === 'mothership' 
                ? 'Command Ship deployed (omnidirectional)'
                : 'Drag to rotate • Click elsewhere to confirm'}
            </Text>
          </View>
        </View>
      )}
      
      <ScrollView 
        style={[styles.scrollContainer, { height: availableHeight }]}
        contentContainerStyle={{
          width: Math.max(screenDimensions.width, boardDimensions.width + 10),
          height: Math.max(availableHeight, boardDimensions.height + 10),
          justifyContent: 'center',
          alignItems: 'center',
        }}
        minimumZoomScale={0.5}
        maximumZoomScale={2.0}
        showsHorizontalScrollIndicator={!boardDimensions.fitsHorizontally}
        showsVerticalScrollIndicator={!boardDimensions.fitsVertically}
        scrollEnabled={!boardDimensions.fitsVertically || !boardDimensions.fitsHorizontally}
      >
        <View style={[styles.board, { 
          width: Math.max(screenDimensions.width, boardDimensions.width + 10), 
          height: Math.max(availableHeight, boardDimensions.height + 10),
          justifyContent: 'center',
          alignItems: 'center',
        }]}>
          {boardHexes.length > 0 && boardHexes.map(hex => renderHex(hex))}
          
          {/* Render animated ships above all hexes */}
          {Array.from(animatingShips.entries()).map(([shipId, animation]) => {
            const ship = ships.find(s => s.id === shipId);
            if (!ship) {
              return null;
            }
            
            // Safety check for animation data
            if (!animation || !animation.fromPos || !animation.toPos || 
                animation.fromPos.x === undefined || animation.fromPos.y === undefined ||
                animation.toPos.x === undefined || animation.toPos.y === undefined) {
              logger.warn('Invalid animation data for ship:', shipId);
              logger.warn('Animation:', animation);
              return null;
            }
            
            // Additional validation
            if (animation.fromPos.x === 0 && animation.fromPos.y === 0) {
              logger.error('Animation starting at 0,0 - invalid coordinates!');
              logger.error('Ship:', shipId, 'Animation:', animation);
            }
            
            // Calculate interpolated position and rotation
            let currentX = animation.fromPos.x;
            let currentY = animation.fromPos.y;
            let currentRotation = animation.fromRotation || 0;
            
            if (animation.progress <= 0.3) {
              // Rotation phase (0-30%)
              const rotProgress = animation.progress / 0.3;
              
              // Calculate shortest rotation path
              let rotDiff = animation.toRotation - animation.fromRotation;
              // Normalize to [-180, 180] for shortest path
              if (rotDiff > 180) rotDiff -= 360;
              if (rotDiff < -180) rotDiff += 360;
              
              currentRotation = animation.fromRotation + rotDiff * rotProgress;
            } else {
              // Movement phase (30-100%)
              const moveProgress = (animation.progress - 0.3) / 0.7;
              currentX = animation.fromPos.x + 
                (animation.toPos.x - animation.fromPos.x) * moveProgress;
              currentY = animation.fromPos.y + 
                (animation.toPos.y - animation.fromPos.y) * moveProgress;
              currentRotation = animation.toRotation;
            }
            
            return (
              <View 
                key={shipId} 
                style={{
                  position: 'absolute',
                  left: currentX - hexRadius * 0.7,
                  top: currentY - hexRadius * 0.7,
                  zIndex: 1000,
                  elevation: 10,
                  pointerEvents: 'none'
                }}
              >
                <Image
                  source={getShipImage(ship.type, ship.color)}
                  style={{
                    width: hexRadius * 1.4,
                    height: hexRadius * 1.4,
                    transform: [{ 
                      rotate: ship.type === 'mothership' ? '0deg' : `${currentRotation}deg` 
                    }]
                  }}
                  resizeMode="contain"
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
      
      {/* Dice Roll Results Overlay */}
      {showDiceResults && diceRolls.length > 0 && (
        <View style={styles.diceOverlay}>
          <View style={styles.diceContainer}>
            <Text style={styles.diceTitle}>
              {isTieReroll ? 'Tie! Re-rolling...' : 'Zone Selection Dice Roll'}
            </Text>
            {diceRolls.map((roll, index) => {
              const room = (window as any).currentRoom;
              const isYou = room && roll.playerId === room.sessionId;
              return (
                <View key={roll.playerId} style={styles.diceResult}>
                  <Text style={[styles.dicePlayerName, isYou && styles.yourDiceResult]}>
                    {roll.playerName} {isYou && '(You)'}
                  </Text>
                  <Text style={styles.diceRoll}>🎲 {roll.roll}</Text>
                </View>
              );
            })}
            {!isTieReroll && diceRolls.length > 0 && (
              <Text style={styles.winnerText}>
                {(() => {
                  const room = (window as any).currentRoom;
                  const winner = diceRolls[0]; // Already sorted by server
                  const isYouWinner = room && winner.playerId === room.sessionId;
                  return isYouWinner 
                    ? '✨ You won! Choose your deployment zone.' 
                    : `${winner.playerName} won and will choose first.`;
                })()}
              </Text>
            )}
            {isTieReroll && (
              <Text style={styles.tieMessage}>Re-rolling in 2 seconds...</Text>
            )}
          </View>
        </View>
      )}
      
      {/* Zone Selection Overlay */}
      {gamePhase === 'deployment' && zoneSelectionPhase === 'selecting' && currentPlayerSelectingZone && (
        <View style={styles.zoneSelectionOverlay}>
          <View style={styles.zoneSelectionContainer}>
            {(() => {
              const room = (window as any).currentRoom;
              const isMultiplayer = !!room;
              const currentPlayerId = room?.sessionId;
              const isMyTurn = !isMultiplayer || currentPlayerId === currentPlayerSelectingZone;
              const selectingPlayer = players.find(p => p.id === currentPlayerSelectingZone);
              
              return (
                <>
                  <Text style={styles.zoneSelectionTitle}>
                    {isMyTurn 
                      ? 'Select Your Deployment Zone' 
                      : `${selectingPlayer?.name || 'Opponent'} is Selecting Zone`}
                  </Text>
                  <Text style={styles.zoneSelectionSubtitle}>
                    {isMyTurn 
                      ? 'Tap one of the highlighted zones on the board'
                      : 'Please wait...'}
                  </Text>
                  {isMultiplayer && !isMyTurn && (
                    <Text style={styles.zoneSelectionInfo}>
                      You will get the opposite zone automatically
                    </Text>
                  )}
                </>
              );
            })()}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    width: '100%',
  },

  scrollContainer: {
    backgroundColor: '#0a0a0a',
  },

  board: {
    position: 'relative',
    backgroundColor: '#0a0a0a',
  },

  hexContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },

  hexLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  shipImage: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    zIndex: 2, // Above debris
  },

  hazardLabel: {
    fontSize: 16,
    textAlign: 'center',
    position: 'absolute',
    top: '30%',
    left: '50%',
    marginLeft: -8,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  hazardImage: {
    position: 'absolute',
    top: '50%',
    left: '50%',
  },


  debrisUnderShip: {
    position: 'absolute',
    alignSelf: 'center',
    opacity: 0.7, // Make it slightly transparent when under a ship
    zIndex: 1, // Behind the ship
  },

  diceOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },

  diceContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#4ECDC4',
    minWidth: 200,
  },

  diceTitle: {
    color: '#4ECDC4',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },

  diceResult: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
  },

  dicePlayerName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  
  yourDiceResult: {
    color: '#00ff88',
    fontWeight: 'bold',
  },
  
  winnerText: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },

  diceRoll: {
    color: '#4ECDC4',
    fontSize: 20,
    fontWeight: 'bold',
  },
  
  zoneSelectionOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  
  zoneSelectionContainer: {
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4ECDC4',
    alignItems: 'center',
    marginHorizontal: 20,
  },
  
  zoneSelectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 8,
    textAlign: 'center',
  },
  
  zoneSelectionSubtitle: {
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
  },
  
  zoneSelectionInfo: {
    fontSize: 12,
    color: '#aaaaaa',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  
  tieMessage: {
    fontSize: 14,
    color: '#FFA500',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
});