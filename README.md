<div align="center">

# ⚔️ Crossword Game: Real-Time Multiplayer Battle Arena

**An adrenaline-fueled, real-time multiplayer Crossword & Scrabble combat arena with RPG-style HP mechanics, strategic Power Cards, and a high-performance 60 FPS HTML5 Canvas engine.**

[![Next.js](https://img.shields.io/badge/Next.js-16.3.4-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![WebSockets](https://img.shields.io/badge/WebSockets-Real--Time-FF6600?style=for-the-badge&logo=websocket&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS%204-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

---

[🎮 Features](#-key-features) • [🕹️ Gameplay & Cards](#-gameplay-modes--power-card-arsenal) • [🏗️ System Architecture](#-system-architecture) • [🚀 Quick Start](#-getting-started--local-development) • [📂 Project Structure](#-project-structure) • [📡 API & WebSockets](#-api--websocket-specification)

</div>

---

## 🌟 Overview

**Crossword Game** transforms traditional Scrabble / Crossword puzzle gameplay into an intense, tactical multiplayer battle. Players construct valid words on a classic $15 \times 15$ grid using the official **CSW24 Lexicon** while managing HP pools, deploying game-changing **Power Cards**, freezing opponent tiles, and activating proactive defensive shields.

### 🎯 Key Features

- ⚔️ **Dual Game Modes**:
  - **HP Deathmatch Mode**: Every point scored deals direct combat damage to opponents. Survive by healing, shielding, and disrupting opponent setups.
  - **Turn Score Mode**: Classic competitive tournament format with fixed round limits and highest score victories.
- ⚡ **Dynamic Power Card System**: 7 distinct collectible combat cards including Tile Freezing with sub-zero visual mists, Board Tile Demolition, Word Doublers, Shield Auras, Tile Stealing (Spy Swap), and AI Word Assistance.
- 🎨 **High-Performance Canvas Board Engine**: Custom-built HTML5 2D Canvas engine with layered multi-pass rendering, smooth panning, pinch-to-zoom camera physics, particle bursts, and sub-zero ice fracture shaders.
- 🔄 **Real-Time State Synchronization**: Instantaneous WebSocket event broadcasting for low-latency turn transitions, live timer ticks, card animations, and spectator mode.
- 📱 **Responsive & Mobile-Optimized**: Tailored touch-drag interactions, adaptive rack layouts, floating tile ghosts, and dedicated mobile control docks.
- 🛡️ **Full Official Dictionary & Rule Enforcement**: Server-side move validation checking letter adjacency, orthogonal connectivity, blank tile wildcard handling, and CSW24 dictionary lookups in milliseconds.
- 🌐 **Seamless Ngrok & Docker Setup**: Single-command containerized deployment with automated reverse proxy routing via Nginx and automated Ngrok public tunneling.

---

## 🕹️ Gameplay Modes & Power Card Arsenal

### 1. Game Modes

| Mode | Win Condition | Mechanics |
| :--- | :--- | :--- |
| **⚔️ HP Deathmatch** | Last player standing | Players start with 100 HP. Valid word points inflict direct HP damage to other players. HP can be restored via the `HEAL` card or protected via `SHIELD`. |
| **🏆 Turn Score** | Highest score after $N$ turns | Classic Scrabble scoring. Fixed round limit ($10, 15, 20$ turns). Strategic board control and multiplier maximization. |

---

### 2. The Power Card Arsenal

Power Cards are drawn during the game or upon completing special board feats. Each card comes with a dedicated visual theme, sound cue, and tactical advantage:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             POWER CARDS DOCK                                │
├──────────────┬──────────────┬──────────────────┬────────────────────────────┤
│ Card Name    │ Theme Color  │ Activation Type  │ Tactical Effect            │
├──────────────┼──────────────┼──────────────────┼────────────────────────────┤
│ 💖 Heal      │ Rose / Pink  │ Self Instant     │ Restores HP based on rack  │
│              │              │ (with Confirm)   │ tile values.               │
├──────────────┼──────────────┼──────────────────┼────────────────────────────┤
│ 🛡️ Shield    │ Cyan / Blue  │ Proactive / Aura │ Deploys an energy barrier  │
│              │              │ (Lasts 1 Hit)    │ that fully absorbs 1 hit.  │
├──────────────┼──────────────┼──────────────────┼────────────────────────────┤
│ ❄️ Freeze    │ Sky / Frost  │ Board Target     │ Freezes a tile for 1 round │
│              │              │ (Sub-Zero Mist)  │ preventing opponent plays. │
├──────────────┼──────────────┼──────────────────┼────────────────────────────┤
│ 💥 Clear     │ Orange / Red │ Board Target     │ Permanently vaporizes a    │
│              │              │ (Destruction FX) │ tile from the board.       │
├──────────────┼──────────────┼──────────────────┼────────────────────────────┤
│ 👁️ Spell Word│ Amber / Gold │ Assistance       │ Reveals optimal high-score │
│              │              │ (Turn Action)    │ word placement from rack.  │
├──────────────┼──────────────┼──────────────────┼────────────────────────────┤
│ 🔄 Swap Word │ Emerald/Teal │ Targeted PvP     │ Swaps up to 3 tiles with a │
│              │              │ (Spy Swap)       │ selected opponent's rack.  │
├──────────────┼──────────────┼──────────────────┼────────────────────────────┤
│ ⚡ Word ×2   │ Purple / Neo │ Targeted / Move  │ Doubles damage or score    │
│              │              │ (Next Play)      │ dealt by your next word.   │
└──────────────┴──────────────┴──────────────────┴────────────────────────────┘
```

---

## 🏗️ System Architecture

The application adopts a robust client-server architecture designed for sub-50ms latency across real-time multiplayer interactions:

```mermaid
flowchart TD
    subgraph Client["Frontend Client (Next.js 16 + React 19)"]
        UI["Game UI & React Hooks"]
        Canvas["Board Canvas Engine (60 FPS)"]
        FX["FX & Tile Shader Compositor"]
        WSClient["WebSocket Client Manager"]
    end

    subgraph Gateway["Reverse Proxy & Gateway"]
        Nginx["Nginx Reverse Proxy (:8080)"]
        Ngrok["Ngrok Tunnel (:4040)"]
    end

    subgraph Backend["Backend API (FastAPI + Python 3.12)"]
        Router["FastAPI REST & WS Endpoints"]
        GameEngine["Game & Turn Engine"]
        Validator["CSW24 Lexicon & Placement Validator"]
        CardService["Power Card Resolution Engine"]
        WSHub["WebSocket Connection Manager"]
    end

    subgraph Database["Data Layer"]
        PG[("PostgreSQL 16")]
    end

    UI --> WSClient
    Canvas --> FX
    UI --> Canvas
    WSClient <-->|WSS Protocol| Nginx
    UI <-->|HTTP REST| Nginx
    Ngrok <--> Nginx
    Nginx <--> Router
    Router <--> GameEngine
    GameEngine <--> Validator
    GameEngine <--> CardService
    GameEngine <--> WSHub
    GameEngine <--> PG
```

### 🔁 Game Turn & Placement Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor P1 as Player 1 (Active)
    participant UI as Canvas & UI
    participant WS as WebSocket Hub
    participant BE as Backend Game Engine
    participant DB as PostgreSQL
    actor P2 as Player 2 (Opponent)

    P1->>UI: Drag & place tiles on 15x15 board
    UI->>BE: POST /api/moves/validate (Draft Check)
    BE-->>UI: Placement Valid (+Score Estimate)
    P1->>UI: Click [Confirm Move]
    UI->>BE: POST /api/moves/commit
    BE->>BE: Validate word legality (CSW24 Dictionary)
    BE->>BE: Compute Multipliers (2L, 3L, 2W, 3W, Bingo)
    BE->>BE: Resolve Card Effects (Shield absorbs / HP damaged)
    BE->>DB: Persist updated board, racks & player HP
    BE->>WS: Broadcast EventType.GAME_STATE_SYNC
    WS-->>P1: Update rack & trigger Score FX
    WS-->>P2: Animate opponent move, update HP & start timer
```

---

## 📂 Project Structure

```
crossword-game/
├── backend/                        # FastAPI Backend Service
│   ├── app/
│   │   ├── api/                    # REST API Routes (rooms, games, moves, cards, debug)
│   │   │   ├── cards.py            # Power card activation endpoints
│   │   │   ├── games.py            # Game lifecycle management
│   │   │   ├── moves.py            # Word placement & validation endpoints
│   │   │   └── rooms.py            # Matchmaking & room lobby management
│   │   ├── core/                   # Security, settings & environment configs
│   │   ├── database/               # SQLAlchemy models & async session handlers
│   │   │   ├── models.py           # Game, Player, Move, Room schemas
│   │   │   └── session.py          # PostgreSQL async connection pool
│   │   ├── game/                   # Pure game engine logic
│   │   │   ├── board.py            # 15x15 Grid state representation
│   │   │   ├── dictionary.py       # CSW24 fast lookup & DAWG/Trie structure
│   │   │   ├── extractor.py        # Orthogonal word extraction algorithms
│   │   │   ├── rules.py            # Crossword rules & connectivity check
│   │   │   └── scoring.py          # Score calculation & multiplier bonuses
│   │   ├── schemas/                # Pydantic v2 schemas for request/response
│   │   ├── services/               # Core business logic services
│   │   │   ├── game_service.py     # Main turn controller & HP damage engine
│   │   │   ├── move_service.py     # Move execution & rack replenishing
│   │   │   └── room_service.py     # Lobby seats & player coordination
│   │   └── websocket/              # Real-time WebSocket connection manager & event dispatcher
│   ├── data/
│   │   └── CSW24.txt               # Collins Scrabble Words (CSW24) Lexicon
│   └── tests/                      # Pytest automated test scenarios
│
├── frontend/                       # Next.js 16 (App Router) Frontend
│   ├── app/
│   │   ├── game/[gameId]/          # In-game battle screen & state orchestration
│   │   ├── lobby/[pin]/            # Room lobby & player preparation screen
│   │   └── page.tsx                # Landing page & room creation/joining
│   ├── components/
│   │   ├── board/                  # Canvas 2D Board Rendering Engine
│   │   │   ├── BoardCanvas.tsx     # Canvas wrapper & pointer event hit-testing
│   │   │   └── engine/             # Multi-layer canvas rendering pipelines
│   │   │       ├── BoardCompositor.ts
│   │   │       ├── TileRenderer.ts # Crystalline ice, frost mist, letter bevels
│   │   │       └── FXRenderer.ts   # Targeted reticles, particle glints
│   │   ├── game/                   # HUD, Sidebars, Modals & UI Components
│   │   │   ├── PowerCardBar.tsx    # Symmetrical Power Card Dock & themed confirm dialogs
│   │   │   ├── RightSidebar.tsx    # Player status, HP bars, Shield auras & history
│   │   │   ├── GameOverScreen.tsx  # Victory / Defeat ceremonial presentation
│   │   │   └── TurnTimer.tsx       # Real-time ticking turn clock
│   │   └── rack/                   # Bottom Tile Rack & drag-drop floating tiles
│   ├── hooks/                      # Custom React hooks (useBoardCamera, useGameSync, etc.)
│   └── lib/                        # Type definitions, API client & tile utilities
│
├── gateway/                        # Nginx reverse proxy configuration
├── docker-compose.yml              # Multi-container orchestration (Next.js, FastAPI, PG, Nginx, Ngrok)
└── README.md
```

---

## 🚀 Getting Started & Local Development

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended)
- [Node.js 20+ / 22+](https://nodejs.org/) & [npm](https://www.npmjs.com/)
- [Python 3.12+](https://www.python.org/) & [pip](https://pip.pypa.io/)
- [PostgreSQL 16+](https://www.postgresql.org/)

---

### Option A: ⚡ Instant Launch with Docker Compose (Recommended)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Cell1991/crossword-game.git
   cd crossword-game
   ```

2. **Configure Environment Variables**:
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   *(Optional: If using Ngrok for public multiplayer links, provide `NGROK_AUTHTOKEN` and `NGROK_DOMAIN`)*.

3. **Start All Services**:
   ```bash
   docker compose up --build
   ```

4. **Access the Application**:
   - 🌐 **Web Game Client**: [http://localhost:3000](http://localhost:3000) (or via Gateway at [http://localhost:8090](http://localhost:8090))
   - 🔌 **FastAPI Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - 🚇 **Ngrok Tunnel Dashboard**: [http://localhost:4040](http://localhost:4040)

---

### Option B: 🛠️ Manual Step-by-Step Setup

#### 1. Backend Setup

```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Start PostgreSQL database (default: postgresql+asyncpg://crossword:crossword@localhost:5435/crossword)
# Run FastAPI server with auto-reload:
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📡 API & WebSocket Specification

### 🌐 Key REST Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/rooms` | Create a new multiplayer room lobby with custom HP/Turn settings |
| `POST` | `/api/rooms/join` | Join an existing room via 6-digit Room PIN |
| `POST` | `/api/rooms/{pin}/start` | Host starts the match and initialises tile bag & player racks |
| `POST` | `/api/moves/validate` | Validate candidate tile placements against rules & CSW24 lexicon |
| `POST` | `/api/moves/commit` | Commit a word placement, calculate score/damage, and advance turn |
| `POST` | `/api/moves/exchange` | Exchange selected rack tiles with the tile bag |
| `POST` | `/api/moves/pass` | Pass turn to the next player |
| `POST` | `/api/cards/{gameId}/use` | Execute proactive/targeted power card effect |
| `GET` | `/api/dictionary/lookup/{word}` | Fetch definition and word validity information |

### ⚡ WebSocket Real-Time Events (`/ws/games/{gameId}`)

```json
// Example: Board State Synchronisation Payload
{
  "type": "GAME_STATE_SYNC",
  "data": {
    "game_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "status": "IN_PROGRESS",
    "current_player_id": "player_1_id",
    "turn_number": 4,
    "board": [...],
    "players": [
      {
        "id": "player_1_id",
        "display_name": "Champion",
        "hp": 85,
        "score": 42,
        "has_shield": true,
        "cards": ["HEAL", "FREEZE_TILE"]
      }
    ],
    "last_move": {
      "word": "BATTLE",
      "score": 28,
      "player_name": "Champion"
    }
  }
}
```

---

## 🧪 Testing

Run comprehensive automated backend scenario tests:

```bash
cd backend
pytest tests/ -v
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<div align="center">
  <sub>Built with ❤️ by Cell1991 for competitive word puzzle and strategy enthusiasts.</sub>
</div>
