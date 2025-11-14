# Space Hex - Quick Reference for Godot Port

## At a Glance

**Game Type:** Turn-based hex strategy (2-4 players)
**Board:** 91 hexagons in 11x11 arrangement
**Ships:** 8 types, 4 colors, 12 ships per player
**Turns:** Sequential, each turn: move mothership + 1 ship
**Victory:** Capture enemy mothership cockpit + hold 1 turn OR eliminate all opponents
**Duration:** 5-20 minutes per game

---

## Ship Types (Quick Reference)

| Name | AP | Pattern | Special |
|------|----|---------| --------|
| Scout | 3 | Fast, agile | Free rotation |
| Interceptor | 4 | Balanced fighter | Can rotate while moving |
| Corvette | 5 | Medium | Can rotate while moving |
| Artillery | 6 | Medium | Range attack (3 hex) |
| Destroyer | 7 | Slow, powerful | Royal unit |
| Fleet Admiral/Captain | 7 | Slow leader | Can pilot mothership |
| Mothership | 1 | Omnidirectional | 2-hex, special mechanics |

---

## Core Mechanics Checklist

### Deployment Phase
- [ ] Zone selection (4 corners)
- [ ] Mothership placement
- [ ] 11 ship placement in zone
- [ ] Confirmation required

### Playing Phase (Each Turn)
- [ ] Move mothership (max 1 hex)
- [ ] Move 1 other ship (any direction)
- [ ] Execute remaining AP (movement/rotation)
- [ ] Resolve combat (ramming)
- [ ] End turn

### Victory Conditions
- [ ] Cockpit capture (hold 1 turn) = auto-win
- [ ] All opponent ships destroyed = elimination
- [ ] Last player remaining = auto-win

---

## Networking (Colyseus)

**Server:** Node.js on port 2567
**Room Types:** 
- `hex_game` - Multiplayer games
- `hex_game_ai` - AI games

**Key Messages:**
```
Client → Server:
- "ready"
- "selectZone" {zone: 1-4}
- "deployShip" {shipId, col, row}
- "moveShip" {shipId, toCol, toRow}
- "endTurn"

Server → Client:
- "gameStarted"
- "stateChanged" {gameState}
- "combatResolved"
- "playerEliminated"
- "gameEnded" {winner, reason}
```

---

## Movement Pattern Math

**Odd-R Offset Coordinates:**
- Columns: a-l (index 0-11)
- Rows: 1-11
- Odd rows shifted right by 0.5

**Direction Mapping:**
```
    NE(5)  NW(4)
    \   /
E(0)-HEX-W(3)
    /   \
SE(1)  SW(2)
```

**Hex Distance Formula:**
```
// Convert to cube coords
x = col - (row - (row & 1)) / 2
z = row
y = -x - z

// Calculate distance
distance = (|x1-x2| + |y1-y2| + |z1-z2|) / 2
```

---

## File Locations (Godot Port)

### Game Logic to Port
- `/src/config/shipMovementPatterns.ts` → Movement system
- `/src/ai/HexarchAI.ts` → AI algorithm
- `/server/src/rooms/HexGameRoom.ts` → Game rules

### Assets to Convert
- `/src/assets/ships/` → 32 PNG files (need sprite conversion)
- `/src/assets/Meteor_*.png` → Terrain tiles
- `/src/assets/Debris.png` → Debris marker

### Services to Reimplement
- Colyseus integration (GDScript wrapper)
- State synchronization
- Turn timer management
- Chat/emotes system

---

## Known Gotchas

1. **Rotation vs Orientation**
   - Client uses degrees (0, 60, 120, 180, 240, 300)
   - Server sometimes uses 0-5 enum
   - Keep consistent!

2. **Movement Patterns Mismatch**
   - `/server/data/movement-patterns.json` is outdated
   - Use client-side patterns from `shipMovementPatterns.ts`

3. **Debris Field Edge Cases**
   - 20-hex radius sometimes miscalculates at map edges
   - Add boundary validation

4. **AI Zone Deployment**
   - AI sometimes deploys outside assigned zones
   - Validate before confirmation

---

## Performance Targets

- 60 FPS on mobile
- <200ms network latency for smooth gameplay
- <500 concurrent games per server
- Max 4 players per game

---

## Audio Implementation

**Missing in current build:** No actual audio files
**Audio types defined in SoundSystem.ts:**
- 12 sound effects
- 3 music tracks

**Need to implement:**
- Create/acquire sound assets
- Load from appropriate directories
- Integrate with Godot audio system

---

## Testing Scenarios

1. **Deployment:** All 4 players place ships correctly
2. **Zone Selection:** Opposite zones auto-assign in 2-player
3. **Movement:** Ships move within pattern constraints
4. **Combat:** Ships destroy on same-hex engagement
5. **Mothership:** Can dock ships, capture cockpit = win
6. **Elimination:** Losing all ships eliminates player
7. **Multiplayer Sync:** All clients see same board state
8. **Reconnect:** Dropped player can rejoin mid-game
9. **AI:** AI makes strategic moves, respects move patterns
10. **Campaign:** Scenarios unlock based on completion

---

## Assets Manifest

**Ship Sprites (32 total):**
- 8 ship types
- 4 colors
- PNG format
- ~40x40px average

**Terrain:**
- 10 meteor variations
- 1 debris marker
- Hexagon reference board

**UI:**
- App icons (3)
- Navigation buttons (2)
- Splash screen

**Audio (Structure only):**
- Needs 12 SFX + 3 music tracks

---

## Quick Port Checklist

### Phase 1: Core (Week 1-2)
- [ ] Hex grid system
- [ ] Ship movement validation
- [ ] Turn-based gameplay loop
- [ ] Deployment system
- [ ] Combat resolution

### Phase 2: Networking (Week 3-4)
- [ ] Colyseus integration
- [ ] Room management
- [ ] State synchronization
- [ ] Multiplayer sessions

### Phase 3: Features (Week 5-6)
- [ ] AI system
- [ ] Campaign scenarios
- [ ] Achievement tracking
- [ ] Map types

### Phase 4: Polish (Week 7-8)
- [ ] Audio system
- [ ] Visual effects
- [ ] UI animations
- [ ] Performance optimization

---

## Key Configuration Values

**Timers:**
- Deployment: 180s per player
- Turn: 180s (configurable)
- Reconnect: 2s delay, 5 attempts max

**Board:**
- Hex count: 91
- Columns: a-l
- Rows: 1-11

**Fleet:**
- Total ships: 12 per player
- Mothership: 1 (mandatory)
- Leaders: 1 (Fleet Admiral or Captain)
- All others: Mixed types

**Debris Field:**
- Radius: 20 hexes from destruction
- Created on ship death
- Blocks future movement

---

## Useful References

- Hex math tutorial: www.redblobgames.com/grids/hexagons/
- Colyseus docs: https://docs.colyseus.io/
- Game design doc: README.md (in project root)
- Detailed analysis: COMPREHENSIVE_CODEBASE_ANALYSIS.md

---

**Last Updated:** November 14, 2025
**For:** Godot 4.5.1 Engine Port
