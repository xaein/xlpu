// Update Configuration Module
//   Manages application version control and update processes
//   Handles update checking, download, and installation procedures
//   Manages update indicators, progress tracking, and update notifications
//   Provides update configuration and automatic update functionality

// Update state variables
//   Tracks update delays, progress handler, and update state
//   Manages patch delay, file delay, progress handler, last file, and last state
const patchDelay = 250;  
const fileDelay = 300;   
window.updateState = {
    progressHandler: null,
    lastFile: '',
    lastState: {}
};

// Verify Dependencies Changed
//   Analyzes and records all package dependency modifications between versions
//   Compares current and new dependencies, records removed dependencies, and updates package.json
async function checkDependencyChanges() {
    try {
        const versionInfo = await xlp.getVersionInfo();
        const appDir = await e.Api.invoke('get-app-dir');
        
        const packagePath = xlp.joinPath(appDir, 'package.json');
        const packageData = await e.Api.invoke('read-file', packagePath);
        const packageJson = JSON.parse(packageData);
        const currentDeps = packageJson.dependencies ?? {};
        
        const newDeps = versionInfo.dependencies ?? {};
        const removedDeps = Object.keys(currentDeps).filter(dep => !newDeps[dep]);
        
        if (removedDeps.length > 0) {
            const utilsDir = xlp.dirVar('utils');
            const xldbuPath = xlp.joinPath(appDir, utilsDir, 'xldbu.json');
            let updateData = {};
            try {
                const existingData = await e.Api.invoke('read-file', xldbuPath);
                updateData = JSON.parse(existingData);
            } catch (error) {
            }
            updateData.RemovedDependencies = removedDeps;
            await e.Api.invoke('write-file', xldbuPath, JSON.stringify(updateData, null, 2));
        }

        packageJson.dependencies = newDeps;
        await e.Api.invoke('write-file', packagePath, JSON.stringify(packageJson, null, 2));
        
        return removedDeps.length > 0;
    } catch (error) {
        return false;
    }
}

