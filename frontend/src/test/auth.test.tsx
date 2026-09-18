import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthContext";
import { AppRoutes } from "../App";
import { authApi } from "../api/auth.api";
import type { Role, User } from "../types/auth";

vi.mock("../api/auth.api", () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

describe("Authentication & Route Guard Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login form validation errors when submitting empty or invalid fields", async () => {
    // Unauthenticated initial state
    vi.mocked(authApi.me).mockRejectedValue(new Error("Unauthorized"));

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    // Wait for auth initialization to complete
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Sign In/i })).toBeInTheDocument();
    });

    const submitButton = screen.getByRole("button", { name: /Sign In/i });
    fireEvent.click(submitButton);

    // Validation error messages should be displayed
    await waitFor(() => {
      expect(screen.getByText(/Please provide a valid email address/i)).toBeInTheDocument();
      expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
    });
  });

  it("successful login updates context and redirects to dashboard", async () => {
    vi.mocked(authApi.me).mockRejectedValue(new Error("Unauthorized"));

    const fakeStudent: User = {
      id: "u-123",
      name: "John Student",
      email: "john@examprep.dev",
      role: "STUDENT" as Role,
      is_active: true,
    };

    vi.mocked(authApi.login).mockResolvedValue({ user: fakeStudent });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/student@examprep.dev/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/student@examprep.dev/i), {
      target: { value: "john@examprep.dev" },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: "Password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: "john@examprep.dev",
        password: "Password123",
      });
      expect(screen.getByText(/Welcome, John Student \(STUDENT\)/i)).toBeInTheDocument();
    });
  });

  it("unauthenticated access to /admin redirects to /login", async () => {
    // Session check fails
    vi.mocked(authApi.me).mockRejectedValue(new Error("Unauthorized"));

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    // Should redirect to /login and render login page
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Sign in to ExamPrep/i })).toBeInTheDocument();
    });
  });

  it("STUDENT access to /admin is blocked and redirected to /dashboard", async () => {
    const fakeStudent: User = {
      id: "u-123",
      name: "Jane Student",
      email: "jane@examprep.dev",
      role: "STUDENT" as Role,
      is_active: true,
    };

    // Session check returns STUDENT
    vi.mocked(authApi.me).mockResolvedValue({ user: fakeStudent });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    // Should be redirected away from /admin to /dashboard
    await waitFor(() => {
      expect(screen.getByText(/Welcome, Jane Student \(STUDENT\)/i)).toBeInTheDocument();
      expect(screen.queryByText(/Administrative Control Plane/i)).not.toBeInTheDocument();
    });
  });

  it("ADMIN access to /admin is allowed", async () => {
    const fakeAdmin: User = {
      id: "admin-1",
      name: "Super Admin",
      email: "admin@examprep.dev",
      role: "ADMIN" as Role,
      is_active: true,
    };

    vi.mocked(authApi.me).mockResolvedValue({ user: fakeAdmin });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Welcome, Super Admin \(ADMIN\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Admin Dashboard/i)).toBeInTheDocument();
    });
  });
});
