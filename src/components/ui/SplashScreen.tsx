import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated
} from 'react-native';

interface SplashScreenProps {
  onContinue: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onContinue }) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: false, // Set to false for web compatibility
    }).start();

    // Pulse animation for "press to continue" text
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 1500,
          useNativeDriver: false, // Set to false for web compatibility
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false, // Set to false for web compatibility
        }),
      ])
    ).start();
  }, []);

  return (
    <TouchableOpacity style={styles.container} onPress={onContinue} activeOpacity={1}>
      {/* Vignette effect */}
      <View style={styles.vignette} />
      
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Logo/Icon */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/hexarch_icon.gif')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        
        {/* Game Title */}
        <Text style={styles.title}>HEXARCH</Text>
        
        {/* Press to continue */}
        <Animated.Text style={[styles.continueText, { opacity: pulseAnim }]}>
          PRESS ANYWHERE TO CONTINUE
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  vignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Radial gradient effect using shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 100,
    // Add border shadow for vignette effect
    borderWidth: 100,
    borderColor: 'rgba(0,0,0,0.8)',
    // Use box shadow for web
    ...({
      boxShadow: 'inset 0 0 100px 50px rgba(0,0,0,0.9)',
    } as any),
  },
  
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  
  logoContainer: {
    width: Math.min(width * 0.5, 300),
    height: Math.min(width * 0.5, 300),
    marginBottom: 40,
    // Add glow effect
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  
  logo: {
    width: '100%',
    height: '100%',
  },
  
  title: {
    fontSize: Math.min(width * 0.12, 60),
    fontWeight: '900',
    color: '#4ECDC4',
    letterSpacing: 8,
    marginBottom: 80,
    textShadowColor: '#4ECDC4',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  
  continueText: {
    fontSize: Math.min(width * 0.035, 18),
    color: '#888',
    letterSpacing: 2,
    position: 'absolute',
    bottom: 60,
  },
});