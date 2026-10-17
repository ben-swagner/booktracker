import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

const OUT = 400; // Größe des fertigen Bildes in Pixeln
const MAX_ZOOM = 5;

/**
 * Profilbild zuschneiden: Bild im runden Ausschnitt verschieben (ziehen), vergrößern
 * (Regler, Mausrad oder mit zwei Fingern) und drehen. Ergebnis ist ein quadratisches JPEG.
 */
export function PhotoCropper({ src, onCancel, onDone }: { src: string; onCancel: () => void; onDone: (dataUrl: string) => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [rot, setRot] = useState(0); // 0, 1, 2, 3 = Vierteldrehungen
  const [size, setSize] = useState(300);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.onerror = () => setFailed(true);
    i.src = src;
  }, [src]);

  // Ausschnitt so groß wie möglich, höchstens 320 px
  useEffect(() => {
    const fit = () => setSize(Math.max(200, Math.min(320, window.innerWidth - 72)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Esc schließt
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onCancel]);

  const iw = img ? (rot % 2 ? img.naturalHeight : img.naturalWidth) : 1;
  const ih = img ? (rot % 2 ? img.naturalWidth : img.naturalHeight) : 1;
  const base = size / Math.min(iw, ih); // Grundgröße: Bild füllt den Ausschnitt gerade so
  const dw = iw * base * zoom, dh = ih * base * zoom;

  // Das Bild darf nie eine Lücke im Ausschnitt lassen
  const clamp = (p: { x: number; y: number }, z = zoom) => {
    const mx = Math.max(0, (iw * base * z - size) / 2), my = Math.max(0, (ih * base * z - size) / 2);
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) };
  };
  const setZoomTo = (z: number) => { const nz = Math.max(1, Math.min(MAX_ZOOM, z)); setZoom(nz); setPos((p) => clamp(p, nz)); };
  useEffect(() => { setPos((p) => clamp(p)); }, [rot, size]); // eslint-disable-line react-hooks/exhaustive-deps

  function down(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  }
  function move(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      setZoomTo(pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist));
      return;
    }
    setPos((p) => clamp({ x: p.x + now.x - prev.x, y: p.y + now.y - prev.y }));
  }
  function up(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  // Mausrad zoomt (passiv geht hier nicht, deshalb von Hand angemeldet)
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const w = (e: WheelEvent) => { e.preventDefault(); setZoomTo(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); };
    el.addEventListener("wheel", w, { passive: false });
    return () => el.removeEventListener("wheel", w);
  });

  function key(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 20 : 6;
    const map: Record<string, () => void> = {
      ArrowLeft: () => setPos((p) => clamp({ ...p, x: p.x - step })),
      ArrowRight: () => setPos((p) => clamp({ ...p, x: p.x + step })),
      ArrowUp: () => setPos((p) => clamp({ ...p, y: p.y - step })),
      ArrowDown: () => setPos((p) => clamp({ ...p, y: p.y + step })),
      "+": () => setZoomTo(zoom * 1.1), "=": () => setZoomTo(zoom * 1.1), "-": () => setZoomTo(zoom / 1.1)
    };
    if (map[e.key]) { e.preventDefault(); map[e.key](); }
  }

  function done() {
    if (!img) return;
    const c = document.createElement("canvas");
    c.width = OUT; c.height = OUT;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, OUT, OUT);
    ctx.imageSmoothingQuality = "high";
    const k = OUT / size, s = base * zoom * k;
    ctx.translate(OUT / 2 + pos.x * k, OUT / 2 + pos.y * k);
    ctx.rotate((rot * Math.PI) / 2);
    ctx.drawImage(img, (-img.naturalWidth * s) / 2, (-img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    onDone(c.toDataURL("image/jpeg", 0.88));
  }

  return createPortal(
    <div className="modal-bg" onClick={onCancel}>
      <div className="modal crop-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Profilbild zuschneiden">
        <div className="section-head"><h2 style={{ margin: 0 }}>Bild zuschneiden</h2></div>
        <p className="muted" style={{ margin: 0 }}>Zieh das Bild an die richtige Stelle und zoom mit dem Regler{typeof window !== "undefined" && "ontouchstart" in window ? " oder mit zwei Fingern" : " oder dem Mausrad"}.</p>
        {failed ? <p>Das Bild konnte nicht geöffnet werden. Probier bitte ein anderes.</p> : (
          <div ref={boxRef} className="crop-box" style={{ width: size, height: size }} tabIndex={0} onKeyDown={key}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Ausschnitt. Mit den Pfeiltasten verschieben, mit Plus und Minus zoomen.">
            {img && (
              <img src={src} alt="" draggable={false} className="crop-img"
                style={{ width: rot % 2 ? dh : dw, height: rot % 2 ? dw : dh, transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) rotate(${rot * 90}deg)` }} />
            )}
            <span className="crop-mask" aria-hidden="true" />
          </div>
        )}
        <div className="crop-tools">
          <button type="button" className="btn small ghost" onClick={() => setZoomTo(zoom / 1.2)} aria-label="Kleiner">−</button>
          <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} onChange={(e) => setZoomTo(Number(e.target.value))} aria-label="Zoom" />
          <button type="button" className="btn small ghost" onClick={() => setZoomTo(zoom * 1.2)} aria-label="Größer">+</button>
          <button type="button" className="btn small" onClick={() => setRot((r) => (r + 1) % 4)} title="Um 90 Grad drehen"><Icon name="repeat" size={14} /> Drehen</button>
        </div>
        <div className="actions" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn ghost" onClick={onCancel}>Abbrechen</button>
          <button type="button" className="btn primary" onClick={done} disabled={!img}>Übernehmen</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
