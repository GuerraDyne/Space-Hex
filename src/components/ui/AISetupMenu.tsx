import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal
} from 'react-native';

interface AISetupMenuProps {
  visible: boolean;
  onClose: () => void;
  onStartGame: (settings: AIGameSettings) => void;
}

export interface AIGameSettings {
  mapType: 'Classic' | 'Graveyard' | 'Meteor Shower' | 'Random';
  difficulty: 'easy' | 'medium' | 'hard';
  deploymentTime: number;
  turnTime: number;
}

export const AISetupMenu: React.FC<AISetupMenuProps> = ({
  visible,
  onClose,
  onStartGame
}) => {
  const [selectedMap, setSelectedMap] = useState<'Classic' | 'Graveyard' | 'Meteor Shower' | 'Random'>('Classic');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [deploymentTime, setDeploymentTime] = useState<60 | 180 | 300>(180);
  const [turnTime, setTurnTime] = useState<60 | 180 | 240 | 600>(180);
  const [currentStep, setCurrentStep] = useState<'difficulty' | 'map' | 'time'>('difficulty');

  const handleStartGame = () => {
    onStartGame({
      mapType: selectedMap,
      difficulty,
      deploymentTime,
      turnTime
    });
  };

  const renderDifficultySelect = () => (
    <View style={styles.menuContent}>
      <Text style={styles.title}>Select Difficulty</Text>
      <Text style={styles.instructionText}>Choose AI opponent strength:</Text>
      
      <TouchableOpacity
        style={[
          styles.menuButton,
          { marginVertical: 5 },
          difficulty === 'easy' && { borderColor: '#00ff88', borderWidth: 2 }
        ]}
        onPress={() => {
          setDifficulty('easy');
          setCurrentStep('map');
        }}
      >
        <Text style={styles.menuButtonText}>Easy</Text>
        <Text style={styles.menuButtonSubtext}>AI makes occasional mistakes</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.menuButton,
          { marginVertical: 5 },
          difficulty === 'medium' && { borderColor: '#00ff88', borderWidth: 2 }
        ]}
        onPress={() => {
          setDifficulty('medium');
          setCurrentStep('map');
        }}
      >
        <Text style={styles.menuButtonText}>Medium</Text>
        <Text style={styles.menuButtonSubtext}>Balanced AI opponent</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.menuButton,
          { marginVertical: 5 },
          difficulty === 'hard' && { borderColor: '#00ff88', borderWidth: 2 }
        ]}
        onPress={() => {
          setDifficulty('hard');
          setCurrentStep('map');
        }}
      >
        <Text style={styles.menuButtonText}>Hard</Text>
        <Text style={styles.menuButtonSubtext}>AI plays optimally</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMapSelect = () => (
    <View style={styles.menuContent}>
      <Text style={styles.title}>Select Map</Text>
      <Text style={styles.instructionText}>Choose your battlefield:</Text>
      
      {(['Classic', 'Graveyard', 'Meteor Shower', 'Random'] as const).map((mapType) => (
        <TouchableOpacity
          key={mapType}
          style={[
            styles.menuButton,
            { marginVertical: 5 },
            selectedMap === mapType && { borderColor: '#00ff88', borderWidth: 2 }
          ]}
          onPress={() => {
            setSelectedMap(mapType);
            setCurrentStep('time');
          }}
        >
          <Text style={styles.menuButtonText}>{mapType}</Text>
          <Text style={styles.menuButtonSubtext}>
            {mapType === 'Classic' && 'Standard battlefield'}
            {mapType === 'Graveyard' && 'Debris fields block movement'}
            {mapType === 'Meteor Shower' && 'Meteors deal damage'}
            {mapType === 'Random' && 'Random mix of hazards'}
          </Text>
        </TouchableOpacity>
      ))}
      
      <TouchableOpacity style={styles.cancelButton} onPress={() => setCurrentStep('difficulty')}>
        <Text style={styles.cancelButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTimeSelect = () => (
    <View style={styles.menuContent}>
      <Text style={styles.title}>Time Controls</Text>
      
      <Text style={styles.sectionTitle}>Deployment Time</Text>
      <Text style={styles.instructionText}>Time for placing units:</Text>
      <View style={styles.buttonRow}>
        {[60, 180, 300].map((time) => (
          <TouchableOpacity
            key={time}
            style={[
              styles.timeButton,
              deploymentTime === time && styles.selectedTimeButton
            ]}
            onPress={() => setDeploymentTime(time as 60 | 180 | 300)}
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
      <Text style={styles.instructionText}>Time per turn:</Text>
      <View style={styles.buttonRow}>
        {[60, 180, 240, 600].map((time) => (
          <TouchableOpacity
            key={time}
            style={[
              styles.timeButton,
              turnTime === time && styles.selectedTimeButton
            ]}
            onPress={() => setTurnTime(time as 60 | 180 | 240 | 600)}
          >
            <Text style={[
              styles.timeButtonText,
              turnTime === time && styles.selectedTimeButtonText
            ]}>
              {time === 60 && '1 min'}
              {time === 180 && '3 min'}
              {time === 240 && '4 min'}
              {time === 600 && '10 min'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <TouchableOpacity 
        style={[styles.startButton, { marginTop: 20 }]}
        onPress={handleStartGame}
      >
        <Text style={styles.startButtonText}>Start Game</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.cancelButton} onPress={() => setCurrentStep('map')}>
        <Text style={styles.cancelButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    switch (currentStep) {
      case 'difficulty':
        return renderDifficultySelect();
      case 'map':
        return renderMapSelect();
      case 'time':
        return renderTimeSelect();
      default:
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
          {renderContent()}
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
  
  instructionText: {
    color: '#aaaaaa',
    fontSize: 14,
    marginVertical: 10,
    textAlign: 'center',
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
  
  sectionTitle: {
    color: '#00ff88',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 5,
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
  
  cancelButton: {
    marginTop: 20,
    padding: 10,
  },
  
  cancelButtonText: {
    color: '#ff6b6b',
    fontSize: 16,
  },
});