// Configuration Module
// Handles all configuration settings and user interface interactions

// Core configuration state and defaults
let activeConfigPanel = null;
let configDefaults = {
    logging: {
        dateFormat: 'dd-MM-yy',
        timeFormat: 'HH:mm:ss',
        construct: 'dateFormat timeFormat',
        leftEncapsule: "'['",
        rightEncapsule: "']'",
        messageSeperator: "'>'",
        messagePrefix: "'Launching:'",
        maxLogEntries: 1001
    },
    theme: {
        favourite: '★',
        rowSelector: 'indent',
        rowWidth: 100
    },
    system: {
        show: false,
        minimizeTo: false,
        closeTo: false,
        startWithWindows: false,
        startMinimized: false
    },
    triggercmd: {
        overwriteFile: 'keep',
        addCommands: 'favourited',
        autoGenerate: true,
        inPath: true
    },
    update: {
        autoCheck: true,
        periodic: {
            enable: false,
            interval: 24
        }
    }
};

// Initialize Configuration Process
// Sets up and loads all configuration interface components and states
export async function initializeConfiguration() {
    window[getStateName('b', 'general')] = {
        xlaunchConfig: { ...configDefaults.logging, ...xlp.getData('xlaunchConfig') },
        theme: { ...configDefaults.theme, ...window.xldbv.configOpts.theme },
        system: { ...configDefaults.system, ...window.xldbv.configOpts.system }
    };
    window[getStateName('b', 'triggercmd')] = { ...configDefaults.triggercmd, ...window.xldbv.configOpts.triggercmd };
    window[getStateName('b', 'update')] = { ...configDefaults.update, ...window.xldbv.configOpts.updates };

    window[getStateName('t', 'general')] = null;
    window[getStateName('t', 'triggercmd')] = null;
    window[getStateName('t', 'update')] = null;

    await setupConfigList();
    await populateFavouriteIcons();
    await loadRowSelectors();
    setupHighlightWidthSlider();
    await loadConfigSection('general');
    
    try {
        const updateIndicator = document.getElementById('updateIndicator');
        xlp.getUpdateInfo().then(({ hasUpdate }) => {
            if (updateIndicator && hasUpdate) {
                updateIndicator.classList.add('visible');
            }
        });
    } catch (error) { }
    
    const configDetails = document.querySelector('.config-details');
    if (configDetails) {
        configDetails.addEventListener('change', (e) => {
            const target = e.target;
            
            if (['dateFormat', 'timeFormat', 'construct', 'leftEncapsule', 
                 'rightEncapsule', 'messageSeperator', 'maxLogEntries'].includes(target.id)) {
                if (['dateFormat', 'timeFormat'].includes(target.id)) {
                    updateConstructOptions();
                }
                updateConfigTemp('general', 'logging');
                if (target.id !== 'maxLogEntries') {
                    updateLogFormatPreview();
                }
            }
            else if (target.type === 'checkbox') {
                if (target.id.match(/^(showTray|minimizeToTray|closeToTray|startWithWindows|startMinimized)$/)) {
                    updateConfigTemp('general', 'system');
                } else if (target.id.match(/^(checkUpdate|periodicUpdateCheck)$/)) {
                    updateConfigTemp('update');
                }
            }
            else if (target.tagName === 'SELECT') {
                if (target.id === 'favouriteIcon') {
                    updateConfigTemp('general', 'theme');
                } else if (target.id === 'updateFrequency') {
                    updateConfigTemp('update');
                }
            }
            else if (target.type === 'range') {
                if (target.id === 'highlightWidth') {
                    updateConfigTemp('general', 'theme');
                }
            }
            else if (target.type === 'radio') {
                if (target.name === 'triggerCMDUpdateOption' || target.name === 'triggerCMDAppsOption') {
                    updateConfigTemp('triggercmd');
                }
            }
            
            xlp.updateGreenButtonState();
        });

        configDetails.addEventListener('input', xlp.debounce((e) => {
            const target = e.target;
            if (target.id === 'messagePrefix') {
                updateConfigTemp('general', 'logging');
                updateLogFormatPreview();
                xlp.updateGreenButtonState();
            }
        }, 300));
    }
    
    updateConstructOptions();
    xlp.verifyAndSetSection();
    setupEventListeners();
}

