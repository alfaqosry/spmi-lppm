import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon (dibangkitkan saat build, tanpa layanan eksternal). */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
      }}
    >
      <svg width="120" height="120" viewBox="0 0 64 64">
        <path
          d="M32 12 L48 18 V31 C48 41 41 48.5 32 52 C23 48.5 16 41 16 31 V18 Z"
          fill="none"
          stroke="#fff"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <path
          d="M24.5 32 L30 37.5 L40 26.5"
          fill="none"
          stroke="#fff"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>,
    size
  );
}
