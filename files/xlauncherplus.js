// Main Application Module
// Manages core functionality and lifecycle of Electron application

// Electron app dependencies
const { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, screen, Tray } = require('electron');

// Node.js core modules
const path = require('path');
const util = require('util');
const fs = require('fs').promises;
const { exec } = require('child_process');

// Third-party modules
const sudo = require('@vscode/sudo-prompt');
const windowsShortcuts = require('windows-shortcuts');
const windowStateKeeper = require('electron-window-state');

// Custom modules
const xlstitch = require('./utils/xlstitch');
const TriggerCmdGenerator = require('./utils/xltc');
const { compileSassThemes } = require('./utils/xltb');
const FileSystemOperations = require('./xlauncherplusfs');

// Define directories and paths
const getAppPath = () => {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'app');
    }
    return __dirname;
};

const appDirs = {
    pagesDir: path.join(getAppPath(), 'files'),
    utilsDir: path.join(getAppPath(), 'utils')
};

const fsOps = new FileSystemOperations(getAppPath(), appDirs);

// Define icon paths
const iconPath = path.join(appDirs.pagesDir, 'ico', process.platform === 'win32' ? 'xlauncherplus.ico' : 'xlauncherplus.png');
const trayIconPath = path.join(appDirs.pagesDir, 'ico', 'xlauncherplus.png');

// Global variables
let tray = null;

// Set development user data path
const isDev = !app.isPackaged;
if (isDev) {
    const userDataPath = path.join(app.getPath('userData'), 'dev');
    app.setPath('userData', userDataPath);
}

// Safe IPC handler
// Ensures single handler instance exists for each IPC channel
function safeIpc(channel, handler) {
    if (ipcMain.listenerCount(channel) > 0) {
        ipcMain.removeHandler(channel);
    }
    ipcMain.handle(channel, handler);
}

// File system related IPC handlers
// Set up handlers for various file system operations
safeIpc('check-triggercmd-file', () => fsOps.checkTriggerCmdFile());
safeIpc('copy-file', (event, sourcePath, destPath) => fsOps.copyFile(sourcePath, destPath));
safeIpc('ensure-directory', (event, dirPath) => fsOps.ensureDirectoryExists(dirPath));
safeIpc('extract-zip', (event, zipPath, targetPath) => fsOps.extractZip(zipPath, targetPath));
safeIpc('file-exists', (event, filePath) => fsOps.fileExists(filePath));
safeIpc('get-app-dir', () => __dirname);
safeIpc('get-file', (event, filePath) => fsOps.getFile(filePath));
safeIpc('get-file-path', (event, directory, fileName) => fsOps.getFilePath(directory, fileName));
safeIpc('get-variables', () => fsOps.getVariables(appDirs.utilsDir));
safeIpc('read-directory', (event, dirPath) => fsOps.readDirectory(dirPath));
safeIpc('read-themes-directory', (event, themesDir) => fsOps.readThemesDirectory(themesDir));
safeIpc('remove-directory', (event, dirPath) => fsOps.removeDirectory(dirPath));
safeIpc('remove-file', (event, filePath) => fsOps.removeFile(filePath));
safeIpc('rename-file', (event, oldFilePath, newFilePath) => fsOps.renameFile(oldFilePath, newFilePath));
safeIpc('update-favs', (event, xldbfPath, favourites) => fsOps.updateFavs(xldbfPath, favourites));
safeIpc('update-vars', (event, xldbvPath, variables) => fsOps.updateVars(xldbvPath, variables));
safeIpc('update-xlaunch-config', (event, config) => fsOps.updateXlaunchConfig(config));
safeIpc('write-file', (event, filePath, content, isBinary = false) => fsOps.writeFile(filePath, content, isBinary));


// Download and update handlers
// Functions for handling file downloads and application updates

// Download file
// Downloads and saves remote files to local disk storage
safeIpc('download-file', async (event, url, filePath, isBinary = false) => {
    try {
        return await fsOps.downloadFile(url, filePath, isBinary);
    } catch (error) {
        console.error('Error in download-file:', error);
        return false;
    }
});

// Fetch URL
// Retrieves and processes data from specified remote URL endpoint
safeIpc('fetch-url', async (event, url, responseType = 'json') => {
    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(url);
        let data;
        if (responseType === 'text') {
            data = await response.text();
        } else if (responseType === 'arraybuffer') {
            data = await response.arrayBuffer();
        } else {
            data = await response.json();
        }
        return { ok: response.ok, statusText: response.statusText, data };
    } catch (error) {
        return { ok: false, statusText: error.message };
    }
});


