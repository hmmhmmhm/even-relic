import { useCallback, useEffect, useRef, useState } from "react";
import type { EvenStorage } from "./live-cache";
import {
  createConversateSnapshot,
  DEFAULT_CONVERSATE_SETTINGS,
  resolveConversateHistory,
  resolveConversateSettings,
  type ConversateSettings,
  type ConversateSnapshot,
} from "./conversate-state";

export function useConversateCompanion(storage: EvenStorage, enabled: boolean) {
  const [settings, setSettingsState] = useState<ConversateSettings>(
    DEFAULT_CONVERSATE_SETTINGS,
  );
  const settingsRef = useRef(settings);
  const [snapshot, setSnapshotState] = useState<ConversateSnapshot>(
    createConversateSnapshot,
  );
  const snapshotRef = useRef(snapshot);
  const setSettings = useCallback((value: ConversateSettings) => {
    settingsRef.current = value;
    setSettingsState(value);
  }, []);
  const setSnapshot = useCallback((value: ConversateSnapshot) => {
    snapshotRef.current = value;
    setSnapshotState(value);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void Promise.all([
      resolveConversateSettings(storage),
      resolveConversateHistory(storage),
    ]).then(([nextSettings, history]) => {
      if (!active) return;
      setSettings(nextSettings);
      setSnapshot(createConversateSnapshot(history));
    });
    return () => { active = false; };
  }, [enabled, setSettings, setSnapshot, storage]);
  return {
    settings, settingsRef, setSettings,
    snapshot, snapshotRef, setSnapshot,
  };
}
