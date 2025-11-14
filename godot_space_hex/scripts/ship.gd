extends Node
class_name Ship

# Ship class - represents a single ship in the game
# Avoids dual rotation system - uses ONLY direction (0-5)

# === SHIP IDENTITY ===
var ship_id: String
var ship_type: GameConstants.ShipType
var owner_id: String
var color: GameConstants.PlayerColor

# === POSITION & ORIENTATION ===
var hex_position: HexMath.HexCoord
var direction: int = 0  # 0-5 (ONLY system used - no dual rotation)

# For mothership (2-hex ship)
var is_mothership_dock: bool = false  # True if this is the dock hex
var mothership_cockpit_hex: HexMath.HexCoord = null  # Cockpit position (if mothership)

# === STATS ===
var max_health: int
var current_health: int
var max_action_points: int
var current_action_points: int

# === STATE ===
var is_deployed: bool = false
var is_docked_in_mothership: bool = false
var docked_mothership_id: String = ""
var can_pilot_mothership: bool = false

# === MOVEMENT ===
var movement_pattern: Array = []  # [forward, forward_side, side, backward]
var can_rotate_while_moving: bool = false
var has_free_rotation: bool = false

func _init():
	pass

# Initialize ship with type and owner
func setup(type: GameConstants.ShipType, owner: String, player_color: GameConstants.PlayerColor, id: String = ""):
	ship_type = type
	owner_id = owner
	color = player_color
	ship_id = id if id != "" else generate_ship_id()

	# Set stats based on type
	max_health = GameConstants.SHIP_HEALTH[ship_type]
	current_health = max_health
	max_action_points = GameConstants.SHIP_ACTION_POINTS[ship_type]
	current_action_points = max_action_points

	# Set movement pattern
	movement_pattern = GameConstants.SHIP_MOVEMENT_RANGE[ship_type].duplicate()

	# Set special abilities
	can_rotate_while_moving = ship_type in GameConstants.SHIPS_CAN_ROTATE_WHILE_MOVING
	has_free_rotation = ship_type in GameConstants.SHIPS_WITH_FREE_ROTATION
	can_pilot_mothership = ship_type in [GameConstants.ShipType.FLEET_ADMIRAL, GameConstants.ShipType.CAPTAIN]

	# Mothership special setup
	if ship_type == GameConstants.ShipType.MOTHERSHIP:
		is_mothership_dock = true

func generate_ship_id() -> String:
	return owner_id + "_" + GameConstants.SHIP_TYPE_NAMES[ship_type] + "_" + str(Time.get_ticks_msec())

# === POSITION MANAGEMENT ===

func set_position(hex: HexMath.HexCoord, facing: int):
	hex_position = hex
	direction = facing % 6

	# If mothership, also set cockpit position
	if ship_type == GameConstants.ShipType.MOTHERSHIP:
		update_mothership_cockpit()

func update_mothership_cockpit():
	if ship_type != GameConstants.ShipType.MOTHERSHIP:
		return

	# Cockpit is directly behind the dock in the opposite direction
	var cockpit_direction = GameConstants.get_opposite_direction(direction)
	mothership_cockpit_hex = HexMath.get_neighbor(hex_position, cockpit_direction)

func get_occupied_hexes() -> Array[HexMath.HexCoord]:
	"""Returns all hexes occupied by this ship (1 for normal, 2 for mothership)"""
	if ship_type == GameConstants.ShipType.MOTHERSHIP and mothership_cockpit_hex != null:
		return [hex_position, mothership_cockpit_hex]
	else:
		return [hex_position]

# === ACTION POINTS ===

func use_action_points(amount: int) -> bool:
	if current_action_points >= amount:
		current_action_points -= amount
		return true
	return false

func reset_action_points():
	current_action_points = max_action_points

func has_action_points(amount: int = 1) -> bool:
	return current_action_points >= amount

# === HEALTH & DAMAGE ===

func take_damage(amount: int) -> bool:
	"""Returns true if ship is destroyed"""
	current_health -= amount
	if current_health <= 0:
		current_health = 0
		return true
	return false

func is_destroyed() -> bool:
	return current_health <= 0

func heal(amount: int):
	current_health = min(current_health + amount, max_health)

# === ROTATION ===

func rotate(turns: int) -> bool:
	"""Rotate ship by 'turns' * 60 degrees. Positive = clockwise"""
	var rotation_cost = 0 if has_free_rotation else abs(turns) * GameConstants.ROTATION_COST_AP

	if not use_action_points(rotation_cost):
		return false

	direction = (direction + turns) % 6
	if direction < 0:
		direction += 6

	# Update mothership cockpit if applicable
	if ship_type == GameConstants.ShipType.MOTHERSHIP:
		update_mothership_cockpit()

	return true

