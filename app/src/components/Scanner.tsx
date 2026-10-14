import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { cleanIsbn } from "../lib/isbn";

/**
 * Barcode-Scanner für die Buchrückseite.
 * 1. Wenn der Browser selbst Strichcodes lesen kann (Chrome, Android, neuere Safari), nutzen wir das: schnell und genau.
 * 2. Sonst die ZXing-Bibliothek mit hoher Auflösung.
 * Dazu: Taschenlampe (wo möglich) und Eingabe von Hand als Ausweg.
 */
export function Scanner({ onResult, onClose }: { onResult: (isbn: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Kamera wird gestartet…");
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState<boolean | null>(null);
  const [manual, setManual] = useState("");
  const trackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    let stopped = false;
    let controls: IScannerControls | null = null;
    let stream: MediaStream | null = null;
    let raf = 0;

    const finish = (text: string) => {
      const isbn = cleanIsbn(text);
      if (!isbn) { setStatus("Das ist kein Buch-Strichcode (ISBN), weiter suchen…"); return false; }
      stopped = true;
      if (navigator.vibrate) navigator.vibrate(60);
      onResult(isbn);
      return true;
    };

    const setupTorch = (s: MediaStream) => {
      const track = s.getVideoTracks()[0];
      trackRef.current = track;
      const caps: any = track.getCapabilities?.() ?? {};
      setTorch(caps.torch ? false : null);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Dieser Browser kann die Kamera nicht öffnen.");
        const constraints: MediaStreamConstraints = {
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 }, // @ts-ignore
            focusMode: "continuous" }
        };
        const Detector = (window as any).BarcodeDetector;
        let formats: string[] = [];
        if (Detector) { try { formats = await Detector.getSupportedFormats(); } catch { formats = []; } }

        if (Detector && formats.includes("ean_13")) {
          // Weg 1: eingebaute Erkennung
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          const video = videoRef.current!;
          video.srcObject = stream;
          await video.play();
          setupTorch(stream);
          setStatus("Halte den Strichcode auf der Buchrückseite ruhig in den Rahmen.");
          const det = new Detector({ formats: ["ean_13", "ean_8", "upc_a"] });
          let busy = false;
          const loop = async () => {
            if (stopped) return;
            if (!busy && video.readyState >= 2) {
              busy = true;
              try {
                const codes = await det.detect(video);
                for (const c of codes) if (finish(c.rawValue)) return;
              } catch { /* nächster Versuch */ }
              busy = false;
            }
            raf = requestAnimationFrame(loop);
          };
          loop();
        } else {
          // Weg 2: ZXing
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]);
          hints.set(DecodeHintType.TRY_HARDER, true);
          const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
          setStatus("Halte den Strichcode auf der Buchrückseite ruhig in den Rahmen.");
          controls = await reader.decodeFromConstraints(constraints, videoRef.current!, (result) => {
            if (stopped || !result) return;
            if (finish(result.getText())) controls?.stop();
          });
          const s = (videoRef.current?.srcObject as MediaStream | null);
          if (s) setupTorch(s);
        }
      } catch (e: any) {
        const msg = String(e?.name ?? e?.message ?? e);
        if (/NotAllowed|Permission/i.test(msg)) setError("Die Kamera wurde nicht freigegeben. Erlaube den Zugriff in den Browser-Einstellungen und versuch es noch einmal.");
        else if (/NotFound|Devices/i.test(msg)) setError("Keine Kamera gefunden.");
        else setError(e?.message ?? "Die Kamera konnte nicht gestartet werden.");
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      controls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
      (videoRef.current?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as any] });
      setTorch(!torch);
    } catch { /* keine Lampe */ }
  }

  return (
    <div className="scanner" role="dialog" aria-label="Barcode scannen">
      <div className="scanner-top">
        <strong>ISBN scannen</strong>
        <div className="actions">
          {torch != null && <button type="button" className="btn small" onClick={toggleTorch}>{torch ? "Licht aus" : "Licht an"}</button>}
          <button type="button" className="btn small" onClick={onClose}>Schließen</button>
        </div>
      </div>
      <div className="scanner-view">
        <video ref={videoRef} playsInline muted autoPlay />
        <div className="scanner-frame" />
      </div>
      <div className="scanner-bottom">
        <p className="scanner-status">{error ?? status}</p>
        <p className="scanner-tip">Tipp: 15 bis 20 cm Abstand, der Code waagerecht und ganz im Rahmen, kein Gegenlicht. Bei glänzender Folie das Buch leicht kippen.</p>
        <form className="actions" style={{ justifyContent: "center" }} onSubmit={(e) => { e.preventDefault(); const isbn = cleanIsbn(manual); if (isbn) onResult(isbn); else setStatus("Diese Nummer ist keine gültige ISBN."); }}>
          <input className="input" style={{ maxWidth: 220, background: "rgba(255,255,255,.12)", color: "#fff", borderColor: "transparent" }} inputMode="numeric" placeholder="oder ISBN eintippen" value={manual} onChange={(e) => setManual(e.target.value)} />
          <button type="submit" className="btn small" style={{ background: "rgba(255,255,255,.15)", borderColor: "transparent", color: "#fff" }}>Übernehmen</button>
        </form>
      </div>
    </div>
  );
}
