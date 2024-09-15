// Test update Common.js

// General utility functions

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
        const variablesUpdated = await updateVariablesOnExit();
        const favoritesUpdated = await updateFavoritesOnExit();

        if (!variablesUpdated || !favoritesUpdated) {
        }
    } catch (error) {
    } finally {
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

// Create full path
// Generates a full file path
function getFullPath(appDir, directory, fileName) {
    return joinPath(appDir, directory, fileName);
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
    return parts.join('/').replace(/\/+/g, '/');
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
// Fetches and sets up the titlebar HTML
async function loadTitleBar() {
    try {
        const response = await fetch('include/titlebar.html');
        const titlebarHtml = await response.text();
        document.body.insertAdjacentHTML('afterbegin', titlebarHtml);

        document.querySelector('.minimize-button').addEventListener('click', () => {
            e.Api.invoke('minimize-window');
        });
        document.querySelector('.maximize-button').addEventListener('click', () => {
            e.Api.invoke('maximize-window');
        });
        document.querySelector('.close-button').addEventListener('click', () => {
            e.Api.invoke('close-window');
        });
    } catch (error) {
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
            break;
        default:
    }
}

// Remove file
// Deletes a file at the specified path
async function removeFile(filePath) {
    try {
        const result = await e.Api.invoke('remove-file', filePath);
        if (!result) {
            throw new Error('Failed to remove file');
        }
    } catch (error) {
    }
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

    if (footerLeftButton && footerRightButton) {
        if (currentPage === 'launchlist') {
            footerLeftButton.textContent = 'Launch';
            footerLeftButton.onclick = () => {
                if (js.F.launchApp) {
                    js.F.launchApp();
                }
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
                js.F.applySelectedTheme();
            };
            footerLeftButton.disabled = true;
        } else if (currentPage === 'configuration') {
            footerLeftButton.textContent = 'Save';
            footerLeftButton.onclick = async () => {
                if (js.F.saveConfiguration) {
                    await js.F.saveConfiguration();
                }
            };
            footerLeftButton.disabled = true;
        } else if (currentPage === 'logging') {
            footerLeftButton.textContent = '';
            footerLeftButton.onclick = () => {
                window.location.href = 'main.html';
            };
            footerLeftButton.disabled = false;
        }
        if (footerLeftButton.disabled === true) {
            footerLeftButton.classList.add('disabled');
        }
        footerRightButton.textContent = 'Exit';
        footerRightButton.onclick = js.F.exitApp;
    }
}

// Set up navigation
// Adds click event listeners to header buttons
function setupHeaderNavigation(currentPage) {
    const headerButtons = document.querySelectorAll('#headerContainer button');
    headerButtons.forEach(button => {
        const destination = button.textContent.toLowerCase().replace(' ', '');
        
        if (destination === currentPage) {
            button.disabled = true;
        } else {
            button.disabled = false;
            button.addEventListener('click', () => {
                navigateTo(destination);
                setupFooterButtons(destination);
            });
        }
    });

    setupSearch(currentPage === 'launchlist');
}

// Setup search functionality
// Configures the search input and behavior
function setupSearch(isEnabled) {
    const searchContainer = document.querySelector('.search-container');
    const searchWrapper = document.querySelector('.search-wrapper');
    const searchInput = document.getElementById('searchInput');
    const iconCircle = document.querySelector('.icon-circle');
    let isExpanded = false;

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

    iconCircle.addEventListener('click', () => {
        isExpanded = !isExpanded;
        if (isExpanded) {
            searchWrapper.style.width = '180px';
            searchInput.style.width = '140px';
            searchInput.style.opacity = '1';
            searchInput.focus();
        } else {
            searchWrapper.style.width = '24px';
            searchInput.style.width = '0';
            searchInput.style.opacity = '0';
            searchInput.value = '';
            performSearch();
        }
    });

    searchInput.addEventListener('input', debounce(performSearch, 300));
}

// Update favorites on exit
// Saves the current state of xldbf
async function updateFavoritesOnExit() {
    const xldbfData = js.F.getData('xldbf');
    try {
        const xldbv = js.F.getData('xldbv');
        const utilsDir = xldbv.directories.utils;
        const xldbfPath = js.F.getFullPath(utilsDir, 'xldbf.json');

        if (!xldbfData || typeof xldbfData !== 'object') {
            console.error('Invalid xldbf data:', xldbfData);
            return false;
        }

        // Ensure xldbfData is in the correct format
        const cleanedXldbfData = Object.fromEntries(
            Object.entries(xldbfData)
                .filter(([key, value]) => typeof key === 'string' && typeof value === 'boolean')
        );

        if (Object.keys(cleanedXldbfData).length === 0) {
            console.error('No valid favorites data to save');
            return false;
        }

        const xldbfResult = await e.Api.invoke('update-favs', xldbfPath, cleanedXldbfData);
        if (!xldbfResult) {
            throw new Error('Failed to save xldbf.json');
        }
        console.log('Favorites saved successfully:', cleanedXldbfData);
        return true;
    } catch (error) {
        console.error('Error updating favorites:', error);
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
        const utilsDir = xldbvData.directories.utils;
        const xldbvPath = js.F.getFullPath(utilsDir, 'xldbv.json');

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

    // Add version to the required string fields
    const requiredStringFields = ['version', 'config', 'logfile', 'mainCSV', 'favourite'];
    const requiredObjectFields = ['directories', 'rows', 'configOpts'];
    const requiredArrayFields = ['xldbFiles', 'loadScripts'];

    for (const field of requiredStringFields) {
        if (typeof data[field] !== 'string') {
            return false;
        }
    }

    // Validate version format (optional, but recommended)
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(data.version)) {
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

    // Validate the configOpts section
    const configOptsValidValues = {
        aupd: ['on', 'off', true, false],
        tcag: ['on', 'off', true, false],
        tcuo: ['keep', 'overwrite'],
        tcao: ['all', 'favourited'],
        inPath: [true, false]
    };

    if (!data.configOpts) {
        return false;
    }

    for (const [field, validValues] of Object.entries(configOptsValidValues)) {
        if (!(field in data.configOpts)) {
            // Set a default value
            if (field === 'inPath') {
                data.configOpts[field] = false;
            } else {
                data.configOpts[field] = field === 'aupd' || field === 'tcag' ? 'off' : validValues[0];
            }
        } else if (field === 'aupd' || field === 'tcag') {
            // Special handling for aupd and tcag
            if (typeof data.configOpts[field] === 'boolean') {
                // Convert boolean to string
                data.configOpts[field] = data.configOpts[field] ? 'on' : 'off';
            } else if (typeof data.configOpts[field] !== 'string' || !validValues.includes(data.configOpts[field])) {
                data.configOpts[field] = 'off';
            }
        } else if (field === 'inPath') {
            // Special handling for inPath
            if (typeof data.configOpts[field] !== 'boolean') {
                data.configOpts[field] = false;
            }
        } else {
            if (typeof data.configOpts[field] !== 'string' || !validValues.includes(data.configOpts[field])) {
                data.configOpts[field] = validValues[0];
            }
        }
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
    } catch (error) {
    }
}

// Export common functions
window.commonFunctions = {
    debounce,
    exitApp,
    getData,
    getFullPath,
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