// State Name Generator
// Generates unique state identifiers for managing multiple configuration panels
function getStateName(type, section) {
    if (!section) {
        return null;
    }
    const prefix = type === 'b' ? 'base' : 'temp';
    const stateName = `${prefix}${section.charAt(0).toUpperCase()}${section.slice(1)}State`;
    return stateName;
}

// Setup Event System
// Configures event delegation and handlers for all configuration interactions
function setupEventListeners() {
    const configList = document.getElementById('configList');
    if (configList) {
        configList.addEventListener('click', async (e) => {
            const configItem = e.target.closest('.config-item');
            if (!configItem) return;

            const newSection = configItem.dataset.config;
            if (newSection === activeConfigPanel) return;

            if (hasUnsavedChanges()) {
                const shouldSave = await xlp.showConfigChangeDialog(activeConfigPanel);
                if (shouldSave) {
                    saveCurrentSection();
                }
            }
            loadConfigSection(newSection);
        });
    }

    const updateAppButton = document.getElementById('updateAppButton');
    if (updateAppButton) {
        updateAppButton.addEventListener('click', async () => {
            try {
                const updateInfo = await xlp.getUpdateInfo();
                if (!updateInfo.hasUpdate) return;

                xlp.showUpdateOverlay();
                await xlp.handleUpdateProcess(updateInfo);
                const success = await xlp.updateFiles((file) => {
                    if (window.updateState.progressHandler) {
                        const newText = window.updateState.progressHandler(file);
                        const updateInfoPreview = document.getElementById('updateInfoPreview');
                        if (updateInfoPreview && newText) {
                            updateInfoPreview.innerHTML = newText;
                        }
                    }
                });

                if (success) {
                    const updateInfoPreview = document.getElementById('updateInfoPreview');
                    if (updateInfoPreview) {
                        updateInfoPreview.innerHTML += '\n\nUpdate completed successfully.' + 
                            (updateInfo.requiresRestart ? '\nPlease restart the application for the changes to take effect.' : '');
                    }
                    xlp.scrollToLine(updateInfoPreview, 'Please restart');
                    await loadConfigSection('update');
                    
                    // Hide the update indicator after successful update
                    const updateIndicator = document.getElementById('updateIndicator');
                    if (updateIndicator) {
                        updateIndicator.classList.remove('visible');
                    }
                }
            } catch (error) {
                const updateInfoPreview = document.getElementById('updateInfoPreview');
                if (updateInfoPreview) {
                    updateInfoPreview.innerHTML = `Error updating: ${error.message}`;
                }
            } finally {
                xlp.hideUpdateOverlay();
            }
        });
    }

    document.querySelectorAll('.config-section').forEach(section => {
        section.addEventListener('change', (e) => {
            const target = e.target;
            
            if (target.type === 'checkbox') {
                if (target.id.match(/^(showTray|minimizeToTray|closeToTray|startWithWindows|startMinimized)$/)) {
                    updateConfigTemp('general', 'system');
                } else if (target.id.match(/^(checkUpdate|periodicUpdateCheck)$/)) {
                    updateConfigTemp('update');
                }
            }
            else if (target.tagName === 'SELECT') {
                if (target.id.match(/^(dateFormat|timeFormat|construct|leftEncapsule|rightEncapsule|messageSeperator)$/)) {
                    updateConfigTemp('general', 'logging');
                    updateLogFormatPreview();
                } else if (target.id === 'favouriteIcon') {
                    updateConfigTemp('general', 'theme');
                } else if (target.id === 'updateFrequency') {
                    updateConfigTemp('update');
                }
            }
            else if (target.type === 'number' || target.type === 'range') {
                if (target.id === 'maxLogEntries') {
                    updateConfigTemp('general', 'logging');
                } else if (target.id === 'highlightWidth') {
                    updateConfigTemp('general', 'theme');
                }
            }
            else if (target.type === 'radio') {
                if (target.name === 'triggerCMDUpdateOption' || target.name === 'triggerCMDAppsOption') {
                    updateConfigTemp('triggercmd');
                }
            }
            
            xlp.updateGreenButtonState();
        });
    });

    const messagePrefix = document.getElementById('messagePrefix');
    if (messagePrefix) {
        messagePrefix.addEventListener('input', debounce(() => {
            updateConfigTemp('general', 'logging');
            updateLogFormatPreview();
            xlp.updateGreenButtonState();
        }, 300));
    }

    const updateTriggerCMDButton = document.getElementById('updateTriggerCMDFile');
    if (updateTriggerCMDButton) {
        updateTriggerCMDButton.addEventListener('click', runXltcScript);
    }
}

