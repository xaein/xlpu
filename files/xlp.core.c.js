// Core Application Components
// Manages core utilities and configurations for the application

// Core section configuration
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

// Path Management System
// Combines and normalizes paths for consistent cross platform use
export function joinPath(...parts) {
    return parts.join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
}

// Function Delay Control
// Prevents rapid function execution by enforcing time delay period
export function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Application Exit Handler
// Saves application state and performs cleanup before shutting down
export async function exitApp() {
    xlp.setData('xldbv', window.xldbv);
    xlp.setData('xldbf', window.xldbf);

    let hasXldbu = false;
    let hasUpdtmp = false;

    try {
        const baseDir = await e.Api.invoke('get-app-dir');
        const utilsDir = xlp.dirVar('utils');

        if (xlp.validateXldbvJson(window.xldbv)) {
            const xldbvPath = xlp.joinPath(baseDir, utilsDir, 'xldbv.json');
            const xldbvResult = await e.Api.invoke('update-vars', xldbvPath, window.xldbv);
            if (!xldbvResult) {
                throw new Error('Failed to save xldbv.json');
            }
        } else {
            throw new Error('Invalid xldbv.json structure');
        }
        
        const cleanedXldbfData = xlp.validateXldbfJson(window.xldbf);
        if (cleanedXldbfData) {
            const xldbfPath = xlp.joinPath(baseDir, utilsDir, 'xldbf.json');
            const xldbfResult = await e.Api.invoke('update-favs', xldbfPath, cleanedXldbfData);
            if (!xldbfResult) {
                throw new Error('Failed to update xldbf.json');
            }
        } else {
            throw new Error('Invalid xldbf.json structure');
        }

        const xldbuPath = xlp.joinPath(baseDir, utilsDir, 'xldbu.json');
        const updtmpPath = xlp.joinPath(baseDir, utilsDir, 'updtmp');
        
        try {
            hasXldbu = await e.Api.invoke('file-exists', xldbuPath);
        } catch (error) { }

        try {
            const updtmpContents = await e.Api.invoke('read-directory', updtmpPath);
            hasUpdtmp = Array.isArray(updtmpContents) && updtmpContents.length > 0;
        } catch (error) { }
        
        if (hasXldbu || hasUpdtmp) {
            const newXluPath = xlp.joinPath(updtmpPath, 'utils', 'xlu.exe');
            const hasNewXlu = await e.Api.invoke('file-exists', newXluPath);
            
            if (hasNewXlu) {
                const currentXluPath = xlp.joinPath(baseDir, utilsDir, 'xlu.exe');
                await e.Api.invoke('copy-file', newXluPath, currentXluPath);
            }
        }

        const keysToKeep = ['updateAvailable'];
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!keysToKeep.includes(key)) {
                localStorage.removeItem(key);
            }
        }
        xlp.setData('updateAvailable', false);
    } catch (error) {
        throw error;
    } finally {
        if (hasXldbu || hasUpdtmp) {
            e.Api.invoke('run-xlu', 'update');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        e.Api.send('toMain', 'exit');
    }
}

// File System Writer
// Writes content to file system with comprehensive error handling
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

// Remote Content Fetcher
// Downloads and processes remote content with specified response type
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

// Version Data Retriever
// Fetches and returns current version information from update server
export async function getVersionInfo() {
    const uurl = window.xldbv.uurl;
    return await fetchFile(`${uurl}/version.json`);
}

// Documentation Display Handler
// Opens application help documentation in the default system browser
export function openHelpFile() {
    const helpDir = xlp.dirVar('help');
    const helpFilePath = `${helpDir}/xlauncher_plus_help.html`;
    e.Api.invoke('open-external', helpFilePath);
}

// Version Update Checker
// Compares version numbers to determine if update is needed
export function isNewerVersion(version1, version2) {
    const [major1, minor1, patch1] = version1.split('.').map(Number);
    const [major2, minor2, patch2] = version2.split('.').map(Number);
    
    return major2 > major1 || 
           (major2 === major1 && minor2 > minor1) ||
           (major2 === major1 && minor2 === minor1 && patch2 > patch1);
}

// SVG Generator Handler
// Creates and processes SVG selectors for row highlighting system
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

// Row Highlight Manager
// Creates and configures highlight elements for table row selection
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

// Selector Update Handler
// Updates interface elements when row selector choice is changed
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

// Row Selector Initializer
// Sets up and configures all available row selector options
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

// Button State Controller
// Updates footer button states based on current section context
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