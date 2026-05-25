# Creator Galaxy — Project Status

**Project name:** Creator Galaxy
**Created by:** Sam and his 8-year-old son

## Vision

A 3D web game where you customize your own planet and visit others made by friends. The game is played as an **immersive third-person walking experience** — like Minecraft or Roblox — where you *are* Star the Fox, exploring a real-feeling world. Visual style is *Alba: A Wildlife Adventure*: smooth low-poly, warm cartoonish, friendly and inviting.

## Main character

**Star the Fox** — orange-and-white fur, white star marking around the right eye, wears a space suit and helmet, with a fluffy tail sticking out. Now with four short legs that animate when she walks.

## Home planet

A large mountain planet covered in low-poly conifer forests. Big enough that it feels like a world from Star's perspective — gentle visible curvature, mountains tower over her, trees tower over her.

## First creature

**Hoppa** (tentative name) — a bouncy yellow blob that lives in meadow biomes.

## Tech stack

- Three.js loaded via CDN (importmap, no build tools)
- Vanilla HTML / CSS / ES modules
- Hosted on GitHub Pages from the `main` branch root

## Current status

- **Big planet, immersive scale.** Planet radius 80 (was 1.2). Mountains ~13 units tall (≈ 30× Star's height). Trees 5–8× Star's height — she has to look up at them. Camera far plane 3000 to see distant terrain.
- **Mountain planet** built from a subdivided icosahedron (detail 6 ≈ 80k flat-shaded faces), vertex-displaced by layered 3D noise. Per-face biome colors: meadow → grass → foothill → snowy peak.
- **Star the Fox** built procedurally from low-poly primitives. Now with **four legs** (cylinders, pivot at hip) that run a diagonal-gait walk cycle when she's moving.
- **Walking animations.** Legs swing in a 5.5 Hz cycle; body sways side-to-side; tail swishes; subtle vertical bob. When idle, gentle 0.45 Hz breathing on the body.
- **Star follows the terrain.** Each frame her position is re-projected to the actual displaced surface height at her current direction, so she walks over hills instead of through them.
- **Close third-person camera** — sits behind and slightly above Star's head, with its up vector locked to the planetary surface normal so the world tumbles beneath her on the curved surface.
- **Mouse-look** — click the canvas to lock the pointer; mouse-X turns Star (and the camera follows), mouse-Y tilts the camera up/down (clamped −60°…+55° so you can't flip). Esc unlocks.
- **Walk controls** — WASD / arrow keys on desktop, on-screen D-pad on touch.
- **Forest of ~1800 trees**, placed with a clumping noise function so they form forest patches with meadow gaps rather than uniform scatter. Each tree has a random scale and rotation. Only trees within 60 units of Star are written into the InstancedMesh each frame (view-distance culling).
- **Tree collision** — each tree has a cylindrical collision radius around its trunk; Star is pushed out along the contact normal and re-projected to the surface, so she slides around trunks rather than walking through them.
- **Distance fog** matched to the tree view-distance, so culled trees fade out instead of popping.
- **Big starfield** at 900–1500 units, 2500 stars (does not fog out — it's space).
- **Three-light setup**: cool ambient + warm directional "sun" + cool rim light.

## Milestone — *Immersive walk on Star's home planet* (done!)

1. ✅ Massive planet scale-up
2. ✅ Close third-person camera with mouse-look (pointer lock)
3. ✅ Mouse-X turns the character; mouse-Y tilts the camera; pitch clamped
4. ✅ Trees scaled to tower over Star, dense forest feel via clumping noise
5. ✅ Tree collision (cylindrical, sliding pushback)
6. ✅ Star has legs that animate when walking; tail swish, body sway, idle breathing
7. ✅ Starfield rescaled to the new world size

## Known limitations / future tuning

- **Camera can clip into hills or trees** when you walk into a slope or up against a trunk. Fix is non-trivial (raycast back from Star toward desired camera spot, snap forward at first hit). Deferred.
- **Walk-cycle blending is binary** — animation snaps on/off when you press/release a key. Easing in/out would feel less stiff.
- **Tree colors are uniform.** Per-instance color variation is a small follow-up.
- **No running / jumping yet.**

## Next milestone — *Life on the planet*

1. ⬜ **Hoppa** the bouncy yellow blob — first creature, lives in meadow biomes
2. ⬜ Subtle environmental animations (trees sway gently in wind, Hoppa idle-hops)
3. ⬜ Star can "pet" / interact with Hoppa when close
4. ⬜ A small UI hint (crosshair / prompt) when Star is near something interactive

## Bigger arcs ahead

- **Camera-collision pass** so the third-person view doesn't clip into terrain or trees
- **Planet customizer** — pick biomes, terrain shape, drop trees & creatures, save the layout
- **Galaxy map** — visit other planets (other player saves, or built-in ones)
- **More creatures and biomes** beyond Hoppa
