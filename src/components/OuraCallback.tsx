import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { OuraService } from "../utils/ouraService";
import { Activity, CheckCircle, XCircle } from "lucide-react";

const OuraCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");

        if (error) {
          setStatus("error");
          setMessage("Oura integration was cancelled or failed.");
          return;
        }

        if (!code || !state) {
          setStatus("error");
          setMessage("Missing required parameters for Oura integration.");
          return;
        }

        // Handle the OAuth callback
        await OuraService.handleCallback(code, state);

        setStatus("success");
        setMessage("Oura Ring connected successfully! Redirecting to dashboard...");

        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate("/");
        }, 2000);
      } catch (error) {
        console.error("Error handling Oura callback:", error);
        setStatus("error");
        setMessage("Failed to complete Oura integration. Please try again.");
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="mb-4">
              {status === "loading" && (
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
              )}
              {status === "success" && <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />}
              {status === "error" && <XCircle className="h-12 w-12 text-red-500 mx-auto" />}
            </div>

            <div className="flex items-center justify-center mb-4">
              <Activity className="w-6 h-6 mr-2 text-purple-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Oura Ring Integration
              </h2>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {status === "loading" && "Connecting your Oura Ring..."}
              {status === "success" && message}
              {status === "error" && message}
            </p>

            {status === "error" && (
              <button
                onClick={() => navigate("/")}
                className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors">
                Return to Dashboard
              </button>
            )}

            {status === "success" && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                You'll be redirected automatically...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OuraCallback;
