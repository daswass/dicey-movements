let timerTimeout: ReturnType<typeof setTimeout> | null = null;
let startTime: number | null = null; // Timestamp when the current 'segment' of the timer began (start or resume)
let totalDurationMs: number = 0; // The total duration for the *entire* countdown in milliseconds
let elapsedAtPauseMs: number = 0; // Milliseconds that had elapsed when the timer was paused

console.log("Worker initialized.");

// Function to handle the actual ticking logic
const tick = () => {
  const logPrefix = "WORKER - TICK:";

  if (startTime === null || totalDurationMs === 0) {
    console.error(
      `${logPrefix} Tick called without proper state. startTime: ${startTime}, totalDurationMs: ${totalDurationMs}`
    );
    if (timerTimeout) {
      clearTimeout(timerTimeout);
      timerTimeout = null;
    }
    return;
  }

  const currentTime = Date.now();
  const currentElapsedMs = currentTime - startTime + elapsedAtPauseMs;
  const remainingMs = totalDurationMs - currentElapsedMs;

  const calculatedTimeLeftSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

  self.postMessage({ type: "TICK", timeLeft: calculatedTimeLeftSeconds });
  console.log(`${logPrefix} Sent TICK message with timeLeft: ${calculatedTimeLeftSeconds}`);

  if (remainingMs <= 0) {
    if (timerTimeout) {
      clearTimeout(timerTimeout);
      timerTimeout = null;
    }

    startTime = null;
    totalDurationMs = 0;
    elapsedAtPauseMs = 0;

    self.postMessage({ type: "COMPLETE" });
    return;
  }

  const nextTickExpectedMs = (Math.floor(currentElapsedMs / 1000) + 1) * 1000;
  const delay = Math.max(0, nextTickExpectedMs - currentElapsedMs);

  timerTimeout = setTimeout(tick, delay);
};

self.onmessage = (e: MessageEvent) => {
  const { type, duration } = e.data; // duration is expected in SECONDS from the main thread
  const logPrefix = `WORKER - MESSAGE(${type}):`;

  switch (type) {
    case "START":
      if (timerTimeout) {
        clearTimeout(timerTimeout);
      }

      if (duration !== undefined && typeof duration === "number" && duration > 0) {
        // Convert incoming 'duration' (assumed seconds) to milliseconds
        totalDurationMs = duration * 1000;
        elapsedAtPauseMs = 0; // Reset any previous paused state when starting fresh
      } else if (totalDurationMs === 0) {
        console.error(
          `${logPrefix} START called without a valid 'duration' and no prior 'totalDurationMs' state.`
        );
        return;
      } else {
        elapsedAtPauseMs = 0;
      }

      startTime = Date.now();

      // IMMEDIATE UPDATE: Send the initial full duration to the UI
      // This is now correctly using the totalDurationMs which is in MS
      const initialTimeLeftSeconds = Math.ceil(totalDurationMs / 1000);
      self.postMessage({ type: "TICK", timeLeft: initialTimeLeftSeconds });

      timerTimeout = setTimeout(tick, 1000);

      break;

    case "STOP":
      if (timerTimeout) {
        console.log(`${logPrefix} Clearing timerTimeout.`);
        clearTimeout(timerTimeout);
        timerTimeout = null;
      }
      startTime = null;
      totalDurationMs = 0;
      elapsedAtPauseMs = 0;
      break;

    case "PAUSE":
      if (timerTimeout && startTime !== null && totalDurationMs > 0) {
        console.log(`${logPrefix} Pausing timer.`);
        clearTimeout(timerTimeout);
        timerTimeout = null;

        const elapsedSinceLastStart = Date.now() - startTime;
        elapsedAtPauseMs += elapsedSinceLastStart;

        // Calculate and send the current timeLeft when pausing
        const currentElapsedMs = elapsedAtPauseMs;
        const remainingMs = totalDurationMs - currentElapsedMs;
        const currentTimeLeftSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
        self.postMessage({ type: "TICK", timeLeft: currentTimeLeftSeconds });

        startTime = null;
      } else {
        console.warn(`${logPrefix} PAUSE called but timer not active or already paused.`);
      }
      break;

    case "RESUME":
      if (totalDurationMs > 0 && elapsedAtPauseMs < totalDurationMs) {
        console.log(`${logPrefix} Resuming timer.`);
        if (timerTimeout) {
          console.log(`${logPrefix} Clearing existing timerTimeout before resume.`);
          clearTimeout(timerTimeout);
        }

        startTime = Date.now();

        const remainingOnResumeMs = totalDurationMs - elapsedAtPauseMs;
        const remainingOnResumeSeconds = Math.ceil(remainingOnResumeMs / 1000);
        self.postMessage({ type: "TICK", timeLeft: remainingOnResumeSeconds });

        const currentElapsedTotalMs = elapsedAtPauseMs;
        const nextTickExpectedAbsoluteMs =
          startTime +
          ((Math.floor(currentElapsedTotalMs / 1000) + 1) * 1000 - currentElapsedTotalMs);
        const delayForNextTick = Math.max(0, nextTickExpectedAbsoluteMs - Date.now());

        timerTimeout = setTimeout(tick, delayForNextTick);
      } else {
        console.warn(
          `${logPrefix} RESUME called but no time left or timer not properly set up. totalDurationMs: ${totalDurationMs}ms, elapsedAtPauseMs: ${elapsedAtPauseMs}ms`
        );
      }
      break;
  }
};
