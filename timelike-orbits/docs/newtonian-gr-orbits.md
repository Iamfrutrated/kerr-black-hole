# Newtonian vs GR timelike orbits

Equations and numerical setup for comparing **timelike** (massive-particle) orbits in Schwarzschild GR versus Newtonian gravity, following the Mathematica notebook *Timelike geodesics*.

Source notebook screenshot: [`media/timelike-geodesics-notebook.png`](../media/timelike-geodesics-notebook.png)

Related: analytic Kerr *null* / shadow surfaces are documented separately in [`kerr-equations.md`](kerr-equations.md). Those closed forms do **not** integrate these ODEs.

---

## Conventions

- Orbit shape is written as \(u(\phi) = 1/r\).
- Units are geometrical: \(G = c = 1\).
- \(u''\) means \(d^2u/d\phi^2\).
- \(M\) is the central mass; \(L\) is specific angular momentum (angular momentum per unit mass).

---

## Orbit equations

### Schwarzschild (GR)

\[
u'' + u = \frac{M}{L^2} + 3M\, u^2
\]

**For:** Equatorial timelike geodesic motion in the Schwarzschild metric, written in the reciprocal-radius variable \(u(\phi)\). The term \(3M u^2\) is the relativistic correction.

### Newtonian

\[
u_N'' + u_N = \frac{M}{L^2}
\]

**For:** Classical inverse-square / Kepler problem in the same \(u(\phi)\) form. Same \(M/L^2\) driving term as GR, but **without** \(+\,3M u^2\).

---

## Parameters used in the notebook

\[
M = 1,\qquad L = 4,\qquad u_0 = \frac{1}{12} + 10^{-6}
\]

| Symbol | Value | Role |
| --- | --- | --- |
| \(M\) | \(1\) | Central mass |
| \(L\) | \(4\) | Specific angular momentum |
| \(u_0\) | \(1/12 + 10^{-6}\) | Initial \(u\) at \(\phi = 0\) (slightly outside the circular-orbit root \(u = 1/12\)) |

---

## Circular-orbit fixed points (GR)

