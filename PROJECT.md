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
- **Star the Fox** built procedurally from low-poly primitives — orange body in a soft-white space suit, white snout & tail tip, perky ears, white 5-point star marking around her right eye, dark nose, oxygen backpack, and a tinted glass helmet
- **Walk controls** — Arrow keys / WASD on desktop, on-screen D-pad on touch. Star turns and walks along great circles on the planet
- **Tumbling follow camera** — sits behind and above Star with its up vector locked to the surface normal, so as she walks around the sphere the world appears to tumble beneath her
- Subtle walk bob when moving
- Background starfield for spatial reference
- Three-light setup: cool ambient + warm directional "sun" + cool rim light
- Window resize handling and animation loop

## Next milestone

Make Star actually live on the planet:
1. ✅ Mountain planet terrain
2. ✅ Star the Fox character mesh
3. ✅ Place Star on the surface (parented to planet)
4. ✅ Tumbling camera that orbits with Star
5. ✅ Basic walk controls (keyboard + touch)
6. ⬜ Scatter low-poly trees in the foothills

After that: start on the first creature (Hoppa) and the planet customizer.
