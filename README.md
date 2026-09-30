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

<table>
  <tr>
    <td align="center" width="25%">
      <a href="#-system-overview">
        <b>🌟 Overview</b><br/>
        <sub>Core Engine & Highlights</sub>
      </a>
    </td>
    <td align="center" width="25%">
      <a href="#-game-modes">
        <b>🎮 Game Modes</b><br/>
        <sub>HP Deathmatch vs Turn Score</sub>
      </a>
    </td>
    <td align="center" width="25%">
      <a href="#-power-card-arsenal">
        <b>⚡ Power Cards</b><br/>
        <sub>7 Tactical Cards & Effects</sub>
      </a>
    </td>
    <td align="center" width="25%">
      <a href="#-system-architecture">
        <b>🏗️ Architecture</b><br/>
        <sub>Tier Diagram & Move Sequence</sub>
      </a>
    </td>
  </tr>
  <tr>
    <td align="center" width="25%">
      <a href="#-project-structure">
        <b>📂 Project Structure</b><br/>
        <sub>Full Directory Tree</sub>
      </a>
    </td>
    <td align="center" width="25%">
      <a href="#-quick-start--installation">
        <b>🚀 Quick Start</b><br/>
        <sub>Docker & Local Setup</sub>
      </a>
    </td>
    <td align="center" width="25%">
      <a href="#-api--websocket-specification">
        <b>📡 API & WebSockets</b><br/>
        <sub>REST Endpoints & Events</sub>
      </a>
    </td>
    <td align="center" width="25%">
      <a href="#-testing">
        <b>🧪 Testing</b><br/>
        <sub>Automated Pytest Suites</sub>
      </a>
    </td>
  </tr>
</table>

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

| Card | Theme Color | Type | Tactical Effect |
| :--- | :--- | :--- | :--- |
| 💖 **Heal** | `Rose / Pink` | Instant Self | Restores player HP based on current rack tile values (with safety confirm dialog). |
| 🛡️ **Shield** | `Cyan / Blue` | Proactive Aura | Grants a radiant energy barrier around the HP bar that completely negates the next incoming attack. |
| ❄️ **Freeze Word** | `Sky / Frost` | Board Targeted | Locks an opponent's placed tile under sub-zero ice mist for 1 round, preventing plays through that cell. |
| 💥 **Clear Word** | `Orange / Red` | Board Targeted | Permanently vaporizes a target tile from the board, opening up new paths or breaking word connections. |
| 👁️ **Spell Word** | `Amber / Gold` | AI Assistant | Analyzes the current rack and board state to suggest the highest-scoring valid word placement. |
| 🔄 **Swap Word** | `Emerald / Teal` | Targeted PvP | Forces an exchange of up to 3 tiles with a targeted opponent's hidden rack. |
| ⚡ **Word ×2** | `Purple / Neo` | Next Move | Applies a $2\times$ multiplier to the damage or points generated on your next played word. |

---

## 🏗️ System Architecture

The application is structured into clean, modular tiers ensuring predictable state flow, high concurrency, and minimal latency:

