// PlantBot - Programming Puzzle Game
// A visual programming game where players program a robot to plant flowers
// by dragging commands into program slots (Main, Func1, Func2)

// ============================================
// PROGRESS MANAGEMENT
// ============================================
const ProgressManager = {
    save(levelId) {
        const progress = this.load();
        if (!progress.completed.includes(levelId)) {
            progress.completed.push(levelId);
            progress.completed.sort((a, b) => a - b);
        }
        progress.currentLevel = levelId + 1; // Next level to play
        localStorage.setItem('plantbot_progress', JSON.stringify(progress));
    },
    
    load() {
        const saved = localStorage.getItem('plantbot_progress');
        return saved ? JSON.parse(saved) : { completed: [], currentLevel: 1 };
    },
    
    reset() {
        localStorage.removeItem('plantbot_progress');
    },
    
    isCompleted(levelId) {
        const progress = this.load();
        return progress.completed.includes(levelId);
    },
    
    getCurrentLevel() {
        const progress = this.load();
        // Return current level, or first incomplete level, or level 1
        if (progress.currentLevel && levelExists(progress.currentLevel)) {
            return progress.currentLevel;
        }
        // Find first incomplete level
        for (let i = 1; i <= LEVELS.length; i++) {
            if (!progress.completed.includes(i)) {
                return i;
            }
        }
        return 1; // Default to level 1
    }
};

// ============================================
// STATE MANAGEMENT
// ============================================
const AppState = {
    // Program storage: each program contains array of commands
    programs: {
        main: [],
        func1: [],
        func2: []
    },
    
    // Execution state
    execution: {
        isExecuting: false,
        speed: 500 // ms per command
    },
    
    // Drag & drop state
    dragDrop: {
        isDropping: false,
        dragSource: null,
        dropSucceeded: false
    },
    
    // UI state
    ui: {
        focusedProgram: 'main'
    }
};

// Convenience accessors (for backward compatibility)
const programState = AppState.programs;
let isExecuting, executionSpeed, isDropping, dragSource, dropSucceeded, focusedProgram, shouldStopExecution;

function syncStateAccessors() {
    isExecuting = AppState.execution.isExecuting;
    executionSpeed = AppState.execution.speed;
    isDropping = AppState.dragDrop.isDropping;
    dragSource = AppState.dragDrop.dragSource;
    dropSucceeded = AppState.dragDrop.dropSucceeded;
    focusedProgram = AppState.ui.focusedProgram;
}

function updateState(category, key, value) {
    AppState[category][key] = value;
    syncStateAccessors();
}

syncStateAccessors();

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', initializeProgramming);

function initializeProgramming() {
    setupDragAndDrop();
    setupControls();
    setupFocusSystem();
    setFocusedProgram('main'); // Set initial focus
}

function setupFocusSystem() {
    // Add click handlers to program sections for focus
    const programSections = document.querySelectorAll('.program-section');
    programSections.forEach(section => {
        section.addEventListener('click', (e) => {
            const program = section.id.replace('-program', '');
            setFocusedProgram(program);
        });
    });
    
    // Add click handlers to command palette for quick add
    const commandBtns = document.querySelectorAll('#commands .command-btn');
    commandBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Don't interfere with drag
            if (e.detail === 1) { // Single click
                const command = btn.dataset.command;
                quickAddCommand(command);
            }
        });
    });
}

function setFocusedProgram(program) {
    AppState.ui.focusedProgram = program;
    focusedProgram = program;
    
    // Remove focus from all programs
    document.querySelectorAll('.program-section').forEach(section => {
        section.classList.remove('focused');
    });
    
    // Add focus to selected program
    const focusedSection = document.getElementById(`${program}-program`);
    if (focusedSection) {
        focusedSection.classList.add('focused');
    }
}

function quickAddCommand(command) {
    // Find first empty slot in focused program
    const firstEmptyIndex = programState[focusedProgram].findIndex(c => c === null || c === undefined);
    
    if (firstEmptyIndex !== -1) {
        const container = document.querySelector(`#${focusedProgram}-slots`);
        const slot = container.querySelector(`.slot[data-index="${firstEmptyIndex}"]`);
        if (slot) {
            addCommandToSlot(slot, command, focusedProgram, firstEmptyIndex);
        }
    }
}

function setupDragAndDrop() {
    // Make command buttons draggable
    const commandBtns = document.querySelectorAll('#commands .command-btn');
    commandBtns.forEach(btn => {
        btn.addEventListener('dragstart', handleDragStart);
    });
    
    // Setup drop zones (all slots)
    const slots = document.querySelectorAll('.slot');
    slots.forEach(slot => {
        slot.addEventListener('dragover', handleDragOver);
        slot.addEventListener('dragleave', handleDragLeave);
        slot.addEventListener('drop', handleDrop);
        slot.addEventListener('click', handleSlotClick);
    });
    
    // Setup drop zones for program containers and sections
    const programSlots = document.querySelectorAll('.program-slots');
    programSlots.forEach(container => {
        container.addEventListener('dragover', handleContainerDragOver);
        container.addEventListener('drop', handleContainerDrop);
    });
    
    const programSections = document.querySelectorAll('.program-section');
    programSections.forEach(section => {
        section.addEventListener('dragover', handleContainerDragOver);
        section.addEventListener('drop', handleContainerDrop);
    });
    
    // Setup document-level handlers
    document.addEventListener('dragend', handleDragEnd);
}

// ============================================
// DRAG & DROP EVENT HANDLERS
// ============================================

function handleDragEnd(e) {
    // Reset dropping flag
    setTimeout(() => { 
        AppState.dragDrop.isDropping = false;
        isDropping = false;
    }, 100);
    
    // If drag ended and drop didn't succeed, delete source
    if (dragSource && !dropSucceeded) {
        removeCommandAtIndex(dragSource.program, dragSource.index);
    }
    
    // Clear drag source
    AppState.dragDrop.dragSource = null;
    AppState.dragDrop.dropSucceeded = false;
    dragSource = null;
    dropSucceeded = false;
}

