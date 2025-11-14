extends Control

# Main Menu Script

func _ready():
	pass

func _on_quick_match_pressed():
	# Load game scene with quick match settings
	get_tree().change_scene_to_file("res://scenes/game.tscn")

func _on_vs_ai_pressed():
	# Start AI game
	get_tree().change_scene_to_file("res://scenes/game.tscn")

func _on_host_game_pressed():
	print("Host game - not yet implemented")

func _on_join_game_pressed():
	print("Join game - not yet implemented")

func _on_settings_pressed():
	print("Settings - not yet implemented")

func _on_quit_pressed():
	get_tree().quit()
