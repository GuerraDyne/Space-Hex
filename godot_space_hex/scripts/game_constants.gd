extends Node
class_name GameConstants

# Game Constants - Single source of truth for all game configuration

# === SHIP TYPES ===
enum ShipType {
	SCOUT,
	INTERCEPTOR,
	CORVETTE,
	ARTILLERY,
	DESTROYER,
	FLEET_ADMIRAL,  # Cruiser variant
	CAPTAIN,        # Battleship variant
	MOTHERSHIP
}

# === PLAYER COLORS ===
enum PlayerColor {
	BLUE,
	RED,
	GREEN,
	YELLOW
}

# === GAME PHASES ===
enum GamePhase {
	WAITING,
	ZONE_SELECTION,
	DEPLOYMENT,
	PLAYING,
	ENDED
}

# === GAME MODES ===
enum GameMode {
	FFA,        # Free-for-all (2-4 players)
	ONE_V_ONE,  # 1v1
	TEAM_2V2,   # 2v2 teams
	VS_AI       # Single player vs AI
}

# === DEPLOYMENT ZONES ===
enum DeploymentZone {
	ZONE_1_TOP_RIGHT = 1,
	ZONE_2_BOTTOM_RIGHT = 2,
	ZONE_3_BOTTOM_LEFT = 3,
	ZONE_4_TOP_LEFT = 4
}

# === HEX DIRECTIONS (0-5) ===
# Using single direction system (NOT mixing with degrees)
# 0 = East, 1 = SE, 2 = SW, 3 = West, 4 = NW, 5 = NE
const HEX_DIRECTIONS = 6

# Direction to degree mapping (for visuals only)
const DIRECTION_TO_DEGREES = {
	0: 0,    # East
	1: 60,   # Southeast
	2: 120,  # Southwest
	3: 180,  # West
	4: 240,  # Northwest
	5: 300   # Northeast
}

# === BOARD DIMENSIONS ===
const BOARD_COLUMNS = 12  # a-l (indices 0-11)
const BOARD_ROWS = 11     # 1-11
const TOTAL_HEXES = 91    # Actual playable hexes

# === SHIP STATS ===
const SHIP_ACTION_POINTS = {
	ShipType.SCOUT: 3,
	ShipType.INTERCEPTOR: 4,
	ShipType.CORVETTE: 5,
	ShipType.ARTILLERY: 6,
	ShipType.DESTROYER: 7,
	ShipType.FLEET_ADMIRAL: 7,
	ShipType.CAPTAIN: 7,
	ShipType.MOTHERSHIP: 1
}

const SHIP_HEALTH = {
	ShipType.SCOUT: 100,
	ShipType.INTERCEPTOR: 100,
	ShipType.CORVETTE: 100,
	ShipType.ARTILLERY: 100,
	ShipType.DESTROYER: 100,
	ShipType.FLEET_ADMIRAL: 100,
	ShipType.CAPTAIN: 100,
	ShipType.MOTHERSHIP: 200  # Mothership is tougher
}

const SHIP_ATTACK_DAMAGE = {
	ShipType.SCOUT: 0,           # Cannot attack
	ShipType.INTERCEPTOR: 0,     # Cannot attack
	ShipType.CORVETTE: 100,      # 1-hit kill
	ShipType.ARTILLERY: 0,       # Range attack only
	ShipType.DESTROYER: 100,     # 1-hit kill
	ShipType.FLEET_ADMIRAL: 100, # 1-hit kill
	ShipType.CAPTAIN: 100,       # 1-hit kill
	ShipType.MOTHERSHIP: 100     # 1-hit kill when ramming
}

# === FLEET COMPOSITION (per player) ===
const FLEET_COMPOSITION = {
	ShipType.MOTHERSHIP: 1,
	ShipType.SCOUT: 2,
	ShipType.INTERCEPTOR: 2,
	ShipType.CORVETTE: 2,
	ShipType.ARTILLERY: 2,
	ShipType.DESTROYER: 1,
	# Player chooses either Fleet Admiral OR Captain (not both)
}
const TOTAL_SHIPS_PER_PLAYER = 11  # 10 regular + 1 mothership (+ 1 leader choice)

