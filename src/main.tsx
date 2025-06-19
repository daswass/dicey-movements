import ReactDOM from "react-dom/client";
import App from "./App";
import { TimerWorkerProvider } from "./contexts/TimerWorkerContext";
import "./index.css"; // Your global styles

ReactDOM.createRoot(document.getElementById("root")!).render(
  <TimerWorkerProvider>
    <App />
  </TimerWorkerProvider>
);
