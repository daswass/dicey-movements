import ReactDOM from "react-dom/client";
import App from "./App";
import { PwaUpdatePrompt } from "./components/PwaUpdatePrompt";
import { AuthProvider } from "./contexts/AuthContext";
import { TimerWorkerProvider } from "./contexts/TimerWorkerContext";
import "./index.css";

if (import.meta.env.DEV) {
  import("./utils/devUpdate");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <>
    <PwaUpdatePrompt />
    <TimerWorkerProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </TimerWorkerProvider>
  </>
);
