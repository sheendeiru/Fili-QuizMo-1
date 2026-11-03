"use client";

import { PixelButton } from "./pixel-primitives";
import { PixelModal } from "./pixel-modal";

export function ConfirmDialog({
  open,
  title = "Confirm action",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <PixelModal
      title={title}
      onClose={() => {
        if (!pending) {
          onCancel();
        }
      }}
      className="max-w-md"
    >
      <p className="text-sm">{message}</p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <PixelButton
          type="button"
          variant="neutral"
          onClick={onCancel}
          disabled={pending}
        >
          {cancelLabel}
        </PixelButton>
        <PixelButton
          type="button"
          variant="danger"
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? "Deleting..." : confirmLabel}
        </PixelButton>
      </div>
    </PixelModal>
  );
}