function handleDragStart(e) {
    const commandBtn = e.target.closest('.command-btn');
    const command = commandBtn.dataset.command;
    e.dataTransfer.setData('command', command);
    e.dataTransfer.effectAllowed = 'copy';
    
    // Reset drop success flag
    AppState.dragDrop.dropSucceeded = false;
    dropSucceeded = false;
    
    // Check if dragging from a slot (for deletion)
    const parentSlot = commandBtn.closest('.slot');
    if (parentSlot) {
        const program = parentSlot.closest('.program-slots').dataset.program;
        const index = parseInt(parentSlot.dataset.index);
        e.dataTransfer.setData('sourceProgram', program);
        e.dataTransfer.setData('sourceIndex', index);
        
        // Store drag source for potential deletion
        AppState.dragDrop.dragSource = { program, index };
        dragSource = { program, index };
    } else {
        AppState.dragDrop.dragSource = null;
        dragSource = null;
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleContainerDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}

function handleContainerDrop(e) {
    if (isDropping) return;
    isDropping = true;
    
    e.preventDefault();
    e.stopPropagation(); // Prevent duplicate drops
    
    // Don't allow dropping during execution
    if (isExecuting) {
        isDropping = false;
        return;
    }
    
    const command = e.dataTransfer.getData('command');
    
    // Find the program - check if dropped on slots container or section
    let program;
    let container;
    
    if (e.target.classList.contains('program-slots')) {
        program = e.target.dataset.program;
        container = e.target;
    } else if (e.target.classList.contains('program-section')) {
        // Dropped on section, find the slots container
        container = e.target.querySelector('.program-slots');
        program = container?.dataset.program;
    } else {
        // Dropped on child element, find parent
        const slotsContainer = e.target.closest('.program-slots');
        const section = e.target.closest('.program-section');
        
        if (slotsContainer) {
            program = slotsContainer.dataset.program;
            container = slotsContainer;
        } else if (section) {
            container = section.querySelector('.program-slots');
            program = container?.dataset.program;
        } else {
            // Not in a valid drop area
            isDropping = false;
            return;
        }
    }
    
    if (!program || !container) {
        isDropping = false;
        return;
    }
    
    // Find first empty slot
    const firstEmptyIndex = programState[program].findIndex(c => c === null || c === undefined);
    if (firstEmptyIndex !== -1) {
        const slot = container.querySelector(`.slot[data-index="${firstEmptyIndex}"]`);
        if (slot) {
            addCommandToSlot(slot, command, program, firstEmptyIndex);
        }
    }
    
    // Switch focus to this program
    setFocusedProgram(program);
    
    // Handle source deletion if dragging from a slot
    const sourceProgram = e.dataTransfer.getData('sourceProgram');
    const sourceIndex = e.dataTransfer.getData('sourceIndex');
    if (sourceProgram && sourceIndex !== '') {
        removeCommandAtIndex(sourceProgram, parseInt(sourceIndex));
    }
    
    // Mark drop as successful
    dropSucceeded = true;
    dragSource = null;
    
    
    // Reset flag after a short delay
    setTimeout(() => { isDropping = false; }, 50);
}

function handleDrop(e) {
    if (isDropping) return;
    isDropping = true;
    
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling to parent containers
    
    const slot = e.currentTarget;
    slot.classList.remove('drag-over');
    
    // Don't allow dropping during execution
    if (isExecuting) {
        isDropping = false;
        return;
    }
    
    const command = e.dataTransfer.getData('command');
    const program = slot.closest('.program-slots').dataset.program;
    const index = parseInt(slot.dataset.index);
    
    // Add command to slot
    addCommandToSlot(slot, command, program, index);
    
    // Switch focus to this program
    setFocusedProgram(program);
    
    // Handle source deletion if dragging from a slot
    const sourceProgram = e.dataTransfer.getData('sourceProgram');
    const sourceIndex = e.dataTransfer.getData('sourceIndex');
    if (sourceProgram && sourceIndex !== '' && 
        (sourceProgram !== program || parseInt(sourceIndex) !== index)) {
        removeCommandAtIndex(sourceProgram, parseInt(sourceIndex));
    }
    
    // Mark drop as successful
    dropSucceeded = true;
    dragSource = null;
    
    
    // Reset flag after a short delay
    setTimeout(() => { isDropping = false; }, 50);
}

function handleSlotClick(e) {
    const slot = e.currentTarget;
    
    // Remove command if clicked (and not executing)
    if (!isExecuting && slot.querySelector('.command-btn')) {
        const program = slot.closest('.program-slots').dataset.program;
        const index = parseInt(slot.dataset.index);
        removeCommandAtIndex(program, index);
    }
}

// ============================================
// SLOT MANAGEMENT
// ============================================

/**
 * Add a command to a specific slot
 * @param {HTMLElement} slot - The target slot element
 * @param {string} command - Command type (forward, turn-left, etc.)
 * @param {string} program - Program name (main, func1, func2)
 * @param {number} index - Slot index
 */
function addCommandToSlot(slot, command, program, index) {
    // Clear slot first
    slot.innerHTML = '';
    
    // Create command button
    const btn = createCommandButton(command);
    slot.appendChild(btn);
    
    // Update program state
    programState[program][index] = command;
    updateSlotCount(program);
}

function removeCommandFromSlot(slot) {
    const program = slot.closest('.program-slots').dataset.program;
    const index = parseInt(slot.dataset.index);
    
    slot.innerHTML = '';
    programState[program][index] = null;
    updateSlotCount(program);
}

function removeCommandAtIndex(program, index) {
    // Remove command and shift remaining commands forward
    programState[program].splice(index, 1);
    programState[program].push(null); // Add null at end to maintain array length
    
    // Re-render the program
    renderProgram(program);
    updateSlotCount(program);
}

function renderProgram(program) {
    const container = document.querySelector(`#${program}-slots`);
    const slots = container.querySelectorAll('.slot');
    
    slots.forEach((slot, index) => {
        slot.innerHTML = '';
        const command = programState[program][index];
        if (command) {
            const btn = createCommandButton(command);
            slot.appendChild(btn);
        }
    });
}

function createCommandButton(command) {
    const btn = document.createElement('div');
    btn.className = 'command-btn';
    btn.dataset.command = command;
    btn.draggable = true;
    
    // Add dragstart for buttons in slots
    btn.addEventListener('dragstart', handleDragStart);
    
    const icons = {
        'forward': '⬆️',
        'turn-left': '↪️',
        'turn-right': '↩️',
        'plant': '🌱',
        'func1': 'F1',
        'func2': 'F2'
    };
    
    const labels = {
        'forward': 'Forward',
        'turn-left': 'Turn Left',
        'turn-right': 'Turn Right',
        'plant': 'Plant',
        'func1': 'Func 1',
        'func2': 'Func 2'
    };
    
    btn.innerHTML = `
        <div class="command-icon">${icons[command]}</div>
        <div class="command-label">${labels[command]}</div>
    `;
    
    return btn;
}

function updateSlotCount(program) {
    const count = programState[program].filter(c => c !== null && c !== undefined).length;
    const section = document.getElementById(`${program}-program`);
    const maxSlots = programState[program].length || (program === 'main' ? 8 : 6);
    section.querySelector('.slot-count').textContent = `${count} / ${maxSlots}`;
}

// ============================================
// CONTROL BUTTONS & UI
// ============================================

function setupControls() {
    // Initialize program arrays
    programState.main = new Array(8).fill(null);
    programState.func1 = new Array(6).fill(null);
    programState.func2 = new Array(6).fill(null);
    
    document.getElementById('run-btn').addEventListener('click', runProgram);
    document.getElementById('reset-btn').addEventListener('click', resetGame);
    document.getElementById('clear-btn').addEventListener('click', clearPrograms);
}

// ============================================
// PROGRAM EXECUTION ENGINE
// ============================================

/**
 * Run the main program
 */
async function runProgram() {
    if (isExecuting) return;
    
    // Always reset to initial state before execution
    resetGame();
    
    // Save current state before execution (which is now the initial state)
    executionStartState = {
        playerGridX: playerGridX,
        playerGridY: playerGridY,
        playerDirection: playerDirection,
        playerHeight: playerHeight,
        plantedFlowers: new Set(plantedFlowers.keys()),
        cameraRotation: cameraRotation
    };
    
    // Clear stop flag
    shouldStopExecution = false;
    
    AppState.execution.isExecuting = true;
    isExecuting = true;
    document.getElementById('run-btn').disabled = true;
    
    try {
        await executeCommands(programState.main, 'main');
    } catch (error) {
        console.error('Execution error:', error);
    }
    
    AppState.execution.isExecuting = false;
    isExecuting = false;
    document.getElementById('run-btn').disabled = false;
}

async function executeCommands(commands, context = 'main', depth = 0) {
    // Prevent infinite recursion
    if (depth > 10) {
        console.warn('Max recursion depth reached');
        return;
    }
    
    for (let i = 0; i < commands.length; i++) {
        // Check if execution was stopped (e.g., level complete or reset)
        if (!isExecuting || shouldStopExecution) {
            break;
        }
        
        const command = commands[i];
        if (!command) continue;
        
        // Highlight current command
        highlightCommand(context, i);
        
        // Execute command
        await executeCommand(command, depth);
        
        // Unhighlight
        unhighlightCommand(context, i);
        
        // Wait between commands
        await sleep(executionSpeed);
    }
}

async function executeCommand(command, depth) {
    switch (command) {
        case 'forward':
            await movePlayerForward();
            break;
        case 'turn-left':
            turnPlayerLeft();
            await sleep(300);
            break;
        case 'turn-right':
            turnPlayerRight();
            await sleep(300);
            break;
        case 'plant':
            await plantFlower();
            break;
        case 'func1':
            await executeCommands(programState.func1, 'func1', depth + 1);
            break;
        case 'func2':
            await executeCommands(programState.func2, 'func2', depth + 1);
            break;
    }
}

function highlightCommand(program, index) {
    const slot = document.querySelector(`#${program}-slots .slot[data-index="${index}"]`);
    if (slot) {
        slot.style.setProperty('background', '#FFD700', 'important');
        slot.style.setProperty('border-color', '#FFA500', 'important');
        slot.style.transform = 'scale(1.05)';
        slot.style.transition = 'all 0.2s';
        
        // Also highlight the command button inside
        const commandBtn = slot.querySelector('.command-btn');
        if (commandBtn) {
            commandBtn.style.setProperty('background', '#FFD700', 'important');
        }
    }
}

function unhighlightCommand(program, index) {
    const slot = document.querySelector(`#${program}-slots .slot[data-index="${index}"]`);
    if (slot) {
        slot.style.setProperty('background', 'white', 'important');
        slot.style.setProperty('border-color', '#bdc3c7', 'important');
        slot.style.transform = 'scale(1)';
        
        // Reset command button
        const commandBtn = slot.querySelector('.command-btn');
        if (commandBtn) {
            commandBtn.style.setProperty('background', 'transparent', 'important');
        }
    }
}

function clearPrograms() {
    if (isExecuting) return;
    
    programState.main = new Array(8).fill(null);
    programState.func1 = new Array(6).fill(null);
    programState.func2 = new Array(6).fill(null);
    
    document.querySelectorAll('.slot').forEach(slot => {
        slot.innerHTML = '';
    });
    
    updateSlotCount('main');
    updateSlotCount('func1');
    updateSlotCount('func2');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// PROGRAMMING COMMANDS
// ============================================

async function movePlayerForward() {
    // Get direction vector based on current player direction
    const directions = {
        'NE': { dx: -1, dy: 0 },
        'SE': { dx: 0, dy: 1 },
        'SW': { dx: 1, dy: 0 },
        'NW': { dx: 0, dy: -1 }
    };
    
    const dir = directions[playerDirection];
    if (!dir) return;
    
    return new Promise((resolve) => {
        // Store the resolve function to call when movement completes
        window.moveResolve = resolve;
        
        // Try to move
        const success = tryMoveFromProgram(dir.dx, dir.dy, playerDirection);
        
        if (!success) {
            // If can't move, resolve immediately
            resolve();
        }
    });
}

function turnPlayerLeft() {
    const directions = ['NE', 'NW', 'SW', 'SE'];
    const currentIndex = directions.indexOf(playerDirection);
    playerDirection = directions[(currentIndex + 1) % 4];
    
    if (player) {
        player.play(`idle_${playerDirection}`);
    }
}

function turnPlayerRight() {
    const directions = ['NE', 'SE', 'SW', 'NW'];
    const currentIndex = directions.indexOf(playerDirection);
    playerDirection = directions[(currentIndex + 1) % 4];
    
    if (player) {
        player.play(`idle_${playerDirection}`);
    }
}

async function plantFlower() {
    return new Promise((resolve) => {
        const scene = window.gameScene || game.scene.scenes[0];
        if (scene) {
            plantOrRemoveFlower(scene);
            setTimeout(() => {
                try {
                    checkWinCondition();
                } catch (error) {
                    if (error.message === 'Level Complete') {
                        // Level complete, don't propagate error
                    }
                }
                resolve();
            }, 400); // Wait for plant animation, then check win
        } else {
            resolve();
        }
    });
}

/**
 * Check if all grass tiles have flowers planted
 * Dynamically scans the grid for all grass tiles (type 1) and checks if they all have flowers
 */
function checkWinCondition() {
    if (!currentLevel) return;
    
    // Scan grid for all grass tiles
    const grassTiles = [];
    for (let y = 0; y < currentLevel.grid.length; y++) {
        for (let x = 0; x < currentLevel.grid[y].length; x++) {
            if (currentLevel.grid[y][x] === 1) {  // Grass tile
                grassTiles.push({ x, y });
            }
        }
    }
    
    // Check if all grass tiles have flowers planted
    const allPlanted = grassTiles.every(tile => {
        const key = `${tile.x},${tile.y}`;
        return plantedFlowers.has(key);
    });
    
    if (allPlanted && grassTiles.length > 0) {  // Must have at least one grass tile
        // Force stop execution immediately
        AppState.execution.isExecuting = false;
        isExecuting = false;
        document.getElementById('run-btn').disabled = false;
        
        // Clear any highlighted commands
        document.querySelectorAll('.slot').forEach(slot => {
            const btn = slot.querySelector('.command-btn');
            if (btn) {
                btn.style.setProperty('background', 'transparent', 'important');
            }
        });
        
        // Show victory screen after a short delay
        setTimeout(() => {
            showVictoryScreen();
        }, 500);
    }
}

/**
 * Show victory screen with next level option
 */
function showVictoryScreen() {
    const victoryScreen = document.getElementById('victory-screen');
    if (!victoryScreen) return;
    
    // Save progress
    ProgressManager.save(currentLevelId);
    
    const nextLevelId = currentLevelId + 1;
    const hasNextLevel = levelExists(nextLevelId);
    
    if (hasNextLevel) {
        victoryScreen.querySelector('h2').textContent = '🎉 Level Complete!';
        victoryScreen.querySelector('.next-level-btn').style.display = 'inline-block';
    } else {
        victoryScreen.querySelector('h2').textContent = '🎉 All Levels Complete!';
        victoryScreen.querySelector('.next-level-btn').style.display = 'none';
    }
    
    // Show overlay
    victoryScreen.classList.add('show');
    
    // Setup next level button click handler (remove old listeners first)
    const nextBtn = document.getElementById('next-level-btn');
    const newNextBtn = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
    
    newNextBtn.addEventListener('click', () => {
        victoryScreen.classList.remove('show');
        loadNextLevel();
    });
    
    // Setup menu button click handler
    const menuBtn = document.getElementById('menu-btn');
    const newMenuBtn = menuBtn.cloneNode(true);
    menuBtn.parentNode.replaceChild(newMenuBtn, menuBtn);
    
    newMenuBtn.addEventListener('click', () => {
        victoryScreen.classList.remove('show');
        showLevelSelection();
    });
}

/**
 * Load next level
 */
function loadNextLevel() {
    const nextLevelId = currentLevelId + 1;
    if (levelExists(nextLevelId)) {
        // Clear programs
        clearPrograms();
        
        // Reset execution state
        executionStartState = null;
        
        // Clear all planted flowers
        plantedFlowers.forEach(flower => flower.destroy());
        plantedFlowers.clear();
        
        // Clear tile frame cache
        tileFrameMap.clear();
        
        // Load next level
        loadLevel(nextLevelId);
        
        // Rebuild scene with new level
        const scene = game.scene.scenes[0];
        if (scene) {
            createGrid(scene);
            
            // Update player
            const playerPos = gridToScreen(playerGridX, playerGridY);
            player.x = playerPos.x;
            player.y = playerPos.y - (PLAYER_Y_OFFSET * SCALE) - (playerHeight * HEIGHT_OFFSET);
            player.setScale(SCALE);
            player.play(`idle_${playerDirection}`);
            
            updateDepthSorting();
        }
    }
}

function resetGame() {
    // Stop any running execution immediately
    shouldStopExecution = true;
    
    // Use execution start state if available, otherwise use initial state
    const stateToRestore = executionStartState || initialState;
    
    // Reset player position and direction
    playerGridX = stateToRestore.playerGridX;
    playerGridY = stateToRestore.playerGridY;
    playerHeight = stateToRestore.playerHeight !== undefined 
        ? stateToRestore.playerHeight 
        : heightMap[playerGridY][playerGridX];
    
    // Calculate direction based on current camera rotation
    // If we have saved camera rotation, calculate the difference
    // Otherwise, just apply current camera rotation to initial direction
    let resetDirection = stateToRestore.playerDirection;
    const savedRotation = stateToRestore.cameraRotation !== undefined ? stateToRestore.cameraRotation : 0;
    const rotationDiff = cameraRotation - savedRotation;
    const rotationSteps = Math.round(rotationDiff / 90) % 4;
    
    // Rotate direction accordingly
    for (let i = 0; i < Math.abs(rotationSteps); i++) {
        resetDirection = rotateDirection(resetDirection, rotationSteps > 0);
    }
    playerDirection = resetDirection;
    
    // Clear all flowers
    plantedFlowers.forEach(flower => flower.destroy());
    plantedFlowers.clear();
    
    // Restore flowers from saved state
    if (stateToRestore.plantedFlowers) {
        stateToRestore.plantedFlowers.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            const tilePos = gridToScreen(x, y);
            const height = heightMap[y][x];
            const flower = player.scene.add.sprite(
                tilePos.x, 
                tilePos.y - (FLOWER_Y_OFFSET * SCALE) - (height * HEIGHT_OFFSET), 
                'tileset', 
                44
            );
            flower.setScale(SCALE);
            flower.setDepth((y * 10000) + (x * 100) + 5);
            plantedFlowers.set(key, flower);
        });
    }
    
    // Update player visual position
    if (player) {
        const playerPos = gridToScreen(playerGridX, playerGridY);
        player.x = playerPos.x;
        player.y = playerPos.y - (PLAYER_Y_OFFSET * SCALE) - (playerHeight * HEIGHT_OFFSET);
        player.play(`idle_${playerDirection}`);
    }
    
    updateDepthSorting();
}

