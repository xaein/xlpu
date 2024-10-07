// File loading and saving functions

// Initialize local variables
const transitionDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-duration')) * 1000 || 300;
const delay = transitionDuration * 2;
window.delay = delay;

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

// Load file with delay
async function loadFileWithDelay(appDir, directory, fileName) {
    if (!fileName) {
        js.F.updateStatusMessage(`Error: Attempted to load undefined file`);
        return null;
    }

    const filePath = js.F.joinPath(appDir, directory, fileName);
    try {
        updateUIForFile(fileName);

        const result = await e.Api.invoke('get-file', filePath);
        let data = result.data;

        // Use the new conversionCheck function
        data = await js.F.conversionCheck(fileName, data);

        if (fileName === 'xldbf.json') {
            xldbf = JSON.parse(data);
            js.F.setData('xldbf', xldbf);
            window.xldbf = xldbf;
        } else {
            processAndStoreData(fileName, data);
        }

        loadedFiles++;
        js.F.updateProgress(Math.min((loadedFiles / totalFiles) * 100, 100));
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return data || js.F.getData('preloadedData', fileName);
    } catch (error) {
        js.F.updateStatusMessage(`Error loading ${fileName}: ${error.message}`);
        return null;
    }
}

// Update UI for file
function updateUIForFile(fileName) {
    if (!fileName) {
        js.F.updateCurrentFile('Loading unknown file', false);
        return;
    }

    let displayName = fileName.replace(/\.[^/.]+$/, "");
    if (fileName === 'xldbv.json') {
        js.F.updateCurrentFile('Loading Variables', false);
    } else if (fileName === 'xldbf.json') {
        js.F.updateCurrentFile('Applying Favourites', false);
    } else if (fileName === 'xlaunch.cfg') {
        js.F.updateCurrentFile('Loading Config', false);
    } else if (xldbv && fileName === xldbv.mainXLFC) {
        js.F.updateCurrentFile('Loading Launch List', false);
    } else if (fileName.endsWith('.xlfc')) {
        js.F.updateCurrentFile(displayName, true);
    } else {
        js.F.updateCurrentFile(displayName, false);
    }
}

// Process and store data
function processAndStoreData(fileName, data) {
    if (fileName === 'xldbv.json') {
        const variables = JSON.parse(data);
        
        // Check and add new tray-related variables if they don't exist
        if (!variables.configOpts) {
            variables.configOpts = {};
        }
        if (variables.configOpts.showTray === undefined) {
            variables.configOpts.showTray = true;
        }
        if (variables.configOpts.minimizeToTray === undefined) {
            variables.configOpts.minimizeToTray = false;
        }
        if (variables.configOpts.closeToTray === undefined) {
            variables.configOpts.closeToTray = false;
        }

        js.F.setData('xldbv', variables);
        xldbv = variables;
        totalFiles += 3;
        if (xldbv.xldbFiles && xldbv.xldbFiles.length > 0) {
            totalFiles += xldbv.xldbFiles.length;
        }
    } else if (fileName === 'xldbf.json') {
        const xldbfData = JSON.parse(data);
        
        // Ensure xldbfData has 'favourites' and 'recent' arrays
        if (!Array.isArray(xldbfData.favourites)) {
            xldbfData.favourites = [];
        }
        if (!Array.isArray(xldbfData.recent)) {
            xldbfData.recent = [];
        }

        xldbf = xldbfData;
        js.F.setData('xldbf', xldbfData);
    } else if (fileName === 'xlaunch.cfg') {
        const configData = parseConfigFile(data);
        js.F.setData('xlaunchConfig', configData);
    } else if (fileName === xldbv.mainXLFC || (xldbv.xldbFiles && xldbv.xldbFiles.includes(fileName))) {
        js.F.setData('preloadedData', data, fileName);
    }
}

