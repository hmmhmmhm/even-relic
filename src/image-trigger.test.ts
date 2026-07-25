// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { OsEventTypeList, type EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { waitForImageClick } from "./image-trigger";

describe("manual image trigger", () => {
  it("ignores unrelated events and resolves one omitted-zero click", async () => {
    let listener: ((event: EvenHubEvent) => void) | undefined;
    let unsubscribed = 0;
    let resolved = false;
    const pending = waitForImageClick({
      onEvenHubEvent: (next) => {
        listener = next;
        return () => { unsubscribed += 1; };
      },
      shutDownPageContainer: async () => true,
    }).then(() => { resolved = true; });

    listener!({ imuData: {} } as EvenHubEvent);
    await Promise.resolve();
    expect(resolved).toBe(false);

    listener!({ sysEvent: {} } as EvenHubEvent);
    await pending;
    listener!({ sysEvent: {} } as EvenHubEvent);
    expect(resolved).toBe(true);
    expect(unsubscribed).toBe(1);
  });

  it("exits on double click without resolving the image trigger", async () => {
    let listener: ((event: EvenHubEvent) => void) | undefined;
    let exits = 0;
    let resolved = false;
    void waitForImageClick({
      onEvenHubEvent: (next) => {
        listener = next;
        return () => undefined;
      },
      shutDownPageContainer: async () => {
        exits += 1;
        return true;
      },
    }).then(() => { resolved = true; });

    listener!({
      sysEvent: { eventType: OsEventTypeList.DOUBLE_CLICK_EVENT },
    } as EvenHubEvent);
    await Promise.resolve();
    expect(exits).toBe(1);
    expect(resolved).toBe(false);
  });
});
