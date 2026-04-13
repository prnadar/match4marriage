"use client";

import { useEffect, useState } from "react";

export default function Preloader() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 2800);
    const removeTimer = setTimeout(() => setVisible(false), 3500);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      <style>{`
        .m4m-pl {
          position: fixed;
          inset: 0;
          background: #fff;
          z-index: 99999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          overflow: hidden;
          transition: opacity 0.7s ease;
        }
        .m4m-pl.fade { opacity: 0; pointer-events: none; }

        /* ── Stage ── */
        .m4m-stage {
          position: relative;
          width: 340px;
          height: 340px;
        }

        /* Woman — left 48%, slides in from left */
        .m4m-woman {
          position: absolute;
          top: 0; left: 0;
          width: 48%; height: 100%;
          background: url('/images/couple-preloader.png') left center / 340px 340px no-repeat;
          animation: womanIn 1s cubic-bezier(0.22,1,0.36,1) 0.1s both;
        }
        @keyframes womanIn {
          from { transform: translateX(-100px); opacity: 0; }
          to   { transform: translateX(0);      opacity: 1; }
        }

        /* Man — right 52%, slides in from right */
        .m4m-man {
          position: absolute;
          top: 0; right: 0;
          width: 52%; height: 100%;
          background: url('/images/couple-preloader.png') right center / 340px 340px no-repeat;
          animation: manIn 1s cubic-bezier(0.22,1,0.36,1) 0.1s both;
        }
        @keyframes manIn {
          from { transform: translateX(100px); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }



        /* ── Brand ── */
        .m4m-brand {
          text-align: center;
          opacity: 0;
          animation: brandIn 0.7s ease 1.2s both;
        }
        .m4m-wordmark {
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          font-weight: 700;
          color: #1a0a14;
          letter-spacing: 0.05em;
          line-height: 1;
        }
        .m4m-wordmark em { color: #dc1e3c; font-style: normal; }

        .m4m-line {
          width: 0;
          height: 2px;
          background: linear-gradient(to right, #dc1e3c, #ffd87a);
          margin: 10px auto 8px;
          border-radius: 9999px;
          animation: lineGrow 0.8s ease 1.5s forwards;
        }
        @keyframes lineGrow { to { width: 130px; } }

        .m4m-tagline {
          font-family: 'Poppins', sans-serif;
          font-size: 10px;
          font-weight: 600;
          color: #bbb;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        /* ── Progress bar ── */
        .m4m-bar {
          position: absolute;
          bottom: 0; left: 0;
          height: 3px;
          background: linear-gradient(to right, #dc1e3c, #ffd87a);
          width: 0;
          animation: barGrow 2.7s cubic-bezier(0.4,0,0.2,1) 0.1s forwards;
        }
        @keyframes barGrow {
          0%  { width: 0%; }
          70% { width: 75%; }
          100%{ width: 100%; }
        }

        @keyframes brandIn {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>

      <div className={`m4m-pl${fading ? " fade" : ""}`}>
        <div className="m4m-stage">

          {/* Woman slides in from left */}
          <div className="m4m-woman" />

          {/* Man slides in from right */}
          <div className="m4m-man" />



        </div>

        <div className="m4m-brand">
          <div className="m4m-wordmark">Match<em>4</em>Marriage</div>
          <div className="m4m-line" />
          <div className="m4m-tagline">Elite Indian Matrimony &nbsp;·&nbsp; United Kingdom</div>
        </div>

        <div className="m4m-bar" />
      </div>
    </>
  );
}