func get_rotation_cost(turns: int) -> int:
	if has_free_rotation:
		return 0
	return abs(turns) * GameConstants.ROTATION_COST_AP

# === MOVEMENT ===

func get_reachable_hexes(board_state = null) -> Array[HexMath.HexCoord]:
	"""Get all hexes this ship can move to based on current AP and movement pattern"""
	if not is_deployed or is_docked_in_mothership:
		return []

	# For simplicity, return hexes within movement range
	# Actual validation should be done by movement validator
	return HexMath.get_reachable_hexes(hex_position, direction, movement_pattern)

# === MOTHERSHIP SPECIAL ===

func can_dock_ship() -> bool:
	return ship_type == GameConstants.ShipType.MOTHERSHIP and is_mothership_dock

func dock_ship(other_ship: Ship) -> bool:
	if not can_dock_ship():
		return false

	other_ship.is_docked_in_mothership = true
	other_ship.docked_mothership_id = ship_id
	return true

func undock_ship(other_ship: Ship) -> bool:
	if other_ship.docked_mothership_id != ship_id:
		return false

	other_ship.is_docked_in_mothership = false
	other_ship.docked_mothership_id = ""
	return true

# === COMBAT ===

func get_attack_damage() -> int:
	return GameConstants.SHIP_ATTACK_DAMAGE.get(ship_type, 0)

func can_attack() -> bool:
	return get_attack_damage() > 0

# === SERIALIZATION (for network sync) ===

func to_dict() -> Dictionary:
	return {
		"ship_id": ship_id,
		"ship_type": ship_type,
		"owner_id": owner_id,
		"color": color,
		"hex_position": {"col": hex_position.col, "row": hex_position.row} if hex_position else null,
		"direction": direction,
		"current_health": current_health,
		"max_health": max_health,
		"current_action_points": current_action_points,
		"max_action_points": max_action_points,
		"is_deployed": is_deployed,
		"is_docked_in_mothership": is_docked_in_mothership,
		"docked_mothership_id": docked_mothership_id,
		"mothership_cockpit_hex": {"col": mothership_cockpit_hex.col, "row": mothership_cockpit_hex.row} if mothership_cockpit_hex else null
	}

static func from_dict(data: Dictionary) -> Ship:
	var ship = Ship.new()
	ship.ship_id = data.get("ship_id", "")
	ship.ship_type = data.get("ship_type", GameConstants.ShipType.SCOUT)
	ship.owner_id = data.get("owner_id", "")
	ship.color = data.get("color", GameConstants.PlayerColor.BLUE)

	if data.has("hex_position") and data.hex_position != null:
		ship.hex_position = HexMath.HexCoord.new(data.hex_position.col, data.hex_position.row)

	ship.direction = data.get("direction", 0)
	ship.current_health = data.get("current_health", 100)
	ship.max_health = data.get("max_health", 100)
	ship.current_action_points = data.get("current_action_points", 0)
	ship.max_action_points = data.get("max_action_points", 0)
	ship.is_deployed = data.get("is_deployed", false)
	ship.is_docked_in_mothership = data.get("is_docked_in_mothership", false)
	ship.docked_mothership_id = data.get("docked_mothership_id", "")

	if data.has("mothership_cockpit_hex") and data.mothership_cockpit_hex != null:
		ship.mothership_cockpit_hex = HexMath.HexCoord.new(data.mothership_cockpit_hex.col, data.mothership_cockpit_hex.row)

	# Setup movement pattern and abilities
	ship.movement_pattern = GameConstants.SHIP_MOVEMENT_RANGE[ship.ship_type].duplicate()
	ship.can_rotate_while_moving = ship.ship_type in GameConstants.SHIPS_CAN_ROTATE_WHILE_MOVING
	ship.has_free_rotation = ship.ship_type in GameConstants.SHIPS_WITH_FREE_ROTATION
	ship.can_pilot_mothership = ship.ship_type in [GameConstants.ShipType.FLEET_ADMIRAL, GameConstants.ShipType.CAPTAIN]

	return ship

# === DEBUG ===

func get_debug_string() -> String:
	var pos_str = hex_position._to_string() if hex_position else "none"
	return "%s (%s) at %s facing %d - HP:%d/%d AP:%d/%d" % [
		GameConstants.SHIP_TYPE_NAMES[ship_type],
		GameConstants.COLOR_NAMES[color],
		pos_str,
		direction,
		current_health,
		max_health,
		current_action_points,
		max_action_points
	]
