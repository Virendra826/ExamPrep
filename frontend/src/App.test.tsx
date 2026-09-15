import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("App Smoke Test", () => {
  it("renders ExamPrep placeholder heading without crashing", () => {
    render(<App />);
    const heading = screen.getByRole("heading", { name: /ExamPrep/i });
    expect(heading).toBeInTheDocument();
  });
});
