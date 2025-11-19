// Core Application Components
//   Manages core utilities and configurations for the application
//   Provides essential helper functions for DOM manipulation, event handling, file operations
//   Handles application exit procedures, version checking, and row selector management
//   Centralizes common functionality used across all application modules

// Tracked Event Delegation
//   Sets up event delegation and tracks it for cleanup
//   Creates delegated event handler and stores reference in window.eventListeners for later removal
export function addTrackedEventDelegation(parentElement, eventType, selector, handler, section = 'global', options = {}) {
    if (!parentElement) return null;
    
    const delegatedHandler = (event) => {
        const target = event.target.closest(selector);
        if (target) {
            handler(event, target);
        }
    };
    
    parentElement.addEventListener(eventType, delegatedHandler, options);
    
    if (!window.eventListeners) {
        window.eventListeners = {};
    }
    if (!window.eventListeners[section]) {
        window.eventListeners[section] = [];
    }
    
    window.eventListeners[section].push({
        element: parentElement,
        event: eventType,
        handler: delegatedHandler,
        selector
    });
    
    return delegatedHandler;
}

// Tracked Event Listener
//   Adds event listener and tracks it for cleanup
//   Registers event listener and stores reference in window.eventListeners for later removal
export function addTrackedEventListener(elementIdOrElement, event, handler, section = 'global') {
    const element = typeof elementIdOrElement === 'string' ? xlp.getElement(elementIdOrElement) : elementIdOrElement;
    if (!element) return null;
    
    element.addEventListener(event, handler);
    
    if (!window.eventListeners) {
        window.eventListeners = {};
    }
    if (!window.eventListeners[section]) {
        window.eventListeners[section] = [];
    }
    
    window.eventListeners[section].push({
        element,
        event,
        handler
    });
    
    return { element, event, handler };
}

// Row Highlight Manager
//   Creates and configures highlight elements for table row selection
//   Generates highlight overlay with SVG selector or background color, handles hover and selection states
export async function createRowHighlight(row) {
    const existingHighlight = xlp.getElement('rqs', '.row-highlight', row);
    if (existingHighlight) {
        existingHighlight.remove();
    }

    const highlight = document.createElement('div');
    highlight.className = 'row-highlight';
    highlight.style.position = 'absolute';
    highlight.style.top = '0';
    
    const highlightWidth = window.xldbv.configOpts?.theme?.rowWidth || 100;
    const leftOffset = (100 - highlightWidth) / 2;
    highlight.style.left = `${leftOffset}%`;
    highlight.style.width = `${highlightWidth}%`;
    highlight.style.height = '100%';
    highlight.style.pointerEvents = 'none';
    highlight.style.zIndex = '0';
    highlight.style.opacity = '0';
    highlight.style.transition = 'opacity 0.2s ease-in-out';

    const rowSelector = window.xldbv.configOpts?.theme?.rowSelector || 'rectangle';
    const svgContent = await generateRowSelectorSVG(`${rowSelector}.svg`);
    
    if (svgContent) {
        highlight.innerHTML = svgContent;
    } else {
        highlight.style.backgroundColor = 'var(--main-table-hover-color)';
    }

    row.style.position = 'relative';
    row.insertBefore(highlight, row.firstChild);

    row.addEventListener('mouseenter', () => {
        highlight.style.opacity = '1';
    });

    row.addEventListener('mouseleave', () => {
        if (!row.classList.contains('selected')) {
            highlight.style.opacity = '0';
        }
    });

    if (row.classList.contains('selected')) {
        highlight.style.opacity = '1';
        const svg = xlp.getElement('rqs', 'svg', highlight);
        if (svg) {
            svg.innerHTML = svg.innerHTML.replace(/var\(--main-table-hover-color\)/g, 'var(--main-table-selected-color)');
        }
    }

    return highlight;
}

