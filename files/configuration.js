// Configuration management and utilities

// Get Version Data
// Fetches the version information from the specified URL
async function getVersionInfo() {
    const baseUrl = window.xldbv.uurl;
    const url = `${baseUrl}/version.json`;
    return await js.F.fetchFile(url, 'json');
}

// Scroll To Text
// Scrolls element content to specified text location efficiently
function scrollToLine(element, text) {
    if (!element || !text) return;
    
    const content = element.textContent || element.innerText;
    const lines = content.split('\n');
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

// Get Text Height
// Measures text line height using temporary DOM element
function getLineHeight(element) {
    const temp = document.createElement('div');
    temp.style.position = 'absolute';
    temp.style.visibility = 'hidden';
    temp.style.whiteSpace = 'pre-wrap';
    temp.style.font = getComputedStyle(element).font;
    temp.innerText = 'A';
    document.body.appendChild(temp);
    const lineHeight = temp.clientHeight;
    document.body.removeChild(temp);
    return lineHeight;
}

// Setup Config UI
// Manages TriggerCMD visibility based on file system state
async function setupConfigList() {
    const triggerCmdFileExists = await e.Api.invoke('check-triggercmd-file');
    const triggerCmdItem = document.querySelector('[data-config="triggercmd"]');

    if (triggerCmdFileExists) {
        triggerCmdItem.style.display = 'block';
    } else {
        triggerCmdItem.style.display = 'none';
    }
}

// Load Config View
// Initializes and displays selected configuration section with state management
function loadConfigSection(section) {
    currentSection = section;
    const configDisplay = document.getElementById('configDisplay');

    if (window.configSections && window.configSections[section]) {
        configDisplay.innerHTML = window.configSections[section];
    } else {
        return;
    }

    window.currentSectionTemp = {};
    switch (section) {
        case 'general':
            window.currentSectionTemp.xlaunchConfig = { ...js.F.getData('xlaunchConfig') };
            window.currentSectionTemp.theme = {
                favourite: window.xldbv.configOpts.theme.favourite,
                rowSelector: window.xldbv.configOpts.theme.rowSelector,
                rowWidth: window.xldbv.configOpts.theme.rowWidth
            };
            window.currentSectionTemp.system = { ...window.xldbv.configOpts.system };
            break;
        case 'triggercmd':
            window.currentSectionTemp.triggercmd = { ...window.xldbv.configOpts.triggercmd };
            break;
        case 'update':
            window.currentSectionTemp.updates = { ...window.xldbv.configOpts.updates };
            break;
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
    js.F.updateSaveButtonState();
}

// Setup Config State
// Sets up all configuration components and initializes their states
function initializeConfiguration() {
    loadGeneralConfig();
    loadTriggerCmdConfig();
    loadUpdateConfig();
    updateLogFormatPreview();
}

// Setup General Options
// Sets up logging, theme and system component settings
function initializeGeneralConfig() {
    const loggingConfig = js.F.getData('xlaunchConfig') || {
        dateFormat: 'dd-MM-yy',
        timeFormat: 'HH:mm:ss',
        construct: 'dateFormat timeFormat',
        leftEncapsule: "'['",
        rightEncapsule: "']'",
        messageSeperator: "'>'",
        messagePrefix: "'Launching:'",
        maxLogEntries: 1001
    };

    window.xlaunchConfigTemp = { ...loggingConfig };

    const themeConfig = window.xldbv.configOpts?.theme || {
        favourite: '★',
        rowSelector: 'indent',
        rowWidth: 100
    };

    const systemConfig = window.xldbv.configOpts?.system || {
        show: false,
        minimizeTo: false,
        closeTo: false,
        startWithWindows: false,
        startMinimized: false
    };

    populateConfigFields(loggingConfig);
    setupDateTimeFormatHandlers();
    populateFavouriteIcons();
    updateLogFormatPreview();

    document.getElementById('favouriteIcon').value = themeConfig.favourite || '★';
    document.getElementById('showTray').checked = systemConfig.show || false;
    document.getElementById('minimizeToTray').checked = systemConfig.minimizeTo || false;
    document.getElementById('closeToTray').checked = systemConfig.closeTo || false;
    document.getElementById('startWithWindows').checked = systemConfig.startWithWindows || false;

    loadRowSelectors();
    setupHighlightWidthSlider();

    const systemElements = ['showTray', 'minimizeToTray', 'closeToTray', 'startWithWindows', 'startMinimized'];
    systemElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', () => {
                js.F.updateSaveButtonState();
            });
        }
    });

    document.getElementById('favouriteIcon').addEventListener('change', () => {
        js.F.updateSaveButtonState();
    });

    const highlightWidth = document.getElementById('highlightWidth');
    if (highlightWidth) {
        highlightWidth.addEventListener('input', (e) => {
            const value = e.target.value;
            document.getElementById('highlightWidthValue').textContent = `${value}%`;
            js.F.updateSaveButtonState();
        });
    }

    initializeSystemConfig();
}

