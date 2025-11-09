// Configuration Module
//   Handles all configuration settings and user interface interactions
//   Manages configuration tabs, panel switching, and settings persistence
//   Handles logging configuration, theme settings, and application preferences
//   Provides configuration validation and change tracking

// Core configuration state
//   Tracks document click handler for configuration module
//   Manages global click handler reference for cleanup operations
let documentClickHandler = null;

// Initialize Configuration Process
//   Sets up and loads all configuration interface components and states
//   Initializes DOM cache, configuration states, UI, event handlers, and update indicators
export async function initializeConfiguration() {
    initializeConfigurationDomCache();
    
    if (window.updateLinkListenerAttached) {
        return;
    }
    
    xlp.initializeConfigurationStates?.();
    await xlp.initializeConfigurationUI?.();
    xlp.initializeUpdateIndicator?.();
    xlp.initializeDocumentClickHandler?.();
    xlp.initializeDocumentChangeHandler?.();
    xlp.initializeDocumentInputHandler?.();
    xlp.finalizeConfigurationInitialization?.();
}

// Export Config Data
//   Saves complete configuration state to external system file
//   Exports xlaunchConfig and configOpts to external file using Electron API
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

// Format Date String
//   Formats date object according to specified pattern string
//   Formats date using pattern replacements for year, month, day, time, and AM/PM
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

// Calculate Text Height
//   Determines line height using dynamic element measurement and scaling
//   Creates temporary element to measure actual line height based on computed font style
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

// State Name Generator
//   Generates unique state identifiers for managing multiple configuration panels
//   Creates state name with base or temp prefix based on type parameter
function getStateName(type, section) {
    if (!section) {
        return null;
    }
    const prefix = type === 'b' ? 'base' : 'temp';
    const stateName = `${prefix}${section.charAt(0).toUpperCase()}${section.slice(1)}State`;
    return stateName;
}

// Handle System Startup
//   Manages system startup shortcut creation and removal process
//   Creates or removes startup shortcut based on enabled parameter
export async function handleStartupShortcut(enabled) {
    try {
        if (enabled) {
            await e.Api.invoke('create-startup-shortcut');
        } else {
            await e.Api.invoke('remove-startup-shortcut');
        }
    } catch (error) {
        xlp.silentError();
    }
}

// Check State Changes
//   Determines if current configuration panel contains any modifications made
//   Compares base state and temp state to detect unsaved changes using configuration
export function hasUnsavedChanges() {
    const activeConfigPanel = xlp.getState('config.activePanel');
    if (!activeConfigPanel) {
        return false;
    }
    const config = xlp.configSectionConfig?.[activeConfigPanel];
    if (!config || !config.hasUnsavedChanges) {
        return false;
    }

    if (activeConfigPanel === 'themes') {
        return config.hasUnsavedChanges();
    }

    const baseStateName = getStateName('b', activeConfigPanel);
    const tempStateName = getStateName('t', activeConfigPanel);
    
    const baseState = window[baseStateName];
    const tempState = window[tempStateName];

    if (!baseState || !tempState) {
        return false;
    }

    try {
        return config.hasUnsavedChanges(baseState, tempState);
    } catch (error) {
        return false;
    }
}

// Import Config Data
//   Loads complete configuration from external file into system
//   Imports configuration from external file, validates, and updates system state
export async function importConfiguration() {
    try {
        const config = await e.Api.invoke('import-config');
        if (!config) {
            throw new Error('No configuration data received');
        }

        if (!validateConfiguration(config)) {
            throw new Error('Invalid configuration format');
        }

        xlp.setState('config.xlaunchConfig', config.xlaunchConfig);
        window.xlaunchConfig = config.xlaunchConfig;
        xlp.setData('xlaunchConfig', config.xlaunchConfig);
        window.xldbv.configOpts = { ...config.configOpts };

        loadConfigSection(xlp.getState('config.activePanel'));
        return true;
    } catch (error) {
        return false;
    }
}

// Initialize DOM Cache
//   Creates cached DOM element references for configuration section
//   Stores element references in window object for faster access throughout the module
function initializeConfigurationDomCache() {
    const section = xlp.sections.configuration;
    if (!section?.domElements) {
        return;
    }
    const sectionLabel = section.label.replace(/\s+/g, '');
    const domCacheName = `${sectionLabel}Dom`;
    window[domCacheName] = {};
    xlp.setState('ui.domCacheName', domCacheName);
    section.domElements.forEach(elementId => {
        const element = xlp.getElement(elementId);
        if (element) {
            window[domCacheName][elementId] = element;
        }
    });
}