// Function Delay Control
//   Prevents rapid function execution by enforcing time delay period
//   Returns a debounced version of the function that delays execution until delay period has passed
export function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Application Exit Handler
//   Saves application state and performs cleanup before shutting down
//   Validates and saves xldbv.json and xldbf.json, handles update file processing
//   Cleans up localStorage and triggers application exit
export async function exitApp() {
    xlp.setData('xldbv', window.xldbv);
    xlp.setData('xldbf', window.xldbf);

    let hasXldbu = false;
    let hasUpdtmp = false;

    try {
        const baseDir = await e.Api.invoke('get-app-dir');
        const utilsDir = xlp.dirVar('utils');

        if (xlp.validateXldbvJson(window.xldbv)) {
            const xldbvPath = joinPath(baseDir, utilsDir, 'xldbv.json');
            const xldbvResult = await e.Api.invoke('update-vars', xldbvPath, window.xldbv);
            if (!xldbvResult) {
                throw new Error('Failed to save xldbv.json');
            }
        } else {
            throw new Error('Invalid xldbv.json structure');
        }
        
        const cleanedXldbfData = xlp.validateXldbfJson(window.xldbf);
        if (cleanedXldbfData) {
            const xldbfPath = joinPath(baseDir, utilsDir, 'xldbf.json');
            const xldbfResult = await e.Api.invoke('update-favs', xldbfPath, cleanedXldbfData);
            if (!xldbfResult) {
                throw new Error('Failed to update xldbf.json');
            }
        } else {
            throw new Error('Invalid xldbf.json structure');
        }

        const xldbuPath = joinPath(baseDir, utilsDir, 'xldbu.json');
        const updtmpPath = joinPath(baseDir, utilsDir, 'updtmp');
        
        try {
            hasXldbu = await e.Api.invoke('file-exists', xldbuPath);
        } catch (error) {
            xlp.silentError();
        }

        try {
            const updtmpContents = await e.Api.invoke('read-directory', updtmpPath);
            hasUpdtmp = Array.isArray(updtmpContents) && updtmpContents.length > 0;
        } catch (error) {
            xlp.silentError();
        }
        
        if (hasXldbu || hasUpdtmp) {
            const newXluPath = joinPath(updtmpPath, 'utils', 'xlu.exe');
            const hasNewXlu = await e.Api.invoke('file-exists', newXluPath);
            
            if (hasNewXlu) {
                const currentXluPath = joinPath(baseDir, utilsDir, 'xlu.exe');
                await e.Api.invoke('copy-file', newXluPath, currentXluPath);
            }
        }

        const keysToKeep = ['updateAvailable'];
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!keysToKeep.includes(key)) {
                localStorage.removeItem(key);
            }
        }
        xlp.setData('updateAvailable', false);
    } catch (error) {
        throw error;
    } finally {
        if (hasXldbu || hasUpdtmp) {
            e.Api.invoke('run-xlu', 'update');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        e.Api.send('toMain', 'exit');
    }
}

// Remote Content Fetcher
//   Downloads and processes remote content with specified response type
//   Fetches remote URL content and returns parsed data based on response type
export async function fetchFile(url, responseType = 'json') {
    try {
        const response = await e.Api.invoke('fetch-url', url, responseType);
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        return response.data;
    } catch (error) {
        throw new Error(`Failed to fetch file: ${error.message}`);
    }
}

// Input Focus Delay
//   Focuses input element after specified delay
//   Provides delayed focus for dialog inputs to ensure proper rendering
export function focusInputAfterDelay(selector, delay = 100) {
    setTimeout(() => {
        const element = xlp.getElement('dqs', selector);
        if (element) {
            element.focus();
        }
    }, delay);
}

// SVG Generator Handler
//   Creates and processes SVG selectors for row highlighting system
//   Loads SVG file and replaces currentColor with CSS variable for theme integration
export async function generateRowSelectorSVG(svgPath, isConfig = false) {
    try {
        const appDir = await e.Api.invoke('get-app-dir');
        const themesDir = xlp.dirVar('themes');
        const fullPath = joinPath(appDir, 'files', themesDir, 'selectors', svgPath);
        const { data: svgContent } = await e.Api.invoke('get-file', fullPath);
        
        if (!svgContent) return null;

        const modifiedSvg = svgContent.replace(/currentColor/g, 'var(--main-table-hover-color)');
        return modifiedSvg;
    } catch (error) {
        return null;
    }
}

