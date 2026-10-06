# Kerr black hole

Interactive 3D model of a Kerr (spinning) black hole using the geodesic radii from Bardeen (1973) and Teo (2003), with **M = 1** and dimensionless spin **χ = a/M**.

## Run it

[https://iamfrutrated.github.io/kerr-black-hole/](https://iamfrutrated.github.io/kerr-black-hole/)

## Layout

| Path | Role |
| --- | --- |
| `index.html` | Live GitHub Pages Kerr viewer |
| `black-hole-shadow-sim/` | Kerr shadow / photon-sphere sources (`v1`, `v2`) |
| `timelike-orbits/` | Newtonian vs GR timelike-orbit sim (HTML + Cursor canvas) |

### Timelike orbits

Compare equatorial massive-particle orbits under Newtonian gravity and Schwarzschild GR.

- **Browser:** [`timelike-orbits/index.html`](timelike-orbits/index.html) → `http://localhost:8000/timelike-orbits/`
- **Cursor canvas:** [`timelike-orbits/newtonian-gr-orbits.canvas.tsx`](timelike-orbits/newtonian-gr-orbits.canvas.tsx)
- **Equations:** [`timelike-orbits/docs/newtonian-gr-orbits.md`](timelike-orbits/docs/newtonian-gr-orbits.md)

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
