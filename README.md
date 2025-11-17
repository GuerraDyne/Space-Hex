# Hexarch - Strategic Space Combat Game

A multiplayer hex-based turn-based strategy game where you command a fleet of spaceships in tactical combat.

## Features

- **Strategic Combat**: Command 10 different ship types with unique movement capabilities
- **Multiplayer Support**: Quick match, host custom games, or play against AI
- **Smart AI Opponent**: Four difficulty levels with strategic thinking
- **Animated Graphics**: Thruster flames, laser shots, explosions, and debris
- **Time Controls**: Chess-style time management for competitive play
- **Map Editor**: Create custom maps with debris fields and deployment zones
- **Replay System**: Watch and analyze completed games turn by turn
- **Interactive Tutorial**: Learn the game mechanics step by step
- **Sound Effects**: Placeholder audio for all game events

## How to Play

### Setup
1. **Quick Match**: Find or create a game automatically
2. **Host Match**: Choose game mode (1v1, FFA, 2v2), map, and time controls
3. **Join Match**: Enter a room code for private games
4. **Play vs AI**: Select difficulty and face the computer

### Game Phases

1. **Dice Roll**: Determine turn order
2. **Zone Selection**: Choose your deployment area
3. **Deployment**: Place your fleet in your zone
4. **Battle**: Take turns moving ships and engaging enemies

### Combat Mechanics

- **Action Points (AP)**: You have 10 AP per turn to distribute among your ships
- **Movement**: Moving one hex costs 1 AP
- **Rotation**: Turning costs AP based on minimum rotations needed (max 3 AP to face opposite direction)
- **Combat**: Move onto an enemy hex to destroy them (creates debris field)
- **Debris Fields**: Entering debris reduces ship's remaining AP to 0 for that turn
- **Victory**: Destroy the enemy Mothership to win!

### Ship Types

| Ship | Max AP | Description |
|------|--------|-------------|
| Scout | 7 | Fast reconnaissance unit |
| Interceptor | 6 | Quick attack craft |
| Corvette | 6 | Light combat vessel |
| Frigate | 5 | Medium patrol ship |
| Destroyer | 5 | Anti-ship specialist |
| Cruiser | 4 | Balanced warship |
| Artillery | 3 | Long-range support |
| Battleship | 3 | Heavy assault ship |
| Mothership | 2 | Command vessel (protect at all costs!) |

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Rendering**: Canvas 2D (custom hex renderer)
- **State Management**: Zustand
- **Build Tool**: Vite
- **Audio**: Web Audio API (procedural generation)

## Project Structure

```
hexarch-game/
├── src/
│   ├── ai/              # AI opponent logic
│   ├── components/      # React UI components
│   ├── engine/          # Hex grid engine
│   ├── game/            # Game state management
│   ├── multiplayer/     # Networking code
│   ├── sounds/          # Sound effect system
│   ├── types/           # TypeScript types
│   └── App.tsx          # Main app component
├── public/
│   └── assets/ships/    # Ship sprite images
└── index.html           # Entry point
```

## Controls

- **Left Click**: Select ship or move to hex
- **Mouse Drag**: Pan camera
- **Mouse Wheel**: Zoom in/out
- **Rotation Buttons**: Change ship facing direction
- **Undo Last/All**: Revert planned moves
- **Confirm Turn**: Execute your moves

## Game Rules

1. Ships cannot pass through other units (friendly or enemy)
2. Moving onto an enemy destroys them and ends your ship's movement
3. Debris fields trap ships for the rest of their turn
4. Time runs out = you lose
5. Destroying enemy Mothership = victory!

## Future Enhancements

- Server-side multiplayer with WebSocket
- Persistent game history
- Player rankings and statistics
- Additional ship abilities (shields, special attacks)
- Campaign mode with story missions
- Mobile touch controls optimization

## License

MIT License

---

**Good luck, Commander!** May your strategies be sound and your Mothership remain protected.
