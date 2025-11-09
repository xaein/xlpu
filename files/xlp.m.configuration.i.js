// Configuration Initialization Submodule
//   Handles initialization logic for the configuration module
//   Sets up configuration UI, event handlers, and state management
//   Initializes configuration panels, update indicators, and change tracking
//   Prepares configuration section for user interaction

// Initialize Configuration States
//   Sets up base and temporary states for all configuration sections
//   Initializes base states with defaults and config values, sets temp states to null
export function initializeConfigurationStates() {
    const configDefaults = xlp.configDefaults ?? {};
    const xlaunchConfig = { ...configDefaults.logging, ...window.xlaunchConfig, ...xlp.getData('xlaunchConfig') };
    
    xlp.setState('config.xlaunchConfig', xlaunchConfig);
    
    xlp.setState('config.baseStates.general', {
        xlaunchConfig: xlaunchConfig,
        theme: { ...configDefaults.theme, ...window.xldbv?.configOpts?.theme },
        system: { ...configDefaults.system, ...window.xldbv?.configOpts?.system }
    });
    xlp.setState('config.baseStates.triggercmd', { ...configDefaults.triggercmd, ...window.xldbv?.configOpts?.triggercmd });
    xlp.setState('config.baseStates.update', { ...configDefaults.update, ...window.xldbv?.configOpts?.updates });
    xlp.setState('config.baseStates.themes', {});

    xlp.setState('config.tempStates.general', null);
    xlp.setState('config.tempStates.triggercmd', null);
    xlp.setState('config.tempStates.update', null);
    xlp.setState('config.tempStates.themes', null);
    
    window[getStateName('b', 'general')] = xlp.getState('config.baseStates.general');
    window[getStateName('b', 'triggercmd')] = xlp.getState('config.baseStates.triggercmd');
    window[getStateName('b', 'update')] = xlp.getState('config.baseStates.update');
    window[getStateName('b', 'themes')] = xlp.getState('config.baseStates.themes');
}

// Initialize Configuration UI Components
//   Sets up all UI components for the configuration interface
//   Sets up config list, favourite icons, row selectors, width slider, and loads general section
export async function initializeConfigurationUI() {
    await xlp.setupConfigList();
    await xlp.populateFavouriteIcons();
    await xlp.loadRowSelectors();
    xlp.setupHighlightWidthSlider();
    await xlp.loadConfigSection('general');
}

// Initialize Update Indicator
//   Sets up the update indicator display
//   Checks for updates and displays update indicator if newer version is available
export function initializeUpdateIndicator() {
    try {
        const updateIndicator = xlp.getElement('updateIndicator');
        xlp.getUpdateInfo().then(({ hasUpdate }) => {
            if (updateIndicator && hasUpdate) {
                updateIndicator.textContent = window.xldbv?.updtico ?? "⥥";
                updateIndicator.classList.add('visible');
            }
        });
    } catch (error) {
    }
}

