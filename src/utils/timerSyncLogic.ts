export interface SyncTimerState {
  startTime: string | null;
  masterDeviceId: string | null;
  duration: number;
}

export function computeRemainingSecondsFromSync(
  startTimeIso: string,
  durationSeconds: number,
  nowMs: number = Date.now()
): number {
  const elapsedMs = nowMs - new Date(startTimeIso).getTime();
  const remainingMs = Math.max(0, durationSeconds * 1000 - elapsedMs);
  return Math.ceil(remainingMs / 1000);
}

export type SyncTimerAction =
  | { type: "resume"; remainingSeconds: number }
  | { type: "complete" }
  | { type: "clear" }
  | { type: "noop" };

export function resolveSyncTimerAction(params: {
  state: SyncTimerState;
  isTimerActive: boolean;
  timerComplete: boolean;
  isMaster: boolean;
  nowMs?: number;
}): SyncTimerAction {
  const { state, isTimerActive, timerComplete, isMaster, nowMs } = params;

  if (state.startTime && state.masterDeviceId && state.duration > 0) {
    const remainingSeconds = computeRemainingSecondsFromSync(
      state.startTime,
      state.duration,
      nowMs
    );

    if (remainingSeconds > 0) {
      // The server start time is authoritative. Recalculate even when the
      // local worker believes it is already running: mobile browsers can
      // suspend that worker while the app is backgrounded.
      return { type: "resume", remainingSeconds };
    }

    if (!timerComplete) {
      return { type: "complete" };
    }

    return { type: "noop" };
  }

  if (!state.startTime && state.duration > 0 && isMaster && isTimerActive) {
    return { type: "clear" };
  }

  return { type: "noop" };
}
