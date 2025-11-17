# Hex Game Map Maker

A comprehensive tool for creating hexagonal grid-based strategy game maps with deployment zones, obstacles, and special terrain types.

## Features

### 🎨 Visual Map Editor
- **Interactive Canvas**: Click to place/remove hexes on an 11x11 grid
- **Pan & Zoom**: Right-click drag to pan, scroll wheel to zoom
- **Grid View**: Toggle grid visibility for precise placement
- **Real-time Preview**: See your map as you build it

### 🔧 Hex Types
Build diverse maps with 11 different hex types:
- **Normal**: Standard playable hexes
- **Deployment**: Starting zones for players (6 color-coded zones)
- **Obstacle**: Impassable terrain
- **Debris**: Slows movement, consumes all AP
- **Meteor**: Destructive obstacles
- **Nebula**: Vision-obscuring areas
- **Asteroid**: Defensive positions
- **Space Station**: Strategic points
- **Wormhole**: Instant travel points
- **Powerup**: Bonus locations
- **Objective**: Capture points for victory

### 🎯 Deployment Zones
- Up to 6 different colored zones
- Define spawn points per zone
- Set starting positions for each player
- Visual color coding for easy identification

### 🔄 Symmetry Tools
Create balanced competitive maps with symmetry modes:
- **Horizontal**: Mirror across horizontal axis
- **Vertical**: Mirror across vertical axis
- **Rotational**: 180° rotation symmetry
- **None**: Freeform placement

### 📋 Map Templates
Quick-start with pre-built templates:
- **Standard Map**: Classic 91-hex hexagonal layout
- **2-Player Competitive**: Balanced East vs West zones
- **4-Player FFA**: Corner deployment zones for free-for-all
- **Capture Points**: Central objectives for territory control

### ⚙️ Game Configuration
Customize gameplay rules:
- **Max Players**: 2-6 players
- **Action Points**: 1-10 per turn
- **Win Conditions**:
  - Elimination (destroy all enemies)
  - Capture (control objectives)
  - Survival (last player standing)
  - Points (score-based victory)
- **Turn/Deployment Timers**: Configurable time limits
- **Unit Types**: Select available ships
- **Special Rules**:
  - Meteor showers
  - Debris slowdown
  - Wormhole travel
  - Respawn mechanics
  - Team modes

### 💾 Save/Load System
- Export maps as JSON files
- Load and edit existing maps
- Share maps with other players
- Version control support

## Usage

### Running the Tool
```bash
cd hex-game-maker
npm install
npm run dev
```
Open http://localhost:5173 in your browser

### Creating a Map
1. Choose a template or start from scratch
2. Select a hex type from the control panel
3. Click on the grid to place hexes
4. Use symmetry modes for balanced layouts
5. Configure game settings
6. Save your map as JSON

### Map File Format
Maps are saved as JSON with the following structure:
```json
{
  "name": "Map Name",
  "description": "Map description",
  "hexes": [
    {
      "col": "a",
      "row": 1,
      "q": 0,
      "r": 1,
      "type": "normal",
      "zone": 1
    }
  ],
  "deploymentZones": {
    "1": {
      "zone": 1,
      "name": "Zone 1",
      "color": "#4444ff",
      "hexes": ["a,1", "b,1"],
      "spawnPoints": 10,
      "isStartingZone": true
    }
  },
  "gameConfig": {
    "maxPlayers": 2,
    "actionPointsPerTurn": 5,
    "winCondition": "elimination",
    "unitTypes": ["scout", "interceptor", "corvette"],
    "turnTimer": 180,
    "deploymentTimer": 180
  }
}
```

### Integrating Maps with the Game
1. Export your map as JSON
2. Place the file in the game's maps directory
3. Load the map configuration in the game server
4. The game will use your custom hex layout and rules

## Controls

### Mouse Controls
- **Left Click**: Place/remove hex
- **Right Click + Drag**: Pan the view
- **Shift + Drag**: Alternative pan method
- **Scroll Wheel**: Zoom in/out

### Keyboard Shortcuts
- **G**: Toggle grid
- **S**: Cycle symmetry modes
- **1-6**: Select deployment zone
- **Esc**: Clear selection

## Map Design Tips

### Balance Considerations
- Use symmetry for competitive maps
- Ensure equal access to resources
- Balance deployment zone sizes
- Consider movement distances
- Place obstacles strategically

### Strategic Elements
- Create choke points with obstacles
- Use debris fields for area denial
- Place objectives in contested areas
- Design multiple paths to objectives
- Consider line-of-sight blockers

### Visual Design
- Use different hex types sparingly
- Create recognizable landmarks
- Maintain clear paths
- Group similar terrain types
- Consider aesthetic appeal

## Advanced Features

### Custom Game Modes
Configure special rules to create unique gameplay:
- **King of the Hill**: Central objective control
- **Escort**: Protect the mothership
- **Resource Control**: Multiple capture points
- **Survival**: Waves of meteors
- **Race**: First to reach objectives

### Map Metadata
Add additional information to your maps:
- Author name
- Version number
- Creation/modification dates
- Recommended player count
- Suggested game mode
- Balance notes

## Troubleshooting

### Common Issues
- **Hexes not placing**: Check if grid is enabled
- **Can't pan**: Use right-click or shift+drag
- **Map won't load**: Verify JSON format
- **Performance issues**: Reduce hex count

## Future Enhancements
- Map sharing community
- AI pathfinding preview
- Balance analysis tools
- Custom hex graphics
- Terrain height levels
- Environmental hazards
- Victory condition scripting
- Campaign map chains

## Credits
Built with React, TypeScript, and Canvas API
Designed for the Hex Strategy Game Engine