extends Node
class_name AIController

# AI Controller - implements AI decision making
# Based on the original HexarchAI.ts logic

# === AI CONFIGURATION ===
var difficulty: GameConstants.AIDifficulty = GameConstants.AIDifficulty.MEDIUM
var player_id: String
var game_state: GameState

# === SHIP VALUES (for evaluation) ===
const SHIP_VALUES = {
	GameConstants.ShipType.MOTHERSHIP: 1000,
	GameConstants.ShipType.CAPTAIN: 8,
	GameConstants.ShipType.FLEET_ADMIRAL: 8,
	GameConstants.ShipType.DESTROYER: 5,
	GameConstants.ShipType.ARTILLERY: 4,
	GameConstants.ShipType.CORVETTE: 4,
	GameConstants.ShipType.INTERCEPTOR: 3,
	GameConstants.ShipType.SCOUT: 2
}

signal ai_move_completed()
signal ai_turn_ended()

func _init():
	pass

func setup(ai_player_id: String, state: GameState, ai_difficulty: GameConstants.AIDifficulty = GameConstants.AIDifficulty.MEDIUM):
	player_id = ai_player_id
	game_state = state
	difficulty = ai_difficulty

func execute_turn():
	"""Execute AI turn"""
	await get_tree().create_timer(get_move_delay()).timeout

	# Get all AI ships
	var ai_ships = game_state.get_player_ships(player_id)

	if ai_ships.size() == 0:
		end_turn()
		return

	# Generate and execute moves
	var moves_made = 0
	var max_moves = 3  # AI makes up to 3 moves per turn

	while moves_made < max_moves:
		var best_move = find_best_move(ai_ships)

		if not best_move:
			break

		# Execute move
		execute_move(best_move)
		await ai_move_completed

		moves_made += 1
		await get_tree().create_timer(get_move_delay()).timeout

	# End turn
	end_turn()

func find_best_move(ships: Array[Ship]) -> Dictionary:
	"""Find best move for AI"""
	var all_moves = []

	# Generate all possible moves
	for ship in ships:
		if not ship.is_deployed or ship.is_docked_in_mothership:
			continue

		if not ship.has_action_points():
			continue

		var valid_moves = MovementValidator.get_all_valid_moves(ship, game_state)

		for target_hex in valid_moves:
			var move = {
				"ship": ship,
				"target": target_hex,
				"score": 0.0
			}

			# Score the move
			move.score = evaluate_move(ship, target_hex)
			all_moves.append(move)

	# Sort moves by score
	all_moves.sort_custom(func(a, b): return a.score > b.score)

	# Apply difficulty-based selection
	if all_moves.size() == 0:
		return null

	match difficulty:
		GameConstants.AIDifficulty.EASY:
			# Random selection from top 50%
			var random_index = randi() % max(1, all_moves.size() / 2)
			return all_moves[random_index]

		GameConstants.AIDifficulty.MEDIUM:
			# Random selection from top 25%
			var random_index = randi() % max(1, all_moves.size() / 4)
			return all_moves[random_index]

		_:  # HARD, EXPERT, MASTER
			# Best move
			return all_moves[0]

func evaluate_move(ship: Ship, target_hex: HexMath.HexCoord) -> float:
	"""Evaluate quality of a move"""
	var score = 0.0

	# Distance to enemy mothership (closer is better)
	var enemy_mothership = find_enemy_mothership()
	if enemy_mothership:
		var current_dist = HexMath.hex_distance(ship.hex_position, enemy_mothership.hex_position)
		var new_dist = HexMath.hex_distance(target_hex, enemy_mothership.hex_position)
		score += (current_dist - new_dist) * 10.0  # Reward moving closer

	# Threat assessment
	var enemy_ships_near_target = count_enemy_ships_in_range(target_hex, 2)
	var friendly_ships_near_target = count_friendly_ships_in_range(target_hex, 2)

	# Avoid overwhelming enemy forces
	if enemy_ships_near_target > friendly_ships_near_target + 1:
		score -= 20.0

	# Attack opportunities
	var enemy_at_target = game_state.get_ship_at(target_hex)
	if enemy_at_target and enemy_at_target.owner_id != player_id:
		if ship.can_attack():
			# Value attacking based on target value
			score += SHIP_VALUES.get(enemy_at_target.ship_type, 5) * 5.0

	# Protect our mothership
	var our_mothership = find_our_mothership()
	if our_mothership:
		var threats_to_mothership = count_enemy_ships_in_range(our_mothership.hex_position, 3)
		if threats_to_mothership > 0:
			# Reward moving to defend
			var dist_to_mothership = HexMath.hex_distance(target_hex, our_mothership.hex_position)
			if dist_to_mothership <= 2:
				score += 15.0

	# Avoid terrain
	if game_state.is_terrain_obstacle(target_hex):
		score -= 100.0

	# Avoid debris
	if game_state.is_debris_field(target_hex):
		score -= 5.0

	# Add some randomness for variety
	score += randf() * 5.0

	return score