// Initialize system configuration
// Sets up system-related settings and their event handlers
function initializeSystemConfig() {
    const systemConfig = window.xldbv.configOpts?.system || {
        show: false,
        minimizeTo: false,
        closeTo: false,
        startWithWindows: false,
        startMinimized: false
    };

    if (!window.currentSectionTemp) window.currentSectionTemp = {};
    if (!window.currentSectionTemp.system) window.currentSectionTemp.system = { ...systemConfig };

    const showTray = document.getElementById('showTray');
    const minimizeToTray = document.getElementById('minimizeToTray');
    const closeToTray = document.getElementById('closeToTray');
    const startWithWindows = document.getElementById('startWithWindows');
    const startMinimized = document.getElementById('startMinimized');

    if (showTray) {
        showTray.checked = systemConfig.show;
        showTray.addEventListener('change', updateSystemConfigTemp);
        // Initial enable/disable based on loaded config
        if (minimizeToTray && closeToTray) {
            minimizeToTray.disabled = !systemConfig.show;
            closeToTray.disabled = !systemConfig.show;
        }
    }
    if (minimizeToTray) {
        minimizeToTray.checked = systemConfig.minimizeTo;
        minimizeToTray.addEventListener('change', updateSystemConfigTemp);
    }
    if (closeToTray) {
        closeToTray.checked = systemConfig.closeTo;
        closeToTray.addEventListener('change', updateSystemConfigTemp);
    }
    if (startWithWindows) {
        startWithWindows.checked = systemConfig.startWithWindows;
        startWithWindows.addEventListener('change', updateSystemConfigTemp);
    }
    if (startMinimized) {
        startMinimized.checked = systemConfig.startMinimized;
        startMinimized.addEventListener('change', updateSystemConfigTemp);
        // Start minimized requires both show and startWithWindows to be enabled
        if (systemConfig.show && systemConfig.startWithWindows) {
            startMinimized.disabled = false;
        }
    }
}

// Update System Config
// Updates temporary configuration when system settings are changed
function updateSystemConfigTemp() {
    if (!window.currentSectionTemp) window.currentSectionTemp = {};
    
    // Get all checkbox elements
    const showTray = document.getElementById('showTray');
    const minimizeToTray = document.getElementById('minimizeToTray');
    const closeToTray = document.getElementById('closeToTray');
    const startWithWindows = document.getElementById('startWithWindows');
    const startMinimized = document.getElementById('startMinimized');

    // Update the configuration
    window.currentSectionTemp.system = {
        show: showTray?.checked || false,
        minimizeTo: minimizeToTray?.checked || false,
        closeTo: closeToTray?.checked || false,
        startWithWindows: startWithWindows?.checked || false,
        startMinimized: startMinimized?.checked || false
    };

    // Handle dependency enabling/disabling
    if (minimizeToTray && closeToTray && showTray) {
        minimizeToTray.disabled = !showTray.checked;
        closeToTray.disabled = !showTray.checked;
    }

    if (startMinimized && startWithWindows && showTray) {
        // Only enable startMinimized if both show and startWithWindows are checked
        const canStartMinimized = showTray.checked && startWithWindows.checked;
        startMinimized.disabled = !canStartMinimized;
        
        // If we're disabling the checkbox, also uncheck it
        if (!canStartMinimized && startMinimized.checked) {
            startMinimized.checked = false;
            window.currentSectionTemp.system.startMinimized = false;
        }
    }

    js.F.updateSaveButtonState();
}

