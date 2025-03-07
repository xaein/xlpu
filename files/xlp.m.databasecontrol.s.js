// Database Control Save Module
// Handles saving and loading operations for database files

// State variables
let isSaveProcessActive = false;
let transitionDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-duration')) * 1000 || 300;
let dbSaveDelay = transitionDuration * 2;

// Format JSON String
// Formats JSON data with proper indentation and circular reference handling
function formatJSONString(jsonString) {
    try {
        if (typeof jsonString !== 'string') {
            return JSON.stringify(jsonString, null, 2);
        }
        const obj = JSON.parse(jsonString);
        return JSON.stringify(obj, null, 2);
    } catch (error) {
        return jsonString;
    }
}

// Update Database Variables
// Manages application state variables based on category operations
export function updateVariables(operation, data) {
    let xldbv = xlp.getData('xldbv') || {};

    if (typeof xldbv.xldbFiles === 'string') {
        xldbv.xldbFiles = xldbv.xldbFiles.split(',');
    } else if (!Array.isArray(xldbv.xldbFiles)) {
        xldbv.xldbFiles = [];
    }

    switch (operation) {
        case 'addCategory':
            if (!xldbv.xldbFiles.includes(data)) {
                xldbv.xldbFiles.push(data);
            }
            break;
        case 'renameCategory':
            const index = xldbv.xldbFiles.indexOf(data.oldFileName);
            if (index !== -1) {
                xldbv.xldbFiles[index] = data.newFileName;
            }
            break;
        case 'removeCategory':
            xldbv.xldbFiles = xldbv.xldbFiles.filter(file => file !== data);
            break;
    }

    if (!Array.isArray(xldbv.xldbFiles)) {
        xldbv.xldbFiles = [];
    }

    xlp.setData('xldbv', xldbv);
    window.xldbv = xldbv;
}

// Track Save Progress
// Updates UI elements to show current database save status
export async function updateSaveProgress(progress, category) {
    if (document.getElementById('databasecontrolsaveDialog') === null || !isSaveProcessActive) return;

    const currentCategory = document.getElementById('saveCurrentCategory');
    const headerMain = document.getElementById('saveHeaderMain');
    const categoryLabel = document.getElementById('saveCategoryLabel');
    
    if (progress === 100) {
        if (headerMain) headerMain.textContent = 'Stitching Complete';
        if (currentCategory) currentCategory.textContent = '';
        if (categoryLabel) categoryLabel.textContent = '';
        
        await new Promise(resolve => setTimeout(resolve, dbSaveDelay));
    } else {
        if (headerMain) headerMain.textContent = 'Saving:';
        if (categoryLabel) categoryLabel.textContent = 'Category:';
        if (currentCategory) currentCategory.textContent = category;
    }
}

// Track Reload Progress
// Updates UI elements to show current database reload status
export function updateReloadProgress(progress, category) {
    if (document.getElementById('databasecontrolsaveDialog') === null || !isSaveProcessActive) return;

    const currentCategory = document.getElementById('saveCurrentCategory');
    const headerMain = document.getElementById('saveHeaderMain');
    const categoryLabel = document.getElementById('saveCategoryLabel');
    
    if (progress === 100) {
        if (headerMain) headerMain.textContent = 'Reload Complete';
        if (currentCategory) currentCategory.textContent = '';
        if (categoryLabel) categoryLabel.textContent = '';
    } else {
        if (headerMain) headerMain.textContent = 'Reloading:';
        if (categoryLabel) {
            if (category.includes('TriggerCMD')) {
                categoryLabel.textContent = '';
            } else {
                categoryLabel.textContent = 'Category:';
            }
        }
        if (currentCategory) currentCategory.textContent = category;
    }
}