// Initialize Section UI
//   Configures and populates all interface elements with current settings
//   Calls section-specific UI initialization function from configuration
function initializeUIForSection(section) {
    const config = xlp.sectionUIConfig?.[section];
    if (config && config.initialize) {
        config.initialize(xlp);
    }
}

// Load Config Section
//   Initializes and displays the selected configuration panel with data
//   Hides all sections, shows selected section, loads state, and initializes UI
//   Handles themes section initialization and resize operations
export async function loadConfigSection(section) {
    if (section === xlp.getState('config.activePanel')) {
        return;
    }
    
    xlp.getElement('dqa', '.config-section').forEach(el => {
        el.classList.add('hidden');
    });
    
    const selectedSection = xlp.getElement('id', `${section}Config`);
    if (!selectedSection) {
        return;
    }
    selectedSection.classList.remove('hidden');
    
    const baseState = xlp.getState(`config.baseStates.${section}`);
    if (baseState !== undefined && baseState !== null) {
        xlp.setState(`config.tempStates.${section}`, JSON.parse(JSON.stringify(baseState)));
        window[getStateName('t', section)] = xlp.getState(`config.tempStates.${section}`);
    } else {
        xlp.setState(`config.tempStates.${section}`, null);
        window[getStateName('t', section)] = null;
    }
    
    initializeUIForSection(section);
    
    if (section === 'themes' && xlp.initializeThemes) {
        await new Promise(resolve => setTimeout(resolve, 10));
        await xlp.initializeThemes();
        if (xlp.handleResizeThemes) {
            await xlp.handleResizeThemes();
        }
    }
    
    xlp.setState('config.activePanel', section);
    updateSelectedConfigItem(section);
    xlp.updateGreenButtonState();
}