// Manage Startup Entry
// Creates or removes Windows startup entry based on user preference
async function handleStartupShortcut(enabled) {
    try {
        if (enabled) {
            await e.Api.invoke('create-startup-shortcut');
        } else {
            await e.Api.invoke('remove-startup-shortcut');
        }
    } catch (error) {
        console.error('Error in handleStartupShortcut:', error);
    }
}

// Update Log Config
// Synchronizes form field values with temporary configuration storage
function updateLoggingConfigTemp() {
    window.currentSectionTemp.xlaunchConfig = {
        dateFormat: document.getElementById('dateFormat').value,
        timeFormat: document.getElementById('timeFormat').value,
        construct: document.getElementById('construct').value === '1' ? 'timeFormat dateFormat' : 'dateFormat timeFormat',
        leftEncapsule: `'${document.getElementById('leftEncapsule').value}'`,
        rightEncapsule: `'${document.getElementById('rightEncapsule').value}'`,
        messageSeperator: `'${document.getElementById('messageSeperator').value}'`,
        messagePrefix: `'${document.getElementById('messagePrefix').value}'`,
        maxLogEntries: document.getElementById('maxLogEntries').value
    };
}

// Setup TriggerCmd Options
// Sets up TriggerCMD configuration options and initializes event handlers
function initializeTriggerCmdConfig() {
    const triggerConfig = window.xldbv.configOpts?.triggercmd || {
        overwriteFile: 'keep',
        addCommands: 'favourited',
        autoGenerate: true,
        inPath: true
    };

    if (!window.xldbvTemp.configOpts) window.xldbvTemp.configOpts = {};
    if (!window.xldbvTemp.configOpts.triggercmd) window.xldbvTemp.configOpts.triggercmd = { ...triggerConfig };

    const updateOptionRadios = document.getElementsByName('triggerCMDUpdateOption');
    const appsOptionRadios = document.getElementsByName('triggerCMDAppsOption');
    const autoGenerateCheckbox = document.getElementById('autoGenerateTriggerCMD');
    const addToPathCheckbox = document.getElementById('addToPath');
    const updateButton = document.getElementById('updateTriggerCMDFile');
    
    const overwriteElement = document.querySelector(`input[name="triggerCMDUpdateOption"][value="${triggerConfig.overwriteFile}"]`);
    if (overwriteElement) {
        overwriteElement.checked = true;
    }

    const addCommandsElement = document.querySelector(`input[name="triggerCMDAppsOption"][value="${triggerConfig.addCommands}"]`);
    if (addCommandsElement) {
        addCommandsElement.checked = true;
    }

    if (autoGenerateCheckbox) {
        autoGenerateCheckbox.checked = triggerConfig.autoGenerate;
    }
    if (addToPathCheckbox) {
        addToPathCheckbox.checked = triggerConfig.inPath;
    }

    const elements = [...updateOptionRadios, ...appsOptionRadios, autoGenerateCheckbox, addToPathCheckbox];
    elements.forEach(element => {
        if (element) {
            element.addEventListener('change', () => {
                updateTriggerCmdTemp();
                js.F.updateSaveButtonState();
            });
        }
    });

    if (updateButton) {
        updateButton.addEventListener('click', runXltcScript);
    }
}

