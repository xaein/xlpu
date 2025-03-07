// Core Application Module
// Manages application state, sections, and resource loading

// Application state management
let state = {
    currentSection: null,
    sections: new Map(),
    loadedResources: new Set(),
    isInitialized: false
};
window.state = state;

// Core application sections
const coreSections = [
    'initialization',
    'welcome',
    'launchlist',
    'databasecontrol',
    'themes',
    'configuration',
    'logging'
];

// Section navigation flows
const sectionFlow = {
    firstRun: ['initialization', 'welcome', 'databasecontrol'],
    secondRun: ['initialization', 'databasecontrol'],
    normal: ['initialization', 'launchlist']
};

// Application Initialization
// Initializes core modules and sets up application environment
export async function initialize() {
    if (state.isInitialized) {
        return;
    }
    
    try {
        window.onerror = xlp.handleError;
        await xlp.loadScript('core.c');
        await xlp.loadScript('m.init');
        const appDir = await e.Api.invoke('get-app-dir');
        xlp.updateCurrentFile('Loading Variables');
        const xldbvPath = `${appDir}/utils/xldbv.json`;
        const { data: xldbvData } = await e.Api.invoke('get-file', xldbvPath);
        if (!xldbvData) {
            throw new Error('Failed to load xldbv.json');
        }
        try {
            const xldbv = JSON.parse(xldbvData);
            localStorage.setItem('xldbv', xldbvData);
            window.xldbv = xldbv;
        } catch (error) {
            throw new Error('Failed to parse xldbv.json');
        }
        const coreScripts = window.xldbv?.coreScripts || [];
        await Promise.all(
            coreScripts.map(script => xlp.loadScript(script))
        );
        xlp.generateHeaderButtons();
        xlp.setupEventDelegation();
        if (xlp.setupResizeListeners) {
            xlp.setupResizeListeners();
        }
        if (xlp.initializeSysTray) {
            await xlp.initializeSysTray();
        }
        xlp.showSection('initialization');
        try {
            const loaderHtml = await xlp.loadSectionHtml('s', 'loader');
            document.getElementById('loaderContainer').innerHTML = loaderHtml;
        } catch (error) {
        }
        const isFirstRun = await xlp.initializeFiles();
        let flow;
        if (isFirstRun === 1) {
            flow = sectionFlow.firstRun;
        } else if (isFirstRun === 2) {
            flow = sectionFlow.secondRun;
        } else {
            flow = sectionFlow.normal;
        }
        const nextSection = flow[1];
        if (nextSection === 'welcome') {
            await xlp.showSection(nextSection);
        } else {
            await xlp.loadSection(nextSection);
        }
        state.isInitialized = true;
    } catch (error) {
        xlp.handleError('Initialization failed', error);
    }
}

// Directory Path Resolution
// Resolves directory paths based on configuration and section
export function dirVar(...args) {
    let result = '';
    if (!window.xldbv) {
        window.xldbv = xlp.getData('xldbv');
    }
    if (!args.length) {
        return '';
    }
    const section = args[0];
    const path = window.xldbv?.directories?.[section];
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
    if (typeof path === 'object') {
        const parts = [];
        if (path.root && args[1] !== 'root') {
            parts.push(path.root);
        }
        for (let i = 1; i < args.length; i++) {
            const nestedPath = path[args[i]] || args[i];
            parts.push(nestedPath);
        }
        result = parts.join('/');
        return result;
    }
    result = args.join('/');
    return result;
}

// Event System Setup
// Configures application-wide event listeners and handlers
export function setupEventDelegation() {
    // Title bar buttons using delegation
    document.querySelectorAll('.titlebar-button').forEach(button => {
        button.addEventListener('click', (event) => {
            const action = event.target.closest('button').classList[1]?.replace('-button', '');
            if (action) xlp.handleTitleBarAction(action);
        });
    });

    // Welcome section start button
    if (window.xldbv?.firstRun === 1) {
        const startButton = document.getElementById('start-button');
        if (startButton) {
            startButton.addEventListener('click', () => {
                window.xldbv.firstRun = 2;
                xlp.setData('xldbv', window.xldbv);
                xlp.loadSection('databasecontrol');
            });
        }
    }

    // F1 help key handler
    document.addEventListener('keydown', (event) => {
        if (event.key === 'F1') {
            event.preventDefault();
            xlp.openHelpFile();
        }
    });

    // Footer buttons
    const footerLeftButton = document.getElementById('footerLeftButton');
    if (footerLeftButton) {
        footerLeftButton.addEventListener('click', handleGreenButtonClick);
    }

    const footerRightButton = document.getElementById('footerRightButton');
    if (footerRightButton) {
        footerRightButton.addEventListener('click', () => {
            xlp.exitApp();
        });
    }
}

