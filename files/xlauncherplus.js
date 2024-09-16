// test update
// Electron app dependencies
const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');

// Node.js core modules
const path = require('path');
const util = require('util');
const { exec } = require('child_process');

// Node.js core module methods
const execPromise = util.promisify(exec);

// Third-party modules
const windowStateKeeper = require('electron-window-state');
const windowsShortcuts = require('windows-shortcuts');
const sudo = require('sudo-prompt');

// Custom modules
const { compileSassThemes } = require('./utils/themebuilder');
const FileSystemOperations = require('./xlauncherplusfs');
const TriggerCmdGenerator = require('./utils/xltc.js');

// Define directories
// Set paths for pages and utilities
const pagesDir = path.join(__dirname, 'pages');
const utilsDir = path.join(__dirname, 'utils');
const fsOps = new FileSystemOperations(__dirname);

// Safe IPC handler
// Ensures only one handler exists for each channel
function safeIpc(channel, handler) {
    if (ipcMain.listenerCount(channel) > 0) {
        ipcMain.removeHandler(channel);
    }
    ipcMain.handle(channel, handler);
}

// File system related IPC handlers
// Set up handlers for various file system operations
safeIpc('get-app-dir', () => __dirname);
safeIpc('get-file', (event, filePath) => fsOps.getFile(filePath));
safeIpc('get-file-path', (event, directory, fileName) => fsOps.getFilePath(directory, fileName));
safeIpc('write-file', (event, filePath, content) => fsOps.writeFile(filePath, content));
safeIpc('write-csv-file', (event, filePath, content) => fsOps.writeFile(filePath, content));
safeIpc('remove-file', (event, filePath) => fsOps.removeFile(filePath));
safeIpc('get-variables', () => fsOps.getVariables(utilsDir));
safeIpc('rename-file', (event, oldFilePath, newFilePath) => fsOps.renameFile(oldFilePath, newFilePath));
safeIpc('update-favs', (event, xldbfPath, favourites) => fsOps.updateFavs(xldbfPath, favourites));
safeIpc('update-vars', (event, xldbvPath, variables) => fsOps.updateVars(xldbvPath, variables));
safeIpc('read-directory', (event, dirPath) => fsOps.readDirectory(dirPath));
safeIpc('read-themes-directory', (event, themesDir) => fsOps.readThemesDirectory(themesDir));
safeIpc('get-scss-file-count', () => fsOps.countScssFiles());
safeIpc('copy-file', (event, sourcePath, destPath) => fsOps.copyFile(sourcePath, destPath));
safeIpc('check-triggercmd-file', () => fsOps.checkTriggerCmdFile());
safeIpc('update-xlaunch-config', (event, config) => fsOps.updateXlaunchConfig(config));

