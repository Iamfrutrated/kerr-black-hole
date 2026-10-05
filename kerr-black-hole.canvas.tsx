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
  LineChart,
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

const M = 1;
const CHI_MAX = 0.998;
/** Reference camera distance for the mild perspective falloff. */
const REF_DIST = 22;
/** World radius (in units of M) that fits the viewport at zoom = 1. */
const FIT_RADIUS = 10.2;

type Vec3 = { x: number; y: number; z: number };
type SkyPoint = { a: number; b: number };

function clamp(value: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, value));
}

function rh(chi: number) {
  return M * (1 + Math.sqrt(Math.max(0, 1 - chi * chi)));
}

function rPro(chi: number) {
  return 2 * M * (1 + Math.cos((2 / 3) * Math.acos(-chi)));
}

function rRetro(chi: number) {
  return 2 * M * (1 + Math.cos((2 / 3) * Math.acos(chi)));
}

/** Ordinary sphere of radius r. */
function sphereCart(r: number, theta: number, phi: number): Vec3 {
  const s = Math.sin(theta);
  return {
    x: r * s * Math.cos(phi),
    y: r * s * Math.sin(phi),
    z: r * Math.cos(theta),
  };
}

/** Kerr–Schild / Boyer–Lindquist Cartesian embedding of constant r. */
function kerrCart(r: number, theta: number, phi: number, a: number): Vec3 {
  const rho = Math.sqrt(r * r + a * a);
  const s = Math.sin(theta);
  return {
    x: rho * s * Math.cos(phi),
    y: rho * s * Math.sin(phi),
    z: r * Math.cos(theta),
  };
}

function teoXi(r: number, a: number) {
  return -(r ** 3 - 3 * M * r ** 2 + a * a * r + a * a * M) / (a * (r - M));
}

function teoEta(r: number, a: number) {
  return (r ** 3 * (4 * a * a * M - r * (r - 3 * M) ** 2)) / (a * a * (r - M) ** 2);
}

/**
 * Shadow edge (critical curve) on the observer's sky in Bardeen's (α, β)
 * impact parameters, parametrised by the radius r of the unstable spherical
 * photon orbit. The valid r-range is located by root-finding and sampled
 * with cosine spacing so both ends of the D close smoothly at β = 0 instead
 * of ending in a straight chord.
 */
function shadowSilhouette(chi: number, thetaObs: number): SkyPoint[] {
  const th = clamp(thetaObs, 0.05, Math.PI - 0.05);
  const n = 128;
  const circle = (R: number): SkyPoint[] => {
    const pts: SkyPoint[] = [];
    for (let i = 0; i <= n; i++) {
      const ang = (i / n) * Math.PI * 2;
      pts.push({ a: R * Math.cos(ang), b: R * Math.sin(ang) });
    }
    return pts;
  };
  if (chi < 1e-3) return circle(3 * Math.sqrt(3) * M);

  const spin = chi * M;
  const sinT = Math.sin(th);
  const cosT = Math.cos(th);
  const cot2 = (cosT * cosT) / (sinT * sinT);
  const disc = (r: number) => {
    const xi = teoXi(r, spin);
    return teoEta(r, spin) + spin * spin * cosT * cosT - xi * xi * cot2;
  };

  const rLo = rPro(chi);
  const rHi = rRetro(chi);
  const N = 256;
  const grid = (i: number) => rLo + ((rHi - rLo) * i) / N;
  let iFirst = -1;
  let iLast = -1;
  for (let i = 0; i <= N; i++) {
    if (disc(grid(i)) >= 0) {
      if (iFirst < 0) iFirst = i;
      iLast = i;
    }
  }
  if (iFirst < 0) return circle(3 * Math.sqrt(3) * M);

  let rMin = grid(iFirst);
  if (iFirst > 0) {
    let lo = grid(iFirst - 1);
    let hi = rMin;
    for (let k = 0; k < 40; k++) {
      const mid = 0.5 * (lo + hi);
      if (disc(mid) >= 0) hi = mid;
      else lo = mid;
    }
    rMin = hi;
  }
  let rMax = grid(iLast);
  if (iLast < N) {
    let lo = rMax;
    let hi = grid(iLast + 1);
    for (let k = 0; k < 40; k++) {
      const mid = 0.5 * (lo + hi);
      if (disc(mid) >= 0) lo = mid;
      else hi = mid;
    }
    rMax = lo;
  }

  const upper: SkyPoint[] = [];
  const lower: SkyPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = 0.5 * (1 - Math.cos((Math.PI * i) / n));
    const r = rMin + (rMax - rMin) * t;
    const alpha = -teoXi(r, spin) / sinT;
    const beta = Math.sqrt(Math.max(0, disc(r)));
    upper.push({ a: alpha, b: beta });
    lower.push({ a: alpha, b: -beta });
  }
  lower.reverse();
  return upper.concat(lower);
}

