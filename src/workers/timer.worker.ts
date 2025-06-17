let timerInterval: NodeJS.Timeout | null = null;
let timeLeft: number = 0;

self.onmessage = (e: MessageEvent) => {
  const { type, duration } = e.data;

  console.log("Timer worker - Received message:", type, duration);

  switch (type) {
    case "START":
      if (timeLeft === 0) {
        timeLeft = duration;
      }

      if (timerInterval) {
        clearInterval(timerInterval);
      }

      timerInterval = setInterval(() => {
        timeLeft -= 1;
        self.postMessage({ type: "TICK", timeLeft });

        if (timeLeft <= 0) {
          clearInterval(timerInterval!);
          self.postMessage({ type: "COMPLETE" });
        }
      }, 1000);

      break;

    case "STOP":
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      break;

    case "PAUSE":
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      break;

    case "RESUME":
      if (!timerInterval) {
        timerInterval = setInterval(() => {
          timeLeft -= 1;
          self.postMessage({ type: "TICK", timeLeft });

          if (timeLeft <= 0) {
            clearInterval(timerInterval!);
            self.postMessage({ type: "COMPLETE" });
          }
        }, 1000);
      }
      break;
  }
};
