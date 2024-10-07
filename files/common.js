// General utility functions

let updateCheckInterval;

// Debounce function
// Limits the rate of function calls
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Exit application
// Saves current state and exits the application
async function exitApp() {
    setData('xldbv', window.xldbv);
    setData('xldbf', window.xldbf);

    try {
        await updateVariablesOnExit();
        await updateFavoritesOnExit();
    } finally {
        setData('updateAvailable', false);
        e.Api.send('toMain', 'exit');
    }
}

// Get data
// Retrieves data from localStorage, optionally parsing JSON
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

// Get row variables
// Retrieves main and edit rows per page
function getRowVariables() {
    const variables = js.F.getData('xldbv') || {};

    return {
        mainRowsPerPage: variables.rows?.main || 20,
        editRowsPerPage: variables.rows?.edit || 10,
    };
}

// Join path
// Combines path segments and removes duplicate slashes
function joinPath(...parts) {
    return parts.join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
}

// Lazy load script
// Dynamically loads a JavaScript file
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

// Load title bar
// Fetches and sets up the titlebar HTML or updates existing titlebar
async function loadTitleBar() {
    try {
        let titlebarContainer = document.querySelector('.titlebar-container');
        
        // Remove the existing titlebar if it exists
        if (titlebarContainer) {
            titlebarContainer.remove();
        }

        // Create and append the new titlebar
        const response = await fetch('include/titlebar.html');
        const titlebarHtml = await response.text();
        
        // Create a temporary container
        const temp = document.createElement('div');
        temp.innerHTML = titlebarHtml;
        
        // Append the new titlebar to the body
        document.body.insertAdjacentElement('afterbegin', temp.firstElementChild);
        
        titlebarContainer = document.querySelector('.titlebar-container');
        
        // Set up event listeners for titlebar buttons
        document.querySelector('.help-button')?.addEventListener('click', () => {
            openHelpFile();
        });

        document.querySelector('.minimize-button')?.addEventListener('click', () => {
            e.Api.invoke('minimize-window');
        });
        document.querySelector('.maximize-button')?.addEventListener('click', () => {
            e.Api.invoke('maximize-window');
        });
        document.querySelector('.close-button')?.addEventListener('click', () => {
            e.Api.invoke('close-window');
        });

        // Update the title text
        const windowTitle = document.querySelector('.titlebar .window-title');
        if (windowTitle) {
            let titleText = 'xLauncher Plus';
            const updateAvailable = js.F.getData('updateAvailable');
            if (updateAvailable) {
                titleText += ' (Update Available)';
            } 
            
            windowTitle.textContent = titleText;
            windowTitle.style.display = 'none';
            windowTitle.offsetHeight;
            windowTitle.style.display = '';
        }
    } catch (error) {
        console.error('Error loading titlebar:', error);
    }
}

