// Json Validation Module
//   Manages data validation and format conversion
//   Validates JSON structure for xldbv.json and xldbf.json files
//   Handles data cleaning and format standardization
//   Ensures data integrity and prevents invalid configurations

// Required Directory Structure
//   Defines expected directory structure for application files
//   Maps directory names to their paths including nested structures for utils and themes
const requiredDirectories = {
    xldb: "xldb",
    help: "help",
    utils: {
        root: "utils",
        update: "updtmp"
    },
    include: "sections",
    themes: {
        root: "themes",
        base: "base",
        compiled: "compiled"
    }
};

// Default Core Scripts
//   Defines list of core scripts loaded by default
//   Contains core.d, core.s, and core.w module names
const defaultCoreScripts = [
    "core.d",
    "core.s",
    "core.w"
];

// Allowed Top Level Keys
//   Defines valid top-level keys for xldbv.json structure
//   Set of allowed keys for validation and data integrity checks
const allowedTopLevelKeys = new Set([
    'version', 'config', 'logfile', 'mainXLFC', 'uurl',
    'favourite_symbols', 'updtico', 'firstRun', 'directories',
    'configOpts', 'coreScripts', 'xldbFiles'
]);

// Required String Fields
//   Defines mandatory string fields in xldbv.json
//   List of required fields that must be present and be string type
const requiredStringFields = [
    'version', 'config', 'logfile', 'mainXLFC', 'uurl'
];

// Configuration Validation Rules
//   Defines validation rules for configuration sections
//   Contains validation rules for system, triggercmd, updates, and theme configurations
const configValidation = {
    system: {
        keys: new Set(['show', 'minimizeTo', 'closeTo', 'startWithWindows', 'startMinimized', 'showLastLogInFooter', 'footerMessageDisplaySeconds']),
        types: {
            show: 'boolean',
            minimizeTo: 'boolean',
            closeTo: 'boolean',
            startWithWindows: 'boolean',
            startMinimized: 'boolean',
            showLastLogInFooter: 'boolean',
            footerMessageDisplaySeconds: {
                type: 'number',
                min: 1,
                max: 10
            }
        }
    },
    triggercmd: {
        keys: new Set(['overwriteFile', 'addCommands', 'autoGenerate', 'inPath']),
        validValues: {
            overwriteFile: ['keep', 'overwrite'],
            addCommands: ['all', 'favourited']
        }
    },
    updates: {
        autoCheck: 'boolean',
        periodic: {
            enable: 'boolean',
            interval: {
                type: 'number',
                min: 1,
                max: 24
            }
        }
    },
    theme: {
        keys: ['favourite', 'currentTheme', 'rowSelector', 'rowWidth'],
        types: {
            favourite: 'string',
            currentTheme: 'string',
            rowSelector: 'string',
            rowWidth: {
                type: 'number',
                min: 50,
                max: 100
            }
        }
    }
};

// Check File Format
//   Validates and converts data files to current specification
//   Converts xldbv.json or xldbf.json to current format and saves if changes were made
export async function conversionCheck(fileName, data) {
    let convertedData = data;

    try {
        if (fileName === 'xldbv.json') {
            convertedData = convertXldbv(data);
        } else if (fileName === 'xldbf.json') {
            convertedData = convertXldbf(data);
        }

        if (convertedData !== data) {
            const appDir = await e.Api.invoke('get-app-dir');
            const utilsDir = xlp.dirVar('utils');
            const filePath = xlp.joinPath(appDir, utilsDir, fileName);
            await e.Api.invoke('write-file', filePath, convertedData);
        }

        return convertedData;
    } catch (error) {
        return data;
    }
}

