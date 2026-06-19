import { describe, it, expect } from "vitest";

import { locateNode, findNode, dropTarget } from "@/lib/workspace/tree-locate";
import type { FolderNode, RequestNode, TreeNode } from "@/lib/workspace/model";

const request = (id: string): RequestNode => ({
  kind: "request",
  id,
  name: id,
  method: "GET",
  url: `https://x/${id}`,
  body: "",
  config: {},
});

const folder = (id: string, children: TreeNode[]): FolderNode => ({
  kind: "folder",
  id,
  name: id,
  config: {},
  children,
});

const tree: TreeNode[] = [
  folder("f1", [request("c1"), request("c2")]),
  request("r1"),
];

describe("locateNode", () => {
  // behavior
  it("should return root parent null and the index if the node is at root", () => {
    expect(locateNode(tree, "r1")).toEqual({ parentId: null, index: 1 });
  });

  // behavior
  it("should return the folder id and child index if the node is nested", () => {
    expect(locateNode(tree, "c2")).toEqual({ parentId: "f1", index: 1 });
  });

  // behavior
  it("should return null if the node is not in the tree", () => {
    expect(locateNode(tree, "missing")).toBeNull();
  });
});

describe("findNode", () => {
  // behavior
  it("should find a nested node by id", () => {
    expect(findNode(tree, "c1")?.id).toBe("c1");
  });

  // behavior
  it("should return null for an unknown id", () => {
    expect(findNode(tree, "nope")).toBeNull();
  });
});

describe("dropTarget", () => {
  // behavior: inside a folder appends to its children
  it("should target the end of a folder's children if position is inside", () => {
    expect(dropTarget(tree, "f1", "inside")).toEqual({
      parentId: "f1",
      index: 2,
    });
  });

  // behavior: inside a request is illegal
  it("should return null if position is inside a request", () => {
    expect(dropTarget(tree, "r1", "inside")).toBeNull();
  });

  // behavior: before a node targets its own index in its parent
  it("should target the node's index if position is before", () => {
    expect(dropTarget(tree, "c2", "before")).toEqual({
      parentId: "f1",
      index: 1,
    });
  });

  // behavior: after a node targets index + 1
  it("should target index plus one if position is after", () => {
    expect(dropTarget(tree, "c1", "after")).toEqual({
      parentId: "f1",
      index: 1,
    });
  });

  // behavior
  it("should return null if the over node is unknown", () => {
    expect(dropTarget(tree, "ghost", "before")).toBeNull();
  });
});
