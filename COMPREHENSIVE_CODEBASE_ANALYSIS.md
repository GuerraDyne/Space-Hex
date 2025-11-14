# Space Hex Game - Comprehensive Codebase Analysis

## Executive Summary
Space Hex is a turn-based hexagonal strategy game implemented in React Native/Expo with PixiJS rendering. It's a multiplayer-capable 2D tactics game featuring 8 ship types, a mothership system with docking/cockpit mechanics, terrain features, and an AI opponent system.

**Tech Stack:**
- Frontend: React Native 0.79.5 + Expo 53.0
- Rendering: PixiJS 8.12.0 + Expo GL
- Networking: Colyseus 0.16.19 (game state sync) + Socket.io 4.8.1
- State Management: Zustand 5.0.7
- Audio: Expo AV 15.1.7
- Build: TypeScript 5.8.3, Babel, Metro bundler

---

## 1. PROJECT STRUCTURE & ENTRY POINTS

### Directory Structure
```
/home/user/Space-Hex/
├── App.tsx                                  # Main React Native entry point (4,694 lines)
├── index.ts                                 # Root index
├── src/
│   ├── components/                          # React components
│   │   ├── HexGameBoard.tsx                # Main game board component (4,694 lines)
│   │   ├── ActionPointMovement.tsx         # Movement mechanics UI
│   │   ├── MovementPatternEditor.tsx       # Debug tool for movement patterns
│   │   └── ui/                             # UI components
│   │       ├── FleetPool.tsx               # Ship selection panel
│   │       ├── GameTimer.tsx               # Turn timer display
│   │       ├── MultiplayerMenu.tsx         # Multiplayer lobby/matchmaking
│   │       ├── MultiplayerLobby.tsx        # Game session management
│   │       ├── AISetupMenu.tsx             # AI difficulty selection
│   │       ├── SimpleLobby.tsx             # Basic game setup
│   │       └── SplashScreen.tsx            # Intro screen
│   ├── ai/                                  # AI systems
│   │   ├── AIController.tsx                # AI turn executor (move delays/sequencing)
│   │   ├── AIOpponent.ts                   # High-level AI decision making
│   │   └── HexarchAI.ts                    # Core AI algorithm (move generation, scoring)
│   ├── services/                            # Network & data services
│   │   ├── MultiplayerService.ts           # Socket.io networking
│   │   ├── ColyseusService.ts              # Colyseus room management
│   │   ├── StateSyncManager.ts             # Game state synchronization
│   │   ├── SessionManager.ts               # Game session lifecycle
│   │   └── AchievementManager.ts           # Player stats & achievements
│   ├── stores/                              # Zustand state management
│   │   └── gameStore.ts                    # Centralized game state
│   ├── systems/                             # Game systems
│   │   ├── SoundSystem.ts                  # Audio management (Expo AV)
│   │   └── PerformanceManager.ts           # Frame rate monitoring & optimization
│   ├── config/                              # Game configuration
│   │   ├── shipMovementPatterns.ts         # Movement pattern definitions & hex math
│   │   └── actionPointConfig.ts            # Action point system configuration
│   ├── campaign/                            # Single-player campaign
│   │   └── CampaignManager.ts              # Campaign progression system
│   ├── multiplayer/                         # Networking types
│   │   └── types.ts                        # Network message & session types
│   ├── assets/                              # Game assets
│   │   ├── AssetManager.ts                 # Asset loading system
│   │   ├── ships/                          # Ship sprite images (8 types × 4 colors)
│   │   │   ├── Blue/Red/Green/Yellow Artillery.png
│   │   │   ├── Blue/Red/Green/Yellow Battleship.png
│   │   │   ├── Blue/Red/Green/Yellow Corvette.png
│   │   │   ├── Blue/Red/Green/Yellow Cruiser.png
│   │   │   ├── Blue/Red/Green/Yellow Destroyer.png
│   │   │   ├── Blue/Red/Green/Yellow Interceptor.png
│   │   │   ├── Blue/Red/Green/Yellow Scout.png
│   │   │   └── Blue/Red/Green/Yellow_Command_Ship.png (mothership)
│   │   ├── Meteor_01-10.png                # Terrain obstacles
│   │   ├── Debris.png                      # Debris field marker
│   │   └── ...other assets
│   └── utils/                               # Utilities
│       ├── Logger.ts                       # Debug logging system
│       └── testMovementConsistency.ts      # Movement validation tests
├── server/                                  # Backend (Node.js/TypeScript)
│   ├── src/
│   │   ├── index.ts                        # Server entry point (Colyseus)
│   │   ├── app.config.ts                   # Server configuration
│   │   ├── rooms/
│   │   │   ├── HexGameRoom.ts              # Multiplayer game logic
│   │   │   ├── AIGameRoom.ts               # AI game logic
│   │   │   └── schema/
│   │   │       └── HexGameState.ts         # Colyseus state schema
│   │   ├── ai/
│   │   │   └── HexarchAI.ts                # Server-side AI
│   │   └── data/
│   │       └── movement-patterns.json      # Movement pattern config (JSON backup)
│   └── package.json                        # Server dependencies
├── Hex_Game_Maker/                         # Separate map editor project (unused)
├── package.json                            # Frontend dependencies
├── tsconfig.json                           # TypeScript config
└── Documentation files:
    ├── README.md                           # Full project documentation
    ├── ELIMINATION_TEST_SUMMARY.md         # Player elimination system docs
    ├── MULTIPLAYER_FIXES_SUMMARY.md        # Network fixes documentation
    └── ROTATION_AND_ANIMATION_SUMMARY.md   # Ship rotation system docs
```

