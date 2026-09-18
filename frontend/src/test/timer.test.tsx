import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TimerWidget } from "../features/quiz-solve/TimerWidget";
import { formatDuration } from "../hooks/useTimer";

describe("Timer UI & useTimer Hook (PROMPT 20)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("formatDuration utility", () => {
    it("formats seconds to MM:SS and HH:MM:SS accurately", () => {
      expect(formatDuration(0)).toBe("00:00");
      expect(formatDuration(45)).toBe("00:45");
      expect(formatDuration(125)).toBe("02:05");
      expect(formatDuration(3665)).toBe("01:01:05");
    });
  });

  describe("TimerWidget Component", () => {
    it("renders countdown timer for FIXED mode and updates every second", () => {
      const onExpire = vi.fn();
      render(
        <TimerWidget
          timerMode="FIXED"
          initialSeconds={120}
          onExpire={onExpire}
        />
      );

      expect(screen.getByText("02:00")).toBeInTheDocument();
      expect(screen.getByText(/Remaining:/i)).toBeInTheDocument();

      // Advance by 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      expect(screen.getByText("01:30")).toBeInTheDocument();
      expect(onExpire).not.toHaveBeenCalled();
    });

    it("triggers onExpire callback when FIXED timer hits 0", () => {
      const onExpire = vi.fn();
      render(
        <TimerWidget
          timerMode="FIXED"
          initialSeconds={3}
          onExpire={onExpire}
        />
      );

      expect(screen.getByText("00:03")).toBeInTheDocument();

      // Advance past 3 seconds
      act(() => {
        vi.advanceTimersByTime(4000);
      });

      expect(onExpire).toHaveBeenCalledTimes(1);
      expect(screen.getByText("00:00")).toBeInTheDocument();
    });

    it("renders count-up timer for VARIABLE mode and does not expire", () => {
      const onExpire = vi.fn();
      render(
        <TimerWidget
          timerMode="VARIABLE"
          initialSeconds={0}
          onExpire={onExpire}
        />
      );

      expect(screen.getByText("00:00")).toBeInTheDocument();
      expect(screen.getByText(/Elapsed:/i)).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(15000);
      });

      expect(screen.getByText("00:15")).toBeInTheDocument();
      expect(onExpire).not.toHaveBeenCalled();
    });

    it("resyncs displayed time when initialSeconds changes on refresh", () => {
      const { rerender } = render(
        <TimerWidget
          timerMode="FIXED"
          initialSeconds={300}
        />
      );

      expect(screen.getByText("05:00")).toBeInTheDocument();

      // Simulate re-sync from server response
      rerender(
        <TimerWidget
          timerMode="FIXED"
          initialSeconds={250}
        />
      );

      expect(screen.getByText("04:10")).toBeInTheDocument();
    });
  });
});
