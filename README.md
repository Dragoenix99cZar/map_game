# MAP GAME

- Encarta-Style World Map Placement Game

An interactive, high-performance, and secure geographic map placement game built using **Rust, WebAssembly (WASM), and native HTML5/JavaScript**. Inspired by the nostalgic geography quizzes of *Microsoft Encarta 2009*, this application challenges users to find and click target countries on a responsive world map under multi-level game configurations and timing rules.

---

## 1. Project Ideation & Vision
Digital maps natively served on the web are traditionally highly vulnerable to front-end data sniffing. If an SVG map holds identifiable country metadata (like `id="NP"` or `title="Nepal"`) directly inside the DOM, players can easily open the browser developer tools to cheat. 

The core vision of this project was to engineer a **zero-dependency, client-side secure map puzzle** that splits responsibilities cleanly:
1. **The View (Browser/JS):** Acts as a completely blind visual puppet that only tracks positions, clicks, and applies CSS colors.
2. **The Brain (Rust/WASM):** Hidden completely in secure WebAssembly memory space, handling asset processing, layout obfuscation, scoring algorithms, and strikeout rules.

---

## 2. System Architecture & Workflow

```text
         [world_map.svg] + [game_level.json]
                         │ (Asynchronous fetch)
                         ▼ 
┌────────────────────────────────────────────────────────┐
│                   JavaScript Layer                     │
│  - Captures inputs, panning matrix & wheel zooming     │
│  - Renders UI panel status updates and color flashes   │
└──────────┬──────────────────────────────────▲──────────┘
           │ (Passes raw text SVG string)     │ (Returns clean SVG + token map)
           ▼                                  │
┌─────────────────────────────────────────────┴──────────┐
│              WebAssembly Memory (Rust)                 │
│  - Parses XML Tree structure using `roxmltree`         │
│  - Anonymizes metadata (`title` attribute stripping)   │
│  - Scrambles standard ISO codes via XOR hex shifts     │
│  - Evaluates guess validation via token hashes         │
└────────────────────────────────────────────────────────┘
```

---

## 3. Choice of Technology Stack
*   **Rust:** Chosen for its memory safety, compile-time performance, and structural speed. It allows heavy XML processing using crates like `roxmltree` entirely on the client side without locking up main browser loops.
*   **WebAssembly (`wasm-bindgen` & `serde-wasm-bindgen`):** Translates complex Rust state machines and hash collections into native JavaScript types smoothly, bridging the high-performance logic tier directly with web interactions.
*   **Vanilla JS & CSS3:** Utilizes standard browser Pointer Events and SVG ViewBox parameter adjustments to handle custom fluid panning and zoom scaling metrics natively. Bypassing external script CDNs guarantees that firewall or network timeouts never crash the canvas environment.

---

## 4. Features Checklist
*   **Compile-Less Obfuscation:** Processes standard SVG assets into secure anonymous code vectors at runtime entirely in Rust memory without manual vector pre-editing.
*   **Dynamic Game Modes:** Reads structural whitelist limits out of a local `game_level.json` profile to configure Beginner (popular selections), Continent (Asia or Europe exclusively), or Advanced (all countries active) modes dynamically.
*   **Countdown Timer:** Provides a configurable 5-minute time window that automatically enforces a "Time Up!" loss state if it runs out.
*   **Strikeout Counter:** Tracks consecutive wrong choices. Clicking incorrectly 6 times in a row forces a strikeout, highlights the correct country briefly in a high-visibility amber-orange layout mask, and skips to the next country.
*   **Fluid Panning & Inertial Zooming:** A dependency-free coordinate matrix transformation system built directly into the container element, offering cursor-centered zooming and drag-to-pan handling that intelligently blocks misclicks during drag execution.

---

## 5. Obstacles Faced & Resolutions
*   *The Drag-Guess Collision:* Early versions logged map dragging as incorrect country guesses. **Resolution:** Implemented an input tracking flag (`isDragging`) that dynamically locks game evaluations if cursor travel changes by more than 3 pixels.
*   *Missing ViewBox Attributes:* Many MapSVG maps use structural `width` and `height` settings rather than an inner standard `viewBox`, crashing traditional node splitters. **Resolution:** Configured an error-handling fallback parser inside JavaScript that dynamically maps missing dimensions into programmatic boundaries (`[0, 0, width, height]`).
*   *Network CDN Breakages:* Initial attempts using remote Javascript dependencies failed due to external connection timeouts (`ERR_CONNECTION_TIMED_OUT`). **Resolution:** Re-architected the layout controls to manipulate the SVG canvas natively using standard vanilla JS math matrix algorithms.

---

## 6. Project Organization & Setup

### Project Directory Structure

```
├── Cargo.toml             # Rust package configurations & feature flags
├── game_level.json        # Definition matrices for game modes & continent pools
├── index.html             # UI styling layouts and map wrapper canvas structure
├── app.js                 # JS controller handling event loops & viewport pans
├── world_map.svg          # Raw geographic map asset containing country metadata
└── src
    └── lib.rs             # Core game engine logic and layout obfuscator
```

### Setup & Installation Steps

1.  **Install Prerequisites:** Make sure you have the [Rust toolchain](https://www.rust-lang.org/tools/install) and [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) installed locally.
2.  **Compile WebAssembly Bundle:** Navigate to the root folder directory in your terminal and compile your project targeting standard browser modules:
    ```bash
    wasm-pack build --target web
    ```
3.  **Boot Up Static Local Server:** Because the browser requires security handshakes to fetch files locally using ES modules, you must serve the files via an HTTP server. Run any of the following:
    ```bash
    # Python 3
    python -m http.server 8000
    
    # NodeJS / NPM
    npx serve
    ```
4.  **Play:** Open your browser tab and navigate to `http://localhost:8000` (or the custom port designated by your server).

---

## 6. Usage Guidelines
*   **Selecting Modes:** Use the top drop-down menu control panel to pick between your preferred difficulty limits or continent regions, then click the blue **"Start Game"** button to load the game engine.
*   **Moving Around:** Click and drag anywhere on the map to **pan** the canvas frame smoothly.
*   **Zooming In/Out:** Use your mouse scroll-wheel or trackpad pinching gestures anywhere over the map window to zoom directly toward your cursor location. Alternatively, you can click the `+`, `−`, and `⟲` control buttons in the bottom right corner to manually adjust or reset the view.

---

## 🚀 Future Elaboration & Roadmap
*   **Dynamic Highlighting Profiles:** Updating the Rust parser to support regional borders, allowing the map to isolate or black out non-active continents depending on the chosen configuration profile.
*   **Global Leaderboards & Local Storage:** Saving personal best run times and accuracy metrics into the browser's native `localStorage`.
*   **Audio Interaction Enhancements:** Integrating high-performance Web Audio API contexts to trigger responsive sound rewards for correct guesses, failures, and level completions.