// Title Bar Handler
// Processes window control actions from the title bar
export async function handleTitleBarAction(action) {
    switch (action) {
        case 'minimize':
            await e.Api.invoke('minimize-window');
            break;
        case 'maximize':
            await e.Api.invoke('maximize-window');
            break;
        case 'close':
            await xlp.exitApp();
            break;
        case 'help':
            await xlp.openHelpFile();
            break;
    }
}

// Green Button Handler
// Processes actions for the footer left button based on current section
export function handleGreenButtonClick() {
    switch (window.state.currentSection) {
        case 'launchlist':
            if (window.selectedApp) {
                xlp.handleLaunch();
            }
            break;
        case 'databasecontrol':
            xlp.saveDatabase();
            break;
        case 'themes':
            xlp.applySelectedTheme();
            break;
        case 'configuration':
            xlp.saveConfiguration();
            break;
    }
}

// Script Loading
// Imports and attaches module exports to xlp namespace
export async function loadScript(name) {
    try {
        const module = await import(`./xlp.${name}.js`);
        Object.assign(xlp, module);
        return true;
    } catch (error) {
        throw new Error(`Failed to load script xlp.${name}.js: ${error.message}`);
    }
}

// Script Unloading
// Removes module exports from xlp namespace and resources
export async function unloadScript(name) {
    try {
        const module = await import(`./xlp.${name}.js`);
        Object.keys(module).forEach(key => {
            delete xlp[key];
        });
        state.loadedResources.delete(name);
    } catch (error) {
    }
}

// Section Style Loading
// Loads and attaches section-specific style resources
export async function loadSectionStyles(section) {
    if (section.styles && section.styles.length > 0) {
        const appDir = await e.Api.invoke('get-app-dir');
        const themesDir = `${appDir}/files/${xlp.dirVar('themes', 'compiled')}`;
        
        const stylePromises = section.styles.map(async style => {
            const stylePath = `${themesDir}/s.${style}.css`;
            await xlp.loadStyle(stylePath);
            state.loadedResources.add(`style:${style}`);
        });
        
        await Promise.all(stylePromises);
    }
}

// Section Script Loading
// Loads and attaches section-specific JavaScript modules
export async function loadSectionScripts(section) {
    if (section.scripts && section.scripts.length > 0) {
        const scriptPromises = section.scripts.map(async script => {
            const scriptKey = `script:${script}`;
            if (!state.loadedResources.has(scriptKey)) {
                try {
                    await xlp.loadScript(script);
                    state.loadedResources.add(scriptKey);
                } catch (error) {
                    throw error;
                }
            }
        });
        
        await Promise.all(scriptPromises);
    }
}

// Resource Availability Check
// Verifies section resources are loaded and ready
export function waitForSectionResources(sectionId) {
    const section = xlp.sections[sectionId];
    if (!section) {
        return Promise.reject(new Error(`Section ${sectionId} not found`));
    }

    return new Promise((resolve) => {
        const mainTemplate = document.querySelector(`.${section.templates.main}`);
        if (!mainTemplate) {
            return;
        }

        const areStylesLoaded = section.styles.every(style => {
            const styleLoaded = Array.from(document.styleSheets).some(sheet => {
                try {
                    return sheet.href?.includes(`s.${style}.css`);
                } catch (e) {
                    return false;
                }
            });
            
            const element = document.querySelector(`.${style}`);
            const computedStyle = element ? window.getComputedStyle(element).display : 'none';
            
            return styleLoaded && element && computedStyle !== '';
        });
        
        if (!areStylesLoaded) {
            return;
        }

        const mainScript = section.scripts[section.scripts.length - 1];
        const scriptName = mainScript.replace(/^m\./, '');
        const initFunctionName = `initialize${scriptName.charAt(0).toUpperCase()}${scriptName.slice(1)}`;
        const isLoaded = typeof xlp[initFunctionName] === 'function';
        
        if (!isLoaded) {
            return;
        }

        resolve();
    });
}

