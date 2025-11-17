# Ship Movement Patterns - Visual Mockup

## Hexagonal Direction Reference
```
        NW (5)    NE (0)
           ↖   ↗
            \ /
    W (4) ← [S] → E (1)
            / \
           ↙   ↘
        SW (3)    SE (2)
```

## Movement Patterns by Ship Type

### Scout - Fast & Agile
```
            5   5
         5   5   5
      3   3   3   3
   2   2   2   2   2
2   2   2  [S]  2   2   2
   0   0   1   0   0
      0   0   0   0
         0   0   0
            0   0

Forward: 5 hexes
Forward-Side: 3 hexes  
Side: 2 hexes
Backward: 1 hex
Special: Free rotation
```

### Interceptor - Dogfighter
```
            4   4
         4   4   4
      3   3   3   3
   1   3   3   3   1
0   1   1  [I]  1   1   0
   0   0   0   0   0
      0   0   0   0
         0   0   0
            0   0

Forward: 4 hexes
Forward-Side: 3 hexes
Side: 1 hex
Backward: 0 hexes
Special: Can rotate 60° when moving forward
```

### Corvette - Balanced
```
            3   3
         3   3   3
      2   2   2   2
   1   2   2   2   1
0   1   1  [C]  1   1   0
   0   0   1   0   0
      0   0   0   0
         0   0   0
            0   0

Forward: 3 hexes
Forward-Side: 2 hexes
Side: 1 hex
Backward: 1 hex
```

### Frigate - Medium Warship
```
            3   3
         3   3   3
      2   2   2   2
   1   2   2   2   1
0   1   1  [F]  1   1   0
   0   0   0   0   0
      0   0   0   0
         0   0   0
            0   0

Forward: 3 hexes
Forward-Side: 2 hexes
Side: 1 hex
Backward: 0 hexes
```

### Destroyer - Heavy
```
            2   2
         2   2   2
      1   1   1   1
   0   1   1   1   0
0   0   0  [D]  0   0   0
   0   0   0   0   0
      0   0   0   0
         0   0   0
            0   0

Forward: 2 hexes
Forward-Side: 1 hex
Side: 0 hexes
Backward: 0 hexes
Special: Must commit to direction
```

### Cruiser - Capital Ship
```
            2   2
         2   2   2
      1   1   1   1
   0   1   1   1   0
0   0   0  [X]  0   0   0
   0   0   0   0   0
      0   0   0   0
         0   0   0
            0   0

Forward: 2 hexes
Forward-Side: 1 hex
Side: 0 hexes
Backward: 0 hexes
Special: Cannot rotate in place
```

## Movement Rules

1. **Basic Movement**: Ship can move up to the maximum hexes shown in their pattern based on facing direction
2. **Rotation Cost**: 
   - Scout: Free rotation
   - Interceptor/Corvette: Can rotate 60° as part of move
   - Frigate/Destroyer: Must use full turn to rotate
   - Cruiser: Can only rotate by moving forward-side
3. **Backward Movement**: Ship maintains facing when reversing
4. **Combat**: Can only attack enemies in forward arc (front 3 hexes)

## Color Coding for UI
- 🟢 Green: Forward arc (best movement)
- 🟡 Yellow: Side movements (limited)
- 🔴 Red: Reverse movement (if available)
- ⬜ Gray: Cannot move here from current facing

## Strategic Implications
- **Flanking**: Attack from sides where heavy ships can't respond
- **Pursuit**: Faster ships can chase down slower ones
- **Retreat**: Must plan ahead - can't easily turn and run
- **Formation**: Ships support each other's weak sides
- **Terrain**: Debris forces wider turns for larger ships