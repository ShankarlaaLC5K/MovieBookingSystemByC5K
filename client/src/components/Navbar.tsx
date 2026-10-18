import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Menu,
  MapPin,
  User,
  LogOut,
  X,
  Sun,
  Moon,
  Wallet,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const handleLogout = () => {
    closeMobileMenu();
    logout();
  };

  const linkClass =
    "text-slate-700 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white";

  const mobileLinkClass =
    "rounded-lg px-4 py-3 text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <nav className="mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-between py-4">
          <Link
            to="/"
            onClick={closeMobileMenu}
            className="text-2xl font-bold text-slate-900 dark:text-white"
          >
            New<span className="text-red-500">Ticket</span>
          </Link>

          <div className="hidden items-center gap-5 lg:flex">
            <Link to="/" className={linkClass}>
              Home
            </Link>

            <Link to="/movies" className={linkClass}>
              Movies
            </Link>

            <Link
              to="/movies"
              className="inline-flex items-center gap-1.5 text-slate-700 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
            >
              <MapPin size={16} />
              Near You
            </Link>

            {user && (
              <>
                <Link to="/bookings" className={linkClass}>
                  My Bookings
                </Link>

                <Link
                  to="/wallet"
                  className="inline-flex items-center gap-1.5 text-slate-700 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                >
                  <Wallet size={16} />
                  Wallet
                </Link>

                <Link
                  to="/profile"
                  className="inline-flex items-center gap-1.5 text-slate-700 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                >
                  <User size={16} />
                  Profile
                </Link>

                {user.role === "admin" && (
                  <Link to="/admin" className={linkClass}>
                    Admin
                  </Link>
                )}

                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Hi, {user.name}
                </span>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </>
            )}

            {!user && (
              <>
                <Link to="/login" className={linkClass}>
                  Login
                </Link>

                <Link
                  to="/register"
                  className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700"
                >
                  Register
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
            >
              {theme === "dark" ? (
                <Moon size={20} strokeWidth={2.5} />
              ) : (
                <Sun size={20} strokeWidth={2.5} />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
            >
              {theme === "dark" ? (
                <Moon size={20} strokeWidth={2.5} />
              ) : (
                <Sun size={20} strokeWidth={2.5} />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((current) => !current)}
              aria-label="Toggle navigation menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 py-4 dark:border-slate-800 lg:hidden">
            <div className="flex flex-col gap-2">
              <Link to="/" onClick={closeMobileMenu} className={mobileLinkClass}>
                Home
              </Link>

              <Link
                to="/movies"
                onClick={closeMobileMenu}
                className={mobileLinkClass}
              >
                Movies
              </Link>

              <Link
                to="/movies"
                onClick={closeMobileMenu}
                className={mobileLinkClass}
              >
                Near You
              </Link>

              {user && (
                <>
                  <Link
                    to="/bookings"
                    onClick={closeMobileMenu}
                    className={mobileLinkClass}
                  >
                    My Bookings
                  </Link>

                  <Link
                    to="/wallet"
                    onClick={closeMobileMenu}
                    className={mobileLinkClass}
                  >
                    Wallet
                  </Link>

                  <Link
                    to="/profile"
                    onClick={closeMobileMenu}
                    className={mobileLinkClass}
                  >
                    Profile
                  </Link>

                  {user.role === "admin" && (
                    <Link
                      to="/admin"
                      onClick={closeMobileMenu}
                      className={mobileLinkClass}
                    >
                      Admin
                    </Link>
                  )}

                  <div className="px-4 py-2 text-sm text-slate-500">
                    Hi, {user.name}
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mx-4 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 font-medium text-white transition hover:bg-red-700"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </>
              )}

              {!user && (
                <>
                  <Link
                    to="/login"
                    onClick={closeMobileMenu}
                    className={mobileLinkClass}
                  >
                    Login
                  </Link>

                  <Link
                    to="/register"
                    onClick={closeMobileMenu}
                    className={mobileLinkClass}
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

export default Navbar;