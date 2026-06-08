import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';

const BACKEND_PORT = 8765;
const DEFAULT_ZOOM_FACTOR = 1;
const MIN_ZOOM_FACTOR = 0.8;
const MAX_ZOOM_FACTOR = 1.6;
const ZOOM_STEP = 0.1;

type ExternalBrowserChoice = 'edge' | 'chrome' | 'default';

type ExternalLinkPreferences = {
  preferredBrowser: ExternalBrowserChoice | null;
};

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;

function externalLinkPreferencesPath(): string {
  return path.join(app.getPath('userData'), 'external-link-preferences.json');
}

function loadExternalLinkPreferences(): ExternalLinkPreferences {
  const defaultPreferences: ExternalLinkPreferences = { preferredBrowser: null };

  try {
    const filePath = externalLinkPreferencesPath();
    if (!fs.existsSync(filePath)) {
      return defaultPreferences;
    }

    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<ExternalLinkPreferences>;
    const preferredBrowser = raw.preferredBrowser;
    if (
      preferredBrowser === 'chrome' ||
      preferredBrowser === 'edge' ||
      preferredBrowser === 'default'
    ) {
      return { preferredBrowser };
    }
  } catch (error) {
    console.warn('[external-link] failed to load preferences', error);
  }

  return defaultPreferences;
}

function saveExternalLinkPreferences(preferences: ExternalLinkPreferences): void {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(externalLinkPreferencesPath(), JSON.stringify(preferences, null, 2), 'utf-8');
  } catch (error) {
    console.warn('[external-link] failed to save preferences', error);
  }
}

function findBrowserExecutable(choice: Exclude<ExternalBrowserChoice, 'default'>): string | null {
  if (process.platform !== 'win32') {
    return null;
  }

  const programFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
  const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const localAppData = process.env['LOCALAPPDATA'] || '';

  const candidates =
    choice === 'chrome'
      ? [
          path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
          path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
          path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        ]
      : [
          path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
          path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
          path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        ];

  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) ?? null;
}

