import React, { useState } from 'react';
import { GameSettings, GameMode, TimeControl } from '@/types/game';
import { getAvailableMaps } from '@/game/mapGenerator';
import { soundManager } from '@/sounds/soundManager';

interface LobbyProps {
  onStartGame: (settings: GameSettings, isAI: boolean, aiDifficulty?: string) => void;
  onQuickMatch: () => void;
  onHostMatch: (settings: GameSettings) => void;
  onJoinMatch: (code: string) => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  onStartGame,
  onQuickMatch,
  onHostMatch,
  onJoinMatch,
}) => {
  const [screen, setScreen] = useState<'main' | 'host' | 'join' | 'ai'>('main');
  const [gameMode, setGameMode] = useState<GameMode>('1v1');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedMap, setSelectedMap] = useState('classic');
  const [deploymentTime, setDeploymentTime] = useState(180);
  const [gameTime, setGameTime] = useState(600);
  const [joinCode, setJoinCode] = useState('');
  const [aiDifficulty, setAiDifficulty] = useState('medium');
  const [playerName, setPlayerName] = useState('Player');

  const maps = getAvailableMaps();

  const handleQuickMatch = () => {
    soundManager.play('button_click');
    onQuickMatch();
  };

  const handleHostMatch = () => {
    soundManager.play('button_click');
    const settings: GameSettings = {
      mode: gameMode,
      isPrivate,
      mapId: selectedMap,
      timeControl: {
        deploymentTime,
        gameTime,
      },
    };
    onHostMatch(settings);
  };

  const handleJoinMatch = () => {
    soundManager.play('button_click');
    if (joinCode.trim()) {
      onJoinMatch(joinCode.trim());
    }
  };

  const handleStartAIGame = () => {
    soundManager.play('button_click');
    const settings: GameSettings = {
      mode: '1v1',
      isPrivate: true,
      mapId: selectedMap,
      timeControl: {
        deploymentTime,
        gameTime,
      },
    };
    onStartGame(settings, true, aiDifficulty);
  };

  const handleStartTutorial = () => {
    soundManager.play('button_click');
    const settings: GameSettings = {
      mode: '1v1',
      isPrivate: true,
      mapId: 'classic',
      timeControl: {
        deploymentTime: 600,
        gameTime: 3600,
      },
    };
    onStartGame(settings, true, 'tutorial');
  };

  return (
    <div className="lobby">
      <div className="lobby-content">
        <h1>HEXARCH</h1>
        <h2>Strategic Space Combat</h2>

        <div className="player-name-input">
          <label>Your Name:</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={20}
          />
        </div>

        {screen === 'main' && (
          <div className="main-menu">
            <button className="menu-btn primary" onClick={handleQuickMatch}>
              Quick Match
            </button>
            <button
              className="menu-btn"
              onClick={() => {
                soundManager.play('button_click');
                setScreen('host');
              }}
            >
              Host Match
            </button>
            <button
              className="menu-btn"
              onClick={() => {
                soundManager.play('button_click');
                setScreen('join');
              }}
            >
              Join Match
            </button>
            <button
              className="menu-btn"
              onClick={() => {
                soundManager.play('button_click');
                setScreen('ai');
              }}
            >
              Play vs AI
            </button>
            <button className="menu-btn tutorial" onClick={handleStartTutorial}>
              Tutorial
            </button>
          </div>
        )}

        {screen === 'host' && (
          <div className="host-menu">
            <h3>Host Match</h3>

            <div className="setting-group">
              <label>Game Mode:</label>
              <select
                value={gameMode}
                onChange={(e) => setGameMode(e.target.value as GameMode)}
              >
                <option value="1v1">1v1</option>
                <option value="ffa">Free For All (4 players)</option>
                <option value="2v2">2v2 Teams</option>
              </select>
            </div>

            <div className="setting-group">
              <label>Map:</label>
              <select
                value={selectedMap}
                onChange={(e) => setSelectedMap(e.target.value)}
              >
                {maps.map((map) => (
                  <option key={map.id} value={map.id}>
                    {map.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="setting-group">
              <label>Deployment Time:</label>
              <select
                value={deploymentTime}
                onChange={(e) => setDeploymentTime(Number(e.target.value))}
              >
                <option value={60}>1 minute</option>
                <option value={180}>3 minutes</option>
                <option value={300}>5 minutes</option>
              </select>
            </div>

            <div className="setting-group">
              <label>Game Time (per player):</label>
              <select
                value={gameTime}
                onChange={(e) => setGameTime(Number(e.target.value))}
              >
                <option value={60}>1 minute</option>
                <option value={180}>3 minutes</option>
                <option value={240}>4 minutes</option>
                <option value={600}>10 minutes</option>
                <option value={3600}>1 hour</option>
              </select>
            </div>

            <div className="setting-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                />
                Private Match (requires code to join)
              </label>
            </div>

            <div className="button-group">
              <button className="menu-btn primary" onClick={handleHostMatch}>
                Create Room
              </button>
              <button
                className="menu-btn"
                onClick={() => {
                  soundManager.play('button_click');
                  setScreen('main');
                }}
              >
                Back
              </button>
            </div>
          </div>
        )}

        {screen === 'join' && (
          <div className="join-menu">
            <h3>Join Match</h3>

            <div className="setting-group">
              <label>Room Code:</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter room code"
                maxLength={10}
              />
            </div>

            <div className="button-group">
              <button
                className="menu-btn primary"
                onClick={handleJoinMatch}
                disabled={!joinCode.trim()}
              >
                Join Room
              </button>
              <button
                className="menu-btn"
                onClick={() => {
                  soundManager.play('button_click');
                  setScreen('main');
                }}
              >
                Back
              </button>
            </div>
          </div>
        )}

        {screen === 'ai' && (
          <div className="ai-menu">
            <h3>Play vs AI</h3>

            <div className="setting-group">
              <label>AI Difficulty:</label>
              <select
                value={aiDifficulty}
                onChange={(e) => setAiDifficulty(e.target.value)}
              >
                <option value="easy">Easy - Cadet Nova</option>
                <option value="medium">Medium - Commander Orion</option>
                <option value="hard">Hard - Admiral Vega</option>
                <option value="expert">Expert - Grandmaster Cosmos</option>
              </select>
            </div>

            <div className="setting-group">
              <label>Map:</label>
              <select
                value={selectedMap}
                onChange={(e) => setSelectedMap(e.target.value)}
              >
                {maps.map((map) => (
                  <option key={map.id} value={map.id}>
                    {map.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="setting-group">
              <label>Game Time:</label>
              <select
                value={gameTime}
                onChange={(e) => setGameTime(Number(e.target.value))}
              >
                <option value={180}>3 minutes</option>
                <option value={600}>10 minutes</option>
                <option value={3600}>1 hour</option>
              </select>
            </div>

            <div className="button-group">
              <button className="menu-btn primary" onClick={handleStartAIGame}>
                Start Game
              </button>
              <button
                className="menu-btn"
                onClick={() => {
                  soundManager.play('button_click');
                  setScreen('main');
                }}
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
