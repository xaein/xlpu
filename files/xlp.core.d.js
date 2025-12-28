// Dialog Management Module
//   Handles dialog display, state, and interactions
//   Manages all application dialogs including database control, configuration, and theme dialogs
//   Provides dialog setup, button configuration, and input focus management
//   Centralizes dialog behavior and user interaction patterns

// Dialog state tracking
let activeDialog = null;

// Add Category
//   Creates a new category and associated file
//   Creates new category file, updates variables, and adds tab button to interface
export async function categoryAdd() {
    const dialog = xlp.getElement('id', 'databasecontrolcataddDialog');
    if (!dialog) return;
    
    const categoryNameInput = xlp.getElement('rqs', 'input', dialog);
    const categoryName = categoryNameInput.value.trim();

    if (categoryName) {
        const fileName = `${categoryName}.xlfc`;
        
        const initialData = { " ": " " };
        const tempData = window.tempData ?? {};
        tempData[fileName] = JSON.stringify(initialData);

        try {
            const appDir = await e.Api.invoke('get-app-dir');
            const xldbDir = xlp.dirVar('xldb');
            const filePath = xlp.joinPath(appDir, xldbDir, fileName);
            await e.Api.invoke('write-file', filePath, JSON.stringify(initialData));

            xlp.updateVariables('addCategory', fileName);

            if (xlp.updateCategoryButtonStates) {
                xlp.updateCategoryButtonStates(true);
            }

            closeDialog('databasecontrolcatadd');

            const tabList = xlp.getElement('tabList');
            if (tabList) {
                const newTab = document.createElement('button');
                newTab.className = 'tablinks';
                newTab.textContent = categoryName;
                newTab.onclick = (event) => xlp.selectTab(categoryName, event);
                tabList.appendChild(newTab);
                
                const event = { currentTarget: newTab };
                xlp.selectTab(categoryName, event);
            }
        } catch (error) {
        }
    }
}

// Remove Category
//   Deletes a category and its associated file
//   Removes category file, updates variables, and removes tab button from interface
export async function categoryRemove() {
    const dialog = xlp.getElement('id', 'databasecontrolcatremoveDialog');
    if (!dialog) return;
    
    const categoryElement = xlp.getElement('rqs', '#categoryToRemove', dialog);
    const categoryName = categoryElement?.textContent;
    
    if (categoryName) {
        const tabList = xlp.getElement('tabList');
        const button = Array.from(tabList.children).find(btn => btn.textContent === categoryName);
        if (button) {
            tabList.removeChild(button);
        }

        const fileName = `${categoryName}.xlfc`;
        
        xlp.deleteTempData(fileName);

        try {
            const appDir = await e.Api.invoke('get-app-dir');
            const xldbDir = xlp.dirVar('xldb');
            const filePath = xlp.joinPath(appDir, xldbDir, fileName);
            await e.Api.invoke('remove-file', filePath);

            xlp.updateVariables('removeCategory', fileName);

            closeDialog('databasecontrolcatremove');

            const firstTab = xlp.getElement('rqs', '.tablinks', tabList);
            if (firstTab) {
                const firstCategoryName = firstTab.textContent;
                xlp.selectTab(firstCategoryName, { currentTarget: firstTab });
            } else {
                const tableBody = xlp.getElement('dqs', '#appTable tbody');
                if (tableBody) {
                    tableBody.innerHTML = '';
                }
                xlp.setState('database.currentCategory', null);
            }
            
            xlp.updateEditButtonState();
            xlp.updateGreenButtonState();
        } catch (error) {
        }
    }
}

