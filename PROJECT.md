# Creator Galaxy — Project Status

**Project name:** Creator Galaxy
**Created by:** Sam and his 8-year-old son

## Vision

A 3D web game where you customize your own planet and visit others made by friends. Visual style is inspired by *Alba: A Wildlife Adventure* — smooth low-poly, warm cartoonish, friendly and inviting.

## Main character

**Star the Fox** — orange-and-white fur, white star marking around the right eye, wears a space suit and helmet, with a fluffy tail sticking out.

## Home planet

A small mountain planet covered in trees. Star can stand on it and walk around it.

## First creature

**Hoppa** (tentative name) — a bouncy yellow blob that lives in meadow biomes.

## Tech stack

- Three.js loaded via CDN (importmap, no build tools)
- Vanilla HTML / CSS / ES modules
- Hosted on GitHub Pages from the `main` branch root

## Current status

- Full-screen black-space canvas with soft "Creator Galaxy" title (top-left)
- **Low-poly mountain planet** built from a subdivided icosahedron, vertex-displaced with layered 3D noise, flat-shaded for that *Alba*-style faceted look
- Per-face biome colors: warm meadow green → grass → foothill brown → pale stone peaks
- Slight axial tilt and slow rotation so the terrain is clearly turning
- Three-light setup: cool ambient + warm directional "sun" + cool rim light
- Window resize handling and animation loop

## Next milestone

Bring **Star the Fox** onto the mountain planet:
1. Low-poly fox mesh (orange/white fur, white star around right eye, simple space suit + helmet, tail out)
2. Place Star on the planet surface with her "up" vector aligned to the planet's surface normal
3. Tumbling camera that follows Star around the sphere
4. Basic walk controls (keyboard / on-screen) so Star can move across the curved terrain

After that: scatter a few low-poly trees, then start on the first creature (Hoppa).
