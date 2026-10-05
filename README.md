# Kerr black hole simulations

Repository for interactive black-hole visualizations. Content is split by project so analytic Kerr shadow work and future orbit comparisons can evolve independently.

## Repository layout

| Path | Role |
| --- | --- |
| [`index.html`](index.html) | Thin landing page linking into each project |
| [`analytic-kerr-shadow/`](analytic-kerr-shadow/) | Existing analytic Kerr shadow / photon-sphere visualization (current viewer, `v1` / `v2` history, canvases) |
| [`timelike-orbits/`](timelike-orbits/) | New starter project: Newtonian vs GR timelike orbits |
| [`README.md`](README.md) | This file |
| [`.gitignore`](.gitignore) | Ignore rules |
| [`.nojekyll`](.nojekyll) | Disable Jekyll on GitHub Pages |

### Naming rationale

- **`analytic-kerr-shadow`** — names the existing work by what it computes: analytic Kerr geometry, photon spheres, and the black-hole shadow (not a generic “assets” or “legacy” dump).
- **`timelike-orbits`** — names the new project by the physics focus: comparing timelike (massive-particle) orbits in Newtonian gravity versus GR.

Root keeps only shared entry and repo essentials; project-specific HTML, canvases, and docs live inside those folders.

## Projects

### Analytic Kerr shadow

Interactive 3D Kerr model using geodesic radii from Bardeen (1973) and Teo (2003), with **M = 1** and spin **χ = a/M**.

- **Live:** [GitHub Pages landing](https://iamfrutrated.github.io/kerr-black-hole/) → [analytic-kerr-shadow](https://iamfrutrated.github.io/kerr-black-hole/analytic-kerr-shadow/)
- **Details:** see [`analytic-kerr-shadow/README.md`](analytic-kerr-shadow/README.md)

### Timelike orbits (Newtonian vs GR)

Scaffold for a side-by-side comparison of massive-particle orbits under Newtonian gravity and general relativity.

- **Details:** see [`timelike-orbits/README.md`](timelike-orbits/README.md)

## Run locally

From the repository root:

```bash
python3 -m http.server 8000
```

Then open:

- Landing: `http://localhost:8000/`
- Kerr shadow viewer: `http://localhost:8000/analytic-kerr-shadow/`
- Timelike-orbits placeholder: `http://localhost:8000/timelike-orbits/`

A `.canvas.tsx` file only runs inside Cursor. GitHub Pages serves the HTML under each project folder.

## License

MIT
