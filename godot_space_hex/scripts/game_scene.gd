extends Node2D

# Main Game Scene Script

@onready var hex_board = $HexBoard
@onready var game_controller = $GameController
@onready var camera = $Camera2D

# UI Elements
@onready var turn_label = $UI/HUD/TopBar/HBoxContainer/TurnLabel
@onready var phase_label = $UI/HUD/TopBar/HBoxContainer/PhaseLabel
@onready var fleet_info = $UI/HUD/BottomPanel/FleetInfo
@onready var end_turn_button = $UI/HUD/TopBar/HBoxContainer/EndTurnButton

func _ready():
	# Setup game controller
	game_controller.setup_board(hex_board)

	# Connect signals
	game_controller.phase_changed.connect(_on_phase_changed)
	game_controller.turn_changed.connect(_on_turn_changed)

	# Start a new game
	game_controller.start_new_game(
		GameConstants.GameMode.VS_AI,
		GameConstants.MapType.CLASSIC
	)

	# Position camera
	camera.position = Vector2(500, 400)

func _on_phase_changed(phase: GameConstants.GamePhase):
	var phase_names = {
		GameConstants.GamePhase.WAITING: "Waiting",
		GameConstants.GamePhase.ZONE_SELECTION: "Zone Selection",
		GameConstants.GamePhase.DEPLOYMENT: "Deployment",
		GameConstants.GamePhase.PLAYING: "Playing",
		GameConstants.GamePhase.ENDED: "Game Over"
	}

	phase_label.text = "Phase: " + phase_names.get(phase, "Unknown")

func _on_turn_changed(player_id: String):
	var player = game_controller.game_state.get_player(player_id)
	if player:
		turn_label.text = "Turn: " + str(game_controller.game_state.turn_number) + " - " + player.player_name

	update_fleet_info()

func update_fleet_info():
	if not game_controller.game_state:
		return

	var local_player_id = game_controller.local_player_id
	var ships = game_controller.game_state.get_player_ships(local_player_id)

	var deployed = 0
	for ship in ships:
		if ship.is_deployed:
			deployed += 1

	fleet_info.text = "Fleet: %d/%d ships deployed" % [deployed, ships.size()]

	if hex_board.selected_ship:
		fleet_info.text += "\nSelected: " + hex_board.selected_ship.get_debug_string()

func _on_end_turn_pressed():
	game_controller.end_player_turn()

func _process(_delta):
	update_fleet_info()
