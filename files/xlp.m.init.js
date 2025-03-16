// Initialization Module
// Handles core file loading and system startup for application launch

// Initialize module state variables
const transitionDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-duration')) * 1000 || 300;
const delay = transitionDuration * 2;
let totalFiles = 1;
let loadedFiles = 0;
let preloadedData = {};
let previousFile = '';
let isFirstRun = false;
let updateAvailable = false;

let loadingSpeed = {
    current: 7,
    target: 7,
    isAnimating: false,
    milestones: {
        early: {
            range: [20, 30],
            speed: 5
        },
        mid: {
            range: [45, 55],
            speed: 3.5
        },
        late: {
            range: [70, 80],
            speed: 2
        },
        final: {
            range: [95, 100],
            speed: 1
        }
    }
};

// System File Initialization
// Sets up and validates all core application files
export async function initializeFiles() {
    try {
        updateProgress(0);
        const appDir = await e.Api.invoke('get-app-dir');

        updateCurrentFile('Loading Variables');

        if (xldbv.configOpts?.updates?.autoCheck) {
            const updateMessage = await checkForUpdatesInit();
            updateStatusMessage(updateMessage);
        }

        if (xldbv.firstRun !== 0) {
            const filePath = xlp.joinPath(appDir, 'utils', 'xlaunch.cfg');
            const result = await e.Api.invoke('get-file', filePath);
            if (result?.data) {
                processAndStoreData('xlaunch.cfg', result.data);
            }

            if (xldbv.firstRun === 1) {
                updateCurrentFile('First run startup detected.. Progressing to first-time setup...');
            } else if (xldbv.firstRun === 2) {
                updateCurrentFile('Setup Was not completed. Continuing setup...');
            }
            updateProgress(100);
            return xldbv.firstRun;
        }

        await loadFileWithDelay(appDir, 'utils', xldbv.mainXLFC);
        
        if (Array.isArray(xldbv.xldbFiles)) {
            for (const file of xldbv.xldbFiles) {
                await loadFileWithDelay(appDir, 'xldb', file);
            }
        } else {
            updateStatusMessage('Warning: xldbFiles is not an array or is undefined');
        }

        await loadFileWithDelay(appDir, 'utils', 'xlaunch.cfg');
        await loadFileWithDelay(appDir, 'utils', 'xldbf.json');

        xlp.setData('tempData', xlp.getData('preloadedData'));

        const xldbPath = xlp.joinPath(appDir, 'utils', 'xldbu.json');
        if (await e.Api.invoke('file-exists', xldbPath)) {
            try {
                const { data: xldbData } = await e.Api.invoke('get-file', xldbPath);
                const updateData = JSON.parse(xldbData);
                if (updateData.removedDependencies?.length > 0) {
                    for (const dep of updateData.removedDependencies) {
                        const depPath = xlp.joinPath(appDir, 'node_modules', dep);
                        await e.Api.invoke('remove-directory', depPath);
                    }
                }
                await e.Api.invoke('remove-file', xldbPath);
            } catch (error) {
                await e.Api.invoke('remove-file', xldbPath);
            }
        }

        return false;
    } catch (error) {
        updateStatusMessage(`Error initializing application: ${error.message}`);
        throw error;
    }
}

// Process File Loading
// Loads and processes files with detailed visual feedback
export async function loadFileWithDelay(appDir, directory, fileName) {
    if (!fileName) {
        updateStatusMessage(`Error: Attempted to load undefined file`);
        return null;
    }

    const filePath = xlp.joinPath(appDir, directory, fileName);
    try {
        updateUIForFile(fileName);
        const result = await e.Api.invoke('get-file', filePath);
        let data = result.data;

        if (fileName === 'xldbv.json' || fileName === 'xldbf.json') {
            data = await xlp.conversionCheck(fileName, data);
        }

        processAndStoreData(fileName, data);
        loadedFiles++;
        updateProgress(Math.min((loadedFiles / totalFiles) * 100, 100));
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return data || xlp.getData('preloadedData', fileName);
    } catch (error) {
        updateStatusMessage(`Error loading ${fileName}: ${error.message}`);
        return null;
    }
}

// Handle Data Processing
// Stores and validates all loaded file data securely
export function processAndStoreData(fileName, data) {
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

        xlp.setData('xldbv', variables);
        window.xldbv = variables;
        totalFiles += 3;
        if (variables.xldbFiles && variables.xldbFiles.length > 0) {
            totalFiles += variables.xldbFiles.length;
        }
    } else if (fileName === 'xldbf.json') {
        const xldbfData = JSON.parse(data);
        
        if (!Array.isArray(xldbfData.favourites)) {
            xldbfData.favourites = [];
        }
        if (!Array.isArray(xldbfData.recent)) {
            xldbfData.recent = [];
        }

        window.xldbf = xldbfData;
        xlp.setData('xldbf', xldbfData);
    } else if (fileName === 'xlaunch.cfg') {
        const configData = xlp.parseConfigFile(data);
        xlp.setData('xlaunchConfig', configData);
    } else if (fileName === window.xldbv.mainXLFC || (window.xldbv.xldbFiles && window.xldbv.xldbFiles.includes(fileName))) {
        xlp.setData('preloadedData', data, fileName);
    }
}

