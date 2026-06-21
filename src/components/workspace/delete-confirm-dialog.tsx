import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { findNode } from "@/lib/workspace/tree-locate";
import { countDescendants } from "@/lib/workspace/tree-edit";

export function DeleteConfirmDialog() {
  const { pendingDelete, tree, confirmPendingDelete, cancelPendingDelete } =
    useWorkspace();

  const node = pendingDelete !== null ? findNode(tree, pendingDelete.id) : null;
  const count = node ? countDescendants(node) : 0;

  return (
    <Dialog
      open={pendingDelete !== null}
      onOpenChange={(next) => {
        if (!next) {
          cancelPendingDelete();
        }
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete "{node?.name ?? ""}"?</DialogTitle>
          <DialogDescription>
            Removes the folder and {count} {count === 1 ? "item" : "items"}.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={cancelPendingDelete}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={confirmPendingDelete}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
