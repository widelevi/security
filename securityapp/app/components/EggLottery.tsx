"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Location } from "@/lib/rotation-engine";

// ─── Color maps ───────────────────────────────────────────────────────────────

interface EggLotteryProps {
  totalGuards: number;
  guardNames: string[];
  lotteryResults: Record<string, { start: Location; end: Location }> | null;
  showReveal: boolean;
  onAccept: () => void;
}

const LOC_BG: Record<Location, string> = {
  אדום: "#b91c1c",
  כחול: "#1d4ed8",
  רחבה: "#ca8a04",
  ליווי: "#ea580c",
  חופשי: "#059669",
};
const LOC_GLOW: Record<Location, string> = {
  אדום: "rgba(239,68,68,0.85)",
  כחול: "rgba(59,130,246,0.85)",
  רחבה: "rgba(234,179,8,0.85)",
  ליווי: "rgba(249,115,22,0.85)",
  חופשי: "rgba(16,185,129,0.85)",
};

// ─── Egg SVG geometry (viewBox 0 0 200 270) ──────────────────────────────────

// Full egg outline path
const EGG_PATH =
  "M100 14 C150 14,182 76,182 150 C182 228,148 262,100 262 C52 262,18 228,18 150 C18 76,50 14,100 14Z";

// Zigzag crack line — sits around y≈130 in viewBox
const CRACK =
  "M18 132 L38 116 L58 140 L78 116 L100 144 L122 116 L142 140 L162 116 L182 132";

// Top-half clip: everything above the crack
const CLIP_TOP =
  "M0 0 L200 0 L200 132 L182 132 L162 116 L142 140 L122 116 L100 144 L78 116 L58 140 L38 116 L18 132 L0 132 Z";

// Bottom-half clip: everything below the crack
const CLIP_BOT =
  "M0 132 L18 132 L38 116 L58 140 L78 116 L100 144 L122 116 L142 140 L162 116 L182 132 L200 132 L200 270 L0 270 Z";

// ─── Seeded deterministic "random" (no flickering on re-render) ──────────────

function sr(n: number): number {
  const x = Math.sin(n * 9_301 + 49_297) * 233_280;
  return x - Math.floor(x);
}

// ─── Sparkle burst ───────────────────────────────────────────────────────────

function Sparkles({ count = 22 }: { count?: number }) {
  const pts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + sr(i) * 0.45;
        const dist = 38 + sr(i + 60) * 72;
        const palette = ["#fbbf24", "#f59e0b", "#fde68a", "#fcd34d", "#fff", "#fb923c", "#fef3c7"];
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          color: palette[i % palette.length],
          size: 4 + sr(i + 120) * 5,
          delay: sr(i + 200) * 0.18,
          dur: 0.9 + sr(i + 300) * 0.6,
        };
      }),
    [count]
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

// ─── Background floating specks ───────────────────────────────────────────────

function FloatingSpecks() {
  const specks = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: `${sr(i) * 100}%`,
        top: `${sr(i + 50) * 100}%`,
        size: sr(i + 100) * 3 + 1,
        dur: 3 + sr(i + 150) * 5,
        del: sr(i + 200) * 4,
      })),
    []
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

// ─── Whole egg SVG — NO SVG filters (they cause white bounding boxes) ─────────

