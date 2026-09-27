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
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const M = 1;
const CHI_MAX = 0.998;

type Vec3 = { x: number; y: number; z: number };

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

function shadowSilhouette(chi: number, thetaObs: number): { a: number; b: number }[] {
  const th = clamp(thetaObs, 0.12, Math.PI - 0.12);
  if (chi < 0.02) {
    const R = 3 * Math.sqrt(3) * M;
    const pts: { a: number; b: number }[] = [];
    for (let i = 0; i <= 72; i++) {
      const ang = (i / 72) * Math.PI * 2;
      pts.push({ a: R * Math.cos(ang), b: R * Math.sin(ang) });
    }
    return pts;
  }
  const spin = chi * M;
  const sinT = Math.sin(th);
  const cotT = Math.cos(th) / sinT;
  const r1 = rPro(chi) + 1e-4;
  const r2 = rRetro(chi) - 1e-4;
  const n = 72;
  const upper: { a: number; b: number }[] = [];
  const lower: { a: number; b: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const r = r1 + (r2 - r1) * (i / n);
    const xi = teoXi(r, spin);
    const eta = teoEta(r, spin);
    const disc = eta + spin * spin * Math.cos(th) ** 2 - xi * xi * cotT * cotT;
    if (disc < 0) continue;
    const alpha = -xi / sinT;
    const beta = Math.sqrt(disc);
    upper.push({ a: alpha, b: beta });
    lower.push({ a: alpha, b: -beta });
  }
  if (upper.length < 3) {
    const R = 3 * Math.sqrt(3) * M;
    return [
      { a: R, b: 0 },
      { a: 0, b: R },
      { a: -R, b: 0 },
      { a: 0, b: -R },
      { a: R, b: 0 },
    ];
  }
  return [...upper, ...lower.reverse()];
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

type Cam = { yaw: number; pitch: number; dist: number };

function toCamera(p: Vec3, cam: Cam): Vec3 {
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const x1 = p.x * cy - p.y * sy;
  const y1 = p.x * sy + p.y * cy;
  const z1 = p.z;
  return {
    x: x1,
    y: y1 * cp - z1 * sp,
    z: y1 * sp + z1 * cp,
  };
}

function project(p: Vec3, cam: Cam, width: number, height: number) {
  const c = toCamera(p, cam);
  const depth = cam.dist - c.y;
  const persp = cam.dist / Math.max(0.35, depth);
  const scale = (Math.min(width, height) * 0.4) / 8;
  return {
    x: width / 2 + c.x * scale * persp,
    y: height / 2 - c.z * scale * persp,
    depth: c.y,
    behind: depth < 0.2,
  };
}

function ringPoints(r: number, n: number, point: (r: number, theta: number, phi: number) => Vec3) {
  const pts: Vec3[] = [];
  for (let i = 0; i <= n; i++) {
    pts.push(point(r, Math.PI / 2, (i / n) * Math.PI * 2));
  }
  return pts;
}

function AxisGizmo({ cam }: { cam: Cam }) {
  const theme = useHostTheme();
  const cx = 48;
  const cy = 48;
  const radius = 28;
  const axes = [
    { label: "X", vec: { x: 1, y: 0, z: 0 }, color: theme.category.red },
    { label: "Y", vec: { x: 0, y: 1, z: 0 }, color: theme.category.green },
    { label: "Z", vec: { x: 0, y: 0, z: 1 }, color: theme.category.blue },
  ].map((axis) => {
    const c = toCamera(axis.vec, cam);
    return {
      ...axis,
      x: c.x * radius,
      y: -c.z * radius,
      depth: c.y,
    };
  });
  axes.sort((u, v) => u.depth - v.depth);

  return (
    <svg
      width={96}
      height={96}
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        pointerEvents: "none",
      }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={46}
        fill={theme.fill.tertiary}
        stroke={theme.stroke.tertiary}
        strokeWidth={1}
      />
      {axes.map((axis) => {
        const tx = cx + axis.x;
        const ty = cy + axis.y;
        const nx = axis.x / (Math.hypot(axis.x, axis.y) || 1);
        const ny = axis.y / (Math.hypot(axis.x, axis.y) || 1);
        const bx = tx - nx * 7;
        const by = ty - ny * 7;
        const px = -ny * 3.2;
        const py = nx * 3.2;
        const lx = tx + nx * 10;
        const ly = ty + ny * 10;
        return (
          <g key={axis.label}>
            <line
              x1={cx - axis.x * 0.35}
              y1={cy - axis.y * 0.35}
              x2={cx}
              y2={cy}
              stroke={axis.color}
              strokeWidth={1.5}
              strokeOpacity={0.35}
            />
            <line
              x1={cx}
              y1={cy}
              x2={bx}
              y2={by}
              stroke={axis.color}
              strokeWidth={2}
            />
            <polygon
              points={`${tx},${ty} ${bx + px},${by + py} ${bx - px},${by - py}`}
              fill={axis.color}
            />
            <text
              x={lx}
              y={ly}
              fill={axis.color}
              fontSize={11}
              fontWeight={590}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {axis.label}
            </text>
          </g>
        );
      })}
      <text
        x={cx}
        y={90}
        fill={theme.text.tertiary}
        fontSize={9}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        textAnchor="middle"
      >
        Z = spin
      </text>
    </svg>
  );
}