// Initialize update configuration
// Configures update settings and handles update process events
async function initializeUpdateConfig() {
    const updateConfig = window.xldbv.configOpts?.updates || {
        autoCheck: true,
        periodic: {
            enable: false,
            interval: 24
        }
    };

    if (!window.xldbvTemp.configOpts) window.xldbvTemp.configOpts = {};
    if (!window.xldbvTemp.configOpts.updates) window.xldbvTemp.configOpts.updates = { ...updateConfig };

    const checkUpdate = document.getElementById('checkUpdate');
    const periodicUpdateCheck = document.getElementById('periodicUpdateCheck');
    const updateFrequency = document.getElementById('updateFrequency');
    const updateButton = document.getElementById('updateAppButton');
    const updateInfoPreview = document.getElementById('updateInfoPreview');

    if (checkUpdate) {
        checkUpdate.checked = updateConfig.autoCheck;
    }
    if (periodicUpdateCheck) {
        periodicUpdateCheck.checked = updateConfig.periodic?.enable || false;
    }
    if (updateFrequency) {
        updateFrequency.value = updateConfig.periodic?.interval || 24;
    }

    [checkUpdate, periodicUpdateCheck, updateFrequency].forEach(element => {
        if (element) {
            element.addEventListener('change', () => {
                updateUpdateConfigTemp();
                js.F.updateSaveButtonState();
            });
        }
    });

    updateInfoPreview.innerHTML = 'Checking for updates. Please wait...\n\n';
    try {
        const { text, hasUpdate } = await js.F.checkForUpdates();
        updateInfoPreview.innerHTML = text;
        if (updateButton) updateButton.disabled = !hasUpdate;
    } catch (error) {
        updateInfoPreview.innerHTML = error.message;
        if (updateButton) updateButton.disabled = true;
    }

    updateButton.addEventListener('click', async () => {
        try {
            updateButton.disabled = true;
            js.F.showUpdateOverlay();

            const updateInfo = await js.F.getUpdateInfo();

            if (!updateInfo.hasUpdate) {
                updateButton.disabled = true;
                return;
            }

            // Initialize the progress handler
            const success = await js.F.handleUpdateProcess(updateInfo);

            if (typeof window.updateState.progressHandler !== 'function') {
                throw new Error('Progress handler is not available');
            }

            await js.F.updateFiles((file) => {
                const newText = window.updateState.progressHandler(file);
                if (newText !== updateInfoPreview.innerHTML) {
                    updateInfoPreview.innerHTML = newText;
                    scrollToLine(updateInfoPreview, file);
                }
            });

            const completionMessage = '~ Update completed successfully! ~';
            const restartMessage = '* Application will require a restart to finalize. *';
            
            // Update content with the link
            const currentContent = updateInfoPreview.innerHTML;
            updateInfoPreview.innerHTML = currentContent + 
                `\n\nClick <span class="update-link">here</span> for more information about this update.\n\n${completionMessage}\n${restartMessage}`;

            // Scroll to the restart message
            scrollToLine(updateInfoPreview, restartMessage);

        } catch (error) {
            updateInfoPreview.innerHTML = `Error during update: ${error.message}`;
            updateButton.disabled = false;
        } finally {
            js.F.hideUpdateOverlay();
        }
    });
}

// Update TriggerCmd Config
// Synchronizes TriggerCMD configuration with current form field values
function updateTriggerCmdTemp() {
    window.currentSectionTemp.triggercmd = {
        overwriteFile: document.querySelector('input[name="triggerCMDUpdateOption"]:checked')?.value || 'keep',
        addCommands: document.querySelector('input[name="triggerCMDAppsOption"]:checked')?.value || 'favourited',
        autoGenerate: document.getElementById('autoGenerateTriggerCMD')?.checked ?? true,
        inPath: document.getElementById('addToPath')?.checked ?? true
    };
}

// Update Update Config
// Synchronizes update configuration with current form field values
function updateUpdateConfigTemp() {
    window.currentSectionTemp.updates = {
        autoCheck: document.getElementById('checkUpdate')?.checked ?? true,
        periodic: {
            enable: document.getElementById('periodicUpdateCheck')?.checked ?? false,
            interval: parseInt(document.getElementById('updateFrequency')?.value ?? '24')
        }
    };
}

// Fill Config Fields
// Initializes form fields with values from configuration object
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

// Set Field Value
// Updates form element value with validation and error handling
function setAndLogValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
        if (element.tagName === 'SELECT' || element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.value = value || '';
        }
    }
}

// Setup Format Handlers
// Configures event handlers for date and time format changes
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

