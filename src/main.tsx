import ReactDOM from "react-dom/client";
import App from "./App";
import { TimerWorkerProvider } from "./contexts/TimerWorkerContext";
import "./index.css"; // Your global styles

// Simple service worker registration following best practices
if ("serviceWorker" in navigator) {
  // Register service worker with proper scope
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((_) => {
      // do nothing
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
