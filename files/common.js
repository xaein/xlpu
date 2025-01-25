// Core utility functions for xLauncher Plus

// Delay Function Call
// Delays function execution until after wait period ends
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Exit App Process
// Saves application state and triggers clean shutdown
async function exitApp() {
    setData('xldbv', window.xldbv);
    setData('xldbf', window.xldbf);

    try {
        await updateVariablesOnExit();
        await updateFavoritesOnExit();
        
        // Check for pending updates
        const baseDir = await e.Api.invoke('get-app-dir');
        const updateDir = joinPath(baseDir, dirVar('utils', 'update'));
        const dirContents = await e.Api.invoke('read-directory', updateDir);
        const hasUpdates = dirContents.length > 0;
        
        if (hasUpdates) {
            await e.Api.invoke('launch-app', 'xlu.exe');
        }
    } finally {
        setData('updateAvailable', false);
        e.Api.send('toMain', 'exit');
    }
}

// Get Storage Item
// Retrieves and parses data from localStorage with optional filename
function getData(key, fileName = null) {
    const value = localStorage.getItem(key);
    if (value === null) return null;
    try {
        const parsedValue = JSON.parse(value);
        if (fileName && typeof parsedValue === 'object') {
            return parsedValue[fileName] || null;
        }
        return parsedValue;
    } catch (e) {
        return value;
    }
}

// Get Page Settings
// Returns pagination settings for main and edit views
function getRowVariables() {
    const variables = js.F.getData('xldbv') || {};
    return {
        mainRowsPerPage: variables.rows?.main || 20,
        editRowsPerPage: variables.rows?.edit || 10,
    };
}

// Join Path Parts
// Combines and normalizes paths for cross-platform compatibility
function joinPath(...parts) {
    return parts.join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
}

// Load Script Dynamic
// Dynamically loads JavaScript files and updates function registry
async function lazyLoadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
            updateJsF();
            resolve(script);
        };
        script.onerror = () => {
            reject(new Error(`Failed to load script: ${src}`));
        };
        document.body.appendChild(script);
    });
}

// Setup Title Bar
// Initializes title bar and sets up window control buttons
async function loadTitleBar() {
    try {
        const includesDir = js.F.dirVar('includes');
        const response = await fetch(`${includesDir}/titlebar.html`);
        const titlebarHtml = await response.text();
        document.body.insertAdjacentHTML('afterbegin', titlebarHtml);

        document.querySelector('.help-button').addEventListener('click', () => {
            openHelpFile();
        });

        document.querySelector('.minimize-button').addEventListener('click', () => {
            e.Api.invoke('minimize-window');
        });

        document.querySelector('.maximize-button').addEventListener('click', () => {
            e.Api.invoke('maximize-window');
        });

        document.querySelector('.close-button').addEventListener('click', () => {
            e.Api.invoke('close-window');
        });

        const windowTitle = document.querySelector('.window-title');
        if (windowTitle && window.xldbv) {
            windowTitle.textContent = `xLauncher Plus v${window.xldbv.version}`;
            const updateAvailable = js.F.getData('updateAvailable');
            if (updateAvailable) {
                windowTitle.textContent += ' (Update Available)';
            }
        }
    } catch (error) {
    }
}

// Handle Navigation
// Routes between different application pages and handles transitions
function navigateTo(destination) {
    switch (destination) {
        case 'launchlist':
            window.location.href = 'launchlist.html';
            break;
        case 'databasecontrol':
            window.location.href = 'edit.dbc.html';
            break;
        case 'themes':
            window.location.href = 'edit.themes.html';
            break;
        case 'configuration':
            window.location.href = 'edit.config.html';
            break;
        case 'logging':
            window.location.href = 'logging.html';
            break;
        default:
    }
}

// Open Help File
// Opens help documentation and manages browser launch process
function openHelpFile() {
    const helpDir = dirVar('help');
    const helpFilePath = `${helpDir}/xlauncher_plus_help.html`;
    e.Api.invoke('open-external', helpFilePath);
}