// ============================================
// PHASER GAME INTEGRATION
// ============================================

// Game configuration
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#87CEEB',
    pixelArt: true,
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    }
};

const game = new Phaser.Game(config);

// Game variables
let player;
let cursors;
let spaceKey;
let rotateLeftKey;
let rotateRightKey;
let playerDirection = 'NE'; // Initial direction
let isMoving = false;

// Store initial game state for reset
let initialState = {
    playerGridX: 2,
    playerGridY: 2,
    playerDirection: 'NE',
    plantedFlowers: []
};

// Store state at start of execution for reset
let executionStartState = null;

// Track planted flowers (grid position -> flower sprite)
let plantedFlowers = new Map();

// Track all tiles for depth sorting
let allTiles = [];

// Coordinate display system
let coordsVisible = false;
let coordTextObjects = [];

// Store original tile frames to preserve during rotation
let tileFrameMap = new Map();

// Camera rotation (0, 90, 180, 270 degrees)
let cameraRotation = 0; // 0 = default view
let isRotating = false; // Track if rotation animation is in progress

// Zoom/Scale settings
let SCALE = 5;  // Global scale factor (adjustable with +/- keys)
const BASE_TILE_SIZE = 32;  // Base sprite size
const PLAYER_Y_OFFSET = 20;  // Player Y offset in base units (will be multiplied by SCALE)
const FLOWER_Y_OFFSET = 8;  // Flower Y offset in base units
const HEIGHT_OFFSET_BASE = 8;  // Height offset per level in base units

