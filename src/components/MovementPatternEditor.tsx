import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Image,
  Alert
} from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { SHIP_MOVEMENT_PATTERNS, MovementPattern } from '../config/shipMovementPatterns';

// Ship images
const SHIP_IMAGES = {
  BLUE_SCOUT: require('../assets/ships/Blue Scout.png'),
  BLUE_INTERCEPTOR: require('../assets/ships/Blue Interceptor.png'),
  BLUE_CORVETTE: require('../assets/ships/Blue Corvette.png'),
  BLUE_DESTROYER: require('../assets/ships/Blue Destroyer.png'),
  BLUE_FLEET_ADMIRAL: require('../assets/ships/Blue Cruiser.png'),
  BLUE_CAPTAIN: require('../assets/ships/Blue Battleship.png'),
};

interface HexCoordinate {
  col: string;
  row: number;
  q: number;
  r: number;
  x: number;
  y: number;
}

interface Ship {
  id: string;
  type: string;
  position: HexCoordinate;
  rotation: number;
}

interface MovementHex {
  hex: HexCoordinate;
  direction: number; // 0-5 representing the 6 directions
  distance: number;
  movementType: 'forward' | 'forwardSide' | 'side' | 'backSide' | 'backward';
}

export const MovementPatternEditor: React.FC = () => {
  const [mode, setMode] = useState<'edit' | 'test'>('edit');
  const [selectedShipType, setSelectedShipType] = useState<string | null>(null);
  const [selectedMoves, setSelectedMoves] = useState<MovementHex[]>([]);
  const [testShip, setTestShip] = useState<Ship | null>(null);
  const [customPatterns, setCustomPatterns] = useState<Record<string, MovementPattern>>({...SHIP_MOVEMENT_PATTERNS});
  const [screenDimensions, setScreenDimensions] = useState(Dimensions.get('window'));
  const [validMoveTargets, setValidMoveTargets] = useState<HexCoordinate[]>([]);
  const [isMoving, setIsMoving] = useState(false);
  
  // Load patterns from server on mount
  useEffect(() => {
    loadPatternsFromServer();
  }, []);
  
  // Load patterns from server
  const loadPatternsFromServer = async () => {
    try {
      const response = await fetch('http://localhost:2567/admin/movement-patterns');
      if (response.ok) {
        const patterns = await response.json();
        setCustomPatterns(patterns);
        console.log('Loaded patterns from server:', patterns);
      }
    } catch (error) {
      console.error('Error loading patterns from server:', error);
    }
  };
  
  // Ship types available for editing
  const shipTypes = ['scout', 'interceptor', 'corvette', 'frigate', 'destroyer', 'cruiser'];
  
  // Calculate hex dimensions - match game board
  const availableWidth = screenDimensions.width - 20;
  const availableHeight = screenDimensions.height - 200; // Account for UI elements
  
  // Scale hex size to fit board
  const boardRequiredWidth = 11 * 1.5; 
  const boardRequiredHeight = 11 * Math.sqrt(3) * 0.85;
  
  const widthScale = availableWidth / boardRequiredWidth;
  const heightScale = availableHeight / boardRequiredHeight;
  
  const baseHexRadius = Math.min(widthScale, heightScale) * 0.9;
  const maxHexRadius = 40;
  const hexRadius = Math.max(Math.min(baseHexRadius, maxHexRadius), 20);
  
  const HEX_WIDTH = hexRadius * 2;
  const HEX_HEIGHT = hexRadius * Math.sqrt(3);
  const HEX_HORIZONTAL_SPACING = HEX_WIDTH * 0.75;
  const HEX_VERTICAL_SPACING = HEX_HEIGHT;
  
  // Generate the same 91-hex hexagonal board as the game
  const boardHexes = useMemo(() => {
    const hexes: HexCoordinate[] = [];
    
    // EXACT same generation as HexGameBoard.tsx
    const BOARD_RADIUS = 5; // Creates a hexagon with 91 hexes
    
    for (let q = -BOARD_RADIUS; q <= BOARD_RADIUS; q++) {
      const r1 = Math.max(-BOARD_RADIUS, -q - BOARD_RADIUS);
      const r2 = Math.min(BOARD_RADIUS, -q + BOARD_RADIUS);
      
      for (let r = r1; r <= r2; r++) {
        // Convert to screen coordinates (proper hexagon layout)
        const x = hexRadius * (3/2 * q);
        const y = hexRadius * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
        
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
      }
    }
    
    // Calculate board bounds for centering
    const minX = Math.min(...hexes.map(h => h.x));
    const maxX = Math.max(...hexes.map(h => h.x));
    const minY = Math.min(...hexes.map(h => h.y));
    const maxY = Math.max(...hexes.map(h => h.y));
    
    // Center the board
    const boardCenterX = screenDimensions.width / 2;
    const centerOffsetX = boardCenterX - (minX + maxX) / 2;
    const centerOffsetY = 100 - minY; // Offset from top
    
    // Apply centering offset to all hexes
    hexes.forEach(hex => {
      hex.x += centerOffsetX;
      hex.y += centerOffsetY;
    });
    
    return hexes;
  }, [screenDimensions, hexRadius]);
  
  // Get center hex (f6 is the center of the board)
  const centerHex = useMemo(() => {
    return boardHexes.find(h => h.col === 'f' && h.row === 6) || boardHexes[0];
  }, [boardHexes]);
  
  // Handle ship type selection
  const selectShipType = (type: string) => {
    setSelectedShipType(type);
    setSelectedMoves([]);
    setValidMoveTargets([]);
    
    const ship: Ship = {
      id: `${type}_editor`,
      type,
      position: centerHex,
      rotation: 0,
      orientation: 5 // Face north
    };
    setTestShip(ship);
    
    if (mode === 'edit') {
      // Load existing pattern for editing
      loadExistingPattern(type);
    } else {
      // In test mode, calculate valid moves immediately
      calculateValidMovesForShip(ship);
    }
  };
  
  // Load existing movement pattern
  const loadExistingPattern = (shipType: string) => {
    const pattern = customPatterns[shipType];
    if (!pattern) return;
    
    const moves: MovementHex[] = [];
    
    // Convert pattern to hex selections
    // Ship faces north (orientation = 5)
    const shipOrientation = 5; // North
    
    // For each direction (0-5)
    for (let direction = 0; direction < 6; direction++) {
      // Calculate relative direction from ship's orientation
      const relativeDir = (direction - shipOrientation + 6) % 6;
      
      // Determine movement type and max distance
      let movementType: MovementHex['movementType'];
      let maxDistance = 0;
      
      if (relativeDir === 0) {
        movementType = 'forward';
        maxDistance = pattern.forward;
      } else if (relativeDir === 1 || relativeDir === 5) {
        movementType = 'forwardSide';
        maxDistance = pattern.forwardSide;
      } else if (relativeDir === 2 || relativeDir === 4) {
        movementType = 'side';
        maxDistance = pattern.side;
      } else if (relativeDir === 3) {
        movementType = 'backward';
        maxDistance = pattern.backward;
      } else {
        continue;
      }
      
      // Add hexes for this direction - MATCH VISUAL DIRECTIONS
      // Must match HexGameBoard.tsx directions array
      const directions = [
        { q: 1, r: -1 },  // 0: NE (60°) 
        { q: 1, r: 0 },   // 1: E/SE (120°)
        { q: 0, r: 1 },   // 2: S (180°)
        { q: -1, r: 1 },  // 3: SW (240°)
        { q: -1, r: 0 },  // 4: W/NW (300°)
        { q: 0, r: -1 }   // 5: N (0°) - forward when orientation north
      ];
      
      const dir = directions[direction];
      
      for (let distance = 1; distance <= maxDistance; distance++) {
        const targetQ = centerHex.q + (dir.q * distance);
        const targetR = centerHex.r + (dir.r * distance);
        
        const targetHex = boardHexes.find(h => h.q === targetQ && h.r === targetR);
        if (targetHex) {
          moves.push({
            hex: targetHex,
            direction,
            distance,
            movementType
          });
        }
      }
    }
    
    setSelectedMoves(moves);
  };
  
  // Calculate valid moves for test mode
  const calculateValidMovesForShip = (ship: Ship) => {
    if (!ship) return;
    
    const validMoves: HexCoordinate[] = [];
    const pattern = customPatterns[ship.type];
    if (!pattern) return;
    
    const shipOrientation = ship.orientation;
    const directions = [
      { q: 1, r: -1, orientation: 0 },  // NE
      { q: 1, r: 0, orientation: 1 },   // E/SE
      { q: 0, r: 1, orientation: 2 },   // S
      { q: -1, r: 1, orientation: 3 },  // SW
      { q: -1, r: 0, orientation: 4 },  // W/NW
      { q: 0, r: -1, orientation: 5 }   // N
    ];
    
    directions.forEach(direction => {
      const relativeFacing = (direction.orientation - shipOrientation + 6) % 6;
      
      let maxDistance = 0;
      if (relativeFacing === 0) {
        maxDistance = pattern.forward;
      } else if (relativeFacing === 1 || relativeFacing === 5) {
        maxDistance = pattern.forwardSide;
      } else if (relativeFacing === 2 || relativeFacing === 4) {
        maxDistance = pattern.side;
      } else if (relativeFacing === 3) {
        maxDistance = pattern.backward;
      }
      
      for (let distance = 1; distance <= maxDistance; distance++) {
        const targetQ = ship.position.q + (direction.q * distance);
        const targetR = ship.position.r + (direction.r * distance);
        
        const targetHex = boardHexes.find(h => h.q === targetQ && h.r === targetR);
        if (targetHex) {
          validMoves.push(targetHex);
        }
      }
    });
    
    setValidMoveTargets(validMoves);
  };
  
  // Handle hex click
  const handleHexClick = (hex: HexCoordinate) => {
    if (!selectedShipType || !testShip) return;
    
    if (mode === 'edit') {
      // Edit mode: select hexes for pattern
      if (hex.col === centerHex.col && hex.row === centerHex.row) return;
    
    // Calculate direction and distance from center
    const qDiff = hex.q - centerHex.q;
    const rDiff = hex.r - centerHex.r;
    
    // Determine direction (0-5) based on hex coordinate differences
    // Must match the directions array indices
    let direction = -1;
    if (qDiff > 0 && rDiff < 0) direction = 0; // NE (q: 1, r: -1)
    else if (qDiff > 0 && rDiff === 0) direction = 1; // E/SE (q: 1, r: 0)
    else if (qDiff === 0 && rDiff > 0) direction = 2; // S (q: 0, r: 1)
    else if (qDiff < 0 && rDiff > 0) direction = 3; // SW (q: -1, r: 1)
    else if (qDiff < 0 && rDiff === 0) direction = 4; // W/NW (q: -1, r: 0)
    else if (qDiff === 0 && rDiff < 0) direction = 5; // N (q: 0, r: -1)
    
    // For longer diagonal movements, determine closest direction
    if (direction === -1) {
      const angle = Math.atan2(rDiff, qDiff);
      const degrees = (angle * 180 / Math.PI + 360) % 360;
      direction = Math.round(degrees / 60) % 6;
    }
    
    const distance = Math.max(Math.abs(qDiff), Math.abs(rDiff), Math.abs(-qDiff - rDiff));
    
    // Determine movement type based on direction relative to ship orientation
    // Ship faces north (orientation 5 = visually 0°)
    // When orientation north, directions map to movement types:
    // 5 (N) = forward, 0 (NE) & 4 (NW) = forwardSide
    // 1 (E) & 3 (SW) = side, 2 (S) = backward
    let movementType: MovementHex['movementType'];
    if (direction === 5) { // North - forward when orientation north
      movementType = 'forward';
    } else if (direction === 0 || direction === 4) { // NE or NW - forward diagonal
      movementType = 'forwardSide';
    } else if (direction === 1 || direction === 3) { // E or SW - sides
      movementType = 'side';
    } else if (direction === 2) { // South - backward
      movementType = 'backward';
    } else {
      movementType = 'side';
    }
    
    // Toggle selection
    const existingIndex = selectedMoves.findIndex(m => 
      m.hex.q === hex.q && m.hex.r === hex.r
    );
    
    if (existingIndex >= 0) {
      // Remove from selection
      setSelectedMoves(prev => prev.filter((_, i) => i !== existingIndex));
    } else {
      // Add to selection
      setSelectedMoves(prev => [...prev, {
        hex,
        direction,
        distance,
        movementType
      }]);
    }
    } else {
      // Test mode: place or move ship
      if (testShip && hex.col === testShip.position.col && hex.row === testShip.position.row) {
        // Clicking on ship - do nothing for now (could add rotation)
        return;
      }
      
      // Check if this is a valid move
      const isValidMove = validMoveTargets.some(target => 
        target.col === hex.col && target.row === hex.row
      );
      
      if (isValidMove && !isMoving) {
        // Move ship with animation
        moveShipToHex(hex);
      } else if (!testShip || (!isValidMove && !isMoving)) {
        // Place ship on new hex (no animation)
        placeShipOnHex(hex);
      }
    }
  };
  
  // Place ship on hex without animation
  const placeShipOnHex = (hex: HexCoordinate) => {
    if (!selectedShipType) return;
    
    const ship: Ship = {
      id: `${selectedShipType}_test`,
      type: selectedShipType,
      position: hex,
      rotation: testShip?.rotation || 0,
      orientation: testShip?.orientation || 5
    };
    
    setTestShip(ship);
    calculateValidMovesForShip(ship);
  };
  
  // Move ship to hex with animation
  const moveShipToHex = (targetHex: HexCoordinate) => {
    if (!testShip || isMoving) return;
    
    setIsMoving(true);
    
    // Calculate new orientation based on movement direction
    const qDiff = targetHex.q - testShip.position.q;
    const rDiff = targetHex.r - testShip.position.r;
    
    let newOrientation = testShip.orientation;
    if (qDiff > 0 && rDiff < 0) newOrientation = 0; // NE
    else if (qDiff > 0 && rDiff === 0) newOrientation = 1; // E
    else if (qDiff === 0 && rDiff > 0) newOrientation = 2; // S
    else if (qDiff < 0 && rDiff > 0) newOrientation = 3; // SW
    else if (qDiff < 0 && rDiff === 0) newOrientation = 4; // W
    else if (qDiff === 0 && rDiff < 0) newOrientation = 5; // N
    
    const newRotation = orientationToRotation(newOrientation);
    
    // Update ship position and orientation
    const updatedShip: Ship = {
      ...testShip,
      position: targetHex,
      orientation: newOrientation,
      rotation: newRotation
    };
    
    setTestShip(updatedShip);
    
    // After move completes, recalculate valid moves
    setTimeout(() => {
      calculateValidMovesForShip(updatedShip);
      setIsMoving(false);
    }, 500);
  };
  
  // Convert orientation to rotation degrees
  const orientationToRotation = (orientation: number): number => {
    const rotations = [60, 120, 180, 240, 300, 0]; // Map orientation 0-5 to degrees
    return rotations[orientation] || 0;
  };
  
  // Get orientation name for display
  const getFacingName = (orientation: number): string => {
    const names = ['NE', 'E', 'S', 'SW', 'W', 'N'];
    return names[orientation] || 'N';
  };
  
  // Save pattern
  const savePattern = () => {
    if (!selectedShipType) return;
    
    // Calculate max distances for each movement type
    const pattern: MovementPattern = {
      forward: 0,
      forwardSide: 0,
      side: 0,
      backSide: 0,
      backward: 0,
      canRotateInPlace: customPatterns[selectedShipType]?.canRotateInPlace || true,
      rotationCost: customPatterns[selectedShipType]?.rotationCost || 0,
      canRotateWhileMoving: customPatterns[selectedShipType]?.canRotateWhileMoving || true,
      maxRotationPerMove: customPatterns[selectedShipType]?.maxRotationPerMove || 1
    };
    
    // Analyze selected moves to determine pattern
    selectedMoves.forEach(move => {
      const type = move.movementType;
      pattern[type] = Math.max(pattern[type], move.distance);
    });
    
    // Update custom patterns
    setCustomPatterns(prev => ({
      ...prev,
      [selectedShipType]: pattern
    }));
    
    // Save to server
    savePatternToServer(selectedShipType, pattern);
    
    Alert.alert('Success', `Movement pattern for ${selectedShipType} saved!`);
  };
  
  // Save pattern to server
  const savePatternToServer = async (shipType: string, pattern: MovementPattern) => {
    try {
      const response = await fetch('http://localhost:2567/admin/movement-pattern', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shipType,
          pattern
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save pattern');
      }
    } catch (error) {
      console.error('Error saving pattern:', error);
      Alert.alert('Error', 'Failed to save pattern to server');
    }
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
  
  // Get hex color based on selection
  const getHexColor = (hex: HexCoordinate): string => {
    if (mode === 'edit') {
      if (hex.col === centerHex.col && hex.row === centerHex.row) {
        return '#4A5568'; // Center hex - dark gray
      }
      
      const selected = selectedMoves.find(m => m.hex.q === hex.q && m.hex.r === hex.r);
      if (selected) {
        // Color based on movement type
        switch (selected.movementType) {
          case 'forward': return '#48BB78'; // Green
          case 'forwardSide': return '#4299E1'; // Blue
          case 'side': return '#ED8936'; // Orange
          case 'backSide': return '#F6AD55'; // Light orange
          case 'backward': return '#FC8181'; // Red
          default: return '#CBD5E0';
        }
      }
    } else {
      // Test mode colors
      if (testShip && hex.col === testShip.position.col && hex.row === testShip.position.row) {
        return '#4A5568'; // Ship position - dark gray
      }
      
      const isValidMove = validMoveTargets.some(target => 
        target.col === hex.col && target.row === hex.row
      );
      
      if (isValidMove) {
        return '#48BB78'; // Valid move - green
      }
    }
    
    return '#2D3748'; // Default dark
  };
  
  const getShipImage = (shipType: string) => {
    const colorPrefix = 'BLUE';
    switch (shipType) {
      case 'scout': return SHIP_IMAGES[`${colorPrefix}_SCOUT`];
      case 'interceptor': return SHIP_IMAGES[`${colorPrefix}_INTERCEPTOR`];
      case 'corvette': return SHIP_IMAGES[`${colorPrefix}_CORVETTE`];
      case 'destroyer': return SHIP_IMAGES[`${colorPrefix}_DESTROYER`];
      case 'cruiser': return SHIP_IMAGES[`${colorPrefix}_FLEET_ADMIRAL`];
      default: return SHIP_IMAGES[`${colorPrefix}_SCOUT`];
    }
  };
  
  return (
    <View style={styles.container}>
      {/* Mode Toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'edit' && styles.modeButtonActive]}
          onPress={() => setMode('edit')}
        >
          <Text style={styles.modeButtonText}>Edit Mode</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'test' && styles.modeButtonActive]}
          onPress={() => setMode('test')}
        >
          <Text style={styles.modeButtonText}>Test Mode</Text>
        </TouchableOpacity>
      </View>
      
      {/* Ship Selection Panel */}
      <View style={styles.shipPanel}>
        <Text style={styles.panelTitle}>Select Ship Type</Text>
        <ScrollView horizontal style={styles.shipList}>
          {shipTypes.map(type => (
            <TouchableOpacity
              key={type}
              style={[
                styles.shipButton,
                selectedShipType === type && styles.shipButtonActive
              ]}
              onPress={() => selectShipType(type)}
            >
              <Image
                source={getShipImage(type)}
                style={styles.shipIcon}
                resizeMode="contain"
              />
              <Text style={styles.shipLabel}>{type}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {/* Hex Board */}
      <View style={styles.board}>
        {boardHexes.map(hex => (
          <View
            key={`${hex.q}_${hex.r}`}
            style={{
              position: 'absolute',
              left: hex.x - hexRadius,
              top: hex.y - hexRadius
            }}
          >
            <TouchableOpacity onPress={() => handleHexClick(hex)}>
              <Svg width={hexRadius * 2} height={hexRadius * 2}>
                <Polygon
                  points={getHexagonPoints(hexRadius, hexRadius, hexRadius * 0.9)}
                  fill={getHexColor(hex)}
                  stroke="#1A202C"
                  strokeWidth="2"
                />
              </Svg>
              {/* Show ship */}
              {testShip && (
                mode === 'edit' 
                  ? (hex.col === centerHex.col && hex.row === centerHex.row) 
                  : (hex.col === testShip.position.col && hex.row === testShip.position.row)
              ) && (
                <Image
                  source={getShipImage(testShip.type)}
                  style={[
                    styles.shipImage,
                    {
                      position: 'absolute',
                      width: hexRadius * 1.4,
                      height: hexRadius * 1.4,
                      left: hexRadius * 0.3,
                      top: hexRadius * 0.3,
                      transform: [{ rotate: `${testShip.rotation}deg` }],
                      transition: isMoving ? 'all 0.5s ease-in-out' : 'none'
                    }
                  ]}
                  resizeMode="contain"
                />
              )}
            </TouchableOpacity>
          </View>
        ))}
      </View>
      
      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Movement Types</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#48BB78' }]} />
            <Text style={styles.legendText}>Forward</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#4299E1' }]} />
            <Text style={styles.legendText}>Forward-Side</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#ED8936' }]} />
            <Text style={styles.legendText}>Side</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#FC8181' }]} />
            <Text style={styles.legendText}>Backward</Text>
          </View>
        </View>
      </View>
      
      {/* Action Buttons */}
      {mode === 'edit' && selectedShipType && (
        <TouchableOpacity style={styles.saveButton} onPress={savePattern}>
          <Text style={styles.saveButtonText}>Save Pattern</Text>
        </TouchableOpacity>
      )}
      
      {/* Test Mode Controls */}
      {mode === 'test' && testShip && (
        <View style={styles.testControls}>
          <TouchableOpacity 
            style={styles.rotateButton}
            onPress={() => {
              if (!testShip) return;
              const newOrientation = (testShip.orientation - 1 + 6) % 6; // Rotate CCW
              const newRotation = orientationToRotation(newOrientation);
              const updatedShip = { ...testShip, orientation: newOrientation, rotation: newRotation };
              setTestShip(updatedShip);
              calculateValidMovesForShip(updatedShip);
            }}
          >
            <Text style={styles.rotateButtonText}>↺ Rotate Left</Text>
          </TouchableOpacity>
          
          <View style={styles.facingInfo}>
            <Text style={styles.facingText}>Orientation: {getFacingName(testShip.orientation)}</Text>
            <Text style={styles.facingText}>({testShip.rotation}°)</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.rotateButton}
            onPress={() => {
              if (!testShip) return;
              const newOrientation = (testShip.orientation + 1) % 6; // Rotate CW
              const newRotation = orientationToRotation(newOrientation);
              const updatedShip = { ...testShip, orientation: newOrientation, rotation: newRotation };
              setTestShip(updatedShip);
              calculateValidMovesForShip(updatedShip);
            }}
          >
            <Text style={styles.rotateButtonText}>Rotate Right ↻</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A202C'
  },
  modeToggle: {
    flexDirection: 'row',
    padding: 10,
    justifyContent: 'center'
  },
  modeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#2D3748',
    marginHorizontal: 5,
    borderRadius: 5
  },
  modeButtonActive: {
    backgroundColor: '#4299E1'
  },
  modeButtonText: {
    color: 'white',
    fontWeight: 'bold'
  },
  shipPanel: {
    backgroundColor: '#2D3748',
    padding: 10,
    marginBottom: 10
  },
  panelTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10
  },
  shipList: {
    flexDirection: 'row'
  },
  shipButton: {
    alignItems: 'center',
    padding: 10,
    marginRight: 10,
    backgroundColor: '#1A202C',
    borderRadius: 5,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  shipButtonActive: {
    borderColor: '#4299E1'
  },
  shipIcon: {
    width: 40,
    height: 40
  },
  shipLabel: {
    color: 'white',
    fontSize: 12,
    marginTop: 5
  },
  board: {
    flex: 1,
    position: 'relative'
  },
  shipImage: {
    position: 'absolute'
  },
  legend: {
    backgroundColor: '#2D3748',
    padding: 10
  },
  legendTitle: {
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 10
  },
  legendItems: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  legendColor: {
    width: 20,
    height: 20,
    marginRight: 5,
    borderRadius: 3
  },
  legendText: {
    color: 'white',
    fontSize: 12
  },
  saveButton: {
    backgroundColor: '#48BB78',
    padding: 15,
    margin: 10,
    borderRadius: 5,
    alignItems: 'center'
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold'
  },
  testControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#2D3748',
    padding: 10,
    margin: 10,
    borderRadius: 5
  },
  rotateButton: {
    backgroundColor: '#4A5568',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 5
  },
  rotateButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold'
  },
  facingInfo: {
    alignItems: 'center'
  },
  facingText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold'
  }
});