// Core Global State Module
//   Manages global state, configuration, and centralized variable management
//   Provides centralized state management system with getters and setters
//   Handles dynamic loading of configuration submodules from config directory
//   Exports configuration objects for dialogs, buttons, sections, operations, and events

// Configuration module references
let configModules = {};

// Centralized Global State
//   Provides structured state management for application-wide variables
//   Defines application state structure with app, database, config, theme, ui, update, and data sections
export const AppState = {
    app: {
        currentSection: null,
        isInitialized: false,
        selectedApp: null
    },
    database: {
        currentCategory: null,
        categories: [],
        selectedRow: null,
        tempData: {}
    },
    config: {
        activePanel: null,
        sectionTemp: null,
        configTemp: null,
        currentSectionTemp: null,
        baseStates: {},
        tempStates: {},
        xlaunchConfig: null
    },
    theme: {
        themes: [],
        currentTheme: null,
        selectedTheme: null
    },
    ui: {
        domCacheName: null,
        footerMessageFadeTimer: null
    },
    update: {
        state: null,
        lastFile: null,
        progressHandler: null
    },
    data: {
        rowInfo: []
    }
};

// Initialize Configuration Modules
//   Loads all configuration modules using the application's directory structure
//   Dynamically imports all config submodules and assigns them to global xlp namespace
export async function initializeConfigModules() {
    const appDir = await e.Api.invoke('get-app-dir');
    
    configModules.defaults = await import(`${appDir}/files/js/config/xlp.defaults.js`);
    configModules.buttons = await import(`${appDir}/files/js/config/xlp.buttons.js`);
    configModules.dialogs = await import(`${appDir}/files/js/config/xlp.dialogs.js`);
    configModules.window = await import(`${appDir}/files/js/config/xlp.window.js`);
    configModules.sections = await import(`${appDir}/files/js/config/xlp.sections.js`);
    configModules.operations = await import(`${appDir}/files/js/config/xlp.operations.js`);
    configModules.events = await import(`${appDir}/files/js/config/xlp.events.js`);
    
    Object.assign(xlp, {
        sections: configModules.defaults.sections,
        configDefaults: configModules.defaults.configDefaults,
        greenButtonConfig: configModules.buttons.greenButtonConfig,
        databaseControlButtonConfig: configModules.buttons.databaseControlButtonConfig,
        dialogConfig: configModules.dialogs.dialogConfig,
        windowActionConfig: configModules.window.windowActionConfig,
        configSectionConfig: configModules.sections.configSectionConfig,
        sectionUIConfig: configModules.sections.sectionUIConfig,
        sectionUpdateConfig: configModules.sections.sectionUpdateConfig,
        databaseOperationConfig: configModules.operations.databaseOperationConfig,
        globalEventListenerConfig: configModules.events.globalEventListenerConfig,
        databasecontrolEventListenerConfig: configModules.events.databasecontrolEventListenerConfig,
        launchlistEventListenerConfig: configModules.events.launchlistEventListenerConfig,
        configurationEventListenerConfig: configModules.events.configurationEventListenerConfig,
        getEventListenerConfig: configModules.events.getEventListenerConfig
    });
}

// Delete Temp Data Entry
//   Removes a specific entry from tempData by fileName
//   Deletes temp data entry from window.tempData object
export function deleteTempData(fileName) {
    if (window.tempData) {
        delete window.tempData[fileName];
    }
}

// DOM Element Retriever
//   Gets element from cache or DOM with fallback support for multiple query types
//   Supports getElementById, querySelector, querySelectorAll, and relative queries with context
export function getElement(typeOrId, selector, contextElement) {
    if (!typeOrId) return null;
    
    const domCacheName = getState('ui.domCacheName');
    
    if (selector === undefined && contextElement === undefined) {
        return domCacheName && window[domCacheName]?.[typeOrId] || document.getElementById(typeOrId);
    }
    
    const type = typeOrId.toLowerCase();
    
    switch (type) {
        case 'id':
            return domCacheName && window[domCacheName]?.[selector] || document.getElementById(selector);
        case 'dqs':
            return document.querySelector(selector);
        case 'dqa':
            return document.querySelectorAll(selector);
        case 'rqs':
            if (!contextElement) return null;
            return contextElement.querySelector(selector);
        case 'rqa':
            if (!contextElement) return null;
            return contextElement.querySelectorAll(selector);
        default:
            return domCacheName && window[domCacheName]?.[typeOrId] || document.getElementById(typeOrId);
    }
}

// State Getter
//   Retrieves state value using dot notation path
//   Traverses AppState object using dot notation to retrieve nested state values
export function getState(path) {
    if (!path) return null;
    const keys = path.split('.');
    let value = AppState;
    for (const key of keys) {
        value = value?.[key];
        if (value === undefined) return undefined;
    }
    return value;
}

// Get Temp Data Entry
//   Retrieves a specific entry from tempData by fileName
//   Returns temp data entry from window.tempData object
export function getTempData(fileName) {
    return window.tempData?.[fileName];
}

// Initialize Global State
//   Sets up initial state values and maintains backward compatibility
//   Copies window.xldbv, window.xldbf, and window.state values to AppState
export function initializeGlobalState() {
    if (window.xldbv) {
        AppState.data.xldbv = window.xldbv;
    }
    if (window.xldbf) {
        AppState.data.xldbf = window.xldbf;
    }
    if (window.state) {
        AppState.app.currentSection = window.state.currentSection;
        AppState.app.isInitialized = window.state.isInitialized;
    }
}

// State Reset
//   Clears state section or entire state structure
//   Resets specified section or all sections to empty objects
export function resetState(section) {
    if (section) {
        if (AppState[section]) {
            AppState[section] = {};
        }
    } else {
        Object.keys(AppState).forEach(key => {
            AppState[key] = {};
        });
    }
}

// State Setter
//   Sets state value using dot notation path with optional validation
//   Traverses AppState object using dot notation to set nested state values
export function setState(path, value) {
    if (!path) return false;
    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = AppState;
    for (const key of keys) {
        if (!target[key] || typeof target[key] !== 'object') {
            target[key] = {};
        }
        target = target[key];
    }
    target[lastKey] = value;
    return true;
}

// Set Temp Data Entry
//   Sets a specific entry in tempData by fileName
//   Updates or creates temp data entry in window.tempData object
export function setTempData(fileName, value) {
    if (!window.tempData) {
        window.tempData = {};
    }
    window.tempData[fileName] = value;
}
