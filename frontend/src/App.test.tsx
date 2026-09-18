import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("App Smoke Test", () => {
  it("renders ExamPrep login screen without crashing", async () => {
    render(<App />);
    await waitFor(() => {
      const heading = screen.getByRole("heading", { name: /ExamPrep/i });
      expect(heading).toBeInTheDocument();
    });
  });
});
