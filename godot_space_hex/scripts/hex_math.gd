extends Node
class_name HexMath

# Hexagonal Grid Mathematics
# Using Odd-R Offset Coordinates (odd rows shifted right)
# Avoiding the rotation/orientation conflicts from the original code

# === COORDINATE SYSTEM ===
# Columns: a-l (0-11 in code)
# Rows: 1-11
# Odd rows (1, 3, 5, ...) are shifted right by 0.5 hex width

class HexCoord:
	var col: int  # 0-11 (a-l)
	var row: int  # 1-11

	func _init(c: int, r: int):
		col = c
		row = r

	func _to_string() -> String:
		var col_letter = char(ord('a') + col)
		return col_letter + str(row)

	func equals(other: HexCoord) -> bool:
		return col == other.col and row == other.row

class CubeCoord:
	var x: float
	var y: float
	var z: float

	func _init(_x: float, _y: float, _z: float):
		x = _x
		y = _y
		z = _z

# === DIRECTION VECTORS (Odd-R offset coordinates) ===
# Direction 0 = East, 1 = SE, 2 = SW, 3 = West, 4 = NW, 5 = NE
const DIRECTION_VECTORS_EVEN_ROW = [
	Vector2i(1, 0),   # 0: East
	Vector2i(0, 1),   # 1: Southeast
	Vector2i(-1, 1),  # 2: Southwest
	Vector2i(-1, 0),  # 3: West
	Vector2i(-1, -1), # 4: Northwest
	Vector2i(0, -1)   # 5: Northeast
]

const DIRECTION_VECTORS_ODD_ROW = [
	Vector2i(1, 0),   # 0: East
	Vector2i(1, 1),   # 1: Southeast
	Vector2i(0, 1),   # 2: Southwest
	Vector2i(-1, 0),  # 3: West
	Vector2i(0, -1),  # 4: Northwest
	Vector2i(1, -1)   # 5: Northeast
]

# === COORDINATE CONVERSION ===

# Convert offset coordinates to cube coordinates (for distance calculation)
static func offset_to_cube(hex: HexCoord) -> CubeCoord:
	var x = hex.col - (hex.row - (hex.row & 1)) / 2.0
	var z = float(hex.row)
	var y = -x - z
	return CubeCoord.new(x, y, z)

# Convert cube coordinates back to offset
static func cube_to_offset(cube: CubeCoord) -> HexCoord:
	var row = int(cube.z)
	var col = int(cube.x + (row - (row & 1)) / 2.0)
	return HexCoord.new(col, row)

# === DISTANCE CALCULATION ===

# Calculate distance between two hexes
static func hex_distance(hex1: HexCoord, hex2: HexCoord) -> int:
	var cube1 = offset_to_cube(hex1)
	var cube2 = offset_to_cube(hex2)

	return int((abs(cube1.x - cube2.x) + abs(cube1.y - cube2.y) + abs(cube1.z - cube2.z)) / 2.0)

# === NEIGHBOR OPERATIONS ===

# Get neighbor in a specific direction
static func get_neighbor(hex: HexCoord, direction: int) -> HexCoord:
	var is_odd_row = (hex.row & 1) == 1
	var direction_vectors = DIRECTION_VECTORS_ODD_ROW if is_odd_row else DIRECTION_VECTORS_EVEN_ROW

	if direction < 0 or direction >= 6:
		push_error("Invalid direction: " + str(direction))
		return hex

	var offset = direction_vectors[direction]
	return HexCoord.new(hex.col + offset.x, hex.row + offset.y)

# Get all 6 neighbors of a hex
static func get_all_neighbors(hex: HexCoord) -> Array[HexCoord]:
	var neighbors: Array[HexCoord] = []
	for direction in range(6):
		neighbors.append(get_neighbor(hex, direction))
	return neighbors

# === DIRECTION CALCULATION ===

# Get direction from one hex to an adjacent hex
# Returns -1 if hexes are not adjacent
static func get_direction(from_hex: HexCoord, to_hex: HexCoord) -> int:
	for direction in range(6):
		var neighbor = get_neighbor(from_hex, direction)
		if neighbor.equals(to_hex):
			return direction
	return -1  # Not adjacent

# Get relative direction considering ship's current facing
# ship_direction: current facing (0-5)
# target_direction: direction to target (0-5)
# Returns: 0=forward, 1=forward-right, 2=back-right, 3=back, 4=back-left, 5=forward-left
static func get_relative_direction(ship_direction: int, target_direction: int) -> int:
	var diff = (target_direction - ship_direction + 6) % 6
	return diff

# Check if a move is in a valid direction based on ship's movement pattern
# relative_dir: 0=forward, 1/5=forward-side, 2/4=side, 3=backward
static func get_movement_category(relative_dir: int) -> String:
	match relative_dir:
		0:
			return "forward"
		1, 5:
			return "forward_side"
		2, 4:
			return "side"
		3:
			return "backward"
		_:
			return "invalid"

# === RANGE AND REACHABILITY ===

