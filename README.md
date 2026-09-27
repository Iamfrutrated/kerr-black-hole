# Kerr black hole

Interactive 3D model of a Kerr (spinning) black hole using the geodesic radii from Bardeen (1973) and Teo (2003), with **M = 1** and dimensionless spin **χ = a/M**.

## Surfaces

| Surface | Meaning | Formula |
| --- | --- | --- |
| **rh** | Event horizon (sphere of radius rh) | `M (1 + √(1 − χ²))` |
| **rPro** | Prograde (co-rotating) photon sphere | `2M (1 + cos(⅔ arccos(−χ)))` |
| **rRetro** | Retrograde (counter-rotating) photon sphere | `2M (1 + cos(⅔ arccos(χ)))` |
| **Shadow** | Capture cross-section on a distant observer’s sky | Critical curve from Teo (ξ, η) |

At **χ = 0** (Schwarzschild): horizon 2M, one photon sphere at 3M, shadow radius **3√3 M ≈ 5.196 M**. Near **χ = 1** (extremal Kerr): rh = rPro = M, rRetro = 4M.

## Open the model

This is a [Cursor Canvas](https://cursor.com) (`.canvas.tsx`). In Cursor, open `kerr-black-hole.canvas.tsx` beside the chat.

- Drag to orbit, scroll to zoom
- Spin slider and Schwarzschild / extremal presets
- Toggle each surface independently
- X / Y / Z triad in the top-right (Z is the spin axis)
- Cyan and orange dots run on the equatorial photon orbits

## License

MIT
