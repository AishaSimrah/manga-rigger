const clamp01 = (v) => Math.min(1, Math.max(0, v));

function boxFromPoints(a, b) {
  const x0 = clamp01(Math.min(a.x, b.x));
  const x1 = clamp01(Math.max(a.x, b.x));
  const y0 = clamp01(Math.min(a.y, b.y));
  const y1 = clamp01(Math.max(a.y, b.y));
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}

export function attachRigEditor(canvas, animator, getPart, onChange) {
  let start = null;

  const toNorm = (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    const L = animator.layout;
    return { x: (px - L.dx) / L.dw, y: (py - L.dy) / L.dh };
  };

  canvas.addEventListener("pointerdown", (e) => {
    if (animator.mode !== "rig" || !animator.img || !getPart()) return;
    canvas.setPointerCapture(e.pointerId);
    start = toNorm(e);
    animator.draft = boxFromPoints(start, start);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!start) return;
    animator.draft = boxFromPoints(start, toNorm(e));
  });

  canvas.addEventListener("pointerup", (e) => {
    if (!start) return;
    const box = boxFromPoints(start, toNorm(e));
    start = null;
    animator.draft = null;
    if (box.w < 0.01 || box.h < 0.01) return; // ignore accidental clicks
    onChange(getPart(), box);
  });
}
