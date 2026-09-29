<div align="center">

# ⚔️ CROSSWORD BATTLE ARENA
### Real-Time Multiplayer Word Combat & Power Card Strategy

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS%204-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

<br/>

**A next-generation real-time multiplayer Crossword game blending competitive Scrabble strategy with RPG health combat, tactical Power Cards, and a high-performance 60 FPS Canvas rendering engine.**

<br/>

[🌟 Overview](#-system-overview) • [🎮 Game Modes](#-game-modes) • [⚡ Power Cards](#-power-card-arsenal) • [🏗️ Architecture](#-system-architecture) • [🚀 Quick Start](#-quick-start--installation) • [📂 Project Structure](#-project-structure) • [📡 API & WebSockets](#-api--websocket-specification)

---

</div>

<br/>

## 🌟 System Overview

Crossword Battle Arena transforms traditional word puzzle mechanics into an intense, competitive battle. Players place letters on a classic $15 \times 15$ grid governed by the official **CSW24 Lexicon**, where every scored point directly deals damage to opponents or builds towards tournament victory.

<br/>

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>⚔️ Dynamic Combat & Health Engine</h3>
      <p>Transform standard word scores into lethal combat power. Manage your HP pool, activate defensive barrier shields, and time your heals to survive fierce opponent onslaughts.</p>
    </td>
    <td width="50%" valign="top">
      <h3>🎨 60 FPS HTML5 Canvas Engine</h3>
      <p>Custom multi-layer 2D canvas pipeline featuring sub-zero frost mists, crystalline tile fracture shaders, responsive panning, pinch-to-zoom camera physics, and tactical targeting reticles.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>⚡ Sub-50ms WebSocket Sync</h3>
      <p>High-throughput real-time state synchronization ensuring instant turn transitions, synchronized clocks, live tile drafting, and spectator broadcast streams.</p>
    </td>
    <td width="50%" valign="top">
      <h3>📖 Tournament CSW24 Lexicon</h3>
      <p>High-speed in-memory DAWG/Trie structure for instant validation of orthogonal words, letter multipliers (<code>2L</code>, <code>3L</code>, <code>2W</code>, <code>3W</code>), and 50-point Bingo rack dumps.</p>
    </td>
  </tr>
</table>

---

## 🎮 Game Modes

Choose between high-stakes elimination battles or classic competitive scoring formats:

| Mode | Win Condition | Core Mechanics & Scoring Flow |
| :--- | :--- | :--- |
| **⚔️ HP Deathmatch** | Last Player Standing | Players start with **100 HP**. Valid word scores deal direct HP damage to opponents. Players can mitigate damage with `SHIELD` or regenerate life with `HEAL`. When HP reaches 0, the player is eliminated. |
| **🏆 Turn Score Mode** | Highest Total Score | Traditional tournament rules across fixed rounds ($10, 15, 20$ turns). Players compete for maximum cumulative points through strategic multiplier usage and Bingo placements. |

---

## ⚡ Power Card Arsenal

Players collect and unleash game-changing tactical cards to disrupt opponent boards, steal tiles, or protect their own health:

| Card | Theme | Type | Tactical Effect |
| :---: | :---: | :---: | :--- |
| <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/heart.svg" width="20" height="20" alt="Heal" /> **Heal** | `Rose / Pink` | Instant Self | Restores player HP based on current rack tile values (with safety confirm dialog). |
| <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/shield.svg" width="20" height="20" alt="Shield" /> **Shield** | `Cyan / Blue` | Proactive Aura | Grants a radiant energy barrier around the HP bar that completely negates the next incoming attack. |
| <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/snowflake.svg" width="20" height="20" alt="Freeze" /> **Freeze Word** | `Sky / Frost` | Board Targeted | Locks an opponent's placed tile under sub-zero ice mist for 1 round, preventing plays through that cell. |
| <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/flame.svg" width="20" height="20" alt="Clear" /> **Clear Word** | `Orange / Red` | Board Targeted | Permanently vaporizes a target tile from the board, opening up new paths or breaking word connections. |
| <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/eye.svg" width="20" height="20" alt="Spell Word" /> **Spell Word** | `Amber / Gold` | AI Assistant | Analyzes the current rack and board state to suggest the highest-scoring valid word placement. |
| <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/arrow-left-right.svg" width="20" height="20" alt="Swap Word" /> **Swap Word** | `Emerald / Teal` | Targeted PvP | Forces an exchange of up to 3 tiles with a targeted opponent's hidden rack. |
| <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/zap.svg" width="20" height="20" alt="Word x2" /> **Word ×2** | `Purple / Neo` | Next Move | Applies a $2\times$ multiplier to the damage or points generated on your next played word. |

---

## 🏗️ System Architecture

The application is structured into clean, modular tiers ensuring predictable state flow, high concurrency, and minimal latency:

```mermaid
flowchart TD
    %% Client Tier
    subgraph Client["🖥️ Frontend Client (Next.js 16 + React 19)"]
        UI["Game UI & React Hooks"]
        Canvas["HTML5 Canvas 2D Engine (60 FPS)"]
        WSClient["WebSocket Client Manager"]
        UI --- Canvas
        UI --- WSClient
    end

    %% Gateway Tier
    subgraph Gateway["🌐 Ingress & Gateway Layer"]
        Nginx["Nginx Reverse Proxy (:8080)"]
        Ngrok["Ngrok Public Tunnel (:4040)"]
        Ngrok --> Nginx
    end

    %% Backend Tier
    subgraph Backend["⚙️ Backend Services (FastAPI + Python 3.12)"]
        Router["REST & WebSocket API Endpoints"]
        GameEngine["Game & Turn State Machine"]
        Lexicon["CSW24 Lexicon & Placement Validator"]
        CardService["Power Card Resolution Engine"]
        WSHub["WebSocket Connection Manager"]
        
        Router --> GameEngine
        Router --> WSHub
        GameEngine --> Lexicon
        GameEngine --> CardService
        GameEngine --> WSHub
    end

    %% Data Tier
    subgraph Database["🗄️ Persistence Layer"]
        PG[("PostgreSQL 16 Engine")]
    end

    %% Network Interconnections
    WSClient <==>|WSS Protocol| Nginx
    UI <==>|HTTPS REST| Nginx
    Nginx <==> Router
    GameEngine <==>|Async SQLAlchemy| PG

    %% Visual Styling
    classDef clientStyle fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef gatewayStyle fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#f8fafc;
    classDef backendStyle fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#f8fafc;
    classDef dbStyle fill:#311042,stroke:#c084fc,stroke-width:2px,color:#f8fafc;

    class Client,UI,Canvas,WSClient clientStyle;
    class Gateway,Nginx,Ngrok gatewayStyle;
    class Backend,Router,GameEngine,Lexicon,CardService,WSHub backendStyle;
    class Database,PG dbStyle;
```

<br/>

### 🔄 Real-Time Turn & Move Execution Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor P1 as 👤 Player 1 (Active)
    participant Canvas as 🎨 Canvas & UI
    participant WS as ⚡ WebSocket Hub
    participant Engine as ⚙️ Backend Engine
    participant DB as 🗄️ PostgreSQL
    actor P2 as 👤 Player 2 (Opponent)

    P1->>Canvas: Drag & stage tiles on 15x15 board
    Canvas->>Engine: POST /api/moves/validate (Draft Check)
    Engine-->>Canvas: Return valid status + Estimated score
    P1->>Canvas: Click [Confirm Move]
    Canvas->>Engine: POST /api/moves/commit
    
    activate Engine
    Engine->>Engine: 1. Validate full orthogonal connectivity
    Engine->>Engine: 2. Check CSW24 lexicon words
    Engine->>Engine: 3. Calculate 2L, 3L, 2W, 3W & Bingo bonus
    Engine->>Engine: 4. Check Shield absorption / Apply HP damage
    Engine->>DB: Persist updated board state, player HP & racks
    Engine->>WS: Dispatch EventType.GAME_STATE_SYNC
    deactivate Engine

    WS-->>P1: Synchronize rack & trigger victory score FX
    WS-->>P2: Animate opponent placement, update HP & start turn clock
```

---

## 📂 Project Structure

```
crossword-game/
├── backend/                        # FastAPI Python 3.12 Backend
│   ├── app/
│   │   ├── api/                    # REST API Endpoints
│   │   │   ├── cards.py            # Power card activation & targeting logic
│   │   │   ├── games.py            # Match creation, state query & lifecycle
│   │   │   ├── moves.py            # Word placement, validation & turn commit
│   │   │   └── rooms.py            # Lobby management & player seat assignment
│   │   ├── database/               # Async SQLAlchemy models & connection pool
│   │   ├── game/                   # Pure Scrabble logic & word algorithms
│   │   │   ├── dictionary.py       # CSW24 fast lookup & DAWG dictionary
│   │   │   ├── extractor.py        # 2D Orthogonal word extraction
│   │   │   ├── rules.py            # Placement legality & connectivity rules
│   │   │   └── scoring.py          # Word score multipliers & Bingo calculation
│   │   ├── services/               # Core business services (turn, room, card)
│   │   └── websocket/              # Real-time connection manager & handlers
│   ├── data/
│   │   └── CSW24.txt               # Collins Scrabble Words (CSW24) dictionary
│   └── tests/                      # Pytest automated test scenarios
│
├── frontend/                       # Next.js 16 + React 19 Frontend
│   ├── app/
│   │   ├── game/[gameId]/          # Real-time game battlefield & HUD
│   │   ├── lobby/[pin]/            # Room matchmaking & seat lobby
│   │   └── page.tsx                # Landing page & room creation
│   ├── components/
│   │   ├── board/                  # HTML5 Canvas 2D Game Board Engine
│   │   │   ├── BoardCanvas.tsx     # Pointer hit-testing & viewport camera
│   │   │   └── engine/             # Multi-layer canvas shaders & FX
│   │   ├── game/                   # PowerCardBar, RightSidebar, TurnTimer, HUD
│   │   └── rack/                   # TileRack, Drag-Drop floating tile ghost
│   ├── hooks/                      # Custom hooks (useGameSync, useBoardCamera)
│   └── lib/                        # API client, TypeScript definitions & theme
│
├── gateway/                        # Nginx reverse proxy configuration
├── docker-compose.yml              # Complete 5-container service orchestration
└── README.md
```

---

## 🚀 Quick Start & Installation

### Option 1: 🐳 One-Click Docker Setup (Recommended)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Cell1991/crossword-game.git
   cd crossword-game
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

3. **Launch all services**:
   ```bash
   docker compose up --build
   ```

4. **Access the application**:
   - 🌐 **Web Client**: [http://localhost:3000](http://localhost:3000) *(or via Gateway at [http://localhost:8090](http://localhost:8090))*
   - 🔌 **API Documentation (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - 🚇 **Ngrok Web Console**: [http://localhost:4040](http://localhost:4040)

---

### Option 2: 🛠️ Manual Local Development

<details>
<summary><b>Click to expand manual setup instructions</b></summary>

#### 1. Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

</details>

---

## 📡 API & WebSocket Specification

### 🌐 Key REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/rooms` | Create a new multiplayer lobby with custom game mode (HP / Turn) |
| `POST` | `/api/rooms/join` | Join an existing room lobby using a 6-digit Room PIN |
| `POST` | `/api/rooms/{pin}/start` | Host triggers match start, generating initial board and player racks |
| `POST` | `/api/moves/validate` | Check candidate tile placements without committing turn |
| `POST` | `/api/moves/commit` | Commit a word move, apply card effects, and compute scores/damage |
| `POST` | `/api/moves/exchange` | Exchange selected tiles with the tile bag (consumes turn) |
| `POST` | `/api/moves/pass` | Pass current turn to the next player |
| `POST` | `/api/cards/{gameId}/use` | Execute targeted or instant power card effects |

---

## 🧪 Testing

Execute full automated backend test suites covering game scenarios, card interactions, and move validation:

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
