// File conversion functions

// conversionCheck
// Main function to check and convert file data if necessary
async function conversionCheck(fileName, data) {
    let convertedData = data;

    if (fileName === 'xldbv.json') {
        convertedData = convertXldbv(data);
    } else if (fileName === 'xldbf.json') {
        convertedData = convertXldbf(data);
    }

    if (convertedData !== data) {
        // Data has been converted, save it back to the file
        const appDir = await e.Api.invoke('get-app-dir');
        const utilsDir = window.xldbv?.directories?.utils || 'utils';
        const filePath = js.F.joinPath(appDir, utilsDir, fileName);
        await e.Api.invoke('write-file', filePath, convertedData);
    }

    return convertedData;
}

// convertXldbf
// Convert xldbf.json to new format with favourites and recent arrays
function convertXldbf(data) {
    if (!data || data.trim().length === 0) {
        return JSON.stringify({ favourites: [], recent: [] }, null, 2);
    }

    const parsedData = JSON.parse(data);
    
    if (!Array.isArray(parsedData.favourites)) {
        const oldFavourites = Object.keys(parsedData).filter(key => parsedData[key] === true);
        return JSON.stringify({
            favourites: oldFavourites,
            recent: []
        }, null, 2);
    } else {
        return JSON.stringify({
            favourites: parsedData.favourites || [],
            recent: parsedData.recent || []
        }, null, 2);
    }
}

// convertXldbv
// Convert xldbv.json to new format with updated configOpts structure
function convertXldbv(data) {
    const variables = JSON.parse(data);
    
    if (!variables.configOpts) {
        variables.configOpts = {};
    }

    // Add tray settings if they don't exist
    if (!variables.configOpts.tray) {
        variables.configOpts.tray = {
            show: true,
            minimizeTo: true,
            closeTo: false
        };
    }

    // Convert triggercmd settings
    if (!variables.configOpts.triggercmd) {
        variables.configOpts.triggercmd = {
            overwriteFile: variables.configOpts.tcuo || 'keep',
            addCommands: variables.configOpts.tcao || 'favourited',
            autoGenerate: variables.configOpts.tcag === 'on',
            inPath: variables.configOpts.inPath || false
        };
    } else {
        // Ensure all properties exist in triggercmd
        variables.configOpts.triggercmd.overwriteFile = variables.configOpts.triggercmd.overwriteFile || variables.configOpts.tcuo || 'keep';
        variables.configOpts.triggercmd.addCommands = variables.configOpts.triggercmd.addCommands || variables.configOpts.tcao || 'favourited';
        variables.configOpts.triggercmd.autoGenerate = variables.configOpts.triggercmd.autoGenerate !== undefined ? variables.configOpts.triggercmd.autoGenerate : (variables.configOpts.tcag === 'on');
        variables.configOpts.triggercmd.inPath = variables.configOpts.triggercmd.inPath !== undefined ? variables.configOpts.triggercmd.inPath : (variables.configOpts.inPath || false);
    }
    // Clean up old triggercmd settings
    delete variables.configOpts.tcuo;
    delete variables.configOpts.tcao;
    delete variables.configOpts.tcag;
    delete variables.configOpts.inPath;

    // Convert update settings
    if (!variables.configOpts.updates) {
        variables.configOpts.updates = {
            autoCheck: variables.configOpts.aupd === 'on',
            periodic: {
                enable: false,
                interval: 24
            }
        };
    } else {
        // Ensure all properties exist in updates
        variables.configOpts.updates.autoCheck = variables.configOpts.updates.autoCheck !== undefined ? variables.configOpts.updates.autoCheck : (variables.configOpts.aupd === 'on');
        if (!variables.configOpts.updates.periodic) {
            variables.configOpts.updates.periodic = {
                enable: false,
                interval: 24
            };
        }
    }
    // Clean up old update settings
    delete variables.configOpts.aupd;

    return JSON.stringify(variables, null, 2);
}

// Export conversion functions
window.conversioncheckFunctions = {
    conversionCheck
};