let silhouetteKey = "";
let silhouettePts: SkyPoint[] = [];
function silhouetteCached(chi: number, thetaObs: number): SkyPoint[] {
  const key = `${chi.toFixed(4)}|${thetaObs.toFixed(3)}`;
  if (key !== silhouetteKey) {
    silhouetteKey = key;
    silhouettePts = shadowSilhouette(chi, thetaObs);
  }
  return silhouettePts;
}

function shadowWidth(chi: number, thetaObs: number) {
  const pts = shadowSilhouette(chi, thetaObs);
  let minA = Infinity;
  let maxA = -Infinity;
  let maxR = 0;
  for (const p of pts) {
    minA = Math.min(minA, p.a);
    maxA = Math.max(maxA, p.a);
    maxR = Math.max(maxR, Math.hypot(p.a, p.b));
  }
  return { left: minA, right: maxA, radius: maxR, diameter: maxA - minA };
}

function fmt(value: number) {
  return `${value.toFixed(3)} M`;
}

type Cam = { yaw: number; pitch: number; zoom: number };

type Layers = {
  horizon: boolean;
  prograde: boolean;
  retrograde: boolean;
  shadow: boolean;
  axis: boolean;
  photons: boolean;
};
type LayerKey = keyof Layers;

type Theme = ReturnType<typeof useHostTheme>;

/** A polyline in world space. Geometry is built once per spin value. */
type Line = { layer: LayerKey; pts: Vec3[]; width: number; alpha: number };
type Geometry = { a: number; rH: number; rP: number; rR: number; lines: Line[] };

function wireLines(
  r: number,
  point: (r: number, theta: number, phi: number) => Vec3,
  layer: LayerKey,
  ringWidth: number,
  ringAlpha: number,
): Line[] {
  const lines: Line[] = [];
  const meridians = 10;
  const parallels = 8;
  for (let m = 0; m < meridians; m++) {
    const phi = (m / meridians) * Math.PI * 2;
    const pts: Vec3[] = [];
    for (let i = 0; i <= 32; i++) pts.push(point(r, (i / 32) * Math.PI, phi));
    lines.push({ layer, pts, width: 1, alpha: 0.55 });
  }
  for (let p = 1; p < parallels; p++) {
    if (p * 2 === parallels) continue;
    const theta = (p / parallels) * Math.PI;
    const pts: Vec3[] = [];
    for (let i = 0; i <= 48; i++) pts.push(point(r, theta, (i / 48) * Math.PI * 2));
    lines.push({ layer, pts, width: 1, alpha: 0.4 });
  }
  const ring: Vec3[] = [];
  for (let i = 0; i <= 96; i++) ring.push(point(r, Math.PI / 2, (i / 96) * Math.PI * 2));
  lines.push({ layer, pts: ring, width: ringWidth, alpha: ringAlpha });
  return lines;
}

function buildGeometry(chi: number): Geometry {
  const a = chi * M;
  const rH = rh(chi);
  const rP = rPro(chi);
  const rR = rRetro(chi);
  const kerrPoint = (r: number, theta: number, phi: number) => kerrCart(r, theta, phi, a);
  const axis: Vec3[] = [];
  for (let i = 0; i <= 8; i++) axis.push({ x: 0, y: 0, z: -7.2 + (14.4 * i) / 8 });
  const lines: Line[] = [
    ...wireLines(rR, kerrPoint, "retrograde", 2.4, 1),
    ...wireLines(rP, kerrPoint, "prograde", 2.4, 1),
    ...wireLines(rH, sphereCart, "horizon", 1.4, 0.7),
    { layer: "axis", pts: axis, width: 1, alpha: 0.7 },
  ];
  return { a, rH, rP, rR, lines };
}

type Pt = { x: number; y: number; d: number };

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
  return {
    x: x1,
    y: y1 * cp - p.z * sp,
    z: y1 * sp + p.z * cp,
  };
}

/** Builds a world→screen projector with the camera trig precomputed. */
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
    const persp = 1 / Math.max(0.72, 1 - 0.12 * (d / REF_DIST));
    return { x: cx + x1 * k * persp, y: cz - z * k * persp, d };
  };
}