// Parse config file
function parseConfigFile(configData) {
    const config = {};
    const lines = configData.split('\n');
    for (const line of lines) {
        const [key, ...valueParts] = line.split('=').map(item => item.trim());
        if (key && valueParts.length > 0) {
            let value = valueParts.join('=');
            value = value.replace(/^['"](.*)['"]$/, '$1');
            config[key] = value;
        }
    }
    return config;
}

// Initialize files
async function initializeFiles() {
    try {
        js.F.updateProgress(0);
        const appDir = await e.Api.invoke('get-app-dir');

        js.F.updateCurrentFile('Loading Variables');
        const data = await loadFileWithDelay(appDir, 'utils', 'xldbv.json');
        if (!data) {
            throw new Error('Failed to load xldbv.json');
        }
        window.xldbv = js.F.getData('xldbv');
        if (!window.xldbv) {
            throw new Error('Failed to load xldbv.json');
        }

        if (window.xldbv.firstRun === 1) {
            js.F.updateCurrentFile('First run startup detected.. Progressing to first-time setup...');
            js.F.updateProgress(100);
            return true;
        } else if (window.xldbv.firstRun === 2) {
            js.F.updateCurrentFile('Setup Was not completed. Continuing setup...');
            js.F.updateProgress(100);
            return true;
        } else {
            if (window.xldbv.configOpts && window.xldbv.configOpts.aupd === 'on') {
                const updateMessage = await checkForUpdates();
                js.F.updateStatusMessage(updateMessage);
            }

            await loadFileWithDelay(appDir, 'utils', window.xldbv.mainXLFC);
            if (Array.isArray(window.xldbv.xldbFiles)) {
                for (const file of window.xldbv.xldbFiles) {
                    await loadFileWithDelay(appDir, 'xldb', file);
                }
            } else {
                js.F.updateStatusMessage('Warning: xldbFiles is not an array or is undefined');
            }

            await loadFileWithDelay(appDir, 'utils', 'xlaunch.cfg');
            await loadFileWithDelay(appDir, 'utils', 'xldbf.json');
    
            js.F.setData('tempData', js.F.getData('preloadedData'));
    
            return false;
        }
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
function saveDialogExists() {
    return document.getElementById('saveDialog') !== null;
}

// Update save progress
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

// Helper function to format JSON string
function formatJSONString(jsonString) {
    try {
        const obj = JSON.parse(jsonString);
        return JSON.stringify(obj, null, 2);
    } catch (error) {
        return jsonString; // Return original string if parsing fails
    }
}

// Save all data
async function saveAllData() {
    isSaveProcessActive = true;
    
    const tempData = js.F.getData('tempData');
    js.F.setData('tempData', tempData);
    js.F.setData('xldbv', window.xldbv);
    await js.F.updateFavoritesOnExit();

    const xldbFiles = window.xldbv.xldbFiles || [];
    let totalFiles = xldbFiles.length;
    let processedFiles = 0;
    const newData = {};

    const appDir = await e.Api.invoke('get-app-dir');
    const xldbDir = window.xldbv?.directories?.xldb || 'xldb';
    const utilsDir = window.xldbv?.directories?.utils || 'utils';

    for (const fileName of xldbFiles) {
        if (!isSaveProcessActive) break;
        updateSaveProgress((processedFiles / totalFiles) * 100, fileName.replace('.xlfc', ''));
        const content = tempData[fileName];
        if (content) {
            const filePath = js.F.joinPath(appDir, xldbDir, fileName);
            try {
                // Format the content before writing
                const formattedContent = formatJSONString(content);
                await e.Api.invoke('write-file', filePath, formattedContent);
            } catch {}
        }
        
        processedFiles++;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (isSaveProcessActive) {
        updateSaveProgress(100, '');
        try {
            await e.Api.invoke('run-xlstitch');
        } catch {}
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    processedFiles = 0;
    for (const fileName of xldbFiles) {
        if (!isSaveProcessActive) break;
        updateReloadProgress((processedFiles / totalFiles) * 100, fileName.replace('.xlfc', ''));
        try {
            const filePath = js.F.joinPath(appDir, xldbDir, fileName);
            const { data } = await e.Api.invoke('get-file', filePath);
            newData[fileName] = data;
            js.F.setData('preloadedData', data, fileName);
        } catch {}

        processedFiles++;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (isSaveProcessActive) {
        updateReloadProgress(95, '');
        const mainXLFC = window.xldbv.mainXLFC;
        try {
            const mainXLFCPath = js.F.joinPath(appDir, utilsDir, mainXLFC);
            const { data: mainXLFCData } = await e.Api.invoke('get-file', mainXLFCPath);
            // Parse the JSON string back into an object
            newData[mainXLFC] = mainXLFCData;
            js.F.setData('preloadedData', mainXLFCData, mainXLFC);
        } catch {}

        // Update tempData with the new data
        Object.assign(window.tempData, newData);
        js.F.setData('tempData', window.tempData);

        // Check if tcag is set to 'on' and run xltc.js
        if (window.xldbv.configOpts.triggercmd.autoGenerate === true) {
            updateReloadProgress(98, 'Generating TriggerCMD File');

            await new Promise(resolve => setTimeout(resolve, delay));

            try {
                const configOpts = {
                    triggercmd: {
                        overwriteFile: window.xldbv.configOpts.triggercmd.overwriteFile,
                        addCommands: window.xldbv.configOpts.triggercmd.addCommands
                    }
                };
                const result = await e.Api.invoke('generate-triggercmd', configOpts);
                updateReloadProgress(99, 'Generated TriggerCMD File');
            } catch (error) {
                updateReloadProgress(99, 'Error Generating TriggerCMD File');
            }

            await new Promise(resolve => setTimeout(resolve, delay));
        }

        updateReloadProgress(100, '');

        // Check if firstRun is 2 and change it to 0
        if (window.xldbv.firstRun === 2) {
            window.xldbv.firstRun = 0;
            if (js.F.validateXldbvJson(window.xldbv)) {
                js.F.setData('xldbv', window.xldbv);
                await js.F.updateVariablesOnExit();
                js.F.setupHeaderNavigation('databasecontrol');
            } else {
                // Error handling removed
            }
        }

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