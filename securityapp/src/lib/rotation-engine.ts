export type ShiftType = "morning" | "afternoon" | "night";
export type GuardLength = "long" | "short";
export type Location = "אדום" | "כחול" | "רחבה" | "חופשי" | "ליווי";

export interface RotationEngineInput {
  shiftType: ShiftType;
  longGuards: number;
  shortGuards: number;
  afternoonIncomingGuards?: number;
  userLength: GuardLength;
  startingPosition: Location;
  useLottery?: boolean;
}

export interface RotationRow {
  timeRange: string;
  startMinute: number;
  endMinute: number;
  guardsOnDuty: number;
  station: Location;
}

interface ShiftWindow {
  startMinute: number;
  endMinute: number;
  firstSlotMinutes: number;
  lastSlotMinutes?: number;
}

const PATTERNS: Record<number, Location[]> = {
  3: ["אדום", "כחול", "חופשי"],
  4: ["אדום", "ליווי", "כחול", "חופשי"],
  5: ["אדום", "ליווי", "כחול", "רחבה", "חופשי"],
};

const LOCATION_RING: Location[] = ["אדום", "ליווי", "כחול", "רחבה", "חופשי"];

function isFreeLike(station: Location): boolean {
  return station === "חופשי" || station === "ליווי";
}

