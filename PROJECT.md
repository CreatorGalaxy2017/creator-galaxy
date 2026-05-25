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

Project initialized. Basic Three.js scene is running with:
- Full-screen black-space canvas
- Soft "Creator Galaxy" title in the top-left
- A single slowly-rotating warm-toned sphere as the placeholder planet
- Ambient + directional lighting for shading
- Resize handling and animation loop

## Next milestone

Replace the placeholder sphere with a real **mountain planet** that Star the Fox can stand on and walk around — spherical terrain, basic low-poly mountains and trees, and a controllable fox character.