// Load Icon Options
// Loads available favorite icons and sets current selection
function populateFavouriteIcons() {
    const favouriteIconSelect = document.getElementById('favouriteIcon');
    
    const xldbv = js.F.getData('xldbv') || {};
    
    const favouriteSymbols = xldbv.favourite_symbols || '';
    const currentFavourite = xldbv.configOpts?.theme?.favourite || '';

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

// Format Date String
// Formats date object according to specified pattern string
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

// Update Log Preview
// Generates preview of log entry using current format settings
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

// Update Selected Item
// Updates visual state of configuration items in navigation menu
function updateSelectedConfigItem(selectedSection) {
    const configItems = document.querySelectorAll('.config-item');
    configItems.forEach(item => {
        item.classList.remove('selected');
        if (item.dataset.config === selectedSection) {
            item.classList.add('selected');
        }
    });
}

// Run XLTC Script
// Executes TriggerCMD file generation and handles status updates
async function runXltcScript() {
    try {
        const configOpts = {
            overwriteFile: document.querySelector('input[name="triggerCMDUpdateOption"]:checked')?.value || 'keep',
            addCommands: document.querySelector('input[name="triggerCMDAppsOption"]:checked')?.value || 'favourited'
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

// Generate Config Content
// Builds configuration file content from current form field values
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

// Load Tray Options
// Loads and applies system tray configuration from stored settings
function loadTraySettings() {
    const systemConfig = window.xldbv.configOpts?.system || {
        show: true,
        minimizeTo: false,
        closeTo: false,
        startWithWindows: false
    };
    
    document.getElementById('showTray').checked = systemConfig.show;
    document.getElementById('minimizeToTray').checked = systemConfig.minimizeTo;
    document.getElementById('closeToTray').checked = systemConfig.closeTo;
    document.getElementById('startWithWindows').checked = systemConfig.startWithWindows;
}

// Select Row Style
// Updates row selector interface and saves current selection state
function selectRowSelector(fileName, svgElement, customSelect, selectedValue, optionsContainer) {
    if (svgElement && customSelect && selectedValue) {
        selectedValue.innerHTML = '';
        selectedValue.appendChild(svgElement.cloneNode(true));
        customSelect.dataset.value = fileName;
        if (optionsContainer) {
            optionsContainer.classList.remove('show');
        }
        
        if (!window.currentSectionTemp) window.currentSectionTemp = {};
        if (!window.currentSectionTemp.theme) window.currentSectionTemp.theme = {};
        window.currentSectionTemp.theme.rowSelector = fileName;
        
        js.F.updateSaveButtonState();
    }
}

// Load Row Options
// Initializes row selector dropdown with available SVG options
async function loadRowSelectors() {
    try {
        const appDir = await e.Api.invoke('get-app-dir');
        const themesDir = js.F.dirVar('themes');
        const selectorsPath = js.F.joinPath(appDir, 'common', themesDir, 'selectors');
        const files = await e.Api.invoke('read-directory', selectorsPath);
        
        const svgFiles = files.filter(file => file.endsWith('.svg'));
        const customSelect = document.querySelector('.custom-select');
        const selectedValue = customSelect?.querySelector('.selected-value');
        const optionsContainer = customSelect?.querySelector('.options-container');
        
        if (customSelect && selectedValue && optionsContainer) {
            optionsContainer.innerHTML = '';
            
            for (const file of svgFiles) {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'option';
                const fileName = file.replace('.svg', '');
                optionDiv.dataset.value = fileName;
                
                const svgContent = await js.F.generateRowSelectorSVG(`${file}`);
                if (svgContent) {
                    const svgContainer = document.createElement('div');
                    svgContainer.innerHTML = svgContent;
                    optionDiv.appendChild(svgContainer.firstChild);
                    
                    if (!selectedValue.hasChildNodes()) {
                        selectRowSelector(fileName, svgContainer.firstChild, customSelect, selectedValue);
                    }
                    
                    optionDiv.addEventListener('click', async () => {
                        const newSvgContent = await js.F.generateRowSelectorSVG(`${file}`);
                        const newContainer = document.createElement('div');
                        newContainer.innerHTML = newSvgContent;
                        selectRowSelector(fileName, newContainer.firstChild, customSelect, selectedValue, optionsContainer);
                    });
                }
                
                optionsContainer.appendChild(optionDiv);
            }
            
            selectedValue.addEventListener('click', (e) => {
                e.stopPropagation();
                optionsContainer.classList.toggle('show');
            });
            
            document.addEventListener('click', () => {
                optionsContainer.classList.remove('show');
            });

            const savedSelector = window.xldbv.configOpts?.theme?.rowSelector || 'rectangle';
            if (savedSelector) {
                for (const option of optionsContainer.children) {
                    if (option.dataset.value === savedSelector) {
                        const svgElement = option.querySelector('svg');
                        if (svgElement) {
                            selectRowSelector(savedSelector, svgElement, customSelect, selectedValue);
                        }
                        break;
                    }
                }
            }
        }
    } catch (error) {
        return null;
    }
}

// Get General Settings
// Retrieves general configuration including system and theme settings
function getGeneralConfig() {
    const customSelect = document.querySelector('.custom-select');
    return {
        ...window.currentSectionTemp.xlaunchConfig,
        system: window.currentSectionTemp.system,
        theme: window.currentSectionTemp.theme
    };
}

// Get TriggerCmd Settings
// Retrieves current TriggerCMD configuration from temporary storage
function getTriggerCmdConfig() {
    return {
        triggercmd: window.currentSectionTemp.triggercmd
    };
}

// Get Update Settings
// Retrieves current update configuration from temporary storage
function getUpdateConfig() {
    return {
        updates: window.currentSectionTemp.updates
    };
}

// Setup Width Slider
// Initializes highlight width slider with event handlers and values
function setupHighlightWidthSlider() {
    const highlightWidth = document.getElementById('highlightWidth');
    const highlightWidthValue = document.getElementById('highlightWidthValue');
    
    if (highlightWidth && highlightWidthValue) {
        const savedWidth = window.xldbv?.configOpts?.theme?.rowWidth || 100;
        
        highlightWidth.value = savedWidth;
        highlightWidthValue.textContent = `${savedWidth}%`;

        if (!window.xldbvTemp) window.xldbvTemp = {};
        if (!window.xldbvTemp.configOpts) window.xldbvTemp.configOpts = {};
        if (!window.xldbvTemp.configOpts.theme) window.xldbvTemp.configOpts.theme = {};
        window.xldbvTemp.configOpts.theme.rowWidth = savedWidth;

        highlightWidth.addEventListener('input', (e) => {
            const value = e.target.value;
            highlightWidthValue.textContent = `${value}%`;
            
            if (!window.xldbvTemp) window.xldbvTemp = {};
            if (!window.xldbvTemp.configOpts) window.xldbvTemp.configOpts = {};
            if (!window.xldbvTemp.configOpts.theme) window.xldbvTemp.configOpts.theme = {};
            window.xldbvTemp.configOpts.theme.rowWidth = parseInt(value);
        });

        highlightWidth.addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            
            if (!window.xldbvTemp) window.xldbvTemp = {};
            if (!window.xldbvTemp.configOpts) window.xldbvTemp.configOpts = {};
            if (!window.xldbvTemp.configOpts.theme) window.xldbvTemp.configOpts.theme = {};
            window.xldbvTemp.configOpts.theme.rowWidth = value;
            
            js.F.updateSaveButtonState();
        });
    }
}

// Get Config Section
// Returns configuration object for the specified section type
function getConfig(section) {
    switch (section) {
        case 'general':
            return getGeneralConfig();
        case 'triggercmd':
            return getTriggerCmdConfig();
        case 'update':
            return getUpdateConfig();
        default:
            return {};
    }
}

// Handle Config Events
// Processes form changes and updates all related configuration states
function handleConfigChanges(event) {
    if (!currentSection) return;
    
    const target = event.target;
    if (!target || !target.id) return;

    if (target.id === 'messagePrefix') {
        js.F.debounce(() => {
            updateLoggingConfigTemp();
            updateLogFormatPreview();
            js.F.updateSaveButtonState();
        }, 300)();
        return;
    }

    if (target.id === 'highlightWidth' && event.type === 'input') {
        const value = target.value;
        document.getElementById('highlightWidthValue').textContent = `${value}%`;
        return;
    }
    
    switch(currentSection) {
        case 'general':
            handleGeneralChanges(target);
            break;
        case 'triggercmd':
            updateTriggerCmdTemp();
            break;
        case 'update':
            updateUpdateConfigTemp();
            break;
    }
    
    js.F.updateSaveButtonState();
}

// Handle General Events
// Processes general configuration changes and updates all related states
function handleGeneralChanges(element) {
    if (!element) return;

    if (['showTray', 'minimizeToTray', 'closeToTray', 'startWithWindows'].includes(element.id)) {
        window.currentSectionTemp.system = {
            show: document.getElementById('showTray').checked,
            minimizeTo: document.getElementById('minimizeToTray').checked,
            closeTo: document.getElementById('closeToTray').checked,
            startWithWindows: document.getElementById('startWithWindows').checked
        };
        return;
    }

    if (['dateFormat', 'timeFormat', 'construct', 'leftEncapsule', 'rightEncapsule', 
         'messageSeperator', 'messagePrefix', 'maxLogEntries'].includes(element.id)) {
        updateLoggingConfigTemp();
        updateLogFormatPreview();
        return;
    }

    if (['favouriteIcon', 'rowSelector', 'highlightWidth'].includes(element.id)) {
        if (!window.currentSectionTemp.theme) {
            window.currentSectionTemp.theme = {};
        }
        
        switch (element.id) {
            case 'favouriteIcon':
                window.currentSectionTemp.theme.favourite = element.value;
                break;
            case 'rowSelector':
                window.currentSectionTemp.theme.rowSelector = element.value;
                break;
            case 'highlightWidth':
                window.currentSectionTemp.theme.rowWidth = parseInt(element.value);
                break;
        }
    }
}

// Setup Change Listener
// Attaches event handlers to process all configuration changes
function setupConfigChangeListener() {
    const configDisplay = document.getElementById('configDisplay');
    if (configDisplay) {
        configDisplay.addEventListener('change', handleConfigChanges);
        configDisplay.addEventListener('input', handleConfigChanges);
    }
}

// Save configuration
// Saves and processes all configuration changes across different sections
async function saveConfiguration(skipDialog = false) {
    const promises = [];

    switch (currentSection) {
        case 'general': {
            if (window.currentSectionTemp.system) {
                const systemConfig = window.currentSectionTemp.system;
                if (systemConfig.show !== window.xldbv.configOpts.system.show) {
                    promises.push(e.Api.invoke('update-tray-visibility', systemConfig.show));
                }
                if (systemConfig.startWithWindows !== window.xldbv.configOpts.system.startWithWindows) {
                    promises.push(js.F.handleStartupShortcut(systemConfig.startWithWindows));
                }
            }
            
            js.F.setData('xlaunchConfig', window.currentSectionTemp.xlaunchConfig);
            window.xldbv.configOpts.theme.favourite = window.currentSectionTemp.theme.favourite;
            window.xldbv.configOpts.theme.rowSelector = window.currentSectionTemp.theme.rowSelector;
            window.xldbv.configOpts.theme.rowWidth = window.currentSectionTemp.theme.rowWidth;
            window.xldbv.configOpts.system = { ...window.currentSectionTemp.system };
            break;
        }
        case 'triggercmd': {
            const oldInPath = window.xldbv.configOpts.triggercmd?.inPath ?? false;
            const newInPath = window.currentSectionTemp.triggercmd?.inPath ?? false;
            
            // Handle PATH modification if the setting changed
            if (oldInPath !== newInPath) {
                try {
                    // Wait for the PATH modification to complete
                    if (newInPath) {
                        await e.Api.invoke('add-to-path');
                    } else {
                        await e.Api.invoke('remove-from-path');
                    }
                } catch (error) {
                    console.error('PATH modification failed:', error);
                }
            }
            
            window.xldbv.configOpts.triggercmd = { ...window.currentSectionTemp.triggercmd };
            break;
        }
        case 'update': {
            window.xldbv.configOpts.updates = { ...window.currentSectionTemp.updates };
            break;
        }
    }
    
    js.F.setData('xldbv', window.xldbv);
    await js.F.updateVariablesOnExit();
    await Promise.all(promises);
    
    saveOriginalConfig(currentSection);
    js.F.updateSaveButtonState();
    
    // Only show dialog if not explicitly skipped
    if (!skipDialog) {
        await showSaveConfigDialog(currentSection);
    }
    
    return true;
}


// Export configuration functions
window.configurationFunctions = {
    setupConfigList,
    loadConfigSection,
    getConfig,
    setupConfigChangeListener,
    generateXlaunchCfgContent,
    getVersionInfo,
    fetchFile
};