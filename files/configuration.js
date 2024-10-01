// Configuration management and utilities

// Fetch file
// Fetches a file from the specified URL with the given response type
async function fetchFile(url, responseType = 'json') {
    try {
        const response = await e.Api.invoke('fetch-url', url, responseType);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        return response.data;
    } catch (error) {
        throw error;
    }
}

// Get version info
// Fetches the version information from the specified URL
async function getVersionInfo() {
    const baseUrl = window.xldbv.uurl;
    const url = `${baseUrl}/version.json`;
    return await fetchFile(url, 'json');
}

// Update files
// Updates the files based on the version information
async function updateFiles() {
    const versionInfo = await getVersionInfo();
    const appDir = await e.Api.invoke('get-app-dir');
    const updateInfoPreview = document.getElementById('updateInfoPreview');
    const baseUrl = window.xldbv.uurl;
    let mainFilesUpdated = false;

    // Update normal files
    for (const [fileName, destinationDir] of Object.entries(versionInfo.files)) {
        updateInfoPreview.value = updateInfoPreview.value.replace(`- ${fileName}`, `↓ ${fileName}`);
        const fileUrl = `${baseUrl}/files/${fileName}`;
        const responseType = fileName.endsWith('.exe') ? 'arraybuffer' : 'text';
        const fileContent = await fetchFile(fileUrl, responseType);
        const destinationPath = js.F.joinPath(appDir, destinationDir, fileName);
        const result = await e.Api.invoke('write-file', destinationPath, fileContent, responseType === 'arraybuffer');
        if (!result) {
            updateInfoPreview.value += `Failed to update ${fileName}\n`;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        updateInfoPreview.value = updateInfoPreview.value.replace(`↓ ${fileName}`, `✔ ${fileName}`);
        scrollToLine(updateInfoPreview, `✔ ${fileName}`);
    }

    // Update main files
    for (const [fileName, shouldUpdate] of Object.entries(versionInfo.mainFiles)) {
        if (shouldUpdate) {
            mainFilesUpdated = true;
            updateInfoPreview.value = updateInfoPreview.value.replace(`- ${fileName}`, `↓ ${fileName}`);
            const fileUrl = `${baseUrl}/files/${fileName}`;
            const responseType = fileName.endsWith('.exe') ? 'arraybuffer' : 'text';
            const fileContent = await fetchFile(fileUrl, responseType);
            const destinationPath = js.F.joinPath(appDir, fileName);
            const result = await e.Api.invoke('write-file', destinationPath, fileContent, responseType === 'arraybuffer');
            await new Promise(resolve => setTimeout(resolve, 500));
            updateInfoPreview.value = updateInfoPreview.value.replace(`↓ ${fileName}`, `✔ ${fileName}`);
            scrollToLine(updateInfoPreview, `✔ ${fileName}`);
        }
    }

    // Handle directory updates
    if (versionInfo.directoryZips) {
        for (const [zipName, shouldUpdate] of Object.entries(versionInfo.directoryZips)) {
            if (shouldUpdate) {
                updateInfoPreview.value = updateInfoPreview.value.replace(`- ${zipName}`, `↓ ${zipName}`);
                const zipUrl = `${baseUrl}/files/${zipName}`;
                const zipBuffer = await fetchFile(zipUrl, 'arraybuffer');
                const dirName = path.basename(zipName, '.zip');
                const result = await e.Api.invoke('update-directories', dirName, zipBuffer);
                if (result) {
                    updateInfoPreview.value = updateInfoPreview.value.replace(`↓ ${zipName}`, `✔ ${zipName}`);
                } else {
                    updateInfoPreview.value += `Failed to update ${zipName}\n`;
                }
                scrollToLine(updateInfoPreview, `✔ ${zipName}`);
            }
        }
    }

    // Display message if main files were updated
    if (mainFilesUpdated) {
        updateInfoPreview.value += '\nApplication will need to be relaunched for changes to take effect.';
        scrollToLine(updateInfoPreview, 'Application will need to be relaunched for changes to take effect.');
    }
}

// Scroll to line
// This function scrolls the given element to the line containing the specified text
function scrollToLine(element, text) {
    const lines = element.value.split('\n');
    const lineIndex = lines.findIndex(line => line.includes(text));
    if (lineIndex !== -1) {
        const lineHeight = getLineHeight(element);
        const scrollTop = lineIndex * lineHeight;
        element.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
        });
    }
}

