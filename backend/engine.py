import random
import copy

COLS, ROWS = 10, 20
SHAPES = {
    'I': [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    'J': [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    'L': [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    'O': [[1, 1], [1, 1]],
    'S': [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    'T': [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    'Z': [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
}

def rotate(shape):
    return [list(row) for row in zip(*shape[::-1])]

class HeuristicAnalyzer:
    @staticmethod
    def calculate_metrics(grid):
        rows = len(grid)
        cols = len(grid[0])
        heights = [0] * cols
        holes = 0
        
        # Single-pass height and hole detection
        for c in range(cols):
            block_found = False
            for r in range(rows):
                if grid[r][c] != 0:
                    if not block_found:
                        heights[c] = rows - r
                        block_found = True
                elif block_found:
                    holes += 1
                    
        aggregate_height = sum(heights)
        
        # Bumpiness calculation
        bumpiness = 0
        for i in range(cols - 1):
            bumpiness += abs(heights[i] - heights[i+1])
            
        return {
            "aggregate_height": aggregate_height,
            "holes": holes,
            "bumpiness": bumpiness
        }

class AdversarialAgent:
    def __init__(self):
        self.pieces = ["I", "O", "T", "S", "Z", "J", "L"]
        self.reset()

    def reset(self):
        self.history = []
        self.chaos_meter = 0

    def simulate_placement(self, grid, piece_type):
        """
        Simulate all possible placements and return the 'best' (minimum entropy)
        score achievable by the player with this piece.
        """
        shape = SHAPES[piece_type]
        best_player_score = float('inf')
        
        # Test all 4 rotations
        current_shape = shape
        for _ in range(4):
            # Compute active column boundaries of the piece
            active_cols = [c for r in range(len(current_shape)) for c in range(len(current_shape[r])) if current_shape[r][c]]
            if not active_cols:
                current_shape = rotate(current_shape)
                continue
            min_c = min(active_cols)
            max_c = max(active_cols)
            
            # Shift x so active columns stay within [0, COLS - 1]
            for x in range(-min_c, COLS - max_c):
                # Verify piece can enter at y = 0
                if not self.is_valid(grid, current_shape, x, 0):
                    continue
                
                # Drop piece to the lowest valid row
                y = 0
                while self.is_valid(grid, current_shape, x, y + 1):
                    y += 1
                
                # Place piece on a temporary grid
                temp_grid = [row[:] for row in grid]
                for r in range(len(current_shape)):
                    for c in range(len(current_shape[r])):
                        if current_shape[r][c] and (y + r < ROWS) and (0 <= x + c < COLS):
                            temp_grid[y + r][x + c] = 1
                
                # Simulate line clearing
                surviving_rows = [row for row in temp_grid if not all(cell != 0 for cell in row)]
                lines_cleared = ROWS - len(surviving_rows)
                post_clear_grid = [[0] * COLS for _ in range(lines_cleared)] + surviving_rows
                
                metrics = HeuristicAnalyzer.calculate_metrics(post_clear_grid)
                # Player seeks to minimize aggregate height, holes, and bumpiness, while maximizing line clears
                player_score = (
                    metrics["aggregate_height"] * 0.5 +
                    metrics["holes"] * 4.0 +
                    metrics["bumpiness"] * 1.0 -
                    lines_cleared * 12.0
                )
                if player_score < best_player_score:
                    best_player_score = player_score
            
            current_shape = rotate(current_shape)
            if current_shape == shape:
                break # Symmetric piece optimization (e.g. 'O')

        return best_player_score if best_player_score != float('inf') else 999.0

    def is_valid(self, grid, shape, x, y):
        for r in range(len(shape)):
            for c in range(len(shape[r])):
                if shape[r][c]:
                    board_y = y + r
                    board_x = x + c
                    if board_y < 0:
                        continue  # Allow spawning above the board
                    if board_y >= ROWS or board_x < 0 or board_x >= COLS:
                        return False
                    if grid[board_y][board_x] != 0:
                        return False
        return True

    def decide_next_piece(self, board):
        metrics = HeuristicAnalyzer.calculate_metrics(board)
        piece_counts = {p: self.history.count(p) for p in self.pieces}

        # Mercy Protocol: If stack is dangerously high, occasionally grant relief
        is_mercy = False
        if metrics["aggregate_height"] > 130:
            if random.random() < 0.35:
                is_mercy = True

        best_adversarial_piece = "I" if is_mercy else "T"
        max_adversarial_score = -float('inf')

        if not is_mercy:
            for piece in self.pieces:
                # Minimum score player can achieve with this piece
                best_player_score = self.simulate_placement(board, piece)
                
                # Adversary wants high player entropy (worst outcome for player)
                adversarial_score = best_player_score

                # Correct Starvation Logic:
                # If a piece is very helpful to the player (low player_score) and player hasn't seen it recently,
                # the adversary WITHHOLDS it by heavily penalizing its selection probability.
                if piece_counts.get(piece, 0) == 0 and best_player_score < 12.0:
                    adversarial_score *= 0.25  # Suppress helpful piece so adversary picks a more disruptive one

                # Diversity & Anti-Spam: Penalize recently repeated pieces
                repeat_penalty = piece_counts.get(piece, 0) * 2.5
                adversarial_score -= repeat_penalty
                
                # Subtle tie-break entropy
                adversarial_score += random.uniform(-0.15, 0.15)

                if adversarial_score > max_adversarial_score:
                    max_adversarial_score = adversarial_score
                    best_adversarial_piece = piece
        else:
            max_adversarial_score = 0.0

        # Update History
        self.history.append(best_adversarial_piece)
        if len(self.history) > 12:
            self.history.pop(0)

        # Reactive Agent Intel Thoughts
        base_thoughts = [
            "Calculating optimal disruption vectors...",
            "Visualizing your failure. Convergence complete.",
            "Analyzing hardware weaknesses...",
            "Heuristic thresholds exceeded. Chaos imminent."
        ]
        
        if metrics["holes"] > 4:
            base_thoughts.append(f"Detected {metrics['holes']} system vulnerabilities. Processing purge...")
        if metrics["bumpiness"] > 12:
            base_thoughts.append("Structural instability confirmed. Well-dependency noted.")
        if metrics["aggregate_height"] > 80:
            base_thoughts.append("Atmospheric pressure rising. Critical altitude reached.")
            
        thoughts = base_thoughts
        if is_mercy:
            thoughts = ["Mercy protocol active. For now...", "Providing structural stability."]

        # Normalize score for chaos meter (0-100)
        chaos_meter = min(100, max(0, int((max_adversarial_score / 50.0) * 100)))

        return {
            "piece": best_adversarial_piece,
            "chaos": chaos_meter,
            "thought": random.choice(thoughts)
        }

class GameEngine:
    def __init__(self, width=10, height=20):
        self.width = width
        self.height = height
        self.grid = [[0 for _ in range(width)] for _ in range(height)]
        self.agent = AdversarialAgent()
        self.locked_cell = None # {"x": int, "y": int} or None

    def reset(self):
        self.grid = [[0 for _ in range(self.width)] for _ in range(self.height)]
        self.locked_cell = None
        self.agent.reset()

    def update_board(self, board):
        if len(board) == self.height and len(board[0]) == self.width:
            self.grid = board
        else:
            print(f"Warning: Invalid board dimensions received: {len(board)}x{len(board[0]) if board else 0}")

    def get_next_piece(self):
        return self.agent.decide_next_piece(self.grid)

    def generate_lock(self):
        empty_cells = []
        for r in range(self.height):
            for c in range(self.width):
                if self.grid[r][c] == 0:
                    empty_cells.append({"x": c, "y": r})
        
        if empty_cells:
            self.locked_cell = random.choice(empty_cells)
            return self.locked_cell
        return None

    def clear_lock(self):
        self.locked_cell = None