// Section Loading
// Loads and initializes a new application section
export async function loadSection(sectionId) {
    try {
        if (state.currentSection === sectionId) {
            return;
        }

        if (sectionId === 'initialization' || sectionId === 'welcome') {
            await xlp.showSection(sectionId);
            return;
        }

        if (!coreSections.includes(sectionId)) {
            throw new Error(`Invalid section: ${sectionId}`);
        }

        const section = xlp.sections[sectionId];
        if (!section) {
            throw new Error(`Section ${sectionId} not found`);
        }

        if (state.currentSection === 'databasecontrol') {
            const preloadedData = xlp.getData('preloadedData') || {};
            if (window.tempData && JSON.stringify(preloadedData) !== JSON.stringify(window.tempData)) {
                const shouldSave = await xlp.showDatabaseChangeDialog();
                if (shouldSave) {
                    await xlp.showDialog('databasecontrolsave');
                    await xlp.saveAllData();
                    xlp.closeDialog('databasecontrolconfirm');
                } else {
                    xlp.closeDialog('databasecontrolconfirm');
                }
            }
        }
        else if (state.currentSection === 'configuration') {
            if (xlp.hasUnsavedChanges()) {
                const shouldSave = await xlp.showConfigChangeDialog(state.currentSection);
                if (shouldSave) {
                    await xlp.saveConfiguration();
                    xlp.closeDialog('configchange');
                } else {
                    xlp.closeDialog('configchange');
                }
            }
        }

        if (state.currentSection !== sectionId) {
            await xlp.unloadSection(state.currentSection);
        }

        try {
            const html = await xlp.loadSectionHtml('s', sectionId);
            const dynamicContent = document.getElementById('dynamicContent');
            dynamicContent.innerHTML = html;
            dynamicContent.classList.remove('hidden');

            if (section.templates?.dialogs) {
                const dialogPromises = section.templates.dialogs.map(async dialogId => {
                    try {
                        const dialogHtml = await xlp.loadSectionHtml('d', dialogId);
                        const dialogContainer = document.getElementById('dialogContainer');
                        if (!dialogContainer) {
                            return;
                        }
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = dialogHtml;
                        const dialogElement = tempDiv.firstElementChild;
                        if (dialogElement) {
                            const existingDialog = document.getElementById(dialogElement.id);
                            if (existingDialog) {
                                existingDialog.remove();
                            }
                            dialogContainer.appendChild(dialogElement);
                        }
                    } catch (error) { }
                });
                await Promise.all(dialogPromises);
            }

            await loadSectionStyles(section);
            await loadSectionScripts(section);
            await waitForSectionResources(sectionId);

            const initFunctionName = `initialize${sectionId.charAt(0).toUpperCase()}${sectionId.slice(1)}`;
            if (xlp[initFunctionName]) {
                await xlp[initFunctionName]();
            }
       
            state.currentSection = sectionId;
            state.sections.set(sectionId, section);
            xlp.updateUI(section);

        } catch (error) {
            xlp.handleError(`Failed to load section ${sectionId}`, error);
        }
    } catch (error) {
        xlp.handleError(`Failed to load section ${sectionId}`, error);
    }
}

// Section Style Cleanup
// Removes section-specific style resources
export async function unloadSectionStyles(section) {
    if (section.styles && section.styles.length > 0) {
        const appDir = await e.Api.invoke('get-app-dir');
        const themesDir = `${appDir}/files/${xlp.dirVar('themes', 'compiled')}`;
        
        for (const style of section.styles) {
            await xlp.unloadStyle(`${themesDir}/s.${style}.css`);
            state.loadedResources.delete(`style:${style}`);
        }
    }
}