// Remove Target File
// Deletes specified file and manages error handling process
async function removeFile(filePath) {
    try {
        const result = await e.Api.invoke('remove-file', filePath);
        if (!result) {
            throw new Error('Failed to remove file');
        }
    } catch (error) {
    }
}

// Set Storage Item
// Stores data in localStorage with optional file partitioning
function setData(key, data, fileName = null) {
    if (fileName) {
        let existingData = getData(key) || {};
        existingData[fileName] = data;
        localStorage.setItem(key, JSON.stringify(existingData));
    } else {
        if (typeof data === 'string') {
            localStorage.setItem(key, data);
        } else {
            localStorage.setItem(key, JSON.stringify(data));
        }
    }
}

// Setup Footer UI
// Configures footer buttons based on current page context
function setupFooterButtons(currentPage) {
    const footerLeftButton = document.getElementById('footerLeftButton');
    const footerRightButton = document.getElementById('footerRightButton');
    footerLeftButton.style.visibility = 'show';

    if (footerLeftButton && footerRightButton) {
        if (currentPage === 'launchlist') {
            footerLeftButton.textContent = 'Launch';
            footerLeftButton.onclick = () => {
                js.F.launchApp();
            };
            footerLeftButton.disabled = true;
        } else if (currentPage === 'databasecontrol') {
            footerLeftButton.textContent = 'Save';
            footerLeftButton.onclick = async () => {
                if (js.F.showSaveDialog) {
                    js.F.setData('tempData', window.tempData);
                    await js.F.showSaveDialog();
                }
            };
            footerLeftButton.disabled = true;
        } else if (currentPage === 'themes') {
            footerLeftButton.textContent = 'Apply';
            footerLeftButton.onclick = () => {
                if (js.F.applySelectedTheme) {
                    js.F.applySelectedTheme();
                }
            };
            footerLeftButton.disabled = true;
        } else if (currentPage === 'configuration') {
            footerLeftButton.textContent = 'Save';
            footerLeftButton.onclick = async () => {
                await js.F.saveConfiguration();
            };
            footerLeftButton.disabled = true;
        } else if (currentPage === 'logging') {
            footerLeftButton.style.visibility = 'hidden';
        }
        if (footerLeftButton.disabled === true) {
            footerLeftButton.classList.add('disabled');
        }
        footerRightButton.textContent = 'Exit';
        footerRightButton.onclick = js.F.exitApp;
    }
}

// Setup Header UI
// Configures navigation buttons and manages state transitions properly
function setupHeaderNavigation(currentPage) {
    const headerButtons = document.querySelectorAll('#headerContainer button');
    headerButtons.forEach(button => {
        const destination = button.textContent.toLowerCase().replace(' ', '');
        
        if (destination === currentPage) {
            button.disabled = true;
        } else {
            button.disabled = false;
            const firstRun = window.xldbv?.firstRun ?? 0;
            if (destination === 'launchlist' && firstRun !== 0) {
                button.disabled = true;
            }
            
            button.addEventListener('click', () => {
                if (currentPage === 'databasecontrol') {
                    const saveButton = document.getElementById('footerLeftButton');
                    if (saveButton && !saveButton.disabled) {
                        js.F.showConfirmDialog(destination)
                        return;
                    }
                }
                js.F.navigateTo(destination);
                setupFooterButtons(destination);
            });
        }
    });

    setupSearch(currentPage === 'launchlist');
}

