// File loading and saving functions

// Get transition duration
// Retrieves transition duration from CSS variable and converts to milliseconds
const transitionDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-duration')) * 1000 || 300;

// Set global delay
// Calculates and sets the global delay variable
const delay = transitionDuration * 2;
window.delay = delay;

// Initialize local variables
let totalFiles = 1;
let loadedFiles = 0;
let previousFile = '';
let isFirstRun = false;
let xldbv;
let xldbf;
let isSaveProcessActive = false;
let updateAvailable = false;

// Initialize preloadedData
if (typeof preloadedData === 'undefined') {
    var preloadedData = {};
}

// Join path parts
// Combines path parts and removes duplicate slashes
function joinPath(...parts) {
    return parts.join('/').replace(/\/+/g, '/');
}

// Create full path
// Generates a full file path from app directory, subdirectory, and filename
function getFullPath(appDir, directory, fileName) {
    return joinPath(appDir, directory, fileName);
}

// Create default config file
// Generates and writes a default configuration file
async function createDefaultConfigFile(appDir) {
    const defaultConfig = `maxLogEntries=1001
dateFormat=dd-MM-yy
timeFormat=HH:mm:ss
construct=timeFormat dateFormat
leftEncapsule=[
rightEncapsule=]
messageSeperator=>
messagePrefix=Launching:
`;
    try {
        const configPath = joinPath(appDir, 'utils', 'xlaunch.cfg');
        await e.Api.invoke('write-file', configPath, defaultConfig);
        return defaultConfig;
    } catch (error) {
        throw error;
    }
}

// Load file with delay
// Loads a single file and updates progress with a delay
async function loadFileWithDelay(appDir, directory, fileName, updateProgress, updateCurrentFile, updateStatusMessage) {
    const filePath = await e.Api.invoke('get-file-path', directory, fileName);
    try {
        updateUIForFile(fileName);

        const result = await e.Api.invoke('get-file', filePath);
        const data = result.data;

        processAndStoreData(fileName, data);

        loadedFiles++;
        js.F.updateProgress(Math.min((loadedFiles / totalFiles) * 100, 100));
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return data || js.F.getData('preloadedData', fileName);
    } catch (error) {
        updateStatusMessage(`Error loading ${fileName}: ${error.message}`);
        return null;
    }
}

// Update UI for file
// Updates the UI elements for the current file being processed
function updateUIForFile(fileName) {
    let displayName = fileName.replace(/\.[^/.]+$/, "");
    if (fileName === 'xldbv.json') {
        js.F.updateCurrentFile('Loading Variables', false);
    } else if (fileName === 'xldbf.json') {
        js.F.updateCurrentFile('Applying Favourites', false);
    } else if (fileName === 'xlaunch.cfg') {
        js.F.updateCurrentFile('Loading Config', false);
    } else if (fileName === xldbv.mainCSV) {
        js.F.updateCurrentFile('Loading Launch List', false);
    } else if (fileName.endsWith('.csv')) {
        js.F.updateCurrentFile(displayName, true);
    } else {
        js.F.updateCurrentFile(displayName, false);
    }
}

// Process and store data
// Processes loaded data and stores it in the appropriate format
function processAndStoreData(fileName, data) {
    if (fileName === 'xldbv.json') {
        const variables = JSON.parse(data);
        js.F.setData('xldbv', variables);
        xldbv = variables;
        totalFiles += 3;
        if (xldbv.xldbFiles && xldbv.xldbFiles.length > 0) {
            totalFiles += xldbv.xldbFiles.length;
        }
    } else if (fileName === 'xldbf.json') {
        const xldbfData = JSON.parse(data);
        xldbf = xldbfData;
        js.F.setData('xldbf', xldbfData);
    } else if (fileName === 'xlaunch.cfg') {
        const configData = parseConfigFile(data);
        js.F.setData('xlaunchConfig', configData);
    } else if (fileName === xldbv.mainCSV || (xldbv.xldbFiles && xldbv.xldbFiles.includes(fileName))) {
        js.F.setData('preloadedData', data, fileName);
    }
}

