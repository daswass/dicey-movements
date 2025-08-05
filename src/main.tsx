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

      // Handle service worker updates - only when there's an actual functional change
      registration.addEventListener("updatefound", () => {
        console.log("Service Worker update found");
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              console.log("New service worker installed, but not auto-activating");
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
