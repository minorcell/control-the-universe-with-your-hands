# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a browser-based gesture-controlled 3D visualization experiment. Users can control a camera orbiting around a black hole using hand gestures detected via MediaPipe hand tracking. The application features a Three.js 3D scene with a black hole, accretion disk, and smooth camera controls.

## Technology Stack

- **React 19** + **TypeScript** - UI framework
- **Vite 6** - Build tool and dev server
- **Tailwind CSS 4** - Styling
- **Three.js 0.160** - 3D graphics rendering
- **@mediapipe/tasks-vision** - Hand landmark detection
- **pnpm** - Package manager

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Build for production
pnpm run build

# Preview production build locally
pnpm run preview
```

**Note**: This project uses `pnpm`, not npm or yarn.

## Project Structure

The project uses a flat structure in the root directory (no `src/` folder):

- **App.tsx** - Main application component, orchestrates camera initialization and gesture detection loop
- **index.tsx** - Application entry point
- **components/**
  - **BlackHole.tsx** - Three.js 3D scene with black hole visualization and camera controls
  - **ScannerOverlay.tsx** - UI overlay with start button, status indicators, and hand skeleton visualizer
- **services/**
  - **gestureService.ts** - MediaPipe hand landmarker initialization and hand detection
- **types.ts** - TypeScript type definitions (AppState, HandPosition, Landmark, AnalysisResult)
- **style.css** - Tailwind CSS import
- **vite.config.ts** - Vite configuration with base path `/control-the-universe-with-your-hands/`
- **tsconfig.json** - TypeScript configuration

## Key Architecture Details

### Data Flow

1. **App.tsx** (`App.tsx:15-43`) initializes the camera and MediaPipe hand landmarker
2. **gestureService.ts** (`gestureService.ts:24-46`) performs continuous hand detection on video frames
3. **App.tsx** (`App.tsx:45-65`) runs a `requestAnimationFrame` loop to update hand position state
4. **BlackHole.tsx** consumes hand position to control camera in 3D space

### Gesture Detection

- Uses MediaPipe HandLandmarker in VIDEO running mode with GPU acceleration
- Single hand detection (numHands: 1)
- Uses middle finger MCP (landmark index 9) as control point
- Coordinates are normalized to [-1, 1] range
- Service loads models from CDN on first initialization

### 3D Scene (BlackHole.tsx)

- **Black hole core**: 3.5 unit radius sphere at origin
- **Accretion disk**: 40,000 particles with procedural positioning and color gradients
- **Visual effects**: Exponential fog, additive blending, particle rotation
- **Camera control**: Spherical coordinate system (azimuth, polar, radius)
- **Smooth motion**: Multi-layer smoothing with deadzone (1.5% threshold) and camera damping (2%)

### State Management

- **AppState enum** (`types.ts:1-5`): IDLE, ACTIVE, ERROR
- **HandPosition interface** (`types.ts:13-18`): x, y coordinates, detected flag, landmarks array
- Uses React refs for animation loops and Three.js object references

### Camera Behavior

- **Active mode** (hand detected): Camera orbits black hole based on hand position
- **Idle mode** (no hand for ~1.5 seconds): Automatic cruise animation
- Position smoothing prevents jitter and provides fluid motion

### UI Layer (ScannerOverlay.tsx)

- **Start button**: Prompts for camera permission when clicked
- **Hand visualizer**: Mini SVG showing MediaPipe hand landmarks and connections
- **Status indicators**: "等待信号接入..." when active but no hand detected
- **Styling**: HUD/scifi aesthetic with Tailwind utility classes

## Path Aliases

The project uses a path alias `@/*` that maps to the project root directory, configured in:

- **vite.config.ts** (`vite.config.ts:11-14`)
- **tsconfig.json** (`tsconfig.json:21-25`)

## Configuration

- **Base path**: `/control-the-universe-with-your-hands/` (important for deployment)
- **Module type**: ESNext (ES modules)
- **Target**: ES2022
- **JSX**: react-jsx

## Important Implementation Notes

1. **Three.js cleanup** (`BlackHole.tsx:416-420`): Proper disposal of geometries and materials on unmount
2. **Camera permission**: Required for gesture control, handled in `App.tsx:20-42`
3. **Performance**: 40,000 particles may require GPU acceleration; consider reducing for low-end devices
4. **CORS**: MediaPipe models loaded from CDN require network access
5. **Ref pattern** (`BlackHole.tsx:264-265`): Uses ref to track latest hand position to avoid stale closures in animation loop

## Browser Requirements

- Modern browser with WebGL support
- Camera access permission
- GPU acceleration recommended
- MediaDevices.getUserMedia API support

## Troubleshooting

- **Camera access denied**: Check browser and system permissions
- **Detection unstable**: Ensure good lighting, simple background, hand facing camera
- **Performance issues**: Reduce particle count in `BlackHole.tsx:69` or enable hardware acceleration in browser