// Rename Category
//   Updates category name and file
//   Renames category file, updates temp data, and updates tab button text
export async function categoryRename() {
    const dialog = xlp.getElement('id', 'databasecontrolcatrenameDialog');
    if (!dialog) return;
    
    const currentNameElement = xlp.getElement('rqs', '#currentCategoryName', dialog);
    const newNameInput = xlp.getElement('rqs', '#newCategoryNameInput', dialog);
    
    const oldCategoryName = currentNameElement?.textContent;
    const newCategoryName = newNameInput?.value.trim();

    if (oldCategoryName && newCategoryName && oldCategoryName !== newCategoryName) {
        const oldFileName = `${oldCategoryName}.xlfc`;
        const newFileName = `${newCategoryName}.xlfc`;

        try {
            const tempData = window.tempData ?? {};
            const fileData = tempData[oldFileName];
            if (fileData) {
                tempData[newFileName] = fileData;
                delete tempData[oldFileName];
                xlp.setState('database.tempData', tempData);
            }

            const appDir = await e.Api.invoke('get-app-dir');
            const xldbDir = xlp.dirVar('xldb');
            
            const oldFilePath = xlp.joinPath(appDir, xldbDir, oldFileName);
            const newFilePath = xlp.joinPath(appDir, xldbDir, newFileName);
            
            if (fileData) {
                await e.Api.invoke('write-file', newFilePath, fileData);
                await e.Api.invoke('remove-file', oldFilePath);
            }

            xlp.updateVariables('renameCategory', { oldFileName, newFileName });

            const tabList = xlp.getElement('tabList');
            const oldTab = Array.from(tabList.children).find(btn => btn.textContent === oldCategoryName);
            if (oldTab) {
                oldTab.textContent = newCategoryName;
                oldTab.onclick = (event) => xlp.selectTab(newCategoryName, event);
                oldTab.classList.add('active');
            }

            closeDialog('databasecontrolcatrename');
        } catch (error) {
        }
    }
}

// Dialog Closure
//   Hides dialog and cleans up state
//   Removes dialog display, hides modal overlay, and resets active dialog state
export function closeDialog(dialogName) {
    const dialog = xlp.getElement('id', `${dialogName}Dialog`);
    const modalOverlay = xlp.getElement('id', 'modalOverlay');
    
    if (dialog) {
        dialogCloseListener('r');
        dialog.classList.add('dialog-hidden');
        dialog.style.display = 'none';
        dialog.style.visibility = 'hidden';
        dialog.style.opacity = '0';
    }

    if (modalOverlay) {
        modalOverlay.style.display = 'none';
    }

    if (dialogName === 'launch') {
        xlp.resetAppSelection();
        if (xlp.updateFooterLogMessage) {
            xlp.updateFooterLogMessage();
        }
    }

    activeDialog = null;
}

// Confirm Row Removal
//   Shows confirmation dialog before deletion
//   Displays confirmation dialog with selected row information
export async function confirmRowRemove() {
    const selectedRow = window.selectedRow;
    if (!selectedRow) {
        return;
    }
    
    const [appName] = selectedRow.split(',');
    await showDialog('databasecontrolrowremove');
}

// Dialog Event Management
//   Manages event listeners for dialog close buttons and handles cleanup
//   Adds or removes close button event listeners based on parameter
function dialogCloseListener(r) {
    const dialog = xlp.getElement('dqs', '.dialog:not(.dialog-hidden)');
    if (dialog) {
        const closeButton = xlp.getElement('rqs', '.close-button', dialog);
        if (closeButton) {
            if (r) {
                closeButton.removeEventListener('click', () => closeDialog(dialog.id.replace('Dialog', '')));
            } else {
                closeButton.addEventListener('click', () => closeDialog(dialog.id.replace('Dialog', '')));
            }
        }
    }
}

// Add Row
//   Adds a new entry to the current category
//   Creates new row entry, updates temp data, and inserts row into table in sorted order
export async function rowAdd() {
    const dialog = xlp.getElement('id', 'databasecontrolrowaddDialog');
    if (!dialog) return;
    
    const appNameInput = xlp.getElement('rqs', '#appNameInput', dialog);
    const appCmdInput = xlp.getElement('rqs', '#appCmdInput', dialog);
    
    const appName = appNameInput?.value.trim();
    const appCmd = appCmdInput?.value.trim();

    if (appNameInput) appNameInput.value = '';
    if (appCmdInput) appCmdInput.value = '';

    if (!appName || !appCmd) {
        return;
    }

    const activeTab = document.querySelector('.tablinks.active');
    if (!activeTab) {
        return;
    }

    const categoryName = activeTab.textContent;
    const fileName = `${categoryName}.xlfc`;

    const tempData = window.tempData ?? {};
    if (!tempData[fileName]) {
        tempData[fileName] = JSON.stringify({});
        xlp.setState('database.tempData', tempData);
    }
    let fileData = JSON.parse(tempData[fileName]);

    if (fileData[" "] === " ") {
        delete fileData[" "];
    }

    fileData[appName] = appCmd;
    tempData[fileName] = JSON.stringify(fileData);
    xlp.setState('database.tempData', tempData);

    const tableBody = xlp.getElement('dqs', '#appTable tbody');
    if (tableBody) {
        const newRow = document.createElement('tr');
        newRow.className = 'table-row';
        newRow.innerHTML = `
            <td class="app-column">${appName}</td>
            <td class="command-column">${appCmd}</td>
        `;

        const rows = Array.from(xlp.getElement('rqa', '.table-row', tableBody));
        let insertIndex = rows.findIndex(row => {
            const existingAppName = xlp.getElement('rqs', '.app-column', row)?.textContent;
            return appName.localeCompare(existingAppName) < 0;
        });

        if (insertIndex === -1) {
            tableBody.appendChild(newRow);
        } else {
            tableBody.insertBefore(newRow, rows[insertIndex]);
        }

        newRow.addEventListener('click', (event) => {
            const selectedRows = xlp.getElement('dqa', '.table-row.selected');
            selectedRows.forEach(row => row.classList.remove('selected'));
            newRow.classList.add('selected');
            xlp.setState('database.selectedRow', `${appName},${appCmd}`);
            xlp.updateEditButtonState();
            xlp.updateGreenButtonState();
        });
    }

    closeDialog('databasecontrolrowadd');
}

