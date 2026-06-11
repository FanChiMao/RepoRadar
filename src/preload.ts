import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('trackerBridge', {
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  openPath: (filePath: string) => ipcRenderer.invoke('shell:openPath', filePath),
  exportPdf: (html: string) => ipcRenderer.invoke('report:exportPdf', html),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getSessionToken: () => ipcRenderer.invoke('app:getSessionToken'),
});
