# Creator Galaxy

A tiny 3D web game where you build your own planet and visit other people's planets across a friendly little galaxy.

Made by **Sam and his 8-year-old son** as a father-son project. Visual style is inspired by *Alba: A Wildlife Adventure* — smooth low-poly, warm and cartoonish.

You play as **Star the Fox** — orange-and-white, with a white star marking around her right eye, in a space suit and helmet.

## Play it

Live game: https://creatorgalaxy2017.github.io/creator-galaxy/

*(GitHub Pages can take a minute or two to come online the first time after a push.)*

## Run it locally

It's just static files — no build tools needed. Either open `index.html` directly, or serve the folder with any static server, for example:

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Tech

- [Three.js](https://threejs.org/) via CDN (importmap)
- Plain HTML / CSS / ES modules
- Hosted on GitHub Pages

See [PROJECT.md](./PROJECT.md) for the vision and current status.
