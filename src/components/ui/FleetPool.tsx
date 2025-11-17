/**
 * FleetPool - Horizontal scrolling fleet selection menu
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions
} from 'react-native';

const SHIP_IMAGES = {
  BLUE_ARTILLERY: require('../../assets/ships/Blue Artillery.png'),
  BLUE_CAPTAIN: require('../../assets/ships/Blue Battleship.png'),
  BLUE_FLEET_ADMIRAL: require('../../assets/ships/Blue Cruiser.png'),
  BLUE_CORVETTE: require('../../assets/ships/Blue Corvette.png'),
  BLUE_DESTROYER: require('../../assets/ships/Blue Destroyer.png'),
  BLUE_INTERCEPTOR: require('../../assets/ships/Blue Interceptor.png'),
  BLUE_SCOUT: require('../../assets/ships/Blue Scout.png'),
  BLUE_COMMAND: require('../../assets/ships/Blue_Command_Ship.png'),
  
  RED_ARTILLERY: require('../../assets/ships/Red Artillery.png'),
  RED_CAPTAIN: require('../../assets/ships/Red Battleship.png'),
  RED_FLEET_ADMIRAL: require('../../assets/ships/Red Cruiser.png'),
  RED_CORVETTE: require('../../assets/ships/Red Corvette.png'),
  RED_DESTROYER: require('../../assets/ships/Red Destroyer.png'),
  RED_INTERCEPTOR: require('../../assets/ships/Red Interceptor.png'),
  RED_SCOUT: require('../../assets/ships/Red Scout.png'),
  RED_COMMAND: require('../../assets/ships/Red_Command_Ship.png'),
  
  GREEN_ARTILLERY: require('../../assets/ships/Green Artillery.png'),
  GREEN_CAPTAIN: require('../../assets/ships/Green Battleship.png'),
  GREEN_FLEET_ADMIRAL: require('../../assets/ships/Green Cruiser.png'),
  GREEN_CORVETTE: require('../../assets/ships/Green Corvette.png'),
  GREEN_DESTROYER: require('../../assets/ships/Green Destroyer.png'),
  GREEN_INTERCEPTOR: require('../../assets/ships/Green Interceptor.png'),
  GREEN_SCOUT: require('../../assets/ships/Green Scout.png'),
  GREEN_COMMAND: require('../../assets/ships/Green_Command_Ship.png'),
  
  YELLOW_ARTILLERY: require('../../assets/ships/Yellow Artillery.png'),
  YELLOW_CAPTAIN: require('../../assets/ships/Yellow Battleship.png'),
  YELLOW_FLEET_ADMIRAL: require('../../assets/ships/Yellow Cruiser.png'),
  YELLOW_CORVETTE: require('../../assets/ships/Yellow Corvette.png'),
  YELLOW_DESTROYER: require('../../assets/ships/Yellow Destroyer.png'),
  YELLOW_INTERCEPTOR: require('../../assets/ships/Yellow Interceptor.png'),
  YELLOW_SCOUT: require('../../assets/ships/Yellow Scout.png'),
  YELLOW_COMMAND: require('../../assets/ships/Yellow_Command_Ship.png'),
};

interface Ship {
  id: string;
  name: string;
  type: string;
  image: any;
  cost: number;
  maxCount: number;
  currentCount: number;
}

interface FleetPoolProps {
  onShipSelect: (ship: Ship) => void;
  selectedShip: Ship | null;
  gamePhase: string;
  deployedShips?: any[]; // Array of deployed ships to count
  onAutoDeploy?: () => void; // Callback for auto-deploy
}

export const FleetPool: React.FC<FleetPoolProps> = ({
  onShipSelect,
  selectedShip,
  gamePhase,
  deployedShips = [],
  onAutoDeploy
}) => {
  // Determine player color based on room state
  const getPlayerColor = () => {
    const room = (window as any).currentRoom;
    if (!room || !room.state || !room.state.players) return 'BLUE';
    
    const playerIds = Array.from(room.state.players.keys());
    const myIndex = playerIds.indexOf(room.sessionId);
    
    switch(myIndex) {
      case 0: return 'BLUE';
      case 1: return 'RED';
      case 2: return 'GREEN';
      case 3: return 'YELLOW';
      default: return 'BLUE';
    }
  };
  
  const playerColor = getPlayerColor();
  const [availableShips] = useState<Ship[]>([
    {
      id: 'scout',
      name: 'Scout',
      type: 'scout',
      image: SHIP_IMAGES[`${playerColor}_SCOUT`],
      cost: 1,
      maxCount: 2,
      currentCount: 0
    },
    {
      id: 'interceptor',
      name: 'Interceptor',
      type: 'interceptor',
      image: SHIP_IMAGES[`${playerColor}_INTERCEPTOR`],
      cost: 2,
      maxCount: 2,
      currentCount: 0
    },
    {
      id: 'corvette',
      name: 'Corvette',
      type: 'corvette',
      image: SHIP_IMAGES[`${playerColor}_CORVETTE`],
      cost: 3,
      maxCount: 2,
      currentCount: 0
    },
    {
      id: 'frigate',
      name: 'Frigate',
      type: 'frigate',
      image: SHIP_IMAGES[`${playerColor}_CAPTAIN`], // Using battleship image for frigate
      cost: 3,
      maxCount: 2,
      currentCount: 0
    },
    {
      id: 'destroyer',
      name: 'Destroyer',
      type: 'destroyer',
      image: SHIP_IMAGES[`${playerColor}_DESTROYER`],
      cost: 4,
      maxCount: 1,
      currentCount: 0
    },
    {
      id: 'cruiser',
      name: 'Cruiser',
      type: 'cruiser',
      image: SHIP_IMAGES[`${playerColor}_FLEET_ADMIRAL`],
      cost: 5,
      maxCount: 1,
      currentCount: 0
    },
    {
      id: 'mothership',
      name: 'Command Ship',
      type: 'mothership',
      image: SHIP_IMAGES[`${playerColor}_COMMAND`],
      cost: 0,
      maxCount: 1,
      currentCount: 0
    }
  ]);

  if (gamePhase !== 'deployment') {
    return null;
  }

  // Check if all ships have been deployed (excluding mothership from count check)
  const totalDeployedShips = availableShips.reduce((total, ship) => {
    const deployedCount = deployedShips.filter(deployedShip => 
      deployedShip.type === ship.type
    ).length;
    return total + deployedCount;
  }, 0);

  const totalMaxShips = availableShips.reduce((total, ship) => total + ship.maxCount, 0);
  const allShipsDeployed = totalDeployedShips >= totalMaxShips;

  // If all ships are deployed, show minimized version
  if (allShipsDeployed) {
    const room = (window as any).currentRoom;
    const isMultiplayer = !!room;
    
    return (
      <View style={[styles.container, styles.minimized]}>
        <View style={styles.header}>
          <Text style={styles.title}>All Ships Deployed</Text>
          <Text style={styles.instructions}>
            {isMultiplayer ? 'Waiting for other players...' : 'Waiting for AI deployment...'}
          </Text>
        </View>
      </View>
    );
  }

  const renderShip = (ship: Ship) => {
    const isSelected = selectedShip?.id === ship.id;
    
    // Count how many of this ship type have been deployed
    const deployedCount = deployedShips.filter(deployedShip => 
      deployedShip.type === ship.type
    ).length;
    
    const canDeploy = deployedCount < ship.maxCount;

    return (
      <TouchableOpacity
        key={ship.id}
        style={[
          styles.shipCard,
          isSelected && styles.selectedShip,
          !canDeploy && styles.disabledShip
        ]}
        onPress={() => canDeploy && onShipSelect(ship)}
        disabled={!canDeploy}
      >
        <Image source={ship.image} style={styles.shipImage} resizeMode="contain" />
        <Text style={[
          styles.shipName,
          isSelected && styles.selectedText,
          !canDeploy && styles.disabledText
        ]}>
          {ship.name}
        </Text>
        <Text style={[
          styles.shipCount,
          isSelected && styles.selectedText,
          !canDeploy && styles.disabledText
        ]}>
          {deployedCount}/{ship.maxCount}
        </Text>
        <Text style={[
          styles.shipCost,
          isSelected && styles.selectedText,
          !canDeploy && styles.disabledText
        ]}>
          Cost: {ship.cost}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Deployment Phase</Text>
        <Text style={styles.instructions}>Select a ship then tap a deployment zone</Text>
      </View>
      <ScrollView
        horizontal
        style={styles.scrollView}
        showsHorizontalScrollIndicator={true}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={true}
        bounces={true}
        alwaysBounceHorizontal={true}
      >
        {availableShips.map(renderShip)}
        {onAutoDeploy && (
          <TouchableOpacity
            style={styles.autoDeployButton}
            onPress={onAutoDeploy}
          >
            <Text style={styles.autoDeployText}>AUTO</Text>
            <Text style={styles.autoDeploySubtext}>DEPLOY</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 8,
  },

  minimized: {
    paddingBottom: 8,
  },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },

  title: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },

  instructions: {
    color: '#aaa',
    fontSize: 12,
    textAlign: 'center',
  },

  scrollView: {
    maxHeight: 120,
    width: '100%',
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    flexGrow: 1,
  },

  shipCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 2,
    borderColor: '#333',
  },

  selectedShip: {
    borderColor: '#4ECDC4',
    backgroundColor: '#1a3a3a',
  },

  disabledShip: {
    opacity: 0.5,
    backgroundColor: '#1a1a1a',
  },

  shipImage: {
    width: 40,
    height: 40,
    marginBottom: 8,
  },

  shipName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },

  shipCount: {
    color: '#aaa',
    fontSize: 10,
    marginBottom: 2,
  },

  shipCost: {
    color: '#4ECDC4',
    fontSize: 10,
    fontWeight: 'bold',
  },

  selectedText: {
    color: '#4ECDC4',
  },

  disabledText: {
    color: '#666',
  },
  
  autoDeployButton: {
    backgroundColor: '#ff6b35',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ff8c5a',
    padding: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    width: 80,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  autoDeployText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  
  autoDeploySubtext: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});