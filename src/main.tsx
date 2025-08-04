import ReactDOM from "react-dom/client";
import App from "./App";
import { TimerWorkerProvider } from "./contexts/TimerWorkerContext";
import "./index.css"; // Your global styles

// Service worker registration with transparent update handling
if ("serviceWorker" in navigator) {
  // Register service worker with proper scope
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((registration) => {
      console.log("Service Worker registered:", registration);

      // Handle service worker updates
      registration.addEventListener("updatefound", () => {
        console.log("Service Worker update found");
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              console.log("New service worker installed, ready to activate");

              // Check if user is in the middle of a timer before auto-refreshing
              const isTimerActive = localStorage.getItem("timer_active") === "true";
              const timerDuration = localStorage.getItem("timer_duration");

              if (isTimerActive && timerDuration) {
                // Don't auto-refresh if timer is running
                console.log("Timer is active, skipping auto-refresh");
                return;
              }

              // Auto-refresh after a delay if timer not active
              setTimeout(() => {
                if (newWorker.state === "installed") {
                  console.log("Auto-refreshing to activate new service worker");
                  window.location.reload();
                }
              }, 5000); // 5 second delay
            }
          });
        }
      });

      // Handle service worker controller change
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("Service Worker controller changed - new version activated");
      });
    })
    .catch((error) => {
      console.error("Service Worker registration failed:", error);
    });
}

// Render the app immediately - let service worker handle its own lifecycle
ReactDOM.createRoot(document.getElementById("root")!).render(
  <TimerWorkerProvider>
    <App />
  </TimerWorkerProvider>
);
