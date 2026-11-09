
const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

let mainWindow;
let backendProcess;
let quitting = false;

const isDev = !app.isPackaged;
const BACKEND_URL = "http://127.0.0.1:8001/openapi.json";

function isBackendReady() {
  return new Promise((resolve) => {
    const req = http.get(BACKEND_URL, (res) => {
      res.resume();
      resolve(Boolean(res.statusCode && res.statusCode < 500));
    });

    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });

    req.on("error", () => resolve(false));
  });
}

async function waitForBackend(timeout = 60000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    if (await isBackendReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("FastAPI did not become ready within 60 seconds.");
}

function startBackend() {
  const projectRoot = path.resolve(__dirname, "../..");

  if (isDev) {
    const pythonExe = path.join(
      projectRoot,
      "venv_build",
      "Scripts",
      "python.exe"
    );

    backendProcess = spawn(
      pythonExe,
      ["run_server.py"],
      {
        cwd: path.join(projectRoot, "backend"),
        stdio: "inherit",
        windowsHide: true,
      }
    );
  } else {
    const backendExe = path.join(
      process.resourcesPath,
      "backend",
      "GSTClientApp.exe"
    );

    backendProcess = spawn(backendExe, [], {
      cwd: path.dirname(backendExe),
      stdio: "ignore",
      windowsHide: true,
    });
  }

  backendProcess.on("error", (error) => {
    console.error("Backend startup failed:", error);
  });

  backendProcess.on("exit", (code) => {
    if (!quitting) {
      console.error(`Backend exited unexpectedly with code ${code}`);
    }
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    title: "GST Client Management System",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    await waitForBackend();

    if (isDev) {
      await mainWindow.loadURL("http://127.0.0.1:5173/");
    } else {
      await mainWindow.loadFile(
        path.join(app.getAppPath(), "dist", "index.html")
      );
    }
  } catch (error) {
    console.error(error);

    await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Backend startup failed",
      message: "GST Client Management System could not start.",
      detail:
        "The backend did not respond. Check the database configuration and try again.",
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  }
}

app.whenReady().then(async () => {
  startBackend();
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0 && !quitting) {
      if (!backendProcess || backendProcess.exitCode !== null) {
        startBackend();
      }
      await createWindow();
    }
  });
});

app.on("before-quit", () => {
  quitting = true;

  if (backendProcess && backendProcess.exitCode === null) {
    backendProcess.kill();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
