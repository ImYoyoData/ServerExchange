import type { IDomEditor } from "@wangeditor/editor";
import { DomEditor, SlateTransforms } from "@wangeditor/editor";

export const MEDIA_FULL_WIDTH = "100%";
export const MEDIA_AUTO_HEIGHT = "auto";

/** wangEditor 内置宽度选项，保留用户手动调整 */
const PRESET_MEDIA_WIDTHS = new Set(["25%", "50%", "75%", "100%"]);

function shouldApplyDefaultWidth(width?: string) {
  const value = String(width ?? "").trim();
  if (!value) return true;
  return !PRESET_MEDIA_WIDTHS.has(value);
}

export function applyFullWidthToImage(
  editor: IDomEditor | undefined,
  matchSrc?: string
) {
  if (!editor || editor.isDestroyed) return;

  for (const node of editor.getElemsByType("image")) {
    const image = node as {
      src?: string;
      style?: { width?: string; height?: string };
    };
    if (matchSrc && image.src !== matchSrc) continue;
    if (!shouldApplyDefaultWidth(image.style?.width)) continue;

    const path = DomEditor.findPath(editor, node);
    SlateTransforms.setNodes(
      editor,
      {
        style: {
          ...(image.style ?? {}),
          width: MEDIA_FULL_WIDTH,
          height: MEDIA_AUTO_HEIGHT
        }
      },
      { at: path }
    );
  }
}

export function applyFullWidthToVideo(
  editor: IDomEditor | undefined,
  matchSrc?: string
) {
  if (!editor || editor.isDestroyed) return;

  for (const node of editor.getElemsByType("video")) {
    const video = node as { src?: string; width?: string; height?: string };
    if (matchSrc && video.src !== matchSrc) continue;
    if (!shouldApplyDefaultWidth(video.width)) continue;

    const path = DomEditor.findPath(editor, node);
    SlateTransforms.setNodes(
      editor,
      {
        width: MEDIA_FULL_WIDTH,
        height: MEDIA_AUTO_HEIGHT
      },
      { at: path }
    );
  }
}

export function ensureDefaultMediaWidth(editor: IDomEditor | undefined) {
  if (!editor || editor.isDestroyed) return false;

  const beforeHtml = editor.getHtml();
  applyFullWidthToImage(editor);
  applyFullWidthToVideo(editor);
  return editor.getHtml() !== beforeHtml;
}
