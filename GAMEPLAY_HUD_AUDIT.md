# WORDX — Gameplay Screen UI/UX & Architecture Audit

> **Target**: Gameplay Screen (`frontend/app/game/[gameId]/page.tsx` and related components)  
> **Source Evidence**: User Gameplay Screenshots (`media_1790914327871.png` & `media_1790914334476.png`)  
> **Purpose**: Technical specification and audit report for AI-assisted frontend redesign and implementation.  
> **Status**: Comprehensive Analysis & Implementation Specification  
> **Date**: October 2026

---

## 1. Executive Summary

Based on direct inspection of the live gameplay UI screenshots and the frontend codebase, the current gameplay layout is functionally sound but exhibits **significant UI/UX layout imbalances, visual fragmentation, and interaction state ambiguities**:

```
+-----------------------------------------------------------------------------------------+
| [TOP BAR] Turn Timer | Turn Banner (• YOUR TURN T13) | Guide | Fullscreen               |
+-------------------------------------------------------------+---------------------------+
|                                                             | [RIGHT SIDEBAR]           |
|                                                             | ┌───────────────────────┐ |
|                                                             | │ 📦 Tiles Remaining: 71│ |
|                                                             | ├───────────────────────┤ |
|                                                             | │ 🏆 SCOREBOARD (1 P)   │ |
|                     GAME BOARD                              | │ 1. C (You) 51 [HP: 5] │ |
|                      (Canvas)                               | ├───────────────────────┤ |
|                                                             | │                       │ |
|                                                             | │  <HUGE BLACK VOID>   │ |
|                                                             | │ (Unused dead space)   │ |
|                                                             | │                       │ |
|                                                             | ├───────────────────────┤ |
|                                                             | │ 🕒 MOVE HISTORY (v)   │ |
|                                                             | │ (Cramped / max-h-64)  │ |
|                                                             | └───────────────────────┘ |
+-------------------------------------------------------------+---------------------------+
| [BOTTOM DOCK]                                                                           |
|                        ✨ POWER CARDS AVAILABLE [ ❤️ Heal ] [ 🛡️ Shield ]               |
|                                                                                         |
|  • GAME MANAGEMENT                [ TILE RACK ]                 • TURN ACTIONS          |
|  ┌─────────────────────┐  ┌───────────────────────────┐  ┌────────────────────────────┐ |
|  │ 🔄 Cancel │ 🔀 │ ⇄  │  │ [O₁] [Q₁₀] [X₈] [K₅] ...  │  │ ▷ Pass   │   ✓ Confirm    │ |
|  └─────────────────────┘  └───────────────────────────┘  └────────────────────────────┘ |
+-----------------------------------------------------------------------------------------+
```

### Primary Critical Issues Identified
1. **The "Sidebar Black Void"**: In 1–2 player matches, the Scoreboard occupies only $\sim 70\text{px}$ of vertical height, but has `flex-1`, pushing Move History to the bottom with an immense empty void between them. Meanwhile, Move History has an arbitrary `max-h-64` clamp that forces an internal scrollbar even when $400\text{px}$ of vertical screen space sits completely empty right above it.
2. **Bottom Dock Horizontal & Vertical Fragmentation**: The bottom control area is fragmented into 4 disjointed visual islands: (1) Floating Power Card bar above, (2) Game Management pod on the left, (3) Tile rack in the center, and (4) Turn actions pod on the right. Each pod has its own redundant mini-label (`• GAME MANAGEMENT`, `• TURN ACTIONS`) with different padding and borders.
3. **Action Button Ambiguity**: The recall button is labeled `Cancel` (or `Recall`), creating user confusion between canceling the placement, canceling the turn, or leaving the match. Furthermore, when no tiles are placed, both `Cancel` and `Confirm` are disabled without clear visual affordances explaining why.
4. **Information Disconnect**: The Turn Status (`YOUR TURN T13`) is isolated in the top-right header, far away from both the Scoreboard and the bottom Action controls where the player's eyes actually rest during active gameplay.

---

## 2. Component & File Mapping

