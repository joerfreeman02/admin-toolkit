import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import App from "../src/App";

beforeEach(() => localStorage.clear());

it("shows the synthetic public viewer without internal categories", () => {
  render(<App />);
  fireEvent.click(
    screen.getByRole("button", { name: "Public Employee Viewer" }),
  );
  expect(screen.getByText("Employee project-hours viewer")).toBeVisible();
  expect(screen.queryByText("Holiday")).not.toBeInTheDocument();
  expect(screen.queryByText("Sick Leave")).not.toBeInTheDocument();
  expect(screen.getByText(/Uncoded - Awaiting project code/)).toBeVisible();
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
  expect(screen.getByText("Monthly timesheet consolidation")).toBeVisible();
  fireEvent.click(screen.getByText("Logout / reset"));
  expect(localStorage.getItem("eas-admin-authorised")).toBeNull();
});

it("shows permanent creator attribution and the approved portrait alternative text", () => {
  render(<App />);
  expect(screen.getByText("Created by Joe Freeman")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "About" }));
  expect(
    screen.getByRole("img", { name: "Portrait of Joe Freeman" }),
  ).toBeVisible();
  expect(
    screen.getByText("Creator & Product Owner — AI Engineering Toolkits"),
  ).toBeVisible();
});

it("shows Sprint 1 version and build information", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /ADMIN-0.2.0/ }));
  expect(screen.getByText("TIME-0.2.0")).toBeVisible();
  expect(screen.getByText("Sprint 1")).toBeVisible();
});
