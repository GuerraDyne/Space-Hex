extends Node
class_name GameState

# Central Game State Manager
# Manages all game state, players, ships, and game flow

signal phase_changed(new_phase: GameConstants.GamePhase)
signal turn_changed(player_id: String)
signal ship_moved(ship_id: String, from_hex: HexMath.HexCoord, to_hex: HexMath.HexCoord)
signal ship_destroyed(ship_id: String)
signal player_eliminated(player_id: String)
signal game_ended(winner_id: String, reason: String)

# === GAME INFO ===
var game_id: String
var game_mode: GameConstants.GameMode
var map_type: GameConstants.MapType
var current_phase: GameConstants.GamePhase = GameConstants.GamePhase.WAITING

# === PLAYERS ===
class PlayerInfo:
	var player_id: String
	var player_name: String
	var color: GameConstants.PlayerColor
	var is_ai: bool = false
	var is_ready: bool = false
	var assigned_zone: int = 0  # 1-4
	var is_eliminated: bool = false
	var elimination_reason: String = ""
	var team: int = 0  # 0 = no team, 1 or 2 for team games

	func _init(id: String, name: String, player_color: GameConstants.PlayerColor):
		player_id = id
		player_name = name
		color = player_color

var players: Dictionary = {}  # player_id -> PlayerInfo
var player_order: Array = []  # Array of player_ids in turn order

# === TURN MANAGEMENT ===
var current_turn_player_id: String = ""
var turn_number: int = 0
var moves_this_turn: int = 0
var mothership_moved_this_turn: bool = false

# === SHIPS ===
var ships: Dictionary = {}  # ship_id -> Ship
var ship_positions: Dictionary = {}  # "col,row" -> ship_id

# === MAP & TERRAIN ===
var terrain_obstacles: Array[HexMath.HexCoord] = []  # Meteors, etc.
var debris_fields: Array[HexMath.HexCoord] = []

# === DEPLOYMENT ZONES ===
const DEPLOYMENT_ZONES = {
	GameConstants.DeploymentZone.ZONE_1_TOP_RIGHT: {
		"cols": [8, 9, 10, 11],  # i-l
		"rows": [1, 2, 3, 4],   # 1-4
		"default_direction": 3  # Face West (180°)
	},
	GameConstants.DeploymentZone.ZONE_2_BOTTOM_RIGHT: {
		"cols": [8, 9, 10, 11],  # i-l
		"rows": [8, 9, 10, 11],  # 8-11
		"default_direction": 3  # Face West (180°)
	},
	GameConstants.DeploymentZone.ZONE_3_BOTTOM_LEFT: {
		"cols": [0, 1, 2, 3],   # a-d
		"rows": [8, 9, 10, 11],  # 8-11
		"default_direction": 0  # Face East (0°)
	},
	GameConstants.DeploymentZone.ZONE_4_TOP_LEFT: {
		"cols": [0, 1, 2, 3],   # a-d
		"rows": [1, 2, 3, 4],   # 1-4
		"default_direction": 0  # Face East (0°)
	}
}

# === VICTORY CONDITIONS ===
var cockpit_captures: Dictionary = {}  # player_id -> turns_held

func _ready():
	game_id = generate_game_id()

func generate_game_id() -> String:
	return "game_" + str(Time.get_ticks_msec()) + "_" + str(randi() % 10000)

# === PLAYER MANAGEMENT ===

func add_player(player_id: String, player_name: String, color: GameConstants.PlayerColor, is_ai: bool = false) -> bool:
	if players.has(player_id):
		return false

	var player = PlayerInfo.new(player_id, player_name, color)
	player.is_ai = is_ai
	players[player_id] = player
	player_order.append(player_id)
	return true

func remove_player(player_id: String):
	if players.has(player_id):
		players.erase(player_id)
		player_order.erase(player_id)

func get_player(player_id: String) -> PlayerInfo:
	return players.get(player_id, null)

func assign_zone_to_player(player_id: String, zone: int) -> bool:
	var player = get_player(player_id)
	if not player:
		return false

	# Check zone is valid
	if zone < 1 or zone > 4:
		return false

	# Check zone not already taken
	for other_player_id in players:
		var other = players[other_player_id]
		if other.assigned_zone == zone and other_player_id != player_id:
			return false

	player.assigned_zone = zone
	return true

# === SHIP MANAGEMENT ===

func add_ship(ship: Ship) -> bool:
	if ships.has(ship.ship_id):
		return false

	ships[ship.ship_id] = ship
	return true

func remove_ship(ship_id: String):
	var ship = ships.get(ship_id)
	if ship and ship.hex_position:
		var pos_key = _hex_to_key(ship.hex_position)
		ship_positions.erase(pos_key)

	ships.erase(ship_id)

func get_ship(ship_id: String) -> Ship:
	return ships.get(ship_id, null)