For circular motion, \(u'' = 0\) and \(u' = 0\), so the GR right-hand side equals \(u\):

\[
u = \frac{M}{L^2} + 3M\, u^2
\quad\Longleftrightarrow\quad
3M\, u^2 - u + \frac{M}{L^2} = 0
\]

Closed-form roots (real when \(L^2 \ge 12 M^2\)):

\[
u_\pm = \frac{1 \pm \sqrt{1 - 12 M^2 / L^2}}{6M}
\]

| Root | Meaning | Radius |
| --- | --- | --- |
| \(u_- = u_{\mathrm{stable}}\) (minus sign) | Stable circular orbit | \(r = 1/u_-\) (larger \(r\)) |
| \(u_+ = u_{\mathrm{unstable}}\) (plus sign) | Unstable circular orbit | \(r = 1/u_+\) (smaller \(r\)) |

With the notebook defaults \(M = 1\), \(L = 4\):

\[
u_{\mathrm{stable}} = \frac{1}{12},\qquad u_{\mathrm{unstable}} = \frac{1}{4}
\]

(\(r = 12\) and \(r = 4\).) The notebook’s \(u_0 = 1/12 + 10^{-6}\) is a tiny outward perturbation of the stable root so the orbit is visibly non-circular.

### ISCO (Schwarzschild)

The innermost stable circular orbit is where the two roots merge (discriminant zero):

\[
L_{\mathrm{ISCO}} = 2\sqrt{3}\, M,\qquad
r_{\mathrm{ISCO}} = 6M,\qquad
u_{\mathrm{ISCO}} = \frac{1}{6M}
\]

For \(M = 1\): \(L_{\mathrm{ISCO}} = 2\sqrt{3} \approx 3.464\), \(u_{\mathrm{ISCO}} = 1/6\).

---

## Initial-value problems

Integrate over \(\phi \in [0,\,20]\) with periapsis-like start \(u'(0) = 0\).

### GR (`solGR`)

\[
\begin{aligned}
u''(\phi) + u(\phi) &= \frac{M}{L^2} + 3M\, u(\phi)^2, \\
u(0) &= u_0, \\
u'(0) &= 0.
\end{aligned}
\]

### Newtonian (`solNewton`)

\[
\begin{aligned}
u_N''(\phi) + u_N(\phi) &= \frac{M}{L^2}, \\
u_N(0) &= u_0, \\
u_N'(0) &= 0.
\end{aligned}
\]

---

## Plotting and 3D animation

Convert \(u(\phi) = 1/r\) to Cartesian coordinates. The notebook is planar; the interactive sim should **render the animation in 3D** (equatorial orbits in the \(xy\)-plane, with a 3D camera the user can orbit / zoom):

\[
x(\phi) = \frac{\cos\phi}{u(\phi)},\qquad
y(\phi) = \frac{\sin\phi}{u(\phi)},\qquad
z(\phi) = 0
\]

| Curve | Color (notebook) | \(u\) source |
| --- | --- | --- |
| GR orbit | Blue | \(u(\phi)\) from `solGR` |
| Newtonian orbit | Purple | \(u_N(\phi)\) from `solNewton` |

Draw a sphere (or disk in the equatorial plane) of radius \(2M\) at the origin for the Schwarzschild event horizon. Animate a particle marker along each trajectory as \(\phi\) advances. Notebook reference window: \(x,y \in [-20,\,20]\) at the default parameters.

---

## User controls

The sim **must** let the user control the particle parameters and re-integrate / re-animate when they change:

| Control | Symbol | Default | Notes |
| --- | --- | --- | --- |
| Mass | \(M\) | \(1\) | Scales the horizon radius \(2M\) and both ODEs |
| Specific angular momentum | \(L\) | \(4\) | Enters as \(M/L^2\); circular roots depend on \(M,L\) |
| Initial reciprocal radius | \(u_0\) | \(1/12 + 10^{-6}\) | \(u(0) = u_N(0) = u_0\), with \(u'(0) = 0\) |

Keep both GR and Newtonian integrations synchronized to the same \(M\), \(L\), and \(u_0\) so the comparison stays fair.

### \(u_0\) preset buttons (after \(M\), \(L\))

Once the user has set \(M\) and \(L\), show **pill buttons** in the same style as the Kerr viewer’s spin presets (`Schwarzschild 0`, `Moderate 0.5`, `Extremal 0.998`) — but for \(u_0\), not \(\chi\).

Recompute labels whenever \(M\) or \(L\) changes:

| Button label (pattern) | Sets | When enabled |
| --- | --- | --- |
| `Stable {u_stable}` (e.g. `Stable 0.0833`) | \(u_0 \leftarrow u_-\) | \(L^2 > 12 M^2\) (two distinct circular roots) |
| `Unstable {u_unstable}` (e.g. `Unstable 0.2500`) | \(u_0 \leftarrow u_+\) | \(L^2 > 12 M^2\) |
| `ISCO {u_ISCO}` (e.g. `ISCO 0.1667`) | \(L \leftarrow L_{\mathrm{ISCO}}\), \(u_0 \leftarrow u_{\mathrm{ISCO}}\) | Always available as a feature option (see below) |

UI notes:

- Match the Kerr pill / active-state look so the control language stays familiar.
- Show a short numeric value on each button (prefer a few decimals of \(u\), or \(r = 1/u\) if clearer — be consistent).
- Exact circular \(u_0\) yields a closed circle in GR; optionally apply a tiny \(\varepsilon\) (notebook uses \(+10^{-6}\) on the stable root) so the animation shows precession / drift. Document which choice the UI uses.
- If \(L^2 < 12 M^2\), disable or hide **Stable** / **Unstable** (no real circular orbits for that \(L\)).
- If \(L^2 = 12 M^2\), the two circular buttons coincide at the ISCO; prefer showing the **ISCO** button as the active circular choice.

### ISCO option

In addition to Stable / Unstable, provide an **ISCO** control:

1. **Preset button** `ISCO …` — sets the Schwarzschild ISCO for the current mass: \(L = 2\sqrt{3}\, M\) and \(u_0 = 1/(6M)\), then re-integrates both orbits.
2. Optionally highlight \(r = 6M\) in the 3D scene when ISCO is selected (reference ring), distinct from the horizon sphere of radius \(2M\).

Clicking ISCO may update the \(L\) control to \(L_{\mathrm{ISCO}}\); Stable / Unstable then collapse to that same \(u\) until the user changes \(L\) again.

---

## Implementation checklist

When building the interactive sim (e.g. under `timelike-orbits/`):

1. Integrate the two second-order ODEs above for the current \(M\), \(L\), \(u_0\), and \(\phi\)-range.
2. **Render the orbits as a 3D animation** (trail + moving particle markers; horizon as a sphere/disk of radius \(2M\); orbitable camera).
3. **Expose user controls for \(M\), \(L\), and \(u_0\)**; on change, re-solve both ODEs and restart the animation.
4. **After \(M\) and \(L\) are set, show Kerr-style pill buttons** for \(u_0\): **Stable** and **Unstable** circular roots \(u_\pm(M,L)\), with live numeric labels.
5. **Add an ISCO option** (pill button) that sets \(L = 2\sqrt{3}\, M\) and \(u_0 = 1/(6M)\); optionally draw an \(r = 6M\) reference ring.
6. Disable Stable / Unstable when \(L^2 < 12 M^2\); treat the discriminant-zero case as ISCO.
