#!/bin/bash

# Replace 'facing' with 'orientation' in all relevant files

echo "Replacing 'facing' with 'orientation' in all files..."

# Client-side files
files=(
  "src/components/HexGameBoard.tsx"
  "src/components/ActionPointMovement.tsx"
  "src/config/actionPointConfig.ts"
  "src/components/MovementPatternEditor.tsx"
  "src/utils/testMovementConsistency.ts"
  "src/config/shipMovementPatterns.ts"
  "server/src/rooms/HexGameRoom.ts"
  "server/src/rooms/schema/HexGameState.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    # Replace 'facing' with 'orientation' (case-sensitive)
    sed -i 's/\bfacing\b/orientation/g' "$file"
    # Replace 'Facing' with 'Orientation' (capitalized)
    sed -i 's/\bFacing\b/Orientation/g' "$file"
    # Replace specific function names
    sed -i 's/facingToRotation/orientationToRotation/g' "$file"
    sed -i 's/getInitialFacingForZone/getInitialOrientationForZone/g' "$file"
    sed -i 's/fromFacing/fromOrientation/g' "$file"
    sed -i 's/toFacing/toOrientation/g' "$file"
    sed -i 's/currentFacing/currentOrientation/g' "$file"
    sed -i 's/newFacing/newOrientation/g' "$file"
    sed -i 's/shipFacing/shipOrientation/g' "$file"
    echo "  Done."
  else
    echo "  File not found: $file"
  fi
done

echo "Replacement complete!"