func get_ship_at(hex: HexMath.HexCoord) -> Ship:
	var pos_key = _hex_to_key(hex)
	var ship_id = ship_positions.get(pos_key, "")
	return get_ship(ship_id)

func get_player_ships(player_id: String) -> Array[Ship]:
	var result: Array[Ship] = []
	for ship in ships.values():
		if ship.owner_id == player_id:
			result.append(ship)
	return result

# === SHIP POSITIONING ===

func deploy_ship(ship_id: String, hex: HexMath.HexCoord, direction: int) -> bool:
	var ship = get_ship(ship_id)
	if not ship:
		return false

	var player = get_player(ship.owner_id)
	if not player or player.assigned_zone == 0:
		return false

	# Validate hex is in player's deployment zone
	if current_phase == GameConstants.GamePhase.DEPLOYMENT:
		if not is_hex_in_deployment_zone(hex, player.assigned_zone):
			return false

	# Check hex is not occupied
	if get_ship_at(hex) != null:
		return false

	# Deploy ship
	ship.set_position(hex, direction)
	ship.is_deployed = true

	var pos_key = _hex_to_key(hex)
	ship_positions[pos_key] = ship_id

	# Handle mothership (occupies 2 hexes)
	if ship.ship_type == GameConstants.ShipType.MOTHERSHIP and ship.mothership_cockpit_hex:
		var cockpit_key = _hex_to_key(ship.mothership_cockpit_hex)
		ship_positions[cockpit_key] = ship_id

	return true

func move_ship(ship_id: String, to_hex: HexMath.HexCoord) -> bool:
	var ship = get_ship(ship_id)
	if not ship or not ship.is_deployed:
		return false

	# Validate move is legal (done by MovementValidator in actual implementation)
	var from_hex = ship.hex_position

	# Clear old position
	var old_pos_key = _hex_to_key(from_hex)
	ship_positions.erase(old_pos_key)

	if ship.ship_type == GameConstants.ShipType.MOTHERSHIP and ship.mothership_cockpit_hex:
		var old_cockpit_key = _hex_to_key(ship.mothership_cockpit_hex)
		ship_positions.erase(old_cockpit_key)

	# Set new position
	ship.hex_position = to_hex
	if ship.ship_type == GameConstants.ShipType.MOTHERSHIP:
		ship.update_mothership_cockpit()

	# Update position tracking
	var new_pos_key = _hex_to_key(to_hex)
	ship_positions[new_pos_key] = ship_id

	if ship.ship_type == GameConstants.ShipType.MOTHERSHIP and ship.mothership_cockpit_hex:
		var new_cockpit_key = _hex_to_key(ship.mothership_cockpit_hex)
		ship_positions[new_cockpit_key] = ship_id

	emit_signal("ship_moved", ship_id, from_hex, to_hex)
	return true

# === DEPLOYMENT ZONE VALIDATION ===

func is_hex_in_deployment_zone(hex: HexMath.HexCoord, zone: int) -> bool:
	var zone_data = DEPLOYMENT_ZONES.get(zone, null)
	if not zone_data:
		return false

	return hex.col in zone_data["cols"] and hex.row in zone_data["rows"]

func get_zone_default_direction(zone: int) -> int:
	var zone_data = DEPLOYMENT_ZONES.get(zone, null)
	if not zone_data:
		return 0
	return zone_data["default_direction"]

# === TURN MANAGEMENT ===

func start_game():
	if current_phase != GameConstants.GamePhase.WAITING:
		return

	current_phase = GameConstants.GamePhase.ZONE_SELECTION
	emit_signal("phase_changed", current_phase)

func start_deployment():
	current_phase = GameConstants.GamePhase.DEPLOYMENT
	emit_signal("phase_changed", current_phase)

func start_playing():
	current_phase = GameConstants.GamePhase.PLAYING
	turn_number = 1

	# Set first player
	if player_order.size() > 0:
		current_turn_player_id = player_order[0]
		reset_turn()
		emit_signal("turn_changed", current_turn_player_id)

	emit_signal("phase_changed", current_phase)

func end_turn():
	if current_phase != GameConstants.GamePhase.PLAYING:
		return

	# Find next non-eliminated player
	var current_index = player_order.find(current_turn_player_id)
	var next_index = (current_index + 1) % player_order.size()
	var attempts = 0

	while attempts < player_order.size():
		var next_player_id = player_order[next_index]
		var next_player = get_player(next_player_id)

		if next_player and not next_player.is_eliminated:
			current_turn_player_id = next_player_id
			turn_number += 1
			reset_turn()
			emit_signal("turn_changed", current_turn_player_id)
			return

		next_index = (next_index + 1) % player_order.size()
		attempts += 1

	# No valid players left - shouldn't happen
	push_error("No valid players for next turn")

