# PROJECT TITAN — Prototype 0.1

A browser-based 3D arena-fighting prototype built with HTML, CSS, JavaScript and Babylon.js.

## Run locally

Because the project loads Babylon.js from its CDN, it needs an internet connection.

### Option A: simple local server
From this directory run:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

### Option B: deploy to Vercel
1. Upload this folder to a GitHub repository.
2. Import the repository into Vercel.
3. Choose **Other** as the framework preset.
4. Leave the build command empty.
5. Set the output directory to `.`.
6. Deploy.

No backend or environment variables are required for this prototype.

## Controls

### Touch
- Left virtual stick: move.
- △: heavy attack.
- ○: special attack.
- ×: jump.
- □: light attack.
- L1: block (hold).
- R1: grab.
- R2: dodge.
- L2: face/lock onto opponent.

### Keyboard
- W/A/S/D: movement.
- J: light attack.
- K: heavy attack.
- U: special attack.
- I: grab.
- O: dodge.
- Space: jump.
- Hold L: block.
- Shift: sprint.

### Gamepad
The prototype reads the browser Gamepad API. Button indices use the standard browser mapping; controller mappings can vary by device.

## Prototype limitations

This is a gameplay foundation, not a finished AAA game:
- Fighters are procedural placeholder meshes, not photorealistic human models.
- Animations are procedural approximations, not motion-captured animation.
- Combat is local against a basic AI.
- There is no online multiplayer, save progression, music or voice acting.
- The game uses Babylon.js from its public CDN; production should pin a tested version and self-host dependencies if required.

## Next production steps

1. Replace procedural fighters with original rigged GLB characters.
2. Add animation retargeting and authored combat animation clips.
3. Add proper skeletal hitboxes, attack windows, combo buffering and recovery frames.
4. Integrate a supported physics plugin for robust character and arena collision.
5. Add asset compression, LODs, mobile quality presets and performance profiling.
6. Add controller remapping, accessibility and input calibration.
7. Add a server-authoritative networking layer before online competitive play.
