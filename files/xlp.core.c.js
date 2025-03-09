// Core App Functions Module
// Provides core utilities and section definitions for application

// Section configuration definitions
export const sections = {
    launchlist: {
        label: 'Launch List',
        styles: ['launchlist'],
        templates: {
            main: 'launchlist',
            dialogs: ['launch']
        },
        scripts: ['m.tables', 'm.launchlist'],
        footerButtons: {
            left: {
                text: 'Launch',
                enabled: false,
                visible: true
            }
        }
    },
    databasecontrol: {
        label: 'Database Control',
        styles: ['databasecontrol'],
        templates: {
            main: 'databasecontrol',
            dialogs: [
                'databasecontrolcatadd', 'databasecontrolcatremove', 'databasecontrolcatrename',
                'databasecontrolrowadd', 'databasecontrolrowremove', 'databasecontrolrowedit',
                'databasecontrolconfirm', 'databasecontrolsave'
            ]
        },
        scripts: ['m.tables', 'm.databasecontrol.s', 'm.databasecontrol'],
        footerButtons: {
            left: {
                text: 'Save',
                enabled: false,
                visible: true
            }
        }
    },
    themes: {
        label: 'Themes',
        styles: ['themes'],
        templates: {
            main: 'themes',
            dialogs: ['themeimport', 'themedelete', 'themeapply']
        },
        scripts: ['m.themes'],
        footerButtons: {
            left: {
                text: 'Apply',
                enabled: false,
                visible: true
            }
        }
    },
    configuration: {
        label: 'Configuration',
        styles: ['configuration'],
        templates: {
            main: 'configuration',
            dialogs: ['configsave', 'configchange']
        },
        scripts: ['m.configuration.u', 'm.configuration'],
        footerButtons: {
            left: {
                text: 'Save',
                enabled: false,
                visible: true
            }
        }
    },
    logging: {
        label: 'Logging',
        styles: ['logging'],
        templates: {
            main: 'logging'
        },
        scripts: ['m.logging'],
        footerButtons: {
            left: {
                text: '',
                enabled: false,
                visible: false
            }
        }
    }
};

// Path Combination
// Joins and normalizes file paths for cross-platform use
export function joinPath(...parts) {
    return parts.join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
}

// Function Throttling
// Prevents rapid function calls by enforcing delay period
export function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Application Exit
// Saves state and performs cleanup before application shutdown
export async function exitApp() {
    console.log('exitApp: Starting application exit process');
    xlp.setData('xldbv', window.xldbv);
    xlp.setData('xldbf', window.xldbf);

    let hasXldbu = false;
    let hasUpdtmp = false;

    try {
        console.log('exitApp: Getting base directory and utils directory');
        const baseDir = await e.Api.invoke('get-app-dir');
        const utilsDir = xlp.dirVar('utils');
        console.log('exitApp: Base directory:', baseDir);
        console.log('exitApp: Utils directory:', utilsDir);

        if (xlp.validateXldbvJson(window.xldbv)) {
            console.log('exitApp: Saving xldbv.json');
            const xldbvPath = xlp.joinPath(baseDir, utilsDir, 'xldbv.json');
            const xldbvResult = await e.Api.invoke('update-vars', xldbvPath, window.xldbv);
            if (!xldbvResult) {
                console.error('exitApp: Failed to save xldbv.json');
                throw new Error('Failed to save xldbv.json');
            }
            console.log('exitApp: Successfully saved xldbv.json');
        } else {
            console.error('exitApp: Invalid xldbv.json structure');
            throw new Error('Invalid xldbv.json structure');
        }
        
        const cleanedXldbfData = xlp.validateXldbfJson(window.xldbf);
        if (cleanedXldbfData) {
            console.log('exitApp: Saving xldbf.json');
            const xldbfPath = xlp.joinPath(baseDir, utilsDir, 'xldbf.json');
            const xldbfResult = await e.Api.invoke('update-favs', xldbfPath, cleanedXldbfData);
            if (!xldbfResult) {
                console.error('exitApp: Failed to update xldbf.json');
                throw new Error('Failed to update xldbf.json');
            }
            console.log('exitApp: Successfully saved xldbf.json');
        } else {
            console.error('exitApp: Invalid xldbf.json structure');
            throw new Error('Invalid xldbf.json structure');
        }

        // Check for updates
        console.log('exitApp: Checking for updates');
        const xldbuPath = xlp.joinPath(baseDir, utilsDir, 'xldbu.json');
        const updtmpPath = xlp.joinPath(baseDir, utilsDir, 'updtmp');
        
        console.log('exitApp: Constructed paths:', {
            xldbuPath,
            updtmpPath
        });
        
        try {
            hasXldbu = await e.Api.invoke('file-exists', xldbuPath);
            console.log('exitApp: xldbu.json check result:', hasXldbu);
        } catch (err) {
            console.error('exitApp: Error checking xldbu.json:', err);
        }

        try {
            // Check directory contents - will return [] if directory doesn't exist
            const updtmpContents = await e.Api.invoke('read-directory', updtmpPath);
            console.log('exitApp: updtmp directory contents:', updtmpContents);
            hasUpdtmp = Array.isArray(updtmpContents) && updtmpContents.length > 0;
            console.log('exitApp: updtmp has contents:', hasUpdtmp);
        } catch (err) {
            console.error('exitApp: Error checking updtmp directory:', err);
        }
        
        console.log('exitApp: Final check results:', {
            xldbuExists: hasXldbu,
            updtmpExists: hasUpdtmp
        });
        
        if (hasXldbu || hasUpdtmp) {
            console.log('exitApp: Updates found, checking for new xlu.exe');
            // Check for new xlu.exe in updtmp/utils
            const newXluPath = xlp.joinPath(updtmpPath, 'utils', 'xlu.exe');
            const hasNewXlu = await e.Api.invoke('file-exists', newXluPath);
            
            console.log('exitApp: New xlu.exe exists:', hasNewXlu);
            if (hasNewXlu) {
                console.log('exitApp: Copying new xlu.exe');
                // Copy new xlu.exe to utils directory
                const currentXluPath = xlp.joinPath(baseDir, utilsDir, 'xlu.exe');
                await e.Api.invoke('copy-file', newXluPath, currentXluPath);
                console.log('exitApp: Successfully copied new xlu.exe');
            }
        }

        console.log('exitApp: Cleaning up localStorage');
        const keysToKeep = ['updateAvailable'];
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!keysToKeep.includes(key)) {
                localStorage.removeItem(key);
            }
        }
        xlp.setData('updateAvailable', false);
    } catch (error) {
        console.error('exitApp: Error occurred:', error);
        throw error;
    } finally {
        console.log('exitApp: Sending exit signal to main process');
        // Run xlu.exe for update as the last operation without awaiting
        if (hasXldbu || hasUpdtmp) {
            console.log('exitApp: Running xlu.exe for update');
            e.Api.invoke('run-xlu', 'update');
            // Add a small delay to ensure xlu.exe has time to start
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        e.Api.send('toMain', 'exit');
    }
}


