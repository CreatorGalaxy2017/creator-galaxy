# Creator Galaxy — Project Status

**Project name:** Creator Galaxy
**Created by:** Sam and his 8-year-old son

## Vision

A 3D web game where you customize your own planet and visit others made by friends. Played as an **immersive third-person walking experience** — like Minecraft or Roblox — where you *are* Star the Fox, exploring a world you (or another player) built. Visual style is *Alba: A Wildlife Adventure*: smooth low-poly, warm cartoonish, friendly and inviting.

## Main character

**Star the Fox** — orange-and-white fur, white star marking around the right eye, wears a space suit and helmet, fluffy tail, four short legs that animate when she walks.

## Home planet

A large mountain planet (radius 80) with biome-colored terrain — meadow, grass, foothill, snowy peak. Starts **empty**: no automatic forests, no creatures. The player builds the world themselves with the Landmark Builder.

## Tech stack

- Three.js loaded via CDN (importmap, no build tools)
- Vanilla HTML / CSS / ES modules
- Hosted on GitHub Pages from the `main` branch root

## Current status

### Walking

- Big planet (radius 80), mountains ~30× Star's height
- **Slope-aware orientation** — Star now tilts to the local terrain normal (sampled from the noise gradient) instead of standing perpendicular to the radial. Fixes the "body sinks uphill / half-buried downhill" bug.
- Follows the displaced surface height each frame
- Close third-person camera with pointer-lock mouse-look (clamped pitch)
- WASD / arrows / on-screen D-pad
- Walk animations: legs, body sway, tail swish, idle breathing
- Distance fog + 2500-star starfield

### Landmark Builder (NEW)

- **Build button** in the top-right toggles edit mode and opens a sidebar
- **Four landmark types** so far:
  - **Tree** — trunk + two stacked green cones
  - **Rock** — irregular low-poly boulder
  - **Bush** — clumped low-poly green spheres
  - **Mushroom** — red cap with white spots on a cream stem
- **Click to place:** pick a tool in the sidebar, then click on the planet
- **Click placed items to select.** A yellow bounding box highlights the selection.
- **Action panel** (centered, above the D-pad) when something is selected:
  - **−** / **+** — make it smaller / bigger (multiplicative)
  - **Duplicate** — drops a copy nearby
  - **Delete** — removes it
- **Esc** cancels the active placement tool or deselects
- All placed items have collision — Star is pushed out and slides around them
- Items auto-orient to the terrain normal at placement, so they don't tip on slopes

## Known limitations

- **No save/load yet.** Refresh = blank planet. Next priority for the builder.
- **No drag-to-move** — to relocate an item, delete and re-place. (Future: drag a selected item across the surface.)
- **No rotation control** — items get a random rotation around their up-axis at placement.
- **Camera can clip into hills or items** at close range — deferred raycast pass.
- **No water yet** — Sam asked for ponds; that's the next-up landmark type.

## Next milestone — *Make planets shareable*

1. ⬜ **Water / ponds** as a landmark type (waist-deep wading)
2. ⬜ **Save** the current planet's items to localStorage; reload on refresh
3. ⬜ **Drag-to-move** a selected item across the surface
4. ⬜ More landmark types (logs, flowers, crystals, signposts)
5. ⬜ Maybe per-instance color tweaks (different green for each tree, etc.)

## Bigger arcs ahead

- **Hoppa** the bouncy yellow blob (first creature)
- **Galaxy map** — visit other planets (other player saves, or built-in ones)
- **Export/share** a planet so a friend can visit yours
- **Camera-collision pass** so the third-person view doesn't clip into terrain or items