// Isometric grid settings (will be recalculated on scale change)
let TILE_WIDTH = BASE_TILE_SIZE * SCALE;
let TILE_HEIGHT = BASE_TILE_SIZE * SCALE;
let HEIGHT_OFFSET = HEIGHT_OFFSET_BASE * SCALE;
const GRID_WIDTH = 5;
const GRID_HEIGHT = 5;
const START_X = 400;
const START_Y = 150;

// Current level
let currentLevelId = 1;
let currentLevel = null;

// Level data (will be loaded from levels.js)
let level1 = [];

// Height map (0 = ground level, 1 = one level up, etc.)
// This will be rotated dynamically
let heightMap = [];

// Player grid position
let playerGridX = 2;
let playerGridY = 2;
let playerHeight = 0;  // Current height level

/**
 * Load a level by ID
 */
function loadLevel(levelId) {
    currentLevel = getLevel(levelId);
    if (!currentLevel) {
        console.error(`Level ${levelId} not found!`);
        return false;
    }
    
    currentLevelId = levelId;
    level1 = currentLevel.grid;
    heightMap = JSON.parse(JSON.stringify(currentLevel.heightMap)); // Deep copy
    
    // Set player start position
    playerGridX = currentLevel.playerStart.x;
    playerGridY = currentLevel.playerStart.y;
    playerDirection = currentLevel.playerStart.direction;
    playerHeight = heightMap[playerGridY][playerGridX];
    
    // Update initial state
    initialState = {
        playerGridX: playerGridX,
        playerGridY: playerGridY,
        playerDirection: playerDirection,
        plantedFlowers: []
    };
    
    // Update UI
    document.getElementById('level-info').textContent = `Level ${levelId}: ${currentLevel.name}`;
    
    // Show level description if available
    if (currentLevel.description) {
        showLevelDescription(currentLevel.description);
    }
    
    // Update command limits
    updateCommandLimits();
    
    return true;
}

/**
 * Show level description/hint
 */
function showLevelDescription(description) {
    const descElement = document.getElementById('level-description');
    if (descElement) {
        descElement.textContent = description;
        descElement.classList.remove('hidden');
    }
}

/**
 * Update command slot visibility and limits based on current level
 */
