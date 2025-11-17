import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/game/gameStore';
import { soundManager } from '@/sounds/soundManager';

interface TutorialStep {
  id: number;
  title: string;
  content: string;
  highlight?: string; // CSS selector to highlight
  action?: string; // What the player needs to do
  autoAdvance?: boolean;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 1,
    title: 'Welcome to Hexarch!',
    content:
      'This is a strategic space combat game where you control a fleet of ships. Your goal is to destroy the enemy Mothership while protecting your own.',
    autoAdvance: false,
  },
  {
    id: 2,
    title: 'Your Fleet',
    content:
      'You have several ships with different capabilities. Each ship has Action Points (AP) that determine how much it can move per turn.',
    highlight: '.ship-list',
    autoAdvance: false,
  },
  {
    id: 3,
    title: 'Action Points (AP)',
    content:
      'You have 10 AP per turn to distribute among your ships. Moving one hex costs 1 AP. Turning also costs AP based on how far you turn.',
    highlight: '.ap-display',
    autoAdvance: false,
  },
  {
    id: 4,
    title: 'Ship Movement',
    content:
      'Click on one of your ships to select it. The hex grid will show where you can move. Ships move one hex at a time.',
    action: 'select_ship',
    autoAdvance: true,
  },
  {
    id: 5,
    title: 'Moving Your Ship',
    content:
      'Click on an adjacent hex to plan a move. The move costs 1 AP. You can chain multiple moves if the ship has enough AP.',
    action: 'plan_move',
    autoAdvance: true,
  },
  {
    id: 6,
    title: 'Rotating Ships',
    content:
      'Ships can face 6 directions. Use the rotation buttons to change facing. Turning costs AP based on the minimum rotations needed.',
    highlight: '.turn-controls',
    autoAdvance: false,
  },
  {
    id: 7,
    title: 'Smart Turn Calculation',
    content:
      'If you turn 5 steps right, it only costs 1 AP because you could turn 1 step left instead. The game automatically calculates the minimum cost!',
    autoAdvance: false,
  },
  {
    id: 8,
    title: 'Combat',
    content:
      'To attack an enemy, move your ship onto their hex. This destroys the enemy ship and creates a debris field.',
    autoAdvance: false,
  },
  {
    id: 9,
    title: 'Debris Fields',
    content:
      'When you enter a debris field, your ship loses all remaining AP for that turn. Plan your movements carefully!',
    autoAdvance: false,
  },
  {
    id: 10,
    title: 'Confirming Your Turn',
    content:
      'After planning your moves, click "Confirm Turn" to execute them. All players will see the animated movements.',
    highlight: '.confirm-btn',
    autoAdvance: false,
  },
  {
    id: 11,
    title: 'Undo Actions',
    content:
      'Made a mistake? Use "Undo Last" to reverse individual actions, or "Undo All" to start planning from scratch.',
    highlight: '.action-buttons',
    autoAdvance: false,
  },
  {
    id: 12,
    title: 'Victory Condition',
    content:
      'Destroy the enemy Mothership to win! But be careful - protect your own Mothership at all costs.',
    autoAdvance: false,
  },
  {
    id: 13,
    title: 'Time Management',
    content:
      'Watch your timer! In competitive play, each player has a limited time pool like in chess. When your time runs out, you lose.',
    highlight: '.time-display',
    autoAdvance: false,
  },
  {
    id: 14,
    title: 'Tutorial Complete!',
    content:
      'You now know the basics of Hexarch! Practice against the AI to improve your strategy. Good luck, Commander!',
    autoAdvance: false,
  },
];

interface TutorialProps {
  onComplete: () => void;
}

export const Tutorial: React.FC<TutorialProps> = ({ onComplete }) => {
  const { selectedShipId, pendingActions } = useGameStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [showTutorial, setShowTutorial] = useState(true);

  const step = TUTORIAL_STEPS[currentStep];

  // Auto-advance based on player actions
  useEffect(() => {
    if (!step?.autoAdvance) return;

    if (step.action === 'select_ship' && selectedShipId) {
      setTimeout(() => nextStep(), 500);
    }

    if (step.action === 'plan_move' && pendingActions.size > 0) {
      setTimeout(() => nextStep(), 500);
    }
  }, [selectedShipId, pendingActions, step]);

  const nextStep = () => {
    soundManager.play('button_click');
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    soundManager.play('button_click');
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipTutorial = () => {
    soundManager.play('button_click');
    if (confirm('Skip the tutorial? You can always access it from the main menu.')) {
      onComplete();
    }
  };

  if (!showTutorial) return null;

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-box">
        <div className="tutorial-header">
          <h3>{step.title}</h3>
          <span className="step-counter">
            Step {currentStep + 1} / {TUTORIAL_STEPS.length}
          </span>
        </div>

        <div className="tutorial-content">
          <p>{step.content}</p>
          {step.action && (
            <div className="tutorial-action">
              <strong>Action Required:</strong>{' '}
              {step.action === 'select_ship' && 'Click on one of your ships'}
              {step.action === 'plan_move' && 'Click on an adjacent hex to plan a move'}
            </div>
          )}
        </div>

        <div className="tutorial-buttons">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="tutorial-btn"
          >
            Previous
          </button>
          {!step.autoAdvance && (
            <button onClick={nextStep} className="tutorial-btn primary">
              {currentStep === TUTORIAL_STEPS.length - 1 ? 'Finish' : 'Next'}
            </button>
          )}
          <button onClick={skipTutorial} className="tutorial-btn skip">
            Skip Tutorial
          </button>
        </div>

        <div className="tutorial-progress">
          <div
            className="progress-bar"
            style={{
              width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
