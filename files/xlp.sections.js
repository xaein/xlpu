// Section Configuration
//   Defines handlers and initialization for configuration sections
//   Provides configuration objects for section UI initialization, update handlers, and save operations
//   Handles section-specific initialization and state management
//   Centralizes section configuration and behavior patterns

// Configuration Section Configuration
//   Defines handlers for configuration section operations
//   Maps section names to hasUnsavedChanges, saveSection, and saveConfiguration functions
export const configSectionConfig = {
    general: {
        hasUnsavedChanges: (baseState, tempState) => {
            const configDiff = JSON.stringify(tempState.xlaunchConfig ?? {}) !== 
                             JSON.stringify(baseState.xlaunchConfig ?? {});
            const themeDiff = JSON.stringify(tempState.theme ?? {}) !== 
                            JSON.stringify(baseState.theme ?? {});
            const systemDiff = JSON.stringify(tempState.system ?? {}) !== 
                             JSON.stringify(baseState.system ?? {});
            return configDiff || themeDiff || systemDiff;
        },
        saveSection: (tempState) => {
            if (tempState.xlaunchConfig) {
                xlp.setState('config.xlaunchConfig', tempState.xlaunchConfig);
                window.xlaunchConfig = tempState.xlaunchConfig;
                xlp.setData('xlaunchConfig', tempState.xlaunchConfig);
            }
            if (tempState.theme) {
                window.xldbv.configOpts.theme = { ...tempState.theme };
            }
            if (tempState.system) {
                window.xldbv.configOpts.system = { ...tempState.system };
            }
        },
        saveConfiguration: async (tempState, promises, xlp) => {
            if (tempState.system) {
                const systemConfig = tempState.system;
                if (systemConfig.show !== window.xldbv.configOpts.system.show) {
                    promises.push(e.Api.invoke('update-tray-visibility', systemConfig.show));
                }
                if (systemConfig.startWithWindows !== window.xldbv.configOpts.system.startWithWindows) {
                    if (xlp.handleStartupShortcut) {
                        promises.push(xlp.handleStartupShortcut(systemConfig.startWithWindows));
                    }
                }
            }
            
            xlp.setState('config.xlaunchConfig', tempState.xlaunchConfig);
            window.xlaunchConfig = tempState.xlaunchConfig;
            xlp.setData('xlaunchConfig', tempState.xlaunchConfig);
            
            if (tempState.xlaunchConfig) {
                promises.push(e.Api.invoke('update-xlaunch-config', tempState.xlaunchConfig));
            }
            
            window.xldbv.configOpts.theme.favourite = tempState.theme.favourite;
            window.xldbv.configOpts.theme.rowSelector = tempState.theme.rowSelector;
            window.xldbv.configOpts.theme.rowWidth = tempState.theme.rowWidth;
            window.xldbv.configOpts.system = { ...tempState.system };
        }
    },
    triggercmd: {
        hasUnsavedChanges: (baseState, tempState) => {
            return JSON.stringify(tempState) !== JSON.stringify(baseState);
        },
        saveSection: (tempState) => {
            window.xldbv.configOpts.triggercmd = { ...tempState };
        },
        saveConfiguration: async (tempState, promises, xlp) => {
            const oldInPath = window.xldbv.configOpts.triggercmd?.inPath ?? false;
            const newInPath = tempState?.inPath ?? false;
            
            if (oldInPath !== newInPath) {
                try {
                    if (newInPath) {
                        await e.Api.invoke('run-xlu', 'add');
                    } else {
                        await e.Api.invoke('run-xlu', 'remove');
                    }
                } catch (error) {
                    xlp.silentError();
                }
            }
            
            window.xldbv.configOpts.triggercmd = { ...tempState };
        }
    },
    update: {
        hasUnsavedChanges: (baseState, tempState) => {
            return JSON.stringify(tempState) !== JSON.stringify(baseState);
        },
        saveSection: (tempState) => {
            window.xldbv.configOpts.updates = { ...tempState };
        },
        saveConfiguration: async (tempState, promises, xlp) => {
            window.xldbv.configOpts.updates = { ...tempState };
        }
    },
    themes: {
        hasUnsavedChanges: () => {
            return window.selectedTheme && window.selectedTheme !== window.currentTheme;
        },
        saveSection: () => {
        },
        saveConfiguration: async (tempState, promises, xlp) => {
            if (xlp.applySelectedTheme) {
                await xlp.applySelectedTheme();
            }
            return true;
        }
    }
};

