extends Node
class_name MapGenerator

# Map Generation System
# Generates different map types with terrain features

static func generate_map(map_type: GameConstants.MapType) -> Dictionary:
	"""
	Generate a map with terrain obstacles
	Returns: {obstacles: Array[HexCoord], name: String, description: String}
	"""
	match map_type:
		GameConstants.MapType.CLASSIC:
			return generate_classic_map()
		GameConstants.MapType.GRAVEYARD:
			return generate_graveyard_map()
		GameConstants.MapType.METEOR_SHOWER:
			return generate_meteor_shower_map()
		GameConstants.MapType.RANDOM:
			return generate_random_map()
		_:
			return generate_classic_map()

static func generate_classic_map() -> Dictionary:
	"""
	Classic map - balanced layout with moderate obstacles
	Based on original game's Classic map
	"""
	var obstacles: Array[HexMath.HexCoord] = []

	# Meteors at specific positions (from original game)
	var meteor_positions = [
		HexMath.HexCoord.new(2, 5),   # c5
		HexMath.HexCoord.new(2, 10),  # c10
		HexMath.HexCoord.new(8, 7),   # i7
		HexMath.HexCoord.new(8, 2),   # i2
		HexMath.HexCoord.new(4, 6),   # e6
		HexMath.HexCoord.new(4, 7),   # e7
		HexMath.HexCoord.new(6, 6),   # g6
		HexMath.HexCoord.new(6, 5)    # g5
	]

	obstacles.append_array(meteor_positions)

	return {
		"obstacles": obstacles,
		"name": "Classic",
		"description": "Balanced map with strategic meteor placement"
	}

static func generate_graveyard_map() -> Dictionary:
	"""
	Graveyard map - heavy debris fields and wrecks
	More obstacles, movement-restrictive
	"""
	var obstacles: Array[HexMath.HexCoord] = []

	# Create debris clusters
	var cluster_centers = [
		HexMath.HexCoord.new(3, 3),
		HexMath.HexCoord.new(8, 3),
		HexMath.HexCoord.new(3, 9),
		HexMath.HexCoord.new(8, 9),
		HexMath.HexCoord.new(5, 6)
	]

	for center in cluster_centers:
		obstacles.append(center)
		# Add neighbors to create clusters
		var neighbors = HexMath.get_all_neighbors(center)
		for i in range(min(3, neighbors.size())):
			if HexMath.is_valid_hex(neighbors[i]):
				obstacles.append(neighbors[i])

	return {
		"obstacles": obstacles,
		"name": "Graveyard",
		"description": "Dense debris fields from ancient battles"
	}

static func generate_meteor_shower_map() -> Dictionary:
	"""
	Meteor Shower map - dense meteor clusters
	Creates strategic chokepoints
	"""
	var obstacles: Array[HexMath.HexCoord] = []

	# Create meteor corridors
	# Vertical corridor left
	for row in range(3, 9):
		obstacles.append(HexMath.HexCoord.new(3, row))

	# Vertical corridor right
	for row in range(3, 9):
		obstacles.append(HexMath.HexCoord.new(8, row))

	# Horizontal obstacles
	for col in range(4, 8):
		obstacles.append(HexMath.HexCoord.new(col, 4))
		obstacles.append(HexMath.HexCoord.new(col, 8))

	# Center cluster
	obstacles.append(HexMath.HexCoord.new(5, 5))
	obstacles.append(HexMath.HexCoord.new(5, 6))
	obstacles.append(HexMath.HexCoord.new(6, 5))
	obstacles.append(HexMath.HexCoord.new(6, 6))

	return {
		"obstacles": obstacles,
		"name": "Meteor Shower",
		"description": "Navigate through dense meteor fields"
	}

static func generate_random_map() -> Dictionary:
	"""
	Random map - procedurally generated each game
	High replay value
	"""
	var obstacles: Array[HexMath.HexCoord] = []

	# Randomly place 15-25 obstacles
	var obstacle_count = randi() % 11 + 15  # 15-25

	var placed = 0
	var attempts = 0
	var max_attempts = 1000

	while placed < obstacle_count and attempts < max_attempts:
		var col = randi() % GameConstants.BOARD_COLUMNS
		var row = randi() % GameConstants.BOARD_ROWS + 1

		var hex = HexMath.HexCoord.new(col, row)

		# Don't place in deployment zones
		if is_in_any_deployment_zone(hex):
			attempts += 1
			continue

		# Check not already placed
		var already_placed = false
		for existing in obstacles:
			if existing.equals(hex):
				already_placed = true
				break

		if not already_placed:
			obstacles.append(hex)
			placed += 1

		attempts += 1

	return {
		"obstacles": obstacles,
		"name": "Random",
		"description": "Procedurally generated battlefield"
	}

static func is_in_any_deployment_zone(hex: HexMath.HexCoord) -> bool:
	"""Check if hex is in any deployment zone"""
	var zones = [
		GameConstants.DeploymentZone.ZONE_1_TOP_RIGHT,
		GameConstants.DeploymentZone.ZONE_2_BOTTOM_RIGHT,
		GameConstants.DeploymentZone.ZONE_3_BOTTOM_LEFT,
		GameConstants.DeploymentZone.ZONE_4_TOP_LEFT
	]

	for zone in zones:
		if is_hex_in_zone(hex, zone):
			return true

	return false

static func is_hex_in_zone(hex: HexMath.HexCoord, zone: int) -> bool:
	"""Check if hex is in specific deployment zone"""
	var zone_data = GameState.DEPLOYMENT_ZONES.get(zone, null)
	if not zone_data:
		return false

	return hex.col in zone_data["cols"] and hex.row in zone_data["rows"]

static func get_terrain_sprite_for_obstacle(index: int) -> String:
	"""Get appropriate meteor sprite for obstacle"""
	var meteor_num = (index % 10) + 1  # Use meteors 01-10
	return "res://assets/terrain/Meteor_%02d.png" % meteor_num
