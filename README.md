# Kerr black hole

Interactive 3D model of a Kerr (spinning) black hole using the geodesic radii from Bardeen (1973) and Teo (2003), with **M = 1** and dimensionless spin **χ = a/M**.

## Run it

**On GitHub Pages:** [https://iamfrutrated.github.io/kerr-black-hole/](https://iamfrutrated.github.io/kerr-black-hole/)

A `.canvas.tsx` file only runs inside Cursor. GitHub does not execute it. The live site is `index.html` in this repo.

**Locally:** open `index.html` in a browser, or from this folder run:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

**In Cursor:** open `black-hole-shadow-sim/v2/kerr-black-hole.canvas.tsx` beside the chat.

## Surfaces

| Surface | Meaning | Formula |
| --- | --- | --- |
| **rh** | Event horizon (sphere of radius rh) | `M (1 + √(1 − χ²))` |
| **rPro** | Prograde (co-rotating) photon sphere | `2M (1 + cos(⅔ arccos(−χ)))` |
| **rRetro** | Retrograde (counter-rotating) photon sphere | `2M (1 + cos(⅔ arccos(χ)))` |
| **Shadow** | Capture cross-section on a distant observer’s sky | Critical curve from Teo (ξ, η) |

At **χ = 0** (Schwarzschild): horizon 2M, one photon sphere at 3M, shadow radius **3√3 M ≈ 5.196 M**. Near **χ = 1** (extremal Kerr): rh = rPro = M, rRetro = 4M.

## Controls

- Drag to orbit, scroll to zoom
- Spin slider and Schwarzschild / extremal presets
- Toggle each surface independently
- X / Y / Z triad in the top-right (Z is the spin axis)
- Cyan and orange dots run on the equatorial photon orbits

## License

MIT
