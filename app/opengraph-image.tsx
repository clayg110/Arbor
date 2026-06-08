import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded social/preview card, generated at the edge (no static asset to ship).
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#faf9f6",
        padding: "80px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "#185fa5",
          }}
        />
        <div style={{ fontSize: 40, fontWeight: 600, color: "#1a1a18" }}>{SITE.name}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontSize: 64, fontWeight: 600, color: "#1a1a18", lineHeight: 1.1 }}>
          {SITE.tagline}
        </div>
        <div style={{ fontSize: 30, color: "#6f6e68", maxWidth: 900 }}>
          Carve-outs and private-asset exits, tracked in real time.
        </div>
      </div>
    </div>,
    { ...size }
  );
}