// Parse Config Settings
// Converts configuration file content into structured object format
export function parseConfigFile(configData) {
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

// System Update Checker
// Verifies current version against remote version and updates
export async function checkForUpdatesInit() {
    try {
        const uurl = xldbv.uurl;
        const response = await e.Api.invoke('fetch-url', `${uurl}/version.json`);
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        const latestVersion = response.data;
        const currentVersion = xldbv.version;
        
        const windowTitle = document.querySelector('.window-title');
        if (windowTitle) {
            windowTitle.textContent = `xLauncher Plus v${currentVersion}`;
            
            if (xlp.isNewerVersion(currentVersion, latestVersion.version)) {
                updateAvailable = true;
                
                const updateButton = document.getElementById('titlebarUpdateIndicator');
                if (updateButton) {
                    updateButton.textContent = window.xldbv.updtico || "⥥";
                    updateButton.classList.add('visible');
                }
                
                xlp.setData('updateAvailable', true);
                return `Update available: ${latestVersion.version}`;
            }
        }
        
        const updateButton = document.getElementById('titlebarUpdateIndicator');
        if (updateButton) {
            updateButton.classList.remove('visible');
        }
        
        updateAvailable = false;
        xlp.setData('updateAvailable', false);
        return;
    } catch (error) {
        updateAvailable = false;
        xlp.setData('updateAvailable', false);
        return `Error checking for updates: ${error.message}`;
    }
}

// Update File Interface
// Updates interface elements with current file loading status
export function updateUIForFile(fileName) {
    if (!fileName) {
        updateCurrentFile('Loading unknown file', false);
        return;
    }

    let displayName = fileName.replace(/\.[^/.]+$/, "");
    
    if (fileName === 'xldbv.json') {
        updateCurrentFile('Loading Variables', false);
    } else if (fileName === 'xldbf.json') {
        updateCurrentFile('Applying Favourites', false);
    } else if (fileName === 'xlaunch.cfg') {
        updateCurrentFile('Loading Config', false);
    } else if (window.xldbv && fileName === window.xldbv.mainXLFC) {
        updateCurrentFile('Loading Launch List', false);
    } else if (fileName.endsWith('.xlfc')) {
        updateCurrentFile(displayName, true);
    } else {
        updateCurrentFile(displayName, false);
    }
}

// Manage File Display
// Updates and maintains all current file display elements
export function updateCurrentFile(fileName, isCategory = false) {
    const currentFileElement = document.getElementById('currentFile');
    const categoryFileElement = document.getElementById('categoryFile');

    if (isCategory) {
        currentFileElement.textContent = 'Loading Category:';
        if (categoryFileElement.textContent) {
            addLoadedFile(categoryFileElement.textContent);
        }
        categoryFileElement.textContent = fileName || 'Unknown';
    } else {
        currentFileElement.textContent = fileName || 'Unknown';
        categoryFileElement.textContent = '';
    }
}

// Handle Status Messages
// Updates and manages all system status message displays
export function updateStatusMessage(message) {
    const statusElement = document.getElementById('statusMessage');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

// Manage Progress Updates
// Updates loading progress and manages animation speed control
export function updateProgress(progress) {
    const loader = document.querySelector('.container');
    if (!loader) return;

    if (progress >= loadingSpeed.milestones.final.range[0] && 
        progress <= loadingSpeed.milestones.final.range[1]) {
        loadingSpeed.target = loadingSpeed.milestones.final.speed;
    } else if (progress >= loadingSpeed.milestones.late.range[0] && 
               progress <= loadingSpeed.milestones.late.range[1]) {
        loadingSpeed.target = loadingSpeed.milestones.late.speed;
    } else if (progress >= loadingSpeed.milestones.mid.range[0] && 
               progress <= loadingSpeed.milestones.mid.range[1]) {
        loadingSpeed.target = loadingSpeed.milestones.mid.speed;
    } else if (progress >= loadingSpeed.milestones.early.range[0] && 
               progress <= loadingSpeed.milestones.early.range[1]) {
        loadingSpeed.target = loadingSpeed.milestones.early.speed;
    }
    
    if (!loadingSpeed.isAnimating) startSpeedAnimation();
}

// Process Animation Control
// Manages and synchronizes all loading animation speed transitions
export function startSpeedAnimation() {
    if (loadingSpeed.isAnimating) return;
    loadingSpeed.isAnimating = true;
    let frameCount = 0;
    
    const animate = () => {
        const loader = document.querySelector('.container');
        if (!loader) {
            loadingSpeed.isAnimating = false;
            return;
        }

        frameCount++;
        if (frameCount % 3 === 0) {
            if (Math.abs(loadingSpeed.current - loadingSpeed.target) > 0.01) {
                loadingSpeed.current += (loadingSpeed.target - loadingSpeed.current) * 0.03;
                loader.style.setProperty('--uib-speed', `${loadingSpeed.current.toFixed(2)}s`);
                requestAnimationFrame(animate);
            } else {
                loadingSpeed.current = loadingSpeed.target;
                loader.style.setProperty('--uib-speed', `${loadingSpeed.current.toFixed(2)}s`);
                loadingSpeed.isAnimating = false;
            }
        } else {
            requestAnimationFrame(animate);
        }
    };
    
    requestAnimationFrame(animate);
}

// Update File Listing
// Adds and manages loaded files in display listing
export function addLoadedFile(fileName) {
    const loadedFilesElement = document.getElementById('loadedFiles');
    const fileElement = document.createElement('div');
    fileElement.textContent = fileName;
    fileElement.classList.add('loaded-file');
    loadedFilesElement.innerHTML = '';
    loadedFilesElement.appendChild(fileElement);

    fileElement.offsetHeight;
    fileElement.classList.add('fade-out');
}