// Setup Row Display
//   Initializes row selector interface with all available display options
//   Loads SVG selector files, creates option elements, and sets up selection interface
//   Restores previously selected selector from configuration
export async function loadRowSelectors() {
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

// Populate Form Data
//   Fills all configuration form fields with current stored values
//   Populates all logging configuration fields with values from config object
export function populateConfigFields(config) {
    if (typeof config !== 'object' || config === null) {
        return;
    }

    setAndLogValue('dateFormat', config.dateFormat);
    setAndLogValue('timeFormat', config.timeFormat);
    setAndLogValue('leftEncapsule', config.leftEncapsule?.replace(/^'|'$/g, '') ?? config.leftEncapsule ?? '');
    setAndLogValue('rightEncapsule', config.rightEncapsule?.replace(/^'|'$/g, '') ?? config.rightEncapsule ?? '');
    setAndLogValue('messageSeperator', config.messageSeperator?.replace(/^'|'$/g, '') ?? config.messageSeperator ?? '');
    setAndLogValue('messagePrefix', config.messagePrefix?.replace(/^'|'$/g, '') ?? config.messagePrefix ?? '');
    const maxLogEntries = config.maxLogEntries ? (typeof config.maxLogEntries === 'string' ? parseInt(config.maxLogEntries, 10) : config.maxLogEntries) : '';
    setAndLogValue('maxLogEntries', maxLogEntries);

    const constructSelect = xlp.getElement('construct');
    if (constructSelect) {
        const constructValue = config.construct === 'timeFormat dateFormat' ? '1' : '0';
        constructSelect.value = constructValue;
    }
}

// Load Icon Options
//   Populates icon selector dropdown with all available system options
//   Creates option elements for each favourite symbol and sets current selection
export async function populateFavouriteIcons() {
    const favouriteIconSelect = xlp.getElement('favouriteIcon');
    
    const xldbv = xlp.getData('xldbv') ?? {};
    
    const favouriteSymbols = xldbv.favourite_symbols ?? '';
    const currentFavourite = xldbv.configOpts?.theme?.favourite ?? '';

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

// Generate Command File
//   Creates and updates command configuration file with current settings
//   Generates trigger command file using xltc script with current configuration options
export async function runXltcScript() {
    const statusElement = xlp.getElement('triggerCmdUpdateStatus');
    try {
        const configOpts = {
            overwriteFile: document.querySelector('input[name="triggerCMDUpdateOption"]:checked')?.value || 'keep',
            addCommands: document.querySelector('input[name="triggerCMDAppsOption"]:checked')?.value || 'favourited'
        };
        const result = await e.Api.invoke('generate-triggercmd', configOpts);
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
        statusElement.textContent = 'Failed to update TriggerCMD file.';
        statusElement.classList.add('error');
        statusElement.classList.remove('success');
        setTimeout(() => {
            statusElement.textContent = '';
            statusElement.classList.remove('success', 'error');
        }, 5000);
    }
}

// Save Config Changes
//   Writes and applies all configuration modifications to system state
//   Saves configuration to xldbv.json, updates base states, and shows save confirmation
export async function saveConfiguration(skipDialog = false) {
    const promises = [];
    const section = xlp.getState('config.activePanel');
    const tempState = xlp.getState(`config.tempStates.${section}`) ?? window[getStateName('t', section)];

    const config = xlp.configSectionConfig?.[section];
    if (config && config.saveConfiguration) {
        const result = await config.saveConfiguration(tempState, promises, xlp);
        if (result === true) {
            return;
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
        
        xlp.setState(`config.baseStates.${section}`, { ...tempState });
        window[getStateName('b', section)] = xlp.getState(`config.baseStates.${section}`);
        
        xlp.updateGreenButtonState();
        
        if (!skipDialog) {
            await xlp.showConfigSaveDialog(section);
        }
        
        return true;
    } else {
        throw new Error('Invalid xldbv.json structure');
    }
}

// Save Section Data
//   Applies all current section modifications to system configuration
//   Saves temp state to base state, updates window objects, and shows save confirmation
export function saveCurrentSection() {
    const activeConfigPanel = xlp.getState('config.activePanel');
    if (!activeConfigPanel) {
        return;
    }

    const config = xlp.configSectionConfig?.[activeConfigPanel];
    if (!config || !config.saveSection) {
        return;
    }

    const tempState = xlp.getState(`config.tempStates.${activeConfigPanel}`) ?? window[getStateName('t', activeConfigPanel)];
    
    if (!tempState && activeConfigPanel !== 'themes') {
        return;
    }

    config.saveSection(tempState);

    if (activeConfigPanel !== 'themes') {
        xlp.setState(`config.baseStates.${activeConfigPanel}`, JSON.parse(JSON.stringify(tempState)));
        window[getStateName('b', activeConfigPanel)] = xlp.getState(`config.baseStates.${activeConfigPanel}`);
    }

    xlp.showConfigSaveDialog(activeConfigPanel);
    xlp.updateGreenButtonState();
}

// Scroll View Position
//   Moves viewport to specified text location within element display
//   Finds line containing text and scrolls element to that line position
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

// Update Row Display
//   Applies selected row style settings to interface configuration display
//   Updates custom select display, closes options container, and saves selection to temporary state
function selectRowSelector(fileName, svgElement, customSelect, selectedValue, optionsContainer) {
    if (svgElement && customSelect && selectedValue) {
        selectedValue.innerHTML = '';
        selectedValue.appendChild(svgElement.cloneNode(true));
        customSelect.dataset.value = fileName;
        if (optionsContainer) {
            optionsContainer.classList.remove('show');
        }
        
        const tempState = xlp.getState('config.tempStates.general') ?? window[getStateName('t', 'general')];
        if (!tempState) return;
        
        if (!tempState.theme) tempState.theme = {};
        tempState.theme.rowSelector = fileName;
        
        xlp.updateGreenButtonState();
    }
}

// Set Form Elements
//   Updates form elements with validation and proper value handling
//   Sets value for form elements including select, input, and textarea elements
function setAndLogValue(id, value) {
    const element = xlp.getElement(id);
    if (element) {
        if (element.tagName === 'SELECT' || element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.value = value ?? '';
        }
    }
}

// Configure Section List
//   Manages visibility and initialization of all configuration section panels
//   Shows or hides triggercmd configuration item based on file existence
export async function setupConfigList() {
    const triggerCmdFileExists = await e.Api.invoke('check-triggercmd-file');
    const triggerCmdItem = xlp.getElement('dqs', '[data-config="triggercmd"]');

    if (triggerCmdFileExists) {
        triggerCmdItem.style.display = 'block';
    } else {
        triggerCmdItem.style.display = 'none';
    }
}

// Setup Width Controls
//   Initializes and configures width adjustment slider with event handling
//   Sets up slider with saved width value and updates temporary state on input and change
export function setupHighlightWidthSlider() {
    const highlightWidth = xlp.getElement('highlightWidth');
    const highlightWidthValue = xlp.getElement('highlightWidthValue');
    
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

// Update Config Data
//   Synchronizes all temporary configuration data with form modifications
//   Updates temp state using section-specific update function from configuration
export function updateConfigTemp(section, subsection) {
    const tempState = xlp.getState(`config.tempStates.${section}`) ?? window[getStateName('t', section)];
    const baseState = xlp.getState(`config.baseStates.${section}`) ?? window[getStateName('b', section)];
    
    if (!tempState || !baseState) {
        return;
    }

    const sectionConfig = xlp.sectionUpdateConfig?.[section];
    if (!sectionConfig) {
        return;
    }

    let stateChanged = false;

    if (subsection && sectionConfig[subsection]) {
        stateChanged = sectionConfig[subsection](xlp, tempState);
    } else if (sectionConfig.update) {
        stateChanged = sectionConfig.update(xlp, tempState);
    }

    if (stateChanged) {
        xlp.updateGreenButtonState();
    }
}

// Update Construct Options
//   Updates select options based on date and time format settings
//   Updates construct select options with date and time format combinations
export function updateConstructOptions() {
    const dateFormatSelect = xlp.getElement('dateFormat');
    const timeFormatSelect = xlp.getElement('timeFormat');
    const constructSelect = xlp.getElement('construct');
    
    if (!dateFormatSelect || !timeFormatSelect || !constructSelect) return;

    const dateFormat = dateFormatSelect.value;
    const timeFormat = timeFormatSelect.value;

    constructSelect.innerHTML = '';
    constructSelect.add(new Option(`${dateFormat} ${timeFormat}`, '0'));
    constructSelect.add(new Option(`${timeFormat} ${dateFormat}`, '1'));

    const currentConstruct = (xlp.getState('config.tempStates.general') ?? window[getStateName('t', 'general')])?.xlaunchConfig?.construct;
    constructSelect.value = currentConstruct === 'timeFormat dateFormat' ? '1' : '0';
    
    updateLogFormatPreview();
}

// Update Format Preview
//   Generates and displays preview using current logging format settings
//   Constructs preview string using date, time, encapsulation, separator, and prefix values
export function updateLogFormatPreview() {
    const dateFormat = xlp.getElement('dateFormat')?.value;
    const timeFormat = xlp.getElement('timeFormat')?.value;
    const construct = xlp.getElement('construct')?.value;
    const leftEncapsule = xlp.getElement('leftEncapsule')?.value;
    const rightEncapsule = xlp.getElement('rightEncapsule')?.value;
    const messageSeperator = xlp.getElement('messageSeperator')?.value;
    const messagePrefix = xlp.getElement('messagePrefix')?.value;

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

    const previewElement = xlp.getElement('logFormatPreview');
    if (previewElement) {
        previewElement.textContent = preview;
    }
}

// Update Item Selection
//   Updates interface to highlight currently selected configuration section item
//   Adds selected class to matching config item and removes from others
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

// Validate Config Data
//   Performs complete validation of configuration data structure and fields
//   Validates required fields in xlaunchConfig and configOpts objects
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

// Cleanup Config System
//   Performs complete cleanup of configuration module state and listeners
//   Removes event listeners, observers, DOM cache, and resets configuration state
export async function cleanupConfiguration() {
    if (window.configObserver) {
        window.configObserver.disconnect();
        window.configObserver = null;
    }

    if (documentClickHandler) {
        document.removeEventListener('click', documentClickHandler);
        documentClickHandler = null;
    }

    const oldConfigDetails = document.querySelector('.config-details');
    if (oldConfigDetails) {
        const newConfigDetails = oldConfigDetails.cloneNode(true);
        oldConfigDetails.parentNode.replaceChild(newConfigDetails, oldConfigDetails);
    }

    const elementsToClean = [
        xlp.getElement('messagePrefix'),
        xlp.getElement('updateTriggerCMDFile'),
        xlp.getElement('configList')
    ];

    elementsToClean.forEach(element => {
        if (element) {
            const newElement = element.cloneNode(true);
            element.parentNode.replaceChild(newElement, element);
        }
    });

    window.configSectionTemp = null;
    window.xlaunchConfigTemp = null;
    xlp.setState('config.activePanel', null);

    xlp.getElement('dqa', '.config-section').forEach(s => s.classList.add('hidden'));

    const domCacheName = xlp.getState('ui.domCacheName');
    if (domCacheName && window[domCacheName]) {
        delete window[domCacheName];
    }
    xlp.setState('ui.domCacheName', null);
}