function parseTimeToMinute(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function toDisplay(minute: number): string {
  const normalized = ((minute % 1440) + 1440) % 1440;
  const h = String(Math.floor(normalized / 60)).padStart(2, "0");
  const m = String(normalized % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function buildWindow(shiftType: ShiftType, userLength: GuardLength): ShiftWindow {
  if (shiftType === "morning") {
    return {
      startMinute: parseTimeToMinute("06:00"),
      endMinute: parseTimeToMinute(userLength === "long" ? "18:00" : "13:30"),
      firstSlotMinutes: 30,
      lastSlotMinutes: userLength === "long" ? 30 : undefined,
    };
  }

  if (shiftType === "afternoon") {
    return {
      startMinute: parseTimeToMinute("13:30"),
      endMinute: parseTimeToMinute("21:30"),
      firstSlotMinutes: 60,
    };
  }

  const start = parseTimeToMinute(userLength === "long" ? "18:00" : "21:30");
  let end = parseTimeToMinute("06:00");
  if (end <= start) {
    end += 1440;
  }
  return {
    startMinute: start,
    endMinute: end,
    firstSlotMinutes: userLength === "long" ? 30 : 60,
    lastSlotMinutes: 30,
  };
}

function generateSlots(window: ShiftWindow): Array<{ start: number; end: number }> {
  const slots: Array<{ start: number; end: number }> = [];
  let cursor = window.startMinute;
  let first = true;

  while (cursor < window.endMinute) {
    const remaining = window.endMinute - cursor;
    let duration: number;

    if (first) {
      duration = Math.min(window.firstSlotMinutes, remaining);
      first = false;
    } else if (window.lastSlotMinutes && remaining === window.lastSlotMinutes) {
      duration = window.lastSlotMinutes;
    } else {
      duration = Math.min(60, remaining);
    }

    slots.push({ start: cursor, end: cursor + duration });
    cursor += duration;
  }

  return slots;
}

function getGuardsOnDutyAtMinute(
  shiftType: ShiftType,
  longGuards: number,
  shortGuards: number,
  afternoonIncomingGuards: number,
  userLength: GuardLength,
  minute: number
): number {
  if (shiftType === "morning") {
    const transition = parseTimeToMinute("13:30");
    return minute < transition ? longGuards + shortGuards : longGuards + afternoonIncomingGuards;
  }

  if (shiftType === "afternoon") {
    return longGuards + shortGuards;
  }

  const transition = parseTimeToMinute("21:30");
  const normalized = minute >= 1440 ? minute - 1440 : minute;
  const inEarlyNight = minute < 1440 && normalized < transition;
  if (inEarlyNight) {
    return userLength === "long" ? longGuards + afternoonIncomingGuards : longGuards;
  }
  return longGuards + shortGuards;
}

function ensureSupportedCount(count: number): 3 | 4 | 5 {
  if (count !== 3 && count !== 4 && count !== 5) {
    throw new Error("Rotation supports only 3, 4, or 5 guards on duty.");
  }
  return count;
}

function getNextAvailableLocation(current: Location, pattern: Location[]): Location {
  const startIndex = LOCATION_RING.indexOf(current);
  for (let i = 1; i <= LOCATION_RING.length; i += 1) {
    const candidate = LOCATION_RING[(startIndex + i) % LOCATION_RING.length];
    if (pattern.includes(candidate)) {
      return candidate;
    }
  }
  return pattern[0];
}

function getPhaseIndex(location: Location, pattern: Location[]): number {
  const idx = pattern.indexOf(location);
  return idx === -1 ? 0 : idx;
}

export function allGuardsIdentical(
  longGuards: number,
  shortGuards: number,
  afternoonIncomingGuards: number,
  shiftType: ShiftType,
  userLength: GuardLength
): boolean {
  if (shiftType === "morning") {
    return shortGuards === 0 && afternoonIncomingGuards === 0;
  }
  if (shiftType === "afternoon") {
    return shortGuards === 0;
  }
  return shortGuards === 0 && afternoonIncomingGuards === 0;
}

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getStartingGuardsCount(
  shiftType: ShiftType,
  longGuards: number,
  shortGuards: number,
  afternoonIncomingGuards: number,
  userLength: GuardLength
): number {
  if (shiftType === "morning") {
    return longGuards + shortGuards;
  }
  if (shiftType === "afternoon") {
    return longGuards + shortGuards;
  }
  // Night shift
  return userLength === "long" ? longGuards + afternoonIncomingGuards : longGuards;
}

export function getAvailablePositions(guardsCount: number): Location[] {
  if (guardsCount === 3) return [...PATTERNS[3]];
  if (guardsCount === 4) return [...PATTERNS[4]];
  if (guardsCount === 5) return [...PATTERNS[5]];
  throw new Error("Unsupported guards count");
}

export function getEndingPost(startingPost: Location, guardsCount: number): Location {
  const pattern = getAvailablePositions(guardsCount);
  const startIndex = pattern.indexOf(startingPost);
  if (startIndex === -1) return startingPost;
  
  // Next position in the cycle
  const endIndex = (startIndex + 1) % pattern.length;
  return pattern[endIndex];
}

export function buildRotation(input: RotationEngineInput): RotationRow[] {
  const window = buildWindow(input.shiftType, input.userLength);
  const slots = generateSlots(window);

  let previousPattern: Location[] | null = null;
  let phaseIndex = 0;
  let lastLocation: Location = input.startingPosition;
  let isFirstSlot = true;

  const rows: RotationRow[] = [];

  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i];
    const count = ensureSupportedCount(
      getGuardsOnDutyAtMinute(
        input.shiftType,
        input.longGuards,
        input.shortGuards,
        input.afternoonIncomingGuards ?? 0,
        input.userLength,
        slot.start
      )
    );
    const pattern = PATTERNS[count];

    if (i === 0) {
      if (input.useLottery) {
        lastLocation = getRandomElement(pattern);
      } else {
        if (!pattern.includes(lastLocation)) {
          lastLocation = pattern[0];
        }
      }
      phaseIndex = getPhaseIndex(lastLocation, pattern);
      isFirstSlot = false;
    } else if (previousPattern === pattern) {
      phaseIndex = (phaseIndex + 1) % pattern.length;
      lastLocation = pattern[phaseIndex];
    } else {
      if (pattern.includes(lastLocation)) {
        phaseIndex = getPhaseIndex(lastLocation, pattern);
      } else {
        const nextLocation = getNextAvailableLocation(lastLocation, pattern);
        phaseIndex = getPhaseIndex(nextLocation, pattern);
        lastLocation = nextLocation;
      }
    }

    rows.push({
      timeRange: `${toDisplay(slot.start)}-${toDisplay(slot.end)}`,
      startMinute: slot.start,
      endMinute: slot.end,
      guardsOnDuty: count,
      station: lastLocation,
    });

    previousPattern = pattern;
  }

  return rows;
}

export function recommendStart(input: Omit<RotationEngineInput, "startingPosition">): Location {
  const candidates: Location[] = ["אדום", "כחול", "רחבה", "חופשי", "ליווי"];
  let best: Location = "אדום";
  let bestFreeMinutes = -1;
  let bestFieldSlots = Number.POSITIVE_INFINITY;
  let bestEndsFree = false;

  for (const start of candidates) {
    const rows = buildRotation({ ...input, startingPosition: start });
    const freeMinutes = rows
      .filter((row) => isFreeLike(row.station))
      .reduce((sum, row) => sum + (row.endMinute - row.startMinute), 0);
    const fieldSlots = rows.filter((row) => !isFreeLike(row.station)).length;
    const endsFree = rows.length > 0 && isFreeLike(rows[rows.length - 1].station);

    const isBetterByFieldSlots = fieldSlots < bestFieldSlots;
    const isSameFieldSlots = fieldSlots === bestFieldSlots;
    const isBetterTieBreaker =
      isSameFieldSlots &&
      ((endsFree && !bestEndsFree) || (endsFree === bestEndsFree && freeMinutes > bestFreeMinutes));

    if (isBetterByFieldSlots || isBetterTieBreaker) {
      bestFieldSlots = fieldSlots;
      bestFreeMinutes = freeMinutes;
      best = start;
      bestEndsFree = endsFree;
    }
  }

  return best;
}
