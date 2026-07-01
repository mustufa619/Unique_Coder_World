# NOVA/SYS — A Next-Gen Digital Universe

An immersive, sci-fi inspired single-page experience: floating holographic
interfaces, cinematic particle simulations, abstract 3D environments and
experimental UI interactions that feel like a next-gen digital universe.

![stack](https://img.shields.io/badge/WebGL-Three.js-3df5ff) ![type](https://img.shields.io/badge/type-static%20site-9b5cff)

## ✦ Features

- **Fluid particle universe** — a 20,000-point GPU particle field advected by a
  layered-sine flow field in a custom GLSL shader (`three.module.js`).
- **Abstract 3D environment** — drifting wireframe icosahedron / torus /
  octahedron with slow, camera-like drift and pointer parallax.
- **Floating glassmorphism cards** — frosted, refractive panels with real-time
  pointer-reactive 3D tilt and a glow that tracks the cursor.
- **Cinematic transitions** — navigation and actions trigger a "warp" pulse in
  the particle field for a filmic state change.
- **Experimental UI** — custom cursor aura, magnetic buttons, a live data-stream
  HUD, animated boot sequence, count-up stats and an access "gate" terminal.
- **Dark neon aesthetic** — cyan → violet → magenta gradients, scanline grain
  and vignette for a gaming/movie-intro vibe.

## ✦ Run it

It's a static site — no build step.

```bash
# from this folder
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just open `index.html` in a modern browser.

> Three.js is loaded from a CDN (`unpkg`). If the CDN is unreachable, the site
> gracefully degrades to a static neon-gradient background — all the UI still
> works.

## ✦ Files

| File | Purpose |
|------|---------|
| `index.html` | Markup, HUD, sections and a CDN-independent boot watchdog |
| `style.css`  | Dark cinematic theme, glassmorphism, motion & reveal system |
| `app.js`     | Three.js universe + all UI motion systems (ES module) |

## ✦ Accessibility

Respects `prefers-reduced-motion` (disables the render loop, cursor and
animations) and falls back cleanly when WebGL or the CDN is unavailable.

## ✦ Controls

- **Move the mouse** — the universe parallaxes and the cursor aura reacts.
- **Scroll** — the camera drifts through the environment.
- **Hover cards** — 3D tilt + glow.
- **Enter a callsign** in the Access terminal and Authorize to "cross the grid".
