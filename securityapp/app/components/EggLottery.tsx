"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { Location } from "@/lib/rotation-engine";

interface EggLotteryProps {
  totalGuards: number;
  guardNames: string[];
  lotteryResults: Record<string, { start: Location; end: Location }> | null;
  showReveal: boolean;
  onAccept: () => void;
}

const LOC_BG: Record<Location, string> = {
  "\u05D0\u05D3\u05D5\u05DD": "#b91c1c",
  "\u05DB\u05D7\u05D5\u05DC": "#1d4ed8",
  "\u05E8\u05D7\u05D1\u05D4": "#ca8a04",
  "\u05DC\u05D9\u05D5\u05D5\u05D9": "#ea580c",
  "\u05D7\u05D5\u05E4\u05E9\u05D9": "#059669",
};
const LOC_GLOW: Record<Location, string> = {
  "\u05D0\u05D3\u05D5\u05DD": "rgba(239,68,68,0.85)",
  "\u05DB\u05D7\u05D5\u05DC": "rgba(59,130,246,0.85)",
  "\u05E8\u05D7\u05D1\u05D4": "rgba(234,179,8,0.85)",
  "\u05DC\u05D9\u05D5\u05D5\u05D9": "rgba(249,115,22,0.85)",
  "\u05D7\u05D5\u05E4\u05E9\u05D9": "rgba(16,185,129,0.85)",
};

const EGG_PATH =
  "M100 14 C150 14,182 76,182 150 C182 228,148 262,100 262 C52 262,18 228,18 150 C18 76,50 14,100 14Z";
const CRACK =
  "M18 132 L38 116 L58 140 L78 116 L100 144 L122 116 L142 140 L162 116 L182 132";
const CLIP_TOP =
  "M0 0 L200 0 L200 132 L182 132 L162 116 L142 140 L122 116 L100 144 L78 116 L58 140 L38 116 L18 132 L0 132 Z";
const CLIP_BOT =
  "M0 132 L18 132 L38 116 L58 140 L78 116 L100 144 L122 116 L142 140 L162 116 L182 132 L200 132 L200 270 L0 270 Z";

