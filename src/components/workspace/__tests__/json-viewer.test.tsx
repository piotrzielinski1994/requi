import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { JsonViewer } from "@/components/workspace/json-viewer";

const NESTED = '{ "a": { "b": 1 } }';

describe("JsonViewer", () => {
  // behavior: the response viewer mounts a read-only CodeMirror surface.
  it("should mount a read-only code surface", () => {
    const { container } = render(<JsonViewer text={NESTED} />);

    const surface = container.querySelector(".cm-content");
    expect(surface).not.toBeNull();
    expect(surface).toHaveAttribute("contenteditable", "false");
  });

  // behavior: the viewer shows NO line-number gutter.
  it("should not render a line-number gutter", () => {
    const { container } = render(<JsonViewer text={NESTED} />);

    expect(container.querySelector(".cm-lineNumbers")).toBeNull();
  });

  // behavior: the viewer renders a fold gutter so response blocks collapse/expand
  // (same affordance as the request body editor).
  it("should render a fold gutter for collapsing blocks", () => {
    const { container } = render(<JsonViewer text={NESTED} />);

    expect(container.querySelector(".cm-foldGutter")).not.toBeNull();
  });
});
