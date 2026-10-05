import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Code,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Stack,
  Stat,
  Swatch,
  Table,
  Text,
  Toggle,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas";
import { useEffect, useMemo, useRef, useState } from "react";

const PHI_MAX = 20;
const PHI_STEPS = 2400;
const U_EPS = 1e-6;
const REF_DIST = 28;
const FIT_RADIUS = 18;

type Vec3 = { x: number; y: number; z: number };
type Cam = { yaw: number; pitch: number; zoom: number };
type Pt = { x: number; y: number; d: number };
type Theme = ReturnType<typeof useHostTheme>;
type OrbitTrail = { phi: number[]; xyz: Vec3[] };

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function fmt(n: number, digits = 4) {
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function lIsco(M: number) {
  return 2 * Math.sqrt(3) * M;
}

function uIsco(M: number) {
  return 1 / (6 * M);
}

/** Circular GR roots u±; null if L² < 12 M². */
function circularRoots(M: number, L: number): { stable: number; unstable: number } | null {
  if (!(M > 0) || !(L > 0)) return null;
  const disc = 1 - (12 * M * M) / (L * L);
  if (disc < -1e-12) return null;
  const s = Math.sqrt(Math.max(0, disc));
  const den = 6 * M;
  return {
    unstable: (1 + s) / den,
    stable: (1 - s) / den,
  };
}

function near(a: number, b: number, tol = 2e-4) {
  return Math.abs(a - b) <= tol;
}

/**
 * RK4 for u'' = f(u). State y = [u, u'].
 * Stops early if u is non-positive or blows up (plunge / escape).
 */
function integrateOrbit(
  M: number,
  L: number,
  u0: number,
  gr: boolean,
): OrbitTrail {
  const phi: number[] = [];
  const xyz: Vec3[] = [];
  const h = PHI_MAX / PHI_STEPS;
  const mOverL2 = M / (L * L);

  const accel = (u: number) => {
    const rel = gr ? 3 * M * u * u : 0;
    return mOverL2 + rel - u;
  };

  let u = u0;
  let up = 0;
  for (let i = 0; i <= PHI_STEPS; i++) {
    const ph = i * h;
    if (!(u > 1e-8) || u > 50) break;
    const r = 1 / u;
    if (r > 1e5) break;
    phi.push(ph);
    xyz.push({ x: Math.cos(ph) * r, y: Math.sin(ph) * r, z: 0 });

    const k1u = up;
    const k1p = accel(u);
    const k2u = up + 0.5 * h * k1p;
    const k2p = accel(u + 0.5 * h * k1u);
    const k3u = up + 0.5 * h * k2p;
    const k3p = accel(u + 0.5 * h * k2u);
    const k4u = up + h * k3p;
    const k4p = accel(u + h * k3u);
    u += (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
    up += (h / 6) * (k1p + 2 * k2p + 2 * k3p + k4p);
  }
  return { phi, xyz };
}

function ringPoints(r: number, n = 96): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: r * Math.cos(a), y: r * Math.sin(a), z: 0 });
  }
  return pts;
}

function wireSphere(r: number): Vec3[][] {
  const lines: Vec3[][] = [];
  const meridians = 10;
  const parallels = 6;
  for (let m = 0; m < meridians; m++) {
    const phi = (m / meridians) * Math.PI * 2;
    const pts: Vec3[] = [];
    for (let i = 0; i <= 32; i++) {
      const th = (i / 32) * Math.PI;
      pts.push({
        x: r * Math.sin(th) * Math.cos(phi),
        y: r * Math.sin(th) * Math.sin(phi),
        z: r * Math.cos(th),
      });
    }
    lines.push(pts);
  }
  for (let p = 1; p < parallels; p++) {
    const th = (p / parallels) * Math.PI;
    const pts: Vec3[] = [];
    for (let i = 0; i <= 48; i++) {
      const phi = (i / 48) * Math.PI * 2;
      pts.push({
        x: r * Math.sin(th) * Math.cos(phi),
        y: r * Math.sin(th) * Math.sin(phi),
        z: r * Math.cos(th),
      });
    }
    lines.push(pts);
  }
  return lines;
}

