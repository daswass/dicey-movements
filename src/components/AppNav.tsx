import { Link } from "react-router-dom";
import { UserProfile } from "../types/social";
import TimerHeader from "./TimerHeader";

interface AppNavProps {
  userProfile: UserProfile | null;
  sessionEmail?: string;
  showTimerHeader: boolean;
  isTimerActive: boolean;
  timeLeft: number;
  pendingFriendRequests: number;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  onSignOut: () => void;
}

export default function AppNav({
  userProfile,
  sessionEmail,
  showTimerHeader,
  isTimerActive,
  timeLeft,
  pendingFriendRequests,
  isMenuOpen,
  setIsMenuOpen,
  onSignOut,
}: AppNavProps) {
  return (
    <nav className="bg-gray-800 shadow-lg fixed w-full z-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between h-16">
          <h1 className="text-2xl font-bold flex items-center gap-2 flex-shrink-0">
            <span className="text-blue-600 dark:text-blue-400">Dicey</span>
            <span className="text-red-500 dark:text-red-400">Movements</span>
          </h1>

          <div className="hidden md:flex flex-grow justify-center space-x-8">
            <Link to="/" className="nav-link">
              Game
            </Link>
            {userProfile && showTimerHeader && (
              <TimerHeader isActive={isTimerActive} timeLeft={timeLeft} />
            )}
            <Link to="/friends" className="nav-link">
              Friends
              {pendingFriendRequests > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                  {pendingFriendRequests}
                </span>
              )}
            </Link>
            <Link to="/activity" className="nav-link">
              Activity
            </Link>
            <Link to="/map" className="nav-link">
              Heists
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-4 flex-shrink-0">
            <span className="text-sm font-medium text-gray-200">Hey {userProfile?.first_name}!</span>
            <button onClick={onSignOut} className="btn-secondary">
              Sign Out
            </button>
          </div>

          <div className="-mr-2 flex md:hidden">
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              aria-controls="mobile-menu"
              aria-expanded={isMenuOpen}>
              <span className="sr-only">Open main menu</span>
              {!isMenuOpen ? (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
              ) : (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden" id="mobile-menu">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link to="/" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>
              Game
            </Link>
            {userProfile && showTimerHeader && (
              <div className="px-3 py-2 text-sm font-medium text-gray-200">
                <TimerHeader isActive={isTimerActive} timeLeft={timeLeft} />
              </div>
            )}
            <Link to="/friends" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>
              Friends
              {pendingFriendRequests > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                  {pendingFriendRequests}
                </span>
              )}
            </Link>
            <Link to="/activity" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>
              Activity
            </Link>
            <Link to="/map" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>
              Heists
            </Link>
          </div>
          <div className="pt-4 pb-3 border-t border-gray-700">
            <div className="flex items-center px-5">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 rounded-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z"></path>
                </svg>
              </div>
              <div className="ml-3">
                <div className="text-base font-medium leading-none text-white">{userProfile?.first_name}</div>
                <div className="text-sm font-medium leading-none text-gray-400">{sessionEmail}</div>
              </div>
            </div>
            <div className="mt-3 px-2 space-y-1">
              <button
                onClick={() => {
                  onSignOut();
                  setIsMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-400 hover:text-white hover:bg-gray-700">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
