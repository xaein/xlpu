const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const windowStateKeeper = require('electron-window-state');

// Define directories for pages, utilities, CSV files, and scripts
const pagesDir = path.join(__dirname, 'pages');
const utilsDir = path.join(__dirname, 'utils');
const csvDir = path.join(__dirname, 'xldb');
const scriptsDir = path.join(__dirname, 'scripts');

// Ensure that a directory exists; if not, create it
function ensureDirectoryExists(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
        return false; // Directory was just created
    }
    return true; // Directory already existed
}

// Function to read all CSV files from a specified directory
function readCsvFilesFromDir(directory) {
    const csvFiles = fs.readdirSync(directory).filter(file => file.endsWith('.csv'));
    const csvData = {};

    // Read each CSV file and store its content
    csvFiles.forEach(file => {
        const filePath = path.join(directory, file);
        const data = fs.readFileSync(filePath, 'utf8');
        csvData[file] = data;
    });

    return csvData; // Return an object containing the CSV data
}

// Function to read the configuration file
function readConfigFile() {
    const configFilePath = path.join(utilsDir, 'xlaunch.cfg');
    if (fs.existsSync(configFilePath)) {
        return fs.readFileSync(configFilePath, 'utf8'); // Return config data if it exists
    }
    return null; // Return null if the config file does not exist
}

// Function to create a default configuration file with predefined settings
function createDefaultConfigFile() {
    const defaultConfig = [
        "maxlogentries=200",
        "dateformat=dd-MM-yy",
        "timeformat=HH:mm:ss",
        "dateconstruct=dateformat timeformat",
        "encapsule.l=[",
        "encapsule.r=]",
        "message.sep=>",
        "message.note=Launching:"
    ];
    fs.writeFileSync(path.join(utilsDir, 'xlaunch.cfg'), defaultConfig.join('\n')); // Write default config to file
    return defaultConfig.join('\n'); // Return the default config as a string
}

// Function to read CSV files from both the xldb and utils directories
function readCsvFiles() {
    const xldbData = readCsvFilesFromDir(csvDir); // Read CSV files from xldb directory
    const utilsData = readCsvFilesFromDir(utilsDir); // Read CSV files from utils directory
    return { ...xldbData, ...utilsData }; // Merge and return the data from both directories
}

// Handle request to get CSV files
ipcMain.handle('get-csv-files', async () => {
    // Ensure necessary directories exist
    const csvDirCreated = !ensureDirectoryExists(csvDir);
    const utilsDirCreated = !ensureDirectoryExists(utilsDir);
    const scriptsDirCreated = !ensureDirectoryExists(scriptsDir);

    // Skip loading if any directories were just created
    if (csvDirCreated || utilsDirCreated || scriptsDirCreated) {
        return { files: [], csvDirCreated, utilsDirCreated, scriptsDirCreated };
    }

    const csvData = readCsvFiles(); // Read CSV files
    return { files: Object.keys(csvData), csvDirCreated, utilsDirCreated, scriptsDirCreated }; // Return the list of CSV files
});

// Handle request to read a specific CSV file
ipcMain.handle('read-csv-file', async (event, fileName) => {
    const csvData = readCsvFiles(); // Read all CSV files
    return csvData[fileName]; // Return the requested file's data
});

// Handle request to read the configuration file
ipcMain.handle('read-cfg-file', async () => {
    if (!fs.existsSync(path.join(utilsDir, 'xlaunch.cfg'))) {
        const configData = createDefaultConfigFile(); // Create default config if it doesn't exist
        return { configData, configCreated: true }; // Return the created config data
    }
    const configData = readConfigFile(); // Read existing config file
    return { configData, configCreated: false }; // Return the config data
});

// Handle saving updated data to CSV files
ipcMain.on('save-updated-data', (event, updatedData) => {
    Object.keys(updatedData).forEach(async (fileName, index) => {
        if (!fileName) {
            return; // Skip if fileName is empty
        }
        const filePath = path.join(csvDir, fileName);
        try {
            fs.writeFileSync(filePath, updatedData[fileName], 'utf8'); // Save updated data to the file
            event.sender.send('fromMain', `${fileName} saved.`); // Send confirmation back to renderer
        } catch (error) {
            // Handle error silently
        }
        if (index < Object.keys(updatedData).length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between messages
        }
    });
});

// Handle running the xlstitch executable
ipcMain.on('run-xlstitch', (event) => {
    const xlstitchPath = path.join(utilsDir, 'xlstitch.exe');
    exec(xlstitchPath, (error) => {
        if (!error) {
            event.sender.send('xlstitch-done'); // Notify when xlstitch has finished
        }
    });
});

// Handle launching an application
ipcMain.on('launch-app', (event, appName) => {
    const xlaunchPath = path.join(utilsDir, 'xlaunch.exe');
    exec(`${xlaunchPath} ${appName}`, (error) => {
        // Handle error silently
    });
});

// Function to create the main application window
async function createWindow() {
    // Load the previous state with fallback to defaults
    let mainWindowState = windowStateKeeper({
        defaultWidth: 800,
        defaultHeight: 600
    });

    // Create the main application window with the saved or default bounds
    const mainWindow = new BrowserWindow({
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js') // Specify the preload script
        },
        resizable: true, // Allow the window to be resizable
        title: "xLauncher Plus" // Set the initial title of the window
    });

    mainWindowState.manage(mainWindow); // Manage the window state

    mainWindow.loadFile(path.join(pagesDir, 'init.html')); // Load the HTML file from the pages directory

    // Send CSV data to the renderer process once the window has finished loading
    mainWindow.webContents.on('did-finish-load', () => {
        const csvData = readCsvFiles(); // Read CSV files
        mainWindow.webContents.send('csvData', csvData); // Send CSV data to the renderer
    });

    // Create a custom menu with only a File menu and an Exit option
    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Exit',
                    click: () => {
                        app.quit(); // Quit the application
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu); // Set the custom menu as the application menu

    // Handle the exit message from the renderer process
    ipcMain.on('toMain', (event, arg) => {
        if (arg === 'exit') {
            app.quit(); // Quit the application
        }
    });
}

// Event handler for when the application is ready
app.whenReady().then(() => {
    createWindow(); // Create the main window

    // Event handler for when the application is activated (e.g., clicking the dock icon on macOS)
    app.on('activate', () => {
        // Re-create the window if all windows are closed
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Event handler for when all windows are closed
app.on('window-all-closed', () => {
    // Quit the application if not on macOS (macOS typically keeps applications running even with no open windows)
    if (process.platform !== 'darwin') {
        app.quit();
    }
});