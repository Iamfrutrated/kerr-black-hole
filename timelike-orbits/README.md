# Timelike orbits (Newtonian vs GR)

Compare **timelike** orbits of massive test particles around black holes in Newtonian gravity versus general relativity.

This project is intentionally a starter scaffold. The analytic Kerr shadow visualization lives separately in [`../analytic-kerr-shadow/`](../analytic-kerr-shadow/).

## Goal

Build a clear, interactive comparison of orbital motion for the same initial conditions under:

1. **Newtonian** gravity (inverse-square force, flat space)
2. **General relativity** (geodesic motion in Schwarzschild or Kerr, TBD)

Typical questions the sim should help answer:

- How do periapsis precession and orbital periods diverge as radius approaches the ISCO?
- Where do bound Newtonian orbits become plunging (or unbound) in GR?
- How does spin (Kerr) change the picture relative to Schwarzschild?

## Planned layout

| Path | Role |
| --- | --- |
| `sim/` | Simulation code and browser entry points |
| `docs/` | Notes on equations, assumptions, and references |
| `README.md` | Project overview (this file) |

Nothing here is production-ready yet; add integrators and UI under `sim/` when implementation begins.

## Local preview

From the repository root:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/timelike-orbits/` for this project’s placeholder page.

## References (starting points)

- Schwarzschild circular orbits and ISCO
- Kerr geodesic motion for timelike particles (e.g. Bardeen, Press & Teukolsky)
- Newtonian two-body Kepler problem as the baseline comparison