// Convert Favorites File
//   Transforms favorites data structure into current version format
//   Converts old favorites format to new structure with favourites and recent arrays
function convertXldbf(data) {
    if (!data || data.trim().length === 0) {
        return JSON.stringify({ favourites: [], recent: [] }, null, 2);
    }

    try {
        const parsedData = JSON.parse(data);
        
        if (!Array.isArray(parsedData.favourites)) {
            parsedData.favourites = Object.keys(parsedData).filter(key => parsedData[key] === true);
        }
        
        if (!Array.isArray(parsedData.recent)) {
            parsedData.recent = [];
        }

        return JSON.stringify({
            favourites: parsedData.favourites ?? [],
            recent: parsedData.recent ?? []
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ favourites: [], recent: [] }, null, 2);
    }
}

// Reorder Xldbv Keys
//   Reorders xldbv.json keys to match the correct format
//   Ensures keys are in the proper order: version, config, logfile, mainXLFC, uurl, favourite_symbols, updtico, firstRun, directories, configOpts, coreScripts, xldbFiles
export function reorderXldbvKeys(data) {
    if (typeof data !== 'object' || data === null) {
        return data;
    }

    const keyOrder = [
        'version',
        'config',
        'logfile',
        'mainXLFC',
        'uurl',
        'favourite_symbols',
        'updtico',
        'firstRun',
        'directories',
        'configOpts',
        'coreScripts',
        'xldbFiles'
    ];

    const directoriesOrder = ['xldb', 'help', 'utils', 'include', 'themes'];
    const themesOrder = ['root', 'base', 'compiled'];
    const utilsOrder = ['root', 'update'];
    const configOptsOrder = ['theme', 'system', 'triggercmd', 'updates'];

    const reordered = {};

    for (const key of keyOrder) {
        if (key in data) {
            if (key === 'directories' && typeof data[key] === 'object') {
                const dirReordered = {};
                for (const dirKey of directoriesOrder) {
                    if (dirKey in data[key]) {
                        if (dirKey === 'themes' && typeof data[key][dirKey] === 'object') {
                            const themesReordered = {};
                            for (const themeKey of themesOrder) {
                                if (themeKey in data[key][dirKey]) {
                                    themesReordered[themeKey] = data[key][dirKey][themeKey];
                                }
                            }
                            for (const themeKey in data[key][dirKey]) {
                                if (!themesOrder.includes(themeKey)) {
                                    themesReordered[themeKey] = data[key][dirKey][themeKey];
                                }
                            }
                            dirReordered[dirKey] = themesReordered;
                        } else if (dirKey === 'utils' && typeof data[key][dirKey] === 'object') {
                            const utilsReordered = {};
                            for (const utilKey of utilsOrder) {
                                if (utilKey in data[key][dirKey]) {
                                    utilsReordered[utilKey] = data[key][dirKey][utilKey];
                                }
                            }
                            for (const utilKey in data[key][dirKey]) {
                                if (!utilsOrder.includes(utilKey)) {
                                    utilsReordered[utilKey] = data[key][dirKey][utilKey];
                                }
                            }
                            dirReordered[dirKey] = utilsReordered;
                        } else {
                            dirReordered[dirKey] = data[key][dirKey];
                        }
                    }
                }
                for (const dirKey in data[key]) {
                    if (!directoriesOrder.includes(dirKey)) {
                        dirReordered[dirKey] = data[key][dirKey];
                    }
                }
                reordered[key] = dirReordered;
            } else if (key === 'configOpts' && typeof data[key] === 'object') {
                const configOptsReordered = {};
                for (const configKey of configOptsOrder) {
                    if (configKey in data[key]) {
                        configOptsReordered[configKey] = data[key][configKey];
                    }
                }
                for (const configKey in data[key]) {
                    if (!configOptsOrder.includes(configKey)) {
                        configOptsReordered[configKey] = data[key][configKey];
                    }
                }
                reordered[key] = configOptsReordered;
            } else {
                reordered[key] = data[key];
            }
        }
    }

    for (const key in data) {
        if (!keyOrder.includes(key)) {
            reordered[key] = data[key];
        }
    }

    return reordered;
}