function polyToPath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ") + " Z";
}

function lineToPath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

type Layers = {
  horizon: boolean;
  prograde: boolean;
  retrograde: boolean;
  shadow: boolean;
  axis: boolean;
  photons: boolean;
};

type DrawItem = {
  z: number;
  node: ReactNode;
};

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
  const [size, setSize] = useState({ w: 720, h: 520 });
  const [cam, setCam] = useState<Cam>({ yaw: 0.55, pitch: 0.38, dist: 22 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const phaseRef = useRef(0);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: Math.max(320, rect.width), h: Math.max(360, rect.height) });
    };
    apply();
    const obs = new ResizeObserver(apply);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (autoRotate && !dragRef.current) {
        setCam((prev) => ({ ...prev, yaw: prev.yaw + dt * 0.22 }));
      }
      if (layers.photons) {
        phaseRef.current += dt;
        setPhase(phaseRef.current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [autoRotate, layers.photons, setCam]);

  const a = chi * M;
  const rH = rh(chi);
  const rP = rPro(chi);
  const rR = rRetro(chi);
  const thetaObs = Math.PI / 2 - cam.pitch;
  const silhouette = useMemo(() => shadowSilhouette(chi, thetaObs), [chi, thetaObs]);
  const colors = theme.category;

  const items = useMemo(() => {
    const { w, h } = size;
    const drawn: DrawItem[] = [];
    const key = { n: 0 };
    const nextKey = () => {
      key.n += 1;
      return `d${key.n}`;
    };

    const pushLine = (pts: Vec3[], stroke: string, width: number, opacity: number) => {
      const proj = pts.map((p) => project(p, cam, w, h)).filter((p) => !p.behind);
      if (proj.length < 2) return;
      const z = proj.reduce((s, p) => s + p.depth, 0) / proj.length;
      drawn.push({
        z,
        node: (
          <path
            key={nextKey()}
            d={lineToPath(proj)}
            fill="none"
            stroke={stroke}
            strokeWidth={width}
            strokeOpacity={opacity}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ),
      });
    };

    const pushFill = (pts: Vec3[], fill: string, opacity: number, stroke?: string) => {
      const proj = pts.map((p) => project(p, cam, w, h)).filter((p) => !p.behind);
      if (proj.length < 3) return;
      const z = proj.reduce((s, p) => s + p.depth, 0) / proj.length;
      drawn.push({
        z,
        node: (
          <path
            key={nextKey()}
            d={polyToPath(proj)}
            fill={fill}
            fillOpacity={opacity}
            stroke={stroke ?? "none"}
            strokeWidth={stroke ? 1 : 0}
            strokeOpacity={0.85}
          />
        ),
      });
    };

    if (layers.shadow && silhouette.length > 3) {
      const worldShadow: Vec3[] = silhouette.map((p) => {
        const cy = Math.cos(-cam.yaw);
        const sy = Math.sin(-cam.yaw);
        const cp = Math.cos(-cam.pitch);
        const sp = Math.sin(-cam.pitch);
        let x = p.a;
        let y = 0;
        let z = p.b;
        const y1 = y * cp - z * sp;
        const z1 = y * sp + z * cp;
        const x2 = x * cy - y1 * sy;
        const y2 = x * sy + y1 * cy;
        return { x: x2, y: y2, z: z1 };
      });
      pushFill(worldShadow, colors.purple, 0.12, colors.purple);
      pushLine(worldShadow, colors.purple, 2.2, 0.95);
    }

    const meshSurface = (
      r: number,
      nTh: number,
      nPh: number,
      fill: string,
      opacity: number,
      point: (r: number, theta: number, phi: number) => Vec3,
    ) => {
      for (let i = 0; i < nTh; i++) {
        const t0 = (i / nTh) * Math.PI;
        const t1 = ((i + 1) / nTh) * Math.PI;
        for (let j = 0; j < nPh; j++) {
          const p0 = (j / nPh) * Math.PI * 2;
          const p1 = ((j + 1) / nPh) * Math.PI * 2;
          const a0 = point(r, t0, p0);
          const a1 = point(r, t0, p1);
          const a2 = point(r, t1, p1);
          const a3 = point(r, t1, p0);
          const c0 = toCamera(a0, cam);
          const c1 = toCamera(a1, cam);
          const c2 = toCamera(a2, cam);
          const e1x = c1.x - c0.x;
          const e1y = c1.y - c0.y;
          const e1z = c1.z - c0.z;
          const e2x = c2.x - c0.x;
          const e2y = c2.y - c0.y;
          const e2z = c2.z - c0.z;
          const ny = e1z * e2x - e1x * e2z;
          if (ny <= 0) continue;
          const z = (c0.y + c1.y + c2.y) / 3;
          const q0 = project(a0, cam, w, h);
          const q1 = project(a1, cam, w, h);
          const q2 = project(a2, cam, w, h);
          const q3 = project(a3, cam, w, h);
          if (q0.behind && q1.behind && q2.behind) continue;
          drawn.push({
            z,
            node: (
              <polygon
                key={nextKey()}
                points={`${q0.x},${q0.y} ${q1.x},${q1.y} ${q2.x},${q2.y} ${q3.x},${q3.y}`}
                fill={fill}
                fillOpacity={opacity}
                stroke={fill}
                strokeWidth={0.4}
                strokeOpacity={opacity * 0.8}
              />
            ),
          });
        }
      }
    };

    const wireSphere = (
      r: number,
      stroke: string,
      meridians: number,
      parallels: number,
      point: (r: number, theta: number, phi: number) => Vec3,
    ) => {
      for (let m = 0; m < meridians; m++) {
        const phi = (m / meridians) * Math.PI * 2;
        const pts: Vec3[] = [];
        for (let i = 0; i <= 28; i++) {
          pts.push(point(r, (i / 28) * Math.PI, phi));
        }
        pushLine(pts, stroke, 1, 0.55);
      }
      for (let p = 1; p < parallels; p++) {
        const theta = (p / parallels) * Math.PI;
        const pts: Vec3[] = [];
        for (let i = 0; i <= 48; i++) {
          pts.push(point(r, theta, (i / 48) * Math.PI * 2));
        }
        pushLine(pts, stroke, 1, p === parallels / 2 ? 0.9 : 0.4);
      }
    };

    const kerrPoint = (r: number, theta: number, phi: number) => kerrCart(r, theta, phi, a);

    if (layers.retrograde) {
      wireSphere(rR, colors.orange, 10, 8, kerrPoint);
      pushLine(ringPoints(rR, 96, kerrPoint), colors.orange, 2.4, 1);
    }
    if (layers.prograde) {
      wireSphere(rP, colors.cyan, 10, 8, kerrPoint);
      pushLine(ringPoints(rP, 96, kerrPoint), colors.cyan, 2.4, 1);
    }
    if (layers.horizon) {
      const hole = theme.kind === "light" ? theme.text.primary : theme.bg.chrome;
      meshSurface(rH, 16, 32, hole, 1, sphereCart);
      wireSphere(rH, theme.text.secondary, 10, 8, sphereCart);
      pushLine(ringPoints(rH, 64, sphereCart), theme.text.secondary, 1.4, 0.7);
    }
    if (layers.axis) {
      pushLine(
        [
          { x: 0, y: 0, z: -7.2 },
          { x: 0, y: 0, z: 7.2 },
        ],
        theme.text.tertiary,
        1,
        0.7,
      );
      const tip = project({ x: 0, y: 0, z: 7.2 }, cam, w, h);
      if (!tip.behind) {
        drawn.push({
          z: toCamera({ x: 0, y: 0, z: 7.2 }, cam).y,
          node: (
            <text
              key={nextKey()}
              x={tip.x + 6}
              y={tip.y - 4}
              fill={theme.text.tertiary}
              fontSize={11}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              spin
            </text>
          ),
        });
      }
    }

    if (layers.photons) {
      const omegaP = 1 / (rP ** 1.5 + a);
      const omegaR = 1 / (rR ** 1.5 - a);
      const phiP = phase * omegaP * 2.8;
      const phiR = -phase * omegaR * 2.8;
      const pP = kerrCart(rP, Math.PI / 2, phiP, a);
      const pR = kerrCart(rR, Math.PI / 2, phiR, a);
      const qP = project(pP, cam, w, h);
      const qR = project(pR, cam, w, h);
      if (layers.prograde && !qP.behind) {
        drawn.push({
          z: toCamera(pP, cam).y + 0.4,
          node: <circle key={nextKey()} cx={qP.x} cy={qP.y} r={4.5} fill={colors.cyan} />,
        });
      }
      if (layers.retrograde && !qR.behind) {
        drawn.push({
          z: toCamera(pR, cam).y + 0.4,
          node: <circle key={nextKey()} cx={qR.x} cy={qR.y} r={4.5} fill={colors.orange} />,
        });
      }
    }

    drawn.sort((u, v) => u.z - v.z);
    return drawn.map((d) => d.node);
  }, [a, cam, chi, colors, layers, phase, rH, rP, rR, silhouette, size, theme]);

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
        dragRef.current = { x: event.clientX, y: event.clientY, yaw: cam.yaw, pitch: cam.pitch };
        setDragging(true);
      }}
      onPointerMove={(event: { clientX: number; clientY: number }) => {
        const start = dragRef.current;
        if (!start) return;
        const dyaw = (event.clientX - start.x) * 0.008;
        const dpitch = (event.clientY - start.y) * 0.008;
        setCam({
          ...cam,
          yaw: start.yaw + dyaw,
          pitch: clamp(start.pitch + dpitch, -1.15, 1.15),
        });
      }}
      onPointerUp={() => {
        dragRef.current = null;
        setDragging(false);
      }}
      onWheel={(event: { preventDefault: () => void; deltaY: number }) => {
        event.preventDefault();
        setCam((prev) => ({
          ...prev,
          dist: clamp(prev.dist + event.deltaY * 0.02, 12, 40),
        }));
      }}
    >
      <svg width={size.w} height={size.h} style={{ display: "block" }}>
        {items}
      </svg>
      <AxisGizmo cam={cam} />
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          display: "flex",
          flexDirection: "column",
          gap: 4,
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
  const shadowDims = shadowWidth(chiClamped, Math.PI / 2);

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
        the equator of a spinning hole.
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
