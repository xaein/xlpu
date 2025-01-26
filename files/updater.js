// Update management functions

// Initialize update delays
const patchDelay = 600;  
const fileDelay = 300;   

// Update state management
window.updateState = {
    progressHandler: null,
    lastFile: '',
    lastState: {}
};

// Apply Update Files
// Downloads and applies all update components in correct sequence
async function updateFiles(onProgress) {
    try {
        const updateInfo = await getUpdateInfo();
        if (!updateInfo.hasUpdate) {
            throw new Error('No updates available');
        }

        if (updateInfo.updatePath.length > 0) {
            for (const patchType of updateInfo.updatePath) {
                await downloadAndApplyUpdate(patchType, onProgress);
                const displayType = patchType === 'patch' ? 'regular' : patchType;
                if (onProgress) onProgress(`${displayType} patch`);
                await new Promise(resolve => setTimeout(resolve, patchDelay));
            }
        }

        await downloadAndApplyFiles(onProgress);

        const hasDependencyChanges = await checkDependencyChanges();
        if (hasDependencyChanges) {
            updateInfo.requiresRestart = true;
        }

        window.xldbv.version = updateInfo.newVersion;
        
        const windowTitle = document.querySelector('.window-title');
        if (windowTitle) {
            windowTitle.textContent = `xLauncher Plus v${updateInfo.newVersion}`;
        }

        js.F.setData('xldbv', window.xldbv);
        await js.F.updateVariablesOnExit();
        js.F.setData('updateAvailable', false);

        return true;
    } catch (error) {
        throw error;
    }
}

// Calculate Update Path
// Calculates required update steps between version numbers efficiently
async function getUpdatePath(currentVersion, targetVersion) {
    const [currentMajor, currentMinor, currentPatch] = currentVersion.split('.').map(Number);
    const [targetMajor, targetMinor, targetPatch] = targetVersion.split('.').map(Number);
    const updatePath = [];

    if (currentMinor === 9 && targetMajor > currentMajor) {
        return updatePath;
    }

    if (currentPatch === 99) {
        return updatePath;
    }

    const nextMilestone = Math.ceil((currentPatch + 1) / 10) * 10;
    const isOneBeforeMilestone = currentPatch === nextMilestone - 1;

    const versionInfo = await js.F.getVersionInfo();
    
    if (targetPatch > currentPatch && !isOneBeforeMilestone && currentPatch < 99 && currentPatch < versionInfo.patch) {
        updatePath.push('patch');
    }
    
    if (targetMinor > currentMinor && currentMinor !== 9) {
        updatePath.push('minor');
    }
    
    if (targetMajor > currentMajor) {
        updatePath.push('major');
    }

    return updatePath.sort();
}

// Process Update Files
// Downloads and processes all update files from remote server
async function downloadAndApplyFiles(onProgress) {
    try {
        const versionInfo = await js.F.getVersionInfo();
        const appDir = await e.Api.invoke('get-app-dir');
        const updtmpDir = js.F.dirVar('utils', 'update');
        const tmpDir = js.F.joinPath(appDir, updtmpDir);
        
        await e.Api.invoke('ensure-directory', tmpDir);
        
        async function processDirectory(dirObj, currentPath = '') {
            if (dirObj.files) {
                for (const file of dirObj.files) {
                    const fileUrl = `${window.xldbv.uurl}/files/${file}`;
                    const targetPath = js.F.joinPath(tmpDir, currentPath, file);
                    const isBinary = file.endsWith('.exe');
                    await e.Api.invoke('ensure-directory', currentPath);
                    await e.Api.invoke('download-file', fileUrl, targetPath, isBinary);
                    if (onProgress) onProgress(`${currentPath}/${file}`);
                    await new Promise(resolve => setTimeout(resolve, fileDelay));
                }
            }

            for (const [key, value] of Object.entries(dirObj)) {
                if (key !== 'files' && typeof value === 'object') {
                    const newPath = currentPath ? `${currentPath}/${key}` : key;
                    await processDirectory(value, newPath);
                }
            }
        }

        for (const [dirName, dirObj] of Object.entries(versionInfo.files || {})) {
            await processDirectory(dirObj, dirName);
        }
        
        for (const [file] of Object.entries(versionInfo.mainFiles || {})) {
            const fileUrl = `${window.xldbv.uurl}/files/${file}`;
            const targetPath = js.F.joinPath(tmpDir, file);
            if (onProgress) onProgress(file);
            await e.Api.invoke('download-file', fileUrl, targetPath);
            await new Promise(resolve => setTimeout(resolve, fileDelay / 2));
            if (onProgress) onProgress(file);
            await new Promise(resolve => setTimeout(resolve, fileDelay));
        }
        
        // Handle directory zips
        const directoryZips = [];
        if (versionInfo.directoryZips) {
            directoryZips.push(...Object.keys(versionInfo.directoryZips));
            directoryZips.sort();
        }
        
        for (const zipName of directoryZips) {
            const zipUrl = `${window.xldbv.uurl}/files/${zipName}`;
            const zipPath = js.F.joinPath(tmpDir, zipName);
            const dirName = zipName.replace('.zip', '');
            const targetPath = js.F.joinPath(tmpDir, dirName);

            if (onProgress) onProgress(zipName);
            await e.Api.invoke('download-file', zipUrl, zipPath, true);
            await new Promise(resolve => setTimeout(resolve, fileDelay / 2));
            if (onProgress) onProgress(zipName);
            await e.Api.invoke('ensure-directory', targetPath);
            await e.Api.invoke('extract-zip', zipPath, targetPath);
            await e.Api.invoke('remove-file', zipPath);
            if (onProgress) onProgress(zipName);
            await new Promise(resolve => setTimeout(resolve, fileDelay));
        }

        // Write removal list if version info has removals
        if (versionInfo.rem && versionInfo.rem.length > 0) {
            const xldbuPath = js.F.joinPath(appDir, js.F.dirVar('utils'), 'xldbu.json');
            const updateData = {
                removedFiles: versionInfo.rem,
                removedDependencies: []
            };
            await e.Api.invoke('write-file', xldbuPath, JSON.stringify(updateData, null, 2));
        }

        return true;
    } catch (error) {
        throw new Error(`Failed to update files: ${error.message}`);
    }
}

