// Json Validation Module
// Manages data validation and format conversion

// Initialize validation variables
const requiredDirectories = {
    xldb: 'string',
    help: 'string',
    utils: {
        root: 'string',
        update: 'string'
    },
    include: 'string',
    themes: {
        root: 'string',
        base: 'string',
        compiled: 'string'
    }
};

const defaultCoreScripts = [
    "window",
    "systray",
    "validation"
];

const allowedTopLevelKeys = new Set([
    'version', 'config', 'logfile', 'mainXLFC', 'uurl',
    'favourite_symbols', 'firstRun', 'directories',
    'configOpts', 'coreScripts', 'xldbFiles'
]);

const requiredStringFields = [
    'version', 'config', 'logfile', 'mainXLFC', 'uurl'
];

const configValidation = {
    system: {
        keys: new Set(['show', 'minimizeTo', 'closeTo', 'startWithWindows', 'startMinimized']),
        type: 'boolean'
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
// Validates and converts data files to current specification
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
// Transforms favorites data structure into current version format
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
            favourites: parsedData.favourites || [],
            recent: parsedData.recent || []
        }, null, 2);
    } catch (error) {
        return JSON.stringify({ favourites: [], recent: [] }, null, 2);
    }
}

// Convert Variables File
// Transforms configuration variables into current version structure
function convertXldbv(data) {
    try {
        const variables = JSON.parse(data);

        if (!variables.configOpts) {
            variables.configOpts = {};
        }

        if (!variables.configOpts.system || typeof variables.configOpts.system !== 'object') {
            const traySettings = variables.configOpts.tray || {};
            variables.configOpts.system = {
                show: traySettings.show !== undefined ? traySettings.show : true,
                minimizeTo: traySettings.minimizeTo || false,
                closeTo: traySettings.closeTo || false,
                startWithWindows: false,
                startMinimized: false
            };
            delete variables.configOpts.tray;
        }

        if (!variables.configOpts.triggercmd || typeof variables.configOpts.triggercmd !== 'object') {
            variables.configOpts.triggercmd = {
                overwriteFile: variables.tcuo || variables.configOpts.tcuo || 'keep',
                addCommands: variables.tcao || variables.configOpts.tcao || 'favourited',
                autoGenerate: variables.tcag === 'on' || variables.configOpts.tcag === 'on',
                inPath: variables.inPath || variables.configOpts.inPath || false
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
                    enable: variables.configOpts?.periodic?.enable || false,
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

        if (variables.directories) {
            if (variables.directories.include === 'include') {
                variables.directories.include = 'sections';
            }
        }

        if (Array.isArray(variables.loadScripts)) {
            variables.coreScripts = variables.loadScripts.map(script => script.replace('.js', ''));
            delete variables.loadScripts;
        }
        
        if (!Array.isArray(variables.coreScripts)) {
            variables.coreScripts = [...defaultCoreScripts];
        }

        if (variables.rows) {
            delete variables.rows;
        }

        if (!Array.isArray(variables.xldbFiles)) {
            variables.xldbFiles = [];
        }

        return JSON.stringify(variables, null, 2);
    } catch (error) {
        throw error;
    }
}

// Validate Config File
// Verifies configuration file structure and data integrity rules
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
            for (const [subKey, subType] of Object.entries(value)) {
                if (typeof data.directories[key][subKey] !== subType) {
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

// XLDBF Validation
// Validates favorites file structure and content
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

// System Config Check
// Validates system configuration settings
function validateSystemConfig(system) {
    if (!system || typeof system !== 'object') return false;
    
    const { keys, type } = configValidation.system;
    for (const key of Object.keys(system)) {
        if (!keys.has(key) || typeof system[key] !== type) {
            return false;
        }
    }
    return true;
}

// TriggerCmd Config Check
// Validates trigger command configuration settings
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
// Validates update configuration settings
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

// Theme Config Check
// Validates theme configuration settings
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