function updateCommandLimits() {
    if (!currentLevel) return;
    
    // Update Main program slot count
    const mainSlotsContainer = document.getElementById('main-slots');
    const currentMainLimit = currentLevel.commands.main;
    
    // Clear and rebuild main slots
    mainSlotsContainer.innerHTML = '';
    programState.main = new Array(currentMainLimit).fill(null);
    
    for (let i = 0; i < currentMainLimit; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.dataset.index = i;
        mainSlotsContainer.appendChild(slot);
    }
    
    // Re-setup drag and drop for new slots
    setupDragAndDrop();
    
    // Update slot count display
    updateSlotCount('main');
    
    // Show/Hide command buttons based on availableCommands
    const availableCommands = currentLevel.availableCommands || ['forward', 'turnLeft', 'turnRight', 'plant', 'func1', 'func2'];
    const commandButtons = document.querySelectorAll('#commands .command-btn');
    
    commandButtons.forEach(btn => {
        const command = btn.dataset.command;
        if (availableCommands.includes(command)) {
            btn.style.display = 'flex';
        } else {
            btn.style.display = 'none';
        }
    });
    
    // Show/Hide Func1 and rebuild slots
    const func1Section = document.getElementById('func1-program');
    if (currentLevel.commands.func1 === null) {
        func1Section.style.display = 'none';
    } else {
        func1Section.style.display = 'block';
        const func1SlotsContainer = document.getElementById('func1-slots');
        const func1Limit = currentLevel.commands.func1;
        func1SlotsContainer.innerHTML = '';
        programState.func1 = new Array(func1Limit).fill(null);
        for (let i = 0; i < func1Limit; i++) {
            const slot = document.createElement('div');
            slot.className = 'slot';
            slot.dataset.index = i;
            func1SlotsContainer.appendChild(slot);
        }
        updateSlotCount('func1');
    }
    
    // Show/Hide Func2 and rebuild slots
    const func2Section = document.getElementById('func2-program');
    if (currentLevel.commands.func2 === null) {
        func2Section.style.display = 'none';
    } else {
        func2Section.style.display = 'block';
        const func2SlotsContainer = document.getElementById('func2-slots');
        const func2Limit = currentLevel.commands.func2;
        func2SlotsContainer.innerHTML = '';
        programState.func2 = new Array(func2Limit).fill(null);
        for (let i = 0; i < func2Limit; i++) {
            const slot = document.createElement('div');
            slot.className = 'slot';
            slot.dataset.index = i;
            func2SlotsContainer.appendChild(slot);
        }
        updateSlotCount('func2');
    }
    
    // Always ensure main program is visible/focused after level load
    const mainProgram = document.getElementById('main-program');
    if (mainProgram) {
        mainProgram.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function preload() {
    // Load tileset spritesheet (352x352, each tile 32x32, so 11x11 grid)
    this.load.spritesheet('tileset', 'assets/isometric/isometric tileset/spritesheet.png', {
        frameWidth: 32,
        frameHeight: 32
    });
    
    // Load critter spritesheets (stag frames are 32x41)
    this.load.spritesheet('player_NE_idle', 'assets/isometric/critters/stag/critter_stag_NE_idle.png', {
        frameWidth: 32,
        frameHeight: 41
    });
    this.load.spritesheet('player_NW_idle', 'assets/isometric/critters/stag/critter_stag_NW_idle.png', {
        frameWidth: 32,
        frameHeight: 41
    });
    this.load.spritesheet('player_SE_idle', 'assets/isometric/critters/stag/critter_stag_SE_idle.png', {
        frameWidth: 32,
        frameHeight: 41
    });
    this.load.spritesheet('player_SW_idle', 'assets/isometric/critters/stag/critter_stag_SW_idle.png', {
        frameWidth: 32,
        frameHeight: 41
    });
    
    // Load run animations
    this.load.spritesheet('player_NE_run', 'assets/isometric/critters/stag/critter_stag_NE_run.png', {
        frameWidth: 32,
        frameHeight: 41
    });
    this.load.spritesheet('player_NW_run', 'assets/isometric/critters/stag/critter_stag_NW_run.png', {
        frameWidth: 32,
        frameHeight: 41
    });
    this.load.spritesheet('player_SE_run', 'assets/isometric/critters/stag/critter_stag_SE_run.png', {
        frameWidth: 32,
        frameHeight: 41
    });
    this.load.spritesheet('player_SW_run', 'assets/isometric/critters/stag/critter_stag_SW_run.png', {
        frameWidth: 32,
        frameHeight: 41
    });
}

function create() {
    // Create idle animations for all directions (excluding last 4 frames)
    // Total 24 frames: frames 0-19 for idle, last 4 frames (20-23) for planting
    this.anims.create({
        key: 'idle_NE',
        frames: this.anims.generateFrameNumbers('player_NE_idle', { start: 0, end: 19 }),
        frameRate: 8,
        repeat: -1
    });
    this.anims.create({
        key: 'idle_NW',
        frames: this.anims.generateFrameNumbers('player_NW_idle', { start: 0, end: 19 }),
        frameRate: 8,
        repeat: -1
    });
    this.anims.create({
        key: 'idle_SE',
        frames: this.anims.generateFrameNumbers('player_SE_idle', { start: 0, end: 19 }),
        frameRate: 8,
        repeat: -1
    });
    this.anims.create({
        key: 'idle_SW',
        frames: this.anims.generateFrameNumbers('player_SW_idle', { start: 0, end: 19 }),
        frameRate: 8,
        repeat: -1
    });
    
    // Create planting animations (last 4 frames: 20-23, head lowering)
    this.anims.create({
        key: 'plant_NE',
        frames: this.anims.generateFrameNumbers('player_NE_idle', { start: 20, end: 23 }),
        frameRate: 10,
        repeat: 0
    });
    this.anims.create({
        key: 'plant_NW',
        frames: this.anims.generateFrameNumbers('player_NW_idle', { start: 20, end: 23 }),
        frameRate: 10,
        repeat: 0
    });
    this.anims.create({
        key: 'plant_SE',
        frames: this.anims.generateFrameNumbers('player_SE_idle', { start: 20, end: 23 }),
        frameRate: 10,
        repeat: 0
    });
    this.anims.create({
        key: 'plant_SW',
        frames: this.anims.generateFrameNumbers('player_SW_idle', { start: 20, end: 23 }),
        frameRate: 10,
        repeat: 0
    });
    
    // Create run animations for all directions
    this.anims.create({
        key: 'run_NE',
        frames: this.anims.generateFrameNumbers('player_NE_run', { start: 0, end: -1 }),
        frameRate: 12,
        repeat: -1
    });
    this.anims.create({
        key: 'run_NW',
        frames: this.anims.generateFrameNumbers('player_NW_run', { start: 0, end: -1 }),
        frameRate: 12,
        repeat: -1
    });
    this.anims.create({
        key: 'run_SE',
        frames: this.anims.generateFrameNumbers('player_SE_run', { start: 0, end: -1 }),
        frameRate: 12,
        repeat: -1
    });
    this.anims.create({
        key: 'run_SW',
        frames: this.anims.generateFrameNumbers('player_SW_run', { start: 0, end: -1 }),
        frameRate: 12,
        repeat: -1
    });
    
    // Don't create player yet - wait for level to be loaded from level selection
    // Player will be created in startLevel()
    
    // Hide loading screen once Phaser is ready
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500); // Wait for fade out animation
    }
    
    // Store scene reference globally for later use
    window.gameScene = this;
    
    // Setup keyboard controls
    cursors = this.input.keyboard.createCursorKeys();
    spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    rotateLeftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    rotateRightKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    
    // Handle space key for planting/removing flowers
    spaceKey.on('down', () => {
        if (player) plantOrRemoveFlower(this);
    });
    
    // Handle rotation keys
    rotateLeftKey.on('down', () => {
        rotateCamera(-90, this);
    });
    
    rotateRightKey.on('down', () => {
        rotateCamera(90, this);
    });
    
    // Handle zoom keys (+ and -)
    this.input.keyboard.on('keydown-PLUS', () => {
        changeScale(1, this);
    });
    
    this.input.keyboard.on('keydown-MINUS', () => {
        changeScale(-1, this);
    });
    
    // Signal that Phaser is ready
    window.phaserReady = true;
    
    // Auto-load current level if requested
    if (window.autoLoadLevel) {
        const levelToLoad = window.autoLoadLevel;
        window.autoLoadLevel = null;
        setTimeout(() => {
            startLevel(levelToLoad);
        }, 100);
    }
}

function update() {
    if (isMoving) return;
    
    // Get movement direction adjusted for camera rotation
    const movement = getAdjustedMovement();
    
    if (movement) {
        tryMove(movement.dx, movement.dy, movement.direction);
    }
    
    // Update depth sorting every frame
    updateDepthSorting();
}

/**
 * Get movement input adjusted for current camera rotation
 * @returns {object|null} Movement data or null if no input
 */
function getAdjustedMovement() {
    // Get current input
    let inputKey = null;
    if (cursors.up.isDown) inputKey = 'up';
    else if (cursors.down.isDown) inputKey = 'down';
    else if (cursors.left.isDown) inputKey = 'left';
    else if (cursors.right.isDown) inputKey = 'right';
    
    if (!inputKey) return null;
    
    // Simple fixed mapping - don't change based on rotation for now
    const movements = {
        up: { dx: 0, dy: -1, direction: 'NW' },
        down: { dx: 0, dy: 1, direction: 'SE' },
        left: { dx: 1, dy: 0, direction: 'SW' },
        right: { dx: -1, dy: 0, direction: 'NE' }
    };
    
    return movements[inputKey];
}

function createGrid(scene) {
    // Destroy previous tiles
    allTiles.forEach(tile => tile.destroy());
    allTiles = [];
    
    // Get grid dimensions from current level
    const gridHeight = level1.length;
    const gridWidth = level1[0] ? level1[0].length : 0;
    
    // Draw isometric grid based on level data with actual tiles
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const tileType = level1[y][x];
            const height = heightMap[y][x];
            
            if (tileType > 0) {
                const pos = gridToScreen(x, y);
                
                // Choose tile based on type, use cached frame if available
                const key = `${x},${y}`;
                let tileFrame;
                
                if (tileFrameMap.has(key)) {
                    // Use cached frame
                    tileFrame = tileFrameMap.get(key);
                } else {
                    // First time, generate and cache
                    if (tileType === 3) {
                        // Random dirt tile (17-21)
                        tileFrame = 17 + Math.floor(Math.random() * 5);
                    } else if (tileType === 1) {
                        tileFrame = 22; // Grass tile
                    } else {
                        tileFrame = 22; // Default
                    }
                    tileFrameMap.set(key, tileFrame);
                }
                
                // Draw elevated tiles with stacking
                for (let h = 0; h <= height; h++) {
                    const tileY = pos.y - (h * HEIGHT_OFFSET);
                    const tile = scene.add.sprite(pos.x, tileY, 'tileset', tileFrame);
                    tile.setScale(SCALE);
                    
                    // Store tile info for dynamic depth sorting
                    tile.gridX = x;
                    tile.gridY = y;
                    tile.height = h;
                    tile.tileY = tileY;
                    tile.isTopTile = (h === height);
                    
                    // Set FIXED depth for this tile based on its position
                    // Tiles never change depth - they stay in isometric order
                    const tileDepth = (y * 10000) + (x * 100) - (tileY * 0.1);
                    tile.setDepth(tileDepth);
                    
                    allTiles.push(tile);
                }
            }
        }
    }
}

function updateDepthSorting() {
    // Sort all tiles and player based on isometric position
    // Tiles should have FIXED depth based on their position - don't change them
    // Only player depth changes as they move
    
    if (!player) return; // Safety check
    
    // Player depth - based on position and height
    const playerVisualY = player.y;
    const playerBaseDepth = (playerGridY * 10000) + (playerGridX * 100) - (playerVisualY * 0.1);
    player.setDepth(playerBaseDepth);
}

