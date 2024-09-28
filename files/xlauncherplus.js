// Electron app dependencies
const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');

// Node.js core modules
const path = require('path');
const util = require('util');
const { exec } = require('child_process');
const fs = require('fs').promises; // Add this line at the top of the file

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
const xlstitch = require('./utils/xlstitch');

// Define directories
const pagesDir = app.isPackaged 
    ? path.join(process.resourcesPath, 'app', 'pages')
    : path.join(__dirname, 'pages');
const utilsDir = app.isPackaged 
    ? path.join(process.resourcesPath, 'app', 'utils')
    : path.join(__dirname, 'utils');
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
safeIpc('write-file', (event, filePath, content, isBinary = false) => fsOps.writeFile(filePath, content, isBinary));
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

// Run xlstitch
// Execute the xlstitch function
safeIpc('run-xlstitch', async (event) => {
    try {
        const result = await xlstitch(__dirname);
        return result;
    } catch (error) {
        return false;
    }
});

// Open file dialog
// Show a file open dialog
safeIpc('open-file-dialog', (event, options) => {
    return dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), options);
});

// Get desktop directory
// Get the desktop directory
ipcMain.handle('get-desktop-dir', () => {
    return path.join(app.getPath('home'), 'Desktop');  // Default to the Desktop
});

// Open help file
// Opens the xlauncher_plus_help.html file in the default browser
safeIpc('open-external', (event, helpFilePath) => {
    const fullPath = path.join(__dirname, helpFilePath);
    require('electron').shell.openExternal(`file://${fullPath}`);
});

// Import theme
// Import a theme file
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

// Launch app
// Launch an application
safeIpc('launch-app', async (event, appName) => {
    const xlaunchPath = path.join(utilsDir, 'xlaunch.exe');
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

// Parse shortcut
// Parse a shortcut file
safeIpc('parse-shortcut', async (event, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath, ext);

    // Helper function to convert backslashes to forward slashes
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

// Generate triggercmd
// Generate trigger commands
safeIpc('generate-triggercmd', async (event, configOpts) => {
    const generator = new TriggerCmdGenerator(__dirname, configOpts);
    try {
        const result = await generator.generateCommands();
        return result;
    } catch (error) {
        return false;
    }
});

// Run xltcp
// Execute the xltcp utility
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

// Add to PATH
// Add the application to the system PATH
safeIpc('add-to-path', async () => {
    try {
        const result = await runXltcp('add');
        return result;
    } catch (error) {
        return false;
    }
});

// Remove from PATH
// Remove the application from the system PATH
safeIpc('remove-from-path', async () => {
    try {
        const result = await runXltcp('remove');
        return result;
    } catch (error) {
        return false;
    }
});

// Fetch URL
// Fetch data from a URL
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

// Window size
// Get the size of the window
safeIpc('get-window-size', (event) => BrowserWindow.fromWebContents(event.sender).getContentBounds());

// Minimize window
// Minimize the application window
safeIpc('minimize-window', (event) => {
    BrowserWindow.fromWebContents(event.sender).minimize();
});

// Maximize window
// Maximize or unmaximize the application window
safeIpc('maximize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win.isMaximized() ? win.unmaximize() : win.maximize();
});

// Close window
// Close the application window
safeIpc('close-window', (event) => {
    BrowserWindow.fromWebContents(event.sender).close();
});

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
            preload: path.join(__dirname, 'xlauncherpluseapi.js'),
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