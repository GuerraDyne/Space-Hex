extends Node
class_name MovementValidator

# Movement Validation System
# Validates all ship movements according to game rules
# Avoids the scattered movement logic issue from original code

static func can_move_to(ship: Ship, target_hex: HexMath.HexCoord, game_state: GameState) -> Dictionary:
	"""
	Validates if a ship can move to target hex
	Returns: {valid: bool, reason: String, ap_cost: int}
	"""
	var result = {
		"valid": false,
		"reason": "",
		"ap_cost": 0
	}

	# Basic validation
	if not ship.is_deployed:
		result.reason = "Ship not deployed"
		return result

	if ship.is_docked_in_mothership:
		result.reason = "Ship is docked in mothership"
		return result

	if not HexMath.is_valid_hex(target_hex):
		result.reason = "Target hex out of bounds"
		return result

	# Can't move to current position
	if target_hex.equals(ship.hex_position):
		result.reason = "Already at target position"
		return result

	# Calculate distance
	var distance = HexMath.hex_distance(ship.hex_position, target_hex)

	# Get direction to target
	var path = HexMath.find_path(ship.hex_position, target_hex, game_state.terrain_obstacles)

	if path.size() == 0:
		result.reason = "No valid path to target"
		return result

	# Check if target is within movement range
	var reachable = HexMath.get_reachable_hexes(ship.hex_position, ship.direction, ship.movement_pattern)
	var is_reachable = false

	for hex in reachable:
		if hex.equals(target_hex):
			is_reachable = true
			break

	if not is_reachable:
		result.reason = "Target out of movement range"
		return result

	# Check if path is clear (no other ships blocking)
	for path_hex in path:
		var occupying_ship = game_state.get_ship_at(path_hex)
		if occupying_ship != null and occupying_ship.ship_id != ship.ship_id:
			# Last hex can be occupied (for combat)
			if not path_hex.equals(target_hex):
				result.reason = "Path blocked by another ship"
				return result

	# Check terrain obstacles
	for path_hex in path:
		if game_state.is_terrain_obstacle(path_hex):
			result.reason = "Path blocked by terrain"
			return result

	# Calculate AP cost
	var ap_cost = calculate_movement_cost(ship, target_hex, game_state)

	if ap_cost > ship.current_action_points:
		result.reason = "Insufficient action points"
		return result

	# Mothership special validation (2-hex ship)
	if ship.ship_type == GameConstants.ShipType.MOTHERSHIP:
		var mothership_valid = validate_mothership_move(ship, target_hex, game_state)
		if not mothership_valid.valid:
			return mothership_valid

	# All checks passed
	result.valid = true
	result.ap_cost = ap_cost
	return result

static func calculate_movement_cost(ship: Ship, target_hex: HexMath.HexCoord, game_state: GameState) -> int:
	"""Calculate AP cost to move to target hex"""
	var distance = HexMath.hex_distance(ship.hex_position, target_hex)

	# Base cost is 1 AP per hex
	var cost = distance

	# Debris fields increase cost
	var path = HexMath.find_path(ship.hex_position, target_hex, game_state.terrain_obstacles)
	for hex in path:
		if game_state.is_debris_field(hex):
			cost += 1  # Extra AP for debris

	return cost

static func validate_mothership_move(ship: Ship, target_hex: HexMath.HexCoord, game_state: GameState) -> Dictionary:
	"""Special validation for mothership (2-hex ship)"""
	var result = {
		"valid": false,
		"reason": "",
		"ap_cost": 0
	}

	if ship.ship_type != GameConstants.ShipType.MOTHERSHIP:
		result.valid = true
		return result

	# Calculate where cockpit would be
	var temp_ship = Ship.new()
	temp_ship.setup(ship.ship_type, ship.owner_id, ship.color, ship.ship_id)
	temp_ship.set_position(target_hex, ship.direction)

	var new_cockpit_hex = temp_ship.mothership_cockpit_hex

	# Check cockpit position is valid
	if not HexMath.is_valid_hex(new_cockpit_hex):
		result.reason = "Mothership cockpit would be out of bounds"
		return result

	# Check cockpit position is not occupied (unless by this ship's current position)
	var cockpit_ship = game_state.get_ship_at(new_cockpit_hex)
	if cockpit_ship != null and cockpit_ship.ship_id != ship.ship_id:
		result.reason = "Mothership cockpit position occupied"
		return result

	# Check cockpit not on terrain obstacle
	if game_state.is_terrain_obstacle(new_cockpit_hex):
		result.reason = "Mothership cockpit would be on terrain"
		return result

	result.valid = true
	return result