func execute_move(move: Dictionary):
	"""Execute a move"""
	if not move or not move.has("ship") or not move.has("target"):
		emit_signal("ai_move_completed")
		return

	var ship: Ship = move.ship
	var target: HexMath.HexCoord = move.target

	# Validate move is still valid
	var validation = MovementValidator.can_move_to(ship, target, game_state)
	if not validation.valid:
		emit_signal("ai_move_completed")
		return

	# Check if attacking
	var target_ship = game_state.get_ship_at(target)
	if target_ship and target_ship.owner_id != player_id and ship.can_attack():
		# Combat move
		game_state.resolve_combat(ship.ship_id, target_ship.ship_id)

	# Execute move
	game_state.move_ship(ship.ship_id, target)
	ship.use_action_points(validation.ap_cost)

	emit_signal("ai_move_completed")

func end_turn():
	"""End AI turn"""
	game_state.end_turn()
	emit_signal("ai_turn_ended")

# === HELPER FUNCTIONS ===

func find_enemy_mothership() -> Ship:
	"""Find first enemy mothership"""
	for ship in game_state.ships.values():
		if ship.ship_type == GameConstants.ShipType.MOTHERSHIP and ship.owner_id != player_id:
			return ship
	return null

func find_our_mothership() -> Ship:
	"""Find our mothership"""
	for ship in game_state.ships.values():
		if ship.ship_type == GameConstants.ShipType.MOTHERSHIP and ship.owner_id == player_id:
			return ship
	return null

func count_enemy_ships_in_range(hex: HexMath.HexCoord, range_val: int) -> int:
	"""Count enemy ships within range"""
	var count = 0
	var hexes_in_range = HexMath.get_hexes_in_range(hex, range_val)

	for check_hex in hexes_in_range:
		var ship = game_state.get_ship_at(check_hex)
		if ship and ship.owner_id != player_id:
			count += 1

	return count

func count_friendly_ships_in_range(hex: HexMath.HexCoord, range_val: int) -> int:
	"""Count friendly ships within range"""
	var count = 0
	var hexes_in_range = HexMath.get_hexes_in_range(hex, range_val)

	for check_hex in hexes_in_range:
		var ship = game_state.get_ship_at(check_hex)
		if ship and ship.owner_id == player_id:
			count += 1

	return count

func get_move_delay() -> float:
	"""Get delay between moves based on difficulty"""
	var delay_ms = GameConstants.AI_MOVE_DELAY_MS.get(difficulty, 1000)
	return delay_ms / 1000.0

# === AUTO-DEPLOYMENT ===

func auto_deploy():
	"""Automatically deploy all ships for AI"""
	var player = game_state.get_player(player_id)
	if not player or player.assigned_zone == 0:
		return

	var zone = player.assigned_zone
	var zone_direction = game_state.get_zone_default_direction(zone)

	# Get available hexes in zone
	var available_hexes = get_deployment_zone_hexes(zone)

	# Shuffle for randomness
	available_hexes.shuffle()

	# Deploy ships
	var ships = game_state.get_player_ships(player_id)
	var hex_index = 0

	for ship in ships:
		if hex_index >= available_hexes.size():
			break

		var hex = available_hexes[hex_index]

		# Try to deploy
		if game_state.deploy_ship(ship.ship_id, hex, zone_direction):
			hex_index += 1

			# Mothership takes 2 hexes
			if ship.ship_type == GameConstants.ShipType.MOTHERSHIP:
				hex_index += 1

func get_deployment_zone_hexes(zone: int) -> Array[HexMath.HexCoord]:
	"""Get all hexes in deployment zone"""
	var hexes: Array[HexMath.HexCoord] = []

	for col in range(GameConstants.BOARD_COLUMNS):
		for row in range(1, GameConstants.BOARD_ROWS + 1):
			var hex = HexMath.HexCoord.new(col, row)
			if game_state.is_hex_in_deployment_zone(hex, zone):
				# Check not obstacle
				if not game_state.is_terrain_obstacle(hex):
					hexes.append(hex)

	return hexes