// Check Update Status
//   Verifies and reports current system update availability state
//   Checks for updates and formats update information text for display
export async function checkForUpdatesConfig() {
    try {
        const updateInfo = await xlp.getUpdateInfo();
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

// Count Directory Items
//   Calculates total number of files within directory structure
//   Recursively counts files in directory object including nested directories
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

// Create Modal Cutout
//   Creates transparent view area in overlay for update preview display
//   Calculates preview bounds and creates clip path for modal overlay cutout
export function createOverlayCutout() {
    const updatePreview = xlp.getElement('updateInfoPreview') || window[window.domCacheName]?.updateInfoPreview;
    const modalOverlay = xlp.getElement('modalOverlay');
    const titlebar = xlp.getElement('dqs', '.titlebar');
    
    if (updatePreview && modalOverlay) {
        const bounds = updatePreview.getBoundingClientRect();
        
        const titlebarHeight = titlebar ? titlebar.offsetHeight : 30;
        
        const adjustedTop = bounds.top - titlebarHeight;
        
        const clipPath = `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%,
            0% ${adjustedTop}px, ${bounds.left}px ${adjustedTop}px, 
            ${bounds.left}px ${adjustedTop + bounds.height}px, 
            ${bounds.left + bounds.width}px ${adjustedTop + bounds.height}px,
            ${bounds.left + bounds.width}px ${adjustedTop}px,
            ${bounds.left}px ${adjustedTop}px,
            0% ${adjustedTop}px
        )`;
        
        modalOverlay.style.clipPath = clipPath;
    }
}

// Download Update Files
//   Processes and downloads all required update files from server
//   Downloads files, main files, and directory zips from update server with progress tracking
async function downloadAndApplyFiles(onProgress) {
    try {
        const binaryExtensions = ['.exe', '.ico', '.png'];
        const versionInfo = await xlp.getVersionInfo();
        const appDir = await e.Api.invoke('get-app-dir');
        const updtmpDir = xlp.dirVar('utils', 'update');
        const tmpDir = xlp.joinPath(appDir, updtmpDir);
        
        await e.Api.invoke('ensure-directory', tmpDir);
        
        async function processDirectory(dirObj, currentPath = '') {
            if (dirObj.files) {
                for (const file of dirObj.files) {
                    const fileUrl = `${window.xldbv.uurl}/files/${file}`;
                    const targetDir = xlp.joinPath(tmpDir, currentPath);
                    const targetPath = xlp.joinPath(targetDir, file);
                    const isBinary = binaryExtensions.some(ext => file.endsWith(ext)) ?? false;
                    await e.Api.invoke('ensure-directory', targetDir);
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

        for (const [dirName, dirObj] of Object.entries(versionInfo.files ?? {})) {
            await processDirectory(dirObj, dirName);
        }
        
        for (const [file] of Object.entries(versionInfo.mainFiles ?? {})) {
            const fileUrl = `${window.xldbv.uurl}/files/${file}`;
            const targetPath = xlp.joinPath(tmpDir, file);
            if (onProgress) onProgress(file);
            await e.Api.invoke('download-file', fileUrl, targetPath);
            await new Promise(resolve => setTimeout(resolve, fileDelay / 2));
            if (onProgress) onProgress(file);
            await new Promise(resolve => setTimeout(resolve, fileDelay));
        }
        
        const directoryZips = [];
        if (versionInfo.directoryZips) {
            directoryZips.push(...Object.keys(versionInfo.directoryZips));
            directoryZips.sort();
        }
        
        for (const zipName of directoryZips) {
            const zipUrl = `${window.xldbv.uurl}/files/${zipName}`;
            const zipPath = xlp.joinPath(tmpDir, zipName);
            const dirName = zipName.replace('.zip', '');
            const targetPath = xlp.joinPath(tmpDir, dirName);

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

        if (versionInfo.rem && versionInfo.rem.length > 0) {
            const xldbuPath = xlp.joinPath(appDir, xlp.dirVar('utils'), 'xldbu.json');
            let updateData = {};
            try {
                const existingData = await e.Api.invoke('read-file', xldbuPath);
                updateData = JSON.parse(existingData);
            } catch (error) {
            }
            updateData.FilesToRemove = versionInfo.rem;
            if (!updateData.RemovedDependencies) {
                updateData.RemovedDependencies = [];
            }
            await e.Api.invoke('write-file', xldbuPath, JSON.stringify(updateData, null, 2));
        }

        return true;
    } catch (error) {
        throw new Error(`Failed to update files: ${error.message}`);
    }
}

// Process Update Type
//   Downloads and extracts specific update package from server
//   Downloads update zip file, extracts it, and removes zip file
async function downloadAndApplyUpdate(updateType, onProgress) {
    try {
        const baseUrl = window.xldbv.uurl;
        const appDir = await e.Api.invoke('get-app-dir');
        const updtmpDir = xlp.dirVar('utils', 'update');
        const tmpDir = xlp.joinPath(appDir, updtmpDir);
        const zipName = `${updateType}.zip`;
        const zipUrl = `${baseUrl}/patch/${zipName}`;
        const zipPath = xlp.joinPath(tmpDir, zipName);

        await e.Api.invoke('ensure-directory', tmpDir);
        if (onProgress) onProgress(zipName);
        await e.Api.invoke('download-file', zipUrl, zipPath, true);
        if (onProgress) onProgress(zipName);
        await e.Api.invoke('extract-zip', zipPath, tmpDir);
        await e.Api.invoke('remove-file', zipPath);
        
        return true;
    } catch (error) {
        const displayType = updateType === 'patch' ? 'regular' : updateType;
        throw new Error(`Failed to apply ${displayType} update: ${error.message}`);
    }
}

// Calculate Files Total
//   Returns complete count of files within specified directory
//   Counts files in specified directory from files array or directory object
function getDirectoryFileCount(files, directory) {
    if (Array.isArray(files)) {
        return files.filter(f => f.path.startsWith(directory)).length;
    } else if (files[directory]) {
        return countFilesRecursively(files[directory]);
    }
    return 0;
}

// Calculate Display Padding
//   Determines proper spacing for update progress display formatting
//   Calculates padding for filename display based on longest filename in update info
function getPadding(filename, updateInfo) {
    const allFiles = [
        ...updateInfo.mainFiles,
        ...updateInfo.directoryZips
    ];
    const maxLength = Math.max(...allFiles.map(file => file.length));
    return ' '.repeat(maxLength - filename.length + 4);
}

// Get Directory List
//   Returns complete listing of all root level directories
//   Extracts root directory names from files array or directory object
function getRootDirectories(files) {
    if (Array.isArray(files)) {
        return [...new Set(files.map(f => f.path.split('/')[0]))];
    } else {
        return Object.keys(files);
    }
}

// Fetch Version Info
//   Retrieves and processes complete version information for update system
//   Fetches version info, calculates update path, and determines if restart is required
export async function getUpdateInfo() {
    const versionInfo = await xlp.getVersionInfo();
    const currentVersion = window.xldbv.version;
    
    const getAllFiles = (obj, currentPath = '') => {
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
    };

    const allFiles = [];
    for (const [dirName, dirObj] of Object.entries(versionInfo.files || {})) {
        allFiles.push(...getAllFiles(dirObj, dirName));
    }
    
    const updateInfo = {
        hasUpdate: xlp.isNewerVersion(currentVersion, versionInfo.version),
        currentVersion,
        newVersion: versionInfo.version,
        comment: versionInfo.comment,
        files: allFiles,
        mainFiles: Object.keys(versionInfo.mainFiles ?? {}),
        directoryZips: Object.keys(versionInfo.directoryZips ?? {}).sort((a, b) => a.localeCompare(b)),
        updatePath: await getUpdatePath(currentVersion, versionInfo.version),
        requiresRestart: false,
        versionInfo: versionInfo
    };

    updateInfo.requiresRestart = updateInfo.mainFiles.length > 0 || 
                                updateInfo.directoryZips.includes('node_modules.zip') ||
                                updateInfo.updatePath.length > 0;

    return updateInfo;
}

// Calculate Version Path
//   Determines optimal update path between current and target versions
//   Calculates update path including patches, minor, and major version updates
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

    const versionInfo = await xlp.getVersionInfo();
    
    if (xlp.isNewerVersion(currentVersion, `${currentMajor}.${currentMinor}.${targetPatch}`) && 
        !isOneBeforeMilestone && currentPatch < 99 && currentPatch < versionInfo.patch) {
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

// Handle Update Process
//   Manages complete update installation with progress tracking system
//   Creates progress handler that updates update preview display with file status
export async function handleUpdateProcess(updateInfo) {
    const onProgress = (file) => {
        const domCacheName = xlp.getState('ui.domCacheName');
        if (!(xlp.getElement('updateInfoPreview') || (domCacheName && window[domCacheName]?.updateInfoPreview))) {
            return;
        }
        const currentText = (xlp.getElement('updateInfoPreview') || (domCacheName && window[domCacheName]?.updateInfoPreview))?.textContent;
        
        if (file !== window.updateState.lastFile) {
            window.updateState.lastFile = file;
        }

        let newText = currentText;

        if (file && file.match(/^(major|minor|patch)\.zip$/)) {
            const type = file.replace('.zip', '');
            const displayType = type === 'patch' ? 'regular' : type;
            const patchPattern = /Applying patch: ([^\n]*)/;
            const match = newText.match(patchPattern);
            
            if (match) {
                let currentPath = match[1].trim();
                if (!currentPath) {
                    currentPath = displayType;
                } else if (!currentPath.includes(displayType)) {
                    currentPath = `${currentPath} 🠞 ${displayType}`;
                }
                newText = newText.replace(patchPattern, `Applying patch: ${currentPath}`);
            }
        } else if (updateInfo.mainFiles.includes(file)) {
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
                
                const updatePreview = xlp.getElement('updateInfoPreview') || window[window.domCacheName]?.updateInfoPreview;
                if (updatePreview) {
                    xlp.scrollToLine(updatePreview, 'Standard Files:');
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
    };
    
    window.updateState.progressHandler = onProgress;
    return true;
}

// Hide Update Display
//   Removes update progress overlay from user interface
export function hideUpdateOverlay() {
    const modalOverlay = xlp.getElement('modalOverlay');
    if (modalOverlay) {
        modalOverlay.style.display = 'none';
        
        modalOverlay.style.clipPath = 'none';
        
        window.removeEventListener('resize', createOverlayCutout);
    }
}

// Show Update Display
//   Creates and displays update progress overlay interface
//   Displays modal overlay and creates cutout for update preview area
export function showUpdateOverlay() {
    const modalOverlay = xlp.getElement('modalOverlay');
    
    if (modalOverlay) {
        modalOverlay.style.display = 'block';
        
        createOverlayCutout();
    }
}

// Process Update Installation
//   Downloads and applies all update components through system pipeline
//   Downloads patches and files, checks dependencies, updates version, and saves configuration
export async function updateFiles(onProgress) {
    try {
        const updateInfo = await getUpdateInfo();
        if (!updateInfo.hasUpdate) {
            throw new Error('No updates available');
        }

        if (updateInfo.updatePath.length > 0) {
            const domCacheName = xlp.getState('ui.domCacheName');
            const updateInfoPreview = xlp.getElement('updateInfoPreview') || (domCacheName && window[domCacheName]?.updateInfoPreview);
            if (updateInfoPreview) {
                const pathText = updateInfo.updatePath.map(type => type === 'patch' ? 'regular' : type).join(' 🠞 ');
                const text = updateInfoPreview.textContent;
                const pattern = /\.\n\nFiles to be updated:/;
                updateInfoPreview.innerHTML = text.replace(pattern, `.\n\nApplying patch: ${pathText}\n\nFiles to be updated:`);
                xlp.scrollToLine(updateInfoPreview, 'Applying patch:');
            }
            
            for (const patchType of updateInfo.updatePath) {
                await downloadAndApplyUpdate(patchType, onProgress);
                const displayType = patchType === 'patch' ? 'regular' : patchType;
                await new Promise(resolve => setTimeout(resolve, patchDelay));
            }
        }

        await downloadAndApplyFiles(onProgress);

        const hasDependencyChanges = await checkDependencyChanges();
        if (hasDependencyChanges) {
            updateInfo.requiresRestart = true;
        }

        window.xldbv.version = updateInfo.newVersion;
        
        const windowTitle = xlp.getElement('dqs', '.window-title');
        if (windowTitle) {
            windowTitle.textContent = `xLauncher Plus v${updateInfo.newVersion}`;
        }

        const baseDir = await e.Api.invoke('get-app-dir');
        const utilsDir = xlp.dirVar('utils');

        xlp.setData('xldbv', window.xldbv);
        if (xlp.validateXldbvJson(window.xldbv)) {
            const xldbvPath = xlp.joinPath(baseDir, utilsDir, 'xldbv.json');
            const xldbvResult = await e.Api.invoke('update-vars', xldbvPath, window.xldbv);
            if (!xldbvResult) {
                throw new Error('Failed to save xldbv.json');
            }
        } else {
            throw new Error('Invalid xldbv.json structure');
        }
        xlp.setData('updateAvailable', false);

        return true;
    } catch (error) {
        throw error;
    }
}