// Get line height
// This function creates a temporary element to measure the line height
function getLineHeight(element) {
    const temp = document.createElement('div');
    temp.style.position = 'absolute';
    temp.style.visibility = 'hidden';
    temp.style.whiteSpace = 'nowrap';
    temp.style.font = getComputedStyle(element).font;
    temp.innerText = 'A';
    document.body.appendChild(temp);
    const lineHeight = temp.clientHeight;
    document.body.removeChild(temp);
    return lineHeight;
}

// Setup configuration list
// This function sets up the configuration list by checking for the existence of the TriggerCMD file
async function setupConfigList() {
    const triggerCmdFileExists = await e.Api.invoke('check-triggercmd-file');
    const triggerCmdItem = document.querySelector('[data-config="triggercmd"]');

    if (triggerCmdFileExists) {
        triggerCmdItem.style.display = 'block';
    } else {
        triggerCmdItem.style.display = 'none';
    }
}

// Load configuration section
// This function loads the specified configuration section
function loadConfigSection(section) {
    currentSection = section;
    const configDisplay = document.getElementById('configDisplay');

    if (window.configSections && window.configSections[section]) {
        configDisplay.innerHTML = window.configSections[section];
    } else {
        return;
    }

    switch (section) {
        case 'general':
            initializeGeneralConfig();
            break;
        case 'triggercmd':
            initializeTriggerCmdConfig();
            break;
        case 'update':
            initializeUpdateConfig();
            break;
    }

    updateSelectedConfigItem(section);
    js.F.saveOriginalConfig(section);
    js.F.updateSaveButtonState();
}

// Get configuration
// This function retrieves the current configuration for the specified section
function getConfig(section) {
    switch (section) {
        case 'general':
            return {
                dateFormat: document.getElementById('dateFormat').value,
                timeFormat: document.getElementById('timeFormat').value,
                construct: document.getElementById('construct').value === '1' ? 'timeFormat dateFormat' : 'dateFormat timeFormat',
                leftEncapsule: `'${document.getElementById('leftEncapsule').value}'`,
                rightEncapsule: `'${document.getElementById('rightEncapsule').value}'`,
                messageSeperator: `'${document.getElementById('messageSeperator').value}'`,
                messagePrefix: `'${document.getElementById('messagePrefix').value}'`,
                maxLogEntries: document.getElementById('maxLogEntries').value,
                favourite: document.getElementById('favouriteIcon').value
            };
        case 'triggercmd':
            return {
                tcuo: document.querySelector('input[name="triggerCMDUpdateOption"]:checked')?.value || 'overwrite',
                tcao: document.querySelector('input[name="triggerCMDAppsOption"]:checked')?.value || 'all',
                tcag: document.getElementById('autoGenerateTriggerCMD')?.checked ? 'on' : 'off',
                inPath: document.getElementById('addToPath')?.checked || false
            };
        case 'update':
            const checkUpdateValue = document.getElementById('checkUpdate').checked;
            return { autoUpdate: checkUpdateValue };
        default:
            return {};
    }
}

// Initialize general configuration
// This function initializes the general configuration section
function initializeGeneralConfig() {
    const xlaunchConfig = js.F.getData('xlaunchConfig');
    populateConfigFields(xlaunchConfig);
    js.F.setupConfigurationListeners();
    setupDateTimeFormatHandlers();
    populateFavouriteIcons();
    updateLogFormatPreview();
}