function screenScale(zoom: number, w: number, h: number) {
  return ((Math.min(w, h) * 0.44) / FIT_RADIUS) * zoom;
}

function toCamera(p: Vec3, cam: Cam): Vec3 {
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const x1 = p.x * cy - p.y * sy;
  const y1 = p.x * sy + p.y * cy;
  return { x: x1, y: y1 * cp - p.z * sp, z: y1 * sp + p.z * cp };
}

function makeTransform(cam: Cam, w: number, h: number) {
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const k = screenScale(cam.zoom, w, h);
  const cx = w / 2;
  const cz = h / 2;
  return (p: Vec3): Pt => {
    const x1 = p.x * cy - p.y * sy;
    const y1 = p.x * sy + p.y * cy;
    const d = y1 * cp - p.z * sp;
    const z = y1 * sp + p.z * cp;
    const persp = 1 / Math.max(0.72, 1 - 0.1 * (d / REF_DIST));
    return { x: cx + x1 * k * persp, y: cz - z * k * persp, d };
  };
}

function strokePolyline(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  front: boolean,
  color: string,
  width: number,
  alpha: number,
) {
  ctx.beginPath();
  let open = false;
  let any = false;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const q = pts[i];
    if ((p.d + q.d >= 0) === front) {
      if (!open) {
        ctx.moveTo(p.x, p.y);
        open = true;
      }
      ctx.lineTo(q.x, q.y);
      any = true;
    } else open = false;
  }
  if (!any) return;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.globalAlpha = 1;
}

type SceneState = {
  M: number;
  L: number;
  showGR: boolean;
  showNewton: boolean;
  showHorizon: boolean;
  showIscoRing: boolean;
  autoRotate: boolean;
  animate: boolean;
  gr: OrbitTrail;
  newton: OrbitTrail;
  theme: Theme;
};

function drawScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: Cam,
  phase: number,
  s: SceneState,
) {
  const theme = s.theme;
  const col = theme.category;
  const tf = makeTransform(cam, w, h);
  const k = screenScale(cam.zoom, w, h);
  const rH = 2 * s.M;
  const rIsco = 6 * s.M;

  const horizonWires = wireSphere(rH).map((line) => line.map(tf));
  const iscoRing = ringPoints(rIsco).map(tf);
  const grPts = s.gr.xyz.map(tf);
  const nePts = s.newton.xyz.map(tf);

  const passWires = (front: boolean) => {
    if (!s.showHorizon) return;
    for (const pts of horizonWires) {
      strokePolyline(ctx, pts, front, theme.text.secondary, 1, front ? 0.55 : 0.25);
    }
  };

  const passOrbits = (front: boolean) => {
    if (s.showNewton) strokePolyline(ctx, nePts, front, col.purple, 2.2, front ? 0.95 : 0.35);
    if (s.showGR) strokePolyline(ctx, grPts, front, col.cyan, 2.4, front ? 0.95 : 0.35);
    if (s.showIscoRing) strokePolyline(ctx, iscoRing, front, col.orange, 1.6, front ? 0.85 : 0.3);
  };

  const particleAt = (trail: OrbitTrail, color: string) => {
    if (trail.xyz.length < 2) return null;
    const t = ((phase % PHI_MAX) + PHI_MAX) % PHI_MAX;
    const idx = Math.min(
      trail.xyz.length - 1,
      Math.max(0, Math.floor((t / PHI_MAX) * (trail.xyz.length - 1))),
    );
    return { p: tf(trail.xyz[idx]), color };
  };

  const dots: { p: Pt; color: string }[] = [];
  if (s.animate) {
    if (s.showGR) {
      const d = particleAt(s.gr, col.cyan);
      if (d) dots.push(d);
    }
    if (s.showNewton) {
      const d = particleAt(s.newton, col.purple);
      if (d) dots.push(d);
    }
  }

  const drawDots = (front: boolean) => {
    for (const { p, color } of dots) {
      if ((p.d >= 0) !== front) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = theme.bg.chrome;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  passWires(false);
  passOrbits(false);
  drawDots(false);

  if (s.showHorizon) {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, rH * k, 0, Math.PI * 2);
    ctx.fillStyle = theme.kind === "light" ? theme.text.primary : theme.bg.chrome;
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = theme.text.secondary;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  passWires(true);
  passOrbits(true);
  drawDots(true);
}

function drawGizmo(ctx: CanvasRenderingContext2D, w: number, cam: Cam, theme: Theme) {
  const cx = w - 58;
  const cy = 58;
  const radius = 28;
  ctx.beginPath();
  ctx.arc(cx, cy, 46, 0, Math.PI * 2);
  ctx.fillStyle = theme.fill.tertiary;
  ctx.fill();
  ctx.strokeStyle = theme.stroke.tertiary;
  ctx.lineWidth = 1;
  ctx.stroke();

  const axes = [
    { label: "X", vec: { x: 1, y: 0, z: 0 }, color: theme.category.red },
    { label: "Y", vec: { x: 0, y: 1, z: 0 }, color: theme.category.green },
    { label: "Z", vec: { x: 0, y: 0, z: 1 }, color: theme.category.blue },
  ]
    .map((axis) => {
      const c = toCamera(axis.vec, cam);
      return { ...axis, x: c.x * radius, y: -c.z * radius, depth: c.y };
    })
    .sort((u, v) => u.depth - v.depth);

  ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const axis of axes) {
    const tx = cx + axis.x;
    const ty = cy + axis.y;
    const len = Math.hypot(axis.x, axis.y) || 1;
    const nx = axis.x / len;
    const ny = axis.y / len;
    ctx.strokeStyle = axis.color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - axis.x * 0.35, cy - axis.y * 0.35);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tx - nx * 7, ty - ny * 7);
    ctx.stroke();
    ctx.fillStyle = axis.color;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - nx * 7 - ny * 3.2, ty - ny * 7 + nx * 3.2);
    ctx.lineTo(tx - nx * 7 + ny * 3.2, ty - ny * 7 - nx * 3.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillText(axis.label, tx + nx * 10, ty + ny * 10);
  }
}

