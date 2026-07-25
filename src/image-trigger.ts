import {
  OsEventTypeList,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";

type TriggerBridge = {
  onEvenHubEvent: (listener: (event: EvenHubEvent) => void) => () => void;
  shutDownPageContainer: (exitMode: number) => Promise<unknown>;
};

export function waitForImageClick(bridge: TriggerBridge) {
  return new Promise<void>((resolve) => {
    let settled = false;
    let unsubscribe: () => void = () => undefined;
    unsubscribe = bridge.onEvenHubEvent((event) => {
      if (settled) return;
      const sysType = event.sysEvent
        ? event.sysEvent.eventType ?? OsEventTypeList.CLICK_EVENT
        : null;
      const textType = event.textEvent
        ? event.textEvent.eventType ?? OsEventTypeList.CLICK_EVENT
        : null;
      if (
        sysType === OsEventTypeList.DOUBLE_CLICK_EVENT
        || textType === OsEventTypeList.DOUBLE_CLICK_EVENT
      ) {
        settled = true;
        unsubscribe();
        void bridge.shutDownPageContainer(1);
      } else if (
        sysType === OsEventTypeList.CLICK_EVENT
        || textType === OsEventTypeList.CLICK_EVENT
      ) {
        settled = true;
        unsubscribe();
        resolve();
      }
    });
  });
}
