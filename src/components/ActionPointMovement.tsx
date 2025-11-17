import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Dimensions
} from 'react-native';
import Svg, { Polygon, Circle, Line, Text as SvgText } from 'react-native-svg';
import {
  SHIP_ACTION_POINTS,
  PlannedAction,
  canPerformActions,
  calculateRotationCost,
  calculateRotationSteps,
  getForwardHex,
  getAdjacentHexes
} from '../config/actionPointConfig';

interface Ship {
  id: string;
  type: string;
  color: string;
  position: { col: string; row: number; q: number; r: number };
  rotation: number;
}

interface HexCoordinate {
  col: string;
  row: number;
  q: number;
  r: number;
  x: number;
  y: number;
}

interface ActionPointMovementProps {
  ship: Ship | null;
  boardHexes: HexCoordinate[];
  ships: Ship[];
  onConfirmMove: (ship: Ship, actions: PlannedAction[]) => void;
  onCancel: () => void;
  hexRadius: number;
  isDeploymentPhase?: boolean;
}

export const ActionPointMovement: React.FC<ActionPointMovementProps> = ({
  ship,
  boardHexes,
  ships,
  onConfirmMove,
  onCancel,
  hexRadius,
  isDeploymentPhase = false
}) => {
  const [plannedActions, setPlannedActions] = useState<PlannedAction[]>([]);
  const [currentPosition, setCurrentPosition] = useState<HexCoordinate | null>(null);
  const [currentRotation, setCurrentRotation] = useState<number>(0);
  const [previewPath, setPreviewPath] = useState<HexCoordinate[]>([]);
  const [remainingAP, setRemainingAP] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [validMoves, setValidMoves] = useState<HexCoordinate[]>([]);
  const screenDimensions = Dimensions.get('window');

  useEffect(() => {
    if (!ship) return;
    
    // Initialize position and rotation
    const startHex = boardHexes.find(h => h.col === ship.position.col && h.row === ship.position.row);
    if (startHex) {
      setCurrentPosition(startHex);
      setCurrentRotation(ship.rotation || 0);
      
      const config = SHIP_ACTION_POINTS[ship.type];
      if (config) {
        setRemainingAP(config.maxActionPoints);
      }
    }
  }, [ship, boardHexes]);
  
  // Update valid moves when position or rotation changes
  useEffect(() => {
    if (currentPosition && ship) {
      const moves = getValidMoveTargets();
      setValidMoves(moves);
    }
  }, [currentPosition, currentRotation, remainingAP]);

  // Get valid move targets based on current state
  const getValidMoveTargets = (): HexCoordinate[] => {
    if (!currentPosition || !ship) return [];
    
    const config = SHIP_ACTION_POINTS[ship.type];
    if (!config) return [];
    
    const validTargets: HexCoordinate[] = [];
    
    if (config.isOmnidirectional) {
      // Mothership can move to any adjacent hex
      const adjacent = getAdjacentHexes(currentPosition.q, currentPosition.r);
      adjacent.forEach(adj => {
        const hex = boardHexes.find(h => h.q === adj.q && h.r === adj.r);
        if (hex && remainingAP >= config.movementCost) {
          // Check if hex is not occupied by another ship
          const occupied = ships.some(s => 
            s.id !== ship.id && s.position.col === hex.col && s.position.row === hex.row
          );
          if (!occupied) {
            validTargets.push(hex);
          }
        }
      });
    } else {
      // Regular ships can only move forward
      if (remainingAP >= config.movementCost) {
        const forward = getForwardHex(currentPosition.q, currentPosition.r, currentRotation);
        const hex = boardHexes.find(h => h.q === forward.q && h.r === forward.r);
        if (hex) {
          // Check if hex is not occupied by friendly ship
          const occupied = ships.some(s => 
            s.id !== ship.id && 
            s.color === ship.color &&
            s.position.col === hex.col && 
            s.position.row === hex.row
          );
          if (!occupied) {
            validTargets.push(hex);
          }
        }
      }
    }
    
    return validTargets;
  };

  // Handle rotation
  const handleRotate = (direction: 'left' | 'right') => {
    if (!ship || remainingAP < 1) return;
    
    const config = SHIP_ACTION_POINTS[ship.type];
    if (!config || config.isOmnidirectional) return; // Mothership doesn't rotate
    
    const newRotation = direction === 'left' 
      ? (currentRotation - 60 + 360) % 360 
      : (currentRotation + 60) % 360;
    
    const action: PlannedAction = {
      type: 'rotate',
      cost: config.rotationCost,
      fromRotation: currentRotation,
      toRotation: newRotation
    };
    
    setPlannedActions([...plannedActions, action]);
    setCurrentRotation(newRotation);
    setRemainingAP(remainingAP - config.rotationCost);
  };

  // Handle movement to hex
  const handleMoveToHex = (targetHex: HexCoordinate) => {
    if (!ship || !currentPosition) return;
    
    const config = SHIP_ACTION_POINTS[ship.type];
    if (!config) return;
    
    // Check if this is a valid move
    const validMoves = getValidMoveTargets();
    const isValid = validMoves.some(h => h.col === targetHex.col && h.row === targetHex.row);
    
    if (!isValid) return;
    
    const action: PlannedAction = {
      type: 'move',
      cost: config.movementCost,
      fromHex: { col: currentPosition.col, row: currentPosition.row },
      toHex: { col: targetHex.col, row: targetHex.row }
    };
    
    setPlannedActions([...plannedActions, action]);
    setCurrentPosition(targetHex);
    setRemainingAP(remainingAP - config.movementCost);
    setPreviewPath([...previewPath, targetHex]);
  };

  // Undo last action
  const handleUndo = () => {
    if (plannedActions.length === 0) return;
    
    const lastAction = plannedActions[plannedActions.length - 1];
    const newActions = plannedActions.slice(0, -1);
    
    // Revert the action
    if (lastAction.type === 'rotate') {
      setCurrentRotation(lastAction.fromRotation!);
    } else if (lastAction.type === 'move') {
      // Find the previous position
      const prevHex = boardHexes.find(h => 
        h.col === lastAction.fromHex!.col && h.row === lastAction.fromHex!.row
      );
      if (prevHex) {
        setCurrentPosition(prevHex);
        setPreviewPath(previewPath.slice(0, -1));
      }
    }
    
    setRemainingAP(remainingAP + lastAction.cost);
    setPlannedActions(newActions);
  };

  // Confirm all actions
  const handleConfirm = () => {
    if (!ship || plannedActions.length === 0) {
      Alert.alert('No Actions', 'Plan at least one action before confirming.');
      return;
    }
    
    onConfirmMove(ship, plannedActions);
  };

  // For deployment phase - handle rotation by touch/drag
  const handleDeploymentRotation = (touchX: number, touchY: number) => {
    if (!ship || !currentPosition || !isDeploymentPhase) return;
    
    // Calculate angle from ship center to touch point
    const shipX = currentPosition.x;
    const shipY = currentPosition.y;
    const angle = Math.atan2(touchY - shipY, touchX - shipX);
    const degrees = (angle * 180 / Math.PI + 90 + 360) % 360;
    
    // Snap to nearest 60° increment (hex sides)
    // Set rotation directly in degrees (0°=North)
    setCurrentRotation((degrees + 360) % 360);
  };

  // Get hex polygon points
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

  // No conversion needed - we're using rotation directly

  if (!ship || !currentPosition) return null;

  const validMoves = getValidMoveTargets();
  const config = SHIP_ACTION_POINTS[ship.type];

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Action Point Display */}
      <View style={styles.apDisplay}>
        <Text style={styles.apText}>
          Action Points: {remainingAP} / {config?.maxActionPoints || 0}
        </Text>
        <Text style={styles.shipType}>{ship.type.toUpperCase()}</Text>
      </View>
      
      {/* Show valid move indicators */}
      {validMoves.map(hex => (
        <View
          key={`valid-${hex.col}-${hex.row}`}
          style={{
            position: 'absolute',
            left: hex.x - 10,
            top: hex.y - 10,
            width: 20,
            height: 20,
            backgroundColor: 'rgba(72, 187, 120, 0.5)',
            borderRadius: 10,
            pointerEvents: 'none'
          }}
        />
      ))}

      {/* Control Buttons */}
      <View style={styles.controls}>
        {!isDeploymentPhase && !config?.isOmnidirectional && (
          <>
            <TouchableOpacity
              style={[styles.button, remainingAP < 1 && styles.buttonDisabled]}
              onPress={() => handleRotate('left')}
              disabled={remainingAP < 1}
            >
              <Text style={styles.buttonText}>↺ Rotate Left</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, remainingAP < 1 && styles.buttonDisabled]}
              onPress={() => handleRotate('right')}
              disabled={remainingAP < 1}
            >
              <Text style={styles.buttonText}>Rotate Right ↻</Text>
            </TouchableOpacity>
          </>
        )}
        
        {plannedActions.length > 0 && (
          <TouchableOpacity style={styles.button} onPress={handleUndo}>
            <Text style={styles.buttonText}>↶ Undo</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.button, styles.confirmButton]}
          onPress={handleConfirm}
          disabled={plannedActions.length === 0 && !isDeploymentPhase}
        >
          <Text style={styles.buttonText}>✓ Confirm</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
          <Text style={styles.buttonText}>✗ Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Movement Preview Path */}
      {previewPath.length > 0 && (
        <Svg
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          {previewPath.map((hex, index) => {
            if (index === 0) return null;
            const prevHex = index === 0 ? currentPosition : previewPath[index - 1];
            return (
              <Line
                key={`path-${index}`}
                x1={prevHex.x}
                y1={prevHex.y}
                x2={hex.x}
                y2={hex.y}
                stroke="#48BB78"
                strokeWidth="3"
                strokeDasharray="5,5"
              />
            );
          })}
        </Svg>
      )}

      {/* Instructions */}
      {isDeploymentPhase ? (
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            Touch and drag around the ship to set its rotation direction
          </Text>
        </View>
      ) : (
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            {config?.isOmnidirectional 
              ? 'Click any adjacent hex to move (1 AP per move)'
              : 'Rotate to face direction (1 AP) then move forward (1 AP)'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  apDisplay: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 10,
    borderRadius: 5,
  },
  apText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shipType: {
    color: '#4299E1',
    fontSize: 14,
    marginTop: 5,
  },
  controls: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#4A5568',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 5,
    margin: 5,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  confirmButton: {
    backgroundColor: '#48BB78',
  },
  cancelButton: {
    backgroundColor: '#F56565',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  instructions: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionText: {
    color: 'white',
    fontSize: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 5,
  },
});