function WholeEgg({ idx, w, h }: { idx: number; w: number; h: number }) {
  // Speckles generated once per egg index
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
    <svg
      width={w}
      height={h}
      viewBox="0 0 200 270"
      overflow="visible"
      style={{ display: "block" }}
    >
      <defs>
        {/* Body gradient — warm amber 3D */}
        <radialGradient id={`eg${idx}`} cx="40%" cy="28%" r="66%" fx="37%" fy="25%">
          <stop offset="0%"   stopColor="#fefce8" />
          <stop offset="16%"  stopColor="#fef3c7" />
          <stop offset="36%"  stopColor="#fde68a" />
          <stop offset="58%"  stopColor="#fbbf24" />
          <stop offset="78%"  stopColor="#d97706" />
          <stop offset="94%"  stopColor="#b45309" />
          <stop offset="100%" stopColor="#92400e" />
        </radialGradient>

        {/* Top-left specular highlight */}
        <radialGradient id={`ehl${idx}`} cx="36%" cy="20%" r="36%">
          <stop offset="0%"   stopColor="#fff" stopOpacity="0.68" />
          <stop offset="55%"  stopColor="#fff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>

        {/* Right rim light */}
        <radialGradient id={`erm${idx}`} cx="74%" cy="62%" r="40%">
          <stop offset="0%"   stopColor="#fef9c3" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#fef9c3" stopOpacity="0" />
        </radialGradient>

        {/* Bottom inner shadow */}
        <radialGradient id={`ebs${idx}`} cx="50%" cy="90%" r="32%">
          <stop offset="0%"   stopColor="#78350f" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#78350f" stopOpacity="0" />
        </radialGradient>

        {/* Ground shadow */}
        <radialGradient id={`egs${idx}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#000" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>

        {/* Clip to egg shape for speckles — prevents white bleeding */}
        <clipPath id={`ecc${idx}`}>
          <path d={EGG_PATH} />
        </clipPath>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="100" cy="264" rx="50" ry="7" fill={`url(#egs${idx})`} />

      {/* Egg body */}
      <path d={EGG_PATH} fill={`url(#eg${idx})`} />

      {/* Speckles — strictly clipped to egg shape */}
      <g clipPath={`url(#ecc${idx})`}>
        {speckles.map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#92400e" opacity={s.op} />
        ))}
      </g>

      {/* Gradient layers */}
      <path d={EGG_PATH} fill={`url(#ehl${idx})`} />
      <path d={EGG_PATH} fill={`url(#erm${idx})`} />
      <path d={EGG_PATH} fill={`url(#ebs${idx})`} />

      {/* Outer edge */}
      <path d={EGG_PATH} fill="none" stroke="#b45309" strokeWidth="1" opacity="0.25" />

      {/* Specular spot */}
      <ellipse cx="72" cy="66" rx="13" ry="20" fill="white" opacity="0.38" />
      <ellipse cx="68" cy="55" rx="5"  ry="9"  fill="white" opacity="0.68" />
    </svg>
  );
}

// ─── Crack line overlay (shown during shake) ──────────────────────────────────

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
      {/* Glow under crack */}
      <path d={CRACK} fill="none" stroke="#fef3c7" strokeWidth="6" strokeLinecap="round" opacity="0.2" />
      {/* Main crack */}
      <path d={CRACK} fill="none" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Branch cracks */}
      <path d="M78 116 L64 106 L56 112" fill="none" stroke="#78350f" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M100 144 L114 154 L120 148" fill="none" stroke="#78350f" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M122 116 L134 104 L140 110" fill="none" stroke="#78350f" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M58 140 L46 148 L40 144" fill="none" stroke="#78350f" strokeWidth="1.1" strokeLinecap="round" />
    </motion.svg>
  );
}

// ─── Cracked egg — two halves using clipPath (no filter, no white bg) ─────────