// Navigation function
// Redirects to the appropriate page
function navigateTo(destination) {
    switch (destination) {
        case 'launchlist':
            window.location.href = 'main.html';
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

// Open help file
// Opens the xlauncher_plus_help.html file in the default browser
function openHelpFile() {
    const helpFilePath = 'help/xlauncher_plus_help.html'; // Update this path as needed
    e.Api.invoke('open-external', helpFilePath);
}

// Remove file
// Deletes a file at the specified path
async function removeFile(filePath) {
    try {
        const result = await e.Api.invoke('remove-file', filePath);
        if (!result) {
            throw new Error('Failed to remove file');
        }
    } catch {}
}

// Set data
// Stores data in localStorage
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

// Setup footer buttons
// Configures footer buttons based on the current page
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
                } else {
                    
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

// Setup header navigation
// Configures navigation buttons and handles unsaved changes in database control
function setupHeaderNavigation(currentPage) {
    const headerButtons = document.querySelectorAll('#headerContainer button');
    headerButtons.forEach(button => {
        const destination = button.textContent.toLowerCase().replace(' ', '');
        
        if (destination === currentPage) {
            button.disabled = true;
        } else {
            button.disabled = false;
            
            // Disable Launch List button if firstRun is not 0
            if (destination === 'launchlist' && window.xldbv.firstRun !== 0) {
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

// Setup periodic update check
// Configures the interval for periodic update checks
function setupPeriodicUpdateCheck() {
    // Check if periodic update check has already been set up
    if (js.F.getData('periodicUpdate') === true) {
        
        return;
    }

    const xldbvData = js.F.getData('xldbv');
    if (!xldbvData || !xldbvData.configOpts || !xldbvData.configOpts.updates) {
        
        return;
    }

    const updateConfig = xldbvData.configOpts.updates;
    if (updateConfig.periodic.enable) {
        const intervalHours = updateConfig.periodic.interval;
        const intervalMs = intervalHours * 60 * 60 * 1000;
        updateCheckInterval = setInterval(() => {
            if (typeof js.F.checkForUpdates === 'function') {
                js.F.checkForUpdates(true);
            } else {
                
            }
        }, intervalMs);
        
        
        // Mark that periodic update check has been set up
        js.F.setData('periodicUpdate', true);
    } else {
        
    }
}

// Setup search functionality
// Configures the search input and behavior
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

    iconCircle.addEventListener('click', () => {
        if (isExpanded) {
            shrinkSearch();
        } else {
            expandSearch();
        }
    });

    searchInput.addEventListener('input', debounce(() => {
        performSearch();
        resetSearchTimeout();
    }, 300));

    // Reset timeout when user focuses on the input
    searchInput.addEventListener('focus', resetSearchTimeout);
}

// Update favorites on exit
// Saves the current state of xldbf
async function updateFavoritesOnExit() {
    const xldbfData = js.F.getData('xldbf');
    try {
        const baseDir = await e.Api.invoke('get-app-dir');
        const xldbv = js.F.getData('xldbv');
        const utilsDir = xldbv.directories.utils;
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

// Update js.F object
// Adds functions from the window object to js.F
function updateJsF() {
    for (const key in window) {
        if (typeof window[key] === 'function' && !js.F[key]) {
            js.F[key] = window[key];
        }
    }
}

// Update variables on exit
// Saves the current state of xldbv
async function updateVariablesOnExit() {
    
    const xldbvData = js.F.getData('xldbv');
    
    try {
        const baseDir = await e.Api.invoke('get-app-dir');
        
        const utilsDir = xldbvData.directories.utils;
        
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

// Validate xldbv.json structure
// Checks if the xldbv data object is valid
function validateXldbvJson(data) {
    
    

    if (typeof data !== 'object' || data === null) {
        
        return false;
    }

    const requiredStringFields = [
        'version', 'config', 'logfile', 'mainXLFC', 'uurl', 'favourite', 'currentTheme'
    ];
    const requiredObjectFields = ['directories', 'rows', 'configOpts'];
    const requiredArrayFields = ['loadScripts', 'xldbFiles'];

    for (const field of requiredStringFields) {
        if (typeof data[field] !== 'string') {
            
            return false;
        }
    }

    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(data.version)) {
        
        return false;
    }

    if (typeof data.firstRun !== 'number' || ![0, 1, 2].includes(data.firstRun)) {
        
        return false;
    }

    for (const field of requiredObjectFields) {
        if (typeof data[field] !== 'object' || data[field] === null) {
            
            return false;
        }
    }

    for (const field of requiredArrayFields) {
        if (!Array.isArray(data[field])) {
            
            return false;
        }
    }

    const requiredDirectories = ['utils', 'xldb', 'themes', 'loadScripts'];
    for (const dir of requiredDirectories) {
        if (typeof data.directories[dir] !== 'string') {
            
            return false;
        }
    }

    if (typeof data.rows.main !== 'number' || typeof data.rows.edit !== 'number') {
        
        return false;
    }

    // Validate configOpts
    const { configOpts } = data;
    if (!configOpts || typeof configOpts !== 'object') {
        
        return false;
    }

    // Ensure configOpts only contains the expected objects and remove any unexpected properties
    const expectedConfigOpts = ['tray', 'triggercmd', 'updates'];
    for (const key in configOpts) {
        if (!expectedConfigOpts.includes(key)) {
            
            delete configOpts[key];
        }
    }

    // Validate tray options
    if (!configOpts.tray || typeof configOpts.tray !== 'object') {
        
        return false;
    }

    const trayOptions = ['show', 'minimizeTo', 'closeTo'];
    for (const option of trayOptions) {
        if (typeof configOpts.tray[option] !== 'boolean') {
            
            
            return false;
        }
    }

    // Validate triggercmd options
    if (!configOpts.triggercmd || typeof configOpts.triggercmd !== 'object') {
        
        return false;
    }

    const triggerCmdOptions = {
        overwriteFile: ['keep', 'overwrite'],
        addCommands: ['all', 'favourited'],
        autoGenerate: [true, false],
        inPath: [true, false]
    };
    for (const [option, validValues] of Object.entries(triggerCmdOptions)) {
        if (!validValues.includes(configOpts.triggercmd[option])) {
            
            
            return false;
        }
    }

    // Validate update options
    if (!configOpts.updates || typeof configOpts.updates !== 'object') {
        
        return false;
    }

    if (typeof configOpts.updates.autoCheck !== 'boolean' ||
        typeof configOpts.updates.periodic !== 'object' ||
        typeof configOpts.updates.periodic.enable !== 'boolean' ||
        typeof configOpts.updates.periodic.interval !== 'number') {
        
        
        return false;
    }

    
    return true;
}

// Write file
// Writes content to a file at the specified path
async function writeFile(filePath, content) {
    try {
        const result = await e.Api.invoke('write-file', filePath, content);
        if (!result) {
            throw new Error('Failed to write file');
        }
    } catch {}
}

        
// Add event listener for F1 key press
document.addEventListener('keydown', (event) => {
    if (event.key === 'F1') {
        event.preventDefault();
        openHelpFile();
    }
});

// Handle app closing event
e.Api.on('app-closing', async () => {
    await js.F.exitApp();
});

// Load title bar when DOM is fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    loadTitleBar();
    setupPeriodicUpdateCheck();
});

// Export common functions
window.commonFunctions = {
    debounce,
    exitApp,
    getData,
    getRowVariables,
    joinPath,
    lazyLoadScript,
    loadTitleBar,
    navigateTo,
    removeFile,
    setData,
    setupFooterButtons,
    setupHeaderNavigation,
    updateFavoritesOnExit,
    updateJsF,
    updateVariablesOnExit,
    validateXldbvJson,
    writeFile
};