/** Adds the segments of a projected polyline that lie in front of / behind the hole. */
function addSegments(ctx: CanvasRenderingContext2D, pts: Pt[], front: boolean): boolean {
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
    } else {
      open = false;
    }
  }
  return any;
}

type SceneState = {
  chi: number;
  layers: Layers;
  autoRotate: boolean;
  geom: Geometry;
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
  const { chi, layers, geom, theme } = s;
  const col = theme.category;
  const tf = makeTransform(cam, w, h);
  const k = screenScale(cam.zoom, w, h);

  // Shadow: the critical curve lives on the observer's sky plane, so it is
  // drawn directly in screen space (β along the projected spin axis).
  if (layers.shadow) {
    const sil = silhouetteCached(chi, Math.PI / 2 - cam.pitch);
    ctx.beginPath();
    for (let i = 0; i < sil.length; i++) {
      const x = w / 2 + sil[i].a * k;
      const y = h / 2 - sil[i].b * k;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = col.purple;
    ctx.fill();
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = col.purple;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const lineColor = (layer: LayerKey) => {
    if (layer === "retrograde") return col.orange;
    if (layer === "prograde") return col.cyan;
    if (layer === "horizon") return theme.text.secondary;
    return theme.text.tertiary;
  };

  const projected: { line: Line; pts: Pt[] }[] = [];
  for (const line of geom.lines) {
    if (!layers[line.layer]) continue;
    projected.push({ line, pts: line.pts.map(tf) });
  }

  const pass = (front: boolean) => {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const { line, pts } of projected) {
      // The back hemisphere of the horizon is hidden by the opaque disk.
      if (line.layer === "horizon" && !front) continue;
      ctx.beginPath();
      if (!addSegments(ctx, pts, front)) continue;
      ctx.globalAlpha = line.alpha;
      ctx.strokeStyle = lineColor(line.layer);
      ctx.lineWidth = line.width;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  const dots: { p: Pt; color: string }[] = [];
  if (layers.photons) {
    const { a, rP, rR } = geom;
    if (layers.prograde) {
      const phiP = (phase * 2.8) / (rP ** 1.5 + a);
      dots.push({ p: tf(kerrCart(rP, Math.PI / 2, phiP, a)), color: col.cyan });
    }
    if (layers.retrograde) {
      const phiR = (-phase * 2.8) / (rR ** 1.5 - a);
      dots.push({ p: tf(kerrCart(rR, Math.PI / 2, phiR, a)), color: col.orange });
    }
  }
  const drawDots = (front: boolean) => {
    for (const { p, color } of dots) {
      if (p.d >= 0 !== front) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  };

  pass(false);
  drawDots(false);

  if (layers.horizon) {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, geom.rH * k, 0, Math.PI * 2);
    ctx.fillStyle = theme.kind === "light" ? theme.text.primary : theme.bg.chrome;
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = theme.text.secondary;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  pass(true);
  drawDots(true);

  if (layers.axis) {
    const tip = tf({ x: 0, y: 0, z: 7.2 });
    ctx.fillStyle = theme.text.tertiary;
    ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("spin", tip.x + 6, tip.y - 4);
  }
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
  ctx.fillStyle = theme.text.tertiary;
  ctx.font = "9px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("Z = spin", cx, cy + 42);
}

function Viewport({
  chi,
  layers,
  autoRotate,
}: {
  chi: number;
  layers: Layers;
  autoRotate: boolean;
}) {
  const theme = useHostTheme();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<Cam>({ yaw: 0.55, pitch: 0.38, zoom: 1 });
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const phaseRef = useRef(0);
  const dirtyRef = useRef(true);
  const [dragging, setDragging] = useState(false);

  const geom = useMemo(() => buildGeometry(chi), [chi]);
  const stateRef = useRef<SceneState>({ chi, layers, autoRotate, geom, theme });
  stateRef.current = { chi, layers, autoRotate, geom, theme };
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
      cam.zoom = clamp(cam.zoom * Math.exp(-dy * 0.0018), 0.35, 3.5);
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
      const animating = (s.autoRotate && !dragRef.current) || s.layers.photons;
      if (s.autoRotate && !dragRef.current) cam.yaw += dt * 0.22;
      if (s.layers.photons) phaseRef.current += dt;
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
        cam.pitch = clamp(start.pitch + (event.clientY - start.y) * 0.008, -1.15, 1.15);
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
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          pointerEvents: "none",
        }}
      >
        <Text size="small" tone="tertiary">
          Drag to orbit · scroll to zoom · units of M
        </Text>
      </div>
    </div>
  );
}

export default function KerrBlackHoleModel() {
  const theme = useHostTheme();
  const [chi, setChi] = useCanvasState("chi", 0.8);
  const [autoRotate, setAutoRotate] = useCanvasState("autoRotate", true);
  const [horizon, setHorizon] = useCanvasState("layer-horizon", true);
  const [prograde, setPrograde] = useCanvasState("layer-pro", true);
  const [retrograde, setRetrograde] = useCanvasState("layer-retro", true);
  const [shadow, setShadow] = useCanvasState("layer-shadow", true);
  const [axis, setAxis] = useCanvasState("layer-axis", true);
  const [photons, setPhotons] = useCanvasState("layer-photons", true);

  const chiClamped = clamp(chi, 0, CHI_MAX);
  const rH = rh(chiClamped);
  const rP = rPro(chiClamped);
  const rR = rRetro(chiClamped);
  const shadowDims = useMemo(() => shadowWidth(chiClamped, Math.PI / 2), [chiClamped]);

  const chart = useMemo(() => {
    const categories: string[] = [];
    const horizonData: number[] = [];
    const proData: number[] = [];
    const retroData: number[] = [];
    const shadowData: number[] = [];
    for (let i = 0; i <= 20; i++) {
      const x = i / 20;
      const c = Math.min(x, CHI_MAX);
      categories.push(x.toFixed(2));
      horizonData.push(Number(rh(c).toFixed(3)));
      proData.push(Number(rPro(c).toFixed(3)));
      retroData.push(Number(rRetro(c).toFixed(3)));
      shadowData.push(Number(shadowWidth(c, Math.PI / 2).radius.toFixed(3)));
    }
    return { categories, horizonData, proData, retroData, shadowData };
  }, []);

  const layers: Layers = { horizon, prograde, retrograde, shadow, axis, photons };

  return (
    <Stack gap={20} style={{ maxWidth: 1100 }}>
      <Stack gap={6}>
        <H1>Kerr black hole</H1>
        <Text tone="secondary">
          Three-dimensional nested spheres for M = 1, with spin χ = a/M. The event horizon is a
          sphere of radius rh; photon spheres are constant-r Kerr surfaces. Drag the model to
          rotate. The triad in the top-right shows X, Y, and spin axis Z.
        </Text>
      </Stack>

      <Row gap={12} wrap>
        <Stat value={fmt(rH)} label="Event horizon rh" />
        <Stat value={fmt(rP)} label="Prograde photon sphere rPro" tone="info" />
        <Stat value={fmt(rR)} label="Retrograde photon sphere rRetro" tone="warning" />
        <Stat value={fmt(shadowDims.radius)} label="Shadow radius (observer sky)" />
      </Row>

      <Viewport chi={chiClamped} layers={layers} autoRotate={autoRotate} />

      <Grid columns="1.4fr 1fr" gap={16}>
        <Stack gap={12}>
          <H2>Spin χ = a/M</H2>
          <Row gap={10} align="center">
            <input
              type="range"
              min={0}
              max={CHI_MAX}
              step={0.002}
              value={chiClamped}
              onChange={(event: { target: { value: string } }) => setChi(Number(event.target.value))}
              style={{ flex: 1, accentColor: theme.accent.primary }}
              aria-label="Dimensionless spin"
            />
            <Text weight="semibold" style={{ width: 56, textAlign: "right" }}>
              {chiClamped.toFixed(3)}
            </Text>
          </Row>
          <Row gap={8} wrap>
            <Pill active={chiClamped < 0.02} onClick={() => setChi(0)}>
              Schwarzschild 0
            </Pill>
            <Pill active={Math.abs(chiClamped - 0.5) < 0.02} onClick={() => setChi(0.5)}>
              Moderate 0.5
            </Pill>
            <Pill active={Math.abs(chiClamped - 0.8) < 0.02} onClick={() => setChi(0.8)}>
              High 0.8
            </Pill>
            <Pill active={chiClamped > 0.93 && chiClamped < 0.96} onClick={() => setChi(0.94)}>
              Near-extremal 0.94
            </Pill>
            <Pill active={chiClamped >= 0.99} onClick={() => setChi(CHI_MAX)}>
              Extremal 0.998
            </Pill>
          </Row>
          <Row gap={10} align="center">
            <Text size="small">Auto-rotate</Text>
            <Toggle checked={autoRotate} onChange={setAutoRotate} />
            <Text size="small" tone="tertiary">
              Shadow table uses an equatorial observer (θ = 90°)
            </Text>
          </Row>
        </Stack>

        <Stack gap={10}>
          <H2>Surfaces</H2>
          <Checkbox checked={horizon} onChange={setHorizon} label="Event horizon rh" />
          <Checkbox checked={prograde} onChange={setPrograde} label="Prograde photon sphere rPro" />
          <Checkbox checked={retrograde} onChange={setRetrograde} label="Retrograde photon sphere rRetro" />
          <Checkbox checked={shadow} onChange={setShadow} label="Black hole shadow (critical curve)" />
          <Checkbox checked={photons} onChange={setPhotons} label="Orbiting photons" />
          <Checkbox checked={axis} onChange={setAxis} label="Spin axis in scene" />
          <Row gap={8} align="center" wrap>
            <Swatch color="gray" />
            <Text size="small">rh</Text>
            <Swatch color="cyan" />
            <Text size="small">rPro</Text>
            <Swatch color="orange" />
            <Text size="small">rRetro</Text>
            <Swatch color="purple" />
            <Text size="small">shadow</Text>
          </Row>
        </Stack>
      </Grid>

      <Callout tone="info" title="rh is the event horizon, not a photon sphere">
        The notebook defines rh as the outer Kerr horizon. Unstable circular photon orbits sit at
        rPro (co-rotating) and rRetro (counter-rotating). The shadow is the capture cross-section on
        the distant observer’s sky — larger than either photon sphere, and D-shaped when viewed near
        the equator of a spinning hole. It is drawn on the sky plane, so it follows your viewing
        inclination but not the hole’s rotation.
      </Callout>

      <H2>Radii versus spin</H2>
      <Text size="small" tone="secondary">
        Geometric radii in units of M. Photon-sphere curves from the notebook; shadow radius is the
        maximum impact parameter of the critical curve for an equatorial observer. Source: Kerr
        geodesic formulae (Bardeen 1973; Teo 2003).
      </Text>
      <LineChart
        categories={chart.categories}
        series={[
          { name: "Event horizon rh", data: chart.horizonData, tone: "neutral" },
          { name: "Prograde photon sphere rPro", data: chart.proData, tone: "info" },
          { name: "Retrograde photon sphere rRetro", data: chart.retroData, tone: "warning" },
          { name: "Shadow radius (equatorial)", data: chart.shadowData, tone: "danger" },
        ]}
        height={260}
        beginAtZero
        yMin={0}
        yMax={8}
        valueSuffix=" M"
      />
      <Text size="small" tone="tertiary">
        Horizontal axis: dimensionless spin χ = a/M. Vertical axis: radius (M).
      </Text>

      <H2>Current values</H2>
      <Table
        headers={["Surface", "Formula", "r / M"]}
        columnAlign={["left", "left", "right"]}
        rows={[
          ["Event horizon rh", "M (1 + √(1 − χ²))", rH.toFixed(4)],
          ["Prograde photon sphere rPro", "2M (1 + cos(⅔ arccos(−χ)))", rP.toFixed(4)],
          ["Retrograde photon sphere rRetro", "2M (1 + cos(⅔ arccos(χ)))", rR.toFixed(4)],
          ["Shadow, left edge α", "critical curve (Teo ξ, η)", shadowDims.left.toFixed(4)],
          ["Shadow, right edge α", "critical curve (Teo ξ, η)", shadowDims.right.toFixed(4)],
          ["Shadow diameter", "α_right − α_left", shadowDims.diameter.toFixed(4)],
        ]}
      />

      <H3>Equations (M = 1)</H3>
      <Card>
        <CardHeader>Notebook definitions</CardHeader>
        <CardBody>
          <Stack gap={8}>
            <Text>
              <Code>rh(χ) = M (1 + √(1 − χ²))</Code>
            </Text>
            <Text>
              <Code>rPro(χ) = 2M (1 + Cos[⅔ ArcCos[−χ]])</Code>
            </Text>
            <Text>
              <Code>rRetro(χ) = 2M (1 + Cos[⅔ ArcCos[χ]])</Code>
            </Text>
            <Divider />
            <Text size="small" tone="secondary">
              χ = 0 is Schwarzschild: rh = 2M, rPro = rRetro = 3M, shadow radius = 3√3 M ≈ 5.196 M.
              χ → 1 is extremal Kerr: rh = rPro = M, rRetro = 4M. Prograde photons hug the horizon;
              retrograde photons recede.
            </Text>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}