// Configure Section List
// Manages visibility and initialization of all configuration section panels
async function setupConfigList() {
    const triggerCmdFileExists = await e.Api.invoke('check-triggercmd-file');
    const triggerCmdItem = document.querySelector('[data-config="triggercmd"]');

    if (triggerCmdFileExists) {
        triggerCmdItem.style.display = 'block';
    } else {
        triggerCmdItem.style.display = 'none';
    }
}

// Initialize Section UI
// Configures and populates all interface elements with current settings
function initializeUIForSection(section) {
    switch (section) {
        case 'general':
            const loggingConfig = xlp.getData('xlaunchConfig');
            populateConfigFields(loggingConfig);
            updateLogFormatPreview();

            const systemConfig = window.xldbv.configOpts.system;
            const systemElements = ['showTray', 'minimizeToTray', 'closeToTray', 'startWithWindows', 'startMinimized'];
            systemElements.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.checked = systemConfig[id === 'showTray' ? 'show' : 
                                   id === 'minimizeToTray' ? 'minimizeTo' : 
                                   id === 'closeToTray' ? 'closeTo' : 
                                   id === 'startWithWindows' ? 'startWithWindows' : 'startMinimized'];
                }
            });
            break;

        case 'triggercmd':
            const triggerConfig = window.xldbv.configOpts.triggercmd;
            const overwriteElement = document.querySelector(`input[name="triggerCMDUpdateOption"][value="${triggerConfig.overwriteFile}"]`);
            if (overwriteElement) overwriteElement.checked = true;

            const addCommandsElement = document.querySelector(`input[name="triggerCMDAppsOption"][value="${triggerConfig.addCommands}"]`);
            if (addCommandsElement) addCommandsElement.checked = true;

            const autoGenerateCheckbox = document.getElementById('autoGenerateTriggerCMD');
            if (autoGenerateCheckbox) autoGenerateCheckbox.checked = triggerConfig.autoGenerate;

            const addToPathCheckbox = document.getElementById('addToPath');
            if (addToPathCheckbox) addToPathCheckbox.checked = triggerConfig.inPath;
            break;

        case 'update':
            const updateConfig = window.xldbv.configOpts.updates;
            const updateElements = {
                checkUpdate: document.getElementById('checkUpdate'),
                periodicUpdateCheck: document.getElementById('periodicUpdateCheck'),
                updateFrequency: document.getElementById('updateFrequency'),
                updateButton: document.getElementById('updateAppButton'),
                updateInfoPreview: document.getElementById('updateInfoPreview')
            };

            if (updateElements.checkUpdate) updateElements.checkUpdate.checked = updateConfig.autoCheck;
            if (updateElements.periodicUpdateCheck) updateElements.periodicUpdateCheck.checked = updateConfig.periodic?.enable || false;
            if (updateElements.updateFrequency) updateElements.updateFrequency.value = updateConfig.periodic?.interval || 24;

            if (updateElements.updateInfoPreview) {
                updateElements.updateInfoPreview.innerHTML = 'Checking for updates. Please wait...\n\n';
                xlp.checkForUpdatesConfig().then(({ text, hasUpdate }) => {
                    updateElements.updateInfoPreview.innerHTML = text;
                    if (updateElements.updateButton) updateElements.updateButton.disabled = !hasUpdate;
                }).catch(error => {
                    updateElements.updateInfoPreview.innerHTML = error.message;
                    if (updateElements.updateButton) updateElements.updateButton.disabled = true;
                });
            }
            break;
    }
}