function Viewport({
  M,
  L,
  showGR,
  showNewton,
  showHorizon,
  showIscoRing,
  autoRotate,
  animate,
  invertDrag,
  gr,
  newton,
}: {
  M: number;
  L: number;
  showGR: boolean;
  showNewton: boolean;
  showHorizon: boolean;
  showIscoRing: boolean;
  autoRotate: boolean;
  animate: boolean;
  invertDrag: boolean;
  gr: OrbitTrail;
  newton: OrbitTrail;
}) {
  const theme = useHostTheme();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<Cam>({ yaw: 0.55, pitch: 0.55, zoom: 1 });
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const phaseRef = useRef(0);
  const dirtyRef = useRef(true);
  const [dragging, setDragging] = useState(false);

  const stateRef = useRef<SceneState>({
    M,
    L,
    showGR,
    showNewton,
    showHorizon,
    showIscoRing,
    autoRotate,
    animate,
    gr,
    newton,
    theme,
  });
  stateRef.current = {
    M,
    L,
    showGR,
    showNewton,
    showHorizon,
    showIscoRing,
    autoRotate,
    animate,
    gr,
    newton,
    theme,
  };

  useEffect(() => {
    dirtyRef.current = true;
    phaseRef.current = 0;
  }, [M, L, gr, newton]);

  useEffect(() => {
    dirtyRef.current = true;
  });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      let dy = event.deltaY;
      if (event.deltaMode === 1) dy *= 16;
      if (event.deltaMode === 2) dy *= 40;
      const cam = camRef.current;
      cam.zoom = clamp(cam.zoom * Math.exp(-dy * 0.0018), 0.25, 4);
      dirtyRef.current = true;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      w = Math.max(320, rect.width);
      h = Math.max(360, rect.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dirtyRef.current = true;
    };
    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(wrap);

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      const cam = camRef.current;
      const animating = (s.autoRotate && !dragRef.current) || s.animate;
      if (s.autoRotate && !dragRef.current) cam.yaw += dt * 0.18;
      if (s.animate) phaseRef.current += dt * 1.35;
      if (animating || dirtyRef.current) {
        dirtyRef.current = false;
        ctx.clearRect(0, 0, w, h);
        drawScene(ctx, w, h, cam, phaseRef.current, s);
        drawGizmo(ctx, w, cam, s.theme);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      obs.disconnect();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      style={{
        height: 520,
        minHeight: 520,
        border: `1px solid ${theme.stroke.tertiary}`,
        borderRadius: 8,
        background: theme.bg.editor,
        overflow: "hidden",
        overscrollBehavior: "contain",
        touchAction: "none",
        cursor: dragging ? "grabbing" : "grab",
        userSelect: "none",
        position: "relative",
      }}
      onPointerDown={(event: {
        currentTarget: HTMLDivElement;
        pointerId: number;
        clientX: number;
        clientY: number;
      }) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const cam = camRef.current;
        dragRef.current = { x: event.clientX, y: event.clientY, yaw: cam.yaw, pitch: cam.pitch };
        setDragging(true);
      }}
      onPointerMove={(event: { clientX: number; clientY: number }) => {
        const start = dragRef.current;
        if (!start) return;
        const cam = camRef.current;
        cam.yaw = start.yaw + (event.clientX - start.x) * 0.008;
        const dy = (event.clientY - start.y) * (invertDrag ? -1 : 1);
        cam.pitch = clamp(start.pitch + dy * 0.008, -1.2, 1.2);
        dirtyRef.current = true;
      }}
      onPointerUp={() => {
        dragRef.current = null;
        setDragging(false);
      }}
      onPointerCancel={() => {
        dragRef.current = null;
        setDragging(false);
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block", position: "absolute", inset: 0 }} />
      <div style={{ position: "absolute", left: 12, bottom: 12, pointerEvents: "none" }}>
        <Text size="small" tone="tertiary">
          Drag to orbit · scroll to zoom · geometrical units
        </Text>
      </div>
    </div>
  );
}

export default function NewtonianGrOrbits() {
  const theme = useHostTheme();
  const [M, setM] = useCanvasState("mass", 1);
  const [L, setL] = useCanvasState("angMom", 4);
  const [u0, setU0] = useCanvasState("u0", 1 / 12 + U_EPS);
  const [autoRotate, setAutoRotate] = useCanvasState("autoRotate", true);
  const [animate, setAnimate] = useCanvasState("animate", true);
  const [invertDrag, setInvertDrag] = useCanvasState("invertDrag", false);
  const [showGR, setShowGR] = useCanvasState("showGR", true);
  const [showNewton, setShowNewton] = useCanvasState("showNewton", true);
  const [showHorizon, setShowHorizon] = useCanvasState("showHorizon", true);
  const [showIscoRing, setShowIscoRing] = useCanvasState("showIscoRing", false);
  const [preset, setPreset] = useCanvasState<"stable" | "unstable" | "isco" | "custom">(
    "u0Preset",
    "stable",
  );

  const Mc = clamp(M, 0.2, 5);
  const Lc = clamp(L, 0.5, 20);
  const u0c = clamp(u0, 1e-4, 2);

  const roots = useMemo(() => circularRoots(Mc, Lc), [Mc, Lc]);
  const Lisco = lIsco(Mc);
  const Uisco = uIsco(Mc);
  const atIsco = near(Lc, Lisco, 0.02) && near(u0c, Uisco, 2e-3);

  const gr = useMemo(() => integrateOrbit(Mc, Lc, u0c, true), [Mc, Lc, u0c]);
  const newton = useMemo(() => integrateOrbit(Mc, Lc, u0c, false), [Mc, Lc, u0c]);

  const applyStable = () => {
    if (!roots) return;
    setL(Lc);
    setU0(roots.stable + U_EPS);
    setPreset("stable");
    setShowIscoRing(false);
  };
  const applyUnstable = () => {
    if (!roots) return;
    setL(Lc);
    setU0(roots.unstable);
    setPreset("unstable");
    setShowIscoRing(false);
  };
  const applyIsco = () => {
    setM(Mc);
    setL(Lisco);
    setU0(Uisco);
    setPreset("isco");
    setShowIscoRing(true);
  };

  const distinctRoots = roots && roots.unstable - roots.stable > 1e-4;

  return (
    <Stack gap={20} style={{ maxWidth: 1100 }}>
      <Stack gap={6}>
        <H1>Timelike orbits — Newtonian vs GR</H1>
        <Text tone="secondary">
          Equatorial massive-particle orbits in the Schwarzschild u(φ) = 1/r form. Blue is GR
          (with the 3M u² correction); purple is Newtonian. Drag the 3D view; animate markers along
          each trail. Units: G = c = 1.
        </Text>
      </Stack>

      <Row gap={12} wrap>
        <Stat value={fmt(Mc, 3)} label="Mass M" />
        <Stat value={fmt(Lc, 3)} label="Angular momentum L" tone="info" />
        <Stat value={fmt(u0c, 5)} label="Initial u₀ = 1/r" tone="warning" />
        <Stat value={fmt(1 / u0c, 3)} label="Initial r₀" />
      </Row>

      <Viewport
        M={Mc}
        L={Lc}
        showGR={showGR}
        showNewton={showNewton}
        showHorizon={showHorizon}
        showIscoRing={showIscoRing || preset === "isco"}
        autoRotate={autoRotate}
        animate={animate}
        invertDrag={invertDrag}
        gr={gr}
        newton={newton}
      />

      <Grid columns="1.4fr 1fr" gap={16}>
        <Stack gap={12}>
          <H2>Parameters</H2>
          <Text size="small" tone="secondary">
            Set M and L first; circular-orbit u₀ presets update from those values.
          </Text>
          <Row gap={10} align="center">
            <Text size="small" style={{ width: 28 }}>
              M
            </Text>
            <input
              type="range"
              min={0.2}
              max={5}
              step={0.01}
              value={Mc}
              onChange={(event: { target: { value: string } }) => {
                setM(Number(event.target.value));
                setPreset("custom");
              }}
              style={{ flex: 1, accentColor: theme.accent.primary }}
              aria-label="Mass M"
            />
            <Text weight="semibold" style={{ width: 56, textAlign: "right" }}>
              {Mc.toFixed(2)}
            </Text>
          </Row>
          <Row gap={10} align="center">
            <Text size="small" style={{ width: 28 }}>
              L
            </Text>
            <input
              type="range"
              min={0.5}
              max={20}
              step={0.01}
              value={Lc}
              onChange={(event: { target: { value: string } }) => {
                setL(Number(event.target.value));
                setPreset("custom");
                setShowIscoRing(false);
              }}
              style={{ flex: 1, accentColor: theme.accent.primary }}
              aria-label="Specific angular momentum L"
            />
            <Text weight="semibold" style={{ width: 56, textAlign: "right" }}>
              {Lc.toFixed(2)}
            </Text>
          </Row>
          <Row gap={10} align="center">
            <Text size="small" style={{ width: 28 }}>
              u₀
            </Text>
            <input
              type="range"
              min={0.01}
              max={0.5}
              step={0.0001}
              value={u0c}
              onChange={(event: { target: { value: string } }) => {
                setU0(Number(event.target.value));
                setPreset("custom");
              }}
              style={{ flex: 1, accentColor: theme.accent.primary }}
              aria-label="Initial reciprocal radius u0"
            />
            <Text weight="semibold" style={{ width: 72, textAlign: "right" }}>
              {u0c.toFixed(4)}
            </Text>
          </Row>

          <H3>u₀ presets</H3>
          <Row gap={8} wrap>
            <Pill
              active={preset === "stable" && !!distinctRoots}
              onClick={() => {
                if (distinctRoots) applyStable();
              }}
            >
              {roots ? `Stable ${roots.stable.toFixed(4)}` : "Stable (none)"}
            </Pill>
            <Pill
              active={preset === "unstable" && !!distinctRoots}
              onClick={() => {
                if (distinctRoots) applyUnstable();
              }}
            >
              {roots ? `Unstable ${roots.unstable.toFixed(4)}` : "Unstable (none)"}
            </Pill>
            <Pill active={preset === "isco" || atIsco} onClick={applyIsco}>
              {`ISCO ${Uisco.toFixed(4)}`}
            </Pill>
          </Row>
          <Text size="small" tone="tertiary">
            Stable applies u₋ + 10⁻⁶ (notebook-style nudge). Unstable uses exact u₊. ISCO sets
            L = 2√3 M and u₀ = 1/(6M), and shows the r = 6M ring.
          </Text>

          <Row gap={10} align="center" wrap>
            <Text size="small">Animate particles</Text>
            <Toggle checked={animate} onChange={setAnimate} />
            <Text size="small">Auto-rotate</Text>
            <Toggle checked={autoRotate} onChange={setAutoRotate} />
            <Text size="small">Invert vertical drag</Text>
            <Toggle checked={invertDrag} onChange={setInvertDrag} />
          </Row>
        </Stack>

        <Stack gap={10}>
          <H2>Display</H2>
          <Checkbox checked={showGR} onChange={setShowGR} label="GR orbit (blue)" />
          <Checkbox checked={showNewton} onChange={setShowNewton} label="Newtonian orbit (purple)" />
          <Checkbox checked={showHorizon} onChange={setShowHorizon} label="Event horizon r = 2M" />
          <Checkbox
            checked={showIscoRing || preset === "isco"}
            onChange={(v: boolean) => {
              setShowIscoRing(v);
            }}
            label="ISCO ring r = 6M"
          />
          <Row gap={8} align="center" wrap>
            <Swatch color="cyan" />
            <Text size="small">GR</Text>
            <Swatch color="purple" />
            <Text size="small">Newtonian</Text>
            <Swatch color="orange" />
            <Text size="small">ISCO</Text>
          </Row>
        </Stack>
      </Grid>

      <Callout tone="info" title="Same initial conditions, different force law">
        Both integrations share M, L, u₀, and u′(0) = 0. GR adds +3M u² on the right-hand side,
        which produces periapsis advance relative to the closed Newtonian ellipse.
      </Callout>

      <H2>Current values</H2>
      <Table
        headers={["Quantity", "Formula / note", "Value"]}
        columnAlign={["left", "left", "right"]}
        rows={[
          ["Horizon rh", "2M", fmt(2 * Mc)],
          ["ISCO radius", "6M", fmt(6 * Mc)],
          ["L_ISCO", "2√3 M", fmt(Lisco)],
          ["u_stable", "(1 − √(1 − 12M²/L²))/(6M)", roots ? fmt(roots.stable, 5) : "—"],
          ["u_unstable", "(1 + √(1 − 12M²/L²))/(6M)", roots ? fmt(roots.unstable, 5) : "—"],
          ["u₀", "initial 1/r", fmt(u0c, 5)],
          ["r₀", "1/u₀", fmt(1 / u0c)],
          ["φ range", "notebook default", `0 … ${PHI_MAX}`],
        ]}
      />

      <H3>Orbit equations</H3>
      <Card>
        <CardHeader>u(φ) = 1/r form (G = c = 1)</CardHeader>
        <CardBody>
          <Stack gap={8}>
            <Text>
              <Code>GR: u'' + u = M/L² + 3 M u²</Code>
            </Text>
            <Text>
              <Code>Newtonian: u'' + u = M/L²</Code>
            </Text>
            <Text>
              <Code>u(0) = u₀, u'(0) = 0</Code>
            </Text>
            <Divider />
            <Text size="small" tone="secondary">
              Defaults match the notebook: M = 1, L = 4, u₀ = 1/12 + 10⁻⁶. Cartesian plot:
              x = cos φ / u, y = sin φ / u, z = 0.
            </Text>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}