// Get Version Details
// Retrieves and processes version information for update management
async function getUpdateInfo() {
    const versionInfo = await js.F.getVersionInfo();
    const currentVersion = window.xldbv.version;
    
    const currentNum = parseInt(currentVersion.replace(/\./g, ''));
    const latestNum = parseInt(versionInfo.version.replace(/\./g, ''));
    
    function getAllFiles(obj, currentPath = '') {
        let files = [];
        if (obj.files) {
            files.push(...obj.files.map(file => ({
                file,
                path: currentPath
            })));
        }
        for (const [key, value] of Object.entries(obj)) {
            if (key !== 'files' && typeof value === 'object') {
                const newPath = currentPath ? `${currentPath}/${key}` : key;
                files.push(...getAllFiles(value, newPath));
            }
        }
        return files;
    }

    const allFiles = [];
    for (const [dirName, dirObj] of Object.entries(versionInfo.files || {})) {
        allFiles.push(...getAllFiles(dirObj, dirName));
    }
    
    let updateInfo = {
        hasUpdate: latestNum > currentNum,
        currentVersion,
        newVersion: versionInfo.version,
        comment: versionInfo.comment,
        files: allFiles,
        mainFiles: Object.keys(versionInfo.mainFiles || {}),
        directoryZips: Object.keys(versionInfo.directoryZips || {}).sort((a, b) => a.localeCompare(b)),
        updatePath: await getUpdatePath(currentVersion, versionInfo.version),
        requiresRestart: false,
        versionInfo: versionInfo
    };

    updateInfo.requiresRestart = updateInfo.mainFiles.length > 0 || 
                                updateInfo.directoryZips.includes('node_modules.zip') ||
                                updateInfo.updatePath.length > 0;

    return updateInfo;
}

// Apply Update Type
// Downloads and extracts specific update type from remote server
async function downloadAndApplyUpdate(updateType, onProgress) {
    try {
        const baseUrl = window.xldbv.uurl;
        const appDir = await e.Api.invoke('get-app-dir');
        const updtmpDir = js.F.dirVar('utils', 'update');
        const tmpDir = js.F.joinPath(appDir, updtmpDir);
        const zipName = `${updateType}.zip`;
        const zipUrl = `${baseUrl}/patch/${zipName}`;
        const zipPath = js.F.joinPath(tmpDir, zipName);

        await e.Api.invoke('ensure-directory', tmpDir);
        await e.Api.invoke('download-file', zipUrl, zipPath, true);
        await e.Api.invoke('extract-zip', zipPath, tmpDir);
        await e.Api.invoke('remove-file', zipPath);
        
        return true;
    } catch (error) {
        const displayType = updateType === 'patch' ? 'regular' : updateType;
        throw new Error(`Failed to apply ${displayType} update: ${error.message}`);
    }
}