// Convert Variables File
//   Transforms configuration variables into current version structure
//   Migrates old configuration format to new structure with configOpts and directories
function convertXldbv(data) {
    try {
        const variables = JSON.parse(data);

        if (!variables.updtico) {
            variables.updtico = "⥥";
        }

        if (!variables.configOpts) {
            variables.configOpts = {};
        }

        if (!variables.configOpts.system || typeof variables.configOpts.system !== 'object') {
            const traySettings = variables.configOpts.tray ?? {};
            variables.configOpts.system = {
                show: traySettings.show !== undefined ? traySettings.show : true,
                minimizeTo: traySettings.minimizeTo ?? false,
                closeTo: traySettings.closeTo ?? false,
                startWithWindows: false,
                startMinimized: false,
                showLastLogInFooter: false,
                footerMessageDisplaySeconds: 5
            };
            delete variables.configOpts.tray;
        }

        if (!variables.configOpts.triggercmd || typeof variables.configOpts.triggercmd !== 'object') {
            variables.configOpts.triggercmd = {
                overwriteFile: variables.tcuo || variables.configOpts.tcuo || 'keep',
                addCommands: variables.tcao || variables.configOpts.tcao || 'favourited',
                autoGenerate: variables.tcag === 'on' || variables.configOpts.tcag === 'on',
                inPath: variables.inPath ?? variables.configOpts.inPath ?? false
            };
            delete variables.tcuo;
            delete variables.tcao;
            delete variables.tcag;
            delete variables.inPath;
        }

        if (!variables.configOpts.updates || typeof variables.configOpts.updates !== 'object') {
            variables.configOpts.updates = {
                autoCheck: variables.aupd === 'on' || variables.configOpts.aupd === 'on' || true,
                periodic: {
                    enable: variables.configOpts?.periodic?.enable ?? false,
                    interval: variables.configOpts?.periodic?.interval || 24
                }
            };
            delete variables.aupd;
        }

        if (!variables.configOpts.theme || typeof variables.configOpts.theme !== 'object') {
            variables.configOpts.theme = {
                favourite: variables.favourite || variables.configOpts.favourite || '★',
                currentTheme: variables.currentTheme || variables.configOpts.currentTheme || 'green dark',
                rowSelector: variables.configOpts?.theme?.rowSelector || 'sword',
                rowWidth: variables.configOpts?.theme?.rowWidth || 80
            };
            delete variables.favourite;
            delete variables.currentTheme;
        }

        variables.directories = { ...requiredDirectories };

        if (Array.isArray(variables.loadScripts)) {
            variables.coreScripts = [...defaultCoreScripts];
            delete variables.loadScripts;
        }
        
        if (!Array.isArray(variables.coreScripts)) {
            variables.coreScripts = [...defaultCoreScripts];
        } else {
            variables.coreScripts = variables.coreScripts.filter(script => script !== 'core.v');
            if (variables.coreScripts.length === 0) {
                variables.coreScripts = [...defaultCoreScripts];
            }
        }

        if (variables.rows) {
            delete variables.rows;
        }

        if (!Array.isArray(variables.xldbFiles)) {
            variables.xldbFiles = [];
        }

        const reordered = reorderXldbvKeys(variables);
        return JSON.stringify(reordered, null, 2);
    } catch (error) {
        throw error;
    }
}

// System Config Check
//   Validates system configuration settings
//   Validates system config keys and types against configuration validation rules
function validateSystemConfig(system) {
    if (!system || typeof system !== 'object') return false;
    
    const { keys, types } = configValidation.system;
    for (const key of Object.keys(system)) {
        if (!keys.has(key)) return false;
        
        const typeSpec = types[key];
        if (typeof typeSpec === 'string') {
            if (typeof system[key] !== typeSpec) return false;
        } else if (typeof typeSpec === 'object' && typeSpec.type) {
            if (typeof system[key] !== typeSpec.type) return false;
            if (typeSpec.min !== undefined && system[key] < typeSpec.min) return false;
            if (typeSpec.max !== undefined && system[key] > typeSpec.max) return false;
        }
    }
    return true;
}