function gridToScreen(gridX, gridY) {
    // Convert grid coordinates to isometric screen coordinates
    // For tightly packed isometric tiles
    const x = START_X + (gridY - gridX) * (TILE_WIDTH / 2);
    const y = START_Y + (gridX + gridY) * (TILE_HEIGHT / 4);
    return { x, y };
}

function plantOrRemoveFlower(scene) {
    // Don't plant during movement or rotation
    if (isMoving || isRotating) return;
    
    // Only plant on grass tiles (type 1 or 2)
    const currentTile = level1[playerGridY][playerGridX];
    if (currentTile !== 1 && currentTile !== 2) {
        return; // Not on grass
    }
    
    const key = `${playerGridX},${playerGridY}`;
    
    if (plantedFlowers.has(key)) {
        // Remove existing flower with planting animation
        const flower = plantedFlowers.get(key);
        
        // Player planting animation
        isMoving = true; // Lock controls during animation
        
        player.play(`plant_${playerDirection}`);
        
        // Return to idle after planting animation
        player.once('animationcomplete', () => {
            player.play(`idle_${playerDirection}`);
            isMoving = false;
        });
        
        // Flower removal
        scene.tweens.add({
            targets: flower,
            alpha: 0,
            scale: SCALE * 0.6,
            duration: 150,
            ease: 'Back.easeIn',
            onComplete: () => {
                flower.destroy();
            }
        });
        
        plantedFlowers.delete(key);
    } else {
        // Plant new flower with planting animation
        isMoving = true; // Lock controls during animation
        
        player.play(`plant_${playerDirection}`);
        
        // Return to idle after planting animation
        player.once('animationcomplete', () => {
            player.play(`idle_${playerDirection}`);
            isMoving = false;
        });
        
        // Create flower
        const pos = gridToScreen(playerGridX, playerGridY);
        const height = heightMap[playerGridY][playerGridX];
        const flowerY = pos.y - (FLOWER_Y_OFFSET * SCALE) - (height * HEIGHT_OFFSET);
        const flower = scene.add.sprite(pos.x, flowerY, 'tileset', 44);
        flower.setScale(SCALE);
        flower.setAlpha(0); // Start invisible
        
        const flowerDepth = (playerGridY * 10000) + (playerGridX * 100) - (flowerY * 0.1) + 1;
        flower.setDepth(flowerDepth);
        
        // Flower grow animation
        scene.tweens.add({
            targets: flower,
            alpha: 1,
            scale: SCALE,
            y: flowerY,
            duration: 200,
            ease: 'Back.easeOut',
            delay: 100 // Start during planting animation
        });
        
        plantedFlowers.set(key, flower);
    }
}

// ============================================
// CAMERA SYSTEM
// ============================================

/**
 * Change the global scale/zoom level
 * @param {number} delta - Scale change direction (+1 to zoom in, -1 to zoom out)
 * @param {object} scene - Phaser scene
 */
function changeScale(delta, scene) {
    if (isMoving || isRotating) return;
    
    // Update scale (min 2, max 8)
    SCALE = Math.max(2, Math.min(8, SCALE + delta));
    
    // Recalculate derived values
    TILE_WIDTH = BASE_TILE_SIZE * SCALE;
    TILE_HEIGHT = BASE_TILE_SIZE * SCALE;
    HEIGHT_OFFSET = HEIGHT_OFFSET_BASE * SCALE;
    
    // Rebuild entire scene
    rebuildScene(scene);
}

/**
 * Rebuild the entire scene (grid, player, flowers)
 * Used after scale changes or rotations
 * @param {object} scene - Phaser scene
 */
function rebuildScene(scene) {
    // Store current flowers
    const currentFlowers = new Map(plantedFlowers);
    
    // Clear old flowers
    plantedFlowers.forEach(flower => flower.destroy());
    plantedFlowers.clear();
    
    // Rebuild grid
    createGrid(scene);
    
    // Recreate flowers
    currentFlowers.forEach((oldFlower, key) => {
        const [x, y] = key.split(',').map(Number);
        const pos = gridToScreen(x, y);
        const height = heightMap[y][x];
        const flowerY = pos.y - (FLOWER_Y_OFFSET * SCALE) - (height * HEIGHT_OFFSET);
        const flower = scene.add.sprite(pos.x, flowerY, 'tileset', 44);
        flower.setScale(SCALE);
        const flowerDepth = (y * 10000) + (x * 100) - (flowerY * 0.1) + 1;
        flower.setDepth(flowerDepth);
        plantedFlowers.set(key, flower);
    });
    
    // Update player position and scale
    const playerPos = gridToScreen(playerGridX, playerGridY);
    player.x = playerPos.x;
    player.y = playerPos.y - (PLAYER_Y_OFFSET * SCALE) - (playerHeight * HEIGHT_OFFSET);
    player.setScale(SCALE);
    
    updateDepthSorting();
    
    // Update coordinates if visible
    if (coordsVisible) {
        refreshCoordinates(scene);
    }
}

/**
 * Show coordinate labels on all grid tiles
 */
function showCoordinates(scene) {
    if (!scene) return;
    
    // Clear existing coordinate texts
    hideCoordinates();
    
    // Calculate how many times the grid has been rotated (each Q is -90, each E is +90)
    const rotationCount = Math.round(cameraRotation / 90) % 4;
    
    // Add coordinate labels for each grid position
    for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
            const pos = gridToScreen(x, y);
            const height = heightMap[y][x];
            
            // Calculate original coordinate before rotation
            let origX = x;
            let origY = y;
            const size = 5;
            
            // Reverse rotate to get original position
            // If camera rotated clockwise (E), coordinates need clockwise rotation to get original
            // If camera rotated counter-clockwise (Q), coordinates need counter-clockwise rotation
            const absRotations = Math.abs(rotationCount);
            const clockwise = rotationCount > 0; // Positive = E (clockwise camera)
            
            for (let i = 0; i < absRotations; i++) {
                if (clockwise) {
                    // Clockwise rotation: (x, y) -> (size-1-y, x)
                    const tempX = size - 1 - origY;
                    const tempY = origX;
                    origX = tempX;
                    origY = tempY;
                } else {
                    // Counter-clockwise rotation: (x, y) -> (y, size-1-x)
                    const tempX = origY;
                    const tempY = size - 1 - origX;
                    origX = tempX;
                    origY = tempY;
                }
            }
            
            // Create text object for coordinates showing ORIGINAL position
            // Display as (x, y) where x=column, y=row → grid[y][x]
            const text = scene.add.text(pos.x, pos.y - HEIGHT_OFFSET * height - 10, `(${origX},${origY})`, {
                fontFamily: 'monospace',
                fontSize: `${5 * SCALE}px`,
                fill: '#ffff00',
                stroke: '#000000',
                strokeThickness: 1,
                align: 'center'
            });
            text.setOrigin(0.5, 1);
            // Use depth based on grid position so it layers properly
            const textDepth = (y * 10000) + (x * 100) + (pos.y * 0.1) + 0.5;
            text.setDepth(textDepth);
            
            coordTextObjects.push(text);
        }
    }
}

/**
 * Hide all coordinate labels
 */
function hideCoordinates() {
    coordTextObjects.forEach(text => text.destroy());
    coordTextObjects = [];
}

/**
 * Refresh coordinate display (after rebuild/scale change)
 */
function refreshCoordinates(scene) {
    if (coordsVisible) {
        showCoordinates(scene);
    }
}

/**
 * Rotate the camera view (isometric grid rotation)
 * Rotates the grid coordinates and rebuilds the scene with fade animation
 * @param {number} degrees - Rotation amount (90 or -90)
 * @param {object} scene - Phaser scene
 */
