# Project Overview: Survivors-like / Tower Defense Hybrid
Act as an expert Game Developer specializing in TypeScript, Vite, and the modern Three.js WebGPU API. 
We are building an MVP for a 2.5D game inspired by "Invasion Survivors", but with a hybrid twist: it combines "Bullet Heaven/Vampire Survivors" player combat with "Tower Defense" base-building mechanics.

## Core Gameplay: The Gauntlet Loop
The game operates in a strict "Gauntlet" state machine:
1. **Hub/Upgrade Phase (Out of combat):** The player accesses a skill tree menu. They can spend currency (earned in phases) to buy permanent stat upgrades, unlock new powers, or purchase structures/towers.
2. **Action Phase (Combat/Survival):** The player is dropped into the arena. They can move, use attacks/powers, and actively place towers/structures to defend themselves. 
3. **Escalation:** Waves of enemies spawn and swarm the player. Each phase increases enemy count and strength, making tower placement and strategy mandatory.
4. **Resolution:** If the player eliminates the horde, they win the phase and return to the Hub to upgrade. If the player dies, they return to the Hub to spend retained currency, tweak their skill tree, and try again.

## Technical Architecture & Performance (CRITICAL)
This game must support thousands of simultaneous enemies on screen at 60 FPS. You must strictly adhere to the following constraints:

1. **Tech Stack:** TypeScript, Vite, and Three.js using `WebGPURenderer`.
2. **Zero Garbage Collection in Loop:** NEVER use the `new` keyword inside the main game loop (`requestAnimationFrame`). 
3. **Object Pooling:** Implement a strict Object Pool architecture for Enemies, Projectiles, Damage Numbers, and Towers. Entities must be recycled, never destroyed.
4. **Rendering & Instancing:** 
   - Render all identical enemies using Three.js `InstancedMesh`. Do not create individual meshes for each enemy.
   - **Animation Future-Proofing:** Structure the instancing so that we can eventually use Vertex Animation Textures (VAT) calculated entirely on the GPU using the new TSL (Three.js Shading Language). The CPU should only update the position/rotation matrices, not skeletal bone math.
5. **Collision Detection:** Implement a Spatial Hashing Grid or QuadTree for collisions. A naive `O(n^2)` loop for thousands of entities will crash the browser.
6. **Camera:** Use an `OrthographicCamera` locked at an isometric or top-down angle to create the 2.5D visual style.

## MVP Asset Strategy: Placeholders Only
Focus 100% on the functionality, architecture, and performance. 
Do not use external models (`.glb`, `.gltf`) or sprite sheets yet. Use basic Three.js primitive geometries for everything:
- **Player:** A blue Capsule geometry.
- **Enemies:** Red Box or Tetrahedron geometries (scaled differently for stronger variants).
- **Towers:** Green Cylinder geometries.
- **Projectiles:** Small yellow Sphere geometries.
- **Environment:** A simple flat Plane geometry with a basic grid texture or solid color.

## Step-by-Step Execution Plan
Do not generate the entire game at once. Follow these atomic steps and ask for my approval after each:
1. **Boilerplate & State Machine:** Set up Vite, `WebGPURenderer`, the `OrthographicCamera`, and the basic Gauntlet Loop state machine (Menu <-> Action).
2. **The Pool & Spawner:** Implement the Object Pool and `InstancedMesh` manager. Spawn 1,000 static placeholder enemies to verify performance.
3. **Player Controller:** Add player movement (WASD) and a basic auto-firing projectile system that targets the nearest enemy using the spatial grid.
4. **Tower Defense Mechanics:** Implement the logic for the player to pause/aim and place a placeholder tower that also auto-fires at enemies.
5. **Progression & Upgrades:** Build the basic UI overlay for the Hub phase and wire up one permanent upgrade (e.g., "+10% Player Damage" or "Unlock basic tower").