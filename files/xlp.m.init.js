// Initialization Module
//   Handles core file loading and system startup for application launch
//   Loads and parses xldbv.json, xldbf.json, and xlaunch.cfg configuration files
//   Initializes application state, themes, and default configurations
//   Prepares application environment for user interaction

// Module state variables
//   Tracks file loading progress, animation speed, and initialization state
//   Manages transition duration, file counters, preloaded data, and loading speed milestones
const transitionDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-duration')) * 1000 || 300;
const delay = transitionDuration * 2;
let totalFiles = 1;
let loadedFiles = 0;
let preloadedData = {};
let previousFile = '';
let isFirstRun = false;
let updateAvailable = false;

// Loading animation speed control
//   Manages dynamic loading animation speed based on progress milestones
//   Controls animation speed transitions for early, mid, late, and final loading stages
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
//   Sets up and validates all core application files
//   Loads xldbv.json, xldbf.json, xlaunch.cfg, and all xldb files with progress tracking
//   Handles first run detection and update file cleanup
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
//   Loads and processes files with detailed visual feedback
//   Loads file from specified directory, validates format, stores data, and updates progress
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
//   Stores and validates all loaded file data securely
//   Parses and stores file data in preloadedData with file name key
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
        window.xlaunchConfig = configData;
        xlp.setData('xlaunchConfig', configData);
        if (xlp.setState) {
            xlp.setState('config.xlaunchConfig', configData);
        }
    } else if (fileName === window.xldbv.mainXLFC || (window.xldbv.xldbFiles && window.xldbv.xldbFiles.includes(fileName))) {
        xlp.setData('preloadedData', data, fileName);
    }
}

// Parse Config Settings
//   Converts configuration file content into structured object format
//   Parses key-value pairs from config file and removes quotes from values
export function parseConfigFile(configData) {
    const config = {};
    const lines = configData.split('\n');
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.includes('=')) {
            continue;
        }
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
            let value = valueParts.join('=').trim();
            value = value.replace(/^['"]+|['"]+$/g, '');
            config[key.trim()] = value;
        }
    }
    return config;
}

// System Update Checker
//   Verifies current version against remote version and updates
//   Checks for updates and displays update indicator if newer version is available
export async function checkForUpdatesInit() {
    try {
        const uurl = xldbv.uurl;
        const response = await e.Api.invoke('fetch-url', `${uurl}/version.json`);
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        const latestVersion = response.data;
        const currentVersion = xldbv.version;
        
        const windowTitle = xlp.getElement('dqs', '.window-title');
        if (windowTitle) {
            windowTitle.textContent = `xLauncher Plus v${currentVersion}`;
            
            if (xlp.isNewerVersion(currentVersion, latestVersion.version)) {
                updateAvailable = true;
                
                const updateButton = xlp.getElement('titlebarUpdateIndicator');
                if (updateButton) {
                    updateButton.textContent = window.xldbv.updtico || "⥥";
                    updateButton.classList.add('visible');
                }
                
                xlp.setData('updateAvailable', true);
                return `Update available: ${latestVersion.version}`;
            }
        }
        
        const updateButton = xlp.getElement('titlebarUpdateIndicator');
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
//   Updates interface elements with current file loading status
//   Updates current file display with appropriate label based on file type
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
//   Updates and maintains all current file display elements
//   Updates current file or category file display based on isCategory parameter
export function updateCurrentFile(fileName, isCategory = false) {
    const currentFileElement = xlp.getElement('currentFile');
    const categoryFileElement = xlp.getElement('categoryFile');

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
//   Updates and manages all system status message displays
//   Updates status message element with specified message text
export function updateStatusMessage(message) {
    const statusElement = xlp.getElement('statusMessage');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

// Manage Progress Updates
//   Updates loading progress and manages animation speed control
//   Updates loading speed based on progress milestones and starts animation
export function updateProgress(progress) {
    const loader = xlp.getElement('dqs', '.container');
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
//   Manages and synchronizes all loading animation speed transitions
//   Animates loading speed transition to target speed using requestAnimationFrame
export function startSpeedAnimation() {
    if (loadingSpeed.isAnimating) return;
    loadingSpeed.isAnimating = true;
    let frameCount = 0;
    
    const animate = () => {
        const loader = xlp.getElement('dqs', '.container');
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
//   Adds and manages loaded files in display listing
//   Adds loaded file name to loaded files list element
export function addLoadedFile(fileName) {
    const loadedFilesElement = xlp.getElement('loadedFiles');
    const fileElement = document.createElement('div');
    fileElement.textContent = fileName;
    fileElement.classList.add('loaded-file');
    loadedFilesElement.innerHTML = '';
    loadedFilesElement.appendChild(fileElement);

    fileElement.offsetHeight;
    fileElement.classList.add('fade-out');
}