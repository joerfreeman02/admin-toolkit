import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import App from "../src/App";

beforeEach(() => {
  localStorage.clear();
  location.hash = "";
});

it("shows the demonstration public viewer without internal categories", () => {
  render(<App />);
  fireEvent.click(
    screen.getByRole("button", { name: "Public Employee Viewer" }),
  );
  expect(screen.getByText("Employee project-hours viewer")).toBeVisible();
  expect(screen.queryByText("Holiday")).not.toBeInTheDocument();
  expect(screen.queryByText("Sick Leave")).not.toBeInTheDocument();
  expect(screen.getByText("Historical carried hours")).toBeVisible();
  expect(screen.getByText("Outstanding Third Party Costs")).toBeVisible();
});

it("fails closed for a malformed Employee Viewer link instead of showing demo data", async () => {
  location.hash = "#employee-viewer=truncated";
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "This Employee Viewer link is invalid or incomplete.",
  );
  expect(
    screen.queryByText("Employee Viewer demonstration"),
  ).not.toBeInTheDocument();
});

it("keeps the fictional data on the explicit demo route only", () => {
  location.hash = "#employee-viewer-demo";
  render(<App />);
  expect(screen.getByText("Employee Viewer demonstration")).toBeVisible();
});

it("redirects admin navigation to the workstation gate", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Admin Processing" }));
  expect(
    screen.getByRole("heading", { name: "Administrative access" }),
  ).toBeVisible();
  expect(screen.getByLabelText("Access code")).toBeVisible();
  expect(screen.getByRole("button", { name: "Unlock NEXUS" })).toBeVisible();
  expect(screen.queryByText(/server-grade|public deployment/i)).toBeNull();
});

it("honours and resets remembered workstation state", () => {
  localStorage.setItem("eas-admin-authorised", "true");
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Admin Processing" }));
  expect(screen.getByText("Create this month's hours reports")).toBeVisible();
  fireEvent.click(screen.getByText("Logout / reset"));
  expect(localStorage.getItem("eas-admin-authorised")).toBeNull();
});

it("presents a workstation-persistent Employee Register with secondary backup controls", () => {
  localStorage.setItem("eas-admin-authorised", "true");
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Admin Processing" }));
  expect(screen.getByText(/employees — ready/)).toBeVisible();
  expect(screen.getByText(/ready each month/i)).toBeVisible();
  expect(screen.getByText("Manage employee list")).toBeVisible();
  expect(
    screen.getByText("Manage / replace Employee Register"),
  ).not.toBeVisible();
  fireEvent.click(screen.getByText("Manage employee list"));
  expect(screen.getByText("Manage / replace Employee Register")).toBeVisible();
  expect(screen.getByText("July 2026")).toBeVisible();
});

it("uses plain business language on the dashboard", () => {
  render(<App />);
  expect(
    screen.getByRole("heading", {
      name: "Monthly timesheets turned into clear, ready-to-use reports.",
    }),
  ).toBeVisible();
  expect(screen.queryByText(/effective-dated|Synthetic viewer/i)).toBeNull();
});

it("shows permanent creator attribution and the approved portrait alternative text", () => {
  render(<App />);
  expect(screen.getByText("Created by Joe Freeman")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "About" }));
  expect(
    screen.getByRole("img", { name: "Portrait of Joe Freeman" }),
  ).toBeVisible();
  expect(
    screen.getByText("Graduate Transport Planner · Creator of EAS FORGE"),
  ).toBeVisible();
  expect(screen.getByText("Created by Joe Freeman · EAS FORGE")).toBeVisible();
});

it("shows NEXUS 1.0.2 production version and build information", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /NEXUS 1.0.2/ }));
  expect(screen.getByText("TIME 1.0.0")).toBeVisible();
  expect(screen.getByText("Production 1.0.2")).toBeVisible();
});