// Initialize TriggerCMD configuration
// This function initializes the TriggerCMD configuration section
function initializeTriggerCmdConfig() {
    if (!window.xldbv.configOpts) {
        window.xldbv.configOpts = { tcuo: 'overwrite', tcao: 'all', tcag: 'on', inPath: false };
    }

    const updateOptionRadios = document.getElementsByName('triggerCMDUpdateOption');
    const appsOptionRadios = document.getElementsByName('triggerCMDAppsOption');
    const autoGenerateCheckbox = document.getElementById('autoGenerateTriggerCMD');
    const addToPathCheckbox = document.getElementById('addToPath');

    if (updateOptionRadios.length > 0) {
        const tcuoValue = window.xldbv.configOpts.tcuo;
        const tcuoElement = document.querySelector(`input[name="triggerCMDUpdateOption"][value="${tcuoValue}"]`);
        if (tcuoElement) {
            tcuoElement.checked = true;
        }
    }

    if (appsOptionRadios.length > 0) {
        const tcaoValue = window.xldbv.configOpts.tcao;
        const tcaoElement = document.querySelector(`input[name="triggerCMDAppsOption"][value="${tcaoValue}"]`);
        if (tcaoElement) {
            tcaoElement.checked = true;
        }
    }

    if (autoGenerateCheckbox) {
        const tcagValue = window.xldbv.configOpts.tcag;
        autoGenerateCheckbox.checked = tcagValue === 'on' || tcagValue === true;
    }

    if (addToPathCheckbox) {
        addToPathCheckbox.checked = window.xldbv.configOpts.inPath;
    }

    originalTriggerCmdConfig = getConfig('triggercmd');

    function saveAndUpdateTriggerCmdConfig() {
        js.F.updateSaveButtonState();
    }

    if (updateOptionRadios.length > 0) {
        updateOptionRadios.forEach(radio => radio.addEventListener('change', saveAndUpdateTriggerCmdConfig));
    }
    if (appsOptionRadios.length > 0) {
        appsOptionRadios.forEach(radio => radio.addEventListener('change', saveAndUpdateTriggerCmdConfig));
    }
    if (autoGenerateCheckbox) {
        autoGenerateCheckbox.addEventListener('change', saveAndUpdateTriggerCmdConfig);
    }
    if (addToPathCheckbox) {
        addToPathCheckbox.addEventListener('change', saveAndUpdateTriggerCmdConfig);
    }

    const updateTriggerCMDButton = document.getElementById('updateTriggerCMDFile');
    if (updateTriggerCMDButton) {
        updateTriggerCMDButton.addEventListener('click', runXltcScript);
    }

    js.F.updateSaveButtonState();
}

// Initialize update configuration
// This function initializes the update configuration section
async function initializeUpdateConfig() {
    const updateButton = document.getElementById('updateAppButton');
    if (updateButton) {
        updateButton.disabled = true;
    }

    const autoUpdateCheckbox = document.getElementById('checkUpdate');
    if (autoUpdateCheckbox) {
        const aupdValue = window.xldbv.configOpts.aupd;
        autoUpdateCheckbox.checked = aupdValue === 'on' || aupdValue === true;
    }

    const updateInfoPreview = document.getElementById('updateInfoPreview');
    updateInfoPreview.value = `Checking for updates. Please wait...\n\n`;
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
        const versionInfo = await js.F.getVersionInfo();
        const currentVersion = window.xldbv.version;
        if (currentVersion !== versionInfo.version) {
            updateInfoPreview.value += `New version available: ${versionInfo.version}\n\n`;
            
            // Check if versionInfo.comment exists and is not empty before adding it
            if (versionInfo.comment && typeof versionInfo.comment === 'string' && versionInfo.comment.trim() !== '') {
                updateInfoPreview.value += `Update Comment:\n\n`;
                updateInfoPreview.value += `${versionInfo.comment}\n\n`;
            }

            updateInfoPreview.value += `Files to be updated:\n\n`;
            const files = Object.keys(versionInfo.files);
            files.forEach(file => {
                updateInfoPreview.value += `- ${file}\n`;
            });
            const mainFiles = Object.keys(versionInfo.mainFiles);
            mainFiles.forEach(file => {
                updateInfoPreview.value += `- ${file}\n`;
            });
            if (versionInfo.directoryZips) {
                Object.keys(versionInfo.directoryZips).forEach(zipName => {
                    updateInfoPreview.value += `- ${zipName}\n`;
                });
            }
            if (updateButton) {
                updateButton.disabled = false;
                if (!updateButton.hasListener) {
                    updateButton.addEventListener('click', async () => {
                        try {
                            await js.F.updateFiles();
                            updateInfoPreview.value += `\nFiles have been updated successfully.\n`;
                            window.xldbv.version = versionInfo.version;
                            js.F.setData('xldbv', window.xldbv);
                        } catch (error) {
                            updateInfoPreview.value += `\nError updating files: ${error.message}`;
                        }
                        updateInfoPreview.scrollTop = updateInfoPreview.scrollHeight;
                    });
                    updateButton.hasListener = true;
                }
            }
        } else {
            updateInfoPreview.value += `You are using the latest version.\n`;
        }
    } catch (error) {
        updateInfoPreview.value += `Error fetching version info: ${error.message}\n`;
    }

    js.F.saveOriginalConfig('update');

    function saveAndUpdateConfig() {
        const autoUpdateCheckbox = document.getElementById('checkUpdate');
        if (autoUpdateCheckbox) {
            window.xldbv.configOpts.aupd = autoUpdateCheckbox.checked ? 'on' : 'off';
        }
        js.F.updateSaveButtonState();
    }

    if (autoUpdateCheckbox) {
        autoUpdateCheckbox.addEventListener('change', saveAndUpdateConfig);
    }

    js.F.updateSaveButtonState();
}