// Initialize Document Click Handler
//   Sets up the main document click event handler for configuration interactions
//   Handles update link clicks, config item clicks, and manages unsaved changes dialogs
export function initializeDocumentClickHandler() {
    const handleUpdateLinkClick = xlp.debounce(() => {
        e.Api.invoke('open-external', 'https://xaein.github.io/xlpu/versions/');
    }, 300);

    let documentClickHandler = window.documentClickHandler || null;
    if (documentClickHandler) {
        document.removeEventListener('click', documentClickHandler);
    }

    documentClickHandler = async (event) => {
        const target = event.target;

        if (target.closest('.update-link')) {
            handleUpdateLinkClick();
            return;
        }

        if (target.closest('.config-item')) {
            const configItem = target.closest('.config-item');
            const newSection = configItem.dataset.config;
            
            const activeConfigPanel = xlp.getState('config.activePanel');
            if (newSection === activeConfigPanel) {
                return;
            }

            if (xlp.hasUnsavedChanges()) {
                xlp.showConfigChangeDialog(activeConfigPanel).then(shouldSave => {
                    if (shouldSave) {
                        xlp.saveCurrentSection();
                    }
                }).catch(error => {
                });
            }
            xlp.loadConfigSection(newSection);
        }

        if (target.matches('#updateAppButton')) {
            xlp.getUpdateInfo().then(async updateInfo => {
                if (!updateInfo.hasUpdate) return;

                xlp.showUpdateOverlay();
                await xlp.handleUpdateProcess(updateInfo);
                const success = await xlp.updateFiles((file) => {
                    if (window.updateState.progressHandler) {
                        const newText = window.updateState.progressHandler(file);
                        const updateInfoPreview = xlp.getElement('updateInfoPreview');
                        if (updateInfoPreview && newText) {
                            updateInfoPreview.innerHTML = newText;
                        }
                    }
                });

                if (success) {
                    const updateInfoPreview = xlp.getElement('updateInfoPreview');
                    if (updateInfoPreview) {
                        updateInfoPreview.innerHTML += '\n\nUpdate completed successfully.' + 
                            (updateInfo.requiresRestart ? '\nPlease restart the application for the changes to take effect.' : '');
                    }
                    xlp.scrollToLine(updateInfoPreview, 'Please restart');
                    await xlp.loadConfigSection('update');
                    
                    const updateIndicator = xlp.getElement('updateIndicator');
                    const updateButton = xlp.getElement('updateAppButton');
                    if (updateIndicator) {
                        updateIndicator.classList.remove('visible');
                    }
                    if (updateButton) {
                        updateButton.disabled = true;
                    }
                }
            }).catch(error => {
                const updateInfoPreview = xlp.getElement('updateInfoPreview');
                if (updateInfoPreview) {
                    updateInfoPreview.innerHTML = `Error updating: ${error.message}`;
                }
            }).finally(() => {
                xlp.hideUpdateOverlay();
            });
        }

        if (target.matches('#updateTriggerCMDFile')) {
            try {
                xlp.runXltcScript();
            } catch (error) {
            }
        }

        if (target.matches('#importThemeButton')) {
            if (xlp.showDialog) {
                xlp.showDialog('themeimport');
                
                await new Promise(resolve => setTimeout(resolve, 10));
                
                const selectFileButton = xlp.getElement('selectThemeFile');
                const importPathInput = xlp.getElement('themeImportPath');
                let fullPath = '';

                if (importPathInput) {
                    importPathInput.value = '';
                }

                if (selectFileButton) {
                    selectFileButton.onclick = async () => {
                        try {
                            const defaultDir = await e.Api.invoke('get-desktop-dir');
                            const result = await e.Api.invoke('open-file-dialog', {
                            title: 'Select Theme File',
                            defaultPath: defaultDir,
                            filters: [
                                { name: 'Theme Files', extensions: ['thm'] },
                                { name: 'All Files', extensions: ['*'] }
                            ],
                            properties: ['openFile']
                        });

                            if (!result.canceled && result.filePaths.length > 0 && importPathInput) {
                                fullPath = result.filePaths[0];
                                importPathInput.value = fullPath.split('\\').pop().split('/').pop();
                                importPathInput.dataset.fullPath = fullPath;
                            }
                        } catch (error) {
                        }
                    };
                }

                if (importPathInput) {
                    xlp.setupDialogButton('themeimport', async () => {
                        const selectedPath = importPathInput.dataset.fullPath || fullPath;
                        if (selectedPath) {
                            try {
                                const themesDir = xlp.dirVar('themes');
                                const importResult = await e.Api.invoke('import-theme', selectedPath, themesDir);

                                if (importResult && importResult.success) {
                                    if (xlp.initializeThemes) {
                                        await xlp.initializeThemes();
                                    }
                                    if (xlp.selectTheme) {
                                        xlp.selectTheme(importResult.themeName);
                                    }
                                    if (xlp.closeDialog) {
                                        xlp.closeDialog('themeimport');
                                    }
                                }
                            } catch (error) {
                                if (xlp.closeDialog) {
                                    xlp.closeDialog('themeimport');
                                }
                            }
                        }
                    });
                }
            }
        }

        if (target.matches('#removeThemeButton')) {
            if (window.selectedTheme && xlp.showDialog) {
                const selectedThemeData = window.themes?.find(theme => theme.name === window.selectedTheme);
                
                if (selectedThemeData && !selectedThemeData.readonly) {
                    const themeSpan = xlp.getElement('themeToDelete');
                    if (themeSpan) {
                        themeSpan.textContent = window.selectedTheme;
                    }
                    xlp.showDialog('themedelete');
                    
                    await new Promise(resolve => setTimeout(resolve, 10));

                    xlp.setupDialogButton('themedelete', async () => {
                        try {
                            const themesDir = xlp.dirVar('themes');
                            const themeFile = `${window.selectedTheme}.thm`;
                            const themePath = xlp.joinPath('files', themesDir, themeFile);
                            const success = await e.Api.invoke('remove-file', themePath);
                            
                            if (success && xlp.initializeThemes) {
                                await xlp.initializeThemes();
                            }
                            if (xlp.closeDialog) {
                                xlp.closeDialog('themedelete');
                            }
                        } catch (error) {
                            if (xlp.closeDialog) {
                                xlp.closeDialog('themedelete');
                            }
                        }
                    });
                }
            }
        }
    };

    window.documentClickHandler = documentClickHandler;
    
    if (xlp.setupEventListenersFromConfig) {
        xlp.setupEventListenersFromConfig('configuration');
    } else {
        document.addEventListener('click', documentClickHandler);
    }
}