// Edit Row
//   Updates an existing entry in the current category
//   Modifies row entry, updates temp data, and refreshes table row display
export async function rowEdit() {
    const dialog = xlp.getElement('id', 'databasecontrolroweditDialog');
    if (!dialog) return;
    
    const appNameInput = xlp.getElement('rqs', '#appNameInput', dialog);
    const appCmdInput = xlp.getElement('rqs', '#appCmdInput', dialog);
    
    if (!appNameInput || !appCmdInput) {
        return;
    }

    const newAppName = appNameInput.value.trim();
    const newAppCmd = appCmdInput.value.trim();

    if (!newAppName || !newAppCmd) {
        return;
    }

    const selectedRow = xlp.getElement('dqs', '#appTable .table-row.selected');
    if (!selectedRow) {
        return;
    }

    const oldAppName = xlp.getElement('rqs', '.app-column', selectedRow)?.textContent;

    const activeTab = xlp.getElement('dqs', '.tablinks.active');
    if (!activeTab) {
        return;
    }

    const categoryName = activeTab.textContent;
    const fileName = `${categoryName}.xlfc`;

    const tempData = window.tempData ?? {};
    if (!tempData[fileName]) {
        return;
    }

    let fileData = JSON.parse(tempData[fileName]);

    if (oldAppName === newAppName) {
        fileData[newAppName] = newAppCmd;
    } else {
        delete fileData[oldAppName];
        fileData[newAppName] = newAppCmd;
    }

    tempData[fileName] = JSON.stringify(fileData);
    xlp.setState('database.tempData', tempData);

    closeDialog('databasecontrolrowedit');
    
    const appCell = xlp.getElement('rqs', '.app-column', selectedRow);
    const commandCell = xlp.getElement('rqs', '.command-column', selectedRow);
    
    if (appCell && commandCell) {
        appCell.textContent = newAppName;
        commandCell.textContent = newAppCmd;
        xlp.setState('database.selectedRow', `${newAppName},${newAppCmd}`);
    }
    
    xlp.updateEditButtonState();
    xlp.updateGreenButtonState();
}

