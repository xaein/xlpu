// Configuration Defaults and Data
//   Defines default values and core section configuration
//   Provides default configuration values for logging, themes, and application settings
//   Defines base state structures and configuration templates
//   Centralizes default values used across configuration modules

// Core Section Configuration
//   Defines section structure and configuration for all application sections
//   Contains label, styles, templates, scripts, DOM elements, and footer button settings
export const sections = {
    launchlist: {
        label: 'Launch List',
        styles: ['launchlist'],
        templates: {
            main: 'launchlist',
            dialogs: ['launch']
        },
        scripts: ['m.tables', 'm.launchlist'],
        domElements: [
            'tabContent', 'appTable', 'measureDiv', 'tableContainer', 'searchInput',
            'clearButton', 'iconCircle', 'searchContainer', 'searchWrapper', 'launchDialog'
        ],
        footerButtons: {
            left: {
                text: 'Launch',
                enabled: false,
                visible: true
            }
        }
    },
    databasecontrol: {
        label: 'Database Control',
        styles: ['databasecontrol'],
        templates: {
            main: 'databasecontrol',
            dialogs: [
                'databasecontrolcatadd', 'databasecontrolcatremove', 'databasecontrolcatrename',
                'databasecontrolrowadd', 'databasecontrolrowremove', 'databasecontrolrowedit',
                'databasecontrolconfirm', 'databasecontrolsave'
            ]
        },
        scripts: ['m.tables', 'm.databasecontrol.s', 'm.databasecontrol'],
        domElements: [
            'tabContainer', 'tabListContainer', 'tabList', 'tableControls', 'tableContainer',
            'appTable', 'controlPanel', 'addCategoryButton', 'renameCategoryButton',
            'removeCategoryButton', 'addRowButton', 'editRowButton', 'removeRowButton',
            'databasecontrolsaveDialog', 'saveCurrentCategory', 'saveHeaderMain', 'saveCategoryLabel'
        ],
        footerButtons: {
            left: {
                text: 'Save',
                enabled: false,
                visible: true
            }
        }
    },
    configuration: {
        label: 'Configuration',
        styles: ['configuration'],
        templates: {
            main: 'configuration',
            dialogs: ['configsave', 'configchange', 'themeimport', 'themedelete']
        },
        scripts: ['m.configuration.t', 'm.configuration.u', 'm.configuration.i', 'm.configuration'],
        domElements: [
            'configList', 'updateIndicator', 'favouriteIcon', 'highlightWidth', 'highlightWidthValue',
            'dateFormat', 'timeFormat', 'construct', 'leftEncapsule', 'rightEncapsule',
            'messageSeperator', 'messagePrefix', 'maxLogEntries', 'logFormatPreview',
            'showTray', 'minimizeToTray', 'closeToTray', 'startWithWindows', 'startMinimized', 'showLastLogInFooter', 'footerMessageDisplaySeconds',
            'autoGenerateTriggerCMD', 'addToPath', 'triggerCmdUpdateStatus', 'updateTriggerCMDFile',
            'updateInfoPreview', 'checkUpdate', 'periodicUpdateCheck', 'updateFrequency', 'updateAppButton',
            'themeList', 'importThemeButton', 'removeThemeButton', 'themePreview',
            'previewTableBody', 'themeToDelete', 'themeImportPath', 'selectThemeFile'
        ],
        footerButtons: {
            left: {
                text: 'Save',
                enabled: false,
                visible: true
            }
        }
    },
    logging: {
        label: 'Logging',
        styles: ['logging'],
        templates: {
            main: 'logging'
        },
        scripts: ['m.logging'],
        domElements: [
            'logContent'
        ],
        footerButtons: {
            left: {
                text: '',
                enabled: false,
                visible: false
            }
        }
    }
};

// Configuration Defaults
//   Defines default values for all configuration sections
//   Provides default values for logging, theme, system, triggercmd, and update configurations
export const configDefaults = {
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
        startMinimized: false,
        showLastLogInFooter: false,
        footerMessageDisplaySeconds: 5
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

