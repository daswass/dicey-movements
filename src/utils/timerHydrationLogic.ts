export function shouldApplyProfileTimerDefault(params: {
  hydrated: boolean;
  isTimerActive: boolean;
  timeLeft: number;
  duration: number;
  openedFromNotification: boolean;
}): boolean {
  const { hydrated, isTimerActive, timeLeft, duration, openedFromNotification } = params;

  return (
    hydrated &&
    !isTimerActive &&
    (timeLeft === 0 || timeLeft !== duration) &&
    duration > 0 &&
    !openedFromNotification
  );
}