// Non-file system related IPC handlers
// Set up handlers for various non-file system operations
safeIpc('get-window-size', (event) => BrowserWindow.fromWebContents(event.sender).getContentBounds());
safeIpc('run-xlstitch', async (event) => {
    const xlstitchPath = path.join(utilsDir, 'xlstitch.exe');
    return new Promise((resolve, reject) => {
        exec(xlstitchPath, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
});

safeIpc('open-file-dialog', (event, options) => {
    return dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), options);
});

safeIpc('import-theme', async (event, sourcePath, themesDir) => {
    try {
        const fileName = path.basename(sourcePath);
        const destPath = path.join(__dirname, 'pages', themesDir, fileName);
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

safeIpc('launch-app', (event, appName) => {
    const xlaunchPath = path.join(utilsDir, 'xlaunch.exe');
    exec(`${xlaunchPath} ${appName}`);
});

safeIpc('parse-shortcut', (event, filePath) => {
    return new Promise((resolve, reject) => {
        if (typeof filePath !== 'string') {
            const error = new TypeError('The "path" argument must be of type string. Received ' + typeof filePath);
            console.error('Error in parse-shortcut handler:', error);
            return reject(error);
        }

        const fileName = path.basename(filePath, path.extname(filePath));
        if (filePath.toLowerCase().endsWith('.lnk')) {
            windowsShortcuts.query(filePath, (error, shortcut) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({
                        name: fileName,
                        target: shortcut.target
                    });
                }
            });
        } else if (filePath.toLowerCase().endsWith('.url')) {
            fsOps.getFile(filePath).then(({ data, error }) => {
                if (error) {
                    reject(error);
                } else {
                    const urlMatch = data.match(/URL=(.+)/);
                    if (urlMatch && urlMatch[1]) {
                        resolve({
                            name: fileName,
                            target: urlMatch[1]
                        });
                    } else {
                        reject(new Error('Invalid URL shortcut file'));
                    }
                }
            });
        } else {
            reject(new Error('Unsupported file type'));
        }
    });
});

// Compile theme
// Handles theme compilation and progress reporting
safeIpc('compile-theme', async (event, themeName, delay) => {
    try {
        const success = await compileSassThemes(themeName, (processedFiles, totalFiles) => {
            const progress = Math.round((processedFiles / totalFiles) * 100);
            event.sender.send('theme-compile-progress', { processedFiles, totalFiles, progress });
        }, __dirname, delay);
        return success;
    } catch (error) {
        return false;
    }
});

safeIpc('generate-triggercmd', async (event, configOpts) => {
    console.log('generate-triggercmd called with configOpts:', configOpts);
    const generator = new TriggerCmdGenerator(__dirname, configOpts);
    try {
        const result = await generator.generateCommands();
        console.log('Result from generateCommands:', result);
        return result;
    } catch (error) {
        console.error('Error generating TriggerCMD commands:', error);
        return false;
    }
});

// Add these new IPC handlers
function runXltcp(action) {
    return new Promise((resolve, reject) => {
        const xltcpPath = path.join(__dirname, 'utils', 'xltcp.exe');
        const utilsPath = path.join(__dirname, 'utils');
        const options = {
            name: 'xLauncherPlus'
        };
        const command = `"${xltcpPath}" ${action} "${utilsPath}"`;
        
        sudo.exec(command, options, (error, stdout, stderr) => {
            if (error) {
                if (error.toString().includes('User did not grant permission.')) {
                    reject(new Error('elevation_canceled'));
                } else {
                    reject(error);
                }
            } else {
                resolve(stdout.trim() === 'true');
            }
        });
    });
}

safeIpc('add-to-path', async () => {
    try {
        const result = await runXltcp('add');
        console.log('Path added:', result);
        return result;
    } catch (error) {
        console.error('Failed to add to PATH:', error.message);
        if (error.message === 'elevation_canceled') {
            console.log('User canceled the elevation request');
            // Handle this case appropriately in your UI
        }
        return false;
    }
});

safeIpc('remove-from-path', async () => {
    try {
        const result = await runXltcp('remove');
        console.log('Path removed:', result);
        return result;
    } catch (error) {
        console.error('Failed to remove from PATH:', error.message);
        if (error.message === 'elevation_canceled') {
            console.log('User canceled the elevation request');
            // Handle this case appropriately in your UI
        }
        return false;
    }
});

// Add the new IPC handler for fetching version info
safeIpc('fetch-url', async (event, url, responseType = 'json') => {
    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(url);
        let data;
        if (responseType === 'text') {
            data = await response.text();
        } else {
            data = await response.json();
        }
        return { ok: response.ok, statusText: response.statusText, data };
    } catch (error) {
        console.error('Error fetching URL:', error);
        return { ok: false, statusText: error.message };
    }
});

// Window control handlers
// Set up handlers for window control operations
safeIpc('minimize-window', (event) => {
    BrowserWindow.fromWebContents(event.sender).minimize();
});

safeIpc('maximize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win.isMaximized() ? win.unmaximize() : win.maximize();
});

safeIpc('close-window', (event) => {
    BrowserWindow.fromWebContents(event.sender).close();
});

// Setup logging
// Configures console logging with prefixes based on message level
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

// Create window
// Sets up and creates the main application window
function createWindow() {
    const mainWindowState = windowStateKeeper({
        defaultWidth: 800,
        defaultHeight: 600,
    });

    const mainWindow = new BrowserWindow({
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'xlauncherpluseapi.js')
        },
        resizable: true,
        title: "xLauncher Plus",
        frame: false
    });

    mainWindowState.manage(mainWindow);

    mainWindow.loadFile(path.join(pagesDir, 'initialize.html'));

    setupLogging(mainWindow.webContents);

    mainWindow.setMenu(null);

    let isExiting = false;
    ipcMain.on('toMain', (event, arg) => {
        if (arg === 'exit') {
            isExiting = true;
            app.quit();
        }
    });

    // Handle window close event
    mainWindow.on('close', (event) => {
        if (!isExiting) {
            event.preventDefault();
            mainWindow.webContents.send('app-closing');
        }
    });
}

// App ready
// Initializes the application when it's ready
app.whenReady().then(async () => {
    await fsOps.ensureFavouritesFileExists(utilsDir);
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Window closed
// Quits the app when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
    app.quit();
});

app.on('before-quit', () => {
    isExiting = true;
});
