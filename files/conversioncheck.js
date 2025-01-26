// File conversion functions

// Check File Format
// Main function to check and convert file data if necessary
async function conversionCheck(fileName, data) {
    let convertedData = data;

    try {
        if (fileName === 'xldbv.json') {
            convertedData = convertXldbv(data);
        } else if (fileName === 'xldbf.json') {
            convertedData = convertXldbf(data);
        }

        if (convertedData !== data) {
            const appDir = await e.Api.invoke('get-app-dir');
            const utilsDir = js.F.dirVar('utils');
            const filePath = js.F.joinPath(appDir, utilsDir, fileName);
            await e.Api.invoke('write-file', filePath, convertedData);
        }

        return convertedData;
    } catch (error) {
        return data;
    }
}

// Convert XLDBF Data
// Convert xldbf.json to new format with favourites and recent arrays
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

// Convert XLDBV Data
// Convert xldbv.json to new format with updated configOpts structure
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
        } else if (variables.configOpts.system.startWithWindows === undefined) {
            variables.configOpts.system.startWithWindows = false;
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
            delete variables.configOpts.tcuo;
            delete variables.configOpts.tcao;
            delete variables.configOpts.tcag;
            delete variables.configOpts.inPath;
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
            delete variables.configOpts.aupd;
        }

        if (!variables.configOpts.theme || typeof variables.configOpts.theme !== 'object') {
            variables.configOpts.theme = {
                favourite: variables.favourite || variables.configOpts.favourite || '★',
                currentTheme: variables.currentTheme || variables.configOpts.currentTheme || 'green light',
                rowSelector: variables.configOpts?.theme?.rowSelector || '',
                rowWidth: variables.configOpts?.theme?.rowWidth || 100
            };
            delete variables.favourite;
            delete variables.currentTheme;
            delete variables.configOpts.favourite;
            delete variables.configOpts.currentTheme;
        }

        if (!Array.isArray(variables.loadScripts)) {
            variables.loadScripts = [
                "tables.js",
                "window.js",
                "systray.js",
                "dialogs.js",
                "pagination.js"
            ];
        }

        if (!Array.isArray(variables.xldbFiles)) {
            variables.xldbFiles = [];
        }

        if (!variables.directories || typeof variables.directories !== 'object') {
            variables.directories = {
                xldb: "xldb",
                help: "help",
                utils: {
                    root: "utils",
                    update: "updtmp"
                },
                scripts: "script",
                includes: {
                    root: "include",
                    dialogs: "dialog"
                },
                themes: {
                    root: "themes",
                    base: "base",
                    compiled: "compiled"
                }
            };
        } else {
            // Ensure nested structures exist
            if (!variables.directories.includes || typeof variables.directories.includes !== 'object') {
                variables.directories.includes = {
                    root: "include",
                    dialogs: "dialog"
                };
            }
            if (!variables.directories.themes || typeof variables.directories.themes !== 'object') {
                variables.directories.themes = {
                    root: "themes",
                    base: "base",
                    compiled: "compiled"
                };
            }
            // Convert utils to new structure if it's a string
            if (typeof variables.directories.utils === 'string') {
                variables.directories.utils = {
                    root: variables.directories.utils,
                    update: "updtmp"
                };
            } else if (!variables.directories.utils || typeof variables.directories.utils !== 'object') {
                variables.directories.utils = {
                    root: "utils",
                    update: "updtmp"
                };
            }
        }

        if (!variables.rows || typeof variables.rows !== 'object') {
            variables.rows = {
                main: 15,
                edit: 11
            };
        }

        // Always ensure all required directories exist with correct structure
        if (!variables.directories) {
            variables.directories = {};
        }

        // Ensure all base directories exist
        const requiredDirs = {
            xldb: "xldb",
            help: "help",
            scripts: "script"
        };

        // Set any missing base directories
        Object.entries(requiredDirs).forEach(([key, value]) => {
            if (!variables.directories[key]) {
                variables.directories[key] = value;
            }
        });

        // Always ensure utils structure
        variables.directories.utils = {
            root: variables.directories.utils?.root || "utils",
            update: variables.directories.utils?.update || "updtmp"
        };

        // Always ensure includes structure
        variables.directories.includes = {
            root: variables.directories.includes?.root || "include",
            dialogs: variables.directories.includes?.dialogs || "dialog"
        };

        // Always ensure themes structure
        variables.directories.themes = {
            root: variables.directories.themes?.root || "themes",
            base: variables.directories.themes?.base || "base",
            compiled: variables.directories.themes?.compiled || "compiled"
        };

        // Ensure loadScripts has all required scripts
        const requiredScripts = [
            "tables.js",
            "window.js",
            "systray.js",
            "dialogs.js",
            "pagination.js"
        ];
        
        if (!Array.isArray(variables.loadScripts)) {
            variables.loadScripts = requiredScripts;
        } else {
            // Add any missing required scripts
            requiredScripts.forEach(script => {
                if (!variables.loadScripts.includes(script)) {
                    variables.loadScripts.push(script);
                }
            });
        }

        const result = JSON.stringify(variables, null, 2);
        return result;
    } catch (error) {
        throw error;
    }
}

// Export conversion functions
window.conversioncheckFunctions = {
    conversionCheck
};