// Theme Config Check
//   Validates theme configuration settings
//   Validates theme config keys and types including rowWidth range validation
function validateThemeConfig(theme) {
    if (!theme || typeof theme !== 'object') return false;
    
    const { keys, types } = configValidation.theme;
    for (const key of keys) {
        const type = types[key];
        if (typeof type === 'string') {
            if (typeof theme[key] !== type) return false;
        } else {
            if (typeof theme[key] !== type.type || theme[key] < type.min || theme[key] > type.max) {
                return false;
            }
        }
    }
    return true;
}

// TriggerCmd Config Check
//   Validates trigger command configuration settings
//   Validates triggercmd config keys, valid values, and types against configuration rules
function validateTriggerCmdConfig(triggercmd) {
    if (!triggercmd || typeof triggercmd !== 'object') return false;
    
    const { keys, validValues } = configValidation.triggercmd;
    for (const key of Object.keys(triggercmd)) {
        if (!keys.has(key)) return false;
        
        if (key === 'overwriteFile' && !validValues.overwriteFile.includes(triggercmd[key])) return false;
        if (key === 'addCommands' && !validValues.addCommands.includes(triggercmd[key])) return false;
        if (['autoGenerate', 'inPath'].includes(key) && typeof triggercmd[key] !== 'boolean') return false;
    }
    return true;
}

// Updates Config Check
//   Validates update configuration settings
//   Validates updates config structure, autoCheck, and periodic interval settings
function validateUpdatesConfig(updates) {
    if (!updates || typeof updates !== 'object') return false;
    if (typeof updates.autoCheck !== 'boolean') return false;
    
    const { periodic } = updates;
    if (!periodic || typeof periodic !== 'object') return false;
    if (typeof periodic.enable !== 'boolean') return false;
    
    const { min, max } = configValidation.updates.periodic.interval;
    if (typeof periodic.interval !== 'number' || periodic.interval < min || periodic.interval > max) {
        return false;
    }
    return true;
}

// XLDBF Validation
//   Validates favorites file structure and content
//   Validates and cleans favourites and recent arrays, returns cleaned data or false
export function validateXldbfJson(data) {
    if (typeof data !== 'object' || data === null) {
        return false;
    }

    const cleanedData = {
        favourites: Array.isArray(data.favourites) 
            ? data.favourites.filter(item => typeof item === 'string')
            : [],
        recent: Array.isArray(data.recent)
            ? data.recent.filter(item => typeof item === 'string')
            : []
    };

    if (!Array.isArray(cleanedData.favourites) || !Array.isArray(cleanedData.recent)) {
        return false;
    }

    return cleanedData;
}

// Validate Config File
//   Verifies configuration file structure and data integrity rules
//   Validates top-level keys, version format, required fields, directories, and configOpts structure
export function validateXldbvJson(data) {
    if (typeof data !== 'object' || data === null) {
        return false;
    }

    for (const key of Object.keys(data)) {
        if (!allowedTopLevelKeys.has(key)) {
            return false;
        }
    }

    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(data.version)) {
        return false;
    }

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

    if (!data.directories || typeof data.directories !== 'object') {
        return false;
    }

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
            for (const [subKey, subValue] of Object.entries(value)) {
                if (typeof data.directories[key][subKey] !== 'string') {
                    return false;
                }
            }
        }
    }

    const { configOpts } = data;
    if (!configOpts || typeof configOpts !== 'object') {
        return false;
    }

    if (!validateSystemConfig(configOpts.system)) {
        return false;
    }

    if (!validateTriggerCmdConfig(configOpts.triggercmd)) {
        return false;
    }

    if (!validateUpdatesConfig(configOpts.updates)) {
        return false;
    }

    if (!validateThemeConfig(configOpts.theme)) {
        return false;
    }

    if (!Array.isArray(data.coreScripts)) {
        return false;
    }

    if (!Array.isArray(data.xldbFiles)) {
        return false;
    }

    return true;
}
