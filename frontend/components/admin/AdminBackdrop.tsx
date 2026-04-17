"use client";

/**
 * Ambient animated backdrop used by admin pages + login.
 * Three slow-moving blurred blobs over a warm cream base. Pure CSS; no JS loop.
 */
export function AdminBackdrop({ intense = false }: { intense?: boolean }) {
  const size = intense ? 520 : 420;
  return (
    <>
      <div aria-hidden style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "linear-gradient(180deg, #fdfbf9 0%, #fbf6ef 100%)",
      }} />
      <div aria-hidden style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden",
      }}>
        <span className="m4m-blob m4m-blob-1" style={{ width: size, height: size }} />
        <span className="m4m-blob m4m-blob-2" style={{ width: size * 0.8, height: size * 0.8 }} />
        <span className="m4m-blob m4m-blob-3" style={{ width: size * 0.6, height: size * 0.6 }} />
      </div>
      <style jsx>{`
        .m4m-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          opacity: 0.42;
          will-change: transform;
        }
        .m4m-blob-1 {
          top: -120px; left: -100px;
          background: radial-gradient(circle, #ffb9c8, transparent 60%);
          animation: m4m-drift-a 22s ease-in-out infinite alternate;
        }
        .m4m-blob-2 {
          top: 30%; right: -160px;
          background: radial-gradient(circle, #ffe3b8, transparent 60%);
          animation: m4m-drift-b 28s ease-in-out infinite alternate;
        }
        .m4m-blob-3 {
          bottom: -80px; left: 30%;
          background: radial-gradient(circle, #d8c3ff, transparent 60%);
          animation: m4m-drift-c 32s ease-in-out infinite alternate;
        }
        @keyframes m4m-drift-a {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(120px, 60px) scale(1.12); }
        }
        @keyframes m4m-drift-b {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(-140px, 80px) scale(0.92); }
        }
        @keyframes m4m-drift-c {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(80px, -60px) scale(1.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          .m4m-blob-1, .m4m-blob-2, .m4m-blob-3 { animation: none !important; }
        }
      `}</style>
    </>
  );
}