// Application-specific IPC handlers
// These functions handle various operations specific to xLauncher Plus

// Compile theme
// Processes theme files and reports compilation status updates
safeIpc('compile-theme', async (event, themeName, delay) => {
    try {
        const success = await compileSassThemes(themeName, (processedFiles, totalFiles) => {
            const progress = Math.round((processedFiles / totalFiles) * 100);
            event.sender.send('theme-compile-progress', { processedFiles, totalFiles, progress });
        }, appDirs, delay);
        return success;
    } catch (error) {
        return false;
    }
});

// Create tray
// Creates the system tray icon if it doesn't exist
safeIpc('create-tray', () => {
    if (!tray) {
        createTray();
    }
});

// Generate TriggerCMD
// Creates command triggers for voice assistant integration system
safeIpc('generate-triggercmd', async (event, configOpts) => {
    const generator = new TriggerCmdGenerator(__dirname, configOpts, appDirs);
    try {
        const result = await generator.generateCommands();
        return result;
    } catch (error) {
        return false;
    }
});

// Get desktop directory
// Retrieves system desktop path for file operations and shortcuts
safeIpc('get-desktop-dir', () => {
    return path.join(app.getPath('home'), 'Desktop');  // Default to the Desktop
});

// Import theme
// Copies and processes theme files into application directory
safeIpc('import-theme', async (event, sourcePath, themesDir) => {
    try {
        const fileName = path.basename(sourcePath);
        const destPath = path.join(appDirs.pagesDir, themesDir, fileName);
        const success = await fsOps.copyFile(sourcePath, destPath);
        if (success) {
            const themeName = path.basename(fileName, '.thm');
            return { success: true, themeName: themeName };
        } else {
            return { success: false, error: 'Copy operation failed' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Toggle theme read-only state
// Sets or removes read-only attribute on theme file
safeIpc('toggle-theme-readonly', async (event, themePath, readonly) => {
    try {
        const mode = readonly ? 0o444 : 0o644; // read-only vs read-write
        await fs.chmod(themePath, mode);
        return true;
    } catch (error) {
        return false;
    }
});

// Launch app
// Executes specified application with elevated system privileges safely
safeIpc('launch-app', async (event, appName) => {
    const xlaunchPath = path.join(appDirs.utilsDir, 'xlaunch.exe');
    const command = `"${xlaunchPath}" "${appName}"`;
    const options = {
        name: 'xLauncherPlus'
    };

    return new Promise((resolve, reject) => {
        sudo.exec(command, options, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
});

// Open help file
// Opens the xlauncher_plus_help.html file in the default browser
safeIpc('open-external', (event, helpFilePath) => {
    const fullPath = path.join(__dirname, helpFilePath);
    require('electron').shell.openExternal(`file://${fullPath}`);
});

// Open file dialog
// Displays system dialog for selecting files and directories
safeIpc('open-file-dialog', (event, options) => {
    return dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), options);
});

// Parse shortcut
// Processes and extracts information from system shortcut files
safeIpc('parse-shortcut', async (event, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath, ext);

    const convertToForwardSlash = (str) => str.replace(/\\/g, '/');

    switch (ext) {
        case '.lnk':
            return new Promise((resolve, reject) => {
                windowsShortcuts.query(filePath, (error, shortcut) => {
                    if (error) reject(error);
                    else resolve({ 
                        name: fileName, 
                        target: convertToForwardSlash(shortcut.target) 
                    });
                });
            });
        case '.url':
            try {
                const content = await fsOps.getFile(filePath);
                if (content.error) {
                    throw new Error(content.error);
                }
                const urlMatch = content.data.match(/URL=(.+)/);
                if (urlMatch && urlMatch[1]) {
                    return { name: fileName, target: urlMatch[1] };
                }
                return { name: fileName, target: "Invalid URL shortcut" };
            } catch (error) {
                throw new Error(`Error reading .url file: ${error.message}`);
            }
        case '.exe':
        case '.bat':
        case '.vbs':
            return { name: fileName, target: convertToForwardSlash(filePath) };
        default:
            throw new Error('Unsupported file type');
    }
});

// Run xlu
// Executes xlu.exe with optional action parameter
safeIpc('run-xlu', async (event, action = null) => {
    try {
        const xluPath = path.join(appDirs.utilsDir, 'xlu.exe');
        const command = action ? `"${xluPath}" ${action}` : `"${xluPath}"`;
        const options = {
            name: 'xLauncherPlus'
        };
        
        return new Promise((resolve, reject) => {
            sudo.exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(true);
                }
            });
        });
    } catch (error) {
        return false;
    }
});

// Run xlstitch
// Executes xlstitch function to process and update configurations
safeIpc('run-xlstitch', async (event) => {
    try {
        const result = await xlstitch(__dirname, appDirs);
        return result;
    } catch (error) {
        return false;
    }
});


// Show notification
// Displays desktop notification with specified title and content
safeIpc('show-notification', (event, title, body) => {
    if (Notification.isSupported()) {
        new Notification({ title, body }).show();
    }
});

// Show tray balloon
// Displays a balloon notification from the tray icon
safeIpc('show-tray-balloon', (event, title, content) => {
    showTrayBalloon(title, content);
});

// Update tray menu
// Updates the system tray context menu with recent apps
safeIpc('update-tray-menu', (event, recentApps) => {
    updateTrayMenu(recentApps);
});

// Update tray visibility
// Manages system tray icon visibility based on configuration
safeIpc('update-tray-visibility', async (event, show) => {
    try {
        const xldbv = fsOps.getVariables(appDirs.utilsDir);
        xldbv.configOpts.system.show = show;
        await fsOps.updateVars(path.join(appDirs.utilsDir, 'xldbv.json'), xldbv);
        
        if (show) {
            if (!tray) {
                const trayIcon = nativeImage.createFromPath(trayIconPath);
                tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
                tray.setToolTip('xLauncher Plus');
                updateTrayMenu([]);

                tray.on('double-click', () => {
                    const mainWindow = BrowserWindow.getAllWindows()[0];
                    if (mainWindow) {
                        if (mainWindow.isMinimized()) mainWindow.restore();
                        mainWindow.show();
                        mainWindow.focus();
                    }
                });
            }
        } else {
            if (tray) {
                tray.destroy();
                tray = null;
            }
        }
        return true;
    } catch (error) {
        console.error('Error updating tray visibility:', error);
        return false;
    }
});

// Create startup shortcut
// Creates Windows startup entry for automatic application launch
safeIpc('create-startup-shortcut', async () => {
    try {
        const startupPath = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
        const shortcutPath = path.join(startupPath, 'xLauncher Plus.lnk');
        const targetPath = app.getPath('exe');
        const workingDir = path.dirname(targetPath);
        
        try {
            await new Promise((resolve, reject) => {
                windowsShortcuts.create(shortcutPath, {
                    target: targetPath,
                    workingDir: workingDir,
                    desc: 'xLauncher Plus',
                    icon: iconPath
                }, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
            return true;
        } catch (error) {
            return false;
        }
    } catch (error) {
        return false;
    }
});

// Remove startup shortcut
// Removes application from Windows startup and updates configuration
safeIpc('remove-startup-shortcut', async () => {
    try {
        const startupPath = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
        const shortcutPath = path.join(startupPath, 'xLauncher Plus.lnk');
        
        if (await fs.access(shortcutPath).then(() => true).catch(() => false)) {
            await fs.unlink(shortcutPath);
        }

        // Update the configuration
        const xldbv = fsOps.getVariables(appDirs.utilsDir);
        if (xldbv && xldbv.configOpts && xldbv.configOpts.system) {
            xldbv.configOpts.system.startWithWindows = false;
            await fsOps.updateVars(path.join(appDirs.utilsDir, 'xldbv.json'), xldbv);
        }

        return true;
    } catch (error) {
        return false;
    }
});


// Functions
// Core utility functions that support main application features

// Create tray
// Creates and configures system tray with menu options
function createTray() {
    const xldbv = fsOps.getVariables(appDirs.utilsDir);
    const showTray = xldbv && xldbv.configOpts && xldbv.configOpts.system && xldbv.configOpts.system.show === true;

    if (showTray && !tray) {
        const trayIcon = nativeImage.createFromPath(trayIconPath);
        tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
        tray.setToolTip('xLauncher Plus');
        updateTrayMenu([]);

        tray.on('double-click', () => {
            const mainWindow = BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.show();
                mainWindow.focus();
            }
        });
    } else if (!showTray && tray) {
        tray.destroy();
        tray = null;
    }
}

// Show tray balloon
// Displays a balloon notification from the system tray icon
function showTrayBalloon(title, content) {
    if (process.platform === 'win32' && tray) {
        tray.displayBalloon({
            icon: iconPath,
            title: title,
            content: content
        });
    }
}

// Update tray menu
// Updates the system tray context menu with recent applications
function updateTrayMenu(recentApps) {
    if (!tray) return;

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Open xLauncher Plus', click: () => {
            const mainWindow = BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
                mainWindow.show();
                mainWindow.focus();
            }
        }},
        { type: 'separator' },
        {
            label: 'Recent',
            submenu: recentApps.length > 0 ? recentApps.map(app => ({
                label: app.name,
                click: () => {
                    safeIpc('launch-app', app.name);
                }
            })) : [{ label: 'No recent apps', enabled: false }]
        },
        { type: 'separator' },
        { label: 'Exit', click: () => {
            const mainWindow = BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
                mainWindow.webContents.send('app-closing');
                isExiting = true;
                app.quit();
            }
        }}
    ]);

    tray.setContextMenu(contextMenu);
}