static func can_rotate(ship: Ship, turns: int) -> Dictionary:
	"""
	Validates if ship can rotate
	Returns: {valid: bool, reason: String, ap_cost: int}
	"""
	var result = {
		"valid": false,
		"reason": "",
		"ap_cost": 0
	}

	if not ship.is_deployed:
		result.reason = "Ship not deployed"
		return result

	if ship.is_docked_in_mothership:
		result.reason = "Ship is docked"
		return result

	var ap_cost = ship.get_rotation_cost(turns)

	if ap_cost > ship.current_action_points:
		result.reason = "Insufficient action points"
		return result

	result.valid = true
	result.ap_cost = ap_cost
	return result

static func can_attack(attacker: Ship, defender: Ship, game_state: GameState) -> Dictionary:
	"""
	Validates if attacker can attack defender
	Returns: {valid: bool, reason: String}
	"""
	var result = {
		"valid": false,
		"reason": ""
	}

	if not attacker.can_attack():
		result.reason = "Ship cannot attack"
		return result

	if not defender.is_deployed:
		result.reason = "Target not deployed"
		return result

	if attacker.owner_id == defender.owner_id:
		result.reason = "Cannot attack own ships"
		return result

	# Ships must be adjacent or in same hex
	var distance = HexMath.hex_distance(attacker.hex_position, defender.hex_position)
	if distance > 1:
		result.reason = "Target out of range"
		return result

	result.valid = true
	return result

static func validate_deployment(ship: Ship, hex: HexMath.HexCoord, player: GameState.PlayerInfo, game_state: GameState) -> Dictionary:
	"""
	Validates ship deployment during deployment phase
	Returns: {valid: bool, reason: String}
	"""
	var result = {
		"valid": false,
		"reason": ""
	}

	# Check zone assignment
	if player.assigned_zone == 0:
		result.reason = "Player has no assigned zone"
		return result

	# Check hex is in deployment zone
	if not game_state.is_hex_in_deployment_zone(hex, player.assigned_zone):
		result.reason = "Hex not in deployment zone"
		return result

	# Check hex not occupied
	var occupying_ship = game_state.get_ship_at(hex)
	if occupying_ship != null:
		result.reason = "Hex already occupied"
		return result

	# Check not on terrain
	if game_state.is_terrain_obstacle(hex):
		result.reason = "Cannot deploy on terrain"
		return result

	# Mothership validation
	if ship.ship_type == GameConstants.ShipType.MOTHERSHIP:
		var zone_direction = game_state.get_zone_default_direction(player.assigned_zone)
		var temp_ship = Ship.new()
		temp_ship.setup(ship.ship_type, ship.owner_id, ship.color)
		temp_ship.set_position(hex, zone_direction)

		var cockpit_hex = temp_ship.mothership_cockpit_hex

		if not HexMath.is_valid_hex(cockpit_hex):
			result.reason = "Mothership cockpit out of bounds"
			return result

		if not game_state.is_hex_in_deployment_zone(cockpit_hex, player.assigned_zone):
			result.reason = "Mothership cockpit not in zone"
			return result

		var cockpit_ship = game_state.get_ship_at(cockpit_hex)
		if cockpit_ship != null:
			result.reason = "Mothership cockpit position occupied"
			return result

		if game_state.is_terrain_obstacle(cockpit_hex):
			result.reason = "Mothership cockpit on terrain"
			return result

	result.valid = true
	return result

static func get_all_valid_moves(ship: Ship, game_state: GameState) -> Array[HexMath.HexCoord]:
	"""Get all valid hexes the ship can move to"""
	var valid_moves: Array[HexMath.HexCoord] = []

	var reachable = HexMath.get_reachable_hexes(ship.hex_position, ship.direction, ship.movement_pattern)

	for hex in reachable:
		var validation = can_move_to(ship, hex, game_state)
		if validation.valid:
			valid_moves.append(hex)

	return valid_moves

static func get_movement_category_for_hex(ship: Ship, target_hex: HexMath.HexCoord) -> String:
	"""Determine if movement is forward, side, backward, etc."""
	var direction_to_target = HexMath.get_direction(ship.hex_position, target_hex)

	if direction_to_target == -1:
		return "invalid"

	var relative_dir = HexMath.get_relative_direction(ship.direction, direction_to_target)
	return HexMath.get_movement_category(relative_dir)
