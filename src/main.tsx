// main.tsx or index.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // Your global styles
import { TimerWorkerProvider } from "./contexts/TimerWorkerContext"; // Import it here

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* Wrap the App component with TimerWorkerProvider */}
    <TimerWorkerProvider>
      <App />
    </TimerWorkerProvider>
  </React.StrictMode>
);
