// Database Control Save Module
//   Handles saving and loading operations for database files
//   Manages database file persistence, formatting, and validation
//   Handles post-save operations including stitching, reloading, and trigger generation
//   Provides progress tracking and error handling for save operations

// State variables
//   Tracks save process state, transition duration, and save delay timing
//   Manages save process active flag, transition duration calculation, and database save delay
let isSaveProcessActive = false;
let transitionDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-duration')) * 1000 || 300;
let dbSaveDelay = transitionDuration * 2;

// Format JSON String
//   Formats JSON data with proper indentation and circular reference handling
//   Parses and re-stringifies JSON to ensure consistent formatting, handles non-string input
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

// Generate TriggerCMD File
//   Generates the TriggerCMD file if auto-generate is enabled
//   Calls API to generate TriggerCMD file with configured options and updates progress
async function generateTriggerCMDFile(xldbv) {
    if (!isSaveProcessActive || !xldbv.configOpts?.triggercmd?.autoGenerate) {
        return;
    }
    
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

// Check Database Has Items
//   Determines if database contains real entries beyond placeholder data
//   Checks all database files in tempData for entries that are not empty or placeholder values
function databaseHasItems() {
    const tempData = window.tempData ?? {};
    const xldbv = xlp.getData('xldbv') || window.xldbv;
    const xldbFiles = xldbv?.xldbFiles ?? [];
    
    for (const fileName of xldbFiles) {
        const fileData = tempData[fileName];
        if (!fileData) {
            continue;
        }
        
        try {
            const parsedData = JSON.parse(fileData);
            const keys = Object.keys(parsedData);
            
            if (keys.length === 0) {
                continue;
            }
            
            if (keys.length === 1 && keys[0] === ' ' && parsedData[' '] === ' ') {
                continue;
            }
            
            return true;
        } catch (error) {
            continue;
        }
    }
    
    return false;
}

// Handle First Run Completion
//   Handles first run completion logic and navigation setup
//   Validates xldbv structure, updates variables, and sets up header navigation if first run
//   Only completes first run if database contains real items
async function handleFirstRunCompletion(xldbv) {
    if (!isSaveProcessActive || xldbv.firstRun !== 2) {
        return;
    }
    
    if (!databaseHasItems()) {
        return;
    }
    
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

// Reload Single Database File
//   Reloads a single database file from disk
//   Reads file from disk, stores in newData object and preloadedData, returns success status
async function reloadDatabaseFile(fileName, appDir, xldbDir, newData) {
    try {
        const filePath = xlp.joinPath(appDir, xldbDir, fileName);
        const { data } = await e.Api.invoke('get-file', filePath);
        newData[fileName] = data;
        xlp.setData('preloadedData', data, fileName);
        return true;
    } catch (error) {
        return false;
    }
}

// Reload All Database Files
//   Reloads all database files from disk
//   Iterates through all files, reloads each with delay, and updates progress UI
async function reloadDatabaseFiles(xldbFiles, appDir, xldbDir, newData) {
    const totalFiles = xldbFiles.length;
    let processedFiles = 0;

    for (const fileName of xldbFiles) {
        if (!isSaveProcessActive) {
            break;
        }
        
        updateReloadProgress((processedFiles / totalFiles) * 100, fileName.replace('.xlfc', ''));
        await reloadDatabaseFile(fileName, appDir, xldbDir, newData);
        processedFiles++;
        await new Promise(resolve => setTimeout(resolve, dbSaveDelay));
    }
}

// Reload Main XLFC File
//   Reloads the main XLFC file from disk
//   Reads main XLFC file from utils directory and stores in newData and preloadedData
async function reloadMainXLFCFile(xldbv, appDir, utilsDir, newData) {
    if (!isSaveProcessActive) {
        return;
    }
    
    updateReloadProgress(95, '');
    const mainXLFC = xldbv.mainXLFC;
    
    try {
        const mainXLFCPath = xlp.joinPath(appDir, utilsDir, mainXLFC);
        const { data: mainXLFCData } = await e.Api.invoke('get-file', mainXLFCPath);
        newData[mainXLFC] = mainXLFCData;
        xlp.setData('preloadedData', mainXLFCData, mainXLFC);
    } catch (error) {
        xlp.silentError();
    }
}

// Run Post-Save Stitching
//   Executes xlstitch after saving all files
//   Merges all database files into main XLFC file and updates progress to completion
async function runPostSaveStitching() {
    if (!isSaveProcessActive) {
        return;
    }
    
    updateSaveProgress(100, '');
    try {
        await e.Api.invoke('run-xlstitch');
    } catch (error) {
        xlp.silentError();
    }
    await new Promise(resolve => setTimeout(resolve, dbSaveDelay));
}

// Save Database Files
//   Processes and saves all database files with progress tracking
//   Orchestrates complete save process: saves files, runs stitching, reloads data, handles post-save operations
export async function saveAllData() {
    isSaveProcessActive = true;
    const xldbv = xlp.getData('xldbv') || window.xldbv;
    
    if (!xldbv) {
        isSaveProcessActive = false;
        return;
    }
    
    xlp.setData('xldbv', xldbv);
    
    const xldbFiles = xldbv.xldbFiles ?? [];
    const newData = {};
    const appDir = await e.Api.invoke('get-app-dir');
    const xldbDir = xlp.dirVar('xldb');
    const utilsDir = xlp.dirVar('utils');

    await saveDatabaseFiles(xldbFiles, appDir, xldbDir);
    await runPostSaveStitching();
    await reloadDatabaseFiles(xldbFiles, appDir, xldbDir, newData);
    await reloadMainXLFCFile(xldbv, appDir, utilsDir, newData);

    if (isSaveProcessActive) {
        const tempData = window.tempData;
        Object.assign(tempData, newData);

        await generateTriggerCMDFile(xldbv);
        updateReloadProgress(100, '');
        await handleFirstRunCompletion(xldbv);

        if (typeof xlp.updateSaveButtonState === 'function') {
            xlp.updateGreenButtonState();
        }
    }

    isSaveProcessActive = false;
}

// Save Database State
//   Handles database saving process and updates application UI
//   Shows save dialog, executes saveAllData, handles first run completion, and updates button states
export async function saveDatabase() {
    try {
        if (typeof xlp.saveAllData === 'function') {
            await xlp.showDialog('databasecontrolsave');
            await xlp.saveAllData();
            await new Promise(resolve => setTimeout(resolve, dbSaveDelay));
            xlp.closeDialog('databasecontrolsave');

            if (window.xldbv?.firstRun === 2) {
                if (databaseHasItems()) {
                    window.xldbv.firstRun = 0;
                    xlp.setData('xldbv', window.xldbv);
                }
            }
        } else {
            const preloadedData = xlp.getData('preloadedData') ?? {};
            const tempData = window.tempData;
            Object.assign(preloadedData, tempData);
            xlp.setData('preloadedData', preloadedData);
        }
        
        xlp.updateGreenButtonState();
    } catch (error) {
        xlp.handleError('Failed to save database', error);
    }
}

// Save Single Database File
//   Saves a single database file with formatting
//   Formats JSON content and writes to disk, returns success status
async function saveDatabaseFile(fileName, appDir, xldbDir) {
    const tempData = window.tempData;
    const content = tempData[fileName];
    
    if (!content) {
        return false;
    }
    
    const filePath = xlp.joinPath(appDir, xldbDir, fileName);
    try {
        const formattedContent = formatJSONString(content);
        await e.Api.invoke('write-file', filePath, formattedContent);
        return true;
    } catch (error) {
        return false;
    }
}

// Save All Database Files
//   Processes and saves all database files with progress tracking
//   Iterates through all files, saves each with delay, and updates progress UI
async function saveDatabaseFiles(xldbFiles, appDir, xldbDir) {
    const totalFiles = xldbFiles.length;
    let processedFiles = 0;

    for (const fileName of xldbFiles) {
        if (!isSaveProcessActive) {
            break;
        }
        
        updateSaveProgress((processedFiles / totalFiles) * 100, fileName.replace('.xlfc', ''));
        await saveDatabaseFile(fileName, appDir, xldbDir);
        processedFiles++;
        await new Promise(resolve => setTimeout(resolve, dbSaveDelay));
    }
}

// Track Reload Progress
//   Updates UI elements to show current database reload status
//   Updates dialog text content based on progress percentage and handles TriggerCMD special case
export function updateReloadProgress(progress, category) {
    if (!xlp.getElement('databasecontrolsaveDialog') || !isSaveProcessActive) return;

    const currentCategory = xlp.getElement('saveCurrentCategory');
    const headerMain = xlp.getElement('saveHeaderMain');
    const categoryLabel = xlp.getElement('saveCategoryLabel');
    
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

// Track Save Progress
//   Updates UI elements to show current database save status
//   Updates dialog text content based on progress percentage and current category being saved
export async function updateSaveProgress(progress, category) {
    if (!xlp.getElement('databasecontrolsaveDialog') || !isSaveProcessActive) return;

    const currentCategory = xlp.getElement('saveCurrentCategory');
    const headerMain = xlp.getElement('saveHeaderMain');
    const categoryLabel = xlp.getElement('saveCategoryLabel');
    
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

// Update Database Variables
//   Manages application state variables based on category operations
//   Updates xldbFiles array based on operation type using configuration-driven handlers
export function updateVariables(operation, data) {
    let xldbv = xlp.getData('xldbv') ?? {};

    if (typeof xldbv.xldbFiles === 'string') {
        xldbv.xldbFiles = xldbv.xldbFiles.split(',');
    } else if (!Array.isArray(xldbv.xldbFiles)) {
        xldbv.xldbFiles = [];
    }

    const config = xlp.databaseOperationConfig?.[operation];
    if (config && config.handler) {
        config.handler(xldbv, data);
    }

    if (!Array.isArray(xldbv.xldbFiles)) {
        xldbv.xldbFiles = [];
    }

    xlp.setData('xldbv', xldbv);
    window.xldbv = xldbv;
}