// Section UI Initialization Configuration
//   Defines initialization functions for each configuration section
//   Maps section names to initialize functions that populate UI elements with configuration values
export const sectionUIConfig = {
    general: {
        initialize: (xlp) => {
            const baseState = xlp.getState('config.baseStates.general') ?? window.baseGeneralState;
            const loggingConfig = baseState?.xlaunchConfig ?? xlp.getState('config.xlaunchConfig') ?? window.xlaunchConfig ?? xlp.getData('xlaunchConfig') ?? xlp.configDefaults?.logging;
            if (xlp.populateConfigFields) {
                xlp.populateConfigFields(loggingConfig);
            }
            if (xlp.updateLogFormatPreview) {
                xlp.updateLogFormatPreview();
            }

            const systemConfig = window.xldbv.configOpts.system;
            const systemElements = ['showTray', 'minimizeToTray', 'closeToTray', 'startWithWindows', 'startMinimized', 'showLastLogInFooter'];
            systemElements.forEach(id => {
                const element = xlp.getElement(id);
                if (element) {
                    element.checked = systemConfig[id === 'showTray' ? 'show' : 
                                   id === 'minimizeToTray' ? 'minimizeTo' : 
                                   id === 'closeToTray' ? 'closeTo' : 
                                   id === 'startWithWindows' ? 'startWithWindows' : 
                                   id === 'startMinimized' ? 'startMinimized' : 'showLastLogInFooter'];
                }
            });

            const footerMessageDisplaySeconds = xlp.getElement('footerMessageDisplaySeconds');
            if (footerMessageDisplaySeconds) {
                footerMessageDisplaySeconds.value = systemConfig.footerMessageDisplaySeconds ?? 5;
                const showLastLogInFooter = xlp.getElement('showLastLogInFooter');
                if (showLastLogInFooter) {
                    footerMessageDisplaySeconds.disabled = !showLastLogInFooter.checked;
                }
            }

            const showTray = xlp.getElement('showTray');
            const minimizeToTray = xlp.getElement('minimizeToTray');
            const closeToTray = xlp.getElement('closeToTray');
            const startWithWindows = xlp.getElement('startWithWindows');
            const startMinimized = xlp.getElement('startMinimized');

            if (showTray && minimizeToTray && closeToTray) {
                minimizeToTray.disabled = !showTray.checked;
                closeToTray.disabled = !showTray.checked;
            }
            
            if (startMinimized && showTray && startWithWindows) {
                startMinimized.disabled = !(showTray.checked && startWithWindows.checked);
            }
        }
    },
    triggercmd: {
        initialize: (xlp) => {
            const triggerConfig = window.xldbv.configOpts.triggercmd;
            const overwriteElement = xlp.getElement('dqs', `input[name="triggerCMDUpdateOption"][value="${triggerConfig.overwriteFile}"]`);
            if (overwriteElement) overwriteElement.checked = true;

            const addCommandsElement = xlp.getElement('dqs', `input[name="triggerCMDAppsOption"][value="${triggerConfig.addCommands}"]`);
            if (addCommandsElement) addCommandsElement.checked = true;

            const autoGenerateCheckbox = xlp.getElement('autoGenerateTriggerCMD');
            if (autoGenerateCheckbox) autoGenerateCheckbox.checked = triggerConfig.autoGenerate;

            const addToPathCheckbox = xlp.getElement('addToPath');
            if (addToPathCheckbox) addToPathCheckbox.checked = triggerConfig.inPath;
        }
    },
    update: {
        initialize: (xlp) => {
            const updateConfig = window.xldbv.configOpts.updates;
            const updateElements = {
                checkUpdate: xlp.getElement('checkUpdate'),
                periodicUpdateCheck: xlp.getElement('periodicUpdateCheck'),
                updateFrequency: xlp.getElement('updateFrequency'),
                updateButton: xlp.getElement('updateAppButton'),
                updateInfoPreview: xlp.getElement('updateInfoPreview')
            };

            if (updateElements.checkUpdate) updateElements.checkUpdate.checked = updateConfig.autoCheck;
            if (updateElements.periodicUpdateCheck) updateElements.periodicUpdateCheck.checked = updateConfig.periodic?.enable ?? false;
            if (updateElements.updateFrequency) {
                updateElements.updateFrequency.value = updateConfig.periodic?.interval ?? 24;
                updateElements.updateFrequency.disabled = !(updateConfig.periodic?.enable ?? false);
            }

            if (updateElements.updateInfoPreview) {
                updateElements.updateInfoPreview.innerHTML = 'Checking for updates. Please wait...\n\n';
                if (xlp.checkForUpdatesConfig) {
                    xlp.checkForUpdatesConfig().then(({ text, hasUpdate }) => {
                        updateElements.updateInfoPreview.innerHTML = text;
                        if (updateElements.updateButton) updateElements.updateButton.disabled = !hasUpdate;
                    }).catch(error => {
                        updateElements.updateInfoPreview.innerHTML = error.message;
                        if (updateElements.updateButton) updateElements.updateButton.disabled = true;
                    });
                }
            }
        }
    },
    themes: {
        initialize: (xlp) => {
        }
    }
};