# Get all hexes within a certain range
static func get_hexes_in_range(center: HexCoord, range_val: int) -> Array[HexCoord]:
	var results: Array[HexCoord] = []

	for col in range(max(0, center.col - range_val), min(GameConstants.BOARD_COLUMNS, center.col + range_val + 1)):
		for row in range(max(1, center.row - range_val), min(GameConstants.BOARD_ROWS + 1, center.row + range_val + 1)):
			var hex = HexCoord.new(col, row)
			if hex_distance(center, hex) <= range_val:
				results.append(hex)

	return results

# Get hexes reachable by a ship from its current position
# Takes into account movement pattern and facing direction
static func get_reachable_hexes(ship_hex: HexCoord, ship_direction: int, movement_pattern: Array) -> Array[HexCoord]:
	var reachable: Array[HexCoord] = []

	# movement_pattern format: [forward, forward_side, side, backward]
	var forward_range = movement_pattern[0]
	var forward_side_range = movement_pattern[1]
	var side_range = movement_pattern[2]
	var backward_range = movement_pattern[3]

	# Check each direction relative to ship's facing
	for relative_dir in range(6):
		var absolute_dir = (ship_direction + relative_dir) % 6
		var category = get_movement_category(relative_dir)
		var max_range = 0

		match category:
			"forward":
				max_range = forward_range
			"forward_side":
				max_range = forward_side_range
			"side":
				max_range = side_range
			"backward":
				max_range = backward_range

		# Add all hexes in this direction up to max range
		var current_hex = ship_hex
		for step in range(1, max_range + 1):
			current_hex = get_neighbor(current_hex, absolute_dir)
			if is_valid_hex(current_hex):
				reachable.append(current_hex)

	return reachable

# === VALIDATION ===

# Check if hex coordinates are valid (within board bounds)
static func is_valid_hex(hex: HexCoord) -> bool:
	if hex.col < 0 or hex.col >= GameConstants.BOARD_COLUMNS:
		return false
	if hex.row < 1 or hex.row > GameConstants.BOARD_ROWS:
		return false

	# Additional check: not all positions in the rectangle are valid hexes
	# The board is actually a hexagon shape, so we need to validate
	# For now, we'll accept all positions (the actual board shape will be defined in map data)
	return true

# === PATH FINDING ===

# Find shortest path between two hexes (simple A* implementation)
static func find_path(start: HexCoord, goal: HexCoord, obstacles: Array[HexCoord] = []) -> Array[HexCoord]:
	# Simple breadth-first search for now
	var visited = {}
	var queue = [start]
	var came_from = {}

	visited[_hex_to_key(start)] = true

	while queue.size() > 0:
		var current = queue.pop_front()

		if current.equals(goal):
			# Reconstruct path
			var path: Array[HexCoord] = []
			var step = goal
			while not step.equals(start):
				path.push_front(step)
				step = came_from[_hex_to_key(step)]
			return path

		for neighbor in get_all_neighbors(current):
			if not is_valid_hex(neighbor):
				continue

			var key = _hex_to_key(neighbor)
			if visited.has(key):
				continue

			# Check if blocked by obstacle
			var blocked = false
			for obstacle in obstacles:
				if obstacle.equals(neighbor):
					blocked = true
					break
			if blocked:
				continue

			visited[key] = true
			came_from[key] = current
			queue.push_back(neighbor)

	# No path found
	return []

# === HELPER FUNCTIONS ===

static func _hex_to_key(hex: HexCoord) -> String:
	return str(hex.col) + "," + str(hex.row)

# Parse string coordinate like "a5" to HexCoord
static func parse_coord(coord_str: String) -> HexCoord:
	if coord_str.length() < 2:
		return null

	var col_char = coord_str[0].to_lower()
	var col = ord(col_char) - ord('a')
	var row = coord_str.substr(1).to_int()

	return HexCoord.new(col, row)

# Convert HexCoord to pixel position (for rendering)
# hex_size: radius of hexagon in pixels
static func hex_to_pixel(hex: HexCoord, hex_size: float) -> Vector2:
	var width = hex_size * 2.0
	var height = sqrt(3.0) * hex_size

	var x = hex.col * width * 0.75
	var y = hex.row * height

	# Offset odd rows
	if (hex.row & 1) == 1:
		x += width * 0.375

	return Vector2(x, y)

# Convert pixel position to HexCoord (for mouse input)
static func pixel_to_hex(pixel: Vector2, hex_size: float) -> HexCoord:
	var width = hex_size * 2.0
	var height = sqrt(3.0) * hex_size

	# Approximate column and row
	var col = int(pixel.x / (width * 0.75))
	var row = int(pixel.y / height)

	# Adjust for odd row offset
	if (row & 1) == 1:
		col = int((pixel.x - width * 0.375) / (width * 0.75))

	# Return the closest valid hex
	var candidates = [
		HexCoord.new(col, row),
		HexCoord.new(col - 1, row),
		HexCoord.new(col + 1, row),
		HexCoord.new(col, row - 1),
		HexCoord.new(col, row + 1)
	]

	var closest: HexCoord = null
	var min_dist = INF

	for candidate in candidates:
		if not is_valid_hex(candidate):
			continue
		var candidate_pixel = hex_to_pixel(candidate, hex_size)
		var dist = pixel.distance_to(candidate_pixel)
		if dist < min_dist:
			min_dist = dist
			closest = candidate

	return closest if closest != null else HexCoord.new(col, row)