// Save Database Files
// Processes and saves all database files with progress tracking
export async function saveAllData() {
    isSaveProcessActive = true;
    
    const tempData = xlp.getData('tempData');
    const xldbv = xlp.getData('xldbv') || window.xldbv;
    
    if (!xldbv) {
        isSaveProcessActive = false;
        return;
    }
    
    xlp.setData('tempData', tempData);
    xlp.setData('xldbv', xldbv);
    
    const xldbFiles = xldbv.xldbFiles || [];
    let totalFiles = xldbFiles.length;
    let processedFiles = 0;
    const newData = {};

    const appDir = await e.Api.invoke('get-app-dir');
    const xldbDir = xlp.dirVar('xldb');
    const utilsDir = xlp.dirVar('utils');

    for (const fileName of xldbFiles) {
        if (!isSaveProcessActive) {
            break;
        }
        
        updateSaveProgress((processedFiles / totalFiles) * 100, fileName.replace('.xlfc', ''));
        const content = tempData[fileName];
        
        if (content) {
            const filePath = xlp.joinPath(appDir, xldbDir, fileName);
            try {
                const formattedContent = formatJSONString(content);
                await e.Api.invoke('write-file', filePath, formattedContent);
            } catch (error) {
            }
        }
        
        processedFiles++;
        await new Promise(resolve => setTimeout(resolve, dbSaveDelay));
    }

    if (isSaveProcessActive) {
        updateSaveProgress(100, '');
        try {
            await e.Api.invoke('run-xlstitch');
        } catch (error) {
        }
        await new Promise(resolve => setTimeout(resolve, dbSaveDelay));
    }

    processedFiles = 0;
    for (const fileName of xldbFiles) {
        if (!isSaveProcessActive) {
            break;
        }
        
        updateReloadProgress((processedFiles / totalFiles) * 100, fileName.replace('.xlfc', ''));
        try {
            const filePath = xlp.joinPath(appDir, xldbDir, fileName);
            const { data } = await e.Api.invoke('get-file', filePath);
            newData[fileName] = data;
            xlp.setData('preloadedData', data, fileName);
        } catch (error) {
        }

        processedFiles++;
        await new Promise(resolve => setTimeout(resolve, dbSaveDelay));
    }

    if (isSaveProcessActive) {
        updateReloadProgress(95, '');
        const mainXLFC = xldbv.mainXLFC;
        
        try {
            const mainXLFCPath = xlp.joinPath(appDir, utilsDir, mainXLFC);
            const { data: mainXLFCData } = await e.Api.invoke('get-file', mainXLFCPath);
            newData[mainXLFC] = mainXLFCData;
            xlp.setData('preloadedData', mainXLFCData, mainXLFC);
        } catch (error) {
        }

        Object.assign(window.tempData, newData);
        xlp.setData('tempData', window.tempData);

        if (xldbv.configOpts?.triggercmd?.autoGenerate) {
            updateReloadProgress(98, 'Generating TriggerCMD File');
            await new Promise(resolve => setTimeout(resolve, dbSaveDelay));

            try {
                const configOpts = {
                    overwriteFile: xldbv.configOpts.triggercmd.overwriteFile,
                    addCommands: xldbv.configOpts.triggercmd.addCommands
                };
                await e.Api.invoke('generate-triggercmd', configOpts);
                updateReloadProgress(99, 'Generated TriggerCMD File');
            } catch (error) {
                updateReloadProgress(99, 'Error Generating TriggerCMD File');
            }

            await new Promise(resolve => setTimeout(resolve, dbSaveDelay));
        }

        updateReloadProgress(100, '');

        if (xldbv.firstRun === 2) {
            xldbv.firstRun = 0;
            if (typeof xlp.validateXldbvJson === 'function' && xlp.validateXldbvJson(xldbv)) {
                xlp.setData('xldbv', xldbv);
                if (typeof xlp.updateVariablesOnExit === 'function') {
                    await xlp.updateVariablesOnExit();
                }
                if (typeof xlp.setupHeaderNavigation === 'function') {
                    xlp.setupHeaderNavigation('databasecontrol');
                }
            }
        }

        if (typeof xlp.updateSaveButtonState === 'function') {
            xlp.updateGreenButtonState();
        }
    }

    isSaveProcessActive = false;
}

// Save Database State
// Handles database saving process and updates application UI
export async function saveDatabase() {
    try {
        if (typeof xlp.saveAllData === 'function') {
            await xlp.showDialog('databasecontrolsave');
            await xlp.saveAllData();
            await new Promise(resolve => setTimeout(resolve, dbSaveDelay));
            xlp.closeDialog('databasecontrolsave');

            if (window.xldbv?.firstRun === 2) {
                window.xldbv.firstRun = 0;
                xlp.setData('xldbv', window.xldbv);
            }
        } else {
            const preloadedData = xlp.getData('preloadedData') || {};
            Object.assign(preloadedData, window.tempData);
            xlp.setData('preloadedData', preloadedData);
        }
        
        xlp.updateGreenButtonState();
    } catch (error) {
        xlp.handleError('Failed to save database', error);
    }
}