function rotateCamera(degrees, scene) {
    if (isMoving || isRotating) return;
    
    isRotating = true;
    
    const fadeDuration = 200;
    
    // Collect all objects (including coordinate texts)
    const allObjects = [
        ...allTiles,
        player,
        ...Array.from(plantedFlowers.values()),
        ...coordTextObjects
    ];
    
    // Fade out
    allObjects.forEach(obj => {
        scene.tweens.add({
            targets: obj,
            alpha: 0,
            duration: fadeDuration,
            ease: 'Cubic.easeIn'
        });
    });
    
    // After fade out, perform rotation and fade in
    scene.time.delayedCall(fadeDuration, () => {
        // Destroy old coordinate texts
        hideCoordinates();
        
        // Update rotation
        cameraRotation = (cameraRotation + degrees) % 360;
        if (cameraRotation < 0) cameraRotation += 360;
        
        // Rotate heightMap
        heightMap = rotateGrid(heightMap, degrees < 0);
        
        // Rotate player's grid position
        const rotatedPlayer = rotateGridPosition(playerGridX, playerGridY, degrees < 0);
        playerGridX = rotatedPlayer.x;
        playerGridY = rotatedPlayer.y;
        
        // Rotate tile frame map
        const newTileFrameMap = new Map();
        tileFrameMap.forEach((frame, key) => {
            const [x, y] = key.split(',').map(Number);
            const rotated = rotateGridPosition(x, y, degrees < 0);
            const newKey = `${rotated.x},${rotated.y}`;
            newTileFrameMap.set(newKey, frame);
        });
        tileFrameMap = newTileFrameMap;
        
        // Rotate flower positions
        const newFlowers = new Map();
        plantedFlowers.forEach((flower, key) => {
            const [x, y] = key.split(',').map(Number);
            const rotated = rotateGridPosition(x, y, degrees < 0);
            const newKey = `${rotated.x},${rotated.y}`;
            newFlowers.set(newKey, flower);
        });
        
        // Clear old objects
        plantedFlowers.forEach(flower => flower.destroy());
        plantedFlowers.clear();
        allTiles.forEach(tile => tile.destroy());
        allTiles = [];
        
        // Rebuild the grid
        createGrid(scene);
        
        // Recreate flowers at new positions
        newFlowers.forEach((oldFlower, key) => {
            const [x, y] = key.split(',').map(Number);
            const pos = gridToScreen(x, y);
            const height = heightMap[y][x];
            const flowerY = pos.y - (FLOWER_Y_OFFSET * SCALE) - (height * HEIGHT_OFFSET);
            const flower = scene.add.sprite(pos.x, flowerY, 'tileset', 44);
            flower.setScale(SCALE);
            flower.setAlpha(0); // Start invisible
            const flowerDepth = (y * 10000) + (x * 100) - (flowerY * 0.1) + 1;
            flower.setDepth(flowerDepth);
            plantedFlowers.set(key, flower);
        });
        
        // Update player position
        const playerPos = gridToScreen(playerGridX, playerGridY);
        player.x = playerPos.x;
        player.y = playerPos.y - (PLAYER_Y_OFFSET * SCALE) - (playerHeight * HEIGHT_OFFSET);
        player.setAlpha(0); // Start invisible
        
        // Rotate player direction
        playerDirection = rotateDirection(playerDirection, degrees > 0);
        player.play(`idle_${playerDirection}`);
        
        // Update all depths
        updateDepthSorting();
        
        // Fade in new scene
        const newObjects = [
            ...allTiles,
            player,
            ...Array.from(plantedFlowers.values())
        ];
        
        newObjects.forEach(obj => {
            scene.tweens.add({
                targets: obj,
                alpha: 1,
                duration: fadeDuration,
                ease: 'Cubic.easeOut'
            });
        });
        
        // Refresh coordinates if visible
        if (coordsVisible) {
            refreshCoordinates(scene);
        }
        
        scene.time.delayedCall(fadeDuration, () => {
            isRotating = false;
        });
    });
}

/**
 * Rotate grid position 90 degrees
 * @param {number} x - Grid X
 * @param {number} y - Grid Y
 * @param {boolean} clockwise - Rotation direction
 * @returns {object} New grid position
 */
function rotateGridPosition(x, y, clockwise) {
    const size = level1.length; // Use current grid size
    
    if (clockwise) {
        // Clockwise: (x, y) -> (size-1-y, x)
        return { x: size - 1 - y, y: x };
    } else {
        // Counter-clockwise: (x, y) -> (y, size-1-x)
        return { x: y, y: size - 1 - x };
    }
}

/**
 * Rotate player direction (NE, SE, SW, NW)
 * @param {string} currentDirection - Current direction
 * @param {boolean} clockwise - Rotation direction
 * @returns {string} New direction
 */
function rotateDirection(currentDirection, clockwise) {
    const directions = ['NE', 'SE', 'SW', 'NW']; // Clockwise order
    const currentIndex = directions.indexOf(currentDirection);
    
    if (clockwise) {
        return directions[(currentIndex + 1) % 4];
    } else {
        return directions[(currentIndex - 1 + 4) % 4];
    }
}

/**
 * Rotate entire 2D grid array
 * @param {Array} grid - 2D array
 * @param {boolean} clockwise - Rotation direction
 * @returns {Array} Rotated 2D array
 */
function rotateGrid(grid, clockwise) {
    const size = grid.length;
    const newGrid = Array(size).fill(null).map(() => Array(size).fill(0));
    
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const rotated = rotateGridPosition(x, y, clockwise);
            newGrid[rotated.y][rotated.x] = grid[y][x];
        }
    }
    
    return newGrid;
}

/**
 * Rotate a sprite around a point
 * @param {object} sprite - Phaser sprite
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} radians - Rotation in radians
 */
function rotateObjectAroundPoint(sprite, cx, cy, radians) {
    // Get relative position
    const dx = sprite.x - cx;
    const dy = sprite.y - cy;
    
    // Rotate using rotation matrix
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    
    const newX = dx * cos - dy * sin;
    const newY = dx * sin + dy * cos;
    
    // Set new position
    sprite.x = cx + newX;
    sprite.y = cy + newY;
}

// ============================================
// MOVEMENT SYSTEM
// ============================================
// Core movement functions for grid-based isometric navigation
// Handles validation, animation, and depth sorting

/**
 * Attempt to move player in a direction
 * @param {number} dx - Change in X grid position
 * @param {number} dy - Change in Y grid position  
 * @param {string} direction - Animation direction (NE, NW, SE, SW)
 */
function tryMove(dx, dy, direction) {
    const newX = playerGridX + dx;
    const newY = playerGridY + dy;
    
    // Check boundaries
    const gridHeight = level1.length;
    const gridWidth = level1[0] ? level1[0].length : 0;
    if (newX < 0 || newX >= gridWidth || newY < 0 || newY >= gridHeight) {
        return;
    }
    
    // Check if tile exists (0 is empty, all other tiles are walkable)
    if (level1[newY][newX] === 0) {
        return;
    }
    
    // Check height difference (can only jump up/down 1 level at a time)
    const currentHeight = heightMap[playerGridY][playerGridX];
    const targetHeight = heightMap[newY][newX];
    const heightDiff = Math.abs(targetHeight - currentHeight);
    
    if (heightDiff > 1) {
        // Height difference too large (2 or more levels)
        return;
    }
    
    // Execute movement
    executeMove(newX, newY, targetHeight, direction, currentHeight);
}

/**
 * Attempt to move player from program execution
 * Returns true if move was initiated, false if blocked
 */
function tryMoveFromProgram(dx, dy, direction) {
    const newX = playerGridX + dx;
    const newY = playerGridY + dy;
    
    // Check boundaries
    const gridHeight = level1.length;
    const gridWidth = level1[0] ? level1[0].length : 0;
    if (newX < 0 || newX >= gridWidth || newY < 0 || newY >= gridHeight) {
        return false;
    }
    
    // Check if tile exists
    if (level1[newY][newX] === 0) {
        return false;
    }
    
    // Check height difference
    const currentHeight = heightMap[playerGridY][playerGridX];
    const targetHeight = heightMap[newY][newX];
    const heightDiff = Math.abs(targetHeight - currentHeight);
    
    if (heightDiff > 1) {
        return false;
    }
    
    // Execute movement
    executeMove(newX, newY, targetHeight, direction, currentHeight);
    return true;
}

/**
 * Execute player movement with animation
 * @param {number} newX - Target grid X
 * @param {number} newY - Target grid Y
 * @param {number} targetHeight - Target height level
 * @param {string} direction - Animation direction
 * @param {number} currentHeight - Current height level
 */