function CrackedEgg({
  idx, w, h, stage,
}: {
  idx: number; w: number; h: number; stage: "crack" | "reveal";
}) {
  const isReveal = stage === "reveal";

  return (
    // Relative container — both halves are absolutely overlaid inside
    <div style={{ position: "relative", width: w, height: h }}>

      {/* ── Bottom half — stays / tilts slightly ── */}
      <motion.div
        style={{ position: "absolute", inset: 0 }}
        initial={{ y: 0, rotate: 0 }}
        animate={{ y: isReveal ? 22 : 6, rotate: isReveal ? 6 : 1.5 }}
        transition={{ duration: 0.75, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <svg width={w} height={h} viewBox="0 0 200 270" overflow="visible" style={{ display: "block" }}>
          <defs>
            <radialGradient id={`bg${idx}`} cx="42%" cy="68%" r="64%">
              <stop offset="0%"   stopColor="#fef9c3" />
              <stop offset="35%"  stopColor="#fbbf24" />
              <stop offset="70%"  stopColor="#d97706" />
              <stop offset="100%" stopColor="#92400e" />
            </radialGradient>
            <radialGradient id={`bgs${idx}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#000" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            <clipPath id={`bclip${idx}`}>
              <path d={CLIP_BOT} />
            </clipPath>
          </defs>

          {/* Ground shadow */}
          <ellipse cx="100" cy="264" rx="50" ry="7" fill={`url(#bgs${idx})`} />

          {/* Bottom half — clipped to below crack */}
          <g clipPath={`url(#bclip${idx})`}>
            <path d={EGG_PATH} fill={`url(#bg${idx})`} />
            <path d={EGG_PATH} fill="none" stroke="#b45309" strokeWidth="1" opacity="0.22" />
            {/* Inner shell lit edge at crack */}
            <path d={CRACK} fill="none" stroke="#fef3c7" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
          </g>
        </svg>
      </motion.div>

      {/* ── Top half — flies up and tilts ── */}
      <motion.div
        style={{ position: "absolute", inset: 0, zIndex: 2 }}
        initial={{ y: 0, rotate: 0, opacity: 1 }}
        animate={{
          y: isReveal ? -62 : -20,
          rotate: isReveal ? -16 : -5,
          opacity: isReveal ? 0.6 : 1,
        }}
        transition={{ duration: 0.75, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <svg width={w} height={h} viewBox="0 0 200 270" overflow="visible" style={{ display: "block" }}>
          <defs>
            <radialGradient id={`tg${idx}`} cx="38%" cy="26%" r="66%">
              <stop offset="0%"   stopColor="#fefce8" />
              <stop offset="20%"  stopColor="#fef3c7" />
              <stop offset="40%"  stopColor="#fde68a" />
              <stop offset="62%"  stopColor="#fbbf24" />
              <stop offset="84%"  stopColor="#d97706" />
              <stop offset="100%" stopColor="#b45309" />
            </radialGradient>
            <radialGradient id={`thl${idx}`} cx="35%" cy="19%" r="38%">
              <stop offset="0%"   stopColor="#fff" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <clipPath id={`tclip${idx}`}>
              <path d={CLIP_TOP} />
            </clipPath>
          </defs>

          {/* Top half — clipped to above crack */}
          <g clipPath={`url(#tclip${idx})`}>
            <path d={EGG_PATH} fill={`url(#tg${idx})`} />
            <path d={EGG_PATH} fill={`url(#thl${idx})`} />
            <path d={EGG_PATH} fill="none" stroke="#b45309" strokeWidth="1" opacity="0.22" />
            {/* Specular */}
            <ellipse cx="72" cy="66" rx="13" ry="20" fill="white" opacity="0.36" />
            <ellipse cx="68" cy="55" rx="5"  ry="9"  fill="white" opacity="0.66" />
            {/* Inner shell lit edge at crack */}
            <path d={CRACK} fill="none" stroke="#fef3c7" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
          </g>
        </svg>
      </motion.div>
    </div>
  );
}

// ─── Single egg unit ──────────────────────────────────────────────────────────

type EggStage = "idle" | "wobble" | "shake" | "crack" | "reveal";

function EggUnit({
  idx, name, location, stage, delay, compact,
}: {
  idx: number; name: string; location?: Location;
  stage: EggStage; delay: number; compact: boolean;
}) {
  const eggW = compact ? 82 : 128;
  const eggH = Math.round((eggW * 270) / 200);
  const glow  = location ? LOC_GLOW[location] : "rgba(251,191,36,0.5)";

  // Space above the egg so the flying top-half doesn't clip outside the container
  const ABOVE = 78;
  // Space below for the location badge
  const BELOW = 72;
  const containerH = ABOVE + eggH + BELOW;

  // The crack sits at y = 132/270 of the egg height.
  // When revealed: top half moves up -62px, bottom half moves down +22px.
  // Visible gap center ≈ crack_y - 20px (average of the two offsets).
  const crackY     = Math.round((132 / 270) * eggH);
  const badgeTop   = crackY - 18; // vertical center of the gap between the two halves

  return (
    <motion.div
      className="flex flex-col items-center"
      style={{ minWidth: eggW }}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      {/* ── Guard name pill ── */}
      <motion.div
        className={`mb-2 px-2.5 py-0.5 rounded-full font-bold text-center leading-tight whitespace-nowrap ${
          compact ? "text-xs" : "text-sm"
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

      {/* ── Egg container ── */}
      <div style={{ position: "relative", width: eggW, height: containerH, overflow: "visible" }}>
        <AnimatePresence mode="wait">

          {/* Whole egg (idle / wobble / shake) */}
          {(stage === "idle" || stage === "wobble" || stage === "shake") && (
            <motion.div
              key="whole"
              style={{ position: "absolute", top: ABOVE, left: 0 }}
              animate={
                stage === "wobble"
                  ? {
                      rotate: [0, -6, 6, -8, 8, -5, 5, -3, 0],
                      y:      [0, -6, 0, -8, 0, -5, 0, -3, 0],
                    }
                  : stage === "shake"
                  ? {
                      rotate: [0, -12, 15, -17, 14, -11, 16, -13, 10, -7, 4, 0],
                      x:      [0,  -5,  6,  -7,  5,  -6,  7,  -5,  4,  -3, 2, 0],
                      y:      [0,  -2,  0,  -3,  0,  -2,  0,  -2,  0,  -1, 0, 0],
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

          {/* Cracked egg (crack / reveal) */}
          {(stage === "crack" || stage === "reveal") && (
            <motion.div
              key="cracked"
              style={{ position: "absolute", top: ABOVE, left: 0, width: eggW, height: eggH }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.08 }}
            >
              <CrackedEgg idx={idx} w={eggW} h={eggH} stage={stage} />

              {/* ── Location badge ──
                  IMPORTANT: outer plain div handles centering so Framer Motion
                  doesn't override translateX(-50%) with its own transform. */}
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
                        // stagger each egg's reveal by 0.45s for dramatic effect
                        delay: idx * 0.45,
                      }}
                    >
                      <div
                        className={`rounded-2xl px-4 py-2 font-black text-white text-center whitespace-nowrap ${
                          compact ? "text-sm" : "text-lg"
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${LOC_BG[location]}, color-mix(in srgb, ${LOC_BG[location]} 70%, #000))`,
                          boxShadow: `0 0 28px ${glow}, 0 0 56px ${glow}, 0 3px 10px rgba(0,0,0,0.45)`,
                          textShadow: "0 1px 4px rgba(0,0,0,0.55)",
                          border: `1px solid rgba(255,255,255,0.2)`,
                        }}
                      >
                        {location}
                      </div>

                      {/* Sparkle burst */}
                      <div
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          pointerEvents: "none",
                        }}
                      >
                        <Sparkles count={compact ? 16 : 24} />
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

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function EggLottery({
  totalGuards, guardNames, lotteryResults, showReveal, onAccept,
}: EggLotteryProps) {
  const [stage, setStage] = useState<EggStage>("idle");
  const revealedRef = useRef(false);
  const compact = totalGuards >= 5;

  // Stage machine: idle → wobble → shake → crack (driven by lotteryResults)
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

  // crack → reveal (driven by parent showReveal prop)
  useEffect(() => {
    if (showReveal && !revealedRef.current) {
      revealedRef.current = true;
      setStage("reveal");
    }
  }, [showReveal]);

  // Build display names the same way page.tsx does
  const guardDisplayNames = Array.from({ length: totalGuards }, (_, i) =>
    guardNames[i]?.trim() || `Guard ${i + 1}`
  );

  const statusText = {
    idle:   "Preparing the eggs...",
    wobble: "The eggs are awakening...",
    shake:  "Something is about to hatch!",
    crack:  "Cracking open...",
    reveal: "🎉 Assignments revealed!",
  }[stage];

  return (
    // Outer: fixed, scrollable so tall content is reachable
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.93)", backdropFilter: "blur(14px)" }}
      />

      <FloatingSpecks />

      {/* Card — no overflow-hidden so flying egg halves are visible */}
      <motion.div
        className="relative z-10 mx-4 w-full max-w-4xl rounded-3xl border border-amber-500/20"
        style={{
          background: "linear-gradient(180deg,rgba(14,21,40,0.97) 0%,rgba(6,10,24,0.99) 100%)",
          boxShadow:
            "0 0 90px rgba(251,191,36,0.1), 0 0 180px rgba(251,191,36,0.04), 0 30px 60px rgba(0,0,0,0.65)",
        }}
        initial={{ scale: 0.88, y: 28 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 195, damping: 22 }}
      >
        <div className="p-6 md:p-9">

          {/* Header */}
          <div className="text-center mb-7">
            <motion.h3
              className="text-3xl md:text-4xl font-black tracking-tight"
              style={{
                background: "linear-gradient(135deg,#fef3c7 0%,#fbbf24 45%,#f59e0b 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Guard Lottery
            </motion.h3>
            <motion.p
              className="mt-2 text-amber-300/55 text-sm font-medium"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            >
              {statusText}
            </motion.p>
          </div>

          {/* ── Eggs row ── */}
          <div
            className={`flex flex-wrap justify-center ${
              compact ? "gap-2 md:gap-3" : "gap-5 md:gap-7"
            } mb-6`}
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
                />
              );
            })}
          </div>

          {/* ── Results table — shown on reveal ── */}
          <AnimatePresence>
            {stage === "reveal" && lotteryResults && Object.keys(lotteryResults).length > 0 && (
              <motion.div
                className="rounded-2xl border border-amber-400/20 mt-6"
                style={{ background: "rgba(251,191,36,0.04)" }}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                // Delay until all egg reveals have fired (totalGuards * 0.45 + 0.6)
                transition={{ duration: 0.55, delay: totalGuards * 0.45 + 0.3 }}
              >
                <div className="px-4 py-4 md:px-6 md:py-5">
                  <h4 className="text-center text-base font-bold text-amber-200 mb-3 tracking-wide">
                    Summary
                  </h4>

                  <div className="flex flex-col gap-2">
                    {guardDisplayNames.map((name, i) => {
                      const asgn = lotteryResults[name];
                      if (!asgn) return null;
                      return (
                        <motion.div
                          key={name}
                          className="flex items-center justify-between rounded-xl px-4 py-2.5"
                          style={{
                            background: `linear-gradient(90deg, ${LOC_BG[asgn.end]}18, ${LOC_BG[asgn.end]}08)`,
                            border: `1px solid ${LOC_BG[asgn.end]}44`,
                          }}
                          initial={{ opacity: 0, x: -18 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: totalGuards * 0.45 + 0.4 + i * 0.1 }}
                        >
                          {/* Guard name */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-black flex items-center justify-center text-white"
                              style={{ background: LOC_BG[asgn.end] }}
                            >
                              {i + 1}
                            </span>
                            <span className="font-semibold text-amber-100 text-sm truncate">{name}</span>
                          </div>

                          {/* Assignments */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className="rounded-lg px-2.5 py-0.5 text-xs font-bold text-white"
                              style={{
                                background: LOC_BG[asgn.start],
                                boxShadow: `0 0 8px ${LOC_GLOW[asgn.start]}`,
                              }}
                            >
                              {asgn.start}
                            </span>
                            <span className="text-amber-500/70 font-bold text-xs">→</span>
                            <span
                              className="rounded-lg px-2.5 py-0.5 text-xs font-bold text-white"
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

          {/* ── Accept button ── */}
          <AnimatePresence>
            {showReveal && (
              <motion.div
                className="flex justify-center mt-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: totalGuards * 0.45 + 0.9, duration: 0.4 }}
              >
                <motion.button
                  type="button"
                  onClick={onAccept}
                  className="relative rounded-2xl px-9 py-3.5 font-bold text-amber-900 overflow-hidden text-base"
                  style={{
                    background: "linear-gradient(135deg,#fbbf24,#f59e0b,#d97706)",
                    boxShadow: "0 0 30px rgba(251,191,36,0.5), 0 4px 16px rgba(0,0,0,0.3)",
                  }}
                  whileHover={{ scale: 1.05, boxShadow: "0 0 50px rgba(251,191,36,0.7), 0 6px 20px rgba(0,0,0,0.35)" }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span className="relative z-10">Accept & Continue</span>
                  {/* Shimmer */}
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
}
