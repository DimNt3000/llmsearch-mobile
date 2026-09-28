import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { ServerConfig } from '../api/client';

const KEY = 'llmsearch.server';

// The token is a credential, so native builds keep it in the Keychain /
// Keystore through expo-secure-store. SecureStore has no web implementation;
// the web build exists for development and falls back to localStorage.
const webStore = {
  get(): string | null {
    try {
      return globalThis.localStorage?.getItem(KEY) ?? null;
    } catch {
      return null;
    }
  },
  set(value: string): void {
    try {
      globalThis.localStorage?.setItem(KEY, value);
    } catch {
      // storage can be unavailable (private mode); the session still works
    }
  },
  remove(): void {
    try {
      globalThis.localStorage?.removeItem(KEY);
    } catch {
      // nothing to clean up
    }
  },
};

function parse(raw: string | null): ServerConfig | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ServerConfig>;
    if (typeof value.baseUrl === 'string' && typeof value.token === 'string') {
      return { baseUrl: value.baseUrl, token: value.token };
    }
  } catch {
    // corrupt entry: behave as if nothing was saved
  }
  return null;
}

export async function loadServer(): Promise<ServerConfig | null> {
  if (Platform.OS === 'web') return parse(webStore.get());
  try {
    return parse(await SecureStore.getItemAsync(KEY));
  } catch {
    return null;
  }
}

export async function saveServer(server: ServerConfig): Promise<void> {
  const raw = JSON.stringify(server);
  if (Platform.OS === 'web') webStore.set(raw);
  else await SecureStore.setItemAsync(KEY, raw);
}

export async function clearServer(): Promise<void> {
  if (Platform.OS === 'web') webStore.remove();
  else await SecureStore.deleteItemAsync(KEY);
}
