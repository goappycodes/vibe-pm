export {};

declare global {
  interface Window {
    api: {
      startAuth: () => Promise<{
        access_token: string;
        refresh_token: string;
        expires_at?: number;
      }>;
      getAutoLaunch: () => Promise<boolean>;
      setAutoLaunch: (enabled: boolean) => Promise<boolean>;
      updateStatus: (status: string) => void;
      hideWindow: () => void;
    };
  }
}