function sr(n: number): number {
  const x = Math.sin(n * 9_301 + 49_297) * 233_280;
  return x - Math.floor(x);
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 639px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

function Sparkles({ count = 22, mobile = false }: { count?: number; mobile?: boolean }) {
  const actualCount = mobile ? Math.min(count, 12) : count;
  const dist = mobile ? 24 : 38;
  const maxDist = mobile ? 48 : 72;

  const pts = useMemo(
    () =>
      Array.from({ length: actualCount }, (_, i) => {
        const angle = (i / actualCount) * Math.PI * 2 + sr(i) * 0.45;
        const d = dist + sr(i + 60) * maxDist;
        const palette = ["#fbbf24", "#f59e0b", "#fde68a", "#fcd34d", "#fff", "#fb923c", "#fef3c7"];
        return {
          x: Math.cos(angle) * d,
          y: Math.sin(angle) * d,
          color: palette[i % palette.length],
          size: mobile ? 2 + sr(i + 120) * 3 : 4 + sr(i + 120) * 5,
          delay: sr(i + 200) * 0.18,
          dur: 0.9 + sr(i + 300) * 0.6,
        };
      }),
    [actualCount, dist, maxDist, mobile]
  );

  return (
    <div className="pointer-events-none absolute" style={{ inset: 0, overflow: "visible" }}>
      {pts.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: p.color,
            left: "50%",
            top: "50%",
            marginLeft: -p.size / 2,
            marginTop: -p.size / 2,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0 }}
          transition={{ duration: p.dur, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

function FloatingSpecks({ mobile }: { mobile: boolean }) {
  const count = mobile ? 12 : 28;
  const specks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${sr(i) * 100}%`,
        top: `${sr(i + 50) * 100}%`,
        size: sr(i + 100) * 3 + 1,
        dur: 3 + sr(i + 150) * 5,
        del: sr(i + 200) * 4,
      })),
    [count]
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {specks.map((s, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            background: "radial-gradient(circle,rgba(251,191,36,0.8),rgba(251,191,36,0))",
          }}
          animate={{ y: [0, -22, 0], opacity: [0, 0.75, 0] }}
          transition={{ duration: s.dur, delay: s.del, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function WholeEgg({ idx, w, h }: { idx: number; w: number; h: number }) {
  const speckles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        cx: 32 + sr(idx * 300 + i) * 136,
        cy: 40 + sr(idx * 300 + i + 40) * 195,
        r: 0.7 + sr(idx * 300 + i + 80) * 2.3,
        op: 0.1 + sr(idx * 300 + i + 120) * 0.22,
      })),
    [idx]
  );

  return (
    <svg width={w} height={h} viewBox="0 0 200 270" overflow="visible" style={{ display: "block" }}>
      <defs>
        <radialGradient id={`eg${idx}`} cx="40%" cy="28%" r="66%" fx="37%" fy="25%">
          <stop offset="0%" stopColor="#fefce8" />
          <stop offset="16%" stopColor="#fef3c7" />
          <stop offset="36%" stopColor="#fde68a" />
          <stop offset="58%" stopColor="#fbbf24" />
          <stop offset="78%" stopColor="#d97706" />
          <stop offset="94%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#92400e" />
        </radialGradient>
        <radialGradient id={`ehl${idx}`} cx="36%" cy="20%" r="36%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.68" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`erm${idx}`} cx="74%" cy="62%" r="40%">
          <stop offset="0%" stopColor="#fef9c3" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#fef9c3" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`ebs${idx}`} cx="50%" cy="90%" r="32%">
          <stop offset="0%" stopColor="#78350f" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#78350f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`egs${idx}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`ecc${idx}`}>
          <path d={EGG_PATH} />
        </clipPath>
      </defs>
      <ellipse cx="100" cy="264" rx="50" ry="7" fill={`url(#egs${idx})`} />
      <path d={EGG_PATH} fill={`url(#eg${idx})`} />
      <g clipPath={`url(#ecc${idx})`}>
        {speckles.map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#92400e" opacity={s.op} />
        ))}
      </g>
      <path d={EGG_PATH} fill={`url(#ehl${idx})`} />
      <path d={EGG_PATH} fill={`url(#erm${idx})`} />
      <path d={EGG_PATH} fill={`url(#ebs${idx})`} />
      <path d={EGG_PATH} fill="none" stroke="#b45309" strokeWidth="1" opacity="0.25" />
      <ellipse cx="72" cy="66" rx="13" ry="20" fill="white" opacity="0.38" />
      <ellipse cx="68" cy="55" rx="5" ry="9" fill="white" opacity="0.68" />
    </svg>
  );
}

function CrackOverlay({ w, h }: { w: number; h: number }) {
  return (
    <motion.svg
      width={w}
      height={h}
      viewBox="0 0 200 270"
      overflow="visible"
      className="absolute top-0 left-0 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.9, 1] }}
      transition={{ duration: 0.3 }}
    >
      <path d={CRACK} fill="none" stroke="#fef3c7" strokeWidth="6" strokeLinecap="round" opacity="0.2" />
      <path d={CRACK} fill="none" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M78 116 L64 106 L56 112" fill="none" stroke="#78350f" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M100 144 L114 154 L120 148" fill="none" stroke="#78350f" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M122 116 L134 104 L140 110" fill="none" stroke="#78350f" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M58 140 L46 148 L40 144" fill="none" stroke="#78350f" strokeWidth="1.1" strokeLinecap="round" />
    </motion.svg>
  );
}

