// Event Listener Configuration
//   Defines all event listeners and delegations for the application
//   Provides event listener configurations for global, database control, launchlist, and configuration sections
//   Handles event delegation setup and listener management
//   Centralizes event handling patterns and reduces code duplication

// Global Event Listener Configuration
//   Defines application-wide event listeners and delegations
//   Configures titlebar buttons, start button, keyboard shortcuts, and footer buttons
export const globalEventListenerConfig = [
    {
        type: 'delegation',
        parent: '.titlebar',
        event: 'click',
        selector: '.titlebar-button',
        handler: (event, target) => {
            const action = target.classList[1]?.replace('-button', '');
            if (action && xlp.handleTitleBarAction) {
                xlp.handleTitleBarAction(action);
            }
        }
    },
    {
        type: 'listener',
        element: 'start-button',
        event: 'click',
        handler: () => {
            if (window.xldbv?.firstRun !== 0) {
                window.xldbv.firstRun = 2;
                xlp.setData('xldbv', window.xldbv);
                xlp.loadSection('databasecontrol');
            }
        },
        condition: () => window.xldbv?.firstRun !== 0
    },
    {
        type: 'listener',
        element: document,
        event: 'keydown',
        handler: (event) => {
            if (event.key === 'F1') {
                event.preventDefault();
                xlp.openHelpFile();
            }
        }
    },
    {
        type: 'listener',
        element: 'footerLeftButton',
        event: 'click',
        handler: () => {
            if (xlp.handleGreenButtonClick) {
                xlp.handleGreenButtonClick();
            }
        }
    },
    {
        type: 'listener',
        element: 'footerRightButton',
        event: 'click',
        handler: () => {
            xlp.exitApp();
        }
    },
    {
        type: 'listener',
        element: 'titlebarUpdateIndicator',
        event: 'click',
        handler: () => {
            if (window.state?.isInitialized) {
                if (xlp.goToUpdateSection) {
                    xlp.goToUpdateSection();
                }
            }
        }
    },
    {
        type: 'listener',
        element: 'lastLogMessage',
        event: 'mouseenter',
        handler: () => {
            if (xlp.updateFooterLogMessage) {
                xlp.updateFooterLogMessage();
            }
        }
    }
];

// Database Control Event Listener Configuration
//   Defines event listeners and delegations for database control module
//   Configures control panel buttons, tab selection, row selection, and window resize handlers
export const databasecontrolEventListenerConfig = [
    {
        type: 'delegation',
        parent: '#controlPanel',
        event: 'click',
        selector: 'button',
        handler: (event, target) => {
            const config = xlp.databaseControlButtonConfig?.[target.id];
            if (!config) return;

            switch (config.action) {
                case 'showDialog':
                    if (config.dialog && xlp.showDialog) {
                        xlp.showDialog(config.dialog);
                    }
                    break;
                case 'function':
                    if (config.handler) {
                        const handlerFunc = xlp[config.handler];
                        if (handlerFunc) {
                            handlerFunc();
                        }
                    }
                    break;
            }
        }
    },
    {
        type: 'delegation',
        parent: '#tabList',
        event: 'click',
        selector: '.tablinks',
        handler: (event, target) => {
            const categoryName = target.getAttribute('data-category');
            if (categoryName && xlp.selectTab) {
                xlp.selectTab(categoryName, { currentTarget: target });
            }
        }
    },
    {
        type: 'delegation',
        parent: '#appTable',
        event: 'click',
        selector: '.table-row',
        handler: (event, row) => {
            if (row.classList.contains('empty-row')) return;
            
            const appCell = xlp.getElement('rqs', '.app-column', row);
            const commandCell = xlp.getElement('rqs', '.command-column', row);
            if (!appCell || !commandCell) return;
            
            const appName = appCell.textContent;
            const command = commandCell.textContent;
            const rowData = `${appName},${command}`;
            
            xlp.getElement('dqa', '#appTable .table-row').forEach(r => {
                r.classList.remove('selected');
            });
            
            row.classList.add('selected');
            window.selectedRow = rowData;
            
            if (xlp.updateEditButtonState) {
                xlp.updateEditButtonState();
            }
            xlp.updateGreenButtonState();
        }
    },
    {
        type: 'listener',
        element: window,
        event: 'resize',
        handler: () => {
            if (xlp.handleResize) {
                xlp.handleResize();
            }
        }
    }
];

// Launch List Event Listener Configuration
//   Defines event listeners and delegations for launch list module
//   Configures search input handlers, icon clicks, clear button, and table double click delegation
export const launchlistEventListenerConfig = [
    {
        type: 'listener',
        element: '.icon-circle',
        event: 'click',
        handler: 'handleIconClick',
        getElement: true
    },
    {
        type: 'listener',
        element: '.clear-button',
        event: 'click',
        handler: 'clearSearch',
        getElement: true
    },
    {
        type: 'listener',
        element: '#searchInput',
        event: 'input',
        handler: 'handleInput',
        getElement: true
    },
    {
        type: 'listener',
        element: '#searchInput',
        event: 'keydown',
        handler: 'handleKeydown',
        getElement: true
    },
    {
        type: 'listener',
        element: '#searchInput',
        event: 'focus',
        handler: 'resetShrinkTimeout',
        getElement: true
    },
    {
        type: 'listener',
        element: document,
        event: 'click',
        handler: 'handleOutsideClick',
        getElement: true
    },
    {
        type: 'delegation',
        parent: '#appTable',
        event: 'dblclick',
        selector: '.table-row',
        handler: 'handleRowDoubleClick'
    },
    {
        type: 'listener',
        element: '#tabContent',
        event: 'scroll',
        handler: 'handleScrollEnd',
        getElement: true
    }
];

// Configuration Event Listener Configuration
//   Defines event listeners and delegations for configuration module
//   Configures document click handler, change events for form fields, and input events with debouncing
export const configurationEventListenerConfig = [
    {
        type: 'listener',
        element: document,
        event: 'click',
        handler: 'documentClickHandler',
        getElement: true
    },
    {
        type: 'listener',
        element: document,
        event: 'change',
        handler: (event) => {
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
                else if (target.id === 'footerMessageDisplaySeconds') {
                    xlp.updateConfigTemp('general', 'system');
                }
                else if (target.type === 'checkbox') {
                    if (target.id.match(/^(showTray|minimizeToTray|closeToTray|startWithWindows|startMinimized|showLastLogInFooter)$/)) {
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
                        } else if (target.id === 'showLastLogInFooter') {
                            const footerMessageDisplaySeconds = xlp.getElement('footerMessageDisplaySeconds');
                            if (footerMessageDisplaySeconds) {
                                footerMessageDisplaySeconds.disabled = !target.checked;
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
        }
    },
    {
        type: 'listener',
        element: document,
        event: 'input',
        handler: (event) => {
            const target = event.target;
            if (target.id === 'messagePrefix') {
                xlp.updateConfigTemp('general', 'logging');
                xlp.updateLogFormatPreview();
                xlp.updateGreenButtonState();
            }
        },
        debounce: 300
    }
];

// Get Event Listener Configuration
//   Retrieves event listener configuration for a specific section
//   Returns event listener configuration array for specified section or null if not found
export function getEventListenerConfig(section = 'global') {
    switch (section) {
        case 'global':
            return globalEventListenerConfig;
        case 'databasecontrol':
            return databasecontrolEventListenerConfig;
        case 'launchlist':
            return launchlistEventListenerConfig;
        case 'configuration':
            return configurationEventListenerConfig;
        default:
            return null;
    }
}

