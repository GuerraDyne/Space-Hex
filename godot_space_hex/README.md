# Space Hex - Godot 4.5.1 Port

A complete recreation of the Space Hex turn-based hexagonal strategy game in Godot 4.5.1, ported from the original React Native/Expo implementation.

## 🎮 Game Overview

Space Hex is a turn-based hex strategy game featuring:
- **2-4 players** with multiplayer and AI support
- **8 ship types** with unique movement patterns and abilities
- **Mothership mechanics** including docking and cockpit capture for victory
- **4 map types** with procedural generation support
- **Turn-based combat** with deployment and action phases
- **AI opponents** with 5 difficulty levels

## 📋 Project Status

### ✅ Implemented Core Systems

1. **Hex Grid Mathematics** (`hex_math.gd`)
   - Odd-R offset coordinate system
   - Direction-based movement (0-5)
   - Distance calculation and pathfinding
   - Pixel<->Hex coordinate conversion
   - **Fixed:** Single direction system (no rotation/orientation conflicts from original)

2. **Game Constants** (`game_constants.gd`)
   - All ship types and stats
   - Movement patterns
   - Action point system
   - Map configurations
   - **Fixed:** Centralized constants (avoiding scattered definitions)

3. **Ship System** (`ship.gd`)
   - 8 ship types with unique stats
   - Movement pattern enforcement
   - Action point management
   - Mothership 2-hex mechanics
   - Docking system
   - **Fixed:** Single direction property (not dual rotation/orientation)

4. **Game State Manager** (`game_state.gd`)
   - Player management
   - Ship tracking and positioning
   - Turn order management
   - Deployment zones
   - Victory conditions
   - Terrain and debris fields
   - **Fixed:** Proper state management (no global window hacks)

5. **Movement Validator** (`movement_validator.gd`)
   - Complete move validation
   - AP cost calculation
   - Terrain obstacle detection
   - Mothership special validation
   - Deployment zone validation
   - **Fixed:** Centralized movement logic (not scattered)

6. **Map Generator** (`map_generator.gd`)
   - 4 map types: Classic, Graveyard, Meteor Shower, Random
   - Procedural terrain generation
   - Deployment zone awareness
   - **Fixed:** Proper debris field calculation

7. **AI Controller** (`ai_controller.gd`)
   - Move evaluation and scoring
   - 5 difficulty levels
   - Auto-deployment
   - Strategic decision making
   - **Fixed:** Improved zone deployment validation

8. **Hex Board Renderer** (`hex_board.gd`)
   - Visual hex grid rendering
   - Ship sprite management
   - Terrain visualization
   - Movement highlighting
   - Click detection

9. **Game Controller** (`game_controller.gd`)
   - Game flow orchestration
   - Phase management
   - Turn system
   - AI integration

10. **UI Scenes**
    - Main menu (`main_menu.tscn`)
    - Game scene with HUD (`game.tscn`)
    - Turn and phase indicators

## 🗂️ Project Structure

```
godot_space_hex/
├── project.godot          # Godot 4.5.1 project file
├── README.md             # This file
├── scripts/              # Game logic scripts
│   ├── game_constants.gd
│   ├── hex_math.gd
│   ├── ship.gd
│   ├── game_state.gd
│   ├── movement_validator.gd
│   ├── map_generator.gd
│   ├── ai_controller.gd
│   ├── hex_board.gd
│   ├── game_controller.gd
│   ├── main_menu.gd
│   └── game_scene.gd
├── scenes/               # Scene files
│   ├── main_menu.tscn
│   └── game.tscn
└── assets/              # Game assets
    ├── ships/           # 48 ship sprites (8 types × 4 colors × variants)
    │   ├── Blue *.png
    │   ├── Red *.png
    │   ├── Green *.png
    │   └── Yellow *.png
    ├── terrain/         # Terrain sprites
    │   ├── Meteor_01.png - Meteor_10.png
    │   └── Debris.png
    ├── ui/              # UI assets
    │   └── button_arrow_*.png
    └── icon.png
```

## 🚀 How to Run

### Prerequisites
- **Godot Engine 4.5.1** (or compatible 4.5.x version)
- No additional dependencies required

### Running the Game

1. Open Godot Engine 4.5.1
2. Click "Import" and navigate to the `godot_space_hex` folder
3. Select `project.godot`
4. Click "Import & Edit"
5. Press F5 or click the Play button to run