function CrackedEgg({
  idx, w, h, stage, mobile,
}: {
  idx: number; w: number; h: number; stage: "crack" | "reveal"; mobile: boolean;
}) {
  const isReveal = stage === "reveal";
  const topY = mobile ? (isReveal ? -40 : -14) : (isReveal ? -62 : -20);
  const botY = mobile ? (isReveal ? 14 : 4) : (isReveal ? 22 : 6);
  const topRot = mobile ? (isReveal ? -10 : -3) : (isReveal ? -16 : -5);
  const botRot = mobile ? (isReveal ? 4 : 1) : (isReveal ? 6 : 1.5);

  return (
    <div style={{ position: "relative", width: w, height: h }}>
      <motion.div
        style={{ position: "absolute", inset: 0 }}
        initial={{ y: 0, rotate: 0 }}
        animate={{ y: botY, rotate: botRot }}
        transition={{ duration: 0.75, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <svg width={w} height={h} viewBox="0 0 200 270" overflow="visible" style={{ display: "block" }}>
          <defs>
            <radialGradient id={`bg${idx}`} cx="42%" cy="68%" r="64%">
              <stop offset="0%" stopColor="#fef9c3" />
              <stop offset="35%" stopColor="#fbbf24" />
              <stop offset="70%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#92400e" />
            </radialGradient>
            <radialGradient id={`bgs${idx}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#000" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            <clipPath id={`bclip${idx}`}>
              <path d={CLIP_BOT} />
            </clipPath>
          </defs>
          <ellipse cx="100" cy="264" rx="50" ry="7" fill={`url(#bgs${idx})`} />
          <g clipPath={`url(#bclip${idx})`}>
            <path d={EGG_PATH} fill={`url(#bg${idx})`} />
            <path d={EGG_PATH} fill="none" stroke="#b45309" strokeWidth="1" opacity="0.22" />
            <path d={CRACK} fill="none" stroke="#fef3c7" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
          </g>
        </svg>
      </motion.div>
      <motion.div
        style={{ position: "absolute", inset: 0, zIndex: 2 }}
        initial={{ y: 0, rotate: 0, opacity: 1 }}
        animate={{ y: topY, rotate: topRot, opacity: isReveal ? 0.6 : 1 }}
        transition={{ duration: 0.75, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <svg width={w} height={h} viewBox="0 0 200 270" overflow="visible" style={{ display: "block" }}>
          <defs>
            <radialGradient id={`tg${idx}`} cx="38%" cy="26%" r="66%">
              <stop offset="0%" stopColor="#fefce8" />
              <stop offset="20%" stopColor="#fef3c7" />
              <stop offset="40%" stopColor="#fde68a" />
              <stop offset="62%" stopColor="#fbbf24" />
              <stop offset="84%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#b45309" />
            </radialGradient>
            <radialGradient id={`thl${idx}`} cx="35%" cy="19%" r="38%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <clipPath id={`tclip${idx}`}>
              <path d={CLIP_TOP} />
            </clipPath>
          </defs>
          <g clipPath={`url(#tclip${idx})`}>
            <path d={EGG_PATH} fill={`url(#tg${idx})`} />
            <path d={EGG_PATH} fill={`url(#thl${idx})`} />
            <path d={EGG_PATH} fill="none" stroke="#b45309" strokeWidth="1" opacity="0.22" />
            <ellipse cx="72" cy="66" rx="13" ry="20" fill="white" opacity="0.36" />
            <ellipse cx="68" cy="55" rx="5" ry="9" fill="white" opacity="0.66" />
            <path d={CRACK} fill="none" stroke="#fef3c7" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
          </g>
        </svg>
      </motion.div>
    </div>
  );
}

type EggStage = "idle" | "wobble" | "shake" | "crack" | "reveal";

function EggUnit({
  idx, name, location, stage, delay, compact, mobile,
}: {
  idx: number; name: string; location?: Location;
  stage: EggStage; delay: number; compact: boolean; mobile: boolean;
}) {
  const eggW = mobile ? 56 : compact ? 82 : 128;
  const eggH = Math.round((eggW * 270) / 200);
  const glow = location ? LOC_GLOW[location] : "rgba(251,191,36,0.5)";

  const ABOVE = mobile ? 36 : 78;
  const BELOW = mobile ? 36 : 72;
  const containerH = ABOVE + eggH + BELOW;

  const crackY = Math.round((132 / 270) * eggH);
  const badgeTop = mobile ? crackY - 10 : crackY - 18;

  const staggerDelay = mobile ? idx * 0.3 : idx * 0.45;

  return (
    <motion.div
      className="flex flex-col items-center"
      style={{ minWidth: eggW }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <motion.div
        className={`mb-1 px-1.5 py-0.5 rounded-full font-bold text-center leading-tight whitespace-nowrap sm:mb-2 sm:px-2.5 ${
          mobile ? "text-[10px]" : compact ? "text-xs" : "text-sm"
        }`}
        style={{
          background:
            stage === "reveal" && location
              ? `linear-gradient(135deg, ${LOC_BG[location]}cc, ${LOC_BG[location]}55)`
              : "rgba(255,255,255,0.07)",
          border:
            stage === "reveal" && location
              ? `1px solid ${LOC_BG[location]}`
              : "1px solid rgba(255,255,255,0.12)",
          color: stage === "reveal" && location ? "#fff" : "#bae6fd",
          boxShadow: stage === "reveal" && location ? `0 0 14px ${glow}` : "none",
          transition: "all 0.4s ease",
          maxWidth: eggW + 16,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {name}
      </motion.div>

      <div style={{ position: "relative", width: eggW, height: containerH, overflow: "visible" }}>
        <AnimatePresence mode="wait">
          {(stage === "idle" || stage === "wobble" || stage === "shake") && (
            <motion.div
              key="whole"
              style={{ position: "absolute", top: ABOVE, left: 0 }}
              animate={
                stage === "wobble"
                  ? {
                      rotate: [0, -6, 6, -8, 8, -5, 5, -3, 0],
                      y: [0, -6, 0, -8, 0, -5, 0, -3, 0],
                    }
                  : stage === "shake"
                  ? {
                      rotate: mobile
                        ? [0, -8, 10, -12, 10, -8, 12, -10, 7, -5, 3, 0]
                        : [0, -12, 15, -17, 14, -11, 16, -13, 10, -7, 4, 0],
                      x: mobile
                        ? [0, -3, 4, -5, 3, -4, 5, -3, 3, -2, 1, 0]
                        : [0, -5, 6, -7, 5, -6, 7, -5, 4, -3, 2, 0],
                      y: [0, -2, 0, -3, 0, -2, 0, -2, 0, -1, 0, 0],
                    }
                  : { y: [0, -8, 0] }
              }
              transition={
                stage === "idle"
                  ? { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: delay * 0.5 }
                  : stage === "wobble"
                  ? { duration: 0.65, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.38, repeat: Infinity, ease: "easeInOut" }
              }
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.1 } }}
            >
              <WholeEgg idx={idx} w={eggW} h={eggH} />
              {stage === "shake" && <CrackOverlay w={eggW} h={eggH} />}
            </motion.div>
          )}

          {(stage === "crack" || stage === "reveal") && (
            <motion.div
              key="cracked"
              style={{ position: "absolute", top: ABOVE, left: 0, width: eggW, height: eggH }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.08 }}
            >
              <CrackedEgg idx={idx} w={eggW} h={eggH} stage={stage} mobile={mobile} />

              <AnimatePresence>
                {stage === "reveal" && location && (
                  <div
                    style={{
                      position: "absolute",
                      top: badgeTop,
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: 20,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.3, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 320,
                        damping: 14,
                        delay: staggerDelay,
                      }}
                    >
                      <div
                        className={`rounded-xl px-2 py-1 font-black text-white text-center whitespace-nowrap sm:rounded-2xl sm:px-4 sm:py-2 ${
                          mobile ? "text-[10px]" : compact ? "text-sm" : "text-lg"
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${LOC_BG[location]}, color-mix(in srgb, ${LOC_BG[location]} 70%, #000))`,
                          boxShadow: mobile
                            ? `0 0 14px ${glow}, 0 2px 6px rgba(0,0,0,0.4)`
                            : `0 0 28px ${glow}, 0 0 56px ${glow}, 0 3px 10px rgba(0,0,0,0.45)`,
                          textShadow: "0 1px 4px rgba(0,0,0,0.55)",
                          border: "1px solid rgba(255,255,255,0.2)",
                        }}
                      >
                        {location}
                      </div>

                      <div style={{ position: "absolute", top: "50%", left: "50%", pointerEvents: "none" }}>
                        <Sparkles count={mobile ? 10 : compact ? 16 : 24} mobile={mobile} />
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function EggLottery({
  totalGuards, guardNames, lotteryResults, showReveal, onAccept,
}: EggLotteryProps) {
  const [stage, setStage] = useState<EggStage>("idle");
  const revealedRef = useRef(false);
  const [portalReady, setPortalReady] = useState(false);
  const mobile = useIsMobile();
  const compact = totalGuards >= 5 || (mobile && totalGuards >= 3);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!lotteryResults) {
      setStage("idle");
      revealedRef.current = false;
      return;
    }
    setStage("wobble");
    const t1 = setTimeout(() => setStage("shake"), 900);
    const t2 = setTimeout(() => setStage("crack"), 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [lotteryResults]);

  useEffect(() => {
    if (showReveal && !revealedRef.current) {
      revealedRef.current = true;
      setStage("reveal");
    }
  }, [showReveal]);

  const guardDisplayNames = Array.from({ length: totalGuards }, (_, i) =>
    guardNames[i]?.trim() || `Guard ${i + 1}`
  );

  const statusText = {
    idle: "Preparing the eggs...",
    wobble: "The eggs are awakening...",
    shake: "Something is about to hatch!",
    crack: "Cracking open...",
    reveal: "Assignments revealed!",
  }[stage];

  const revealDelay = mobile ? totalGuards * 0.3 : totalGuards * 0.45;

  const overlay = (
    <motion.div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto"
      style={{ paddingTop: mobile ? 12 : 32, paddingBottom: mobile ? 12 : 32 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.96)" }} />

      <FloatingSpecks mobile={mobile} />

      <motion.div
        className="relative z-10 w-full rounded-2xl border border-amber-500/20 sm:rounded-3xl"
        style={{
          margin: mobile ? "0 8px" : "0 16px",
          maxWidth: mobile ? "100%" : "56rem",
          background: "linear-gradient(180deg,rgba(14,21,40,0.97) 0%,rgba(6,10,24,0.99) 100%)",
          boxShadow: mobile
            ? "0 0 40px rgba(251,191,36,0.08), 0 10px 30px rgba(0,0,0,0.5)"
            : "0 0 90px rgba(251,191,36,0.1), 0 0 180px rgba(251,191,36,0.04), 0 30px 60px rgba(0,0,0,0.65)",
        }}
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 195, damping: 22 }}
      >
        <div className={mobile ? "px-3 py-4" : "p-6 md:p-9"}>
          <div className={`text-center ${mobile ? "mb-4" : "mb-7"}`}>
            <motion.h3
              className={`font-black tracking-tight ${mobile ? "text-xl" : "text-3xl md:text-4xl"}`}
              style={{
                background: "linear-gradient(135deg,#fef3c7 0%,#fbbf24 45%,#f59e0b 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Guard Lottery
            </motion.h3>
            <motion.p
              className={`mt-1.5 text-amber-300/55 font-medium ${mobile ? "text-xs" : "text-sm"}`}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            >
              {statusText}
            </motion.p>
          </div>

          <div
            className={`flex flex-wrap justify-center ${
              mobile
                ? "gap-1.5 mb-3"
                : compact
                ? "gap-2 md:gap-3 mb-6"
                : "gap-5 md:gap-7 mb-6"
            }`}
          >
            {guardDisplayNames.map((name, i) => {
              const loc = lotteryResults?.[name]?.end;
              return (
                <EggUnit
                  key={i}
                  idx={i}
                  name={name}
                  location={loc}
                  stage={stage}
                  delay={i * 0.1}
                  compact={compact}
                  mobile={mobile}
                />
              );
            })}
          </div>

          <AnimatePresence>
            {stage === "reveal" && lotteryResults && Object.keys(lotteryResults).length > 0 && (
              <motion.div
                className={`rounded-xl border border-amber-400/20 ${mobile ? "mt-2" : "mt-6"}`}
                style={{ background: "rgba(251,191,36,0.04)" }}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: revealDelay + 0.3 }}
              >
                <div className={mobile ? "px-3 py-3" : "px-4 py-4 md:px-6 md:py-5"}>
                  <h4 className={`text-center font-bold text-amber-200 mb-2 tracking-wide ${mobile ? "text-sm" : "text-base"} sm:mb-3`}>
                    Summary
                  </h4>

                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    {guardDisplayNames.map((name, i) => {
                      const asgn = lotteryResults[name];
                      if (!asgn) return null;
                      return (
                        <motion.div
                          key={name}
                          className={`flex items-center justify-between rounded-lg ${mobile ? "px-2.5 py-1.5" : "rounded-xl px-4 py-2.5"}`}
                          style={{
                            background: `linear-gradient(90deg, ${LOC_BG[asgn.end]}18, ${LOC_BG[asgn.end]}08)`,
                            border: `1px solid ${LOC_BG[asgn.end]}44`,
                          }}
                          initial={{ opacity: 0, x: -18 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: revealDelay + 0.4 + i * 0.1 }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`flex-shrink-0 rounded-full font-black flex items-center justify-center text-white ${
                                mobile ? "w-4 h-4 text-[9px]" : "w-5 h-5 text-xs"
                              }`}
                              style={{ background: LOC_BG[asgn.end] }}
                            >
                              {i + 1}
                            </span>
                            <span className={`font-semibold text-amber-100 truncate ${mobile ? "text-xs" : "text-sm"}`}>{name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 sm:gap-2">
                            <span
                              className={`rounded-md font-bold text-white ${mobile ? "px-1.5 py-0.5 text-[10px]" : "rounded-lg px-2.5 py-0.5 text-xs"}`}
                              style={{
                                background: LOC_BG[asgn.start],
                                boxShadow: `0 0 8px ${LOC_GLOW[asgn.start]}`,
                              }}
                            >
                              {asgn.start}
                            </span>
                            <span className={`text-amber-500/70 font-bold ${mobile ? "text-[9px]" : "text-xs"}`}>{"\u2192"}</span>
                            <span
                              className={`rounded-md font-bold text-white ${mobile ? "px-1.5 py-0.5 text-[10px]" : "rounded-lg px-2.5 py-0.5 text-xs"}`}
                              style={{
                                background: LOC_BG[asgn.end],
                                boxShadow: `0 0 8px ${LOC_GLOW[asgn.end]}`,
                              }}
                            >
                              {asgn.end}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showReveal && (
              <motion.div
                className={`flex justify-center ${mobile ? "mt-3" : "mt-6"}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: revealDelay + 0.9, duration: 0.4 }}
              >
                <motion.button
                  type="button"
                  onClick={onAccept}
                  className={`relative rounded-xl font-bold text-amber-900 overflow-hidden sm:rounded-2xl ${
                    mobile ? "px-6 py-2.5 text-sm" : "px-9 py-3.5 text-base"
                  }`}
                  style={{
                    background: "linear-gradient(135deg,#fbbf24,#f59e0b,#d97706)",
                    boxShadow: "0 0 30px rgba(251,191,36,0.5), 0 4px 16px rgba(0,0,0,0.3)",
                  }}
                  whileHover={{ scale: 1.05, boxShadow: "0 0 50px rgba(251,191,36,0.7), 0 6px 20px rgba(0,0,0,0.35)" }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span className="relative z-10">Accept & Continue</span>
                  <motion.div
                    className="absolute inset-0"
                    style={{
                      background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)",
                    }}
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );

  if (!portalReady || typeof document === "undefined") {
    return null;
  }

  return createPortal(overlay, document.body);
}