// Populate configuration fields
// This function populates the configuration fields with the provided config object
function populateConfigFields(config) {
    if (typeof config !== 'object' || config === null) {
        return;
    }

    setAndLogValue('dateFormat', config.dateFormat);
    setAndLogValue('timeFormat', config.timeFormat);
    setAndLogValue('leftEncapsule', config.leftEncapsule.replace(/^'|'$/g, ''));
    setAndLogValue('rightEncapsule', config.rightEncapsule.replace(/^'|'$/g, ''));
    setAndLogValue('messageSeperator', config.messageSeperator.replace(/^'|'$/g, ''));
    setAndLogValue('messagePrefix', config.messagePrefix.replace(/^'|'$/g, ''));
    setAndLogValue('maxLogEntries', config.maxLogEntries);

    const constructSelect = document.getElementById('construct');
    if (constructSelect) {
        const constructValue = config.construct === 'timeFormat dateFormat' ? '1' : '0';
        constructSelect.value = constructValue;
    }
}

// Set and log value
// This function sets the value of an element and logs the action
function setAndLogValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
        if (element.tagName === 'SELECT' || element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.value = value || '';
        }
    }
}

// Setup date and time format handlers
// This function sets up event handlers for date and time format changes
function setupDateTimeFormatHandlers() {
    const dateFormatSelect = document.getElementById('dateFormat');
    const timeFormatSelect = document.getElementById('timeFormat');
    const constructSelect = document.getElementById('construct');

    function updateConstructOptions() {
        const dateFormat = dateFormatSelect.value;
        const timeFormat = timeFormatSelect.value;

        constructSelect.innerHTML = '';

        const dateTimeOption = new Option(`${dateFormat} ${timeFormat}`, '0');
        const timeDateOption = new Option(`${timeFormat} ${dateFormat}`, '1');

        constructSelect.add(dateTimeOption);
        constructSelect.add(timeDateOption);

        const currentConstruct = js.F.getData('xlaunchConfig').construct;
        constructSelect.value = currentConstruct === 'timeFormat dateFormat' ? '1' : '0';
    }

    dateFormatSelect.addEventListener('change', updateConstructOptions);
    timeFormatSelect.addEventListener('change', updateConstructOptions);

    updateConstructOptions();
}

// Populate favourite icons
// This function populates the favourite icons dropdown
function populateFavouriteIcons() {
    const favouriteIconSelect = document.getElementById('favouriteIcon');
    
    const xldbv = js.F.getData('xldbv') || {};
    
    const favouriteSymbols = xldbv.favourite_symbols || '';
    const currentFavourite = xldbv.favourite || '';

    const symbols = favouriteSymbols.split(' ');

    favouriteIconSelect.innerHTML = '';

    symbols.forEach(symbol => {
        const option = new Option(symbol, symbol);
        favouriteIconSelect.add(option);

        if (symbol === currentFavourite) {
            option.selected = true;
        }
    });

    if (favouriteIconSelect.selectedIndex === -1 && favouriteIconSelect.options.length > 0) {
        favouriteIconSelect.selectedIndex = 0;
    }
}

// Format date
// This function formats a date according to the specified format
function formatDate(date, format) {
    function pad(num, size = 2) {
        return num.toString().padStart(size, '0');
    }
    
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours24 = pad(date.getHours());
    const hours12 = pad(date.getHours() % 12 || 12);
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const milliseconds = pad(date.getMilliseconds(), 3);
    const ampm = date.getHours() >= 12 ? 'PM' : 'AM';

    return format
        .replace(/yyyy/g, year)
        .replace(/yy/g, year.toString().slice(-2))
        .replace(/MM/g, month)
        .replace(/dd/g, day)
        .replace(/HH/g, hours24)
        .replace(/hh/g, hours12)
        .replace(/mm/g, minutes)
        .replace(/ss/g, seconds)
        .replace(/SSS/g, milliseconds)
        .replace(/a/g, ampm);
}

