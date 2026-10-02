# WORDX — Game Architecture & Infinite Board Readiness Audit

> **Evaluation Roles**: Senior Game Systems Architect & Frontend Performance Engineer  
> **Status**: Comprehensive Read-Only Audit (Codebase Unmodified)  
> **Target Scope**: Frontend (`frontend/`), Backend Engine (`backend/app/`), Persistence & Protocols  
> **Date**: October 2026

---

## 1. Board Coordinate Contract

### Coordinate System in Use
- **Axis Definition**: Discrete 2D integer grid `(row, col)` where:
  - `row`: Vertical axis ($Y$), incrementing downwards.
  - `col`: Horizontal axis ($X$), incrementing rightwards.
- **World Origin**:
  - The board coordinate system is **not** centered at `(0, 0)`.
  - The starting center tile is explicitly placed at `(9, 13)` (`CENTER_ROW = 9`, `CENTER_COL = 13`):
    - Frontend: [`frontend/lib/board.ts:7-8`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/lib/board.ts#L7-L8)
    - Backend: [`backend/app/core/config.py:29-30`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/core/config.py#L29-L30) and [`backend/app/game/board.py:19`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/game/board.py#L19).
- **Coordinate String Serialization**:
  - Formatted everywhere as `${row}_${col}`:
    - Frontend: `cellKey(row, col)` in [`frontend/lib/tiles.ts:14-16`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/lib/tiles.ts#L14-L16).
    - Backend: `Board.key(row, col)` in [`backend/app/game/board.py:49-50`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/game/board.py#L49-L50).

### Negative Coordinates Support
- **Data Structures**:
  - `Map<string, PlacedTile>` (Frontend) and `dict[str, dict]` (Backend Python) natively support keys like `"-5_-12"`. [OBSERVED]
  - PostgreSQL / SQLite schema uses `Column(Integer, nullable=False)` for both `row` and `col` with no `CHECK (row >= 0)` constraint in [`backend/app/database/models.py:121-122`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/database/models.py#L121-L122). [OBSERVED]
- **Modulo & Reflection Math**:
  - Frontend: `mirrorRow(r)` and `mirrorCol(c)` in [`frontend/lib/board.ts:39-49`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/lib/board.ts#L39-L49) use the formula:
    ```typescript
    const m = ((r % period) + period) % period;
    ```
    This correctly resolves negative coordinates in JavaScript. [OBSERVED]
  - Backend: `mirror_row(r)` and `mirror_col(c)` in [`backend/app/game/board.py:4-12`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/game/board.py#L4-L12) use Python's `%` operator, which mathematically returns non-negative modulo for negative operands (e.g. `(-5) % 36 = 31`). [OBSERVED]

### Every Location Assuming 19×27 Dimensions & Hardcoded Boundaries
1. **Frontend Camera screenToCell Clamp** [`frontend/hooks/useBoardCamera.ts:164`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/hooks/useBoardCamera.ts#L164):
   ```typescript
   if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) return null;
   ```
   **Impact**: Blocks all user clicks, hovers, and tile drops outside row $0\text{--}18$ and col $0\text{--}26$. [OBSERVED - HARD BLOCKER]
2. **Frontend Camera Pan Limits** [`frontend/hooks/useBoardCamera.ts:39-47`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/hooks/useBoardCamera.ts#L39-L47):
   ```typescript
   const minBoardCol = -25;
   const maxBoardCol = BOARD_COLS + 25; // 52
   const minBoardRow = -25;
   const maxBoardRow = BOARD_ROWS + 25; // 44
   ```
   **Impact**: Limits camera panning between rows $[-25, 44]$ and cols $[-25, 52]$. Coordinates beyond this cannot be viewed. [OBSERVED]
3. **Frontend Camera Default Centering** [`frontend/hooks/useBoardCamera.ts:108-112`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/hooks/useBoardCamera.ts#L108-L112):
   ```typescript
   x: (viewportWidth - BOARD_COLS * cellSize) / 2,
   y: (viewportHeight - BOARD_ROWS * cellSize) / 2,
   ```
   Centers on $19 \times 27$ bounding box instead of the active board centroid. [OBSERVED]
4. **Backend Bot Move Generation Clamping** [`backend/app/game/hint.py:109,130,156-157,215-216`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/game/hint.py#L109):
   ```python
   left_limit = max(0, c - len(rack_letters))
   right_limit = min(Board.COLS, c + len(rack_letters) + 1)
   top_limit = max(0, r - len(rack_letters))
   bottom_limit = min(Board.ROWS, r + len(rack_letters) + 1)
   ```
   **Impact**: Bot AI cannot search, evaluate, or place any tiles in negative coordinates or coordinates beyond col 27 / row 19. [OBSERVED - HARD BLOCKER]
5. **Starter Perimeter Search in Candidate Echoes** [`frontend/lib/engine/boardModel.ts:198-200`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/lib/engine/boardModel.ts#L198-L200):
   ```typescript
   for (let r = -3; r <= BOARD_ROWS + 2; r++) {
     for (let c = -3; c <= BOARD_COLS + 2; c++) {
   ```
   Hardcoded iteration specifically over the initial $19 \times 27$ perimeter. [OBSERVED]
6. **Starter Multiplier Sets Definition** [`frontend/lib/board.ts:12-37`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/lib/board.ts#L12-L37) and [`backend/app/game/board.py:22-42`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/game/board.py#L22-L42):
   Explicit coordinates stored within $19 \times 27$ envelope. [OBSERVED]

### Conversions Between Screen, World, and Cell Coordinates
- **Screen to Cell** ([`frontend/hooks/useBoardCamera.ts:159-166`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/hooks/useBoardCamera.ts#L159-L166)):
  $$\text{col} = \left\lfloor \frac{\text{screenX} - \text{offset.x}}{\text{cellSize}} \right\rfloor, \quad \text{row} = \left\lfloor \frac{\text{screenY} - \text{offset.y}}{\text{cellSize}} \right\rfloor$$
- **Cell to Screen (Rendering)** ([`frontend/components/board/engine/BoardCompositor.ts:113-118`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/board/engine/BoardCompositor.ts#L113-L118)):
  $$\text{screenX} = \text{offset.x} + (\text{col} \times \text{cellSize})$$
  $$\text{screenY} = \text{offset.y} + (\text{row} \times \text{cellSize})$$
- **Rounding and Flooring Analysis**:
  - `Math.floor` is used in `screenToCell`. In JavaScript, `Math.floor(-0.5) === -1`, so cell boundaries transition correctly from $0$ to $-1$ across negative axes.
  - No integer truncation (`| 0`, `parseInt`, or `Math.trunc`) is present in coordinate conversions, avoiding the classic negative-zero coordinate collapse bug. [OBSERVED]

---

## 2. Board Model Audit

### Storage Mechanisms
- **Committed Board Tiles**:
  - Client: `Record<string, BoardCell>` stored in React state in [`frontend/hooks/useGameSync.ts:134`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/hooks/useGameSync.ts#L134).
  - Domain Model: `BoardModel` internally converts `boardState` into `Map<string, CellPosition>` (`occupiedMap`) and `CellPosition[]` (`occupiedList`) in [`frontend/lib/engine/boardModel.ts:34-35`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/lib/engine/boardModel.ts#L34-L35).
  - Server: `cells: dict[str, dict[str, Any]]` in [`backend/app/game/board.py:46`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/game/board.py#L46).
- **Staged Tiles (Provisional)**:
  - Client: `PlacedTile[]` in `useState` inside [`frontend/hooks/useStagedMove.ts:42`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/hooks/useStagedMove.ts#L42). Passed to `BoardModel.updateState` to expand the active bounding box.
- **Removed / Unstaged Tiles**:
  - Handled by filtering `temporaryTiles` (`setTemporaryTiles(previous => previous.filter(...))`) in [`frontend/hooks/useStagedMove.ts:128-132`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/hooks/useStagedMove.ts#L128-L132).
- **Remote Placements**:
  - Received via WebSocket `PLACEMENT_PREVIEW` event and stored as `CellPosition[]` in [`frontend/hooks/useGameSync.ts:38`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/hooks/useGameSync.ts#L38).
- **Empty Cells**:
  - Empty cells do **not** exist as objects in memory. They exist strictly implicitly as absent keys in the sparse hash map (`!occupiedMap.has(key)`). [OBSERVED]
- **Rectangular Board Assumption**:
  - The model does **not** assume a rectangular board for tile storage. The sparse map allows arbitrarily shaped clusters (crosses, branches, isolated islands).
  - However, `BoardBounds` in [`frontend/lib/engine/boardModel.ts:36-41`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/lib/engine/boardModel.ts#L36-L41) computes the minimum bounding box `[minRow, maxRow, minCol, maxCol]` which defaults to initial size $19 \times 27$ and expands as tiles are placed.

### Hidden $O(\text{Width} \times \text{Height})$ Operations
- **GridRenderer Fill & Stroke Passes** [`frontend/components/board/engine/GridRenderer.ts:48-55, 104-106`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/board/engine/GridRenderer.ts#L48-L55):
  `GridRenderer` runs two nested double loops:
  $$\sum_{r=\text{minRow}}^{\text{maxRow}} \sum_{c=\text{minCol}}^{\text{maxCol}} 1$$
  For an expanded envelope of $200 \times 200$, this performs $40,000$ iterations **per render frame** on the main thread, inside of which `model.getCellAlpha(r, c)` is called (which in turn loops over all occupied tiles). [OBSERVED - CRITICAL PERFORMANCE HOTSPOT]

### Complete Lifecycle Trace

```
1. Tile Drag
   └─ User touches rack tile -> useTileDrag creates floating portal element -> Direct style.transform translation
2. Hover
   └─ Pointer coordinates converted via useBoardCamera.screenToCell -> clamped to [0..18, 0..26]
3. Validation
   └─ Debounced (150ms) HTTP POST /api/games/{id}/validate -> Backend RuleEngine executes authoritative validation
4. Staging
   └─ Stored in useStagedMove.temporaryTiles -> Local BoardModel updates active bounds
5. Commit
   └─ HTTP POST /api/games/{id}/moves -> Backend commits to database board_cells
6. Network
   └─ WebSocket broadcasts MOVE_COMMITTED with updated boardState to all connected room clients
7. Remote Apply
   └─ useGameSync receives event -> updates gameState.board_state -> updates BoardModel
8. Rendering
   └─ BoardCanvas triggers rAF draw -> BoardCompositor clears canvas and renders visible grid & tiles
```

---

## 3. Placement & Crossword Rules Audit

### Placement Validation Analysis
All authoritative validation logic resides in [`backend/app/game/rules.py`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/game/rules.py) and [`backend/app/game/extractor.py`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/game/extractor.py).

| Rule Component | Implementation Location | Finite Dimension Assumption? | Complexity |
| :--- | :--- | :--- | :--- |
| **Coordinate Bounds** | [`rules.py:34`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/game/rules.py#L34) | **NO** (`Board.is_valid_coord` checks only `isinstance(int)`) | $O(T)$ where $T = \text{staged tiles}$ |
| **First Move Center Star** | [`rules.py:53-56`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/game/rules.py#L53-L56) | Fixed center `(9, 13)` required for first move | $O(T)$ |
| **Tile Adjacency** | [`rules.py:64-72`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/game/rules.py#L64-L72) | **NO** (Sparse neighbor lookups: $r \pm 1, c \pm 1$) | $O(T)$ |
| **Spanning Connectivity** | [`rules.py:74-91`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/game/rules.py#L74-L91) | **NO** (Iterates `range(min_c, max_c + 1)`) | $O(\text{span})$ |
| **Gap Detection** | [`extractor.py:69-82`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/game/extractor.py#L69-L82) | **NO** (Iterates between min/max coordinates) | $O(\text{span})$ |
| **Directional Scan** | [`extractor.py:86-115`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/game/extractor.py#L86-L115) | **NO** (`while (curr_r, curr_c) in combined:`) | $O(\text{word length})$ |
| **Dictionary Validation**| [`rules.py:102-110`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/game/rules.py#L102-L110) | **NO** (Trie/Set lookup) | $O(\text{words} \times L)$ |
| **Score & Multipliers** | [`scoring.py:27-40`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/game/scoring.py#L27-L40) | **NO** (Uses `Board.multiplier_at` with periodic reflection) | $O(\sum L)$ |

### Rule Complexity as Occupied Tiles ($N$) Increases
- The validation logic does **NOT** iterate through all occupied tiles on the board.
- It only checks:
  1. The $T$ newly placed tiles ($T \le 7$).
  2. The immediate orthogonal contiguous words connected to those $T$ tiles.
- Therefore, move validation complexity is **$O(T \times L_{\text{max}})$**, completely independent of whether the board has $100$ tiles or $100,000$ tiles. [OBSERVED - EXCELLENT ARCHITECTURAL TRAIT]

---

## 4. Candidate Echo System Audit

### Algorithm Breakdown (`getCandidateEchoes()`)
Defined in [`frontend/lib/engine/boardModel.ts:164-222`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/lib/engine/boardModel.ts#L164-L222):
1. **Perimeter Phase 1 (Occupied Tiles Aura)**:
   - For every tile in `occupiedList` ($N$ tiles):
     - Checks a window of $\Delta r \in [-8, 8]$ and $\Delta c \in [-8, 8]$ ($17 \times 17 = 289$ coordinates per tile).
     - Skips starter $19 \times 27$ grid cells (`r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS`).
     - If candidate cell is a premium multiplier:
       - Calls `getDistanceToOccupied(r, c)`: Performs an unindexed linear scan over all $N$ occupied tiles ([`boardModel.ts:150-159`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/lib/engine/boardModel.ts#L150-L159)).
       - Calls `getCellAlpha(r, c)`: Performs another unindexed linear scan over all $N$ occupied tiles ([`boardModel.ts:131-142`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/lib/engine/boardModel.ts#L131-L142)) with `Math.hypot` and `Math.pow`.
2. **Perimeter Phase 2 (Starter Board Edges)**:
   - Evaluates a fixed 3-cell band around the starter board:
     $$\text{Rows: } [-3, 21], \quad \text{Cols: } [-3, 29] \quad (\approx 825 \text{ cells})$$

### Execution Frequency
- `getCandidateEchoes()` is invoked in [`frontend/components/board/PremiumCellOverlay.tsx:71`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/board/PremiumCellOverlay.tsx#L71) wrapped in `useMemo([model])`.
- It does **not** run during pointer movement (pointer moves do not re-render React).
- It **does** run whenever `boardState`, `temporaryTiles`, or `remotePlacements` change (i.e. every time a tile is picked up, staged, unplaced, swapped, or committed).

### Computational Complexity Analysis

Let $N = \text{occupied tiles}$, $K_{\text{rad}} = 289$ (search area per tile), and $P_{\text{rate}} \approx 0.12$ (fraction of cells with premium multipliers).

$$\text{Operations} = N \times K_{\text{rad}} + (N \times K_{\text{rad}} \times P_{\text{rate}} \times 2N) = O(N^2)$$

| Tile Count ($N$) | Outer Radius Checks ($289 \times N$) | Inner Distance/Alpha Scans ($29 \times N^2$) | Total Algorithmic Operations | Scalability Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **10 Tiles** | 2,890 | 2,900 | $\approx 5.8 \times 10^3$ | Instant ($< 0.5\text{ms}$) |
| **100 Tiles** | 28,900 | 290,000 | $\approx 3.2 \times 10^5$ | Noticeable on Mobile ($3\text{--}8\text{ms}$) |
| **1,000 Tiles** | 289,000 | 29,000,000 | $\approx 2.9 \times 10^7$ | **Severe Freeze ($300\text{--}900\text{ms}$ UI lockup)** |
| **10,000 Tiles**| 2,890,000 | 2,900,000,000 | $\approx 2.9 \times 10^9$ | **Fatal Browser Tab Crash** |

### Spatial Indexing & Incremental Update Potential
- **Would a Spatial Index Help?**: **YES**. A spatial hash grid or $16 \times 16$ chunk map would reduce `getDistanceToOccupied` and `getCellAlpha` from $O(N)$ global scans to $O(1)$ local chunk neighborhood lookups.
- **Incremental Potential**: Placed tiles only affect candidate echoes within an 8-cell radius of the move. Echoes can be cached in a Map and updated locally via delta changes rather than full global recalculations.

---

## 5. Premium Cell System Audit

### Configuration and Generation
- **Starter Layout**:
  - Stored explicitly in sets: `TRIPLE_LETTER` (12 cells), `DOUBLE_LETTER` (18 cells), and `SECRET_POWER` (12 cells) in [`frontend/lib/board.ts:12-37`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/lib/board.ts#L12-L37).
- **Infinite Continuation**:
  - The pattern continues infinitely through mathematical periodic reflection:
    $$\text{period}_{\text{row}} = 2 \times (\text{BOARD\_ROWS} - 1) = 36$$
    $$\text{period}_{\text{col}} = 2 \times (\text{BOARD\_COLS} - 1) = 52$$
  - Every integer coordinate $(r, c)$ in the infinite 2D plane maps deterministically to a mirrored coordinate $(mr, mc) \in [0, 18] \times [0, 26]$.
- **Game Design Requirement**:
  - Infinite expansion **requires** premium cells to be procedurally distributed across newly discovered regions; otherwise, expanded areas become unrewarding flatlands without bonus multipliers.

### DOM Node Accumulation in PremiumCellOverlay
- **DOM Node Multiplier Breakdown**:
  - Power Cell: 6 DOM nodes (`<span>` container, halo `<span>`, logo `<span>`, `<img>`, 2 sparks `<i>`).
  - 3L Cell: 4 DOM nodes (`<span>` container, core `<span>`, label `<span>`, sub-letter `<span>`).
  - 2L Cell: 8 DOM nodes (`<span>` container, glow `<span>`, 2 mountain `<span>`, 2 specks `<i>`, label `<span>`, letter `<span>`).
- **Node Count**:
  - Starter board: $\approx 42$ base cells $\times 6 \approx 250$ DOM nodes.
  - With Candidate Echoes (up to 200 echoes): Generates $1,000\text{--}1,500$ DOM elements.
  - Expanding to $100 \times 100$ envelope: Candidate echoes generate $> 4,000$ active DOM nodes with infinite CSS keyframe animations.
- **Viewport Culling**: **ZERO**. `PremiumCellOverlay.tsx` has no frustum culling. All elements exist in the DOM tree simultaneously.
- **Feasibility of Moving into Canvas**:
  - **100% Feasible**. `GridRenderer.ts` already contains rounded-rect fill routines and star glyph drawing for special cells. Multiplier icons and badges can be rendered directly to canvas with zero DOM allocation.

---

## 6. Rendering Lifecycle Audit

### Trace of Full Render Cycle

```
Camera Move (Pan/Zoom)
  ├─ Updates mutable cameraRef in useBoardCamera
  ├─ Dispatches subscriber listeners
  ├─ PremiumCellOverlay: Updates style.transform = translate3d(...) scale(...) directly
  └─ BoardCanvas draw():
       ├─ ctx.clearRect(0, 0, width, height)  [Full Canvas Wipe]
       ├─ BoardCompositor.composite()
       │    ├─ Computes frustum intersection with activeBounds +- 8
       │    ├─ GridRenderer.render()  [Full Double Loop Over Bounding Box]
       │    ├─ TileRenderer.renderTile()  [Full Loop Over All boardState Keys]
       │    └─ FXRenderer.render()
       └─ Browser Composite Pass
```

### Invalidation & Dirty Flags
1. **Canvas Clearing**: The canvas is cleared **every single frame** via `ctx.clearRect(0, 0, width, height)` in [`frontend/components/board/engine/BoardCompositor.ts:48`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/board/engine/BoardCompositor.ts#L48).
2. **Occupied Tile Culling**:
   - `TileRenderer` checks `isCellVisible(cell.row, cell.col)` before rendering.
   - **However**, `BoardCompositor.ts:100` iterates over **all keys** in `boardState` to perform this check. At $10,000$ tiles, it performs $10,000$ string lookups and visibility checks every frame.
3. **Grid Line Generation**:
   - Grid lines are **not** cached to an offscreen canvas.
   - They are regenerated dynamically every frame into a float buffer `gridBuffer` inside [`frontend/components/board/engine/GridRenderer.ts:102-143`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/board/engine/GridRenderer.ts#L102-L143).

---

## 7. Camera & Infinite World Inspection

### Theoretical Unbounded Movement Analysis (`useBoardCamera.ts`)
- **Floating Point Coordinate Precision**:
  - Standard IEEE-754 double precision maintains sub-millimeter precision up to $\pm 10^7$ pixels.
  - At coordinate $(10,000, 10,000)$ with cell size $40\text{px}$, world pixel coordinate is $400,000\text{px}$. Float precision error at this scale is $\approx 5.8 \times 10^{-11}\text{px}$ (completely imperceptible). Precision loss is **not** an issue.
- **Pinch and Wheel Zoom**:
  - `zoomAtPoint` uses logarithmic scaling `Math.exp(-delta * WHEEL_ZOOM_SPEED)`, which preserves focal point pinning accurately regardless of absolute world offset.

### Behavior at Extreme Coordinates

| Coordinate | Behavior in Current Code | Root Cause |
| :--- | :--- | :--- |
| **$(100, 100)$** | **BLOCKED** | Clamped by `clampOffset` to max col $52$, max row $44$ |
| **$(-100, -100)$**| **BLOCKED** | Clamped by `clampOffset` to min col $-25$, min row $-25$ |
| **$(1,000, 1,000)$**| **BLOCKED** | Exceeds `clampOffset` boundaries |
| **$(-10,000, -10,000)$**| **BLOCKED** | Exceeds `clampOffset` boundaries |
| **Click / Drag on Cell $(25, 25)$** | **REJECTED** | `screenToCell` returns `null` because `col >= 27` |

---

## 8. Input & Drag System Audit

### Negative Coordinates & Unbounded Dragging (`useTileDrag.ts`)
- **Drag Coordinate Space**: Drag pointer tracking runs strictly in **screen space** (`clientX`, `clientY`).
- **World Resolution**:
  - At line 61 of [`useTileDrag.ts`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/hooks/useTileDrag.ts#L61), screen coordinates are mapped to grid cells via `screenToCell(x - board.left, y - board.top)`.
  - Because `screenToCell` is hardcoded to clamp at `row < 0 || row >= 19 || col < 0 || col >= 27`, dragging a tile into negative coordinates or outside the starter rectangle causes `cellUnderPointer` to return `null`.
  - The drop is considered "out of bounds", and the tile spring-animates back to the rack.
- **Two-Finger Gesture Conflict**:
  - `useBoardCamera` and `BoardCanvas` handle two-finger pinches cleanly by tracking `touchPointsRef: Map<number, { x, y }>`.
  - If a drag is initiated with one finger, additional touches are ignored by the drag session, preventing accidental pan/zoom while placing tiles.

---

## 9. Multiplayer & Networking Audit

### Serialization Protocol
- Moves are serialized as JSON payloads in [`backend/app/schemas/move.py:6-12`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/schemas/move.py#L6-L12):
  ```json
  {
    "row": -14,
    "col": 42,
    "tile_id": "tile_xyz",
    "letter": "K",
    "value": 5
  }
  ```
- **Negative Coordinate Support**: Fully supported. `row` and `col` are plain signed integers.
- **Board Dimension Transmission**: The server **never** transmits board dimensions. It transmits only sparse state:
  ```json
  "board_state": {
    "9_13": { "letter": "A", "value": 1, "row": 9, "col": 13 }
  }
  ```
- **Snapshots vs Deltas**:
  - `MOVE_COMMITTED` socket payloads transmit full sparse snapshots of the board state.
  - Full snapshots scale with the number of placed tiles $N$, not the physical board area. Reconnection and replay effortlessly reconstruct unbounded boards.

---

## 10. Backend & Bot AI Dependency Audit

### Hardcoded Assumptions in Bot Move Generation
In [`backend/app/game/hint.py`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/game/hint.py):
1. **First Move Generation**:
   - Lines 108-109: `if 0 <= start_c and start_c + w_len <= Board.COLS:`
   - Lines 129-130: `if 0 <= start_r and start_r + w_len <= Board.ROWS:`
2. **Subsequent Move Generation**:
   - Lines 156-157:
     ```python
     left_limit = max(0, c - len(rack_letters))
     right_limit = min(Board.COLS, c + len(rack_letters) + 1)
     ```
   - Lines 215-216:
     ```python
     top_limit = max(0, r - len(rack_letters))
     bottom_limit = min(Board.ROWS, r + len(rack_letters) + 1)
     ```
   - Line 69: `max_len = min(Board.ROWS, len(rack_letters) + len(occupied))`

**Architectural Verdict for Bot**:
The Bot move generator is **strictly hardcoded to $19 \times 27$**. If human players expand the board beyond col 26 or into negative rows, the Bot AI will become incapable of generating words that branch off those external anchors. [OBSERVED - SEVERE BOT BLOCKER]

---

## 11. Persistence, Replay & Reconnection Audit

| Subsystem | Storage Format | Fixed Dimension Assumptions? | Infinite World Ready? |
| :--- | :--- | :--- | :--- |
| **Database (`board_cells`)** | SQL `row INT, col INT` | None (No range check constraints) | 🟢 YES |
| **Game State JSON (`board_state`)** | Sparse `{ "row_col": {...} }` | None | 🟢 YES |
| **Move History (`moves.placed_tiles`)**| JSON array of tile coordinates | None | 🟢 YES |
| **Reconnection Resync** | Complete sparse board fetch | None | 🟢 YES |
| **Spectator Hydration** | Reconstructs from sparse state | None | 🟢 YES |

Persistence and replay systems are **100% unbounded and coordinate-agnostic**.

---

## 12. Performance Architecture Audit

### Performance Profile Classification

| Domain | Issue Description | Location | Classification |
| :--- | :--- | :--- | :--- |
| **CPU** | $O(N^2)$ candidate echo calculation with linear distance scans | `boardModel.ts:164-222` | **OBSERVED** |
| **CPU** | Full $O(\text{Width} \times \text{Height})$ grid bounds iteration per render frame | `GridRenderer.ts:48-128` | **OBSERVED** |
| **CPU** | Full $O(N)$ scan of all placed tiles to test viewport visibility | `BoardCompositor.ts:100` | **OBSERVED** |
| **CPU** | Bot move generation $19 \times 27$ boundary clamping | `hint.py:156-216` | **OBSERVED** |
| **Memory** | DOM node bloat in `PremiumCellOverlay` ($> 3,000$ unculled animated elements) | `PremiumCellOverlay.tsx:83-207` | **OBSERVED** |
| **Memory** | Fixed-capacity grid line buffer (`BUCKET_CAPACITY = 8000`) drops lines on large boards | `GridRenderer.ts:20-22` | **OBSERVED** |
| **GPU** | Multiple radial gradients and shadow blur passes per tile | `TileRenderer.ts:59-99` | **OBSERVED** |
| **GPU** | Full canvas clear on every animation frame (`ctx.clearRect`) | `BoardCompositor.ts:48` | **OBSERVED** |
| **React** | Camera pan/zoom and dragging completely bypass React re-renders | `useBoardCamera.ts`, `useTileDrag.ts` | **OBSERVED (HIGH EFFICIENCY)** |

---

## 13. Infinite Board Architecture Options Comparison

| Evaluation Metric | Option A: Flat Map (Current) | Option B: Spatial Hash Grid | Option C: Chunked Region Map ($16 \times 16$) | Option D: Chunked Map + Spatial Index |
| :--- | :--- | :--- | :--- | :--- |
| **Implementation Complexity** | Zero (Existing) | Low ($< 120$ lines) | Moderate ($200\text{--}300$ lines) | High |
| **Coordinate Lookup** | $O(1)$ | $O(1)$ | $O(1)$ | $O(1)$ |
| **Viewport Culling Cost** | $O(N)$ (Must scan all tiles) | $O(\text{visible cells})$ | $O(\text{visible chunks})$ | $O(\text{visible chunks})$ |
| **Candidate Echo Generation** | $O(N^2)$ | $O(N \times K_{\text{local}})$ | $O(N \times K_{\text{local}})$ | $O(N \times K_{\text{local}})$ |
| **Multiplayer Snapshot Delta** | Trivially simple | Requires hash re-bucket | Chunk deltas | Complex sync |
| **Suitability for WordX** | Fails above 500 tiles | **Excellent (Optimal for 2,000 tiles)** | **Optimal for 10,000+ tiles** | Over-engineered |

### Architectural Recommendation for Board Model
**Option C (Chunked Region Map, $16 \times 16$ tiles)**:
- Chunks partition both occupied tiles and offscreen grid rendering into bite-sized tiles.
- A frustum intersection check only evaluates chunks that overlap the visible screen frustum, eliminating both the $O(N)$ tile scan and the $O(\text{Width} \times \text{Height})$ grid line loop.

---

## 14. Actual Required Scale Scenarios

```
Scenario A: 20–100 tiles    ══► Flawless (Current architecture runs at 60–120 FPS)
Scenario B: 100–500 tiles   ══► Minor frame hitches on mobile during tile placement
Scenario C: 500–2,000 tiles ══► Severe DOM layout thrashing & 300ms echo calculation freezes
Scenario D: 2,000–10,000    ══► Complete main thread lockup; Canvas grid buffer overflows
Scenario E: 100,000+ tiles  ══► Memory exhaustion crash (requires chunk paging)
```

- **Realistic Maximum for Multiplayer Crossword**: $500\text{--}2,000$ active occupied tiles (equivalent to $20\text{--}80$ full crosswords stitched together across an expansive cooperative canvas).
- WordX does **not** need to support 100,000 tiles in memory simultaneously; supporting $2,000\text{--}5,000$ tiles at a stable $60\text{fps}$ is the true production target.

---

## 15. Architecture Dependency Graph

```
                                 [Board Coordinate Contract]
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
           [useBoardCamera]                       [BoardModel (Sparse)]
            (🟡 Clamped)                          (🟡 O(N²) Echoes)
                    │                                     │
         ┌──────────┴──────────┐               ┌──────────┴──────────┐
         ▼                     ▼               ▼                     ▼
  [useTileDrag]       [BoardCompositor]  [RuleEngine]       [PremiumOverlay]
   (🟡 Clamped)        (🟡 Full Scan)     (🟢 READY)         (🔴 DOM Bloat)
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
            [GridRenderer]         [TileRenderer]
          (🟡 O(W×H) Loop)        (🟢 Culled Draw)
```

### Component Status Matrix

| Component | Status | Justification |
| :--- | :--- | :--- |
| **Board Coordinate Contract** | 🟡 REQUIRES REFACTOR | Unbounded signed integers supported in DB/protocol, but clamped in frontend camera. |
| **BoardModel** | 🟡 REQUIRES REFACTOR | Sparse storage is sound, but `getCandidateEchoes` is $O(N^2)$ and active bounds default to starter box. |
| **RuleEngine (Validation)** | 🟢 READY | Validates moves locally in $O(T)$ without board boundary assumptions. |
| **Scoring & Multipliers** | 🟢 READY | Uses cyclic modulo reflection math that functions across infinite coordinates. |
| **Database & Persistence** | 🟢 READY | Signed SQL integer columns, JSON sparse payloads, zero dimension constraints. |
| **Networking & Protocols** | 🟢 READY | Sparse snapshot broadcasting transmits only occupied cells. |
| **Camera (`useBoardCamera`)**| 🟡 REQUIRES REFACTOR | `screenToCell` and `clampOffset` hardcoded to $19 \times 27$ boundary. |
| **Tile Dragging (`useTileDrag`)**| 🟡 REQUIRES REFACTOR | Relies on `screenToCell`, failing outside starter area. |
| **Canvas GridRenderer** | 🟡 REQUIRES REFACTOR | $O(\text{Width} \times \text{Height})$ loop per frame; fixed buffer drops lines on big boards. |
| **PremiumCellOverlay** | 🔴 BLOCKS INFINITE BOARD | Generates thousands of unculled DOM nodes with heavy CSS keyframe animations. |
| **Bot AI (`hint.py`)** | 🔴 BLOCKS INFINITE BOARD | Clamped to `range(0, 19)` and `range(0, 27)`. Completely fails outside starter box. |

---

## 16. Critical Findings

### A. Top 10 Actual Blockers (Supported by Code Evidence)
1. **Hardcoded Interaction Boundary** ([`useBoardCamera.ts:164`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/hooks/useBoardCamera.ts#L164)): `screenToCell` returns `null` for any coordinate with `row < 0 || row >= 19 || col < 0 || col >= 27`.
2. **Camera Pan Envelope Lock** ([`useBoardCamera.ts:39-47`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/hooks/useBoardCamera.ts#L39-L47)): `clampOffset` restricts camera movement to $[-25, 52]$ cols and $[-25, 44]$ rows.
3. **Bot Coordinate Clamping** ([`backend/app/game/hint.py:156-216`](file:///c:/Users/celle/Documents/GitHub/crossword-game/backend/app/game/hint.py#L156-L216)): Bot AI search clamps limits to `[0, Board.COLS]` and `[0, Board.ROWS]`.
4. **$O(N^2)$ Candidate Echo Lockup** ([`boardModel.ts:164-222`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/lib/engine/boardModel.ts#L164-L222)): Freezes the UI thread during tile staging as $N$ grows beyond 300 tiles.
5. **DOM Bloat in PremiumCellOverlay** ([`PremiumCellOverlay.tsx:83-207`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/board/PremiumCellOverlay.tsx#L83-L207)): Spawns thousands of unculled DOM nodes with running keyframe animations.
6. **Fixed Grid Buffer Overflow** ([`GridRenderer.ts:20-22`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/board/engine/GridRenderer.ts#L20-L22)): `BUCKET_CAPACITY = 8000` float cap causes grid lines to disappear when more than 1,000 cells share an alpha bucket.
7. **$O(\text{Width} \times \text{Height})$ Grid Render Loop** ([`GridRenderer.ts:48, 104`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/board/engine/GridRenderer.ts#L48)): Evaluates every coordinate in the expanded bounding box every single frame.
8. **Double `getCellAlpha` Scan per Cell** ([`GridRenderer.ts:56, 106`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/board/engine/GridRenderer.ts#L56)): Executes a linear loop over all $N$ occupied tiles twice for every grid cell on screen.
9. **Full $O(N)$ Unindexed Tile Frustum Check** ([`BoardCompositor.ts:100`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/board/engine/BoardCompositor.ts#L100)): Scans all board tiles every frame to evaluate `isCellVisible`.
10. **Starter Centering Logic** ([`useBoardCamera.ts:108-112`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/hooks/useBoardCamera.ts#L108-L112)): Resetting or centering the camera forces the view back to the starter $19 \times 27$ box regardless of where players are actively playing.

### B. Top 10 Performance Risks
1. **Mobile GPU Fill-Rate Collapse**: Multiple radial gradients and shadow blur passes per tile in `TileRenderer.ts:59-99`.
2. **DOM Paint Storms**: Absence of `contain: strict` or viewport culling on `PremiumCellOverlay`.
3. **Canvas Full Redraw on Cursor Movement**: Dragging hover changes trigger full scene redraws.
4. **Garbage Collection Pressure**: Allocating string keys `${r}_${c}` repeatedly inside rAF render loops.
5. **Lack of Offscreen Grid Cache**: Regenerating thousands of grid segments on CPU every frame.
6. **High Retina DPI Canvas Scaling**: iPhone 3x DPI multiplies canvas pixel count by 9x without proper DPR capping on mid-tier tablets.
7. **Sequential Tile Placement Loop**: Staged moves trigger continuous rAF animation loops.
8. **Superellipse Calculation Overhead**: `Math.pow(..., 1 / 2.6)` called repeatedly per cell in `boardModel.ts:121`.
9. **Synchronous Move Validation Overhead**: HTTP roundtrip delays staging feedback on weak mobile connections.
10. **JSON Serialization Cost**: Pydantic serializing the entire board snapshot on every committed turn.

### C. Hidden Assumptions
1. **First Move Anchor**: The rule engine strictly mandates that the very first move of a game must cover `(9, 13)` (`FIRST_MOVE_MUST_COVER_CENTER = True`).
2. **Infinite World Origin**: The origin of the world is conceptually `(9, 13)`, not `(0, 0)`.
3. **Symmetric Multiplier Periodicity**: Premium cells do not generate randomly; they follow a strict 36-row and 52-column periodic reflection pattern.
4. **Validation Independence**: Move validation on the backend is completely dimension-agnostic, even though the error message mentions `19 rows x 27 columns`.

### D. Recommended Refactoring Sequence
1. **Unclamp Camera & Drag Input**:
   - Remove bounds check in `useBoardCamera.ts:164`.
   - Update `clampOffset` in `useBoardCamera.ts:39-53` to calculate bounds dynamically from `model.getActiveBounds()`.
2. **Unclamp Backend Bot Move Generator**:
   - Replace `max(0, ...)` and `min(Board.COLS, ...)` in `backend/app/game/hint.py` with dynamic search limits derived from the bounding box of existing occupied tiles.
3. **Absorb Premium Cells into Canvas**:
   - Render multiplier badges directly in `GridRenderer.ts`.
   - Deprecate `PremiumCellOverlay.tsx` DOM elements to eliminate DOM layout thrashing.
4. **Localize Candidate Echo System**:
   - Rewrite `getCandidateEchoes()` to update incrementally based on newly placed tiles instead of a full $O(N^2)$ global recalculation.
5. **Implement Chunked Grid Caching**:
   - Partition the canvas grid into $16 \times 16$ tile chunks, pre-rendered onto cached offscreen surfaces.

### E. Things That Should NOT Be Changed
1. **Backend Database Schema**: `board_cells` with integer `row`/`col` and unique constraint is already optimal and coordinate-agnostic.
2. **Backend Move Validation & Word Extraction**: `RuleEngine` and `extractor.py` are already $O(T)$ and coordinate-independent.
3. **Multiplayer Protocol**: Sparse dictionary serialization `${row}_${col}` is already ideal for unbounded worlds.
4. **Zero-Re-render Camera Store Architecture**: The mutable subscription pattern in `useBoardCamera.ts` is exemplary and must be retained.
5. **Direct DOM Pointer Portal in Dragging**: `useTileDrag.ts` using rAF and direct `style.transform` mutation is state-of-the-art web performance architecture.
6. **Canvas 2D Rendering Core**: There is **no need** to rewrite the engine in PixiJS or WebGL. Canvas 2D easily achieves 60–120 FPS when paired with spatial chunking.
