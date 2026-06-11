"use client";

export default function PrintTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        padding: "6px 14px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        color: "white",
        backgroundColor: "#185FA5",
        border: "none",
        cursor: "pointer",
      }}
    >
      Print / Save PDF
    </button>
  );
}
