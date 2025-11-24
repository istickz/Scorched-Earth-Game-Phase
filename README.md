# Scorched Earth Game Clone

Artillery-style tank battle game built with Phaser 3 and TypeScript. A modern remake of the classic Scorched Earth with advanced features including multiplayer, AI opponents, procedural terrain generation, and dynamic environmental effects.

## 🎮 Play Online

The game is deployed on GitHub Pages: [Play Now](https://istickz.github.io/Scorched-Earth-Game-Phaser/)

## 🚀 Local Development

### Prerequisites

- Node.js 20+ 
- npm

### Setup

1. Clone the repository:
```bash
git clone https://github.com/istickz/Scorched-Earth-Game-Phase.git
cd Scorched-Earth-Game-Phase
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

The game will open in your browser at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## 📦 Tech Stack

- **Phaser 3** - Game engine
- **TypeScript** - Type-safe JavaScript with strict mode
- **Vite** - Build tool and dev server
- **Matter.js** - Physics engine (via Phaser, used for tank physics)
- **WebRTC** - P2P multiplayer networking

## 🎯 Core Features

### Game Modes
- **Single Player** - Battle against AI opponents with 3 difficulty levels
- **Local Multiplayer** - Two players on the same device
- **Online Multiplayer** - P2P multiplayer via WebRTC (no server required)
- **Level Editor** - Create and customize your own levels

### Combat System
- **Turn-based gameplay** - Classic artillery-style combat
- **Multiple weapon types**:
  - **Standard** - Basic high-damage projectile
  - **Salvo** - Fires 16 projectiles in a spread pattern
  - **Hazelnut** - Splits into multiple projectiles mid-flight
  - **Bouncing** - Projectile bounces off terrain multiple times
- **Shield system**:
  - **Single-use shield** - Absorbs one hit completely
  - **Multi-use shield** - Absorbs damage up to HP limit
- **Destructible terrain** - Real-time terrain destruction with different explosion shapes
- **Trajectory preview** - Visual prediction of projectile path before firing

### Environment & Atmosphere
- **4 Biomes**: Temperate, Desert, Arctic, Volcanic (each with unique colors and effects)
- **Weather effects**: Rain, Snow (with visual particles)
- **Time of day**: Day and Night modes
- **Seasons**: Summer and Winter
- **Dynamic environment**:
  - Wind (affects projectile trajectory)
  - Variable gravity (biome-dependent)
  - Air density (affects projectile drag)
  - Wind variation (randomized per game)

### Terrain System
- **Procedural generation** - Fractal noise algorithm for unique terrain each game
- **Two terrain shapes**: Hills (smooth) and Mountains (rugged)
- **Configurable height ranges** - Customizable terrain elevation
- **Real-time destruction** - Terrain deforms on impact with different crater shapes

### AI System
- **Adaptive learning algorithm** - AI learns from misses and improves accuracy
- **Three difficulty levels**:
  - **Easy** - Larger deviation, slower learning
  - **Medium** - Balanced difficulty
  - **Hard** - Minimal deviation, fast learning
- **Range narrowing** - Search space narrows after each miss
- **Proportional adjustments** - Corrections scale with miss distance
- **Trajectory simulation** - AI simulates physics to calculate optimal shots

### Multiplayer
- **WebRTC P2P** - Direct peer-to-peer connection (no server)
- **Authority-based synchronization** - Host calculates damage, client receives results
- **Idempotent messaging** - Prevents duplicate damage application
- **Manual signaling** - Copy/paste offer/answer for connection setup
- **Real-time sync** - Angle, power, weapon changes, and damage synchronized

## 🔬 Algorithms & Technical Details

### Terrain Generation
- **Fractal Noise Algorithm**: Multi-octave noise generation
  - Hills: 3 octaves, low frequency (0.003) for smooth terrain
  - Mountains: 6 octaves, higher frequency (0.006) for detailed terrain
  - Cosine interpolation for smooth transitions
  - Seeded random generation for reproducibility

### Physics Simulation
- **Ballistic Physics**:
  - Gravity (configurable per biome)
  - Air resistance (drag coefficient based on air density)
  - Wind effects (affects slower projectiles more)
  - Manual physics simulation (not using Matter.js for projectiles)
  - Fixed timestep simulation for consistency

### AI Learning Algorithm
- **Adaptive Search with Range Narrowing**:
  1. Initial broad search across angle/power space
  2. After each miss, narrows search range around best guess
  3. Proportional adjustments based on miss distance
  4. Adaptive step size (smaller corrections when closer to target)
  5. Difficulty-based accuracy multipliers
- **Trajectory Simulation**:
  - Simulates projectile path with same physics as game
  - Checks terrain collisions at multiple points (prevents tunneling)
  - Finds optimal angle/power combination via iterative search

### Collision Detection
- **Pixel-perfect collision**:
  - Checks projectile path at multiple points (prevents tunneling)
  - Shield collision (full circle around tank)
  - Tank hitbox (circular, 35px radius)
  - Terrain collision (solid pixel detection)

### Damage Calculation
- **Distance-based falloff**:
  - Linear damage reduction based on distance from explosion center
  - Formula: `damage = maxDamage * (1 - distance / radius)`
  - Minimum damage at explosion edge: 0

### Multiplayer Synchronization
- **Authority-based approach**:
  - Host is authoritative for damage calculations
  - Client receives damage messages and applies them
  - Prevents desynchronization from physics differences
- **Message deduplication**:
  - Unique message IDs prevent duplicate processing
  - Set-based tracking of sent/processed messages

### Rendering Optimizations
- **Partial terrain redraw** - Only redraws destroyed areas
- **Trajectory caching** - Stores completed trajectories
- **Graphics pooling** - Reuses graphics objects
- **Particle systems** - Efficient explosion and weather effects

## 🏗️ Architecture

### Design Patterns
- **Strategy Pattern** - Different weapon firing strategies
- **Template Method** - Base Weapon class defines structure
- **Factory Pattern** - WeaponFactory and ShieldFactory
- **Component Pattern** - Modular systems (TrajectorySystem, ExplosionSystem, etc.)
- **Observer Pattern** - Event-driven architecture (Phaser Events)

### Project Structure
```
src/
├── scenes/          # Phaser scenes (GameScene, MenuScene, etc.)
├── entities/        # Game objects (Tank, Projectile, Weapon, Shield)
├── systems/         # Game systems (AI, Explosions, Terrain, etc.)
├── network/         # WebRTC and multiplayer logic
├── utils/           # Helper functions (physics, noise generation)
├── types/           # TypeScript type definitions
├── config/          # Configuration files
└── assets/          # Images, sounds, etc.
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.