// Section Script Cleanup
// Removes section-specific JavaScript modules
export async function unloadSectionScripts(section) {
    const coreScripts = window.xldbv?.coreScripts || [];
    
    if (section.scripts && section.scripts.length > 0) {
        for (const script of section.scripts) {
            if (!coreScripts.includes(script)) {
                const scriptKey = `script:${script}`;
                await xlp.unloadScript(script);
                state.loadedResources.delete(scriptKey);
            }
        }
    }
}

// Section Unloading
// Cleans up and removes an active section
export async function unloadSection(sectionId) {
    try {
        if (sectionId === 'initialization' || sectionId === 'welcome') {
            document.getElementById(`${sectionId}Section`)?.classList.add('hidden');
            
            if (sectionId === 'initialization') {
                await xlp.unloadScript('init');
            }
            
            const header = document.getElementById('headerContainer');
            const footer = document.querySelector('.footer');
            header?.classList.remove('hidden');
            footer?.classList.remove('hidden');
            
            return;
        }

        const section = state.sections.get(sectionId) || xlp.sections[sectionId];
        if (!section) {
            return;
        }

        const cleanupFunctionName = `cleanup${sectionId.charAt(0).toUpperCase()}${sectionId.slice(1)}`;
        if (xlp[cleanupFunctionName]) {
            await xlp[cleanupFunctionName]();
        }

        await unloadSectionScripts(section);
        await unloadSectionStyles(section);

        document.getElementById('dynamicContent').innerHTML = '';

        state.sections.delete(sectionId);

    } catch (error) {
        xlp.handleError(`Failed to unload section ${sectionId}`, error);
    }
}

// Resource Loading
// Loads all required section resources
export async function loadSectionResources(section) {
    if (section.styles && section.styles.length > 0) {
        const appDir = await e.Api.invoke('get-app-dir');
        const themesDir = `${appDir}/files/${xlp.dirVar('themes', 'compiled')}`;
        for (const style of section.styles) {
            await xlp.loadStyle(`${themesDir}/s.${style}.css`);
            state.loadedResources.add(`style:${style}`);
        }
    }

    if (section.scripts && section.scripts.length > 0) {
        for (const script of section.scripts) {
            const scriptKey = `script:${script}`;
            if (!state.loadedResources.has(scriptKey)) {
                try {
                    const module = await import(`./xlp.${script}.js`);
                    Object.assign(xlp, module);
                    state.loadedResources.add(scriptKey);
                } catch (error) {
                    throw error;
                }
            }
        }
    }
}

// Resource Cleanup
// Unloads all section resources
export async function unloadSectionResources(section) {
    const coreScripts = window.xldbv?.coreScripts || [];
    
    if (section.styles && section.styles.length > 0) {
        const appDir = await e.Api.invoke('get-app-dir');
        const themesDir = `${appDir}/files/${xlp.dirVar('themes', 'compiled')}`;
        for (const style of section.styles) {
            await xlp.unloadStyle(`${themesDir}/s.${style}.css`);
            state.loadedResources.delete(`style:${style}`);
        }
    }

    if (section.scripts && section.scripts.length > 0) {
        for (const script of section.scripts) {
            if (!coreScripts.includes(script)) {
                const scriptKey = `script:${script}`;
                await xlp.unloadScript(script);
                state.loadedResources.delete(scriptKey);
            }
        }
    }
}

// Style Loading
// Loads external stylesheet using file protocol
export async function loadStyle(href) {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `file://${href}`;
        link.onload = () => resolve();
        link.onerror = () => reject(new Error(`Failed to load style: ${href}`));
        document.head.appendChild(link);
    });
}

// Style Removal
// Removes stylesheet from document
export function unloadStyle(href) {
    const links = document.querySelectorAll(`link[href="file://${href}"]`);
    links.forEach(link => link.remove());
}