// Setup Search UI
// Initializes search functionality with animation and auto-hide
function setupSearch(isEnabled) {
    const searchContainer = document.querySelector('.search-container');
    const searchWrapper = document.querySelector('.search-wrapper');
    const searchInput = document.getElementById('searchInput');
    const iconCircle = document.querySelector('.icon-circle');
    let isExpanded = false;
    let searchTimeout;

    if (!isEnabled) {
        searchContainer.classList.add('disabled');
        return;
    }

    function performSearch() {
        const searchTerm = searchInput.value;
        const filteredRows = js.F.filterRows(searchTerm);
        const { mainRowsPerPage } = js.F.getRowVariables();
        js.F.createTable(1, mainRowsPerPage, false, filteredRows);
        js.F.updatePagination(false, filteredRows);
    }

    function expandSearch() {
        isExpanded = true;
        searchWrapper.style.width = '180px';
        searchInput.style.width = '140px';
        searchInput.style.opacity = '1';
        searchInput.focus();
        resetSearchTimeout();
    }

    function shrinkSearch() {
        isExpanded = false;
        searchWrapper.style.width = '24px';
        searchInput.style.width = '0';
        searchInput.style.opacity = '0';
        searchInput.value = '';
        performSearch();
    }

    function resetSearchTimeout() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(shrinkSearch, 120000);
    }

    // Toggles search bar expansion
    iconCircle.addEventListener('click', () => {
        if (isExpanded) {
            shrinkSearch();
        } else {
            expandSearch();
        }
    });

    // Performs search as user types
    searchInput.addEventListener('input', debounce(() => {
        performSearch();
        resetSearchTimeout();
    }, 300));

    // Resets search timeout on focus
    searchInput.addEventListener('focus', resetSearchTimeout);
}

