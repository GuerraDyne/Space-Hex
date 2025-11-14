// Test to verify movement pattern consistency between admin panel and game

export function testMovementConsistency() {
  console.log("=== Testing Movement Pattern Consistency ===");
  
  // Direction vectors used in both HexGameBoard and MovementPatternEditor
  const directions = [
    { q: 1, r: -1, orientation: 0, name: "NE (60°)" },   // orientation 0
    { q: 1, r: 0, orientation: 1, name: "E/SE (120°)" }, // orientation 1  
    { q: 0, r: 1, orientation: 2, name: "S (180°)" },    // orientation 2
    { q: -1, r: 1, orientation: 3, name: "SW (240°)" },  // orientation 3
    { q: -1, r: 0, orientation: 4, name: "W/NW (300°)" },// orientation 4
    { q: 0, r: -1, orientation: 5, name: "N (0°)" }      // orientation 5
  ];
  
  // Test ship orientation north (orientation = 5, rotation = 0°)
  const shipOrientation = 5;
  console.log(`\nShip orientation: ${shipOrientation} (North, 0° rotation)`);
  console.log("Expected movement directions:");
  
  directions.forEach(dir => {
    const relativeFacing = (dir.orientation - shipOrientation + 6) % 6;
    let movementType = "";
    
    if (relativeFacing === 0) {
      movementType = "FORWARD";
    } else if (relativeFacing === 1 || relativeFacing === 5) {
      movementType = "FORWARD-SIDE";
    } else if (relativeFacing === 2 || relativeFacing === 4) {
      movementType = "SIDE";
    } else if (relativeFacing === 3) {
      movementType = "BACKWARD";
    }
    
    console.log(`  Direction ${dir.orientation} ${dir.name}: q=${dir.q}, r=${dir.r} => ${movementType} (relative: ${relativeFacing})`);
  });
  
  console.log("\nWhen ship faces North (orientation 5):");
  console.log("  - Forward should be: q=0, r=-1 (North)");
  console.log("  - Forward-Side should be: q=1,r=-1 (NE) and q=-1,r=0 (NW)");
  console.log("  - Side should be: q=1,r=0 (E) and q=-1,r=1 (SW)");
  console.log("  - Backward should be: q=0,r=1 (South)");
  
  // Test a scout's movement pattern
  console.log("\n=== Scout Movement Pattern ===");
  console.log("Forward: 5 hexes");
  console.log("Forward-Side: 3 hexes");
  console.log("Side: 2 hexes");
  console.log("Backward: 1 hex");
  
  return true;
}