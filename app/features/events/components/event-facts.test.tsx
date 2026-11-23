import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EventSeatsFact } from "./event-facts";

describe("EventSeatsFact", () => {
  it("shows only the number of seats without a count", () => {
    render(<EventSeatsFact slots={12} />);

    expect(screen.getByText("12 seats")).toBeInTheDocument();
  });

  it("shows how many seats are left when given the count", () => {
    render(<EventSeatsFact slots={12} seatsLeft={3} />);

    expect(screen.getByText("3 of 12 seats left")).toBeInTheDocument();
  });

  it("says a full event is fully booked, with or without the count", () => {
    const { rerender } = render(<EventSeatsFact slots={12} fullyBooked />);
    expect(
      screen.getByText("fully booked · waiting list open"),
    ).toBeInTheDocument();

    rerender(<EventSeatsFact slots={12} seatsLeft={0} />);
    expect(
      screen.getByText("fully booked · waiting list open"),
    ).toBeInTheDocument();
  });
});
