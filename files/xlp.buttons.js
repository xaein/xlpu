// Button Configuration
//   Defines handler functions and button state logic for all button types
//   Provides configuration objects for green button, database control buttons, and window actions
//   Handles button state management and enabled/disabled logic
//   Centralizes button behavior and action mapping

// Green Button Configuration
//   Defines handler functions and button state logic for each section
//   Maps section names to handler functions, button text getters, and enabled state getters
export const greenButtonConfig = {
    launchlist: {
        handler: 'handleLaunch',
        getButtonText: () => 'Launch',
        getEnabled: () => !!window.selectedApp
    },
    databasecontrol: {
        handler: 'saveDatabase',
        getButtonText: () => 'Save',
        getEnabled: () => {
            const preloadedData = xlp.getData('preloadedData') ?? {};
            const tempData = window.tempData ?? {};
            return JSON.stringify(preloadedData) !== JSON.stringify(tempData);
        }
    },
    configuration: {
        handler: 'saveConfiguration',
        getButtonText: () => {
            if (xlp.getState('config.activePanel') === 'themes') {
                return 'Apply';
            }
            return 'Save';
        },
        getEnabled: () => xlp.hasUnsavedChanges()
    }
};

// Database Control Button Configuration
//   Maps button IDs to dialog names or action functions
//   Defines button actions including showDialog and function handler types
export const databaseControlButtonConfig = {
    addCategoryButton: {
        action: 'showDialog',
        dialog: 'databasecontrolcatadd'
    },
    renameCategoryButton: {
        action: 'showDialog',
        dialog: 'databasecontrolcatrename'
    },
    removeCategoryButton: {
        action: 'showDialog',
        dialog: 'databasecontrolcatremove'
    },
    addRowButton: {
        action: 'showDialog',
        dialog: 'databasecontrolrowadd'
    },
    editRowButton: {
        action: 'showDialog',
        dialog: 'databasecontrolrowedit'
    },
    removeRowButton: {
        action: 'function',
        handler: 'confirmRowRemove'
    }
};