func reset_turn():
	moves_this_turn = 0
	mothership_moved_this_turn = false

	# Reset AP for current player's ships
	for ship in get_player_ships(current_turn_player_id):
		ship.reset_action_points()

# === COMBAT ===

func resolve_combat(attacker_id: String, defender_id: String):
	var attacker = get_ship(attacker_id)
	var defender = get_ship(defender_id)

	if not attacker or not defender:
		return

	# Deal damage
	var damage = attacker.get_attack_damage()
	var defender_destroyed = defender.take_damage(damage)

	if defender_destroyed:
		destroy_ship(defender_id)

# === SHIP DESTRUCTION ===

func destroy_ship(ship_id: String):
	var ship = get_ship(ship_id)
	if not ship:
		return

	var destruction_hex = ship.hex_position

	# Remove ship
	remove_ship(ship_id)
	emit_signal("ship_destroyed", ship_id)

	# Create debris field
	create_debris_field(destruction_hex)

	# Check if player eliminated
	check_player_elimination(ship.owner_id)

func create_debris_field(center: HexMath.HexCoord):
	var affected_hexes = HexMath.get_hexes_in_range(center, GameConstants.DEBRIS_FIELD_RADIUS)
	for hex in affected_hexes:
		if not hex in debris_fields:
			debris_fields.append(hex)

# === PLAYER ELIMINATION ===

func check_player_elimination(player_id: String):
	var player = get_player(player_id)
	if not player or player.is_eliminated:
		return

	# Count player's remaining ships
	var ship_count = 0
	for ship in ships.values():
		if ship.owner_id == player_id and not ship.is_destroyed():
			ship_count += 1

	if ship_count == 0:
		eliminate_player(player_id, "All ships destroyed")

func eliminate_player(player_id: String, reason: String):
	var player = get_player(player_id)
	if not player:
		return

	player.is_eliminated = true
	player.elimination_reason = reason
	emit_signal("player_eliminated", player_id)

	# Check for game end
	check_victory_conditions()

# === VICTORY CONDITIONS ===

func check_victory_conditions():
	# Count remaining non-eliminated players
	var remaining_players = []
	for player_id in player_order:
		var player = get_player(player_id)
		if player and not player.is_eliminated:
			remaining_players.append(player_id)

	# Only one player left
	if remaining_players.size() == 1:
		end_game(remaining_players[0], "Last player standing")
		return

	# No players left (shouldn't happen)
	if remaining_players.size() == 0:
		end_game("", "No players remaining")
		return

	# Check cockpit captures
	for player_id in cockpit_captures:
		if cockpit_captures[player_id] >= GameConstants.COCKPIT_CAPTURE_HOLD_TURNS:
			end_game(player_id, "Mothership cockpit captured")
			return

func end_game(winner_id: String, reason: String):
	current_phase = GameConstants.GamePhase.ENDED
	emit_signal("game_ended", winner_id, reason)
	emit_signal("phase_changed", current_phase)

# === TERRAIN ===

func add_terrain_obstacle(hex: HexMath.HexCoord):
	if not hex in terrain_obstacles:
		terrain_obstacles.append(hex)

func is_terrain_obstacle(hex: HexMath.HexCoord) -> bool:
	for obstacle in terrain_obstacles:
		if obstacle.equals(hex):
			return true
	return false

func is_debris_field(hex: HexMath.HexCoord) -> bool:
	for debris in debris_fields:
		if debris.equals(hex):
			return true
	return false

# === HELPERS ===

static func _hex_to_key(hex: HexMath.HexCoord) -> String:
	return str(hex.col) + "," + str(hex.row)

# === SERIALIZATION ===

func to_dict() -> Dictionary:
	var players_data = {}
	for player_id in players:
		var player = players[player_id]
		players_data[player_id] = {
			"player_id": player.player_id,
			"player_name": player.player_name,
			"color": player.color,
			"is_ai": player.is_ai,
			"is_ready": player.is_ready,
			"assigned_zone": player.assigned_zone,
			"is_eliminated": player.is_eliminated,
			"elimination_reason": player.elimination_reason,
			"team": player.team
		}

	var ships_data = {}
	for ship_id in ships:
		ships_data[ship_id] = ships[ship_id].to_dict()

	return {
		"game_id": game_id,
		"game_mode": game_mode,
		"map_type": map_type,
		"current_phase": current_phase,
		"players": players_data,
		"player_order": player_order,
		"current_turn_player_id": current_turn_player_id,
		"turn_number": turn_number,
		"ships": ships_data,
		"terrain_obstacles": _hexes_to_array(terrain_obstacles),
		"debris_fields": _hexes_to_array(debris_fields)
	}

static func _hexes_to_array(hexes: Array) -> Array:
	var result = []
	for hex in hexes:
		if hex is HexMath.HexCoord:
			result.append({"col": hex.col, "row": hex.row})
	return result