// UI State Update
// Updates interface elements based on section state
export function updateUI(section) {
    document.title = `xLauncher Plus v${window.xldbv.version}`;

    const header = document.getElementById('headerContainer');
    const footer = document.querySelector('.footer');

    if (state.currentSection === 'initialization' || state.currentSection === 'welcome') {
        header?.classList.add('hidden');
        footer?.classList.add('hidden');
    } else {
        header?.classList.remove('hidden');
        footer?.classList.remove('hidden');

        const footerLeftButton = document.getElementById('footerLeftButton');
        if (footerLeftButton) {
            const buttonConfig = section?.footerButtons?.left;
            if (buttonConfig) {
                footerLeftButton.textContent = buttonConfig.text;
                footerLeftButton.disabled = !buttonConfig.enabled;
                footerLeftButton.style.visibility = buttonConfig.visible ? 'visible' : 'hidden';
                footerLeftButton.classList.toggle('disabled', !buttonConfig.enabled);
            }
        }

        // Update header buttons state
        document.querySelectorAll('.header-buttons button').forEach(button => {
            const buttonSection = Object.entries(xlp.sections).find(([_, s]) => s.label === button.textContent)?.[0];
            if (buttonSection) {
                button.classList.toggle('active', buttonSection === state.currentSection);
                button.disabled = buttonSection === state.currentSection;
            }
        });
    }
}

// Section Display
// Shows or hides sections based on current state
export function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });

    let section;
    if (sectionId === 'initialization' || sectionId === 'welcome') {
        section = document.getElementById(`${sectionId}Section`);
    } else {
        section = document.getElementById('dynamicContent');
    }

    if (section) {
        section.classList.remove('hidden');
    }

    const header = document.getElementById('headerContainer');
    const footer = document.querySelector('.footer');

    if (sectionId === 'initialization' || sectionId === 'welcome') {
        header?.classList.add('hidden');
        footer?.classList.add('hidden');
    } else {
        header?.classList.remove('hidden');
        footer?.classList.remove('hidden');
    }

    state.currentSection = sectionId;
}

// Storage Retrieval
// Gets and parses data from localStorage
export function getData(key, fileName = null) {
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

// Storage Update
// Stores data in localStorage with optional partitioning
export function setData(key, data, fileName = null) {
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

// HTML Content Loading
// Loads section HTML content from file
export async function loadSectionHtml(type, name) {
    try {
        const includeDir = xlp.dirVar('include');
        const url = `${includeDir}/xlp.${type}.${name}.html`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load section HTML: ${response.statusText}`);
        }
        const text = await response.text();
        return text;
    } catch (error) {
        throw new Error(`Failed to load section HTML: ${error.message}`);
    }
}

// Header Button Generation
// Creates section navigation buttons based on sections configuration
export function generateHeaderButtons() {
    const headerButtons = document.querySelector('.header-buttons');
    if (!headerButtons) return;
    
    headerButtons.innerHTML = '';
    
    Object.entries(xlp.sections).forEach(([sectionId, section]) => {
        const button = document.createElement('button');
        button.className = `header-button ${sectionId}-button`;
        button.textContent = section.label;
        button.addEventListener('click', () => xlp.loadSection(sectionId));
        button.classList.toggle('active', sectionId === state.currentSection);
        
        // Disable button if it's the current section
        button.disabled = sectionId === state.currentSection;
        
        // Specifically disable Launch List during setup
        if (sectionId === 'launchlist' && section.label === 'Launch List' && window.xldbv?.firstRun === 2) {
            button.disabled = true;
            button.style.opacity = '0.5';
            button.style.cursor = 'not-allowed';
        }
        
        headerButtons.appendChild(button);
    });
}

// Error Handler
// Displays error messages in status container
export function handleError(message, error) {
    const statusMessage = document.getElementById('statusMessage');
    if (statusMessage) {
        statusMessage.textContent = `Error: ${message}`;
        statusMessage.classList.add('error');
    }
}

// Section State Verification
// Verifies and sets correct section state based on DOM
export function verifyAndSetSection() {
    const dynamicContent = document.getElementById('dynamicContent');
    if (!dynamicContent || dynamicContent.children.length === 0) return;

    const firstChild = dynamicContent.children[0];
    const sectionClass = firstChild.className;

    const sectionId = Object.entries(xlp.sections).find(
        ([_, section]) => section.templates?.main === sectionClass
    )?.[0];

    if (sectionId && state.currentSection !== sectionId) {
        state.currentSection = sectionId;
        updateUI(xlp.sections[sectionId]);
        xlp.updateGreenButtonState();
    }
}
