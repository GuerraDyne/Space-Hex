extends Node
class_name GameController

# Main Game Controller
# Orchestrates game flow, turns, and player actions

signal game_started()
signal phase_changed(phase: GameConstants.GamePhase)
signal turn_changed(player_id: String)

var game_state: GameState
var hex_board: HexBoard
var ai_controllers: Dictionary = {}  # player_id -> AIController

var local_player_id: String = ""

func _ready():
	game_state = GameState.new()
	add_child(game_state)

	# Connect signals
	game_state.phase_changed.connect(_on_phase_changed)
	game_state.turn_changed.connect(_on_turn_changed)
	game_state.game_ended.connect(_on_game_ended)

func setup_board(board: HexBoard):
	hex_board = board
	hex_board.initialize(game_state)

	# Connect board signals
	hex_board.hex_clicked.connect(_on_hex_clicked)
	hex_board.ship_clicked.connect(_on_ship_clicked)

func start_new_game(mode: GameConstants.GameMode, map_type: GameConstants.MapType):
	"""Start a new game"""
	game_state.game_mode = mode
	game_state.map_type = map_type

	# Generate map
	var map_data = MapGenerator.generate_map(map_type)
	for obstacle in map_data.obstacles:
		game_state.add_terrain_obstacle(obstacle)

	# Add players (example: 2 players for testing)
	setup_test_players()

	# Initialize fleet for each player
	for player_id in game_state.players:
		create_player_fleet(player_id)

	# Start game
	game_state.start_game()
	emit_signal("game_started")

func setup_test_players():
	"""Setup test players (placeholder for actual multiplayer)"""
	# Add human player
	local_player_id = "player_1"
	game_state.add_player(local_player_id, "Player", GameConstants.PlayerColor.BLUE, false)
	game_state.assign_zone_to_player(local_player_id, GameConstants.DeploymentZone.ZONE_1_TOP_RIGHT)

	# Add AI opponent
	var ai_id = "ai_1"
	game_state.add_player(ai_id, "AI Opponent", GameConstants.PlayerColor.RED, true)
	game_state.assign_zone_to_player(ai_id, GameConstants.DeploymentZone.ZONE_3_BOTTOM_LEFT)

	# Create AI controller
	var ai_controller = AIController.new()
	ai_controller.setup(ai_id, game_state, GameConstants.AIDifficulty.MEDIUM)
	add_child(ai_controller)
	ai_controllers[ai_id] = ai_controller

func create_player_fleet(player_id: String):
	"""Create fleet for a player"""
	var player = game_state.get_player(player_id)
	if not player:
		return

	var ship_id_counter = 0

	# Create ships based on fleet composition
	for ship_type in GameConstants.FLEET_COMPOSITION:
		var count = GameConstants.FLEET_COMPOSITION[ship_type]

		for i in range(count):
			var ship = Ship.new()
			var id = player_id + "_" + GameConstants.SHIP_TYPE_NAMES[ship_type] + "_" + str(ship_id_counter)
			ship.setup(ship_type, player_id, player.color, id)
			game_state.add_ship(ship)
			ship_id_counter += 1

	# Add leader (player chooses, default to Fleet Admiral)
	var leader = Ship.new()
	var leader_id = player_id + "_leader_" + str(ship_id_counter)
	leader.setup(GameConstants.ShipType.FLEET_ADMIRAL, player_id, player.color, leader_id)
	game_state.add_ship(leader)

func _on_phase_changed(phase: GameConstants.GamePhase):
	"""Handle phase changes"""
	print("Phase changed to: ", phase)

	match phase:
		GameConstants.GamePhase.DEPLOYMENT:
			start_deployment_phase()

		GameConstants.GamePhase.PLAYING:
			start_playing_phase()

	emit_signal("phase_changed", phase)

func start_deployment_phase():
	"""Start deployment phase"""
	# Auto-deploy for AI
	for player_id in ai_controllers:
		var ai = ai_controllers[player_id]
		ai.auto_deploy()

	# Show deployment zone for human player
	var player = game_state.get_player(local_player_id)
	if player and hex_board:
		hex_board.show_deployment_zone(player.assigned_zone)

func start_playing_phase():
	"""Start playing phase"""
	if hex_board:
		hex_board.clear_highlights()

	# Check if AI's turn
	check_ai_turn()

func _on_turn_changed(player_id: String):
	"""Handle turn changes"""
	print("Turn changed to: ", player_id)
	emit_signal("turn_changed", player_id)

	# Check if AI turn
	check_ai_turn()

func check_ai_turn():
	"""Check if current player is AI and execute turn"""
	if game_state.current_phase != GameConstants.GamePhase.PLAYING:
		return

	var current_player = game_state.get_player(game_state.current_turn_player_id)
	if not current_player:
		return

	if current_player.is_ai:
		var ai = ai_controllers.get(current_player.player_id, null)
		if ai:
			ai.execute_turn()

func _on_hex_clicked(hex: HexMath.HexCoord):
	"""Handle hex click from board"""
	if game_state.current_phase == GameConstants.GamePhase.DEPLOYMENT:
		handle_deployment_click(hex)
	elif game_state.current_phase == GameConstants.GamePhase.PLAYING:
		handle_playing_click(hex)

func _on_ship_clicked(ship_id: String):
	"""Handle ship click from board"""
	print("Ship clicked: ", ship_id)

func handle_deployment_click(hex: HexMath.HexCoord):
	"""Handle click during deployment"""
	# TODO: Implement ship selection and deployment UI
	pass

func handle_playing_click(hex: HexMath.HexCoord):
	"""Handle click during playing phase"""
	if game_state.current_turn_player_id != local_player_id:
		return  # Not player's turn

	if not hex_board.selected_ship:
		return

	# Try to move selected ship
	var ship = hex_board.selected_ship
	var validation = MovementValidator.can_move_to(ship, hex, game_state)

	if validation.valid:
		# Check for combat
		var target_ship = game_state.get_ship_at(hex)
		if target_ship and target_ship.owner_id != ship.owner_id and ship.can_attack():
			game_state.resolve_combat(ship.ship_id, target_ship.ship_id)

		# Move ship
		game_state.move_ship(ship.ship_id, hex)
		ship.use_action_points(validation.ap_cost)

		# Deselect
		hex_board.selected_ship = null
		hex_board.clear_highlights()

func end_player_turn():
	"""End current player's turn"""
	if game_state.current_turn_player_id == local_player_id:
		game_state.end_turn()

func _on_game_ended(winner_id: String, reason: String):
	"""Handle game end"""
	print("Game ended. Winner: ", winner_id, " Reason: ", reason)

	var winner = game_state.get_player(winner_id)
	if winner:
		print("Winner: ", winner.player_name)