// Version Data Retriever
//   Fetches and returns current version information from update server
//   Retrieves version.json from configured update URL
export async function getVersionInfo() {
    const uurl = window.xldbv.uurl;
    return await fetchFile(`${uurl}/version.json`);
}

// Green Button Handler
//   Processes actions for the footer left button based on current section
//   Retrieves section-specific handler from configuration and executes it
export function handleGreenButtonClick() {
    const currentSection = window.state?.currentSection;
    if (!currentSection) return;

    const config = xlp.greenButtonConfig?.[currentSection];
    if (!config) return;

    if (currentSection === 'launchlist' && !window.selectedApp) {
        return;
    }

    const handlerFunc = xlp[config.handler];
    if (handlerFunc) {
        handlerFunc();
    }
}

// Version Update Checker
//   Compares version numbers to determine if update is needed
//   Parses semantic version strings and compares major, minor, and patch versions
export function isNewerVersion(version1, version2) {
    const [major1, minor1, patch1] = version1.split('.').map(Number);
    const [major2, minor2, patch2] = version2.split('.').map(Number);
    
    return major2 > major1 || 
           (major2 === major1 && minor2 > minor1) ||
           (major2 === major1 && minor2 === minor1 && patch2 > patch1);
}

// Path Management System
//   Combines and normalizes paths for consistent cross platform use
//   Handles path joining and separator normalization across different operating systems
export function joinPath(...parts) {
    return parts.join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
}