// Initialize Document Change Handler
//   Sets up the document change event handler for configuration field updates
//   Handles change events for form fields and updates temp state and UI accordingly
export function initializeDocumentChangeHandler() {
    if (xlp.setupEventListenersFromConfig) {
        return;
    }
    
    document.addEventListener('change', (event) => {
        const target = event.target;
        
        if (target.closest('.config-details')) {
            if (['dateFormat', 'timeFormat', 'construct', 'leftEncapsule', 
                 'rightEncapsule', 'messageSeperator', 'maxLogEntries'].includes(target.id)) {
                if (['dateFormat', 'timeFormat'].includes(target.id)) {
                    xlp.updateConstructOptions();
                }
                xlp.updateConfigTemp('general', 'logging');
                if (target.id !== 'maxLogEntries') {
                    xlp.updateLogFormatPreview();
                }
            }
            else if (target.type === 'checkbox') {
                if (target.id.match(/^(showTray|minimizeToTray|closeToTray|startWithWindows|startMinimized)$/)) {
                    xlp.updateConfigTemp('general', 'system');

                    const minimizeToTray = xlp.getElement('minimizeToTray');
                    const closeToTray = xlp.getElement('closeToTray');
                    const startWithWindows = xlp.getElement('startWithWindows');
                    const startMinimized = xlp.getElement('startMinimized');
                    const showTray = xlp.getElement('showTray');

                    if (target.id === 'showTray') {
                        if (minimizeToTray) minimizeToTray.disabled = !target.checked;
                        if (closeToTray) closeToTray.disabled = !target.checked;
                        if (startMinimized && startWithWindows) {
                            startMinimized.disabled = !(target.checked && startWithWindows.checked);
                        }
                    } else if (target.id === 'startWithWindows') {
                        if (startMinimized && showTray) {
                            startMinimized.disabled = !(target.checked && showTray.checked);
                        }
                    }
                } else if (target.id.match(/^(checkUpdate|periodicUpdateCheck)$/)) {
                    xlp.updateConfigTemp('update');
                }
            }
            else if (target.tagName === 'SELECT') {
                if (target.id === 'favouriteIcon') {
                    xlp.updateConfigTemp('general', 'theme');
                } else if (target.id === 'updateFrequency') {
                    xlp.updateConfigTemp('update');
                }
            }
            else if (target.type === 'range') {
                if (target.id === 'highlightWidth') {
                    xlp.updateConfigTemp('general', 'theme');
                }
            }
            else if (target.type === 'radio') {
                if (target.name === 'triggerCMDUpdateOption' || target.name === 'triggerCMDAppsOption') {
                    xlp.updateConfigTemp('triggercmd');
                }
            }
            
            xlp.updateGreenButtonState();
        }
    });
}

// Initialize Document Input Handler
//   Sets up the document input event handler for configuration field updates
//   Handles input events for message prefix field with debouncing
export function initializeDocumentInputHandler() {
    if (xlp.setupEventListenersFromConfig) {
        return;
    }
    
    document.addEventListener('input', xlp.debounce((event) => {
        const target = event.target;
        
        if (target.id === 'messagePrefix') {
            xlp.updateConfigTemp('general', 'logging');
            xlp.updateLogFormatPreview();
            xlp.updateGreenButtonState();
        }
    }, 300));
}

// Finalize Configuration Initialization
// Performs final setup steps after all initialization is complete
export function finalizeConfigurationInitialization() {
    xlp.updateConstructOptions();
    xlp.verifyAndSetSection();
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

// Setup Configuration Event Listeners
//   Initializes all event listeners for configuration module from config
//   Sets up event listeners from configuration array for configuration section
export function setupConfigurationEventListeners() {
    if (xlp.setupEventListenersFromConfig) {
        xlp.setupEventListenersFromConfig('configuration');
    }
}

