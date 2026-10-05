# Timelike orbits (Newtonian vs GR)

Interactive 3D comparison of equatorial **timelike** orbits for a massive test particle around a Schwarzschild black hole — Newtonian gravity versus general relativity — in the \(u(\phi)=1/r\) form from the *Timelike geodesics* notebook.

## Run it

**On GitHub Pages:** open [`timelike-orbits/`](https://iamfrutrated.github.io/kerr-black-hole/timelike-orbits/) (after deploy).

**Locally** from the repository root:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/timelike-orbits/`.

**In Cursor:** open [`newtonian-gr-orbits.canvas.tsx`](newtonian-gr-orbits.canvas.tsx) beside the chat.

## Features

- RK4 integration of GR \(u''+u=M/L^2+3Mu^2\) and Newtonian \(u''+u=M/L^2\)
- 3D canvas animation (trails + moving particles; drag to orbit, scroll to zoom)
- Controls for \(M\), \(L\), and \(u_0\)
- Kerr-style pill presets for circular roots: **Stable**, **Unstable**, plus **ISCO**
- Horizon sphere \(r=2M\) and optional ISCO ring \(r=6M\)

## Docs

Full equations and UI spec: [`docs/newtonian-gr-orbits.md`](docs/newtonian-gr-orbits.md)

## Defaults

\(M=1\), \(L=4\), \(u_0=1/12+10^{-6}\) (stable circular root with a tiny nudge).