// Update Favorites
// Saves current favorites state to xldbf.json
async function updateFavoritesOnExit() {
    const xldbfData = js.F.getData('xldbf');
    try {
        const baseDir = await e.Api.invoke('get-app-dir');
        const utilsDir = dirVar('utils');
        const xldbfPath = js.F.joinPath(baseDir, utilsDir, 'xldbf.json');

        if (!xldbfData || typeof xldbfData !== 'object') {
            return false;
        }

        const cleanedXldbfData = {
            favourites: Array.isArray(xldbfData.favourites) 
                ? xldbfData.favourites.filter(item => typeof item === 'string')
                : [],
            recent: Array.isArray(xldbfData.recent)
                ? xldbfData.recent.filter(item => typeof item === 'string')
                : []
        };

        if (cleanedXldbfData.favourites.length === 0 && cleanedXldbfData.recent.length === 0) {
            return false;
        }

        const result = await e.Api.invoke('update-favs', xldbfPath, cleanedXldbfData);
        
        if (!result) {
            throw new Error('Failed to update xldbf.json');
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

// Update Function List
// Adds window functions to js.F namespace for global access
function updateJsF() {
    for (const key in window) {
        if (typeof window[key] === 'function' && !js.F[key]) {
            js.F[key] = window[key];
        }
    }
}

// Update Variables
// Saves current variables state to xldbv.json
async function updateVariablesOnExit() {
    const xldbvData = js.F.getData('xldbv');
    try {
        const baseDir = await e.Api.invoke('get-app-dir');
        const utilsDir = dirVar('utils');
        const xldbvPath = js.F.joinPath(baseDir, utilsDir, 'xldbv.json');

        if (!validateXldbvJson(xldbvData)) {
            throw new Error('Invalid xldbv.json structure');
        }
        const xldbvResult = await e.Api.invoke('update-vars', xldbvPath, xldbvData);
        if (!xldbvResult) {
            throw new Error('Failed to save xldbv.json');
        }
        return true;
    } catch (error) {
        return false;
    }
}

// Validate Config
// Validates the structure and content of xldbv.json configuration
function validateXldbvJson(data) {
    if (typeof data !== 'object' || data === null) {
        return false;
    }

    const allowedTopLevelKeys = new Set([
        'version', 'config', 'logfile', 'mainXLFC', 'uurl',
        'favourite_symbols', 'firstRun', 'directories', 'rows',
        'configOpts', 'loadScripts', 'xldbFiles'
    ]);

    for (const key of Object.keys(data)) {
        if (!allowedTopLevelKeys.has(key)) {
            return false;
        }
    }

    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(data.version)) {
        return false;
    }

    const requiredStringFields = [
        'version', 'config', 'logfile', 'mainXLFC', 'uurl'
    ];
    for (const field of requiredStringFields) {
        if (typeof data[field] !== 'string') {
            return false;
        }
    }

    if (typeof data.favourite_symbols !== 'string') {
        return false;
    }

    if (typeof data.firstRun !== 'number' || ![0, 1, 2].includes(data.firstRun)) {
        return false;
    }

    // Updated directory validation
    if (!data.directories || typeof data.directories !== 'object') {
        return false;
    }

    const requiredDirectories = {
        xldb: 'string',
        help: 'string',
        utils: {
            root: 'string',
            update: 'string'
        },
        scripts: 'string',
        includes: {
            root: 'string',
            dialogs: 'string'
        },
        themes: {
            root: 'string',
            base: 'string',
            compiled: 'string'
        }
    };

    // Validate directory structure
    for (const [key, value] of Object.entries(requiredDirectories)) {
        if (!data.directories[key]) {
            return false;
        }
        if (typeof value === 'string') {
            if (typeof data.directories[key] !== 'string') {
                return false;
            }
        } else if (typeof value === 'object') {
            if (typeof data.directories[key] !== 'object') {
                return false;
            }
            for (const [subKey, subType] of Object.entries(value)) {
                if (typeof data.directories[key][subKey] !== subType) {
                    return false;
                }
            }
        }
    }

    // Rest of validation remains the same
    if (!data.rows || typeof data.rows !== 'object') {
        return false;
    }
    const allowedRowKeys = new Set(['main', 'edit']);
    for (const key of Object.keys(data.rows)) {
        if (!allowedRowKeys.has(key) || typeof data.rows[key] !== 'number') {
            return false;
        }
    }

    const { configOpts } = data;
    if (!configOpts || typeof configOpts !== 'object') {
        return false;
    }

    const allowedConfigOptsKeys = new Set(['system', 'triggercmd', 'updates', 'theme']);
    for (const key of Object.keys(configOpts)) {
        if (!allowedConfigOptsKeys.has(key)) {
            return false;
        }
    }

    const requiredSystemKeys = new Set([
        'show', 
        'minimizeTo', 
        'closeTo', 
        'startWithWindows',
        'startMinimized'
    ]);
    if (!configOpts.system || typeof configOpts.system !== 'object') {
        return false;
    }
    for (const key of Object.keys(configOpts.system)) {
        if (!requiredSystemKeys.has(key) || typeof configOpts.system[key] !== 'boolean') {
            return false;
        }
    }
    if (Object.keys(configOpts.system).length !== requiredSystemKeys.size) {
        return false;
    }

    const requiredTriggerCmdKeys = new Set(['overwriteFile', 'addCommands', 'autoGenerate', 'inPath']);
    if (!configOpts.triggercmd || typeof configOpts.triggercmd !== 'object') {
        return false;
    }
    for (const key of Object.keys(configOpts.triggercmd)) {
        if (!requiredTriggerCmdKeys.has(key)) {
            return false;
        }
    }
    if (!['keep', 'overwrite'].includes(configOpts.triggercmd.overwriteFile) ||
        !['all', 'favourited'].includes(configOpts.triggercmd.addCommands) ||
        typeof configOpts.triggercmd.autoGenerate !== 'boolean' ||
        typeof configOpts.triggercmd.inPath !== 'boolean') {
        return false;
    }

    if (!configOpts.updates || typeof configOpts.updates !== 'object') {
        return false;
    }
    const allowedUpdateKeys = new Set(['autoCheck', 'periodic']);
    for (const key of Object.keys(configOpts.updates)) {
        if (!allowedUpdateKeys.has(key)) {
            return false;
        }
    }
    if (typeof configOpts.updates.autoCheck !== 'boolean') {
        return false;
    }
    if (!configOpts.updates.periodic || typeof configOpts.updates.periodic !== 'object') {
        return false;
    }
    const allowedPeriodicKeys = new Set(['enable', 'interval']);
    for (const key of Object.keys(configOpts.updates.periodic)) {
        if (!allowedPeriodicKeys.has(key)) {
            return false;
        }
    }
    if (typeof configOpts.updates.periodic.enable !== 'boolean' ||
        typeof configOpts.updates.periodic.interval !== 'number' ||
        configOpts.updates.periodic.interval < 1 || 
        configOpts.updates.periodic.interval > 24) {
        return false;
    }

    const requiredThemeKeys = new Set(['favourite', 'currentTheme', 'rowSelector', 'rowWidth']);
    if (!configOpts.theme || typeof configOpts.theme !== 'object') {
        return false;
    }
    for (const key of Object.keys(configOpts.theme)) {
        if (!requiredThemeKeys.has(key)) {
            return false;
        }
    }
    if (typeof configOpts.theme.favourite !== 'string' ||
        typeof configOpts.theme.currentTheme !== 'string' ||
        typeof configOpts.theme.rowSelector !== 'string' ||
        typeof configOpts.theme.rowWidth !== 'number' ||
        configOpts.theme.rowWidth < 50 || 
        configOpts.theme.rowWidth > 100) {
        return false;
    }

    if (!Array.isArray(data.loadScripts) || !Array.isArray(data.xldbFiles)) {
        return false;
    }

    return true;
}

// Write File Data
// Writes content to specified file path with error handling
async function writeFile(filePath, content) {
    try {
        const result = await e.Api.invoke('write-file', filePath, content);
        if (!result) {
            throw new Error('Failed to write file');
        }
    } catch (error) {
    }
}

// Fetch Remote File
// Retrieves file content from URL with error handling
async function fetchFile(url, responseType = 'json') {
    try {
        const response = await e.Api.invoke('fetch-url', url, responseType);
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        return response.data;
    } catch (error) {
        throw new Error(`Failed to fetch file: ${error.message}`);
    }
}

// Get Version Info
// Retrieves version information from update server
async function getVersionInfo() {
    const uurl = window.xldbv.uurl;
    return await fetchFile(`${uurl}/version.json`);
}

// Get Directory Path
// Returns directory path from window.xldbv.directories with proper nesting and fallbacks
function dirVar(...args) {
    let result = '';
    
    // Ensure window.xldbv is loaded
    if (!window.xldbv) {
        window.xldbv = js.F.getData('xldbv');
    }
    
    if (!args.length) {
        return '';
    }
    
    const section = args[0];
    const path = window.xldbv?.directories?.[section];
    
    // Handle non-nested directory
    if (args.length === 1) {
        if (typeof path === 'string') {
            result = path;
        } else if (path?.root) {
            result = path.root;
        } else {
            result = section;
        }
        return result;
    }
    
    // Handle nested directory
    if (typeof path === 'object') {
        const parts = [];
        
        // If we have a root and this isn't just a root request, add it first
        if (path.root && args[1] !== 'root') {
            parts.push(path.root);
        }
        
        // Add any requested nested paths
        for (let i = 1; i < args.length; i++) {
            const nestedPath = path[args[i]] || args[i];
            parts.push(nestedPath);
        }
        
        result = parts.join('/');
        return result;
    }
    
    // Fallback for invalid/missing configuration
    result = args.join('/');
    return result;
}

// Handles F1 key press for help documentation
document.addEventListener('keydown', (event) => {
    if (event.key === 'F1') {
        event.preventDefault();
        openHelpFile();
    }
});

// Saves application state before window closes
e.Api.on('app-closing', async () => {
    await js.F.exitApp();
});

// Initializes title bar after DOM content loads
document.addEventListener('DOMContentLoaded', () => {
    loadTitleBar();
});

// Export common functions
window.commonFunctions = {
    debounce,
    dirVar,
    exitApp,
    getData,
    getRowVariables,
    joinPath,
    lazyLoadScript,
    loadTitleBar,
    navigateTo,
    openHelpFile,
    removeFile,
    setData,
    setupFooterButtons,
    setupHeaderNavigation,
    updateJsF
};