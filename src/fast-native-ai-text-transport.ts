import {
  createBlankDisplayPage,
  createImageDisplayPage,
} from "./g2-display-hide";
import type { Tile } from "./g2-canvas";
import { diagnosticDuration, diagnosticNow } from "./diagnostic-timing";
import { logDiagnostic } from "./diagnostic-log";
import type {
  Bridge,
  FastCanvasNativeTextController,
} from "./fast-canvas-types";
import { createNativeAiTextModeController } from "./native-ai-text";

export type DisposableNativeTextController = FastCanvasNativeTextController & {
  dispose(): void;
};

export function createFastNativeAiTextController(options: {
  readonly bridge: Bridge;
  readonly tiles: readonly Tile[];
  readonly invalidateImages: () => void;
  readonly restoreImages: () => Promise<void>;
  readonly onFailure: (operation: string) => void;
}): DisposableNativeTextController | undefined {
  const updateText = options.bridge.textContainerUpgrade;
  if (!updateText) return undefined;
  const mode = createNativeAiTextModeController({
    bridge: {
      rebuildPageContainer: options.bridge.rebuildPageContainer.bind(
        options.bridge,
      ),
      textContainerUpgrade: updateText.bind(options.bridge),
    },
    createImagePage: () => createImageDisplayPage(options.tiles),
    onFailure: options.onFailure,
  });
  let restoringImages = false;
  const trace = async (
    operation: string,
    action: () => Promise<boolean>,
  ) => {
    const startedAt = diagnosticNow();
    logDiagnostic("REFRESH", `${operation} start`);
    const succeeded = await action();
    logDiagnostic(
      "REFRESH",
      `${operation} ${succeeded ? "success" : "dropped"}`,
      diagnosticDuration(startedAt),
    );
    return succeeded;
  };
  return {
    active: mode.active,
    async enter(content) {
      if (restoringImages) return false;
      const entered = await trace("native AI enter", () => mode.enter(content));
      if (entered) options.invalidateImages();
      return entered;
    },
    update: (content) => restoringImages
      ? Promise.resolve(false)
      : trace("native AI update", () => mode.update(content)),
    async restore() {
      if (!mode.active() || restoringImages) return false;
      restoringImages = true;
      try {
        const neutralized = await trace("native AI neutralize", async () => {
          try {
            const rebuilt = await options.bridge.rebuildPageContainer(
              createBlankDisplayPage(),
            );
            if (!rebuilt) options.onFailure("neutralize");
            return rebuilt;
          } catch {
            options.onFailure("neutralize");
            return false;
          }
        });
        if (!neutralized) return false;
        const left = await trace("native AI leave", mode.leave);
        if (!left) return false;
        options.invalidateImages();
        await options.restoreImages();
        return true;
      } finally {
        restoringImages = false;
      }
    },
    dispose: mode.dispose,
  };
}
