# Analytic Kerr shadow

Interactive 3D visualization of a Kerr (spinning) black hole using analytic geodesic radii from Bardeen (1973) and Teo (2003), with **M = 1** and dimensionless spin **χ = a/M**.

This folder holds the current analytic Kerr / shadow / photon-sphere viewer and its version history (`v1`, `v2`).

## Run it

**On GitHub Pages:** open [`analytic-kerr-shadow/`](https://iamfrutrated.github.io/kerr-black-hole/analytic-kerr-shadow/) from the [repo landing page](https://iamfrutrated.github.io/kerr-black-hole/), or visit that path directly.

**Locally:** from the repository root:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/analytic-kerr-shadow/`.

**In Cursor:** open a `kerr-black-hole.canvas.tsx` file beside the chat (under `v1/`, `v2/`, or `v2/v2.1/`). Canvas files only run inside Cursor.

## Layout

| Path | Role |
| --- | --- |
| `index.html` | Current live browser viewer (self-contained) |
| `v1/` | Earlier HTML + canvas prototypes |
| `v2/` | Intermediate canvas revision |
| `v2/v2.1/` | Prior snapshot aligned with the current viewer |

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