| UI Element / Section | Component Name | Source File | Key Lines |
| :--- | :--- | :--- | :--- |
| **Top Status Header** | `GameHud` | [`frontend/components/game/GameHud.tsx`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/game/GameHud.tsx) | Lines 150–230 |
| **Turn Indicator Badge** | `TurnBanner` | [`frontend/components/game/TurnBanner.tsx`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/game/TurnBanner.tsx) | Lines 19–85 |
| **Right Sidebar Panel** | `RightSidebar` | [`frontend/components/game/RightSidebar.tsx`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/game/RightSidebar.tsx) | Lines 125–430 |
| ├─ Tiles Remaining Card | `RightSidebar` (Top) | [`RightSidebar.tsx`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/game/RightSidebar.tsx#L129-L151) | Lines 129–151 |
| ├─ Player Scoreboard & HP | `RightSidebar` (Middle) | [`RightSidebar.tsx`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/game/RightSidebar.tsx#L153-L327) | Lines 153–327 |
| └─ Move History & Accordion | `RightSidebar` (Bottom) | [`RightSidebar.tsx`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/game/RightSidebar.tsx#L329-L430) | Lines 329–430 |
| **Bottom Control Dock** | `TileRack` | [`frontend/components/rack/TileRack.tsx`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/rack/TileRack.tsx) | Lines 350–550 |
| ├─ Power Cards Available | `PowerCardBar` | [`frontend/components/game/PowerCardBar.tsx`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/game/PowerCardBar.tsx) | Lines 559–620 |
| ├─ Left: Game Management | `TileRack` (Left Pod) | [`TileRack.tsx`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/rack/TileRack.tsx#L355-L434) | Lines 355–434 |
| ├─ Center: 7-Tile Rack | `TileRack` (Rack Tray) | [`TileRack.tsx`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/rack/TileRack.tsx#L240-L345) | Lines 240–345 |
| └─ Right: Turn Actions | `TileRack` (Right Pod) | [`TileRack.tsx`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/rack/TileRack.tsx#L440-L550) | Lines 440–550 |
| **Host Gameplay Container** | `GamePage` | [`frontend/app/game/[gameId]/page.tsx`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/app/game/%5BgameId%5D/page.tsx) | Lines 680–820 |

---

## 3. Deep UI/UX & Layout Flaw Analysis

### Flaw 1: The "Black Void" & Inverted Flex in Right Sidebar
- **Visual Evidence**: In `media_1790914327871.png`, below player `1. C (You)`, there is over $300\text{px}$ of completely empty dark space before the Move History header.
- **Root Cause**:
  ```tsx
  // RightSidebar.tsx:154
  <div className="flex-1 flex flex-col min-h-0 p-3 overflow-hidden">
    <div className="flex-1 overflow-y-auto pr-1 space-y-2">
      {sortedPlayers.map(...)}
    </div>
  </div>
  ```
  `flex-1` is applied to the **Scoreboard container**, forcing it to consume all available vertical space even when there is only 1 or 2 players.
  Conversely, Move History at line 347 is constrained by `max-h-64` ($256\text{px}$) with an internal scrollbar:
  ```tsx
  // RightSidebar.tsx:347
  {isHistoryOpen && (
    <div className="p-2.5 pt-0 max-h-64 overflow-y-auto pr-1 space-y-2">
  ```
- **Consequence**: The information that players actually want to consult during a turn (previous words formed, definitions, scores) is cramped and scroll-heavy, while the scoreboard wastes $50\%$ of the screen.

### Flaw 2: Bottom Dock Disjointedness & Floating Visual Noise
- **Visual Evidence**: In `media_1790914334476.png`, the controls are laid out as four independent floating boxes:
  1. The Power Card bar floats loosely above the rack with its own badge `✨ POWER CARDS AVAILABLE`.
  2. The left pod has a cyan dot with `• GAME MANAGEMENT`.
  3. The rack sits in the middle with a blue border.
  4. The right pod has an emerald dot with `• TURN ACTIONS`.
- **Root Cause**: In [`TileRack.tsx:352-364`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/rack/TileRack.tsx#L352-L364), desktop layout uses `lg:contents` and `lg:basis-0` with separate background panels:
  ```tsx
  <div className="lg:bg-slate-900/85 lg:backdrop-blur-xl lg:border lg:border-slate-700/60 lg:rounded-2xl ...">
  ```
- **Consequence**: On desktop displays, the controls look like scattered separate widgets rather than a cohesive **Game Controller / Cockpit Dock**. The spacing between the pods shifts awkwardly across different screen aspect ratios ($16:9$, $16:10$, ultrawide).

### Flaw 3: Recall vs. Cancel Ambiguity & Button States
- **Visual Evidence**: In `media_1790914334476.png`, the leftmost button shows a counter-clockwise arrow with the label `Cancel` (or `Recall`).
- **Interaction Problem**:
  - If a player hasn't placed any tiles on the board, the button is dimmed (`disabled`).
  - When tiles are placed on the board, the button becomes active to take staged tiles back to the rack.
  - The label `Cancel` is misleading: players worry that clicking it will cancel their turn or leave the game.
  - The correct semantic term in Crossword games (Scrabble, Words with Friends) is **"Recall"** or **"Clear"**.

### Flaw 4: Power Cards Visual Hierarchy & Screen Real Estate
- **Visual Evidence**: `Heal` and `Shield` buttons float directly above the tile rack in the board area.
- **Problem**:
  - The cards sit directly inside the board's vertical viewport. When zooming into the bottom cells of the board, the floating card bar obscures the bottom-most board cells.
  - Cards should either dock seamlessly onto the top rim of the rack controller or tuck neatly into a dedicated tactical drawer.

### Flaw 5: Disconnect Between Turn Banner & Action Center
- **Visual Evidence**: The turn indicator `• YOUR TURN T13` is positioned in the upper right header (`GameHud.tsx`), while the player's primary point of interaction is at the bottom center (`TileRack.tsx`).
- **Problem**: When a turn changes or the timer runs low, players must constantly shift eye focus between the top of the monitor and the bottom dock.

---

## 4. Redesign & Refactoring Specifications (For AI / Developer)

### Specification A: Dynamic Auto-Layout Sidebar (Zero Void)

#### 1. Invert Flex Hierarchy in `RightSidebar.tsx`
- Remove `flex-1` from the Scoreboard container. The Scoreboard should **hug its content** (`shrink-0` / `flex-none`).
- Apply `flex-1 min-h-0` to the **Move History section**, allowing it to dynamically expand and fill all remaining vertical space in the sidebar.
- Replace `max-h-64` on Move History with `flex-1 h-full min-h-0 overflow-y-auto`.

```tsx
// BEFORE (Buggy Layout - Scoreboard consumes space):
<div className="flex-1 flex flex-col min-h-0 p-3 overflow-hidden"> {/* Scoreboard */}
...
<div className="border-t border-slate-800/80 bg-slate-900/40">     {/* Move History */}
  <div className="max-h-64 overflow-y-auto">

// AFTER (Optimized Auto-Layout - Move History consumes space):
<div className="shrink-0 flex flex-col p-3 border-b border-slate-800/80"> {/* Scoreboard */}
  {/* Scoreboard fits only as many players as exist (1 to 4) */}
</div>

<div className="flex-1 min-h-0 flex flex-col bg-slate-900/40 overflow-hidden"> {/* Move History */}
  <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
    {/* Move History cards expand comfortably, with dictionary definitions visible without squishing */}
  </div>
</div>
```

#### 2. Sticky Tiles Remaining Indicator
- Keep `Tiles Remaining: 71` anchored at the top of the sidebar with the amber glassmorphism treatment. It acts as the game's clock/bag health bar.

---

### Specification B: Unified Tactical Bottom Cockpit (Integrated Dock)

Instead of 4 disparate floating boxes, wrap the entire bottom dock in a **single cohesive Command Console**:

```
+----------------------------------------------------------------------------------------------------+
|  [✨ CARDS: ❤️ Heal (1) | 🛡️ Shield (1) ] ─────────────────────────────── [ ⏱️ 0:45 | YOUR TURN ]  |
+----------------------------------------------------------------------------------------------------+
|  [ 🔄 Recall ] [ 🔀 Shuffle ] [ ⇄ Swap ]  │  [O₁] [Q₁₀] [X₈] [K₅] [H₄] [D₂] [I₁]  │  [ ▷ Pass ] [ ✓ Play (+24) ] |
+----------------------------------------------------------------------------------------------------+
```

#### 1. Consolidation in `TileRack.tsx`
- Replace the independent background pods with a unified glassmorphism cockpit:
  - Container class: `bg-slate-950/90 backdrop-blur-2xl border border-slate-800/80 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.1)] p-2`
- Remove the repetitive uppercase micro-headers (`• GAME MANAGEMENT` and `• TURN ACTIONS`).
- Place the **Power Card Bar** directly into the console's top utility strip or as an integrated upper deck, so it never obscures canvas board cells.

#### 2. Button Labeling & Visual States
- **Recall Button**:
  - When `temporaryTiles.length === 0`: Label as `Recall` with disabled state (`text-slate-600 bg-slate-800/30 cursor-not-allowed`).
  - When `temporaryTiles.length > 0`: Bright rose glow with badge count: `Recall (${count})`.
- **Shuffle Button**:
  - Maintain amber accent icon (`Shuffle`), active when rack has $\ge 2$ tiles.
- **Swap / Exchange Button**:
  - Sky blue accent (`ArrowLeftRight`), title clarifies: `"Swap tiles with the bag (uses your turn)"`.
- **Confirm / Play Button**:
  - When no tiles staged: Dimmed check icon with label `Play` or `Confirm`.
  - When tiles staged & valid: Pulsing emerald gradient with live score badge: `Play (+${estimatedScore})`.
  - When tiles staged & invalid: Crimson red with label `Invalid Word`.
- **Pass Turn Button**:
  - Clean two-step inline confirmation (`Skip? Yes / No`) to prevent accidental turn losses.

---

### Specification C: Turn Status & Timer Convergence

1. **Mirroring Turn Status at the Bottom**:
   - In addition to the top header in `GameHud.tsx`, render a subtle status bar directly above the Play button in `TileRack.tsx`.
   - When it is the player's turn, display: `YOUR TURN` with an emerald pulse.
   - When an opponent is thinking: `WAITING FOR [PLAYER_NAME]...` with a subtle amber pulse.

---

### Specification D: Responsive Mobile Unification

1. **Mobile Bottom Sheet Alignment**:
   - On mobile screens (`< 1024px`), `RightSidebar` is hidden, and `MobileInfoModal` is used.
   - Apply the same dynamic flex fix to `MobileInfoModal.tsx`:
     - Scoreboard takes natural height (`shrink-0`).
     - Move History takes `flex-1` scrollable area.
2. **Thumb-Zone Optimization**:
   - Ensure all touch targets in the bottom dock have minimum dimensions of $44 \times 44\text{px}$ (`min-h-[44px] min-w-[44px]`).

---

## 5. Implementation Task Checklist (For Subsequent AI Prompt)

When initiating the implementation phase, instruct the AI to execute the following discrete steps:

- [ ] **Task 1: Fix Sidebar Auto-Layout in [`frontend/components/game/RightSidebar.tsx`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/game/RightSidebar.tsx)**
  - Remove `flex-1` from the Scoreboard wrapper (lines 154–170).
  - Add `flex-1 min-h-0 flex flex-col` to the Move History container (lines 330–350).
  - Remove `max-h-64` and allow the Move History inner list to fill available height with `flex-1 overflow-y-auto`.
  - Apply matching fixes to [`frontend/components/game/MobileInfoModal.tsx`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/game/MobileInfoModal.tsx).

- [ ] **Task 2: Refactor Bottom Controls into Unified Console in [`frontend/components/rack/TileRack.tsx`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/rack/TileRack.tsx)**
  - Unify the left pod, center rack, and right pod into a continuous glassmorphism deck.
  - Remove redundant `• GAME MANAGEMENT` and `• TURN ACTIONS` text labels to reduce vertical noise.
  - Standardize button heights to `h-11 sm:h-13` across all three groups.
  - Ensure the "Recall" button is semantically labeled and shows staged tile count.

- [ ] **Task 3: Integrate Power Card Bar into Dock Header in [`frontend/components/game/PowerCardBar.tsx`](file:///c:/Users/celle/Documents/GitHub/crossword-game/frontend/components/game/PowerCardBar.tsx)**
  - Align the power cards directly to the top edge of the tile rack console.
  - Replace the floating card badge with a compact inline pill bar that does not overlap the board canvas.

- [ ] **Task 4: Polish Action Preview & Play Button State**
  - Integrate live score display into the Confirm button: `Play (+${score})`.
  - Animate invalid states with a subtle shake rather than jarring text displacement.
