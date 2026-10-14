import { useState } from "react";
import { Copy, Pencil, Reply, Trash2 } from "lucide-react";
import { REACTION_EMOJIS } from "./chatActions";
import { T } from "./chatTheme";
import type { ChatMessage } from "./types";

// What you can do to one message: react, reply, copy, edit, delete.
// Opens as a bottom sheet on a phone and a centred card on a larger screen.
export default function MessageActionSheet({
  message,
  canEdit,
  canDelete,
  deleteLabel,
  onClose,
  onReact,
  onReply,
  onCopy,
  onEdit,
  onDelete,
}: {
  message: ChatMessage;
  canEdit: boolean;
  canDelete: boolean;
  /** "Delete" for your own message, "Delete for everyone" when moderating. */
  deleteLabel: string;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const myEmoji = message.reactions?.find((r) => r.mine)?.emoji;
  const hasText = !!message.body?.trim();

  const item = `w-full flex items-center gap-3 px-4 py-3 font-ui text-sm text-left ${T.sheetHover}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className={`w-full sm:max-w-xs rounded-t-xl sm:rounded-xl overflow-hidden ${T.sheet}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Message actions"
      >
        {confirming ? (
          <div className="p-4 space-y-3">
            <p className="font-display text-base">Delete this message?</p>
            <p className={`font-ui text-xs ${T.muted}`}>
              It will show as “This message was deleted” for everyone in the chat. This can’t be undone.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                className={`flex-1 rounded-md py-2 font-ui text-sm ${T.outlineBtn}`}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onDelete();
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
                className="flex-1 rounded-md py-2 font-ui text-sm font-semibold bg-red-600 text-white disabled:opacity-60"
              >
                {busy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={`flex justify-between px-3 py-3 border-b ${T.sheetBorder}`}>
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onReact(emoji)}
                  aria-label={`React ${emoji}`}
                  aria-pressed={myEmoji === emoji}
                  className={`w-10 h-10 rounded-full text-xl flex items-center justify-center ${
                    myEmoji === emoji ? T.chipMine : T.sheetHover
                  } ${myEmoji === emoji ? "border" : ""}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <button className={item} onClick={onReply}>
              <Reply size={18} /> Reply
            </button>
            {hasText && (
              <button className={item} onClick={onCopy}>
                <Copy size={18} /> Copy text
              </button>
            )}
            {canEdit && (
              <button className={item} onClick={onEdit}>
                <Pencil size={18} /> Edit
              </button>
            )}
            {canDelete && (
              <button className={`${item} text-red-400`} onClick={() => setConfirming(true)}>
                <Trash2 size={18} /> {deleteLabel}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