The game will start at the main menu where you can:
- **Quick Match**: Start a quick FFA game
- **vs AI**: Play against AI opponent (currently implemented)
- **Host/Join Game**: Multiplayer (requires networking implementation)

## 🎯 Game Rules

### Ship Types & Stats

| Ship Type | AP | Movement Pattern | Special Ability |
|-----------|----|--------------------|----------------|
| Scout | 3 | Very agile (5/3/2/1) | Free rotation |
| Interceptor | 4 | Fast fighter (4/3/1/0) | Rotate while moving |
| Corvette | 5 | Balanced (3/2/1/1) | Rotate while moving |
| Artillery | 6 | Medium range (3/2/1/0) | Range attacks |
| Destroyer | 7 | Heavy (2/1/0/0) | High damage |
| Fleet Admiral | 7 | Leader (2/1/0/0) | Can pilot mothership |
| Captain | 7 | Leader (2/1/0/0) | Can pilot mothership |
| Mothership | 1 | Omnidirectional (1/1/1/1) | 2-hex ship, docking |

**Movement Pattern**: [Forward, Forward-Side, Side, Backward] hexes

### Victory Conditions

1. **Cockpit Capture**: Capture enemy mothership cockpit and hold for 1 turn
2. **Elimination**: Destroy all enemy ships
3. **Last Standing**: Be the last player not eliminated

### Game Phases

1. **Zone Selection**: Players choose corner deployment zones
2. **Deployment**: Place 12 ships in assigned zone (3 minutes)
3. **Playing**: Turn-based gameplay
4. **Game End**: Victory/defeat screen

### Turn Structure

Each turn:
1. Move mothership (max 1 hex)
2. Move 1 other ship
3. Use remaining Action Points for additional moves/rotations
4. Combat resolves automatically during movement
5. End turn

## 🔧 Technical Implementation

### Key Improvements Over Original

The Godot port addresses several issues from the original React Native implementation:

#### 1. **Single Direction System**
- **Original Issue**: Dual rotation system (degrees AND orientation) caused conflicts
- **Fix**: Uses only direction enum (0-5), converts to degrees for rendering only
- **Files**: `ship.gd`, `hex_math.gd`, `game_constants.gd`

#### 2. **Centralized Movement Logic**
- **Original Issue**: Movement patterns scattered across multiple files
- **Fix**: Single `movement_validator.gd` handles all validation
- **Files**: `movement_validator.gd`

#### 3. **Proper State Management**
- **Original Issue**: Global `window` object used for pending updates
- **Fix**: Proper GameState class with signals
- **Files**: `game_state.gd`

#### 4. **Cleaned Logging**
- **Original Issue**: 115+ console.log statements
- **Fix**: Minimal debug prints, easy to replace with logging system
- **Files**: All scripts

#### 5. **Modular Architecture**
- **Original Issue**: Monolithic 4,694-line HexGameBoard component
- **Fix**: Separate concerns into focused scripts
- **Files**: All scripts are <500 lines each

### Hex Coordinate System

Uses **Odd-R Offset Coordinates**:
- Columns: a-l (0-11 in code)
- Rows: 1-11
- Odd rows shifted right by 0.5 hex width

**Direction Mapping**:
```
       5(NE)  4(NW)
         \    /
     0(E)-HEX-3(W)
         /    \
       1(SE)  2(SW)
```

**Distance Formula**:
```gdscript
# Convert to cube coordinates
x = col - (row - (row & 1)) / 2
z = row
y = -x - z

# Manhattan distance in cube space
distance = (|x1-x2| + |y1-y2| + |z1-z2|) / 2
```

## 🚧 Not Yet Implemented

The following features from the original are planned but not yet implemented:

### Networking
- [ ] Colyseus WebSocket integration
- [ ] Multiplayer room management
- [ ] State synchronization
- [ ] Reconnection handling
- [ ] Quick match/private rooms

### Complete Features
- [ ] Full deployment phase UI
- [ ] Fleet selection panel
- [ ] Achievement system
- [ ] Campaign mode
- [ ] Audio system
- [ ] Particle effects
- [ ] Ship animations
- [ ] Timer system
- [ ] Chat/emotes

### Polish
- [ ] Visual effects for combat
- [ ] Smooth camera movement
- [ ] Explosion animations
- [ ] Debris field visuals
- [ ] Settings menu
- [ ] Tutorial system

## 🔌 Adding Multiplayer

To add multiplayer networking:

