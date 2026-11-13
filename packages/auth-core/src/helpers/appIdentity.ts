// Copyright (c) 2015, 2026, Oracle and/or its affiliates.

type AppIdentity = {
  name: string;
  options?: {
    appID?: unknown;
  };
};

export type RedirectFlow = {
  codeVerifier: string;
  providerId: string;
  createdAt: number;
};

const REDIRECT_FLOW_TTL_MS = 15 * 60 * 1000;

function namespace(app: AppIdentity): string {
  const appId = encodeURIComponent(String(app.options?.appID ?? ''));
  const appName = encodeURIComponent(String(app.name));
  return `fusabase:auth:${appId}:${appName}`;
}

export function getTokenStorageKey(app: AppIdentity): string {
  return `${namespace(app)}:tokens`;
}

export function getAuthEventChannelName(app: AppIdentity): string {
  return `${namespace(app)}:events`;
}

function getRedirectFlowStorageKey(app: AppIdentity): string {
  return `${namespace(app)}:redirect-flow`;
}

export function saveRedirectFlow(app: AppIdentity, codeVerifier: string, providerId: string): void {
  const storage = window.sessionStorage;
  const existing = loadRedirectFlow(app);
  if (existing) {
    throw new Error('A redirect sign-in is already in progress for this app');
  }
  storage.setItem(
    getRedirectFlowStorageKey(app),
    JSON.stringify({ codeVerifier, providerId, createdAt: Date.now() } satisfies RedirectFlow)
  );
}

export function loadRedirectFlow(app: AppIdentity): RedirectFlow | null {
  const storage = window.sessionStorage;
  const key = getRedirectFlowStorageKey(app);
  const raw = storage.getItem(key);
  if (!raw) return null;

  try {
    const flow = JSON.parse(raw) as RedirectFlow;
    if (
      typeof flow.codeVerifier !== 'string' ||
      typeof flow.providerId !== 'string' ||
      typeof flow.createdAt !== 'number' ||
      Date.now() - flow.createdAt > REDIRECT_FLOW_TTL_MS
    ) {
      storage.removeItem(key);
      return null;
    }
    return flow;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function clearRedirectFlow(app: AppIdentity): void {
  window.sessionStorage.removeItem(getRedirectFlowStorageKey(app));
}