### Main Entry Points

**Client Entry:** `App.tsx` (React Native main component)
- Manages game phases: splash → multiplayer menu → game board
- Handles state transitions: lobby → deployment → playing → ended
- Integrates all UI components and game systems
- Manages player session lifecycle

**Server Entry:** `server/src/index.ts` (Colyseus listen)
- Hosts HexGameRoom and AIGameRoom
- Uses Colyseus for real-time state synchronization
- Default port: 2567 (ws://localhost:2567)

**Game Board:** `HexGameBoard.tsx`
- 91-hex board (11x11 hexagonal shape)
- Hex coordinate system: columns a-l, rows 1-11
- Renders ships, terrain, deployment zones
- Handles player interactions (hex taps, ship selections)

---

## 2. CORE GAME MECHANICS & FLOW

### Game Phases

```
Splash Screen
    ↓
Multiplayer Menu (Quick Match / Host / Join / AI / Campaign)
    ↓
Zone Selection (players choose corner spawn areas)
    ↓
Deployment Phase (each player places ships for 3 minutes)
    ↓
Playing Phase (alternating turns)
    ↓
Game End (victory/resignation/elimination)
    ↓
Game Review / Return to Menu
```

### Turn System

**Turn Phases (each player turn):**
1. **Movement Phase:** Move mothership + 1 other ship
2. **Ship Actions:** Use remaining Action Points (AP) for moves/rotations
3. **Combat:** Attacks happen during movement (ramming)
4. **End Turn:** Pass control to next non-eliminated player

**Turn Timer:**
- Deployment: 180 seconds (3 minutes)
- Regular turn: 180 seconds (configurable)
- Players auto-skipped when timer expires

### Ship System

**8 Ship Types:**

| Type | Role | Max AP | Movement Pattern | Special |
|------|------|--------|------------------|---------|
| Fleet Admiral (Cruiser) | Leader | 7 AP | F:2, FS:1, S:0, B:0 | Can pilot mothership, unlimited movement |
| Captain (Battleship) | Leader | 7 AP | F:2, FS:1, S:0, B:0 | Can pilot mothership, unlimited movement |
| Destroyer | Heavy | 7 AP | F:2, FS:1, S:0, B:0 | Royal unit (benefits from mothership capture) |
| Artillery | Ranged | 6 AP | F:3, FS:2, S:1, B:0 | Range attack specialist (3 hex range) |
| Interceptor | Fighter | 4 AP | F:4, FS:3, S:1, B:0 | Fast on sides 1,3,5 (can rotate while moving) |
| Corvette | Balanced | 5 AP | F:3, FS:2, S:1, B:1 | Fast on sides 2,4,6 (can rotate while moving) |
| Scout | Scout | 3 AP | F:5, FS:3, S:2, B:1 | Most agile (free rotation) |
| Mothership | Command | 1 AP | Omnidirectional | 2-hex (Dock+Cockpit), special mechanics |

**Movement Pattern Notation:**
- F = Forward hexes
- FS = Forward-side (diagonal) hexes
- S = Side hexes
- B = Backward hexes

**Fleet Composition (per player):**
- 1 Mothership (mandatory)
- 1 Fleet Admiral/Captain
- 1 Destroyer
- 2 Artillery
- 2 Interceptors
- 2 Corvettes
- 2 Scouts
- **Total: 12 ships per player**

### Mothership System (2-Hex Design)

**Structure:**
- **Dock hex:** Front hex (where ships board)
- **Cockpit hex:** Back hex (victory condition: capture for 1 turn)

**Mechanics:**
1. **Docking:** Other ships can enter mothership dock (hidden from board)
2. **Piloting:** Only Fleet Admiral/Captain can pilot mothership
3. **Ramming:** Mothership can ram enemy ships
4. **Capture:** Capturing cockpit + holding for 1 turn = victory
5. **Movement:** Omnidirectional (no rotation needed), 1 hex per turn

**Victory via Mothership:**
- Enter enemy cockpit hex
- Hold for 1 full turn (opponent cannot capture back)
- Auto-win declared

### Combat System

**Attack Types:**
1. **Ramming:** Any ship can ram during movement (move to occupied hex)
2. **Engagement:** Ships adjacent/same hex damage each other

**Attack Strength (by ship type):**
```
Fleet Admiral/Captain: 4 damage
Destroyer: 2 damage
Corvette: 1 damage
Other ships: Cannot attack
```

**Damage & Destruction:**
- Ships have 100 health
- One hit = destruction (100 damage per engagement)
- Destroyed ships removed from board
- Create debris fields (20 hex area)

**Elimination Conditions:**
1. All ships destroyed → player eliminated
2. All nearby players defeated → auto-win
3. Resignation → manual elimination

### Terrain System

**Map Features:**
1. **Meteors:** Obstacles, cannot move through (10 locations on Classic map)
2. **Debris Fields:** Created after ship destruction, slow/block movement
3. **Plains:** Standard movement (no restrictions)
4. **Asteroids:** Sparse obstacles
5. **Nebula:** Special visual area
6. **Space Stations:** Stationary objectives

**Deployment Zones (4 corners):**
- Zone 1 (Top-Right): Faces West (270°)
- Zone 2 (Bottom-Right): Faces West (270°)
- Zone 3 (Bottom-Left): Faces East (90°)
- Zone 4 (Top-Left): Faces East (90°)

Each player can only deploy in their assigned zone initially.

### Action Point System

**Movement Cost:** 1 AP per hex moved forward
**Rotation Cost:** 1 AP per 60° rotation (varies by ship)
**Special Rules:**
- Scout: Free rotation
- Interceptor/Corvette: Can rotate during move
- Frigate/Destroyer/Cruiser: Rotate costs full AP

---

## 3. ASSETS INVENTORY

### Ship Sprites

**Location:** `/home/user/Space-Hex/src/assets/ships/`

**Complete List (32 files):**
```
Blue Artillery.png
Blue Battleship.png
Blue Corvette.png
Blue Cruiser.png
Blue Destroyer.png
Blue Interceptor.png
Blue Scout.png
Blue_Command_Ship.png

Red Artillery.png
Red Battleship.png
Red Corvette.png
Red Cruiser.png
Red Destroyer.png
Red Interceptor.png
Red Scout.png
Red_Command_Ship.png

Green Artillery.png
Green Battleship.png
Green Corvette.png
Green Cruiser.png
Green Destroyer.png
Green Interceptor.png
Green Scout.png
Green_Command_Ship.png

Yellow Artillery.png
Yellow Battleship.png
Yellow Corvette.png
Yellow Cruiser.png
Yellow Destroyer.png
Yellow Interceptor.png
Yellow Scout.png
Yellow_Command_Ship.png
```

### Terrain Assets

**Location:** `/home/user/Space-Hex/src/assets/`

```
Meteor_01.png - Meteor_10.png          # 10 different meteor sprites
Debris.png                             # Debris field marker
Hexagonal_chess.svg                    # Reference hex board layout
hexarch_icon.gif                       # Game logo/icon
hexarch_intro_video.mp4                # Intro video
```

### UI Assets

```
Icon.png                               # App icon
adaptive-icon.png                      # Adaptive icon (Android)
splash-icon.png                        # Splash screen
favicon.png                            # Web favicon
button_arrow_left.png                  # Navigation button
button_arrow_right.png                 # Navigation button
```

### Audio System (Structure, files not present)

**Sound Effects (defined in SoundSystem.ts):**
```
laser_fire              - Weapon discharge
explosion_small         - Ship destruction
explosion_large         - Mothership destruction
ship_move               - Movement confirmation
ship_select             - UI selection
mothership_dock         - Docking ship
mothership_undock       - Undocking ship
ui_tap                  - Button click
ui_error                - Invalid action
ui_success              - Action confirmed
combat_hit              - Damage received
debris_impact           - Debris collision
```

**Music Tracks (defined in SoundSystem.ts):**
```
main_theme              - Menu/lobby music
combat_music            - Active battle music
ambient_space           - Background ambience
```

**Status:** Audio system is implemented but sound files are missing (would be loaded from `assets/sounds/` and `assets/music/`)

---

## 4. MULTIPLAYER & NETWORKING IMPLEMENTATION

### Architecture

**Client-Side Services:**

1. **MultiplayerService.ts** (Socket.io)
   - Connection management with reconnect logic
   - Message queue for offline operations
   - Heartbeat monitoring (30-second interval)
   - Max 5 reconnect attempts with 2-second delay
   - Error handling and event emission

2. **ColyseusService.ts** (Colyseus)
   - Room management (create, join, list)
   - Quick match (joinOrCreate on "hex_game" room)
   - Private match hosting/joining
   - Room state sync via Colyseus schema

3. **StateSyncManager.ts**
   - Merges server state with local state
   - Conflict resolution for simultaneous moves
   - Sequence numbers for ordering
   - Checksum validation

4. **SessionManager.ts**
   - Game session lifecycle
   - Player tracking
   - Spectator mode
   - Reconnection handling

### Server-Side Implementation

**Server Tech:** Colyseus 0.16.19 (WebSocket-based multiplayer framework)

**Server Entry Point:** `/server/src/index.ts`
- Listens on port 2567
- Colyseus tools framework
- Automatic room instance management

**Room Classes:**

1. **HexGameRoom.ts** (Multiplayer games)
   ```typescript
   maxClients: 4
   autoDispose: false
   gameMode: '1v1' | 'ffa' | '2v2'
   
   Events:
   - "ready" - Player ready for game
   - "selectZone" - Zone selection during setup
   - "deployShip" - Ship deployment action
   - "moveShip" - Movement action
   - "endTurn" - Turn completion
   - Various game flow messages
   ```

2. **AIGameRoom.ts** (Single-player vs AI)
   - Handles AI opponent integration
   - Auto-deployment of AI ships
   - Difficulty levels: easy/medium/hard
   - Timers: 180s deployment, 180s turns

**State Schema:** (HexGameState.ts)
```typescript
Players: Map<string, Player>
Ships: Array<Ship>
GamePhase: "waiting" | "deployment" | "playing" | "ended"
CurrentTurn: string (player ID)
TurnNumber: number
MapType: string
GameMode: "1v1" | "ffa" | "2v2"
Winner: string (player ID on game end)
MoveHistory: Array<GameMove>

Player Schema:
- id, name, isHost, isReady
- assignedZone (1-4)
- isAI, isEliminated
- deploymentTimeRemaining, turnTimeRemaining
- team (0 for no team)
- eliminationReason

Ship Schema:
- id, type, owner, color
- col (a-l), row (1-11)
- health, orientation (0-5)
- rotation (degrees for visual)

GameMove Schema:
- turnNumber, playerId, playerName
- action: "move" | "rotate" | "combat" | "endTurn"
- shipId, shipType, from/to positions
- fromOrientation, toOrientation
- targetShipId (for combat)
- timestamp
```

### Network Message Types

**Session Management:**
- JOIN_SESSION
- LEAVE_SESSION
- SESSION_UPDATE
- PLAYER_JOINED
- PLAYER_LEFT

**Game Flow:**
- GAME_START
- GAME_END
- GAME_PAUSE
- GAME_RESUME

**Player Actions:**
- SHIP_MOVE
- SHIP_DEPLOY
- MOTHERSHIP_DEPLOY
- MOTHERSHIP_MOVE
- COCKPIT_ENTER
- COCKPIT_EXIT
- DOCK_ENTER
- DOCK_EXIT
- END_TURN

**State Sync:**
- STATE_SYNC (full game state)
- STATE_REQUEST (request full state)

**Communication:**
- CHAT_MESSAGE
- EMOTE

**System:**
- HEARTBEAT (keep-alive)
- ERROR
- RECONNECT

### Game Modes

1. **Quick Match** (FFA)
   - joinOrCreate "hex_game" room
   - Public visibility
   - Up to 4 players
   - Auto-start when 2+ ready

2. **Private Match** (Host Mode)
   - Create private room
   - Share room ID (6-character code)
   - Invite friends via ID
   - Host controls start

3. **Team Match** (2v2)
   - Create team room
   - Players assigned to teams: 1 or 2
   - Win condition: opponent team eliminated

4. **AI Practice** (1v1 vs AI)
   - Single-player against AI
   - Configurable difficulty
   - Custom timers
   - Practice deployment/tactics

### Connection Flow

```
Client connects to ws://localhost:2567

Quick Match:
1. Click "Quick Match"
2. colyseusService.quickMatch() 
3. Client.joinOrCreate("hex_game", {isPublic: true, ...options})
4. Server creates or joins existing room
5. onStateChange listener updates player list
6. When ready: send "ready" message
7. Server broadcasts "gameStarted"
8. Game initializes

Private Match (Host):
1. Click "Host Match" → "Private Match"
2. colyseusService.hostMatch(playerName, false, options)
3. Server creates private room
4. Room ID displayed (room.roomId)
5. Host can start when players joined

Private Match (Join):
1. Click "Join Match"
2. Enter opponent's room ID
3. colyseusService.joinMatch(roomId, playerName)
4. Server finds room by ID
5. Join existing room
6. Wait for host to start

Reconnection:
1. Connection drops (network loss)
2. Client attempts reconnect (max 5 attempts)
3. 2-second delay between attempts
4. If reconnected during game: request full state
5. StateSyncManager merges server state with local
6. Game resumes with synced board
```

### Multiplayer Issues Fixed

**Issue 1: Multiple Concurrent Games**
- Problem: Only one multiplayer game could run
- Solution: HexGameRoom.onAuth() filters non-started games
- Result: Multiple games can run simultaneously

**Issue 2: Private Room ID Display**
- Problem: Hosts couldn't share room ID
- Solution: Room ID already displayed (room.roomId property)
- Result: Clear "Room ID: XXXXXX" display in host menu

**Issue 3: Unnecessary Info Bar**
- Problem: Top bar showed redundant game info
- Solution: Removed status container from App.tsx
- Result: Cleaner UI, game phase shown in relevant sections

---

## 5. MAP SYSTEM & TERRAIN

### Map Dimensions

**Board Layout:**
- 91 hexagonal tiles total
- 11×11 hexagon arrangement (larger hexagon shape)
- Column labels: a-l (12 columns)
- Row labels: 1-11

**Hex Coordinate System:**

The game uses **odd-r offset coordinates:**
- Column: a (index 0) to l (index 11)
- Row: 1 to 11
- Odd rows (1, 3, 5, ...) are shifted right by 0.5 hex width

**Hex Direction Mapping (6 directions):**
```
       NE (5)  NW (4)
          \    /
      E(0)-[HEX]-W(3)
          /    \
       SE (1)  SW (2)

0 = East (right)
1 = Southeast (bottom-right)
2 = Southwest (bottom-left)
3 = West (left)
4 = Northwest (top-left)
5 = Northeast (top-right)
```

### Available Map Types

**1. Classic Map**
- Default starting map
- Feature locations:
  ```
  Meteors at: c5, c10, i7, i2, e6, e7, g6, g5
  Debris at: f4, f8, d7, h5
  ```
- Balanced layout
- Medium difficulty

**2. Graveyard Map**
- Heavy debris fields
- Many wrecks from previous battles
- Movement-restrictive terrain
- High difficulty

**3. Meteor Shower Map**
- Dense meteor clusters
- Limited movement corridors
- Encourages aggressive play
- Strategic chokepoints

**4. Random Map**
- Procedurally generated each game
- Variable meteor/debris placement
- Different each time
- High replay value

### Deployment Zones

**Zone 1 (Top-Right):**
- Rows 1-4, Columns i-l
- Initial facing: 270° (West)
- Diagonal opposite to Zone 3

**Zone 2 (Bottom-Right):**
- Rows 8-11, Columns i-l
- Initial facing: 270° (West)
- Diagonal opposite to Zone 4

**Zone 3 (Bottom-Left):**
- Rows 8-11, Columns a-d
- Initial facing: 90° (East)
- Diagonal opposite to Zone 1

**Zone 4 (Top-Left):**
- Rows 1-4, Columns a-d
- Initial facing: 90° (East)
- Diagonal opposite to Zone 2

### Terrain Mechanics

**Obstacles (Cannot Move Through):**
- Meteors (defined by map type)
- Other ships
- Deployed enemy units

**Debris Fields (Slow Movement):**
- Created when ships destroyed
- 20-hex area around destruction
- Affects all future movement in area
- Visual warning marker (Debris.png)

**Hex Math Implementation:** (shipMovementPatterns.ts)

```typescript
// Convert offset coordinates to cube coordinates for distance calculations
offsetToCube(col: number, row: number) {
  const x = col - (row - (row & 1)) / 2;
  const z = row;
  const y = -x - z;
  return { x, y, z };
}

// Calculate hex distance
hexDistance(hex1, hex2) {
  const cube1 = offsetToCube(hex1);
  const cube2 = offsetToCube(hex2);
  return (Math.abs(cube1.x - cube2.x) + 
          Math.abs(cube1.y - cube2.y) + 
          Math.abs(cube1.z - cube2.z)) / 2;
}

// Get direction from one hex to another
getHexDirection(fromCol, fromRow, toCol, toRow): 0-5
```

**Movement Validation:**

Ships can only move in certain directions based on:
1. Current orientation (facing direction)
2. Ship movement pattern (max hexes in each direction)
3. Terrain obstacles
4. Other ships in path
5. Orientation rules (rotation costs/constraints)

---

## 6. KNOWN ISSUES & ERROR PATTERNS

### Critical Issues

**Issue 1: Dual Rotation System Conflict**
- **Location:** HexGameBoard.tsx (lines 97-98, 2366-2372)
- **Problem:** Ships have both `rotation` (degrees: 0-360) and `orientation` (0-5) properties
- **Risk:** Inconsistent facing direction, confusing conversion functions
- **Impact:** Movement calculations may use wrong facing
- **Workaround:** Use degrees ONLY (0, 60, 120, 180, 240, 300)
- **Fix:** Remove orientation field, use rotation exclusively

**Issue 2: Misaligned Direction Mappings**
- **Location:** HexGameBoard.tsx (lines 605-612, 2374-2380)
- **Problem:** Direction arrays and rotation angle calculations don't align
- **Examples:**
  ```
  Line 2366-2372: Comments say "orientation is shifted by one from visual"
  Line 605-612: Rotation angles don't match 60° increments
  ```
- **Impact:** Ships face wrong directions after deployment/movement
- **Fix:** Standardize on 60° increments (0°, 60°, 120°, 180°, 240°, 300°)

**Issue 3: Global State Hacks**
- **Location:** HexGameBoard.tsx (lines 475, 490, 1704-1705, 1720-1721)
- **Problem:** `pendingFacingUpdates` stored on `window` object
- **Impact:** Race conditions in multiplayer, state corruption
- **Fix:** Use React state or Zustand store instead

### High-Priority Issues

**Issue 4: Excessive Console Logging**
- **Count:** 115+ console.log statements in codebase
- **Location:** HexGameBoard.tsx has 63 instances alone
- **Performance:** Slight slowdown on low-end devices
- **Best Practice:** Use Logger.ts system instead
- **Migration:** Replace `console.log()` with `logger.debug()`

**Issue 5: Dead Code & Unused Features**
- Timer component (HexGameBoard lines 4137-4199): Disabled but still renders
- Unused ship properties: `isMoving`, `targetRotation`
- TODO comments (line 3097): Incomplete feature
- **Cleanup:** Remove disabled code, unused properties

**Issue 6: Redundant Asset Definitions**
- Ship images defined multiple times with varying names
- Typo inconsistency: "Destoyer" variant exists
- **Impact:** Asset loading confusion, potential memory duplication
- **Fix:** Single asset map with standardized naming

**Issue 7: Scattered Movement Logic**
- Movement calculations in multiple files
- Direction arrays defined in multiple locations
- Rotation cost calculations scattered across code
- **Solution:** Centralize in `shipMovementPatterns.ts`

### Medium-Priority Issues

**Issue 8: File Size & Complexity**
- HexGameBoard.tsx: 4,694 lines (extremely long component)
- App.tsx: 71,768 lines (massive main file)
- **Best Practice:** Break into smaller, focused components
- **Recommendation:** Extract logic into custom hooks

**Issue 9: Error Handling Gaps**
- Missing validation for invalid hex coordinates
- No recovery for network message failures
- Incomplete error messages to users
- **Impact:** Silent failures, player confusion

**Issue 10: Performance Warnings**
- No optimization for large ship counts
- Particle system may struggle on low-end devices
- Missing draw call batching in PixiJS renderer
- **Solution:** Implement PerformanceManager adaptive quality

### Known Workarounds

**Workaround 1: Movement Pattern Mismatch**
- Server uses different movement patterns than client
- `/server/data/movement-patterns.json` has simplified values
- **Status:** Server patterns need updating to match client

**Workaround 2: AI Deployment**
- AI ships sometimes deploy outside assigned zones
- Caused by timing issues with auto-deploy
- **Mitigation:** Add validation before deployment confirmation

**Workaround 3: Debris Field Calculation**
- 20-hex debris radius sometimes miscalculates on map edges
- **Cause:** Hex distance formula doesn't account for wraparound
- **Fix:** Add boundary checks in debris spawn logic

### Testing Coverage

**Test Files:**
- `/test-ai-game.js` - AI gameplay test
- `/test-concurrent-games-v2.js` - Multiple game instances
- `/test-private-room-flow.js` - Private match flow
- `/test-private-room.js` - Room creation
- `server/test/MyRoom_test.ts` - Server room tests

**Missing Tests:**
- Movement validation edge cases
- Network reconnection scenarios
- Campaign progression
- Achievement unlocking
- Map generation (Random map)

### Bug Patterns to Avoid

When porting to Godot:

1. **Don't** use global variables for game state
2. **Don't** mix orientation (0-5) with rotation (degrees)
3. **Don't** calculate movement without validating terrain
4. **Don't** skip Colyseus/networking state sync
5. **Don't** assume synchronous asset loading
6. **Don't** implement movement patterns in multiple places

---

## 7. AI SYSTEM

### AI Architecture

**Components:**

1. **HexarchAI.ts** (Core algorithm)
   - Move generation
   - Position evaluation
   - Move scoring
   - Strategic planning

2. **AIController.tsx** (Execution)
   - Turn sequencing
   - Move delays (for visibility)
   - Difficulty-based pacing

3. **AIOpponent.ts** (High-level)
   - Deployment phase decisions
   - Game phase strategy
   - Personality-based tactics

### AI Ship Values & Priorities

```typescript
SHIP_VALUES: {
  mothership: 1000 (infinite - must protect)
  battleship: 8
  cruiser: 6
  destroyer: 5
  corvette: 4
  interceptor: 3
  scout: 2
  frigate: 2
}

SHIP_AP (Action Points): {
  mothership: 3
  battleship: 3
  cruiser: 4
  destroyer: 5
  corvette: 6
  interceptor: 7
  scout: 8
  frigate: 8
}

COMBAT_STRENGTH: {
  mothership: 0 (cannot attack)
  battleship: 4
  cruiser: 3
  destroyer: 2
  corvette: 1
  interceptor: 0
  scout: -1
  frigate: -1
}
```

### AI Decision Making

**Move Generation Process:**
1. Identify all ships with remaining AP
2. Find all reachable hexes for each ship
3. Generate move options:
   - Regular moves to empty hexes
   - Combat moves to occupied hexes
   - Rotation moves in place
4. Score each move

**Move Scoring Factors:**
1. **Threat Assessment** (±50 points)
   - Threats to our mothership
   - Threats to enemy mothership

2. **Material Advantage** (×10 points)
   - Ship values: my material vs enemy material

3. **Distance Calculation** (minus points)
   - Distance to enemy mothership
   - Closer = better for attacking

4. **Board Evaluation**
   - Mothership safety
   - Fleet positioning
   - Territorial control

**Difficulty Levels:**

- **Easy** (delay: 1500ms)
  - Random move selection
  - Poor threat assessment
  - Conservative tactics

- **Medium** (delay: 1000ms)
  - Balanced strategy
  - Some threat awareness
  - Tactical piece trades

- **Hard** (delay: 500ms)
  - Aggressive attack
  - Strong threat assessment
  - Optimal move sequences

### AI Personalities

**Named Opponents:**
- Cadet Nova (Beginner)
- Lieutenant Astro (Intermediate)
- Commander Vega (Advanced)
- Admiral Nexus (Expert)
- Grandmaster Cosmos (Master)

### Campaign Scenarios

**3 Campaign Tiers:**

1. **Space Fleet Academy** (Learning)
   - Tutorial missions
   - Basic movement
   - Simple combat

2. **Basic Fleet Tactics** (Intermediate)
   - Multi-ship coordination
   - Terrain usage
   - Defense strategies

3. **Advanced Fleet Warfare** (Expert)
   - Complex tactics
   - Mothership mechanics
   - High-difficulty AI

**Progress Tracking:**
- Stars earned per scenario (1-3)
- Total campaign stars accumulated
- Unlocked campaigns based on progress
- Reward system (experience, titles, cosmetics)

---

## 8. KEY FEATURES & GAME SYSTEMS

### 1. Deployment System

**Process:**
1. Zone Selection (1-4 min per player)
   - Players choose spawn corner
   - Opposite zone auto-assigned in 2-player games
   
2. Deployment Phase (3 min total)
   - Place mothership first
   - Deploy remaining 11 ships
   - Can redeploy by clicking hex again
   - Auto-deploy available

3. Confirmation
   - All players must confirm
   - Cannot modify after confirmation
   - Timer expires = auto-confirm

### 2. Turn System

**Per-Turn Actions:**
- Move mothership + 1 other ship
- Use remaining AP for rotations/additional moves
- Combat happens during movement
- End turn to pass to next player

**Turn Order:**
- Sequential by player ID
- Skip eliminated players
- Wrap around to first player

**Timer Management:**
- Visual countdown (GameTimer component)
- Auto-skip on timeout
- Different times per game mode

### 3. Combat System

**Combat Mechanics:**
- Ships in same hex automatically engage
- Ramming damage = 100 HP (instant kill)
- One hit per engagement
- Destroyed ships removed immediately

**Combat Events Trigger:**
- Animation system (thrusters, weapons, explosions)
- Sound effects (combat_hit, explosions)
- Debris field creation
- Player elimination check

### 4. Ship Rotation System

**Initial Rotation (by zone):**
```
Zone 1 (Top-Right): 270° (facing West)
Zone 2 (Bottom-Right): 270° (facing West)
Zone 3 (Bottom-Left): 90° (facing East)
Zone 4 (Top-Left): 90° (facing East)
```

**Dynamic Rotation:**
- Ships rotate to face movement direction
- Smooth CSS rotation applied
- Rotation angle calculated from hex direction
- Updated each move

### 5. Achievement & Progression System

**50+ Achievements:**
- Combat achievements (damage dealt, ships destroyed)
- Strategy achievements (mothership captured, territory control)
- Collection achievements (unlock all ship types)
- Social achievements (multiplayer wins)
- Mastery achievements (difficult objectives)

**Rarity Tiers:**
- Common
- Uncommon
- Rare
- Epic
- Legendary

**Secret Achievements:**
- Hidden challenges
- Bonus objectives
- Easter eggs

**Progress Tracking:**
- Real-time statistics
- Achievement progress bars
- Unlocked content registry
- Reward system (experience, titles, cosmetics)

### 6. Campaign System

**Structure:**
- 3 progressive campaign tiers
- 15+ unique scenarios
- Unlocking based on prior completion
- Star-based performance tracking

**Scenario Objectives:**
- Elimination: Defeat all enemies
- Survival: Last X turns alive
- Capture: Control mothership
- Collection: Specific fleet requirements

**Rewards:**
- Experience points
- Star ratings (1-3 per scenario)
- Special unlocks
- Cosmetic items

### 7. Audio System

**Sound Categories:**
- Sound Effects (combat, UI, movement)
- Music (menu, combat, ambient)
- Voice (could be added)

**Volume Controls:**
- Master volume
- Effects volume
- Music volume
- Individual sound toggles

**Implementation:**
- Expo AV for audio playback
- Spatial audio ready
- Mute on silent mode (mobile)

### 8. Performance Optimization

**PerformanceManager System:**
- Real-time FPS monitoring
- 60fps target
- Adaptive quality adjustment
- Particle count limiting
- Draw call batching
- Texture memory management

**Optimization Tiers:**
- Low: Reduced particles, basic animations
- Medium: Balanced performance
- High: Full effects, smooth animations

### 9. Multiplayer Features

**Game Modes:**
- Free-for-All (4 players)
- 1v1 (2 players)
- 2v2 (4 players, teams)
- Quick Match (auto-matchmaking)
- Private Match (friends)

**Social Features:**
- Chat messages (global)
- Emotes (location-based)
- Player profiles (coming)
- Ranking system (coming)
- Replay system (coming)

### 10. Mobile Optimization

**Touch Controls:**
- Pan with inertia
- Pinch to zoom
- Tap for selection
- Hold for context menu

**UI Responsive:**
- Adapts to screen size
- Scales for different devices
- Portrait & landscape modes
- Safe area handling

**Performance:**
- 60fps on mobile hardware
- Reduced particle count on low-end
- Texture quality adaptation
- Memory pressure handling

---

## 9. UI/UX & VISUAL DESIGN

### Game Screens

**1. Splash Screen** (SplashScreen.tsx)
- Game logo
- Loading indicator
- Intro video (optional)

**2. Main Menu** (App.tsx)
- Multiplayer button
- Campaign button
- Achievements button
- Settings

**3. Multiplayer Menu** (MultiplayerMenu.tsx)
- Quick Match
- Host Match (public/private)
- Join Match (by ID)
- Browse Sessions
- Map selection
- Difficulty selection

**4. Lobby/Session** (MultiplayerLobby.tsx)
- Player list
- Ready toggle
- Chat messages
- Start countdown

**5. Deployment Screen** (HexGameBoard.tsx - Deployment Phase)
- Hex board
- Fleet pool (FleetPool.tsx)
- Zone assignment
- Confirmation button

**6. Battle Screen** (HexGameBoard.tsx - Playing Phase)
- Hex board with ships
- Active player indicator
- Turn timer (GameTimer.tsx)
- Fleet panel
- Move history
- Combat log

**7. Game End Screen** (App.tsx)
- Winner announcement
- Statistics (kills, turns, time)
- Replay option
- Return to menu

### Visual Elements

**Colors:**
- Blue: Player 1
- Red: Player 2
- Green: Player 3
- Yellow: Player 4
- Gray: Neutral/terrain

**Hex Indicators:**
- Green: Valid move target
- Yellow: Optional target
- Red: Enemy location
- Dark gray: Obstacle/blocked

**Ship Representations:**
- Vector sprites (40×40 px average)
- Rotation based on movement
- Color indicates owner
- Visual damage state (future)

### Design Patterns

**Responsive Layout:**
- Game board scales with screen
- UI elements reposition for mobile
- Touch-friendly button sizes (48px minimum)
- Landscape optimized

**Feedback Systems:**
- Sound effects for actions
- Visual highlights for selections
- Toast notifications for errors
- Haptic feedback (mobile) for actions

**Accessibility:**
- High contrast text
- Clear button labels
- Status announcements
- Support for larger text (coming)

---

## 10. BUILD & DEPLOYMENT

### Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run web          # Web version
npm run ios          # iOS simulator
npm run android      # Android emulator

# Backend server (separate terminal)
cd server
npm install
npm run build
npm start            # Starts on port 2567
```

### Production Build

```bash
# Frontend build (Expo)
expo build:web      # Web production

# Backend deployment
# Use Colyseus Cloud or self-host
# See: https://docs.colyseus.io/server/api/#constructor-options
```

### Configuration

**Client Config:**
- Server URL: `__DEV__ ? 'ws://localhost:2567' : 'wss://your-production-server.com'` (App.tsx line 32-34)
- Asset paths: Expo asset system
- Logging: Toggle in Logger.ts DEBUG_CONFIG

**Server Config:** (server/src/app.config.ts)
- Port: 2567
- Room types: hex_game, hex_game_ai
- Custom rules: Defined in room options

### Deployment Platforms

**Web:** Expo Web (production-ready)
**iOS:** Expo iOS distribution
**Android:** Expo Android APK/AAB
**Server:** Node.js (any hosting supporting WebSocket)

---

## 11. TECHNOLOGY DEPENDENCIES

### Critical Dependencies

```json
{
  "react": "19.0.0",
  "react-native": "0.79.5",
  "expo": "~53.0.20",
  "pixi.js": "^8.12.0",
  "@pixi/react": "^8.0.3",
  "colyseus.js": "^0.16.19",
  "zustand": "^5.0.7",
  "typescript": "~5.8.3",
  "expo-av": "~15.1.7",
  "expo-gl": "~15.1.7"
}
```

### Server Dependencies

```json
{
  "@colyseus/core": "^0.15.x",
  "@colyseus/tools": "^0.1.x",
  "typescript": "^4.9.x"
}
```

### Removed/Outdated

- `socket.io-client` - Listed but not used (Colyseus is primary)
- `react-native-sound` - Audio infrastructure incomplete
- `expo-gl-cpp` - Low-level GL bindings

---

## 12. CODEBASE STATISTICS

**Total Lines of Code:**
- HexGameBoard.tsx: 4,694 lines
- App.tsx: 71,768 lines
- Total React/TS: ~100,000+ lines
- Server code: ~5,000+ lines

**File Count:**
- Frontend: 28 TypeScript/TSX files
- Server: 11 TypeScript files
- Assets: 50+ image files
- Configuration: 10 JSON/config files

**Largest Components:**
1. App.tsx (71,768 lines) - Main game container
2. HexGameBoard.tsx (4,694 lines) - Game board & mechanics
3. HexGameRoom.ts (1,000+ lines) - Server game logic
4. MultiplayerMenu.tsx (800+ lines) - Matchmaking UI

---

## PORTING RECOMMENDATIONS FOR GODOT 4.5.1

### Phase 1: Core Systems
1. Hex grid system & coordinate math
2. Ship movement & rotation
3. Turn-based gameplay loop
4. Deployment system
5. Basic combat

### Phase 2: Networking
1. WebSocket server integration
2. Game state synchronization
3. Multiplayer message routing
4. Reconnection handling

### Phase 3: AI & Content
1. AI decision making
2. Campaign system
3. Achievement tracking
4. Map generation

### Phase 4: Polish
1. Audio system
2. Particle effects
3. Animations
4. UI/UX optimization

### Key Architecture Points
- Separate game logic from rendering (already done in client code)
- Use signals for event communication
- Implement Colyseus state directly in GDScript
- Leverage Godot's 2D rendering for hex grids
- Use async/await for network operations

---

## CONCLUSION

Space Hex is a well-structured, feature-complete hex strategy game with solid architecture for a React Native project. The main areas for improvement when porting to Godot are:

1. **Code organization** - Break monolithic components into smaller systems
2. **Direction/rotation consistency** - Use single coordinate system
3. **Remove global state hacks** - Proper state management
4. **Centralize game logic** - Single source of truth for rules
5. **Complete audio system** - Add missing sound files

The networking foundation via Colyseus is solid and easily portable to Godot. The game mechanics are well-thought-out and balanced. The codebase demonstrates good TypeScript practices overall.

---

**Document Generated:** November 14, 2025
**Version:** 1.0 - Complete Codebase Analysis
**Target Platform:** Godot 4.5.1 Engine
