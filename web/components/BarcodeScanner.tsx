"use client";

import { useState } from "react";
import { useZxing } from "react-zxing";

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  /** Paused while a lookup/result is being shown, so the same code doesn't fire repeatedly. */
  paused?: boolean;
}

/**
 * Thin wrapper around react-zxing's useZxing hook. That hook already
 * ponyfills the native BarcodeDetector API where the browser supports it
 * (fast, no WASM download) and falls back to a WASM zxing decoder where it
 * doesn't (e.g. desktop Safari, Firefox) — so this component doesn't need
 * its own native-vs-fallback branching, just camera permission handling.
 */
export function BarcodeScanner({ onDetected, paused }: BarcodeScannerProps) {
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const { ref } = useZxing({
    paused,
    onDecodeResult(result) {
      onDetected(result.rawValue);
    },
    onError(error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "NotAllowedError") {
        setPermissionError("Camera access was denied. Allow camera permission and reload to scan.");
      } else if (name === "NotFoundError") {
        setPermissionError("No camera was found on this device.");
      } else {
        setPermissionError("Couldn't access the camera.");
      }
    },
  });

  if (permissionError) {
    return (
      <div className="aspect-[4/3] w-full rounded-sm border border-red-dim bg-red-dim/20 flex items-center justify-center px-6 text-center">
        <p className="text-sm text-red">{permissionError}</p>
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/3] w-full rounded-sm border border-rule overflow-hidden bg-ink">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={ref} className="h-full w-full object-cover" muted playsInline />
      {/* Scan-line guide — purely visual, ties back to the barcode/ledger motif */}
      <div className="pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 h-px bg-amber/70" />
      <div className="pointer-events-none absolute inset-8 border border-paper/20 rounded-sm" />
    </div>
  );
}
