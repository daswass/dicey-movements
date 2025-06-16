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
      <div className="max-w-md mx-auto p-6 bg-gray-800 rounded-lg shadow-md mb-6">
        <div className="mb-4 text-center">
          <div className="text-lg mb-2 text-white">Welcome back!</div>
          <div className="text-gray-300">{user.email}</div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          disabled={loading}>
          {loading ? "Logging out..." : "Logout"}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-gray-800 rounded-lg shadow-md mb-6">
      <div className="flex mb-6 rounded-lg overflow-hidden">
        <button
          className={`flex-1 px-4 py-2 text-center transition-colors ${
            view === "login"
              ? "bg-blue-500 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
          onClick={() => {
            setView("login");
            setError(null);
            setMessage(null);
          }}>
          Login
        </button>
        <button
          className={`flex-1 px-4 py-2 text-center transition-colors ${
            view === "signup"
              ? "bg-blue-500 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
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
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-300 mb-1">
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-700 text-white"
                  required
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-300 mb-1">
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-700 text-white"
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
                className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-700 text-white"
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
            className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-700 text-white"
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
            className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-700 text-white"
            required
          />
        </div>

        {error && <div className="p-3 bg-red-900/30 text-red-300 rounded-lg text-sm">{error}</div>}

        {message && (
          <div className="p-3 bg-green-900/30 text-green-300 rounded-lg text-sm">{message}</div>
        )}

        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
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
  );
};

export default Auth;
