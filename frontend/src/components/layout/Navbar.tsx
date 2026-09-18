import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/useAuth";
import { LogOut, ShieldCheck, User as UserIcon, BookOpen } from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  const isAdmin = user.role === "ADMIN";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-8">
          <Link to="/dashboard" className="flex items-center space-x-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">
              Exam<span className="text-indigo-400">Prep</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            <Link
              to="/dashboard"
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/quiz/new"
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              New Quiz
            </Link>
            <Link
              to="/history"
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              History
            </Link>
            <Link
              to="/analytics"
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Analytics
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className="px-3 py-2 rounded-lg text-sm font-medium text-indigo-300 hover:text-indigo-200 hover:bg-indigo-950/50 transition-colors flex items-center space-x-1.5"
              >
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>Admin</span>
              </Link>
            )}
          </nav>
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60">
            <div className="w-7 h-7 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center text-xs font-semibold">
              <UserIcon className="w-3.5 h-3.5" />
            </div>
            <div className="text-left leading-tight pr-1">
              <div className="text-xs font-semibold text-slate-200">{user.name}</div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">
                {user.role}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            aria-label="Log out"
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-rose-300 hover:bg-rose-950/30 border border-transparent hover:border-rose-900/50 rounded-lg transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