async function launchExternalUrl(url: string, choice: ExternalBrowserChoice): Promise<boolean> {
  if (choice === 'default') {
    await shell.openExternal(url);
    return true;
  }

  const executable = findBrowserExecutable(choice);
  if (!executable) {
    return false;
  }

  const child = spawn(executable, [url], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return true;
}

async function promptForExternalBrowser(
  url: string,
): Promise<{ choice: ExternalBrowserChoice | null; rememberChoice: boolean }> {
  let detail = url;
  try {
    const parsedUrl = new URL(url);
    detail = `${parsedUrl.host}\n${url}`;
  } catch {
    // Keep original URL detail when parsing fails.
  }

  const dialogOptions: Electron.MessageBoxOptions = {
    type: 'question',
    title: '開啟外部連結',
    message: '是否要在外部瀏覽器開啟這個連結？',
    detail,
    buttons: ['Chrome', 'Edge', '預設瀏覽器', '取消'],
    defaultId: 0,
    cancelId: 3,
    noLink: true,
    checkboxLabel: '記住這個選擇，之後直接使用相同瀏覽器開啟外部連結',
  };
  const parentWindow = mainWindow ?? BrowserWindow.getFocusedWindow();
  const result = parentWindow
    ? await dialog.showMessageBox(parentWindow, dialogOptions)
    : await dialog.showMessageBox(dialogOptions);

  const choices: Array<ExternalBrowserChoice | null> = ['chrome', 'edge', 'default', null];
  return {
    choice: choices[result.response] ?? null,
    rememberChoice: result.checkboxChecked,
  };
}

async function openExternalUrlWithConfirmation(url: string): Promise<boolean> {
  const preferences = loadExternalLinkPreferences();

  if (preferences.preferredBrowser) {
    const launched = await launchExternalUrl(url, preferences.preferredBrowser);
    if (launched) {
      return true;
    }

    saveExternalLinkPreferences({ preferredBrowser: null });
    const dialogOptions: Electron.MessageBoxOptions = {
      type: 'warning',
      title: '找不到瀏覽器',
      message: '先前設定的外部瀏覽器無法使用，請重新選擇。',
      buttons: ['確定'],
      defaultId: 0,
      noLink: true,
    };
    const parentWindow = mainWindow ?? BrowserWindow.getFocusedWindow();
    if (parentWindow) {
      await dialog.showMessageBox(parentWindow, dialogOptions);
    } else {
      await dialog.showMessageBox(dialogOptions);
    }
  }

  const { choice, rememberChoice } = await promptForExternalBrowser(url);
  if (!choice) {
    return false;
  }

  const launched = await launchExternalUrl(url, choice);
  if (!launched) {
    const dialogOptions: Electron.MessageBoxOptions = {
      type: 'warning',
      title: '找不到瀏覽器',
      message: `目前無法使用 ${choice === 'chrome' ? 'Chrome' : 'Edge'} 開啟連結。`,
      detail: '請確認瀏覽器已安裝，或改用預設瀏覽器。',
      buttons: ['確定'],
      defaultId: 0,
      noLink: true,
    };
    const parentWindow = mainWindow ?? BrowserWindow.getFocusedWindow();
    if (parentWindow) {
      await dialog.showMessageBox(parentWindow, dialogOptions);
    } else {
      await dialog.showMessageBox(dialogOptions);
    }
    return false;
  }

  saveExternalLinkPreferences({ preferredBrowser: rememberChoice ? choice : null });
  return true;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function frontendPath(fileName: string): string {
  if (app.isPackaged) {
    // frontend/ is inside app.asar (listed in "files"), not extraResources
    return path.join(app.getAppPath(), 'frontend', fileName);
  }
  return path.join(__dirname, '..', '..', 'frontend', fileName);
}

function backendRoot(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend');
  }
  return path.join(__dirname, '..', '..', 'backend');
}

function clampZoomFactor(zoomFactor: number): number {
  return Math.min(MAX_ZOOM_FACTOR, Math.max(MIN_ZOOM_FACTOR, Number(zoomFactor.toFixed(2))));
}

function setWindowZoom(window: BrowserWindow, zoomFactor: number): void {
  window.webContents.setZoomFactor(clampZoomFactor(zoomFactor));
}

function changeWindowZoom(window: BrowserWindow, direction: 'in' | 'out'): void {
  const delta = direction === 'in' ? ZOOM_STEP : -ZOOM_STEP;
  setWindowZoom(window, window.webContents.getZoomFactor() + delta);
}

function getZoomAction(input: Electron.Input): 'in' | 'out' | 'reset' | null {
  if (input.type !== 'keyDown' || (!input.control && !input.meta)) {
    return null;
  }

  const key = input.key.toLowerCase();

  if (key === '0' || input.code === 'Digit0' || input.code === 'Numpad0') {
    return 'reset';
  }

  if (key === '+' || key === '=' || input.code === 'Equal' || input.code === 'NumpadAdd') {
    return 'in';
  }

  if (key === '-' || key === '_' || input.code === 'Minus' || input.code === 'NumpadSubtract') {
    return 'out';
  }

  return null;
}

function createWindow(): void {
  Menu.setApplicationMenu(null);

  const iconPath = app.isPackaged
    ? path.join(app.getAppPath(), 'frontend', 'icon.png')
    : path.join(__dirname, '..', '..', 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1460,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#0b1020',
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const htmlPath = frontendPath('index.html');
  console.log('[frontend] htmlPath =', htmlPath);

  mainWindow.loadFile(htmlPath);
  setWindowZoom(mainWindow, DEFAULT_ZOOM_FACTOR);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) {
      void openExternalUrlWithConfirmation(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event: Electron.Event, url: string) => {
    if (!mainWindow || url === mainWindow.webContents.getURL()) {
      return;
    }

    if (isHttpUrl(url)) {
      event.preventDefault();
      void openExternalUrlWithConfirmation(url);
    }
  });

  mainWindow.webContents.on(
    'did-fail-load',
    (_event: Electron.Event, code: number, desc: string, validatedURL: string) => {
      console.error('[frontend] did-fail-load', { code, desc, validatedURL });
    },
  );

  mainWindow.webContents.on(
    'zoom-changed',
    (event: Electron.Event, zoomDirection: 'in' | 'out') => {
      event.preventDefault();
      changeWindowZoom(mainWindow!, zoomDirection);
    },
  );

  mainWindow.webContents.on(
    'before-input-event',
    (event: Electron.Event, input: Electron.Input) => {
      const zoomAction = getZoomAction(input);
      if (!zoomAction) {
        return;
      }

      event.preventDefault();

      if (zoomAction === 'reset') {
        setWindowZoom(mainWindow!, DEFAULT_ZOOM_FACTOR);
        return;
      }

      changeWindowZoom(mainWindow!, zoomAction);
    },
  );

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

function waitForBackendReady(timeoutMs = 15000): Promise<void> {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const probe = () => {
      const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve();
        } else if (Date.now() - started > timeoutMs) {
          reject(new Error('Backend did not become healthy in time.'));
        } else {
          setTimeout(probe, 400);
        }
      });

      req.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error('Unable to connect to backend.'));
        } else {
          setTimeout(probe, 400);
        }
      });
    };

    probe();
  });
}

function startBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    const root = backendRoot();
    const devEntrypoint = path.join(root, 'app.py');
    const packagedExe = path.join(
      root,
      'dist',
      'repo-radar-backend',
      process.platform === 'win32' ? 'repo-radar-backend.exe' : 'repo-radar-backend',
    );

    let command = 'python';
    let args = [devEntrypoint, '--port', String(BACKEND_PORT)];

    if (app.isPackaged && fs.existsSync(packagedExe)) {
      command = packagedExe;
      args = ['--port', String(BACKEND_PORT)];
    } else {
      if (process.platform === 'win32') {
        const venvPython = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
        if (fs.existsSync(venvPython)) {
          command = venvPython;
        } else {
          command = 'py';
          args = ['-3', devEntrypoint, '--port', String(BACKEND_PORT)];
        }
      } else {
        command = 'python3';
      }
    }

    console.log('[backend] root =', root);
    console.log('[backend] entry =', devEntrypoint);
    console.log('[backend] command =', command);
    console.log('[backend] args =', args);

    // For packaged app, use a writable user data dir; for dev, use backend/data
    const dataDir = app.isPackaged
      ? path.join(app.getPath('userData'), 'repo-radar-data')
      : path.join(root, 'data');

    // Ensure data dir exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    // Create blank default config if none exists
    const cfgPath = path.join(dataDir, 'config.json');
    if (!fs.existsSync(cfgPath)) {
      fs.writeFileSync(
        cfgPath,
        JSON.stringify(
          {
            gitlab_url: '',
            token: '',
            project_ref: '',
            project_ref_history: [],
            import_file: '',
            enable_daily_sync: true,
            daily_sync_time: '09:00',
            enable_weekly_report: true,
            weekly_report_time: '17:30',
          },
          null,
          2,
        ),
      );
    }

    backendProcess = spawn(command, args, {
      cwd: root,
      stdio: 'pipe',
      env: {
        ...process.env,
        REPO_RADAR_DATA_DIR: dataDir,
      },
    });

    backendProcess.stdout?.on('data', (data: any) => {
      console.log(`[backend] ${data.toString().trim()}`);
    });

    backendProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[backend] ${data.toString().trim()}`);
    });

    backendProcess.on('error', (error: Error) => reject(error));
    backendProcess.on('exit', (code: number | null) => {
      if (code !== 0) {
        console.error(`Backend exited with code ${code}`);
      }
    });

    waitForBackendReady().then(resolve).catch(reject);
  });
}

async function bootstrap(): Promise<void> {
  await app.whenReady();
  await startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
});

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
  if (!filePath) return false;
  if (isHttpUrl(filePath)) {
    return openExternalUrlWithConfirmation(filePath);
  }
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(backendRoot(), filePath);
  await shell.openPath(absolute);
  return true;
});

ipcMain.handle('report:exportPdf', async (_event, htmlContent: string) => {
  const result = await dialog.showSaveDialog({
    title: '匯出週報 PDF',
    defaultPath: `Gitlab_Tracker_週報_${new Date().toISOString().slice(0, 10)}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (result.canceled || !result.filePath) return null;

  const win = new BrowserWindow({ show: false, width: 900, height: 1200 });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
  // Wait for content to render
  await new Promise((resolve) => setTimeout(resolve, 800));
  const pdfData = await win.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  win.close();
  fs.writeFileSync(result.filePath, pdfData);
  shell.openPath(result.filePath);
  return result.filePath;
});

ipcMain.handle('app:getVersion', async () => app.getVersion());

bootstrap().catch((error) => {
  console.error(error);
  dialog.showErrorBox('Repo Radar 啟動失敗', String(error));
  app.quit();
});
