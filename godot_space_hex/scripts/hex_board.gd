extends Node2D
class_name HexBoard

# Visual Hex Board Renderer
# Renders the hex grid, ships, and terrain

signal hex_clicked(hex: HexMath.HexCoord)
signal ship_clicked(ship_id: String)

# === RENDERING CONFIG ===
@export var hex_size: float = 40.0  # Radius of hexagon in pixels
@export var show_coordinates: bool = false
@export var show_grid: bool = true

# === COLORS ===
const COLOR_GRID = Color(0.3, 0.3, 0.4, 0.5)
const COLOR_VALID_MOVE = Color(0.2, 0.8, 0.2, 0.4)
const COLOR_SELECTED = Color(0.8, 0.8, 0.2, 0.5)
const COLOR_DEPLOYMENT_ZONE = Color(0.2, 0.4, 0.8, 0.2)
const COLOR_OBSTACLE = Color(0.6, 0.2, 0.2, 0.6)

# === STATE ===
var game_state: GameState
var selected_hex: HexMath.HexCoord = null
var selected_ship: Ship = null
var valid_moves: Array[HexMath.HexCoord] = []

# === RENDERING ===
var hex_shapes: Dictionary = {}  # hex_key -> Polygon2D
var ship_sprites: Dictionary = {}  # ship_id -> Sprite2D
var terrain_sprites: Dictionary = {}  # hex_key -> Sprite2D

func _ready():
	pass

func initialize(state: GameState):
	game_state = state
	build_board()

	# Connect to game state signals
	game_state.ship_moved.connect(_on_ship_moved)
	game_state.ship_destroyed.connect(_on_ship_destroyed)

func build_board():
	"""Build the visual hex board"""
	clear_board()

	# Create hex grid
	for col in range(GameConstants.BOARD_COLUMNS):
		for row in range(1, GameConstants.BOARD_ROWS + 1):
			var hex = HexMath.HexCoord.new(col, row)
			create_hex_visual(hex)

	# Create terrain
	for obstacle in game_state.terrain_obstacles:
		create_terrain_visual(obstacle)

	# Create ships
	for ship in game_state.ships.values():
		if ship.is_deployed and not ship.is_docked_in_mothership:
			create_ship_visual(ship)

func clear_board():
	"""Clear all visual elements"""
	for hex_shape in hex_shapes.values():
		hex_shape.queue_free()
	hex_shapes.clear()

	for sprite in ship_sprites.values():
		sprite.queue_free()
	ship_sprites.clear()

	for terrain in terrain_sprites.values():
		terrain.queue_free()
	terrain_sprites.clear()

func create_hex_visual(hex: HexMath.HexCoord):
	"""Create visual representation of a hex"""
	var polygon = Polygon2D.new()
	polygon.polygon = get_hex_polygon()
	polygon.color = Color(0, 0, 0, 0)  # Transparent fill

	if show_grid:
		polygon.modulate = Color.WHITE
		# Draw outline (will be done in _draw)

	var pos = HexMath.hex_to_pixel(hex, hex_size)
	polygon.position = pos

	# Store hex reference
	polygon.set_meta("hex", hex)

	add_child(polygon)
	var hex_key = _hex_to_key(hex)
	hex_shapes[hex_key] = polygon

	# Add label if showing coordinates
	if show_coordinates:
		var label = Label.new()
		label.text = hex._to_string()
		label.position = pos - Vector2(15, 10)
		label.add_theme_font_size_override("font_size", 10)
		add_child(label)

func get_hex_polygon() -> PackedVector2Array:
	"""Get points for a hexagon polygon"""
	var points = PackedVector2Array()
	for i in range(6):
		var angle_deg = 60.0 * i
		var angle_rad = deg_to_rad(angle_deg)
		var x = hex_size * cos(angle_rad)
		var y = hex_size * sin(angle_rad)
		points.append(Vector2(x, y))
	return points

func create_ship_visual(ship: Ship):
	"""Create visual representation of a ship"""
	var sprite = Sprite2D.new()

	# Load ship texture
	var texture_path = GameConstants.get_ship_sprite_path(ship.ship_type, ship.color)
	sprite.texture = load(texture_path)

	# Position at hex
	var pos = HexMath.hex_to_pixel(ship.hex_position, hex_size)
	sprite.position = pos

	# Rotate to face correct direction
	var degrees = GameConstants.direction_to_degrees(ship.direction)
	sprite.rotation_degrees = degrees

	# Scale to fit hex
	sprite.scale = Vector2(0.8, 0.8)

	# Store ship reference
	sprite.set_meta("ship_id", ship.ship_id)

	add_child(sprite)
	ship_sprites[ship.ship_id] = sprite

	# Handle mothership (2 hexes)
	if ship.ship_type == GameConstants.ShipType.MOTHERSHIP and ship.mothership_cockpit_hex:
		# Cockpit is part of the same sprite, positioned between both hexes
		var cockpit_pos = HexMath.hex_to_pixel(ship.mothership_cockpit_hex, hex_size)
		var center_pos = (pos + cockpit_pos) / 2.0
		sprite.position = center_pos

