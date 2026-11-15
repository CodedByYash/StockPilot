import { ImageResponse } from "next/og";

const INK = "#14171f";
const AMBER = "#d9a441";
const PAPER = "#ededea";

/**
 * Renders the app icon at a given pixel size: ink-navy background, an
 * amber ring (echoing the "stamp" signature element from Stamp.tsx), and
 * an "IM" monogram. No external font is loaded — Satori's default font
 * keeps this fully offline-capable, same reasoning as the system font
 * stacks in globals.css.
 */
export function renderIcon(size: number) {
  const ring = Math.round(size * 0.06);
  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: INK,
        }}
      >
        <div
          style={{
            width: size - ring * 4,
            height: size - ring * 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: size * 0.16,
            border: `${ring}px solid ${AMBER}`,
          }}
        >
          <span
            style={{
              fontSize: size * 0.34,
              fontWeight: 700,
              color: PAPER,
              letterSpacing: -1,
            }}
          >
            IM
          </span>
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