function executeMove(newX, newY, targetHeight, direction, currentHeight) {
    // Store movement state
    isMoving = true;
    const oldGridX = playerGridX;
    const oldGridY = playerGridY;
    const oldHeight = currentHeight;
    
    // Don't update grid position yet during animation
    const newGridX = newX;
    const newGridY = newY;
    
    playerDirection = direction;
    
    // Play run animation
    player.play(`run_${direction}`);
    
    // Calculate target position
    const newPos = gridToScreen(newX, newY);
    
    // Determine animation timing based on height change
    let duration = 300;
    let easing = 'Power2';
    
    if (targetHeight > currentHeight) {
        // Jumping up
        duration = 400;
        easing = 'Quad.easeOut';
    } else if (targetHeight < currentHeight) {
        // Jumping down
        duration = 350;
        easing = 'Quad.easeIn';
    }
    
    // Create movement animation
    const moveConfig = {
        targets: player,
        x: newPos.x,
        y: newPos.y - (PLAYER_Y_OFFSET * SCALE) - (targetHeight * HEIGHT_OFFSET),
        duration: duration,
        ease: easing,
        onUpdate: (tween) => {
            updatePlayerDepthDuringMove(tween.progress, oldGridX, oldGridY, oldHeight, 
                                       newGridX, newGridY, targetHeight, newPos);
        },
        onComplete: () => {
            completeMove(newGridX, newGridY, targetHeight, direction);
        }
    };
    
    game.scene.scenes[0].tweens.add(moveConfig);
}

/**
 * Update player depth during movement animation
 * Uses maximum depth from start/end/interpolated positions to prevent occlusion
 * @param {number} progress - Animation progress (0-1)
 * @param {number} oldGridX - Starting grid X
 * @param {number} oldGridY - Starting grid Y
 * @param {number} oldHeight - Starting height
 * @param {number} newGridX - Target grid X
 * @param {number} newGridY - Target grid Y
 * @param {number} targetHeight - Target height
 * @param {object} targetPos - Target screen position
 */
function updatePlayerDepthDuringMove(progress, oldGridX, oldGridY, oldHeight, 
                                     newGridX, newGridY, targetHeight, targetPos) {
    // Interpolate grid position for smooth depth transition
    const interpGridY = oldGridY + (newGridY - oldGridY) * progress;
    const interpGridX = oldGridX + (newGridX - oldGridX) * progress;
    
    // Use the HIGHER height for depth calculation to avoid occlusion
    const maxHeight = Math.max(oldHeight, targetHeight);
    const elevatedY = targetPos.y - (PLAYER_Y_OFFSET * SCALE) - (maxHeight * HEIGHT_OFFSET);
    
    // Calculate depth from BOTH start and end positions, use the MAXIMUM (renders on top)
    const startDepth = (oldGridY * 10000) + (oldGridX * 100) - (elevatedY * 0.1);
    const endDepth = (newGridY * 10000) + (newGridX * 100) - (elevatedY * 0.1);
    const interpDepth = (interpGridY * 10000) + (interpGridX * 100) - (elevatedY * 0.1);
    
    // Use the maximum depth to ensure player is always visible
    const maxDepth = Math.max(startDepth, endDepth, interpDepth);
    player.setDepth(maxDepth);
}

/**
 * Complete movement and update player state
 * @param {number} newGridX - Target grid X
 * @param {number} newGridY - Target grid Y
 * @param {number} targetHeight - Target height
 * @param {string} direction - Animation direction
 */
function completeMove(newGridX, newGridY, targetHeight, direction) {
    // Update actual grid position and height
    playerGridX = newGridX;
    playerGridY = newGridY;
    playerHeight = targetHeight;
    // Don't update playerDirection here - it's only changed by rotation
    isMoving = false;
    
    // Switch back to idle animation
    player.play(`idle_${direction}`);
    
    // Final depth update
    updateDepthSorting();
    
    // Call the resolve callback if exists (for programming mode)
    if (window.moveResolve) {
        window.moveResolve();
        window.moveResolve = null;
    }
}

// ============================================
// LEVEL SELECTION UI
// ============================================

function showLevelSelection() {
    document.getElementById('level-selection-screen').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
    
    // Generate level cards
    const levelGrid = document.getElementById('level-grid');
    levelGrid.innerHTML = '';
    
    LEVELS.forEach(level => {
        const card = document.createElement('div');
        card.className = 'level-card';
        
        const isCompleted = ProgressManager.isCompleted(level.id);
        if (isCompleted) {
            card.classList.add('completed');
        }
        
        card.innerHTML = `
            <div class="level-number">Level ${level.id}</div>
            <div class="level-name">${level.name}</div>
            ${isCompleted ? '<div class="completion-badge">✅</div>' : ''}
        `;
        
        card.addEventListener('click', () => {
            startLevel(level.id);
        });
        
        levelGrid.appendChild(card);
    });
}

function startLevel(levelId) {
    document.getElementById('level-selection-screen').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    
    // Clear programs from previous level
    clearPrograms();
    
    // Reset execution state
    executionStartState = null;
    
    // Load the level
    loadLevel(levelId);
    
    // Get scene reference
    const scene = window.gameScene || game.scene.scenes[0];
    if (!scene) return;
    
    // Clear tile frame cache (important for level switching!)
    tileFrameMap.clear();
    
    // Clear all planted flowers from previous level
    plantedFlowers.forEach(flower => {
        if (flower && flower.destroy) {
            flower.destroy();
        }
    });
    plantedFlowers.clear();
    
    // Create grid
    createGrid(scene);
    
    // Create or update player
    const playerPos = gridToScreen(playerGridX, playerGridY);
    playerHeight = heightMap[playerGridY][playerGridX];
    
    if (!player) {
        // First time - create player
        player = scene.add.sprite(
            playerPos.x, 
            playerPos.y - (PLAYER_Y_OFFSET * SCALE) - (playerHeight * HEIGHT_OFFSET), 
            `player_${playerDirection}_idle`
        );
        player.setScale(SCALE);
        player.setDepth(10000);
    } else {
        // Update existing player
        player.x = playerPos.x;
        player.y = playerPos.y - (PLAYER_Y_OFFSET * SCALE) - (playerHeight * HEIGHT_OFFSET);
        player.setScale(SCALE);
    }
    
    player.play(`idle_${playerDirection}`);
    updateDepthSorting();
    
    // Refresh coordinates if visible
    if (coordsVisible) {
        refreshCoordinates(scene);
    }
}

// Initialize game on page load
document.addEventListener('DOMContentLoaded', () => {
    // Auto-load current level instead of showing level selection
    const currentLevel = ProgressManager.getCurrentLevel();
    
    // Hide level selection, show game
    document.getElementById('level-selection-screen').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    
    // Request level to be loaded when Phaser is ready
    window.autoLoadLevel = currentLevel;
    
    // Setup developer menu
    const devMenuBtn = document.getElementById('dev-menu-btn');
    const devMenu = document.getElementById('dev-menu');
    const closeDevMenuBtn = document.getElementById('close-dev-menu-btn');
    const resetProgressBtn = document.getElementById('reset-progress-btn');
    const showLevelsBtn = document.getElementById('show-levels-btn');
    
    devMenuBtn.addEventListener('click', () => {
        devMenu.style.display = devMenu.style.display === 'none' ? 'block' : 'none';
    });
    
    closeDevMenuBtn.addEventListener('click', () => {
        devMenu.style.display = 'none';
    });
    
    resetProgressBtn.addEventListener('click', () => {
        if (confirm('Reset all progress? This cannot be undone.')) {
            ProgressManager.reset();
            alert('Progress reset! Reloading to Level 1...');
            location.reload();
        }
    });
    
    showLevelsBtn.addEventListener('click', () => {
        devMenu.style.display = 'none';
        showLevelSelection();
    });
    
    // Toggle coordinate display
    const toggleCoordsBtn = document.getElementById('toggle-coords-btn');
    
    toggleCoordsBtn.addEventListener('click', () => {
        coordsVisible = !coordsVisible;
        
        if (coordsVisible) {
            // Show coordinates
            toggleCoordsBtn.textContent = '📍 Hide Coordinates';
            toggleCoordsBtn.style.background = '#e67e22';
            showCoordinates(gameScene);
        } else {
            // Hide coordinates
            toggleCoordsBtn.textContent = '📍 Toggle Coordinates';
            toggleCoordsBtn.style.background = '#9b59b6';
            hideCoordinates();
        }
    });
});
