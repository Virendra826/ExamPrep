import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./features/auth/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { RequireRole } from "./components/auth/RequireRole";
import { Navbar } from "./components/layout/Navbar";
import { LoginPage } from "./features/auth/LoginPage";
import { RegisterPage } from "./features/auth/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { QuizConfigPage } from "./pages/QuizConfigPage";
import { QuizSolvePage } from "./features/quiz-solve/QuizSolvePage";
import { QuizResultPage } from "./pages/QuizResultPage";
import { HistoryPage } from "./pages/HistoryPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { AdminPage } from "./pages/AdminPage";

export function AppRoutes() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      <Navbar />
      <div className="flex-1">
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Student / Shared Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quiz/new"
            element={
              <ProtectedRoute>
                <QuizConfigPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/attempts/:attemptId"
            element={
              <ProtectedRoute>
                <QuizSolvePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/attempts/:attemptId/results"
            element={
              <ProtectedRoute>
                <QuizResultPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <HistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Admin Routes */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute>
                <RequireRole allowedRoles={["ADMIN"]}>
                  <AdminPage />
                </RequireRole>
              </ProtectedRoute>
            }
          />

          {/* Root Redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Fallback */}
          <Route
            path="*"
            element={
              <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
                <h2 className="text-4xl font-extrabold text-white mb-2">404</h2>
                <p className="text-slate-400 mb-6">The requested page could not be found.</p>
                <a
                  href="/dashboard"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
                >
                  Return to Dashboard
                </a>
              </div>
            }
          />
        </Routes>
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