// File Writing
// Writes data to file system with error handling
export async function writeFile(filePath, content) {
    try {
        const result = await e.Api.invoke('write-file', filePath, content);
        if (!result) {
            throw new Error('Failed to write file');
        }
    } catch (error) {
        throw error;
    }
}

// Remote File Access
// Downloads file content from specified URL with type
export async function fetchFile(url, responseType = 'json') {
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

// Version Information
// Retrieves current version data from update server
export async function getVersionInfo() {
    const uurl = window.xldbv.uurl;
    return await fetchFile(`${uurl}/version.json`);
}

// Help Documentation
// Opens help documentation in system default browser
export function openHelpFile() {
    const helpDir = xlp.dirVar('help');
    const helpFilePath = `${helpDir}/xlauncher_plus_help.html`;
    e.Api.invoke('open-external', helpFilePath);
}

// Version Comparison
// Compares semantic versions to determine newer release
export function isNewerVersion(version1, version2) {
    const [major1, minor1, patch1] = version1.split('.').map(Number);
    const [major2, minor2, patch2] = version2.split('.').map(Number);
    
    return major2 > major1 || 
           (major2 === major1 && minor2 > minor1) ||
           (major2 === major1 && minor2 === minor1 && patch2 > patch1);
}

// SVG Selector Generation
// Creates and colors SVG selector for row highlighting
export async function generateRowSelectorSVG(svgPath, isConfig = false) {
    try {
        const appDir = await e.Api.invoke('get-app-dir');
        const themesDir = xlp.dirVar('themes');
        const fullPath = xlp.joinPath(appDir, 'files', themesDir, 'selectors', svgPath);
        const { data: svgContent } = await e.Api.invoke('get-file', fullPath);
        
        if (!svgContent) return null;

        const modifiedSvg = svgContent.replace(/currentColor/g, 'var(--main-table-hover-color)');
        return modifiedSvg;
    } catch (error) {
        return null;
    }
}

// Row Highlight Creation
// Generates highlight element for table row selection
export async function createRowHighlight(row) {
    const existingHighlight = row.querySelector('.row-highlight');
    if (existingHighlight) {
        existingHighlight.remove();
    }

    const highlight = document.createElement('div');
    highlight.className = 'row-highlight';
    highlight.style.position = 'absolute';
    highlight.style.top = '0';
    
    const highlightWidth = window.xldbv.configOpts?.theme?.rowWidth || 100;
    const leftOffset = (100 - highlightWidth) / 2;
    highlight.style.left = `${leftOffset}%`;
    highlight.style.width = `${highlightWidth}%`;
    highlight.style.height = '100%';
    highlight.style.pointerEvents = 'none';
    highlight.style.zIndex = '0';
    highlight.style.opacity = '0';
    highlight.style.transition = 'opacity 0.2s ease-in-out';

    const rowSelector = window.xldbv.configOpts?.theme?.rowSelector || 'rectangle';
    const svgContent = await generateRowSelectorSVG(`${rowSelector}.svg`);
    
    if (svgContent) {
        highlight.innerHTML = svgContent;
    } else {
        highlight.style.backgroundColor = 'var(--main-table-hover-color)';
    }

    row.style.position = 'relative';
    row.insertBefore(highlight, row.firstChild);

    row.addEventListener('mouseenter', () => {
        highlight.style.opacity = '1';
    });

    row.addEventListener('mouseleave', () => {
        if (!row.classList.contains('selected')) {
            highlight.style.opacity = '0';
        }
    });

    if (row.classList.contains('selected')) {
        highlight.style.opacity = '1';
        const svg = highlight.querySelector('svg');
        if (svg) {
            svg.innerHTML = svg.innerHTML.replace(/var\(--main-table-hover-color\)/g, 'var(--main-table-selected-color)');
        }
    }

    return highlight;
}

// Row Selection Update
// Updates interface elements for row selector changes
export function selectRowSelector(fileName, svgElement, customSelect, selectedValue, optionsContainer) {
    if (svgElement && customSelect && selectedValue) {
        selectedValue.innerHTML = '';
        selectedValue.appendChild(svgElement.cloneNode(true));
        customSelect.dataset.value = fileName;
        if (optionsContainer) {
            optionsContainer.classList.remove('show');
        }
        
        if (!window.currentSectionTemp) window.currentSectionTemp = {};
        if (!window.currentSectionTemp.theme) window.currentSectionTemp.theme = {};
        window.currentSectionTemp.theme.rowSelector = fileName;
        
        xlp.updateSaveButtonState();
    }
}

// Row Selector Setup
// Initializes row selector interface with available options
export async function loadRowSelectors() {
    try {
        const appDir = await e.Api.invoke('get-app-dir');
        const themesDir = xlp.dirVar('themes');
        const selectorsPath = xlp.joinPath(appDir, 'files', themesDir, 'selectors');
        const files = await e.Api.invoke('read-directory', selectorsPath);
        
        const svgFiles = files.filter(file => file.endsWith('.svg'));
        const customSelect = document.querySelector('.custom-select');
        const selectedValue = customSelect?.querySelector('.selected-value');
        const optionsContainer = customSelect?.querySelector('.options-container');
        
        if (customSelect && selectedValue && optionsContainer) {
            optionsContainer.innerHTML = '';
            
            for (const file of svgFiles) {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'option';
                const fileName = file.replace('.svg', '');
                optionDiv.dataset.value = fileName;
                
                const svgContent = await xlp.generateRowSelectorSVG(`${file}`);
                if (svgContent) {
                    const svgContainer = document.createElement('div');
                    svgContainer.innerHTML = svgContent;
                    optionDiv.appendChild(svgContainer.firstChild);
                    
                    if (!selectedValue.hasChildNodes()) {
                        selectRowSelector(fileName, svgContainer.firstChild, customSelect, selectedValue);
                    }
                    
                    optionDiv.addEventListener('click', async () => {
                        const newSvgContent = await xlp.generateRowSelectorSVG(`${file}`);
                        const newContainer = document.createElement('div');
                        newContainer.innerHTML = newSvgContent;
                        selectRowSelector(fileName, newContainer.firstChild, customSelect, selectedValue, optionsContainer);
                    });
                }
                
                optionsContainer.appendChild(optionDiv);
            }
            
            selectedValue.addEventListener('click', (e) => {
                e.stopPropagation();
                optionsContainer.classList.toggle('show');
            });
            
            document.addEventListener('click', () => {
                optionsContainer.classList.remove('show');
            });

            const savedSelector = window.xldbv.configOpts?.theme?.rowSelector || 'rectangle';
            if (savedSelector) {
                for (const option of optionsContainer.children) {
                    if (option.dataset.value === savedSelector) {
                        const svgElement = option.querySelector('svg');
                        if (svgElement) {
                            selectRowSelector(savedSelector, svgElement, customSelect, selectedValue);
                        }
                        break;
                    }
                }
            }
        }
    } catch (error) {
        return null;
    }
}

// Button State Management
// Updates footer button state based on section context
export function updateGreenButtonState() {
    const greenButton = document.getElementById('footerLeftButton');
    if (!greenButton) return;

    let shouldEnable = false;
    let buttonText = 'Launch';

    switch (window.state.currentSection) {
        case 'launchlist':
            shouldEnable = !!window.selectedApp;
            buttonText = 'Launch';
            break;
        case 'databasecontrol':
            const preloadedData = xlp.getData('preloadedData') || {};
            const isDifferent = JSON.stringify(preloadedData) !== JSON.stringify(window.tempData);
            shouldEnable = isDifferent;
            buttonText = 'Save';
            break;
        case 'themes':
            const isDifferentTheme = window.selectedTheme && window.selectedTheme !== window.currentTheme;
            shouldEnable = isDifferentTheme;
            buttonText = 'Apply';
            break;
        case 'configuration':
            shouldEnable = xlp.hasUnsavedChanges();
            buttonText = 'Save';
            break;
        default:
            shouldEnable = false;
            buttonText = 'Launch';
    }

    greenButton.disabled = !shouldEnable;
    greenButton.textContent = buttonText;
    greenButton.classList.toggle('disabled', !shouldEnable);
}