func create_terrain_visual(hex: HexMath.HexCoord):
	"""Create visual for terrain obstacle"""
	var sprite = Sprite2D.new()

	# Load random meteor sprite
	var obstacle_index = hex.col + hex.row * 12
	var texture_path = MapGenerator.get_terrain_sprite_for_obstacle(obstacle_index)

	if ResourceLoader.exists(texture_path):
		sprite.texture = load(texture_path)
	else:
		# Fallback - create colored polygon
		var polygon = Polygon2D.new()
		polygon.polygon = get_hex_polygon()
		polygon.color = COLOR_OBSTACLE
		var pos = HexMath.hex_to_pixel(hex, hex_size)
		polygon.position = pos
		add_child(polygon)
		var hex_key = _hex_to_key(hex)
		terrain_sprites[hex_key] = polygon
		return

	var pos = HexMath.hex_to_pixel(hex, hex_size)
	sprite.position = pos
	sprite.scale = Vector2(0.9, 0.9)

	add_child(sprite)
	var hex_key = _hex_to_key(hex)
	terrain_sprites[hex_key] = sprite

func update_ship_visual(ship: Ship):
	"""Update existing ship visual"""
	var sprite = ship_sprites.get(ship.ship_id, null)
	if not sprite:
		create_ship_visual(ship)
		return

	# Update position
	var pos = HexMath.hex_to_pixel(ship.hex_position, hex_size)

	if ship.ship_type == GameConstants.ShipType.MOTHERSHIP and ship.mothership_cockpit_hex:
		var cockpit_pos = HexMath.hex_to_pixel(ship.mothership_cockpit_hex, hex_size)
		var center_pos = (pos + cockpit_pos) / 2.0
		sprite.position = center_pos
	else:
		sprite.position = pos

	# Update rotation
	var degrees = GameConstants.direction_to_degrees(ship.direction)
	sprite.rotation_degrees = degrees

func remove_ship_visual(ship_id: String):
	"""Remove ship sprite"""
	var sprite = ship_sprites.get(ship_id, null)
	if sprite:
		sprite.queue_free()
		ship_sprites.erase(ship_id)

func highlight_hex(hex: HexMath.HexCoord, color: Color):
	"""Highlight a specific hex"""
	var hex_key = _hex_to_key(hex)
	var polygon = hex_shapes.get(hex_key, null)
	if polygon:
		polygon.color = color

func clear_highlights():
	"""Clear all hex highlights"""
	for polygon in hex_shapes.values():
		polygon.color = Color(0, 0, 0, 0)

func show_valid_moves(ship: Ship):
	"""Highlight valid moves for a ship"""
	clear_highlights()
	valid_moves = MovementValidator.get_all_valid_moves(ship, game_state)

	for hex in valid_moves:
		highlight_hex(hex, COLOR_VALID_MOVE)

func show_deployment_zone(zone: int):
	"""Highlight deployment zone"""
	clear_highlights()

	for col in range(GameConstants.BOARD_COLUMNS):
		for row in range(1, GameConstants.BOARD_ROWS + 1):
			var hex = HexMath.HexCoord.new(col, row)
			if game_state.is_hex_in_deployment_zone(hex, zone):
				highlight_hex(hex, COLOR_DEPLOYMENT_ZONE)

# === INPUT HANDLING ===

func _input(event):
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var local_pos = get_local_mouse_position()
		var hex = HexMath.pixel_to_hex(local_pos, hex_size)

		if HexMath.is_valid_hex(hex):
			_on_hex_clicked(hex)

func _on_hex_clicked(hex: HexMath.HexCoord):
	"""Handle hex click"""
	# Check if ship on hex
	var ship = game_state.get_ship_at(hex)

	if ship:
		_on_ship_clicked(ship)
	else:
		# Empty hex clicked
		if selected_ship:
			# Try to move selected ship
			var validation = MovementValidator.can_move_to(selected_ship, hex, game_state)
			if validation.valid:
				# Request move (will be handled by game controller)
				emit_signal("hex_clicked", hex)
		else:
			emit_signal("hex_clicked", hex)

func _on_ship_clicked(ship: Ship):
	"""Handle ship click"""
	selected_ship = ship
	selected_hex = ship.hex_position

	# Highlight this ship's hex
	clear_highlights()
	highlight_hex(ship.hex_position, COLOR_SELECTED)

	# Show valid moves
	show_valid_moves(ship)

	emit_signal("ship_clicked", ship.ship_id)

# === SIGNAL HANDLERS ===

func _on_ship_moved(ship_id: String, from_hex: HexMath.HexCoord, to_hex: HexMath.HexCoord):
	var ship = game_state.get_ship(ship_id)
	if ship:
		update_ship_visual(ship)

func _on_ship_destroyed(ship_id: String):
	remove_ship_visual(ship_id)

	# Create debris marker
	# (could add debris sprite here)

# === HELPERS ===

static func _hex_to_key(hex: HexMath.HexCoord) -> String:
	return str(hex.col) + "," + str(hex.row)

# === CAMERA CONTROLS ===

func center_camera_on_hex(hex: HexMath.HexCoord):
	var pos = HexMath.hex_to_pixel(hex, hex_size)
	# Move camera to center on this position
	# (Requires camera node setup)

func _draw():
	# Draw grid lines
	if show_grid:
		for hex_key in hex_shapes:
			var polygon = hex_shapes[hex_key]
			var points = get_hex_polygon()
			var pos = polygon.position

			# Draw hex outline
			for i in range(6):
				var p1 = pos + points[i]
				var p2 = pos + points[(i + 1) % 6]
				draw_line(p1, p2, COLOR_GRID, 1.0)
