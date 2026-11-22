/** Promise-based confirmation dialog rendered by the shell (no blocking browser dialogs). */
import { useSyncExternalStore } from "react";

export interface AskRequest {
  title: string;
  body: string;
  buttons: string[];
  resolve: (choice: string | null) => void;
}

let current: AskRequest | null = null;
const listeners = new Set<() => void>();

export function ask(title: string, body: string, buttons: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    current?.resolve(null);
    current = {
      title,
      body,
      buttons,
      resolve: (c) => {
        current = null;
        listeners.forEach((l) => l());
        resolve(c);
      },
    };
    listeners.forEach((l) => l());
  });
}

export function useAsk(): AskRequest | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
