import type { PhoneStringKey } from "./phone-i18n";

export const TRANSPORT_STATUS = Object.freeze({
  preparing: "transport:preparing",
  disabled: "transport:disabled",
  active: "transport:active",
  error: "transport:error",
} as const);

export function transportStatusKey(status: string): PhoneStringKey {
  if (/fail|error|timeout|timed out|explod/iu.test(status)) {
    return "unavailable";
  }
  switch (status) {
    case TRANSPORT_STATUS.preparing:
      return "ready";
    case TRANSPORT_STATUS.disabled:
      return "disabled";
    case TRANSPORT_STATUS.error:
      return "unavailable";
    default:
      return "active";
  }
}