// Row Selector Initializer
//   Sets up and configures all available row selector options
//   Loads SVG selector files, creates option elements, and sets up selection interface
//   Restores previously selected selector from configuration
export async function loadRowSelectors() {
    try {
        const appDir = await e.Api.invoke('get-app-dir');
        const themesDir = xlp.dirVar('themes');
        const selectorsPath = joinPath(appDir, 'files', themesDir, 'selectors');
        const files = await e.Api.invoke('read-directory', selectorsPath);
        
        const svgFiles = files.filter(file => file.endsWith('.svg'));
    const customSelect = xlp.getElement('dqs', '.custom-select');
    const selectedValue = customSelect ? xlp.getElement('rqs', '.selected-value', customSelect) : null;
    const optionsContainer = customSelect ? xlp.getElement('rqs', '.options-container', customSelect) : null;
        
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
                        const svgElement = xlp.getElement('rqs', 'svg', option);
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

// Documentation Display Handler
//   Opens application help documentation using the help viewer application
//   Constructs help file path and opens it using Electron external API
export function openHelpFile() {
    const helpDir = xlp.dirVar('help');
    const helpExePath = `${helpDir}/help.exe`;
    e.Api.invoke('open-external', helpExePath);
}

// Remove Tracked Event Listeners
//   Removes all tracked event listeners for a section
//   Cleans up all event listeners registered for the specified section
export function removeTrackedEventListeners(section) {
    if (!window.eventListeners || !window.eventListeners[section]) {
        return;
    }
    
    window.eventListeners[section].forEach(({ element, event, handler }) => {
        if (element && handler) {
            element.removeEventListener(event, handler);
        }
    });
    
    delete window.eventListeners[section];
}

// Safe Event Listener
//   Adds event listener to element if it exists
//   Prevents errors when attempting to add listeners to non-existent elements
export function safeAddEventListener(elementId, event, handler) {
    const element = xlp.getElement(elementId);
    if (element) {
        element.addEventListener(event, handler);
    }
}

// Selector Update Handler
//   Updates interface elements when row selector choice is changed
//   Updates custom select display, closes options container, and saves selection to temporary state
export function selectRowSelector(fileName, svgElement, customSelect, selectedValue, optionsContainer) {
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
        
        xlp.updateSaveButtonState();
    }
}

// Dialog Button Setup
//   Configures dialog button with click handler
//   Locates dialog and button elements, then attaches click event handler
export function setupDialogButton(dialogName, handler, buttonClass = '.ok-button') {
    const dialog = xlp.getElement('id', `${dialogName}Dialog`);
    if (!dialog) return;
    
    const button = xlp.getElement('rqs', buttonClass, dialog);
    if (button) {
        button.onclick = handler;
    }
}

// Event Delegation Helper
//   Sets up event delegation on a parent element for child elements matching selector
//   Creates event handler that delegates to matching child elements, returns handler for cleanup
export function setupEventDelegation(parentElement, eventType, selector, handler, options = {}) {
    if (!parentElement) return null;
    
    const delegatedHandler = (event) => {
        const target = event.target.closest(selector);
        if (target) {
            handler(event, target);
        }
    };
    
    parentElement.addEventListener(eventType, delegatedHandler, options);
    return delegatedHandler;
}

// Setup Event Listeners from Config
//   Initializes event listeners and delegations from configuration array
//   Processes configuration array to set up event listeners and delegations with optional debouncing
//   Handles both direct listeners and delegated events based on configuration type
export function setupEventListenersFromConfig(section = 'global') {
    const config = xlp.getEventListenerConfig?.(section);
    
    if (!config || !Array.isArray(config)) {
        return;
    }

    config.forEach(listenerConfig => {
        if (listenerConfig.condition && !listenerConfig.condition()) {
            return;
        }

        let handler = listenerConfig.handler;
        
        if (typeof handler === 'string') {
            const handlerFunc = xlp[handler];
            if (!handlerFunc) {
                const moduleHandler = window[handler];
                if (moduleHandler) {
                    handler = moduleHandler;
                } else {
                    return;
                }
            } else {
                handler = handlerFunc;
            }
        }

        if (listenerConfig.debounce && typeof handler === 'function') {
            handler = xlp.debounce(handler, listenerConfig.debounce);
        }

        if (listenerConfig.type === 'delegation') {
            let parentElement;
            if (typeof listenerConfig.parent === 'string') {
                if (listenerConfig.parent.startsWith('.')) {
                    parentElement = xlp.getElement('dqs', listenerConfig.parent);
                } else if (listenerConfig.parent.startsWith('#')) {
                    parentElement = xlp.getElement('id', listenerConfig.parent.slice(1));
                } else {
                    parentElement = xlp.getElement('id', listenerConfig.parent);
                }
            } else {
                parentElement = listenerConfig.parent;
            }

            if (parentElement) {
                xlp.addTrackedEventDelegation(
                    parentElement,
                    listenerConfig.event,
                    listenerConfig.selector,
                    handler,
                    section,
                    listenerConfig.options
                );
            }
        } else if (listenerConfig.type === 'listener') {
            let element;
            if (listenerConfig.getElement) {
                if (typeof listenerConfig.element === 'string') {
                    if (listenerConfig.element.startsWith('.')) {
                        element = xlp.getElement('dqs', listenerConfig.element);
                    } else if (listenerConfig.element.startsWith('#')) {
                        element = xlp.getElement('id', listenerConfig.element.slice(1));
                    } else {
                        element = xlp.getElement('id', listenerConfig.element);
                    }
                } else {
                    element = listenerConfig.element;
                }
            } else {
                element = typeof listenerConfig.element === 'string' 
                    ? xlp.getElement(listenerConfig.element) 
                    : listenerConfig.element;
            }

            if (element) {
                xlp.addTrackedEventListener(element, listenerConfig.event, handler, section);
            }
        }
    });
}

// Silent Error Handler
//   No-op function for intentional silent error handling
//   Used in catch blocks where errors should be silently ignored
export function silentError() {
}

// Class Toggle Helper
//   Manages class list operations on elements
//   Adds, removes, or toggles CSS classes on elements with validation
export function toggleClass(elementId, className, action = 'toggle') {
    const element = xlp.getElement(elementId);
    if (element && ['add', 'remove', 'toggle'].includes(action)) {
        element.classList[action](className);
    }
}

// Button State Controller
//   Updates footer button states based on current section context
//   Retrieves button configuration for current section and updates enabled state and text
export function updateGreenButtonState() {
    const greenButton = xlp.getElement('footerLeftButton');
    if (!greenButton) return;

    const currentSection = window.state?.currentSection;
    let shouldEnable = false;
    let buttonText = 'Launch';

    if (currentSection && xlp.greenButtonConfig?.[currentSection]) {
        const config = xlp.greenButtonConfig[currentSection];
        shouldEnable = config.getEnabled();
        buttonText = config.getButtonText();
    }

    greenButton.disabled = !shouldEnable;
    greenButton.textContent = buttonText;
    greenButton.classList.toggle('disabled', !shouldEnable);
}

// File System Writer
//   Writes content to file system with comprehensive error handling
//   Invokes Electron API to write file content and validates operation success
export async function writeFile(filePath, content) {
    try {
        const result = await e.Api.invoke('write-file', filePath, content);
        if (!result) {
            throw new Error('Failed to write file');
        }
    } catch (error) {
        throw error;
    }
}

// Get Last Log Entry
//   Reads the log file and returns the last non-empty line with error flag
//   Retrieves last log entry from log file and checks if it contains error text
export async function getLastLogEntry() {
    try {
        if (!window.xldbv?.logfile) {
            return { text: '', isError: false };
        }

        const appDir = await e.Api.invoke('get-app-dir');
        const utilsDir = xlp.dirVar('utils');
        const logFilePath = xlp.joinPath(appDir, utilsDir, window.xldbv.logfile);
        const { data: logContent } = await e.Api.invoke('get-file', logFilePath);

        if (!logContent || logContent.trim().length === 0) {
            return { text: '', isError: false };
        }

        const lines = logContent.split('\n').filter(line => line.trim().length > 0);
        if (lines.length === 0) {
            return { text: '', isError: false };
        }

        const lastLine = lines[lines.length - 1].trim();
        const isError = lastLine.toLowerCase().includes('error');

        return { text: lastLine, isError };
    } catch (error) {
        return { text: '', isError: false };
    }
}

// Update Footer Log Message
//   Displays the last log entry in the footer message box with fade-out
//   Shows log message, applies color styling, and fades out after configured duration
export async function updateFooterLogMessage() {
    if (!window.xldbv?.configOpts?.system?.showLastLogInFooter) {
        return;
    }

    if (window.state?.currentSection !== 'launchlist') {
        const messageElement = xlp.getElement('lastLogMessage');
        if (messageElement) {
            messageElement.textContent = '';
            messageElement.style.color = 'transparent';
        }
        return;
    }

    const messageElement = xlp.getElement('lastLogMessage');
    if (!messageElement) {
        return;
    }

    const fadeTimer = xlp.getState('ui.footerMessageFadeTimer');
    if (fadeTimer) {
        clearTimeout(fadeTimer);
        xlp.setState('ui.footerMessageFadeTimer', null);
    }

    const { text, isError } = await getLastLogEntry();

    if (!text) {
        messageElement.textContent = '';
        messageElement.style.color = 'transparent';
        return;
    }

    messageElement.textContent = text;
    messageElement.classList.remove('log-normal', 'log-error');
    messageElement.classList.add(isError ? 'log-error' : 'log-normal');
    messageElement.style.color = '';

    const displaySeconds = window.xldbv.configOpts.system.footerMessageDisplaySeconds ?? 5;
    const fadeOutDelay = displaySeconds * 1000;

    const newTimer = setTimeout(() => {
        messageElement.style.color = 'transparent';
        xlp.setState('ui.footerMessageFadeTimer', null);
    }, fadeOutDelay);
    
    xlp.setState('ui.footerMessageFadeTimer', newTimer);
}