// Check Package Changes
// Analyzes and records changes in package dependencies between versions
async function checkDependencyChanges() {
    try {
        const versionInfo = await js.F.getVersionInfo();
        const appDir = await e.Api.invoke('get-app-dir');
        
        const packagePath = js.F.joinPath(appDir, 'package.json');
        const packageData = await e.Api.invoke('read-file', packagePath);
        const packageJson = JSON.parse(packageData);
        const currentDeps = packageJson.dependencies || {};
        
        const newDeps = versionInfo.dependencies || {};
        const removedDeps = Object.keys(currentDeps).filter(dep => !newDeps[dep]);
        
        if (removedDeps.length > 0) {
            const utilsDir = js.F.dirVar('utils');
            const xldbuPath = js.F.joinPath(appDir, utilsDir, 'xldbu.json');
            const updateData = { removedDependencies: removedDeps };
            await e.Api.invoke('write-file', xldbuPath, JSON.stringify(updateData, null, 2));
        }

        // Update package.json with new dependencies
        packageJson.dependencies = newDeps;
        await e.Api.invoke('write-file', packagePath, JSON.stringify(packageJson, null, 2));
        
        return removedDeps.length > 0;
    } catch (error) {
        return false;
    }
}

// Calculate File Padding
// Determines padding length for file progress display
function getPadding(filename, updateInfo) {
    const allFiles = [
        ...updateInfo.mainFiles,
        ...updateInfo.directoryZips
    ];
    const maxLength = Math.max(...allFiles.map(file => file.length));
    return ' '.repeat(maxLength - filename.length + 4);
}

// Count Directory Files
// Recursively counts files in directory structure
function countFilesRecursively(dirObj) {
    let count = 0;
    if (dirObj.files) {
        count += dirObj.files.length;
    }
    for (const [key, value] of Object.entries(dirObj)) {
        if (key !== 'files' && typeof value === 'object') {
            count += countFilesRecursively(value);
        }
    }
    return count;
}

// Get Files Count
// Returns total count of files in directory
function getDirectoryFileCount(files, directory) {
    if (Array.isArray(files)) {
        return files.filter(f => f.path.startsWith(directory)).length;
    } else if (files[directory]) {
        return countFilesRecursively(files[directory]);
    }
    return 0;
}

// Get Root Dirs
// Returns list of root level directories
function getRootDirectories(files) {
    if (Array.isArray(files)) {
        return [...new Set(files.map(f => f.path.split('/')[0]))];
    } else {
        return Object.keys(files);
    }
}

// Process Update Task
// Handles the complete update process with progress tracking
async function handleUpdateProcess(updateInfo) {
    function onProgress(file) {
        if (!document.getElementById('updateInfoPreview')) {
            return;
        }
        const currentText = document.getElementById('updateInfoPreview').textContent;
        
        if (file !== window.updateState.lastFile) {
            window.updateState.lastFile = file;
        }

        let newText = currentText;

        if (updateInfo.mainFiles.includes(file)) {
            const baseLine = `  ${file}${getPadding(file, updateInfo)}`;
            const pattern = new RegExp(`^  ${file}\\s+(-|✓|- Updating...)$`, 'm');
            
            const match = newText.match(pattern);
            if (match) {
                if (match[1] === '-') {
                    newText = newText.replace(pattern, `${baseLine}- Updating...`);
                } else if (match[1] === '- Updating...') {
                    newText = newText.replace(pattern, `${baseLine}✓`);
                }
            }
        } else if (file.endsWith('.zip')) {
            const baseLine = `  ${file}${getPadding(file, updateInfo)}`;
            const pattern = new RegExp(`^  ${file}\\s+(-|✓|- Downloading...|- Extracting...)$`, 'm');
            
            const match = newText.match(pattern);
            if (match) {
                if (!window.updateState.lastState[file]) {
                    window.updateState.lastState[file] = 'start';
                }

                if (match[1] === '-') {
                    newText = newText.replace(pattern, `${baseLine}- Downloading...`);
                    window.updateState.lastState[file] = 'downloading';
                } else if (match[1] === '- Downloading...' && window.updateState.lastState[file] === 'downloading') {
                    newText = newText.replace(pattern, `${baseLine}- Extracting...`);
                    window.updateState.lastState[file] = 'extracting';
                } else if (match[1] === '- Extracting...' && window.updateState.lastState[file] === 'extracting') {
                    newText = newText.replace(pattern, `${baseLine}✓`);
                    window.updateState.lastState[file] = 'complete';
                }
            }
        } else {
            const fileMatch = updateInfo.files.find(f => `${f.path}/${f.file}` === file);
            if (fileMatch) {
                const rootDir = fileMatch.path.split('/')[0];
                const countPattern = new RegExp(`^  ${rootDir} \\((\\d+) files?\\)$`, 'm');
                const updatingPattern = new RegExp(`^    Updating: .*\\n?`, 'gm');
                
                const updatePreview = document.getElementById('updateInfoPreview');
                if (updatePreview) {
                    js.F.scrollToLine(updatePreview, 'Standard Files:');
                }
                
                const match = newText.match(countPattern);
                if (match) {
                    const currentCount = parseInt(match[1]);
                    
                    newText = newText.replace(updatingPattern, '').replace(/\n\n\n+/g, '\n\n');
                    
                    if (currentCount > 0) {
                        if (currentCount === 1) {
                            newText = newText.replace(countPattern, `  ${rootDir} ✓ Complete`);
                        } else {
                            const newCount = currentCount - 1;
                            const countText = `  ${rootDir} (${newCount} ${newCount === 1 ? 'file' : 'files'})`;
                            newText = newText.replace(countPattern, countText);
                            
                            const lines = newText.split('\n');
                            const lineIndex = lines.findIndex(line => line === countText);
                            if (lineIndex !== -1) {
                                const displayPath = file.replace(`${rootDir}/`, '');
                                lines.splice(lineIndex + 1, 0, `    Updating: ${displayPath}`);
                                newText = lines.join('\n');
                            }
                        }
                    }
                }
            }
        }

        return newText;
    }
    
    window.updateState.progressHandler = onProgress;
    return true;
}