// Setup logging
// Configures application logging with different message level indicators
function setupLogging(webContents) {
    webContents.on('console-message', (event, level, message, line, sourceId) => {
        let prefix = '';
        switch (level) {
            case 0:
                prefix = '[INFO]';
                break;
            case 1:
                prefix = '[WARNING]';
                break;
            case 2:
                prefix = '[ERROR]';
                break;
            default:
                prefix = '[LOG]';
        }
        console.log(`${prefix} ${message}`);
    });
}

// Window Management Functions
// Manages window operations and states across the application

// Close window
// Handles closing of main application window and cleanup
safeIpc('close-window', (event) => {
    BrowserWindow.fromWebContents(event.sender).close();
});

// Get window size
// Retrieves and returns dimensions of the application window
safeIpc('get-window-size', (event) => BrowserWindow.fromWebContents(event.sender).getContentBounds());

// Maximize window
// Controls window state between maximized and normal sizes
safeIpc('maximize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win.isMaximized() ? win.unmaximize() : win.maximize();
});

// Minimize window
// Reduces window to taskbar based on application settings
safeIpc('minimize-window', (event) => {
    BrowserWindow.fromWebContents(event.sender).minimize();
});

// Minimize to tray
// Hides the window to system tray
safeIpc('minimize-to-tray', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.hide();
    }
});