// Load Config Section
// Initializes and displays the selected configuration panel with data
export async function loadConfigSection(section) {
    if (section === activeConfigPanel) {
        return;
    }
    
    document.querySelectorAll('.config-section').forEach(el => {
        el.classList.add('hidden');
    });
    
    const selectedSection = document.querySelector(`#${section}Config`);
    if (!selectedSection) {
        return;
    }
    selectedSection.classList.remove('hidden');
    
    const baseStateName = getStateName('b', section);
    const tempStateName = getStateName('t', section);
    
    window[tempStateName] = JSON.parse(JSON.stringify(window[baseStateName]));
    
    initializeUIForSection(section);
    
    activeConfigPanel = section;
    updateSelectedConfigItem(section);
    xlp.updateGreenButtonState();
}

// Scroll View Position
// Moves viewport to specified text location within element display
export function scrollToLine(element, text) {
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

// Calculate Text Height
// Determines line height using dynamic element measurement and scaling
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

// Populate Form Data
// Fills all configuration form fields with current stored values
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

// Set Form Elements
// Updates form elements with validation and proper value handling
function setAndLogValue(id, value) {
    const element = document.getElementById(id);
    if (element) {
        if (element.tagName === 'SELECT' || element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.value = value || '';
        }
    }
}

// Update Format Preview
// Generates and displays preview using current logging format settings
function updateLogFormatPreview() {
    const dateFormat = document.getElementById('dateFormat')?.value;
    const timeFormat = document.getElementById('timeFormat')?.value;
    const construct = document.getElementById('construct')?.value;
    const leftEncapsule = document.getElementById('leftEncapsule')?.value;
    const rightEncapsule = document.getElementById('rightEncapsule')?.value;
    const messageSeperator = document.getElementById('messageSeperator')?.value;
    const messagePrefix = document.getElementById('messagePrefix')?.value;

    if (!dateFormat || !timeFormat || !construct || !leftEncapsule || !rightEncapsule || !messageSeperator || !messagePrefix) {
        return;
    }

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

// Load Icon Options
// Populates icon selector dropdown with all available system options
async function populateFavouriteIcons() {
    const favouriteIconSelect = document.getElementById('favouriteIcon');
    
    const xldbv = xlp.getData('xldbv') || {};
    
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

// Setup Row Display
// Initializes row selector interface with all available display options
async function loadRowSelectors() {
    try {
        const appDir = await e.Api.invoke('get-app-dir');
        const themesDir = xlp.dirVar('themes');
        const selectorsPath = xlp.joinPath(appDir, 'files', themesDir, 'selectors');
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
                
                const svgContent = await xlp.generateRowSelectorSVG(`${file}`);
                if (svgContent) {
                    const svgContainer = document.createElement('div');
                    svgContainer.innerHTML = svgContent;
                    optionDiv.appendChild(svgContainer.firstChild);
                    
                    if (!selectedValue.hasChildNodes()) {
                        selectRowSelector(fileName, svgContainer.firstChild, customSelect, selectedValue);
                    }
                    
                    optionDiv.addEventListener('click', async () => {
                        const newSvgContent = await xlp.generateRowSelectorSVG(`${file}`);
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

// Update Row Display
// Applies selected row style settings to interface configuration display
function selectRowSelector(fileName, svgElement, customSelect, selectedValue, optionsContainer) {
    if (svgElement && customSelect && selectedValue) {
        selectedValue.innerHTML = '';
        selectedValue.appendChild(svgElement.cloneNode(true));
        customSelect.dataset.value = fileName;
        if (optionsContainer) {
            optionsContainer.classList.remove('show');
        }
        
        const tempState = window[getStateName('t', 'general')];
        if (!tempState) return;
        
        if (!tempState.theme) tempState.theme = {};
        tempState.theme.rowSelector = fileName;
        
        xlp.updateGreenButtonState();
    }
}

// Setup Width Controls
// Initializes and configures width adjustment slider with event handling
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
            
            xlp.updateGreenButtonState();
        });
    }
}

// Generate Command File
// Creates and updates command configuration file with current settings
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
        }
        setTimeout(() => {
            statusElement.textContent = '';
            statusElement.classList.remove('success', 'error');
        }, 5000);
    } catch (error) {
        statusElement.textContent = 'Failed to update TriggerCMD file.';
        statusElement.classList.add('error');
        setTimeout(() => {
            statusElement.textContent = '';
            statusElement.classList.remove('success', 'error');
        }, 5000);
    }
}

// Check State Changes
// Determines if current configuration panel contains any modifications made
export function hasUnsavedChanges() {
    if (!activeConfigPanel) {
        return false;
    }

    const baseStateName = getStateName('b', activeConfigPanel);
    const tempStateName = getStateName('t', activeConfigPanel);
    
    const baseState = window[baseStateName];
    const tempState = window[tempStateName];

    if (!baseState || !tempState) {
        return false;
    }

    try {
        switch (activeConfigPanel) {
            case 'general': {
                const configDiff = JSON.stringify(tempState.xlaunchConfig || {}) !== 
                                 JSON.stringify(baseState.xlaunchConfig || {});
                const themeDiff = JSON.stringify(tempState.theme || {}) !== 
                                JSON.stringify(baseState.theme || {});
                const systemDiff = JSON.stringify(tempState.system || {}) !== 
                                 JSON.stringify(baseState.system || {});

                if (configDiff || themeDiff || systemDiff) {
                    return true;
                }

                return false;
            }
                
            case 'triggercmd':
            case 'update': {
                const isDifferent = JSON.stringify(tempState) !== JSON.stringify(baseState);
                return isDifferent;
            }
        }
        
        return false;
    } catch (error) {
        return false;
    }
}

// Save Section Data
// Applies all current section modifications to system configuration
function saveCurrentSection() {
    if (!activeConfigPanel) return;

    const tempState = window[getStateName('t', activeConfigPanel)];
    if (!tempState) return;

    switch (activeConfigPanel) {
        case 'general':
            if (tempState.xlaunchConfig) {
                xlp.setData('xlaunchConfig', tempState.xlaunchConfig);
            }
            if (tempState.theme) {
                window.xldbv.configOpts.theme = { ...tempState.theme };
            }
            if (tempState.system) {
                window.xldbv.configOpts.system = { ...tempState.system };
            }
            break;

        case 'triggercmd':
            window.xldbv.configOpts.triggercmd = { ...tempState };
            break;

        case 'update':
            window.xldbv.configOpts.updates = { ...tempState };
            break;
    }

    window[getStateName('b', activeConfigPanel)] = JSON.parse(JSON.stringify(tempState));

    xlp.showConfigSaveDialog(activeConfigPanel);
    xlp.updateGreenButtonState();
}

// Update Item Selection
// Updates interface to highlight currently selected configuration section item
function updateSelectedConfigItem(section) {
    const configItems = document.querySelectorAll('.config-item');
    configItems.forEach(item => {
        if (item.dataset.config === section) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// Export Config Data
// Saves complete configuration state to external system file
export async function exportConfiguration() {
    try {
        const config = {
            xlaunchConfig: xlp.getData('xlaunchConfig'),
            configOpts: window.xldbv.configOpts
        };

        const result = await e.Api.invoke('export-config', config);
        if (!result) {
            throw new Error('Failed to export configuration');
        }
        return true;
    } catch (error) {
        return false;
    }
}

// Import Config Data
// Loads complete configuration from external file into system
export async function importConfiguration() {
    try {
        const config = await e.Api.invoke('import-config');
        if (!config) {
            throw new Error('No configuration data received');
        }

        if (!validateConfiguration(config)) {
            throw new Error('Invalid configuration format');
        }

        xlp.setData('xlaunchConfig', config.xlaunchConfig);
        window.xldbv.configOpts = { ...config.configOpts };

        loadConfigSection(activeConfigPanel);
        return true;
    } catch (error) {
        return false;
    }
}

// Validate Config Data
// Performs complete validation of configuration data structure and fields
function validateConfiguration(config) {
    if (!config || typeof config !== 'object') {
        return false;
    }

    const requiredFields = {
        xlaunchConfig: [
            'dateFormat',
            'timeFormat',
            'construct',
            'leftEncapsule',
            'rightEncapsule',
            'messageSeperator',
            'messagePrefix',
            'maxLogEntries'
        ],
        configOpts: [
            'theme',
            'system',
            'triggercmd',
            'updates'
        ]
    };

    if (!config.xlaunchConfig || typeof config.xlaunchConfig !== 'object') {
        return false;
    }

    for (const field of requiredFields.xlaunchConfig) {
        if (!(field in config.xlaunchConfig)) {
            return false;
        }
    }

    if (!config.configOpts || typeof config.configOpts !== 'object') {
        return false;
    }

    for (const field of requiredFields.configOpts) {
        if (!(field in config.configOpts)) {
            return false;
        }
    }

    return true;
}

// Handle System Startup
// Manages system startup shortcut creation and removal process
async function handleStartupShortcut(enabled) {
    try {
        if (enabled) {
            await e.Api.invoke('create-startup-shortcut');
        } else {
            await e.Api.invoke('remove-startup-shortcut');
        }
    } catch (error) { }
}

// Save Config Changes
// Writes and applies all configuration modifications to system state
export async function saveConfiguration(skipDialog = false) {
    const promises = [];
    const section = activeConfigPanel;
    const tempState = window[getStateName('t', section)];

    switch (section) {
        case 'general': {
            if (tempState.system) {
                const systemConfig = tempState.system;
                if (systemConfig.show !== window.xldbv.configOpts.system.show) {
                    promises.push(e.Api.invoke('update-tray-visibility', systemConfig.show));
                }
                if (systemConfig.startWithWindows !== window.xldbv.configOpts.system.startWithWindows) {
                    promises.push(handleStartupShortcut(systemConfig.startWithWindows));
                }
            }
            
            xlp.setData('xlaunchConfig', tempState.xlaunchConfig);
            window.xldbv.configOpts.theme.favourite = tempState.theme.favourite;
            window.xldbv.configOpts.theme.rowSelector = tempState.theme.rowSelector;
            window.xldbv.configOpts.theme.rowWidth = tempState.theme.rowWidth;
            window.xldbv.configOpts.system = { ...tempState.system };
            break;
        }
        case 'triggercmd': {
            const oldInPath = window.xldbv.configOpts.triggercmd?.inPath ?? false;
            const newInPath = tempState?.inPath ?? false;
            
            if (oldInPath !== newInPath) {
                try {
                    if (newInPath) {
                        await e.Api.invoke('add-to-path');
                    } else {
                        await e.Api.invoke('remove-from-path');
                    }
                } catch (error) { }
            }
            
            window.xldbv.configOpts.triggercmd = { ...tempState };
            break;
        }
        case 'update': {
            window.xldbv.configOpts.updates = { ...tempState };
            break;
        }
    }
    
    xlp.setData('xldbv', window.xldbv);
    const validJson = xlp.validateXldbvJson(window.xldbv);
    if (validJson) {
        try {
            const baseDir = await e.Api.invoke('get-app-dir');
            const utilsDir = xlp.dirVar('utils');
            const xldbvPath = xlp.joinPath(baseDir, utilsDir, 'xldbv.json');
            const xldbvResult = await e.Api.invoke('update-vars', xldbvPath, window.xldbv);
            if (!xldbvResult) {
                throw new Error('Failed to save xldbv.json');
            }
        } catch (error) {
            throw new Error(`Failed to write configuration: ${error.message}`);
        }

        await Promise.all(promises);
        
        window[getStateName('b', section)] = { ...tempState };
        xlp.updateGreenButtonState();
        
        if (!skipDialog) {
            await xlp.showConfigSaveDialog(section);
        }
        
        return true;
    } else {
        throw new Error('Invalid xldbv.json structure');
    }
}

// Update Config Data
// Synchronizes all temporary configuration data with form modifications
function updateConfigTemp(section, subsection) {
    const tempState = window[getStateName('t', section)];
    const baseState = window[getStateName('b', section)];
    if (!tempState || !baseState) return;

    let stateChanged = false;

    switch (section) {
        case 'general':
            switch (subsection) {
                case 'system': {
                    const newSystem = {
                        show: document.getElementById('showTray').checked,
                        minimizeTo: document.getElementById('minimizeToTray').checked,
                        closeTo: document.getElementById('closeToTray').checked,
                        startWithWindows: document.getElementById('startWithWindows').checked,
                        startMinimized: document.getElementById('startMinimized').checked
                    };
                    stateChanged = JSON.stringify(newSystem) !== JSON.stringify(tempState.system);
                    tempState.system = newSystem;
                    break;
                }
                case 'logging': {
                    const newConfig = {
                        dateFormat: document.getElementById('dateFormat').value,
                        timeFormat: document.getElementById('timeFormat').value,
                        construct: document.getElementById('construct').value === '1' ? 'timeFormat dateFormat' : 'dateFormat timeFormat',
                        leftEncapsule: `'${document.getElementById('leftEncapsule').value}'`,
                        rightEncapsule: `'${document.getElementById('rightEncapsule').value}'`,
                        messageSeperator: `'${document.getElementById('messageSeperator').value}'`,
                        messagePrefix: `'${document.getElementById('messagePrefix').value}'`,
                        maxLogEntries: document.getElementById('maxLogEntries').value
                    };
                    stateChanged = JSON.stringify(newConfig) !== JSON.stringify(tempState.xlaunchConfig);
                    tempState.xlaunchConfig = newConfig;
                    break;
                }
                case 'theme': {
                    if (!tempState.theme) tempState.theme = {};
                    const newTheme = { ...tempState.theme };
                    
                    const element = document.getElementById('favouriteIcon');
                    if (element) newTheme.favourite = element.value;
                    
                    const customSelect = document.querySelector('.custom-select');
                    if (customSelect) newTheme.rowSelector = customSelect.dataset.value;
                    
                    const highlightWidth = document.getElementById('highlightWidth');
                    if (highlightWidth) newTheme.rowWidth = parseInt(highlightWidth.value);
                    
                    stateChanged = JSON.stringify(newTheme) !== JSON.stringify(tempState.theme);
                    tempState.theme = newTheme;
                    break;
                }
            }
            break;
            
        case 'triggercmd': {
            const newTriggerState = {
                overwriteFile: document.querySelector('input[name="triggerCMDUpdateOption"]:checked')?.value || 'keep',
                addCommands: document.querySelector('input[name="triggerCMDAppsOption"]:checked')?.value || 'favourited',
                autoGenerate: document.getElementById('autoGenerateTriggerCMD')?.checked || false,
                inPath: document.getElementById('addToPath')?.checked || false
            };
            stateChanged = JSON.stringify(newTriggerState) !== JSON.stringify(tempState);
            Object.assign(tempState, newTriggerState);
            break;
        }
            
        case 'update': {
            const newUpdateState = {
                autoCheck: document.getElementById('checkUpdate')?.checked || false,
                periodic: {
                    enable: document.getElementById('periodicUpdateCheck')?.checked || false,
                    interval: parseInt(document.getElementById('updateFrequency')?.value || '24')
                }
            };
            stateChanged = JSON.stringify(newUpdateState) !== JSON.stringify(tempState);
            Object.assign(tempState, newUpdateState);
            break;
        }
    }

    if (stateChanged) {
        xlp.updateGreenButtonState();
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

// Update construct options based on current date/time format
function updateConstructOptions() {
    const dateFormatSelect = document.getElementById('dateFormat');
    const timeFormatSelect = document.getElementById('timeFormat');
    const constructSelect = document.getElementById('construct');
    
    if (!dateFormatSelect || !timeFormatSelect || !constructSelect) return;

    const dateFormat = dateFormatSelect.value;
    const timeFormat = timeFormatSelect.value;

    constructSelect.innerHTML = '';
    constructSelect.add(new Option(`${dateFormat} ${timeFormat}`, '0'));
    constructSelect.add(new Option(`${timeFormat} ${dateFormat}`, '1'));

    const currentConstruct = window[getStateName('t', 'general')]?.xlaunchConfig?.construct;
    constructSelect.value = currentConstruct === 'timeFormat dateFormat' ? '1' : '0';
    
    updateLogFormatPreview();
}

// Cleanup Config System
// Performs complete cleanup of configuration module state and listeners
export async function cleanupConfiguration() {
    if (window.configObserver) {
        window.configObserver.disconnect();
        window.configObserver = null;
    }

    const configDetails = document.querySelector('.config-details');
    if (configDetails) {
        configDetails.replaceWith(configDetails.cloneNode(true));
    }

    const elementsToClean = [
        document.getElementById('messagePrefix'),
        document.getElementById('updateTriggerCMDFile'),
        document.getElementById('configList')
    ];

    elementsToClean.forEach(element => {
        if (element) {
            element.replaceWith(element.cloneNode(true));
        }
    });

    window.configSectionTemp = null;
    window.xlaunchConfigTemp = null;
    activeConfigPanel = null;

    document.querySelectorAll('.config-section').forEach(s => s.classList.add('hidden'));
}