1. **Install WebSocket Library**
   - Add Godot WebSocket support
   - Or use third-party Colyseus client

2. **Create Network Manager** (`network_manager.gd`)
   ```gdscript
   extends Node
   class_name NetworkManager

   var ws_client: WebSocketClient
   var server_url = "ws://localhost:2567"

   func connect_to_server():
       # Connect to Colyseus server
       pass

   func join_room(room_id: String):
       # Join game room
       pass
   ```

3. **Sync Game State**
   - Send player actions to server
   - Receive state updates
   - Merge with local game_state

4. **Update GameController**
   - Add network event handlers
   - Validate moves server-side
   - Handle disconnections

See the original `server/` folder for Colyseus server implementation.

## 🎨 Asset Information

All assets are copied from the original React Native game:

- **Ship Sprites**: 48 PNG files (8 types × 4 colors × variants)
  - Blue, Red, Green, Yellow color schemes
  - Scout, Interceptor, Corvette, Artillery, Destroyer
  - Fleet Admiral (Cruiser), Captain (Battleship), Mothership

- **Terrain**: 10 meteor variations + debris marker
- **UI**: Navigation arrows, icons

**Note**: Audio assets are not included (original game had structure but no files).

## 🐛 Known Issues

1. **Deployment UI**: Basic implementation, needs polish
2. **Camera Controls**: Fixed position, needs pan/zoom
3. **Ship Selection**: Works but needs visual feedback improvements
4. **Mothership Rendering**: 2-hex ship rendering needs refinement
5. **AI Deployment**: Sometimes places ships suboptimally

## 📝 Development Notes

### Adding New Ship Types

1. Add to `GameConstants.ShipType` enum
2. Define stats in `SHIP_ACTION_POINTS`, `SHIP_HEALTH`, etc.
3. Add movement pattern to `SHIP_MOVEMENT_RANGE`
4. Add sprite assets to `assets/ships/`
5. Update `get_ship_sprite_path()` if needed

### Adding New Map Types

1. Add to `GameConstants.MapType` enum
2. Create generation function in `map_generator.gd`
3. Define obstacle patterns
4. Test deployment zone accessibility

### Debugging Tips

- Set `hex_board.show_coordinates = true` to see hex labels
- Set `hex_board.show_grid = true` to see grid lines
- Use `ship.get_debug_string()` for ship info
- Check `game_state.to_dict()` for full state

## 🤝 Contributing

This is a port of the original React Native game. To contribute:

1. Follow GDScript style guidelines
2. Keep scripts modular and focused
3. Avoid recreating original bugs (see COMPREHENSIVE_CODEBASE_ANALYSIS.md)
4. Test with both AI and multiplayer scenarios
5. Document major changes

## 📚 References

- **Original Game**: React Native/Expo implementation in parent directory
- **Analysis Docs**:
  - `COMPREHENSIVE_CODEBASE_ANALYSIS.md` - Full original game analysis
  - `QUICK_REFERENCE.md` - Quick developer reference
- **Hex Grid Math**: [Red Blob Games - Hexagonal Grids](https://www.redblobgames.com/grids/hexagons/)
- **Godot Docs**: [Godot 4.5 Documentation](https://docs.godotengine.org/en/4.5/)

## 🎮 Controls

### Mouse
- **Left Click**: Select ship / Move ship / Click hex
- **Right Click**: Deselect (planned)
- **Mouse Wheel**: Zoom (planned)
- **Middle Click Drag**: Pan camera (planned)

### Keyboard
- **Space**: End turn (planned)
- **ESC**: Open menu
- **Tab**: Cycle ships (planned)

## 📄 License

This is a port of the original Space Hex game. Refer to the original project for licensing information.

## 🔄 Version History

### v1.0.0 (Initial Port)
- ✅ Core hex grid system
- ✅ All 8 ship types with proper stats
- ✅ Movement validation
- ✅ Game state management
- ✅ 4 map types
- ✅ AI opponent with 5 difficulties
- ✅ Basic UI and rendering
- ✅ Turn-based gameplay loop
- ✅ Combat system
- ✅ Victory conditions

### Planned v1.1.0
- ⏳ Complete deployment phase UI
- ⏳ Networking/multiplayer
- ⏳ Visual effects
- ⏳ Audio system
- ⏳ Campaign mode

---

**Built with Godot 4.5.1** | **Ported from React Native/Expo** | **November 2025**