// Get window DPI
// Retrieves the DPI scale factor for the specified window
safeIpc('get-window-dpi', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return 1;
    return window.webContents.getZoomFactor();
});

// Create window
// Initializes main application window with configured state settings
function createWindow() {
    const mainWindowState = windowStateKeeper({
        defaultWidth: 800,
        defaultHeight: 600,
    });

    const xldbv = fsOps.getVariables(appDirs.utilsDir);
    const systemConfig = xldbv?.configOpts?.system || {};
    const shouldStartMinimized = systemConfig.startMinimized && systemConfig.show && systemConfig.startWithWindows;

    createTray();

    const mainWindow = new BrowserWindow({
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(getAppPath(), 'xlauncherpluseapi.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        resizable: true,
        title: "xLauncher Plus",
        frame: false,
        show: !shouldStartMinimized
    });

    mainWindowState.manage(mainWindow);

    const htmlPath = path.join(appDirs.pagesDir, 'xlp.app.html');
    mainWindow.loadFile(htmlPath).catch(err => {
        console.error('Failed to load HTML:', err);
        console.error('Attempted path:', htmlPath);
    });

    setupLogging(mainWindow.webContents);

    mainWindow.setMenu(null);

    let isExiting = false;
    ipcMain.on('toMain', (event, arg) => {
        if (arg === 'exit') {
            isExiting = true;
            app.quit();
        }
    });

    mainWindow.on('close', (event) => {
        if (!isExiting) {
            const xldbv = fsOps.getVariables(appDirs.utilsDir);
            if (xldbv && xldbv.configOpts && xldbv.configOpts.system && xldbv.configOpts.system.closeTo) {
                event.preventDefault();
                mainWindow.hide();
            } else {
                event.preventDefault();
                mainWindow.webContents.send('app-closing');
            }
        }
    });

    mainWindow.on('minimize', (event) => {
        const xldbv = fsOps.getVariables(appDirs.utilsDir);
        if (xldbv && xldbv.configOpts && xldbv.configOpts.system && xldbv.configOpts.system.minimizeTo) {
            event.preventDefault();
            mainWindow.hide();
        }
    });
}

// Instance lock management
// Ensures only one application instance runs at a time
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length) {
            const mainWindow = windows[0];
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });

    app.whenReady().then(async () => {
        await fsOps.ensureFavouritesFileExists(appDirs.utilsDir);
        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });
}

// Window closed
// Manages application shutdown when main window closes completely
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (tray) {
            tray.destroy();
        }
        app.quit();
    }
});

app.on('before-quit', () => {
    isExiting = true;
});
