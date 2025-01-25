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

// Loading visual speed variables
let currentSpeed = 7;
let targetSpeed = 7;
let isAnimating = false;

const milestones = {
    early: {
        range: [20, 30],     // Around 25%
        speed: 5
    },
    mid: {
        range: [45, 55],     // Around 50%
        speed: 3.5
    },
    late: {
        range: [70, 80],     // Around 75%
        speed: 2
    },
    final: {
        range: [95, 100],    // Final speed at completion
        speed: 1
    }
};

// Initialize preloadedData
if (typeof preloadedData === 'undefined') {
    var preloadedData = {};
}

// Initial Load of files on application start

// Load File Delayed
// Loads and processes file data with configurable timing delay
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

        if (fileName === 'xldbv.json' || fileName === 'xldbf.json') {
            data = await js.F.conversionCheck(fileName, data);
        }

        processAndStoreData(fileName, data);
        loadedFiles++;
        updateProgress(Math.min((loadedFiles / totalFiles) * 100, 100));
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return data || js.F.getData('preloadedData', fileName);
    } catch (error) {
        js.F.updateStatusMessage(`Error loading ${fileName}: ${error.message}`);
        return null;
    }
}

// Update Load Status
// Updates interface display elements with current file loading status
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

// Store File Data
// Processes file content and stores data in appropriate locations
function processAndStoreData(fileName, data) {
    if (fileName === 'xldbv.json') {
        const variables = JSON.parse(data);
        
        if (!variables.configOpts) {
            variables.configOpts = {};
        }
        if (!variables.configOpts.system) {
            variables.configOpts.system = {
                show: true,
                minimizeTo: false,
                closeTo: false,
                startWithWindows: false
            };
        }

        js.F.setData('xldbv', variables);
        xldbv = variables;
        window.xldbv = variables;
        totalFiles += 3;
        if (xldbv.xldbFiles && xldbv.xldbFiles.length > 0) {
            totalFiles += xldbv.xldbFiles.length;
        }
    } else if (fileName === 'xldbf.json') {
        const xldbfData = JSON.parse(data);
        
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

// Parse Config Content
// Converts configuration file content into structured key value pairs
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

// Load App Files
// Loads and initializes all required application data files
async function initializeFiles() {
    try {
        updateProgress(0);
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

        if (window.xldbv.configOpts?.updates?.autoCheck) {
            const updateMessage = await checkForUpdates();
            js.F.updateStatusMessage(updateMessage);
        }

        if (window.xldbv.firstRun === 1) {
            js.F.updateCurrentFile('First run startup detected.. Progressing to first-time setup...');
            updateProgress(100);
            return true;
        } else if (window.xldbv.firstRun === 2) {
            js.F.updateCurrentFile('Setup Was not completed. Continuing setup...');
            updateProgress(100);
            return true;
        } else {
            if (window.xldbv.configOpts?.updates?.autoCheck) {
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

            const xldbPath = js.F.joinPath(appDir, 'utils', 'xldbu.json');
            if (await e.Api.invoke('file-exists', xldbPath)) {
                try {
                    const { data: xldbData } = await e.Api.invoke('get-file', xldbPath);
                    const updateData = JSON.parse(xldbData);
                    if (updateData.removedDependencies?.length > 0) {
                        for (const dep of updateData.removedDependencies) {
                            const depPath = js.F.joinPath(appDir, 'node_modules', dep);
                            await e.Api.invoke('remove-directory', depPath);
                        }
                    }
                    await e.Api.invoke('remove-file', xldbPath);
                } catch (error) {
                    await e.Api.invoke('remove-file', xldbPath);
                }
            }
            return false;
        }
    } catch (error) {
        js.F.updateStatusMessage(`Error initializing application: ${error.message}`);
        throw error;
    }
}

// Check App Version
// Compares current version with latest available release version
async function checkForUpdates() {
    try {
        const uurl = window.xldbv.uurl;
        const response = await e.Api.invoke('fetch-url', `${uurl}/version.json`);
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        const latestVersion = response.data;
        const currentVersion = window.xldbv.version;
        
        const windowTitle = document.querySelector('.window-title');
        if (windowTitle) {
            windowTitle.textContent = `xLauncher Plus v${currentVersion}`;
            
            const currentNum = parseInt(currentVersion.replace(/\./g, ''));
            const latestNum = parseInt(latestVersion.version.replace(/\./g, ''));
            
            if (latestNum > currentNum) {
                window.updateAvailable = true;
                windowTitle.textContent += ' (Update Available)';
                js.F.setData('updateAvailable', true);
                return `Update available: ${latestVersion.version}`;
            }
        }
        
        window.updateAvailable = false;
        js.F.setData('updateAvailable', false);
        return;
    } catch (error) {
        window.updateAvailable = false;
        js.F.setData('updateAvailable', false);
        return `Error checking for updates: ${error.message}`;
    }
}

// Progress update
// Sets the speed of the quantum loader based on progress
function updateProgress(progress) {
    const loader = document.querySelector('.container');
    if (!loader) return;

    // Only update target speed if we hit a milestone
    if (progress >= milestones.final.range[0] && progress <= milestones.final.range[1]) {
        targetSpeed = milestones.final.speed;
    } else if (progress >= milestones.late.range[0] && progress <= milestones.late.range[1]) {
        targetSpeed = milestones.late.speed;
    } else if (progress >= milestones.mid.range[0] && progress <= milestones.mid.range[1]) {
        targetSpeed = milestones.mid.speed;
    } else if (progress >= milestones.early.range[0] && progress <= milestones.early.range[1]) {
        targetSpeed = milestones.early.speed;
    }
    
    if (!isAnimating) startSpeedAnimation();
}

function startSpeedAnimation() {
    if (isAnimating) return;
    isAnimating = true;
    let frameCount = 0;
    
    function animate() {
        const loader = document.querySelector('.container');
        if (!loader) {
            isAnimating = false;
            return;
        }

        // Only update every 3rd frame for smoother transitions
        frameCount++;
        if (frameCount % 3 === 0) {
            if (Math.abs(currentSpeed - targetSpeed) > 0.01) {
                // Smaller step size (0.05) for smoother transitions
                currentSpeed += (targetSpeed - currentSpeed) * 0.03;
                loader.style.setProperty('--uib-speed', `${currentSpeed.toFixed(2)}s`);
                requestAnimationFrame(animate);
            } else {
                currentSpeed = targetSpeed; // Snap to final value
                loader.style.setProperty('--uib-speed', `${currentSpeed.toFixed(2)}s`);
                isAnimating = false;
            }
        } else {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}

// Save and reload of XLCF files from the Database Control page

// Check Save Dialog
// Checks if save dialog element exists in document
function saveDialogExists() {
    return document.getElementById('saveDialog') !== null;
}

// Update Save Status
// Updates progress indicators and display during file save operations
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

// Update Reload Status
// Updates progress indicators and display during file reload operations
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

// Format JSON Data
// Formats JSON string with proper indentation and circular reference handling
function formatJSONString(jsonString) {
    try {
        const obj = JSON.parse(jsonString);
        return JSON.stringify(obj, null, 2);
    } catch (error) {
        return jsonString;
    }
}

// Save App Data
// Saves all application data to disk
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
    const xldbDir = js.F.dirVar('xldb');
    const utilsDir = js.F.dirVar('utils');

    for (const fileName of xldbFiles) {
        if (!isSaveProcessActive) break;
        updateSaveProgress((processedFiles / totalFiles) * 100, fileName.replace('.xlfc', ''));
        const content = tempData[fileName];
        if (content) {
            const filePath = js.F.joinPath(appDir, xldbDir, fileName);
            try {
                const formattedContent = formatJSONString(content);
                await e.Api.invoke('write-file', filePath, formattedContent);
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
        updateReloadProgress((processedFiles / totalFiles) * 100, fileName.replace('.xlfc', ''));
        try {
            const filePath = js.F.joinPath(appDir, xldbDir, fileName);
            const { data } = await e.Api.invoke('get-file', filePath);
            newData[fileName] = data;
            js.F.setData('preloadedData', data, fileName);
        } catch (error) {
        }

        processedFiles++;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (isSaveProcessActive) {
        updateReloadProgress(95, '');
        const mainXLFC = window.xldbv.mainXLFC;
        try {
            const mainXLFCPath = js.F.joinPath(appDir, utilsDir, mainXLFC);
            const { data: mainXLFCData } = await e.Api.invoke('get-file', mainXLFCPath);
            newData[mainXLFC] = mainXLFCData;
            js.F.setData('preloadedData', mainXLFCData, mainXLFC);
        } catch (error) {
        }

        Object.assign(window.tempData, newData);
        js.F.setData('tempData', window.tempData);

        if (window.xldbv.configOpts?.triggercmd?.autoGenerate) {
            updateReloadProgress(98, 'Generating TriggerCMD File');

            await new Promise(resolve => setTimeout(resolve, delay));

            try {
                const configOpts = {
                    overwriteFile: window.xldbv.configOpts.triggercmd.overwriteFile,
                    addCommands: window.xldbv.configOpts.triggercmd.addCommands
                };
                const result = await e.Api.invoke('generate-triggercmd', configOpts);
                updateReloadProgress(99, 'Generated TriggerCMD File');
            } catch (error) {
                updateReloadProgress(99, 'Error Generating TriggerCMD File');
            }

            await new Promise(resolve => setTimeout(resolve, delay));
        }

        updateReloadProgress(100, '');

        if (window.xldbv.firstRun === 2) {
            window.xldbv.firstRun = 0;
            if (js.F.validateXldbvJson(window.xldbv)) {
                js.F.setData('xldbv', window.xldbv);
                await js.F.updateVariablesOnExit();
                js.F.setupHeaderNavigation('databasecontrol');
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