import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider, useToast } from "@/components/ui/toast";

function Trigger() {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show("Copied to clipboard")}>
      go
    </button>
  );
}

describe("ToastProvider", () => {
  // behavior: show() surfaces the message
  it("should display the message if show is called", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "go" }));

    expect(screen.getByText("Copied to clipboard")).toBeInTheDocument();
  });

  // behavior: useToast outside a provider is a no-op (does not throw)
  it("should not throw if useToast is used without a provider", async () => {
    const user = userEvent.setup();
    render(<Trigger />);

    await expect(
      user.click(screen.getByRole("button", { name: "go" })),
    ).resolves.not.toThrow();
  });
});