// Parse config file
// Parses the configuration file and returns an object
function parseConfigFile(configData) {
    const config = {};
    const lines = configData.split('\n');
    for (const line of lines) {
        const [key, ...valueParts] = line.split('=').map(item => item.trim());
        if (key && valueParts.length > 0) {
            let value = valueParts.join('='); // Rejoin in case there were '=' in the value
            // Remove surrounding quotes if present
            value = value.replace(/^['"](.*)['"]$/, '$1');
            config[key] = value;
        }
    }
    return config;
}

// Initialize files
// Loads all necessary files and initializes the application
async function initializeFiles(updateProgress, updateCurrentFile, updateStatusMessage) {
    try {
        js.F.updateProgress(0);
        const appDir = await e.Api.invoke('get-app-dir');

        js.F.updateCurrentFile('Loading Variables');
        const data = await loadFileWithDelay(appDir, 'utils', 'xldbv.json', js.F.updateProgress, js.F.updateCurrentFile, js.F.updateStatusMessage);
        if (!data) {
            throw new Error('Failed to load xldbv.json');
        }
        window.xldbv = js.F.getData('xldbv');
        if (!window.xldbv) {
            throw new Error('Failed to load xldbv.json');
        }

        // Check for updates if aupd is set to 'on'
        if (window.xldbv.configOpts && window.xldbv.configOpts.aupd === 'on') {
            const updateMessage = await checkForUpdates();
            const windowTitle = document.querySelector('.window-title');
            if (windowTitle) {
                windowTitle.textContent += ' (Update Available)';
            }
            js.F.updateStatusMessage(updateMessage);
        }

        if (xldbv.xldbFiles && xldbv.xldbFiles.length > 0) {
            await loadFileWithDelay(appDir, 'utils', xldbv.mainCSV, js.F.updateProgress, js.F.updateCurrentFile, js.F.updateStatusMessage);
            for (const file of xldbv.xldbFiles) {
                await loadFileWithDelay(appDir, 'xldb', file, js.F.updateProgress, js.F.updateCurrentFile, js.F.updateStatusMessage);
            }
            isFirstRun = false;
        } else {
            isFirstRun = true;
        }

        await loadFileWithDelay(appDir, 'utils', 'xlaunch.cfg', js.F.updateProgress, js.F.updateCurrentFile, js.F.updateStatusMessage);
        await loadFileWithDelay(appDir, 'utils', 'xldbf.json', js.F.updateProgress, js.F.updateCurrentFile, js.F.updateStatusMessage);

        js.F.setData('tempData', js.F.getData('preloadedData'));

        return isFirstRun;
    } catch (error) {
        js.F.updateStatusMessage(`Error initializing application: ${error.message}`);
        throw error;
    }
}

// Check for updates
async function checkForUpdates() {
    try {
        const uurl = window.xldbv.uurl;
        const response = await e.Api.invoke('fetch-url', `${uurl}/version.json`);
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        const latestVersion = response.data;
        const currentVersion = window.xldbv.version;

        if (latestVersion.version !== currentVersion) {
            window.updateAvailable = true;
            js.F.setData('updateAvailable', true);
            return `Update available: ${latestVersion.version}`;
        } else {
            window.updateAvailable = false;
            js.F.setData('updateAvailable', false);
            return;
        }
    } catch (error) {
        window.updateAvailable = false;
        js.F.setData('updateAvailable', false);
        return `Error checking for updates: ${error.message}`;
    }
}

// Save dialog exists
// Verifies if the save dialog element exists in the DOM
function saveDialogExists() {
    return document.getElementById('saveDialog') !== null;
}

// Update save progress
// Updates the save progress UI elements
async function updateSaveProgress(progress, category) {
    if (!saveDialogExists() || !isSaveProcessActive) return;

    const progressBar = document.getElementById('saveProgressBar');
    const savePercentage = document.getElementById('savePercentage');
    const currentCategory = document.getElementById('saveCurrentCategory');
    const headerMain = document.getElementById('saveHeaderMain');
    const categoryLabel = document.getElementById('saveCategoryLabel');
    
    const currentBackgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--progress-bar-background').trim();
    const replaceBackgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--progress-bar-background-replace').trim();
    
    if (currentBackgroundColor === replaceBackgroundColor) {
        document.documentElement.style.setProperty('--progress-bar-background', '');
        
        if (progressBar) {
            progressBar.style.transition = 'none';
            progressBar.style.width = '0%';
            progressBar.style.backgroundColor = '';
            progressBar.classList.remove('reloading');
            progressBar.offsetHeight;
            progressBar.style.transition = getComputedStyle(document.documentElement).getPropertyValue('--progress-bar-transition');
        }
        if (savePercentage) savePercentage.textContent = '0%';
        if (headerMain) headerMain.textContent = 'Saving:';
        if (categoryLabel) categoryLabel.textContent = 'Category:';
        if (currentCategory) currentCategory.textContent = '';
        
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (savePercentage) savePercentage.textContent = `${Math.round(progress)}%`;
    
    if (progress === 100) {
        if (headerMain) headerMain.textContent = 'Stitching Complete';
        if (currentCategory) currentCategory.textContent = '';
        if (categoryLabel) categoryLabel.textContent = '';
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        document.documentElement.style.setProperty('--progress-bar-background', replaceBackgroundColor);

        if (progressBar) {
            progressBar.style.transition = 'none';
            progressBar.style.width = '0%';
            progressBar.offsetHeight;
            progressBar.style.transition = getComputedStyle(document.documentElement).getPropertyValue('--progress-bar-transition');
            progressBar.classList.add('reloading');
        }
    } else {
        if (headerMain) headerMain.textContent = 'Saving:';
        if (categoryLabel) categoryLabel.textContent = 'Category:';
        if (currentCategory) currentCategory.textContent = category;
    }
}

// Update reload progress
// Updates the reload progress UI elements
function updateReloadProgress(progress, category) {
    if (!saveDialogExists() || !isSaveProcessActive) return;

    const progressBar = document.getElementById('saveProgressBar');
    const reloadPercentage = document.getElementById('reloadPercentage');
    const currentCategory = document.getElementById('reloadCurrentCategory');
    const headerMain = document.getElementById('reloadHeaderMain');
    const categoryLabel = document.getElementById('reloadCategoryLabel');
    
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
        progressBar.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--progress-bar-secondary-color');
    }
    if (reloadPercentage) reloadPercentage.textContent = `${Math.round(progress)}%`;
    
    if (progress === 100) {
        if (headerMain) headerMain.textContent = 'Reload Complete';
        if (currentCategory) currentCategory.textContent = '';
        if (categoryLabel) categoryLabel.textContent = '';

        setTimeout(() => {
            if (progressBar) {
                progressBar.style.width = '0%';
                progressBar.style.backgroundColor = '';
            }
            if (reloadPercentage) reloadPercentage.textContent = '0%';
        }, delay);
    } else {
        if (headerMain) headerMain.textContent = 'Reloading:';
        if (categoryLabel) {
            if (category.includes('TriggerCMD')) {
                categoryLabel.textContent = '';
            } else {
                categoryLabel.textContent = 'Category:';
            }
        }
        if (currentCategory) currentCategory.textContent = category;
    }
}

// Save all data
// Saves all data, updates UI, and reloads data
async function saveAllData() {
    isSaveProcessActive = true;
    
    const tempData = js.F.getData('tempData');
    js.F.setData('tempData', tempData);
    js.F.updateFavoritesOnExit();

    const xldbFiles = window.xldbv.xldbFiles || [];
    let totalFiles = xldbFiles.length;
    let processedFiles = 0;
    const newData = {};

    const appDir = await e.Api.invoke('get-app-dir');
    const xldbDir = window.xldbv?.directories?.xldb || 'xldb';
    const utilsDir = window.xldbv?.directories?.utils || 'utils';

    for (const fileName of xldbFiles) {
        if (!isSaveProcessActive) break;
        updateSaveProgress((processedFiles / totalFiles) * 100, fileName.replace('.csv', ''));
        const content = tempData[fileName];
        if (content) {
            const filePath = getFullPath(appDir, xldbDir, fileName);
            try {
                await e.Api.invoke('write-csv-file', filePath, content);
            } catch (error) {
            }
        }
        
        processedFiles++;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (isSaveProcessActive) {
        updateSaveProgress(100, '');
        try {
            await e.Api.invoke('run-xlstitch');
        } catch (error) {
        }
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    processedFiles = 0;
    for (const fileName of xldbFiles) {
        if (!isSaveProcessActive) break;
        updateReloadProgress((processedFiles / totalFiles) * 100, fileName.replace('.csv', ''));
        try {
            const filePath = getFullPath(appDir, xldbDir, fileName);
            const { data } = await e.Api.invoke('get-file', filePath);
            newData[fileName] = data;
        } catch (error) {
        }

        processedFiles++;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (isSaveProcessActive) {
        updateReloadProgress(95, '');
        const mainCSV = window.xldbv.mainCSV;
        try {
            const mainCSVPath = getFullPath(appDir, utilsDir, mainCSV);
            const { data: mainCSVData } = await e.Api.invoke('get-file', mainCSVPath);
            newData[mainCSV] = mainCSVData;
        } catch (error) {
        }

        Object.assign(window.tempData, newData);
        js.F.setData('preloadedData', newData);
        js.F.setData('tempData', window.tempData);

        // Check if tcag is set to 'on' and run xltc.js
        if (window.xldbv.configOpts.tcag === 'on') {
            updateReloadProgress(98, 'Generating TriggerCMD File');

            await new Promise(resolve => setTimeout(resolve, delay));

            try {
                const configOpts = {
                    tcuo: window.xldbv.configOpts.tcuo,
                    tcao: window.xldbv.configOpts.tcao
                };
                const result = await e.Api.invoke('generate-triggercmd', configOpts);
                console.log('Result from generate-triggercmd:', result);
                updateReloadProgress(99, 'Generated TriggerCMD File');
            } catch (error) {
                console.error('Error running xltc.js:', error);
                updateReloadProgress(99, 'Error Generating TriggerCMD File');
            }

            await new Promise(resolve => setTimeout(resolve, delay));

        }

        updateReloadProgress(100, '');

        js.F.updateSaveButtonState();
    }

    isSaveProcessActive = false;
}

// Export loadsave functions
window.loadsaveFunctions = {
    saveAllData
};

window.loadsave = {
    initializeFiles
};