```mermaid
graph TB
    %% Actors
    User(["👤 Player / Spectator<br/>[Web / Mobile Browser]"])

    %% Subgraphs
    subgraph Client["🖥️ Client Layer (Frontend)"]
        UI["<b>Web Application</b><br/>[Next.js 16 + React 19]"]
        Canvas["<b>Board Canvas Engine</b><br/>[HTML5 Canvas 2D / 60 FPS]"]
        WSClient["<b>Real-Time Client</b><br/>[WebSocket API]"]
    end

    subgraph Gateway["🌐 Ingress & Gateway Tier"]
        Ngrok["<b>Public Tunnel</b><br/>[Ngrok Container :4040]"]
        Nginx["<b>Reverse Proxy & SSL</b><br/>[Nginx 1.27 :8080]"]
    end

    subgraph Backend["⚙️ Application Backend Tier"]
        API["<b>API Gateway & WS Router</b><br/>[FastAPI / Python 3.12]"]
        GameEngine["<b>Game & Turn State Engine</b><br/>[Async Event Loop]"]
        CardService["<b>Power Card Resolution Engine</b><br/>[Rules & Effect Processor]"]
        Validator["<b>CSW24 Placement Validator</b><br/>[DAWG / Orthogonal Trie]"]
        WSHub["<b>Connection Broadcast Hub</b><br/>[WebSocket Channel Manager]"]
    end

    subgraph Data["🗄️ Persistence & Storage Tier"]
        DB[("<b>Primary Database</b><br/>[PostgreSQL 16 Engine]")]
        Lexicon[("<b>Tournament Lexicon</b><br/>[CSW24 Wordlist File]")]
    end

    %% Flow Relationships
    User -->|Interacts with UI| UI
    UI -->|Render Board / FX| Canvas
    UI -->|Manage Socket Session| WSClient

    User -.->|Public HTTPS / WSS| Ngrok
    Ngrok -->|Proxy Pass :8080| Nginx
    WSClient ===>|WSS Protocol| Nginx
    UI ===>|HTTPS REST API| Nginx

    Nginx -->|Route Requests :8000| API
    API -->|Dispatch Move & Turns| GameEngine
    API -->|Handle WS Connections| WSHub

    GameEngine -->|Process Card Triggers| CardService
    GameEngine -->|Validate Words & Scores| Validator
    Validator -->|In-Memory Lookup| Lexicon

    GameEngine -->|Broadcast State Sync| WSHub
    WSHub -.->|Push Real-Time Events| WSClient

    GameEngine ===>|Async ORM / asyncpg| DB

    %% Clean Minimalist Styling Scheme
    classDef actorStyle fill:#e0e7ff,stroke:#6366f1,stroke-width:2px,color:#1e1b4b;
    classDef clientStyle fill:#e0f2fe,stroke:#0284c7,stroke-width:1.5px,color:#0c4a6e;
    classDef gatewayStyle fill:#fef3c7,stroke:#d97706,stroke-width:1.5px,color:#78350f;
    classDef backendStyle fill:#dcfce7,stroke:#16a34a,stroke-width:1.5px,color:#14532d;
    classDef dataStyle fill:#f3e8ff,stroke:#9333ea,stroke-width:1.5px,color:#581c87;

    class User actorStyle;
    class UI,Canvas,WSClient clientStyle;
    class Ngrok,Nginx gatewayStyle;
    class API,GameEngine,CardService,Validator,WSHub backendStyle;
    class DB,Lexicon dataStyle;
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

## 👥 Contributors & Team Members

<div align="center">

<table>
  <tr>
    <td align="center" width="20%">
      <a href="https://github.com/Cell1991">
        <img src="https://github.com/Cell1991.png" width="90px;" alt="Cell1991" style="border-radius: 50%;" /><br />
        <sub><b>Cell1991</b></sub>
      </a>
      <br />
      <sub>Chu</sub>
    </td>
    <td align="center" width="20%">
      <a href="https://github.com/friend47">
        <img src="https://github.com/friend47.png" width="90px;" alt="friend47" style="border-radius: 50%;" /><br />
        <sub><b>friend47</b></sub>
      </a>
      <br />
      <sub>Peerapatr</sub>
    </td>
    <td align="center" width="20%">
      <a href="https://github.com/waiwaix43">
        <img src="https://github.com/waiwaix43.png" width="90px;" alt="waiwaix43" style="border-radius: 50%;" /><br />
        <sub><b>waiwaix43</b></sub>
      </a>
      <br />
      <sub>Natthaset</sub>
    </td>
    <td align="center" width="20%">
      <a href="https://github.com/Rednoselittledog">
        <img src="https://github.com/Rednoselittledog.png" width="90px;" alt="Rednoselittledog" style="border-radius: 50%;" /><br />
        <sub><b>Rednoselittledog</b></sub>
      </a>
      <br />
      <sub>Kanin Noisiri</sub>
    </td>
    <td align="center" width="20%">
      <a href="https://github.com/ReFresh-bit">
        <img src="https://github.com/ReFresh-bit.png" width="90px;" alt="ReFresh-bit" style="border-radius: 50%;" /><br />
        <sub><b>ReFresh-bit</b></sub>
      </a>
      <br />
      <sub>Freshy</sub>
    </td>
  </tr>
</table>

</div>

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<div align="center">
  <sub>Built with ❤️ by the development team for competitive word puzzle and strategy enthusiasts.</sub>
</div>

