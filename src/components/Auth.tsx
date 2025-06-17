import React, { useState } from "react";
import { supabase } from "../utils/supabaseClient";

const Auth: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<"login" | "signup">("login");
  const [user, setUser] = useState<any>(supabase.auth.getUser());

  // Listen for auth changes
  React.useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user: any } | null) => {
        setUser(session?.user ?? null);
      }
    );
    supabase.auth.getUser().then(({ data }: { data: { user: any } }) => setUser(data.user));
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    // Create the auth user
    const { error: signUpError, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          location: location,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      setMessage("Please check your email for the confirmation link!");
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      setLocation("");
      setView("login");
    }

    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
  };

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="max-w-md w-full p-8 bg-gray-800 rounded-xl shadow-lg">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Welcome back!</h2>
            <p className="text-gray-300">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200 font-medium"
            disabled={loading}>
            {loading ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-md w-full p-8 bg-gray-800 rounded-xl shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            <span className="text-blue-500">Dicey</span>
            <span className="text-red-500">Movements</span>
          </h1>
          <p className="text-gray-400">Micro-workouts made magical!</p>
        </div>

        <div className="flex mb-8 rounded-lg overflow-hidden bg-gray-700/50">
          <button
            className={`flex-1 px-4 py-3 text-center transition-colors duration-200 ${
              view === "login" ? "bg-blue-500 text-white" : "text-gray-300 hover:bg-gray-600"
            }`}
            onClick={() => {
              setView("login");
              setError(null);
              setMessage(null);
            }}>
            Login
          </button>
          <button
            className={`flex-1 px-4 py-3 text-center transition-colors duration-200 ${
              view === "signup" ? "bg-blue-500 text-white" : "text-gray-300 hover:bg-gray-600"
            }`}
            onClick={() => {
              setView("signup");
              setError(null);
              setMessage(null);
            }}>
            Sign Up
          </button>
        </div>

        <form onSubmit={view === "login" ? handleLogin : handleSignUp} className="space-y-4">
          {view === "signup" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-medium text-gray-300 mb-1">
                    First Name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 transition-colors duration-200"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-medium text-gray-300 mb-1">
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 transition-colors duration-200"
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-300 mb-1">
                  Home City
                </label>
                <input
                  id="location"
                  type="text"
                  placeholder="New York"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 transition-colors duration-200"
                  required
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 transition-colors duration-200"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400 transition-colors duration-200"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-500/30 text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 bg-green-900/30 border border-green-500/30 text-green-300 rounded-lg text-sm">
              {message}
            </div>
          )}

          <button
            type="submit"
            className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}>
            {loading
              ? view === "login"
                ? "Logging in..."
                : "Signing up..."
              : view === "login"
              ? "Login"
              : "Sign Up"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Auth;
