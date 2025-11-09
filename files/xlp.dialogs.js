// Dialog Configuration
//   Defines setup behavior for all dialogs
//   Provides configuration objects for dialog setup, button handlers, and input management
//   Maps dialog names to their setup functions and behavior patterns
//   Centralizes dialog configuration and interaction patterns

// Database Control Dialog Configuration
//   Defines setup behavior for each database control dialog
//   Maps dialog names to handler functions, focus selectors, validation requirements, and pre-setup functions
export const dialogConfig = {
    databasecontrolcatadd: {
        handler: 'categoryAdd',
        focusSelector: `#databasecontrolcataddDialog input`,
        buttonClass: '.ok-button',
        requiresValidation: true
    },
    databasecontrolcatrename: {
        handler: 'categoryRename',
        focusSelector: `#databasecontrolcatrenameDialog input`,
        buttonClass: '.ok-button',
        requiresValidation: true,
        preSetup: (dialog, xlp) => {
            const activeTab = xlp.getElement('dqs', '.tablinks.active');
            if (activeTab) {
                const categoryName = activeTab.textContent;
                const nameElement = xlp.getElement('rqs', '#currentCategoryName', dialog);
                if (nameElement) {
                    nameElement.textContent = categoryName;
                }
            }
        }
    },
    databasecontrolcatremove: {
        handler: 'categoryRemove',
        buttonClass: '.ok-button',
        preSetup: (dialog, xlp) => {
            const activeTab = xlp.getElement('dqs', '.tablinks.active');
            if (activeTab) {
                const categoryName = activeTab.textContent;
                const nameElement = xlp.getElement('rqs', '#categoryToRemove', dialog);
                if (nameElement) {
                    nameElement.textContent = categoryName;
                }
            }
        }
    },
    databasecontrolrowadd: {
        handler: 'rowAdd',
        focusSelector: `#databasecontrolrowaddDialog input`,
        buttonClass: '.ok-button',
        requiresValidation: true,
        additionalButtons: [
            { handler: 'selectApplicationFile', buttonClass: '.select-file-button' }
        ]
    },
    databasecontrolrowedit: {
        handler: 'rowEdit',
        focusSelector: `#databasecontrolroweditDialog #appCmdInput`,
        buttonClass: '.ok-button',
        requiresValidation: true,
        additionalButtons: [
            { handler: 'selectApplicationFile', buttonClass: '.select-file-button' }
        ],
        preSetup: (dialog, xlp) => {
            const selectedRow = window.selectedRow;
            if (selectedRow) {
                const [appName, command] = selectedRow.split(',');
                const nameInput = xlp.getElement('rqs', '#appNameInput', dialog);
                const cmdInput = xlp.getElement('rqs', '#appCmdInput', dialog);
                if (nameInput) nameInput.value = appName;
                if (cmdInput) cmdInput.value = command;
            }
        }
    },
    databasecontrolrowremove: {
        handler: 'rowRemove',
        buttonClass: '.ok-button',
        preSetup: (dialog, xlp) => {
            const selectedRow = window.selectedRow;
            if (selectedRow) {
                const [appName] = selectedRow.split(',');
                const nameElement = xlp.getElement('rqs', '#appToRemove', dialog);
                if (nameElement) {
                    nameElement.textContent = appName;
                }
            }
        }
    }
};