# === MOVEMENT PATTERNS ===
# F = Forward, FS = Forward-Side (diagonal), S = Side, B = Backward
# Format: [forward, forward_side, side, backward]
const SHIP_MOVEMENT_RANGE = {
	ShipType.SCOUT: [5, 3, 2, 1],
	ShipType.INTERCEPTOR: [4, 3, 1, 0],
	ShipType.CORVETTE: [3, 2, 1, 1],
	ShipType.ARTILLERY: [3, 2, 1, 0],
	ShipType.DESTROYER: [2, 1, 0, 0],
	ShipType.FLEET_ADMIRAL: [2, 1, 0, 0],
	ShipType.CAPTAIN: [2, 1, 0, 0],
	ShipType.MOTHERSHIP: [1, 1, 1, 1]  # Omnidirectional
}

# === ROTATION RULES ===
const ROTATION_COST_AP = 1  # 1 AP per 60° rotation
const SHIPS_WITH_FREE_ROTATION = [ShipType.SCOUT]
const SHIPS_CAN_ROTATE_WHILE_MOVING = [ShipType.INTERCEPTOR, ShipType.CORVETTE]

# === TIMERS ===
const DEPLOYMENT_TIME_SECONDS = 180  # 3 minutes
const TURN_TIME_SECONDS = 180        # 3 minutes
const ZONE_SELECTION_TIME = 60       # 1 minute

# === VICTORY CONDITIONS ===
const COCKPIT_CAPTURE_HOLD_TURNS = 1  # Must hold cockpit for 1 turn

# === DEBRIS SYSTEM ===
const DEBRIS_FIELD_RADIUS = 20  # Hexes affected by debris

# === AI DIFFICULTY ===
enum AIDifficulty {
	EASY,
	MEDIUM,
	HARD,
	EXPERT,
	MASTER
}

const AI_MOVE_DELAY_MS = {
	AIDifficulty.EASY: 1500,
	AIDifficulty.MEDIUM: 1000,
	AIDifficulty.HARD: 500,
	AIDifficulty.EXPERT: 300,
	AIDifficulty.MASTER: 200
}

# === MAP TYPES ===
enum MapType {
	CLASSIC,
	GRAVEYARD,
	METEOR_SHOWER,
	RANDOM
}

# === SHIP NAMES (for display) ===
const SHIP_TYPE_NAMES = {
	ShipType.SCOUT: "Scout",
	ShipType.INTERCEPTOR: "Interceptor",
	ShipType.CORVETTE: "Corvette",
	ShipType.ARTILLERY: "Artillery",
	ShipType.DESTROYER: "Destroyer",
	ShipType.FLEET_ADMIRAL: "Fleet Admiral",
	ShipType.CAPTAIN: "Captain",
	ShipType.MOTHERSHIP: "Mothership"
}

# === COLOR NAMES ===
const COLOR_NAMES = {
	PlayerColor.BLUE: "Blue",
	PlayerColor.RED: "Red",
	PlayerColor.GREEN: "Green",
	PlayerColor.YELLOW: "Yellow"
}

# === NETWORKING ===
const DEFAULT_SERVER_PORT = 2567
const DEFAULT_SERVER_HOST = "localhost"
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY_MS = 2000
const HEARTBEAT_INTERVAL_MS = 30000

# Helper function to get ship sprite path
static func get_ship_sprite_path(ship_type: ShipType, color: PlayerColor) -> String:
	var color_name = COLOR_NAMES[color]
	var ship_name = SHIP_TYPE_NAMES[ship_type]

	# Handle special naming for mothership and variants
	if ship_type == ShipType.MOTHERSHIP:
		return "res://assets/ships/" + color_name + "_Command_Ship.png"
	elif ship_type == ShipType.FLEET_ADMIRAL:
		return "res://assets/ships/" + color_name + " Cruiser.png"
	elif ship_type == ShipType.CAPTAIN:
		return "res://assets/ships/" + color_name + " Battleship.png"
	else:
		return "res://assets/ships/" + color_name + " " + ship_name + ".png"

# Helper function to convert direction enum to degrees (for rendering)
static func direction_to_degrees(direction: int) -> float:
	return DIRECTION_TO_DEGREES.get(direction, 0.0)

# Helper function to get opposite direction
static func get_opposite_direction(direction: int) -> int:
	return (direction + 3) % HEX_DIRECTIONS
