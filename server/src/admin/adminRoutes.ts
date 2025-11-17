import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

// Movement patterns storage
interface MovementPattern {
  forward: number;
  forwardSide: number;
  side: number;
  backSide: number;
  backward: number;
  canRotateInPlace: boolean;
  rotationCost: number;
  canRotateWhileMoving: boolean;
  maxRotationPerMove: number;
}

// Store patterns in a JSON file
const patternsFile = path.join(__dirname, '../../data/movement-patterns.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load existing patterns or use defaults
let movementPatterns: Record<string, MovementPattern> = {};

if (fs.existsSync(patternsFile)) {
  try {
    const data = fs.readFileSync(patternsFile, 'utf-8');
    movementPatterns = JSON.parse(data);
  } catch (error) {
    console.error('Error loading movement patterns:', error);
  }
}

// Default patterns if file doesn't exist
if (Object.keys(movementPatterns).length === 0) {
  movementPatterns = {
    scout: {
      forward: 5,
      forwardSide: 3,
      side: 2,
      backSide: 0,
      backward: 1,
      canRotateInPlace: true,
      rotationCost: 0,
      canRotateWhileMoving: true,
      maxRotationPerMove: 2
    },
    interceptor: {
      forward: 4,
      forwardSide: 3,
      side: 1,
      backSide: 0,
      backward: 0,
      canRotateInPlace: true,
      rotationCost: 0,
      canRotateWhileMoving: true,
      maxRotationPerMove: 1
    },
    corvette: {
      forward: 3,
      forwardSide: 2,
      side: 1,
      backSide: 0,
      backward: 1,
      canRotateInPlace: true,
      rotationCost: 0,
      canRotateWhileMoving: true,
      maxRotationPerMove: 1
    },
    frigate: {
      forward: 3,
      forwardSide: 2,
      side: 1,
      backSide: 0,
      backward: 0,
      canRotateInPlace: true,
      rotationCost: 1,
      canRotateWhileMoving: false,
      maxRotationPerMove: 0
    },
    destroyer: {
      forward: 2,
      forwardSide: 1,
      side: 0,
      backSide: 0,
      backward: 0,
      canRotateInPlace: true,
      rotationCost: 1,
      canRotateWhileMoving: false,
      maxRotationPerMove: 0
    },
    cruiser: {
      forward: 2,
      forwardSide: 1,
      side: 0,
      backSide: 0,
      backward: 0,
      canRotateInPlace: false,
      rotationCost: 1,
      canRotateWhileMoving: false,
      maxRotationPerMove: 0
    }
  };
  
  // Save defaults
  fs.writeFileSync(patternsFile, JSON.stringify(movementPatterns, null, 2));
}

// Get all movement patterns
router.get('/movement-patterns', (req, res) => {
  res.json(movementPatterns);
});

// Get pattern for specific ship type
router.get('/movement-pattern/:shipType', (req, res) => {
  const { shipType } = req.params;
  const pattern = movementPatterns[shipType];
  
  if (!pattern) {
    return res.status(404).json({ error: 'Ship type not found' });
  }
  
  res.json(pattern);
});

// Update movement pattern for a ship type
router.post('/movement-pattern', (req, res) => {
  const { shipType, pattern } = req.body;
  
  if (!shipType || !pattern) {
    return res.status(400).json({ error: 'Missing shipType or pattern' });
  }
  
  // Validate pattern structure
  const requiredFields = [
    'forward', 'forwardSide', 'side', 'backSide', 'backward',
    'canRotateInPlace', 'rotationCost', 'canRotateWhileMoving', 'maxRotationPerMove'
  ];
  
  for (const field of requiredFields) {
    if (pattern[field] === undefined) {
      return res.status(400).json({ error: `Missing required field: ${field}` });
    }
  }
  
  // Update pattern
  movementPatterns[shipType] = pattern;
  
  // Save to file
  try {
    fs.writeFileSync(patternsFile, JSON.stringify(movementPatterns, null, 2));
    console.log(`Movement pattern updated for ${shipType}`);
    res.json({ success: true, shipType, pattern });
  } catch (error) {
    console.error('Error saving movement patterns:', error);
    res.status(500).json({ error: 'Failed to save pattern' });
  }
});

// Reset patterns to defaults
router.post('/reset-patterns', (req, res) => {
  // Reset to defaults (reload from the defaults defined above)
  movementPatterns = {
    scout: {
      forward: 5,
      forwardSide: 3,
      side: 2,
      backSide: 0,
      backward: 1,
      canRotateInPlace: true,
      rotationCost: 0,
      canRotateWhileMoving: true,
      maxRotationPerMove: 2
    },
    interceptor: {
      forward: 4,
      forwardSide: 3,
      side: 1,
      backSide: 0,
      backward: 0,
      canRotateInPlace: true,
      rotationCost: 0,
      canRotateWhileMoving: true,
      maxRotationPerMove: 1
    },
    corvette: {
      forward: 3,
      forwardSide: 2,
      side: 1,
      backSide: 0,
      backward: 1,
      canRotateInPlace: true,
      rotationCost: 0,
      canRotateWhileMoving: true,
      maxRotationPerMove: 1
    },
    frigate: {
      forward: 3,
      forwardSide: 2,
      side: 1,
      backSide: 0,
      backward: 0,
      canRotateInPlace: true,
      rotationCost: 1,
      canRotateWhileMoving: false,
      maxRotationPerMove: 0
    },
    destroyer: {
      forward: 2,
      forwardSide: 1,
      side: 0,
      backSide: 0,
      backward: 0,
      canRotateInPlace: true,
      rotationCost: 1,
      canRotateWhileMoving: false,
      maxRotationPerMove: 0
    },
    cruiser: {
      forward: 2,
      forwardSide: 1,
      side: 0,
      backSide: 0,
      backward: 0,
      canRotateInPlace: false,
      rotationCost: 1,
      canRotateWhileMoving: false,
      maxRotationPerMove: 0
    }
  };
  
  // Save to file
  try {
    fs.writeFileSync(patternsFile, JSON.stringify(movementPatterns, null, 2));
    res.json({ success: true, message: 'Patterns reset to defaults' });
  } catch (error) {
    console.error('Error resetting patterns:', error);
    res.status(500).json({ error: 'Failed to reset patterns' });
  }
});

export { router as adminRoutes, movementPatterns };