// Update log format preview
// This function updates the log format preview based on the current settings
function updateLogFormatPreview() {
    const dateFormat = document.getElementById('dateFormat').value;
    const timeFormat = document.getElementById('timeFormat').value;
    const construct = document.getElementById('construct').value;
    const leftEncapsule = document.getElementById('leftEncapsule').value;
    const rightEncapsule = document.getElementById('rightEncapsule').value;
    const messageSeperator = document.getElementById('messageSeperator').value;
    const messagePrefix = document.getElementById('messagePrefix').value;

    const sampleDate = new Date();
    const formattedDate = formatDate(sampleDate, dateFormat);
    const formattedTime = formatDate(sampleDate, timeFormat);

    let preview = leftEncapsule;
    if (construct === '1') {
        preview += `${formattedTime} ${formattedDate}`;
    } else {
        preview += `${formattedDate} ${formattedTime}`;
    }
    preview += rightEncapsule;
    preview += ` ${messageSeperator} ${messagePrefix} Sample Message`;

    const previewElement = document.getElementById('logFormatPreview');
    if (previewElement) {
        previewElement.textContent = preview;
    }
}

// Update selected configuration item
// This function updates the selected configuration item in the UI
function updateSelectedConfigItem(selectedSection) {
    const configItems = document.querySelectorAll('.config-item');
    configItems.forEach(item => {
        item.classList.remove('selected');
        if (item.dataset.config === selectedSection) {
            item.classList.add('selected');
        }
    });
}

// Run xltc script
// This function generates the TriggerCMD file
async function runXltcScript() {
    try {
        const configOpts = {
            tcuo: document.querySelector('input[name="triggerCMDUpdateOption"]:checked')?.value || 'overwrite',
            tcao: document.querySelector('input[name="triggerCMDAppsOption"]:checked')?.value || 'all'
        };
        const result = await e.Api.invoke('generate-triggercmd', configOpts);
        const statusElement = document.getElementById('triggerCmdUpdateStatus');
        if (result) {
            statusElement.textContent = 'TriggerCMD file updated successfully!';
            statusElement.classList.add('success');
            statusElement.classList.remove('error');
        } else {
            statusElement.textContent = 'Failed to update TriggerCMD file.';
            statusElement.classList.add('error');
            statusElement.classList.remove('success');
        }
        setTimeout(() => {
            statusElement.textContent = '';
            statusElement.classList.remove('success', 'error');
        }, 5000);
    } catch (error) {
        const statusElement = document.getElementById('triggerCmdUpdateStatus');
        statusElement.textContent = 'Failed to update TriggerCMD file.';
        statusElement.classList.add('error');
        statusElement.classList.remove('success');
        setTimeout(() => {
            statusElement.textContent = '';
            statusElement.classList.remove('success', 'error');
        }, 5000);
    }
}

// Generate xlaunch.cfg content
// This function generates the content for the xlaunch.cfg file
function generateXlaunchCfgContent() {
    const constructValue = document.getElementById('construct').value;
    const construct = constructValue === '0' ? 'dateFormat timeFormat' : 'timeFormat dateFormat';

    const configBuild = {
        maxLogEntries: document.getElementById('maxLogEntries').value,
        dateFormat: document.getElementById('dateFormat').value,
        timeFormat: document.getElementById('timeFormat').value,
        construct: construct,
        leftEncapsule: `'${document.getElementById('leftEncapsule').value}'`,
        rightEncapsule: `'${document.getElementById('rightEncapsule').value}'`,
        messageSeperator: `'${document.getElementById('messageSeperator').value}'`,
        messagePrefix: `'${document.getElementById('messagePrefix').value}'`,
    };

    return Object.entries(configBuild)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
}

// Expose functions to the global scope
window.configurationFunctions = {
    fetchFile,
    getVersionInfo,
    updateFiles,
    fetchConfigSections,
    setupConfigList,
    loadConfigSection,
    getConfig,
    initializeGeneralConfig,
    initializeTriggerCmdConfig,
    initializeUpdateConfig,
    populateConfigFields,
    setupDateTimeFormatHandlers,
    populateFavouriteIcons,
    formatDate,
    updateLogFormatPreview,
    updateSelectedConfigItem,
    runXltcScript,
    setAndLogValue,
    generateXlaunchCfgContent
};