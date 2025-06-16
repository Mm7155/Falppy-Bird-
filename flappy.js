document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    
    const scoreDisplay = document.getElementById('score');
    const startScreen = document.getElementById('start-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const startButton = document.getElementById('start-button');
    const restartButton = document.getElementById('restart-button');
    const finalScoreDisplay = document.getElementById('final-score');

    let canvasWidth, canvasHeight;

    // --- Game State ---
    let gameStarted = false;
    let gameOver = false;
    let score = 0;
    let frameCount = 0;
    
    // --- Cheat Mode State (Autopilot) ---
    let isCheatModeActive = false;
    let holdStartTimer = null;
    const HOLD_DURATION = 250; // ms to hold for cheat mode

    // --- Game Configuration ---
    const birdConfig = {
        x: 0,
        y: 0,
        radius: 20,
        gravity: 0.5,
        lift: -8, // Upward force when flapping
        velocity: 0,
    };

    const pillarConfig = {
        width: 80,
        gap: 200,
        frequency: 100, // frames between new pillars
        speed: 4,
        colors: ['#27ae60', '#16a085', '#2980b9', '#c0392b', '#8e44ad', '#f39c12']
    };

    let pillars = [];

    // --- Resize canvas to fit container ---
    function resizeCanvas() {
        const container = document.getElementById('game-container');
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        canvasWidth = canvas.width;
        canvasHeight = canvas.height;
        resetGame(); 
    }

    // --- Draw Functions ---
    function drawBird(x, y, radius) {
        // Main body (Red)
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Belly (Light Gray)
        ctx.fillStyle = '#ecf0f1';
        ctx.beginPath();
        ctx.arc(x, y + radius * 0.4, radius * 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Eyes & Pupils
        ['left', 'right'].forEach(side => {
            const xOffset = (side === 'left' ? -1 : 1) * radius * 0.3;
            // Eye white
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(x + xOffset, y - radius * 0.1, radius * 0.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Pupil black
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.arc(x + xOffset, y - radius * 0.1, radius * 0.1, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Eyebrows (Angry look)
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'black';
        ctx.beginPath();
        ctx.moveTo(x - radius * 0.6, y - radius * 0.4);
        ctx.lineTo(x - radius * 0.1, y - radius * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + radius * 0.6, y - radius * 0.4);
        ctx.lineTo(x + radius * 0.1, y - radius * 0.3);
        ctx.stroke();
        
        // Beak (Yellow)
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.moveTo(x - radius * 0.1, y + radius * 0.1);
        ctx.lineTo(x + radius * 0.1, y + radius * 0.1);
        ctx.lineTo(x, y + radius * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    function drawPillars() {
        pillars.forEach(p => {
            // Draw top pillar
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, 0, pillarConfig.width, p.topHeight);
            // Draw bottom pillar
            ctx.fillRect(p.x, canvasHeight - p.bottomHeight, pillarConfig.width, p.bottomHeight);
            // Add borders to pillars
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 5;
            ctx.strokeRect(p.x, 0, pillarConfig.width, p.topHeight);
            ctx.strokeRect(p.x, canvasHeight - p.bottomHeight, pillarConfig.width, p.bottomHeight);
        });
    }

    function drawBackground() {
        // Gradient sky
        let gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
        gradient.addColorStop(0, '#70c5ce'); // Light blue top
        gradient.addColorStop(1, '#a1d8e1'); // Slightly lighter blue bottom
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        // Draw clouds for visual appeal
        drawCloud(canvasWidth * 0.1, canvasHeight * 0.2, 60);
        drawCloud(canvasWidth * 0.7, canvasHeight * 0.1, 80);
        drawCloud(canvasWidth * 0.4, canvasHeight * 0.3, 50);
    }

    function drawCloud(x, y, size) {
        // Simple cloud shape using arcs
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // Semi-transparent white
        ctx.beginPath();
        ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
        ctx.arc(x + size * 0.4, y - size * 0.2, size * 0.7, 0, Math.PI * 2);
        ctx.arc(x + size * 0.8, y, size * 0.6, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
    }

    // --- Update and Game Logic ---
    function updateBird() {
        birdConfig.velocity += birdConfig.gravity; // Apply gravity
        birdConfig.y += birdConfig.velocity; // Update position
    }

    function updatePillars() {
        // Add new pillars at a set frequency
        if (frameCount % pillarConfig.frequency === 0) {
            // Randomly determine the height of the top pillar, ensuring enough gap
            const topHeight = Math.random() * (canvasHeight - pillarConfig.gap - 100) + 50;
            pillars.push({
                x: canvasWidth, // Start pillar off-screen to the right
                topHeight: topHeight,
                bottomHeight: canvasHeight - topHeight - pillarConfig.gap,
                color: pillarConfig.colors[Math.floor(Math.random() * pillarConfig.colors.length)], // Random color
                passed: false // Flag to check if bird has passed it for scoring
            });
        }
        // Move pillars to the left
        pillars.forEach(p => p.x -= pillarConfig.speed);
        // Remove off-screen pillars to optimize performance
        pillars = pillars.filter(p => p.x + pillarConfig.width > 0);
    }

    function checkCollisions() {
        // Check collision with top/bottom canvas bounds
        if (birdConfig.y + birdConfig.radius > canvasHeight || birdConfig.y - birdConfig.radius < 0) {
            endGame();
        }
        // Check collision with pillars
        pillars.forEach(p => {
            // Check horizontal overlap with pillar
            if (birdConfig.x + birdConfig.radius > p.x && birdConfig.x - birdConfig.radius < p.x + pillarConfig.width) {
                // Check vertical overlap with top or bottom part of the pillar
                if (birdConfig.y - birdConfig.radius < p.topHeight || birdConfig.y + birdConfig.radius > canvasHeight - p.bottomHeight) {
                    endGame();
                }
            }
        });
    }

    function updateScore() {
        pillars.forEach(p => {
            // If bird has passed the pillar and it hasn't been scored yet
            if (!p.passed && p.x + pillarConfig.width < birdConfig.x) {
                p.passed = true;
                score++;
                scoreDisplay.textContent = score;
            }
        });
    }
    
    // --- AUTOPILOT AI ---
    function autoPlayAI() {
        // Find the next pillar that the bird needs to pass through
        const nextPillar = pillars.find(p => p.x + pillarConfig.width > birdConfig.x - birdConfig.radius);

        if (nextPillar) {
            const pillarTop = nextPillar.topHeight;
            const pillarBottom = canvasHeight - nextPillar.bottomHeight;

            // Calculate the optimal vertical region within the gap
            // We want the bird to stay roughly in the middle 60% of the gap for safety
            const optimalGapTop = pillarTop + (pillarConfig.gap * 0.2);
            const optimalGapBottom = pillarBottom - (pillarConfig.gap * 0.2);

            // Aim for the center of this optimal region
            const targetY = (optimalGapTop + optimalGapBottom) / 2;

            // Predict bird's position in the next few frames if it continues current trajectory
            let predictedY = birdConfig.y + birdConfig.velocity + birdConfig.gravity;

            // Decision logic:
            // 1. If the bird is below the target and is either falling or not rising fast enough
            // 2. If the bird is predicted to drop below the optimal bottom edge soon
            if ((birdConfig.y > targetY + 5 && birdConfig.velocity >= 0) || // Below target and falling/level
                (predictedY > optimalGapBottom - birdConfig.radius / 2)) { // Predicted to be too low
                birdJump();
            } else if (birdConfig.y - birdConfig.radius < optimalGapTop + 5 && birdConfig.velocity < 0) {
                // If bird is too high and still rising, do nothing, let gravity pull it down.
                // This prevents overshooting and allows for a smoother descent.
            }

        } else {
            // If no pillars are currently visible on screen, keep the bird roughly centered vertically
            const screenMidY = canvasHeight / 2;
            if (birdConfig.y > screenMidY + 10 && birdConfig.velocity >= 0) { // If below center and falling/level
                birdJump();
            }
        }
    }


    function birdJump() {
        // Apply upward velocity if game is not over
        if (!gameOver) {
            birdConfig.velocity = birdConfig.lift;
        }
    }

    // --- Game Flow Control ---
    function resetGame() {
        // Reset all game state variables
        gameStarted = false;
        gameOver = false;
        isCheatModeActive = false;
        clearTimeout(holdStartTimer); // Clear any pending hold timers

        birdConfig.x = canvasWidth / 4; // Reset bird position
        birdConfig.y = canvasHeight / 2;
        birdConfig.velocity = 0; // Reset bird velocity
        
        pillars = []; // Clear all pillars
        score = 0; // Reset score
        frameCount = 0; // Reset frame counter
        
        scoreDisplay.textContent = '0'; // Update score display
        draw(); // Redraw initial state
    }
    
    function startGameFlow() {
        resetGame(); // Reset game before starting
        gameStarted = true;
        startScreen.style.display = 'none'; // Hide start screen
        gameOverScreen.style.display = 'none'; // Hide game over screen
        scoreDisplay.style.display = 'block'; // Show score
        gameLoop(); // Start the main game loop
    }

    function endGame() {
        if (gameOver) return; // Prevent multiple end game calls
        gameOver = true;
        gameStarted = false;
        isCheatModeActive = false; // Disable autopilot
        clearTimeout(holdStartTimer); // Clear any pending hold timers
        finalScoreDisplay.textContent = score; // Display final score
        gameOverScreen.style.display = 'flex'; // Show game over screen
        scoreDisplay.style.display = 'none'; // Hide score
    }

    // --- Main Game Loop ---
    function gameLoop() {
        if (gameOver) return; // Stop loop if game is over
        
        if (isCheatModeActive) {
            autoPlayAI(); // Run autopilot logic if active
        }

        updateBird(); // Update bird's physics
        updatePillars(); // Update pillars' positions and spawn new ones
        
        ctx.clearRect(0, 0, canvasWidth, canvasHeight); // Clear canvas
        drawBackground(); // Draw background elements
        drawPillars(); // Draw all active pillars
        drawBird(birdConfig.x, birdConfig.y, birdConfig.radius); // Draw the bird
        
        checkCollisions(); // Check for any collisions
        updateScore(); // Update score based on passed pillars
        
        frameCount++; // Increment frame counter
        requestAnimationFrame(gameLoop); // Request next animation frame
    }

    // --- Initial Draw ---
    function draw() {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        drawBackground();
        drawBird(canvasWidth / 4, canvasHeight / 2, birdConfig.radius);
    }
    
    // --- Event Handlers ---
    function handlePressStart(e) {
        e.preventDefault();
        if (!gameStarted) return; // Only handle input if game is running

        // Reset cheat mode state and timer
        isCheatModeActive = false; // Initially assume it's a tap
        clearTimeout(holdStartTimer);
        
        // Start a timer. If still held when timer fires, activate cheat mode.
        holdStartTimer = setTimeout(() => {
            isCheatModeActive = true;
        }, HOLD_DURATION);
    }

    function handlePressEnd(e) {
        e.preventDefault();
        if (!gameStarted) return;
        
        clearTimeout(holdStartTimer); // Stop the hold timer
        
        // If cheat mode was NOT active when released, it means it was a quick tap.
        // Perform a single jump.
        if (!isCheatModeActive) {
            birdJump();
        }
        // Always turn off cheat mode after release, whether it was active or not.
        isCheatModeActive = false;
    }

    // --- Event Listeners ---
    window.addEventListener('resize', resizeCanvas); // Handle window resizing
    startButton.addEventListener('click', startGameFlow); // Start button click
    restartButton.addEventListener('click', startGameFlow); // Restart button click

    // Desktop controls
    canvas.addEventListener('mousedown', handlePressStart);
    canvas.addEventListener('mouseup', handlePressEnd);

    // Mobile/Touch controls
    canvas.addEventListener('touchstart', handlePressStart);
    canvas.addEventListener('touchend', handlePressEnd);

    // Initialize the canvas and game on load
    resizeCanvas(); // Set initial canvas size and draw the initial bird
});