// Remove Row
//   Deletes an entry from the current category
//   Removes row entry, updates temp data, and removes row from table or resets to empty state
export async function rowRemove() {
    const selectedRow = xlp.getElement('dqs', '#appTable .table-row.selected');
    if (!selectedRow) {
        return;
    }

    const appName = xlp.getElement('rqs', '.app-column', selectedRow)?.textContent;

    const activeTab = xlp.getElement('dqs', '.tablinks.active');
    if (!activeTab) {
        return;
    }

    const categoryName = activeTab.textContent;
    const fileName = `${categoryName}.xlfc`;

    const tempData = window.tempData ?? {};
    if (!tempData[fileName]) {
        return;
    }

    let fileData = JSON.parse(tempData[fileName]);
    delete fileData[appName];

    if (Object.keys(fileData).length === 0) {
        fileData[" "] = " ";
        const tableBody = xlp.getElement('dqs', '#appTable tbody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr class="table-row">
                    <td class="app-column"> </td>
                    <td class="command-column"> </td>
                </tr>
            `;
        }
    } else {
        selectedRow.remove();
    }

    tempData[fileName] = JSON.stringify(fileData);
    xlp.setState('database.tempData', tempData);

    closeDialog('databasecontrolrowremove');

    xlp.setState('database.selectedRow', null);
    xlp.updateEditButtonState();
}

// Application File Selection
//   Opens file selection dialog for application path
//   Opens file dialog, parses shortcut information, and populates dialog input fields
export async function selectApplicationFile() {
    try {
        const defaultDir = await e.Api.invoke('get-desktop-dir');
        const result = await e.Api.invoke('open-file-dialog', {
            title: 'Select Application File',
            defaultPath: defaultDir,
            properties: ['openFile'],
            filters: [
                { name: 'Applications', extensions: ['lnk', 'url', 'exe', 'bat', 'vbs', 'cmd'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0];
            const shortcutInfo = await e.Api.invoke('parse-shortcut', filePath);
            
            const dialog = xlp.getElement('dqs', '.dialog:not(.dialog-hidden)');
            if (!dialog) return;
            
            const appNameInput = xlp.getElement('rqs', '#appNameInput', dialog);
            const appCmdInput = xlp.getElement('rqs', '#appCmdInput', dialog);
            
            if (appNameInput && appCmdInput) {
                appNameInput.value = shortcutInfo?.name ?? '';
                appCmdInput.value = shortcutInfo?.target || filePath;
                
                const okButton = xlp.getElement('rqs', '.ok-button', dialog);
                if (okButton) {
                    if (appNameInput.value.trim() && appCmdInput.value.trim()) {
                        okButton.disabled = false;
                        okButton.style.opacity = '1';
                        okButton.style.cursor = 'pointer';
                    }
                }
            }
        }
    } catch (error) {
    }
}

// Database Control Dialog Setup
//   Initializes and populates database control dialogs
//   Clears inputs and buttons, sets up handlers from configuration, and configures button states
function setupDatabaseControlDialog(dialogName) {
    const dialog = xlp.getElement('id', `${dialogName}Dialog`);
    if (!dialog) return;
    
    const dialogInputs = xlp.getElement('rqa', 'input', dialog);
    dialogInputs.forEach(input => {
        input.value = '';
        input.oninput = () => updateDialogOkButton(dialogName);
    });

    const dialogButtons = xlp.getElement('rqa', 'button', dialog);
    dialogButtons.forEach(button => {
        button.onclick = null;
    });

    const config = xlp.dialogConfig?.[dialogName];
    if (!config) return;

    const handlerMap = {
        categoryAdd,
        categoryRemove,
        categoryRename,
        rowAdd,
        rowEdit,
        rowRemove,
        selectApplicationFile
    };

    switch (dialogName) {
        case 'databasecontrolcatadd':
        case 'databasecontrolcatrename':
        case 'databasecontrolcatremove':
        case 'databasecontrolrowadd':
        case 'databasecontrolrowedit':
        case 'databasecontrolrowremove':
            if (config.preSetup) {
                config.preSetup(dialog, xlp);
            }
            if (config.focusSelector) {
                xlp.focusInputAfterDelay(config.focusSelector);
            }
            const handlerFunc = handlerMap[config.handler];
            if (handlerFunc) {
                xlp.setupDialogButton(dialogName, () => handlerFunc(), config.buttonClass);
            }
            if (config.additionalButtons) {
                config.additionalButtons.forEach(btn => {
                    const btnHandlerFunc = handlerMap[btn.handler];
                    if (btnHandlerFunc) {
                        xlp.setupDialogButton(dialogName, () => btnHandlerFunc(), btn.buttonClass);
                    }
                });
            }
            break;
    }
    
    xlp.setupDialogButton(dialogName, () => closeDialog(dialogName), '.close-button');
    
    updateDialogOkButton(dialogName);
}

// Configuration Change Handler
//   Manages unsaved configuration changes between sections
//   Shows dialog prompting user to save or discard configuration changes
export async function showConfigChangeDialog(section) {
    return new Promise((resolve) => {
        const dialog = xlp.getElement('id', 'configchangeDialog');
        if (!dialog) return;
        const sectionSpan = xlp.getElement('rqs', '#configChangeSection', dialog);
        const saveButton = xlp.getElement('rqs', '.ok-button', dialog);
        const discardButton = xlp.getElement('rqs', '.close-button', dialog);

        sectionSpan.textContent = section;
        dialog.classList.remove('dialog-hidden');

        const handleSave = () => {
            cleanup();
            resolve(true);
        };

        const handleDiscard = () => {
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            dialog.classList.add('dialog-hidden');
            saveButton.removeEventListener('click', handleSave);
            discardButton.removeEventListener('click', handleDiscard);
        };

        saveButton.addEventListener('click', handleSave);
        discardButton.addEventListener('click', handleDiscard);
    });
}

// Configuration Save Confirmation
//   Shows confirmation after saving configuration changes
//   Displays confirmation dialog indicating configuration section was saved
export function showConfigSaveDialog(section) {
    const dialog = xlp.getElement('id', 'configsaveDialog');
    if (!dialog) return;
    const headerLabel = xlp.getElement('rqs', '.app-name-label', dialog);
    const messageParagraph = xlp.getElement('rqs', 'p', dialog);
    const okButton = xlp.getElement('rqs', '.ok-button', dialog);

    if (section === 'themes') {
        headerLabel.textContent = 'Theme Applied';
        messageParagraph.textContent = 'Your Theme has been applied.';
    } else {
        headerLabel.textContent = 'Configuration Saved';
        messageParagraph.innerHTML = 'Your changes in the <span id="configSaveSection"></span> section have been saved.';
        const sectionSpan = xlp.getElement('rqs', '#configSaveSection', dialog);
        sectionSpan.textContent = section;
    }

    dialog.classList.remove('dialog-hidden');

    const handleOk = () => {
        dialog.classList.add('dialog-hidden');
        okButton.removeEventListener('click', handleOk);
    };

    okButton.addEventListener('click', handleOk);
}

// Database Change Handler
//   Manages unsaved database changes and handles dialog interactions
//   Shows dialog prompting user to save or discard database changes
export async function showDatabaseChangeDialog() {
    return new Promise((resolve) => {
        xlp.showDialog('databasecontrolconfirm');
        const confirmDialog = xlp.getElement('id', 'databasecontrolconfirmDialog');
        const okButton = confirmDialog ? xlp.getElement('rqs', '.ok-button', confirmDialog) : null;
        const cancelButton = confirmDialog ? xlp.getElement('rqs', '.close-button', confirmDialog) : null;

        const handleSave = () => {
            cleanup();
            xlp.closeDialog('databasecontrolconfirm');
            resolve(true);
        };

        const handleDiscard = () => {
            cleanup();
            xlp.closeDialog('databasecontrolconfirm');
            resolve(false);
        };

        const cleanup = () => {
            okButton?.removeEventListener('click', handleSave);
            cancelButton?.removeEventListener('click', handleDiscard);
        };

        if (okButton) okButton.addEventListener('click', handleSave);
        if (cancelButton) cancelButton.addEventListener('click', handleDiscard);
    });
}

// Dialog Display
//   Shows and configures dialog with overlay
//   Displays modal overlay, sets up dialog configuration, and manages active dialog state
export async function showDialog(dialogName) {
    const dialog = xlp.getElement('id', `${dialogName}Dialog`);
    const modalOverlay = xlp.getElement('id', 'modalOverlay');
    
    if (!dialog) {
        return;
    }

    if (modalOverlay) {
        modalOverlay.style.display = 'block';
    }

    if (activeDialog) {
        closeDialog(activeDialog);
    }

    if (xlp.dialogConfig?.[dialogName]) {
        setupDatabaseControlDialog(dialogName);
    }

    dialog.classList.remove('dialog-hidden');
    dialog.style.display = 'flex';
    dialog.style.visibility = 'visible';
    dialog.style.opacity = '1';
    activeDialog = dialogName;

    dialogCloseListener();
}

// Unsaved Changes Handler
//   Manages section navigation with pending changes
//   Loads section without showing unsaved changes dialog
export async function showUnsavedChangesDialog(pendingSection) {
    await xlp.loadSection(pendingSection);
}

// Dialog Button State
//   Updates dialog button states based on input validation
//   Validates input values and updates button enabled state, opacity, and cursor style
function updateDialogOkButton(dialogName) {
    const dialog = xlp.getElement('id', `${dialogName}Dialog`);
    if (!dialog) return;
    
    const okButton = xlp.getElement('rqs', '.ok-button', dialog);
    if (!okButton) return;
    
    const config = xlp.dialogConfig?.[dialogName];
    
    switch (dialogName) {
        case 'databasecontrolcatadd':
        case 'databasecontrolcatrename':
        case 'databasecontrolrowadd':
        case 'databasecontrolrowedit':
            if (config?.requiresValidation) {
                const input = xlp.getElement('rqs', 'input', dialog);
                const hasValue = input?.value.trim() !== '';
                okButton.disabled = !hasValue;
                okButton.style.opacity = hasValue ? '1' : '0.5';
                okButton.style.cursor = hasValue ? 'pointer' : 'default';
            } else {
                okButton.disabled = false;
                okButton.style.opacity = '1';
                okButton.style.cursor = 'pointer';
            }
            break;
            
        default:
            okButton.disabled = false;
            okButton.style.opacity = '1';
            okButton.style.cursor = 'pointer';
    }
}
