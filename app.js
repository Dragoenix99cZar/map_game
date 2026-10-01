import init, { WorldGame } from './pkg/map_game.js';

async function run() {
    const container = document.getElementById('map-container');
    const targetDisplay = document.getElementById('target-display');
    const scoreDisplay = document.getElementById('score-display');
    const mistakeDisplay = document.getElementById('mistake-display');
    const timerDisplay = document.getElementById('timer-display');
    const wrapper = document.getElementById('map-wrapper');
    const startBtn = document.getElementById('start-btn');
    const modeSelect = document.getElementById('mode-select');

    try {
        await init();

        // 1. Fetch raw map data resources concurrently
        const [svgResponse, levelResponse] = await Promise.all([
            fetch('./world_map.svg'),
            fetch('./game_level.json')
        ]);

        const rawSvgText = await svgResponse.text();
        const levelData = await levelResponse.json();

        // 2. Clear out original text hints and securely token-scramble the nodes in Rust
        const secureAssets = WorldGame.process_svg_asset(rawSvgText);
        container.innerHTML = secureAssets.anonymized_svg;

        const map = container.querySelector('svg');
        map.setAttribute('width', '100%');
        map.setAttribute('height', '100%');
        map.style.pointerEvents = 'auto';

        // Dynamic State Loops
        let game = null;
        let timerInterval = null;
        let timeRemaining = 0;
        let activeMistakes = 0;
        let isGameRunning = false;

        // Viewport settings for panning/zooming
        let viewState = { x: 107.97, y: -32.27, w: 743.75, h: 743.75 };
        const initialVB = { ...viewState };
        let isPanning = false, isDragging = false, startPoint = { x: 0, y: 0 };

        function updateViewBox() {
            map.setAttribute('viewBox', `${viewState.x} ${viewState.y} ${viewState.w} ${viewState.h}`);
        }
        updateViewBox();

        // --- TIMER ORCHESTRATION ---
        function startTimer(durationSeconds) {
            clearInterval(timerInterval);
            timeRemaining = durationSeconds;

            function tick() {
                if (timeRemaining <= 0) {
                    clearInterval(timerInterval);
                    timerDisplay.innerText = "TIME UP!";
                    targetDisplay.innerText = "Game Over! Time ran out.";
                    isGameRunning = false;
                    return;
                }
                timeRemaining--;
                const mins = String(Math.floor(timeRemaining / 60)).padStart(2, '0');
                const secs = String(timeRemaining % 60).padStart(2, '0');
                timerDisplay.innerText = `${mins}:${secs}`;
            }
            tick();
            timerInterval = setInterval(tick, 1000);
        }

        // --- CORE GAME RESTART LOOP ENGINE ---
        function startNewGame() {
            clearInterval(timerInterval);
            isGameRunning = true;
            activeMistakes = 0;
            mistakeDisplay.innerText = "0 / 6";

            // Reset all map path inline colors back to blank CSS defaults
            const paths = map.querySelectorAll('path');
            paths.forEach(p => p.style.fill = '');

            // Process level parameters from selections
            let whitelist = [];
            const selectedMode = modeSelect.value;
            if (selectedMode === "beginner") whitelist = levelData.beginner_popular;
            else if (selectedMode === "asia") whitelist = levelData.continents.asia;
            else if (selectedMode === "europe") whitelist = levelData.continents.europe;
            // "advanced" passes an empty whitelist array, instructing Rust to load every map country!

            // Fire up a brand new rust engine logic session
            game = new WorldGame(secureAssets.token_map, whitelist);

            // Allocate a 3-minute (180 seconds) countdown limit window
            startTimer(180);
            updateUI();
        }

        function updateUI() {
            if (!game) return;
            const targetName = game.get_current_target_display();
            if (targetName === "GAME_OVER") {
                clearInterval(timerInterval);
                targetDisplay.innerText = "Victory! Map fully completed.";
                isGameRunning = false;
            } else {
                targetDisplay.innerText = targetName;
            }
            scoreDisplay.innerText = `${game.get_score()} / ${game.get_total_turns()}`;
        }

        // --- MOUSE PAN AND ZOOM BINDINGS ---
        wrapper.addEventListener('mousedown', (e) => {
            isPanning = true; isDragging = false;
            startPoint = { x: e.clientX, y: e.clientY };
            map.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isPanning) return;
            const dx = e.clientX - startPoint.x;
            const dy = e.clientY - startPoint.y;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging = true;

            const scaleX = viewState.w / map.clientWidth;
            const scaleY = viewState.h / map.clientHeight;
            viewState.x -= dx * scaleX; viewState.y -= dy * scaleY;
            startPoint = { x: e.clientX, y: e.clientY };
            updateViewBox();
        });

        window.addEventListener('mouseup', () => { isPanning = false; map.style.cursor = 'default'; });

        wrapper.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY < 0 ? 0.85 : 1.15;
            if (viewState.w * zoomFactor < initialVB.w * 0.05 || viewState.w * zoomFactor > initialVB.w * 10) return;
            const rect = map.getBoundingClientRect();
            const mouseX = (event.clientX - rect.left) * (viewState.w / rect.width) + viewState.x;
            const mouseY = (event.clientY - rect.top) * (viewState.h / rect.height) + viewState.y;
            viewState.x = mouseX - (mouseX - viewState.x) * zoomFactor;
            viewState.y = mouseY - (mouseY - viewState.y) * zoomFactor;
            viewState.w *= zoomFactor; viewState.h *= zoomFactor;
            updateViewBox();
        }, { passive: false });

        document.getElementById('zoom-in').addEventListener('click', () => { viewState.w *= 0.8; viewState.h *= 0.8; updateViewBox(); });
        document.getElementById('zoom-out').addEventListener('click', () => { viewState.w *= 1.25; viewState.h *= 1.25; updateViewBox(); });
        document.getElementById('reset').addEventListener('click', () => { viewState = { ...initialVB }; updateViewBox(); });

        // Link the start button explicitly
        startBtn.addEventListener('click', startNewGame);

        // --- CLICK SELECTION LOGIC ---
        map.addEventListener('click', (event) => {
            if (isDragging || !isGameRunning || !game) return;

            const clickedElement = event.target;
            if (clickedElement.tagName === 'path' && clickedElement.id) {
                const targetTokenBeforeClick = game.get_current_target_token();
                const gameOutcome = game.handle_click(clickedElement.id);

                if (gameOutcome === 1) {
                    // Correct Guess
                    clickedElement.style.fill = '#22c55e';
                    setTimeout(() => { clickedElement.style.fill = '#bbf7d0'; }, 600);
                    activeMistakes = 0; // Reset consecutive mistake track count
                    mistakeDisplay.innerText = "0 / 6";
                } else if (gameOutcome === 0) {
                    // Incorrect Guess
                    clickedElement.style.fill = '#ef4444';
                    setTimeout(() => { clickedElement.style.fill = ''; }, 600);
                    activeMistakes++;
                    mistakeDisplay.innerText = `${activeMistakes} / 6`;
                } else if (gameOutcome === 2) {
                    // Strikeout reached (6 consecutive failures)
                    clickedElement.style.fill = '#ef4444';
                    setTimeout(() => { clickedElement.style.fill = ''; }, 600);

                    activeMistakes = 0;
                    mistakeDisplay.innerText = "0 / 6";

                    const correctPathNode = map.getElementById(targetTokenBeforeClick);
                    if (correctPathNode) {
                        correctPathNode.style.fill = '#f59e0b'; // Reveal the correct country in orange
                        setTimeout(() => { correctPathNode.style.fill = ''; }, 2500);
                    }
                }
                updateUI();
            }
        });

    } catch (error) {
        console.error("Initialization Failed:", error);
        targetDisplay.innerText = "Error initializing engine assets.";
    }
}

run();
