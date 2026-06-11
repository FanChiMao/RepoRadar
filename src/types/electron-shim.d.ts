interface TrackerBridge {
  openFileDialog: () => Promise<string | null>;
  openPath: (filePath: string) => Promise<boolean>;
  exportPdf: (html: string) => Promise<string | null>;
  getAppVersion: () => Promise<string>;
  getSessionToken: () => Promise<string>;
}

declare global {
  interface Window {
    trackerBridge: TrackerBridge;
  }
}

export {};
