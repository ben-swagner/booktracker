import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { cleanIsbn } from "../lib/isbn";

/**
 * Barcode-Scanner für die Buchrückseite. Öffnet die Kamera, erkennt den EAN-13-Strichcode
 * (das ist die ISBN) und meldet ihn zurück. Läuft auf Handy und am Computer mit Webcam.
 */
export function Scanner({ onResult, onClose }: { onResult: (isbn: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Kamera wird gestartet…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let controls: IScannerControls | null = null;
    let done = false;
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Dieser Browser kann die Kamera nicht öffnen.");
        setStatus("Halte den Strichcode auf der Buchrückseite in den Rahmen.");
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current!,
          (result) => {
            if (done || !result) return;
            const isbn = cleanIsbn(result.getText());
            if (!isbn) {
              setStatus("Das ist kein Buch-Strichcode, weiter suchen…");
              return;
            }
            done = true;
            if (navigator.vibrate) navigator.vibrate(60);
            controls?.stop();
            onResult(isbn);
          }
        );
      } catch (e: any) {
        const msg = String(e?.name ?? e?.message ?? e);
        if (/NotAllowed|Permission/i.test(msg)) setError("Die Kamera wurde nicht freigegeben. Erlaube den Zugriff in den Browser-Einstellungen und versuch es noch einmal.");
        else if (/NotFound|Devices/i.test(msg)) setError("Keine Kamera gefunden.");
        else setError(e?.message ?? "Die Kamera konnte nicht gestartet werden.");
      }
    })();

    return () => {
      done = true;
      controls?.stop();
    };
  }, [onResult]);

  return (
    <div className="scanner" role="dialog" aria-label="Barcode scannen">
      <div className="scanner-top">
        <strong>ISBN scannen</strong>
        <button type="button" className="btn small" onClick={onClose}>Schließen</button>
      </div>
      <div className="scanner-view">
        <video ref={videoRef} playsInline muted />
        <div className="scanner-frame" />
      </div>
      <p className="scanner-status">{error ?? status}</p>
    </div>
  );
}
