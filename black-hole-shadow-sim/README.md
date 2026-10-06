# Black hole shadow sim

Versioned sources for the analytic Kerr / black-hole shadow visualization.

## Layout

```
black-hole-shadow-sim/
  v1/                         # earlier HTML + canvas
  v2/
    kerr-black-hole.canvas.tsx
    v2.1/
      kerr-black-hole.canvas.tsx
      v2index.html            # browser page snapshot for v2.1
```

The root-level `v2/` tree was merged into `v2/` here so canvas and HTML history sit in one place. The live GitHub Pages entry remains the repo-root `index.html`.
