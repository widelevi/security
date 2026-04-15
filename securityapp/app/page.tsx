"use client";

import { useEffect, useMemo, useState } from "react";
import type { GuardLength, Location, RotationRow, ShiftType } from "@/lib/rotation-engine";
import { buildRotation, recommendStart, allGuardsIdentical, getStartingGuardsCount, getAvailablePositions, getEndingPost } from "@/lib/rotation-engine";

const LOCATION_OPTIONS: Location[] = ["אדום", "כחול", "רחבה", "ליווי", "חופשי"];
const LOCATION_BOOKMARK_CLASSES: Record<Location, string> = {
  אדום: "bg-red-700",
  כחול: "bg-blue-700",
  רחבה: "bg-yellow-600",
  ליווי: "bg-orange-500",
  חופשי: "bg-emerald-700",
};

function isFreeLike(station: Location): boolean {
  return station === "חופשי" || station === "ליווי";
}

export default function Home() {
  const [shiftType, setShiftType] = useState<ShiftType>("morning");
  const [longGuards, setLongGuards] = useState<number>(3);
  const [shortGuards, setShortGuards] = useState<number>(2);
  const [afternoonIncomingGuards, setAfternoonIncomingGuards] = useState<number>(0);
  const [userLength, setUserLength] = useState<GuardLength>("long");
  const [startingPosition, setStartingPosition] = useState<Location>("אדום");
  const [rows, setRows] = useState<RotationRow[]>([]);
  const [error, setError] = useState<string>("");
  const [useLottery, setUseLottery] = useState<boolean>(false);
  const [guardNames, setGuardNames] = useState<string[]>([]);
  const [lotteryResults, setLotteryResults] = useState<Record<string, { start: Location; end: Location }> | null>(null);
  const [showAnimation, setShowAnimation] = useState<boolean>(false);
  const [showReveal, setShowReveal] = useState<boolean>(false);
  const showAfternoonGuardsInput =
    userLength === "long" && (shiftType === "morning" || shiftType === "night");
  const guardsAtShiftStart =
    shiftType === "night" && userLength === "long"
      ? longGuards + afternoonIncomingGuards
      : longGuards + shortGuards;
  const isPlazaDisabled = guardsAtShiftStart < 5;
  const isEscortDisabled = guardsAtShiftStart < 4;
  const isAllGuardsIdentical = allGuardsIdentical(longGuards, shortGuards, afternoonIncomingGuards, shiftType, userLength);
  const totalGuards = isAllGuardsIdentical ? longGuards : longGuards + shortGuards;
  const availableStartOptions = LOCATION_OPTIONS.filter((loc) => {
    if (loc === "רחבה" && isPlazaDisabled) {
      return false;
    }
    if (loc === "ליווי" && isEscortDisabled) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if ((isPlazaDisabled && startingPosition === "רחבה") || (isEscortDisabled && startingPosition === "ליווי")) {
      setStartingPosition("אדום");
    }
  }, [isPlazaDisabled, isEscortDisabled, startingPosition]);

  // Clear lottery results when guard configuration changes
  useEffect(() => {
    setLotteryResults(null);
  }, [shiftType, longGuards, shortGuards, afternoonIncomingGuards, userLength]);

  // Clear lottery results when lottery mode is disabled
  useEffect(() => {
    if (!useLottery) {
      setLotteryResults(null);
    }
  }, [useLottery]);

  const recommendedStart = useMemo(() => {
    try {
      return recommendStart({
        shiftType,
        longGuards,
        shortGuards,
        afternoonIncomingGuards,
        userLength,
      });
    } catch {
      return null;
    }
  }, [shiftType, longGuards, shortGuards, afternoonIncomingGuards, userLength]);

  const totalFieldPosts = useMemo(() => {
    return rows.filter((row) => !isFreeLike(row.station)).length;
  }, [rows]);

  const startsThatFinishFree = useMemo(() => {
    return availableStartOptions.filter((start) => {
      try {
        const candidateRows = buildRotation({
          shiftType,
          longGuards,
          shortGuards,
          afternoonIncomingGuards,
          userLength,
          startingPosition: start,
        });
        return candidateRows.length > 0 && isFreeLike(candidateRows[candidateRows.length - 1].station);
      } catch {
        return false;
      }
    });
  }, [shiftType, longGuards, shortGuards, afternoonIncomingGuards, userLength, availableStartOptions]);

  function handleCalculate() {
    setError("");
    try {
      if (useLottery && guardNames.some(name => name.trim())) {
        // Clear previous lottery results when starting a new lottery
        setLotteryResults(null);
        setShowAnimation(true);
        setTimeout(() => {
          performLottery();
        }, 500);
      } else {
        const rotation = buildRotation({
          shiftType,
          longGuards,
          shortGuards,
          afternoonIncomingGuards,
          userLength,
          startingPosition,
          useLottery: false,
        });
        setRows(rotation);
        // Don't clear lottery results for regular calculations
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setRows([]);
      setError(message);
    }
  }

  function performLottery() {
    try {
      // Get the number of guards on duty at the START of the shift
      const guardsOnDutyAtStart = getStartingGuardsCount(
        shiftType,
        longGuards,
        shortGuards,
        afternoonIncomingGuards,
        userLength
      );

      // Get all available starting positions for that number of guards
      const availableStartPositions = getAvailablePositions(guardsOnDutyAtStart);

      // Shuffle the starting positions
      const shuffledStartPositions = [...availableStartPositions].sort(() => Math.random() - 0.5);

      // Assign guards to starting positions
      // For each starting position, build the ACTUAL rotation to see where they end up
      const results: Record<string, { start: Location; end: Location }> = {};
      for (let i = 0; i < totalGuards; i++) {
        const guardName = guardNames[i]?.trim();
        const displayName = guardName || `Guard ${i + 1}`;
        
        if (i < shuffledStartPositions.length) {
          const startPosition = shuffledStartPositions[i];
          
          // Build the actual rotation with this starting position
          const actualRotation = buildRotation({
            shiftType,
            longGuards,
            shortGuards,
            afternoonIncomingGuards,
            userLength,
            startingPosition: startPosition,
            useLottery: false,
          });

          // The ending position is the ACTUAL last station from the rotation engine
          const endPosition = actualRotation.length > 0 ? actualRotation[actualRotation.length - 1].station : startPosition;
          
          results[displayName] = {
            start: startPosition,
            end: endPosition
          };
        }
      }

      setLotteryResults(results);
      setShowReveal(false);

      // Wait 2 seconds for suspense, then reveal
      setTimeout(() => {
        setShowReveal(true);
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setRows([]);
      setError(message);
      setShowAnimation(false);
    }
  }

  function handleAcceptLottery() {
    const rotationData = sessionStorage.getItem('pendingRotation');
    if (rotationData) {
      setRows(JSON.parse(rotationData));
      sessionStorage.removeItem('pendingRotation');
    }
    setShowAnimation(false);
    setLotteryResults(null);
    setShowReveal(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#050811] via-[#090f1f] to-[#050811] px-4 py-8 text-cyan-100">
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-2xl border border-cyan-400/20 bg-white/5 p-5 shadow-[0_0_45px_rgba(0,180,255,0.15)] backdrop-blur-xl md:p-8">
          <header className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-cyan-200 md:text-3xl">Security Rotation Console</h1>
            <p className="mt-2 text-sm text-cyan-100/70">
              Shift planner for guards with dynamic 5/4/3 manpower transitions.
            </p>
          </header>

          <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="rounded-2xl border border-cyan-300/15 bg-white/5 p-3">
              <span className="mb-2 block text-sm text-cyan-100/80">Shift Type</span>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value as ShiftType)}
                className="w-full rounded-xl border border-cyan-300/30 bg-[#0b1427] px-3 py-3 text-base outline-none ring-cyan-300 transition focus:ring-2"
              >
                <option value="morning">Morning</option>
                <option value="night">Night</option>
              </select>
            </label>

            <label className="rounded-2xl border border-cyan-300/15 bg-white/5 p-3">
              <span className="mb-2 block text-sm text-cyan-100/80">Your Shift Length</span>
              <select
                value={userLength}
                onChange={(e) => setUserLength(e.target.value as GuardLength)}
                className="w-full rounded-xl border border-cyan-300/30 bg-[#0b1427] px-3 py-3 text-base outline-none ring-cyan-300 transition focus:ring-2"
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </label>

            <div className="md:col-span-2 flex flex-wrap items-start gap-3">
              <label className="w-fit rounded-2xl border border-cyan-300/15 bg-white/5 p-3">
                <span className="mb-2 block text-sm text-cyan-100/80">Long Guards</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={longGuards}
                  onChange={(e) => setLongGuards(Number(e.target.value))}
                  className="w-24 rounded-xl border border-cyan-300/30 bg-[#0b1427] px-3 py-3 text-base outline-none ring-cyan-300 transition focus:ring-2"
                />
              </label>

              <label className="w-fit rounded-2xl border border-cyan-300/15 bg-white/5 p-3">
                <span className="mb-2 block text-sm text-cyan-100/80">Short Guards</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={shortGuards}
                  onChange={(e) => setShortGuards(Number(e.target.value))}
                  className="w-24 rounded-xl border border-cyan-300/30 bg-[#0b1427] px-3 py-3 text-base outline-none ring-cyan-300 transition focus:ring-2"
                />
              </label>

              {showAfternoonGuardsInput && (
                <label className="w-fit rounded-2xl border border-cyan-300/15 bg-white/5 p-3">
                  <span className="mb-2 block text-sm text-cyan-100/80">Afternoon Guards</span>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={afternoonIncomingGuards}
                    onChange={(e) => setAfternoonIncomingGuards(Number(e.target.value))}
                    className="w-24 rounded-xl border border-cyan-300/30 bg-[#0b1427] px-3 py-3 text-base outline-none ring-cyan-300 transition focus:ring-2"
                  />
                </label>
              )}
            </div>

            {isAllGuardsIdentical && (
              <label className="w-full rounded-2xl border border-cyan-300/15 bg-white/5 p-3 md:col-span-2 flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useLottery}
                  onChange={(e) => setUseLottery(e.target.checked)}
                  className="h-5 w-5 rounded border-cyan-300/30 bg-[#0b1427] cursor-pointer accent-cyan-400"
                />
                <div className="flex-1">
                  <span className="block text-sm font-semibold text-cyan-100">🎰 Roulette Mode</span>
                  <span className="block text-xs text-cyan-100/60">All guards are identical - randomly assign positions for each time slot</span>
                </div>
              </label>
            )}

            {useLottery && isAllGuardsIdentical && (
              <div className="w-full rounded-2xl border border-cyan-300/15 bg-white/5 p-4 md:col-span-2">
                <span className="mb-3 block text-sm font-semibold text-cyan-100">Guard Names</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {Array.from({ length: totalGuards }).map((_, index) => (
                    <input
                      key={`guard-${index}`}
                      type="text"
                      placeholder={`Guard ${index + 1}`}
                      value={guardNames[index] || ""}
                      onChange={(e) => {
                        const newNames = [...guardNames];
                        newNames[index] = e.target.value;
                        setGuardNames(newNames);
                      }}
                      className="rounded-xl border border-cyan-300/30 bg-[#0b1427] px-3 py-2 text-sm outline-none ring-cyan-300 transition focus:ring-2 text-cyan-100"
                    />
                  ))}
                </div>
              </div>
            )}

            <label className={`w-full rounded-2xl border border-cyan-300/15 bg-white/5 p-3 md:mx-auto md:w-fit md:col-span-2 ${useLottery ? "opacity-50 pointer-events-none" : ""}`}>
              <span className="mb-2 block text-sm text-cyan-100/80">Starting Position</span>
              <div className="flex flex-wrap justify-center gap-2 pb-1 md:gap-3">
                {LOCATION_OPTIONS.map((loc) => (
                  (() => {
                    const isDisabled =
                      (loc === "רחבה" && isPlazaDisabled) || (loc === "ליווי" && isEscortDisabled);
                    const isSelected = startingPosition === loc;
                    return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => {
                      if (!isDisabled) {
                        setStartingPosition(loc);
                      }
                    }}
                    disabled={isDisabled}
                    title={
                      isDisabled
                        ? loc === "רחבה"
                          ? "רחבה זמינה רק כשיש 5 שומרים בתחילת המשמרת"
                          : "ליווי זמין רק כשיש 4 או 5 שומרים בתחילת המשמרת"
                        : undefined
                    }
                    className={`relative min-w-[5.5rem] rounded-xl border px-3 py-3 text-sm transition focus:outline-none active:scale-95 md:min-w-[6.75rem] md:px-4 md:text-base ${
                      isDisabled
                        ? "cursor-not-allowed border-zinc-600/70 bg-zinc-700/25 text-zinc-400"
                        : isSelected
                        ? "border-cyan-300 bg-cyan-400/20 shadow-[0_0_20px_rgba(34,211,238,0.45)]"
                        : "border-cyan-300/30 bg-[#0b1427] hover:bg-cyan-900/20"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-sm ${
                        isDisabled ? "bg-zinc-500" : LOCATION_BOOKMARK_CLASSES[loc]
                      }`}
                    />
                    {loc}
                  </button>
                    );
                  })()
                ))}
              </div>
            </label>
          </section>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 text-sm text-cyan-100/80">
              <p>
                Recommended Start:{" "}
                <span className="font-semibold text-cyan-300">{recommendedStart ?? "N/A"}</span>
              </p>
              <p>
                Total Field Posts:{" "}
                <span className="font-semibold text-cyan-300">{rows.length > 0 ? totalFieldPosts : "N/A"}</span>
              </p>
              <p>
                Finishes Free:{" "}
                <span className="font-semibold text-cyan-300">
                  {startsThatFinishFree.length > 0 ? startsThatFinishFree.join(", ") : "None"}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleCalculate}
              className="rounded-2xl border border-cyan-200/50 bg-cyan-400/20 px-5 py-3 font-semibold text-cyan-100 shadow-[0_0_30px_rgba(0,195,255,0.4)] transition hover:bg-cyan-300/25 active:scale-[0.98]"
            >
              Calculate Rotation
            </button>
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          {showAnimation && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
              <style>{`
                @keyframes eggBounce {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-20px); }
                }
                @keyframes crackOpen {
                  0% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
                  100% { clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%); transform: translateY(-10px); }
                }
                @keyframes crackOpenBottom {
                  0% { clip-path: polygon(0 100%, 100% 100%, 100% 0, 0 0); opacity: 0; }
                  100% { clip-path: polygon(0 100%, 100% 100%, 100% 55%, 0 55%); opacity: 1; transform: translateY(10px); }
                }
                .egg-bounce { animation: eggBounce 0.6s infinite ease-in-out; }
                .egg-crack { animation: crackOpen 0.8s ease-out forwards; }
                .egg-bottom { animation: crackOpenBottom 0.8s ease-out forwards; }
              `}</style>
              <div className="rounded-2xl border border-cyan-300/30 bg-gradient-to-b from-[#0a1428] to-[#050811] p-8 max-w-3xl w-full mx-4 shadow-[0_0_60px_rgba(0,180,255,0.3)]">
                <h3 className="text-center text-2xl font-bold text-cyan-200 mb-2">🎰 Guard Lottery</h3>
                <p className="text-center text-sm text-cyan-100/60 mb-8">
                  {showReveal ? "Eggs have hatched!" : "Spinning the magical eggs..."}
                </p>
                
                <div className={`grid mb-8 ${
                  totalGuards === 5 
                    ? 'grid-cols-5 gap-2' 
                    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6'
                }`}>
                  {Array.from({ length: totalGuards }).map((_, index) => {
                    const guardName = guardNames[index]?.trim();
                    const displayName = guardName || `Guard ${index + 1}`;
                    const assignment = lotteryResults?.[displayName];
                    const assignedLocation = assignment?.end; // Show the ending location
                    
                    return (
                      <div
                        key={`egg-${index}`}
                        className="flex flex-col items-center justify-start"
                      >
                        {/* Guard Name - White text above eggs */}
                        <div className="mb-2 h-6 flex items-center justify-center">
                          <p className={`text-white font-bold text-center line-clamp-2 px-1 ${
                            totalGuards === 5 ? 'text-xs' : 'text-sm'
                          }`}>
                            {displayName}
                          </p>
                        </div>

                        {/* Egg Container */}
                        <div className={`relative flex items-center justify-center ${
                          totalGuards === 5 ? 'h-24 w-16' : 'h-32 w-24'
                        }`}>
                          {!showReveal ? (
                            // Bouncing whole egg
                            <div className="egg-bounce w-full h-full relative">
                              {/* Main egg shape with 3D effect */}
                              <svg className="w-full h-full absolute" viewBox="0 0 200 280" preserveAspectRatio="xMidYMid meet">
                                <defs>
                                  <radialGradient id={`eggGrad${index}`} cx="35%" cy="35%">
                                    <stop offset="0%" style={{ stopColor: "#fef3c7", stopOpacity: 1 }} />
                                    <stop offset="50%" style={{ stopColor: "#fcd34d", stopOpacity: 1 }} />
                                    <stop offset="100%" style={{ stopColor: "#f59e0b", stopOpacity: 1 }} />
                                  </radialGradient>
                                  <filter id={`eggShadow${index}`}>
                                    <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
                                  </filter>
                                </defs>
                                {/* More oval egg shape - taller and narrower */}
                                <path
                                  d="M 100 20 C 140 20, 170 70, 170 150 C 170 230, 140 270, 100 280 C 60 270, 30 230, 30 150 C 30 70, 60 20, 100 20"
                                  fill={`url(#eggGrad${index})`}
                                  stroke="#d97706"
                                  strokeWidth="2"
                                  filter={`url(#eggShadow${index})`}
                                />
                                {/* Highlight */}
                                <ellipse cx="75" cy="70" rx="25" ry="45" fill="white" opacity="0.35" />
                              </svg>
                            </div>
                          ) : (
                            // Cracked egg with reveal
                            <>
                              {/* Top cracked part */}
                              <svg className="egg-crack w-full h-full absolute z-10" viewBox="0 0 200 280" preserveAspectRatio="xMidYMid meet">
                                <defs>
                                  <radialGradient id={`eggGradTop${index}`} cx="35%" cy="35%">
                                    <stop offset="0%" style={{ stopColor: "#fef3c7", stopOpacity: 1 }} />
                                    <stop offset="50%" style={{ stopColor: "#fcd34d", stopOpacity: 1 }} />
                                    <stop offset="100%" style={{ stopColor: "#f59e0b", stopOpacity: 1 }} />
                                  </radialGradient>
                                </defs>
                                <path
                                  d="M 100 20 C 140 20, 170 70, 170 150 C 170 230, 140 270, 100 280 C 60 270, 30 230, 30 150 C 30 70, 60 20, 100 20"
                                  fill={`url(#eggGradTop${index})`}
                                  stroke="#d97706"
                                  strokeWidth="2"
                                />
                              </svg>
                              
                              {/* Bottom cracked part */}
                              <svg className="egg-bottom w-full h-full absolute" viewBox="0 0 200 280" preserveAspectRatio="xMidYMid meet">
                                <defs>
                                  <radialGradient id={`eggGradBottom${index}`} cx="35%" cy="35%">
                                    <stop offset="0%" style={{ stopColor: "#fef3c7", stopOpacity: 1 }} />
                                    <stop offset="50%" style={{ stopColor: "#fcd34d", stopOpacity: 1 }} />
                                    <stop offset="100%" style={{ stopColor: "#f59e0b", stopOpacity: 1 }} />
                                  </radialGradient>
                                </defs>
                                <path
                                  d="M 100 20 C 140 20, 170 70, 170 150 C 170 230, 140 270, 100 280 C 60 270, 30 230, 30 150 C 30 70, 60 20, 100 20"
                                  fill={`url(#eggGradBottom${index})`}
                                  stroke="#d97706"
                                  strokeWidth="2"
                                  opacity="0.5"
                                />
                              </svg>
                            </>
                          )}
                        </div>

                        {/* Post reveal - positioned to emerge from egg */}
                        {showReveal && assignedLocation && (
                          <div className={`rounded-lg border-2 border-cyan-200/50 px-2 py-1 text-xs font-bold text-white ${
                            LOCATION_BOOKMARK_CLASSES[assignedLocation]
                          } animate-pulse text-center w-full -mt-2 relative z-20 ${
                            totalGuards === 5 ? 'text-xs px-1 py-0.5' : 'text-sm px-3 py-2'
                          }`}>
                            {assignedLocation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Lottery Results - show during animation */}
                {lotteryResults && Object.keys(lotteryResults).length > 0 && (
                  <div className="mt-8 rounded-2xl border border-emerald-400/30 bg-gradient-to-b from-emerald-500/10 to-emerald-600/5 p-6">
                    <h3 className="text-center text-lg font-semibold text-emerald-300 mb-4">🎰 Lottery Results - Guard Assignments</h3>
                    <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto">
                      {Object.entries(lotteryResults).map(([guardName, assignment]) => {
                        return (
                          <div key={guardName} className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 p-3">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-emerald-100 text-base">{guardName}</span>
                              <div className="flex items-center gap-2">
                                <div className="flex flex-col items-center">
                                  <span className="text-xs text-emerald-100/60 mb-1">Starts</span>
                                  <div className={`rounded-lg border border-cyan-200/30 px-3 py-1 text-sm font-bold text-white ${LOCATION_BOOKMARK_CLASSES[assignment.start]}`}>
                                    {assignment.start}
                                  </div>
                                </div>
                                <div className="text-emerald-300 font-bold text-lg">→</div>
                                <div className="flex flex-col items-center">
                                  <span className="text-xs text-emerald-100/60 mb-1">Ends</span>
                                  <div className={`rounded-lg border border-cyan-200/30 px-3 py-1 text-sm font-bold text-white ${LOCATION_BOOKMARK_CLASSES[assignment.end]}`}>
                                    {assignment.end}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-xs text-emerald-100/60 text-center">Results based on actual rotation calculation</p>
                  </div>
                )}

                {/* Accept button - only show after reveal */}
                {showReveal && (
                  <div className="flex justify-center gap-3 mt-6">
                    <button
                      type="button"
                      onClick={handleAcceptLottery}
                      className="rounded-xl border border-emerald-300/50 bg-emerald-400/25 px-6 py-3 font-semibold text-emerald-100 hover:bg-emerald-400/35 transition"
                    >
                      ✅ Accept & Continue
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Show lottery results after accepting (when modal is closed) */}
        {lotteryResults && Object.keys(lotteryResults).length > 0 && !showAnimation && (
          <section className="mt-6 rounded-2xl border border-emerald-400/20 bg-white/5 p-4 shadow-[0_0_50px_rgba(16,185,129,0.12)] backdrop-blur-xl md:p-6">
            <h2 className="mb-4 text-lg font-semibold text-emerald-300">🎰 Lottery Results - Guard Assignments</h2>
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(lotteryResults).map(([guardName, assignment]) => {
                return (
                  <div key={guardName} className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-emerald-100 text-lg">{guardName}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-emerald-100/60 mb-1">Starts</span>
                          <div className={`rounded-lg border border-cyan-200/30 px-4 py-2 text-sm font-bold text-white ${LOCATION_BOOKMARK_CLASSES[assignment.start]}`}>
                            {assignment.start}
                          </div>
                        </div>
                        <div className="text-emerald-300 font-bold text-xl">→</div>
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-emerald-100/60 mb-1">Ends</span>
                          <div className={`rounded-lg border border-cyan-200/30 px-4 py-2 text-sm font-bold text-white ${LOCATION_BOOKMARK_CLASSES[assignment.end]}`}>
                            {assignment.end}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-emerald-100/60">Results based on actual rotation calculation</p>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-cyan-400/20 bg-white/5 p-4 shadow-[0_0_50px_rgba(0,170,255,0.12)] backdrop-blur-xl md:p-6">
          <h2 className="mb-3 text-lg font-semibold text-cyan-200">Rotation Results</h2>
          <div className="overflow-x-auto rounded-xl border border-cyan-300/20">
            <table className="w-full min-w-[540px] border-collapse text-sm">
              <thead className="bg-cyan-500/10 text-cyan-200">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Time</th>
                  <th className="px-3 py-3 text-left font-semibold">Station</th>
                  <th className="px-3 py-3 text-left font-semibold">Guards On Duty</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-cyan-100/70">
                      Press <span className="font-semibold text-cyan-300">Calculate Rotation</span> to view schedule.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr
                      key={`${row.timeRange}-${index}`}
                      className="border-t border-cyan-300/10 transition odd:bg-[#0c182e]/70 even:bg-[#0a1528]/70 hover:bg-cyan-700/10"
                    >
                      <td className="px-3 py-3">{row.timeRange}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-lg border border-cyan-200/30 bg-cyan-400/10 px-2 py-1 shadow-[0_0_18px_rgba(56,189,248,0.28)]">
                          {row.station}
                        </span>
                      </td>
                      <td className="px-3 py-3">{row.guardsOnDuty}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}