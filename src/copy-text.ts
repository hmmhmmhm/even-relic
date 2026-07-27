export type CopyDocument = {
  readonly body: HTMLElement;
  readonly createElement: (tagName: "textarea") => HTMLTextAreaElement;
  readonly execCommand?: (command: string) => boolean;
};

type CopyTextOptions = {
  readonly clipboard?: Pick<Clipboard, "writeText">;
  readonly document?: CopyDocument;
};

export async function copyText(
  text: string,
  options: CopyTextOptions = {},
): Promise<boolean> {
  if (options.clipboard) {
    try {
      await options.clipboard.writeText(text);
      return true;
    } catch {
      // Continue to the synchronous fallback supported by older WebViews.
    }
  }

  const target = options.document ?? document;
  const textarea = target.createElement("textarea") as HTMLTextAreaElement;
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  target.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  try {
    return target.execCommand?.("copy") === true;
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