// Section Update Configuration
//   Defines update functions for each configuration section and subsection
//   Maps section and subsection names to update functions that sync form values to temp state
export const sectionUpdateConfig = {
    general: {
        system: (xlp, tempState) => {
            const footerSeconds = xlp.getElement('footerMessageDisplaySeconds')?.value;
            const newSystem = {
                show: xlp.getElement('showTray')?.checked ?? false,
                minimizeTo: xlp.getElement('minimizeToTray')?.checked ?? false,
                closeTo: xlp.getElement('closeToTray')?.checked ?? false,
                startWithWindows: xlp.getElement('startWithWindows')?.checked ?? false,
                startMinimized: xlp.getElement('startMinimized')?.checked ?? false,
                showLastLogInFooter: xlp.getElement('showLastLogInFooter')?.checked ?? false,
                footerMessageDisplaySeconds: footerSeconds ? parseInt(footerSeconds, 10) : 5
            };
            const stateChanged = JSON.stringify(newSystem) !== JSON.stringify(tempState.system);
            tempState.system = newSystem;
            return stateChanged;
        },
        logging: (xlp, tempState) => {
            const newConfig = {
                dateFormat: xlp.getElement('dateFormat')?.value ?? '',
                timeFormat: xlp.getElement('timeFormat')?.value ?? '',
                construct: xlp.getElement('construct')?.value === '1' ? 'timeFormat dateFormat' : 'dateFormat timeFormat',
                leftEncapsule: xlp.getElement('leftEncapsule')?.value ?? '',
                rightEncapsule: xlp.getElement('rightEncapsule')?.value ?? '',
                messageSeperator: xlp.getElement('messageSeperator')?.value ?? '',
                messagePrefix: xlp.getElement('messagePrefix')?.value ?? '',
                maxLogEntries: xlp.getElement('maxLogEntries')?.value ?? ''
            };
            const stateChanged = JSON.stringify(newConfig) !== JSON.stringify(tempState.xlaunchConfig);
            tempState.xlaunchConfig = newConfig;
            return stateChanged;
        },
        theme: (xlp, tempState) => {
            if (!tempState.theme) tempState.theme = {};
            const newTheme = { ...tempState.theme };
            
            const element = xlp.getElement('favouriteIcon');
            if (element) newTheme.favourite = element.value;
            
            const customSelect = xlp.getElement('dqs', '.custom-select');
            if (customSelect) newTheme.rowSelector = customSelect.dataset.value;
            
            const highlightWidth = xlp.getElement('highlightWidth');
            if (highlightWidth) newTheme.rowWidth = parseInt(highlightWidth.value);
            
            const stateChanged = JSON.stringify(newTheme) !== JSON.stringify(tempState.theme);
            tempState.theme = newTheme;
            return stateChanged;
        }
    },
    triggercmd: {
        update: (xlp, tempState) => {
            const newTriggerState = {
                overwriteFile: xlp.getElement('dqs', 'input[name="triggerCMDUpdateOption"]:checked')?.value ?? 'keep',
                addCommands: xlp.getElement('dqs', 'input[name="triggerCMDAppsOption"]:checked')?.value ?? 'favourited',
                autoGenerate: xlp.getElement('autoGenerateTriggerCMD')?.checked ?? false,
                inPath: xlp.getElement('addToPath')?.checked ?? false
            };
            const stateChanged = JSON.stringify(newTriggerState) !== JSON.stringify(tempState);
            Object.assign(tempState, newTriggerState);
            return stateChanged;
        }
    },
    update: {
        update: (xlp, tempState) => {
            const newUpdateState = {
                autoCheck: xlp.getElement('checkUpdate')?.checked ?? false,
                periodic: {
                    enable: xlp.getElement('periodicUpdateCheck')?.checked ?? false,
                    interval: parseInt(xlp.getElement('updateFrequency')?.value ?? '24')
                }
            };
            const stateChanged = JSON.stringify(newUpdateState) !== JSON.stringify(tempState);
            Object.assign(tempState, newUpdateState);
            return stateChanged;
        }
    }
};

