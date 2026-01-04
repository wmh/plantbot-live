// PlantBot Level Definitions
// Each level defines the puzzle layout, constraints, and objectives

/**
 * Level Data Structure:
 * {
 *   id: number - Unique level identifier
 *   name: string - Level display name
 *   description: string - Tutorial hint or level introduction
 *   grid: array[][] - 2D array of tile types (0=empty, 1=grass, 3=dirt)
 *   heightMap: array[][] - 2D array of heights (0=ground, 1=elevated, etc.)
 *   playerStart: {x, y, direction} - Starting position and facing direction
 *   availableCommands: array - Available command types ['forward', 'turn-left', 'turn-right', 'plant', 'func1', 'func2']
 *   commands: {
 *     main: number - Max commands in Main program
 *     func1: number|null - Max commands in Func1 (null = hidden)
 *     func2: number|null - Max commands in Func2 (null = hidden)
 *   }
 *   optimalSolution: number - Minimum commands needed for 3 stars
 * }
 * 
 * Win Condition: All grass tiles (type 1) must have flowers planted.
 * The check is dynamic - scans the grid in real-time, so pre-planted flowers
 * that are removed by the player will also need to be replanted.
 */

const LEVELS = [
    // Level 1: First Steps (Lightbot Tribute)
    // Teaches: Basic movement and planting
    {
        id: 1,
        name: "First Steps",
        description: "Welcome to PlantBot! Move forward and plant a flower. Press RUN when ready.",
        grid: [
            [3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3],
            [3, 3, 1, 3, 3],
            [3, 3, 3, 3, 3]
        ],
        heightMap: [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0]
        ],
        playerStart: {
            x: 2,
            y: 1,
            direction: 'SE'
        },
        availableCommands: ['forward', 'plant'],
        commands: {
            main: 3,
            func1: null,  // Hidden
            func2: null   // Hidden
        },
        optimalSolution: 3  // Forward, Forward, Plant
    },
    
    // Level 2: Turn Around
    // Teaches: Turning
    {
        id: 2,
        name: "Turn Around",
        description: "Learn to turn! Use TURN LEFT or TURN RIGHT to change direction.",
        grid: [
            [3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3],
            [3, 3, 1, 3, 3],
            [3, 3, 3, 3, 3]
        ],
        heightMap: [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0]
        ],
        playerStart: {
            x: 2,
            y: 2,
            direction: 'NE'
        },
        availableCommands: ['forward', 'turn-left', 'turn-right', 'plant'],
        commands: {
            main: 8,
            func1: null,
            func2: null
        },
        optimalSolution: 3  // Turn Right, Forward, Plant
    },
    
    // Level 3: Obstacle Course
    // Teaches: Planning path around obstacles
    {
        id: 3,
        name: "Obstacle Course",
        description: "Navigate around the tall obstacle. Plan your route carefully!",
        grid: [
            [3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3],
            [3, 1, 3, 3, 3],
            [3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3]
        ],
        heightMap: [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 2, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0]
        ],
        playerStart: {
            x: 3,
            y: 1,
            direction: 'NE'
        },
        availableCommands: ['forward', 'turn-left', 'turn-right', 'plant'],
        commands: {
            main: 8,
            func1: null,
            func2: null
        },
        optimalSolution: 5  // Forward, Forward, Turn Right, Forward, Plant
    },
    
    // Level 4: Going Down
    // Teaches: Height differences - descending from height 2 → 1 → 0
    {
        id: 4,
        name: "Going Down",
        description: "Carefully descend the stairs. You can only go down one level at a time!",
        grid: [
            [3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3],
            [3, 3, 3, 1, 3],
            [3, 3, 3, 3, 3],
            [3, 3, 3, 3, 3]
        ],
        heightMap: [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 2, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0]
        ],
        playerStart: {
            x: 2,
            y: 2,
            direction: 'SW'
        },
        availableCommands: ['forward', 'turn-left', 'turn-right', 'plant'],
        commands: {
            main: 8,
            func1: null,
            func2: null
        },
        optimalSolution: 5  // Forward (h2→h1), Turn Right, Forward (h1→h0), Turn Right, Forward to grass, Plant
    },
    
    // Level 5: Three Gardens
    // Teaches: Multiple targets and planning a route
    {
        id: 5,
        name: "Three Gardens",
        description: "Plant flowers in all three gardens! Plan your route carefully.",
        grid: [
            [3, 3, 3, 3, 3],
            [3, 3, 3, 1, 3],
            [3, 3, 3, 3, 3],
            [3, 1, 3, 1, 3],
            [3, 3, 3, 3, 3]
        ],
        heightMap: [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0]
        ],
        playerStart: {
            x: 1,
            y: 1,
            direction: 'SE'
        },
        availableCommands: ['forward', 'turn-left', 'turn-right', 'plant'],
        commands: {
            main: 16,
            func1: null,
            func2: null
        },
        optimalSolution: 11  // Route planning exercise
    },
    
    // Level 6: Functions Introduction
    // Teaches: Using Func1 to avoid repetition
    {
        id: 6,
        name: "Learn Functions",
        description: "Too many commands? Use Func1 to organize your code!",
        tutorial: {
            type: 'official',
            content: "The main program is now limited! Put repeated commands in Func1, then call it from main to save space."
        },
        grid: [
            [3, 3, 3, 3, 3],
            [3, 3, 3, 1, 3],
            [3, 3, 3, 3, 3],
            [3, 1, 3, 1, 3],
            [3, 3, 3, 3, 3]
        ],
        heightMap: [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0]
        ],
        playerStart: {
            x: 1,
            y: 1,
            direction: 'SE'
        },
        availableCommands: ['forward', 'turn-left', 'turn-right', 'plant', 'func1'],
        commands: {
            main: 8,    // Reduced from 16 - forces use of Func1
            func1: 4,
            func2: null
        },
        optimalSolution: 7  // Main: 7 commands (including Func1 calls), Func1: ~3 commands
    },

    // Level 7: Master Recursion
    // Teaches: Recursive functions - Func1 calls itself
    {
        id: 7,
        name: "Master Recursion",
        description: "Only 1 command in Main? Use Func1 to call itself!",
        tutorial: {
            type: 'official',
            content: "Functions can call themselves! This is called recursion. Make Func1 do the work and call itself to repeat."
        },
        grid: [
            [3, 3, 3, 3, 3],
            [3, 3, 3, 1, 3],
            [3, 3, 3, 3, 3],
            [3, 1, 3, 1, 3],
            [3, 3, 3, 3, 3]
        ],
        heightMap: [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0]
        ],
        playerStart: {
            x: 1,
            y: 1,
            direction: 'SE'
        },
        availableCommands: ['forward', 'turn-left', 'turn-right', 'plant', 'func1'],
        commands: {
            main: 1,    // Only 1 slot - must use Func1
            func1: 5,   // Func1 needs to handle everything including calling itself
            func2: null
        },
        optimalSolution: 5  // Func1: forward, plant, turn, forward, func1 (recursive call)
    }
    
    // TODO: More levels to be designed
    // Consider using Level Designer tool for future levels
];

// Helper function to get level by ID
function getLevel(id) {
    return LEVELS.find(level => level.id === id);
}

// Helper function to get total level count
function getTotalLevels() {
    return LEVELS.length;
}

// Helper function to check if level exists
function levelExists(id) {
    return LEVELS.some(level => level.id === id);
}