// Check Update Status
// Verifies if updates are available and notifies user
async function checkForUpdates() {
    try {
        const updateInfo = await js.F.getUpdateInfo();
        let updateText = `Current Version: ${updateInfo.currentVersion}\n`;
        
        if (updateInfo.hasUpdate) {
            updateText += `New Version: ${updateInfo.newVersion}\n\n`;
            
            if (updateInfo.comment?.trim()) {
                updateText += `Changes:\n\n${updateInfo.comment}\n\n`;
            }
            
            if (updateInfo.updatePath.length > 0) {
                updateText += `Patches required: ${updateInfo.updatePath.map(type => type === 'patch' ? 'regular' : type).join(' 🠞 ')}\n`;
                updateText += `These will be applied before the normal update process begins.\n\n`;
            }

            updateText += `Files to be updated:\n\n`;

            if (updateInfo.files && (Array.isArray(updateInfo.files) ? updateInfo.files.length > 0 : Object.keys(updateInfo.files).length > 0)) {
                updateText += `Standard Files:\n`;
                
                const rootDirs = getRootDirectories(updateInfo.files);
                
                for (const dir of rootDirs) {
                    const fileCount = getDirectoryFileCount(updateInfo.files, dir);
                    if (fileCount > 0) {
                        updateText += `  ${dir} (${fileCount} files)\n`;
                    }
                }
                updateText += '\n';
            }

            if (updateInfo.mainFiles.length > 0) {
                updateText += `Core Files:\n`;
                for (const file of updateInfo.mainFiles) {
                    updateText += `  ${file}${getPadding(file, updateInfo)}-\n`;
                }
                updateText += '\n';
            }

            const helpZip = updateInfo.directoryZips.find(zip => zip === 'help.zip');
            if (helpZip) {
                updateText += `Help Files:\n`;
                updateText += `  help.zip${getPadding('help.zip', updateInfo)}-\n\n`;
            }

            const nodeModulesZip = updateInfo.directoryZips.find(zip => zip === 'node_modules.zip');
            if (nodeModulesZip) {
                updateText += `System Updates:\n`;
                updateText += `  ${nodeModulesZip}${getPadding(nodeModulesZip, updateInfo)}-\n\n`;
            }
        } else {
            updateText += '\nNo updates available.';
            updateText += '\n\nClick <span class="update-link">here</span> for more information about the current version.';
        }
        
        return {
            text: updateText,
            hasUpdate: updateInfo.hasUpdate
        };
    } catch (error) {
        throw new Error(`Error checking for updates: ${error.message}`);
    }
}

// Show Update Overlay
// Displays the update progress overlay to user
function showUpdateOverlay() {
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'updateModalOverlay';
    modalOverlay.style.display = 'block';
    document.body.appendChild(modalOverlay);
}

// Hide Update Overlay
// Removes the update progress overlay from view
function hideUpdateOverlay() {
    const modalOverlay = document.getElementById('updateModalOverlay');
    if (modalOverlay) {
        modalOverlay.remove();
    }
}

// Export updater functions
window.updaterFunctions = {
    getUpdateInfo,
    updateFiles,
    handleUpdateProcess,
    checkForUpdates,
    showUpdateOverlay,
    hideUpdateOverlay
}; 