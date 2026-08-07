import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import App from "../src/App";
beforeEach(() => localStorage.clear());
it("shows the public viewer without internal categories", () => {
  render(<App />);
  fireEvent.click(
    screen.getByRole("button", { name: "Public Employee Viewer" }),
  );
  expect(screen.getByText("Employee project-hours viewer")).toBeVisible();
  expect(screen.queryByText("Holiday")).not.toBeInTheDocument();
  expect(screen.queryByText("Sick Leave")).not.toBeInTheDocument();
  expect(screen.getByText(/Uncoded · Awaiting project code/)).toBeVisible();
});
it("redirects admin navigation to the workstation gate", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Admin Processing" }));
  expect(
    screen.getByRole("heading", { name: "Administrative access" }),
  ).toBeVisible();
});
it("honours and resets remembered workstation state", () => {
  localStorage.setItem("eas-admin-authorised", "true");
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Admin Processing" }));
  expect(screen.getByText("Timesheet processing")).toBeVisible();
  fireEvent.click(screen.getByText("Logout / reset"));
  expect(localStorage.getItem("eas-admin-authorised")).toBeNull();
});
