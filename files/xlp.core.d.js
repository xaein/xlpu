// Dialog Management Module
// Handles dialog display, state, and interactions

// Dialog state tracking
let activeDialog = null;

// Dialog Display
// Shows and configures dialog with overlay
export async function showDialog(dialogName) {
    const dialog = document.getElementById(`${dialogName}Dialog`);
    const modalOverlay = document.getElementById('modalOverlay');
    
    if (!dialog) {
        return;
    }

    if (modalOverlay) {
        modalOverlay.style.display = 'block';
    }

    if (activeDialog) {
        closeDialog(activeDialog);
    }

    if (dialogName.startsWith('databasecontrol')) {
        setupDatabaseControlDialog(dialogName);
    }

    dialog.classList.remove('dialog-hidden');
    dialog.style.display = 'flex';
    dialog.style.visibility = 'visible';
    dialog.style.opacity = '1';
    activeDialog = dialogName;

    dialogCloseListener();
}

// Database Control Dialog Setup
// Initializes and populates database control dialogs
function setupDatabaseControlDialog(dialogName) {
    const dialogInputs = document.querySelectorAll(`#${dialogName}Dialog input`);
    dialogInputs.forEach(input => {
        input.value = '';
        input.oninput = () => updateDialogOkButton(dialogName);
    });

    const dialogButtons = document.querySelectorAll(`#${dialogName}Dialog button`);
    dialogButtons.forEach(button => {
        button.onclick = null;
    });

    switch (dialogName) {
        case 'databasecontrolcatadd':
            setTimeout(() => {
                document.querySelector(`#${dialogName}Dialog input`)?.focus();
            }, 100);
            
            const addCatOkButton = document.querySelector(`#${dialogName}Dialog .ok-button`);
            if (addCatOkButton) {
                addCatOkButton.onclick = () => categoryAdd();
            }
            break;
            
        case 'databasecontrolcatrename':
            const activeTab = document.querySelector('.tablinks.active');
            if (activeTab) {
                const categoryName = activeTab.textContent;
                const nameElement = document.querySelector(`#${dialogName}Dialog #currentCategoryName`);
                if (nameElement) {
                    nameElement.textContent = categoryName;
                }
                setTimeout(() => {
                    document.querySelector(`#${dialogName}Dialog input`)?.focus();
                }, 100);
            }
            
            const renameCatOkButton = document.querySelector(`#${dialogName}Dialog .ok-button`);
            if (renameCatOkButton) {
                renameCatOkButton.onclick = () => categoryRename();
            }
            break;
            
        case 'databasecontrolcatremove':
            const activeTab2 = document.querySelector('.tablinks.active');
            if (activeTab2) {
                const categoryName = activeTab2.textContent;
                const nameElement = document.querySelector(`#${dialogName}Dialog #categoryToRemove`);
                if (nameElement) {
                    nameElement.textContent = categoryName;
                }
            }
            
            const removeCatOkButton = document.querySelector(`#${dialogName}Dialog .ok-button`);
            if (removeCatOkButton) {
                removeCatOkButton.onclick = () => categoryRemove();
            }
            break;
            
        case 'databasecontrolrowadd':
            setTimeout(() => {
                document.querySelector(`#${dialogName}Dialog input`)?.focus();
            }, 100);
            
            const addRowSelectFileBtn = document.querySelector(`#${dialogName}Dialog .select-file-button`);
            if (addRowSelectFileBtn) {
                addRowSelectFileBtn.onclick = () => selectApplicationFile();
            }
            
            const addRowOkButton = document.querySelector(`#${dialogName}Dialog .ok-button`);
            if (addRowOkButton) {
                addRowOkButton.onclick = () => rowAdd();
            }
            break;
            
        case 'databasecontrolrowedit':
            if (window.selectedRow) {
                const [appName, command] = window.selectedRow.split(',');
                const nameInput = document.querySelector(`#${dialogName}Dialog #appNameInput`);
                const cmdInput = document.querySelector(`#${dialogName}Dialog #appCmdInput`);
                
                if (nameInput) nameInput.value = appName;
                if (cmdInput) cmdInput.value = command;
                
                setTimeout(() => {
                    document.querySelector(`#${dialogName}Dialog #appCmdInput`)?.focus();
                }, 100);
            }
            
            const editRowSelectFileBtn = document.querySelector(`#${dialogName}Dialog .select-file-button`);
            if (editRowSelectFileBtn) {
                editRowSelectFileBtn.onclick = () => selectApplicationFile();
            }
            
            const editRowOkButton = document.querySelector(`#${dialogName}Dialog .ok-button`);
            if (editRowOkButton) {
                editRowOkButton.onclick = () => rowEdit();
            }
            break;
            
        case 'databasecontrolrowremove':
            if (window.selectedRow) {
                const [appName] = window.selectedRow.split(',');
                const nameElement = document.querySelector(`#${dialogName}Dialog #appToRemove`);
                if (nameElement) {
                    nameElement.textContent = appName;
                }
            }
            
            const removeRowOkButton = document.querySelector(`#${dialogName}Dialog .ok-button`);
            if (removeRowOkButton) {
                removeRowOkButton.onclick = () => rowRemove();
            }
            break;
    }
    
    const cancelButton = document.querySelector(`#${dialogName}Dialog .close-button`);
    if (cancelButton) {
        cancelButton.onclick = () => closeDialog(dialogName);
    }
    
    updateDialogOkButton(dialogName);
}

// Dialog Button State
// Updates dialog button states based on input validation
function updateDialogOkButton(dialogName) {
    const okButton = document.querySelector(`#${dialogName}Dialog .ok-button`);
    if (!okButton) return;
    
    switch (dialogName) {
        case 'databasecontrolcatadd':
        case 'databasecontrolcatrename':
        case 'databasecontrolrowadd':
        case 'databasecontrolrowedit':
            const hasValue = document.querySelector(`#${dialogName}Dialog input`)?.value.trim() !== '';
            okButton.disabled = !hasValue;
            okButton.style.opacity = hasValue ? '1' : '0.5';
            okButton.style.cursor = hasValue ? 'pointer' : 'default';
            break;
            
        default:
            okButton.disabled = false;
            okButton.style.opacity = '1';
            okButton.style.cursor = 'pointer';
    }
}

// Dialog Closure
// Hides dialog and cleans up state
export function closeDialog(dialogName) {
    const dialog = document.getElementById(`${dialogName}Dialog`);
    const modalOverlay = document.getElementById('modalOverlay');
    
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
    }

    activeDialog = null;
}

// Add Category
// Creates a new category and associated file
export async function categoryAdd() {
    const dialog = document.getElementById('databasecontrolcataddDialog');
    if (!dialog) return;
    
    const categoryNameInput = dialog.querySelector('input');
    const categoryName = categoryNameInput.value.trim();

    if (categoryName) {
        const fileName = `${categoryName}.xlfc`;
        
        if (!window.tempData) {
            window.tempData = {};
        }
        const initialData = { " ": " " };
        window.tempData[fileName] = JSON.stringify(initialData);

        try {
            const appDir = await e.Api.invoke('get-app-dir');
            const xldbDir = xlp.dirVar('xldb');
            const filePath = xlp.joinPath(appDir, xldbDir, fileName);
            await e.Api.invoke('write-file', filePath, JSON.stringify(initialData));

            xlp.updateVariables('addCategory', fileName);

            closeDialog('databasecontrolcatadd');

            const tabList = document.getElementById('tabList');
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
// Deletes a category and its associated file
export async function categoryRemove() {
    const dialog = document.getElementById('databasecontrolcatremoveDialog');
    if (!dialog) return;
    
    const categoryElement = dialog.querySelector('#categoryToRemove');
    const categoryName = categoryElement?.textContent;
    
    if (categoryName) {
        const tabList = document.getElementById('tabList');
        const button = Array.from(tabList.children).find(btn => btn.textContent === categoryName);
        if (button) {
            tabList.removeChild(button);
        }

        const fileName = `${categoryName}.xlfc`;
        
        delete window.tempData[fileName];

        try {
            const appDir = await e.Api.invoke('get-app-dir');
            const xldbDir = xlp.dirVar('xldb');
            const filePath = xlp.joinPath(appDir, xldbDir, fileName);
            await e.Api.invoke('remove-file', filePath);

            xlp.updateVariables('removeCategory', fileName);

            closeDialog('databasecontrolcatremove');

            const firstTab = tabList.querySelector('.tablinks');
            if (firstTab) {
                const firstCategoryName = firstTab.textContent;
                xlp.selectTab(firstCategoryName, { currentTarget: firstTab });
            } else {
                const tableBody = document.querySelector('#appTable tbody');
                if (tableBody) {
                    tableBody.innerHTML = '';
                }
                window.currentCategory = null;
            }
            
            xlp.updateEditButtonState();
            xlp.updateGreenButtonState();
        } catch (error) {
        }
    }
}

// Rename Category
// Updates category name and file
export async function categoryRename() {
    const dialog = document.getElementById('databasecontrolcatrenameDialog');
    if (!dialog) return;
    
    const currentNameElement = dialog.querySelector('#currentCategoryName');
    const newNameInput = dialog.querySelector('#newCategoryNameInput');
    
    const oldCategoryName = currentNameElement?.textContent;
    const newCategoryName = newNameInput?.value.trim();

    if (oldCategoryName && newCategoryName && oldCategoryName !== newCategoryName) {
        const oldFileName = `${oldCategoryName}.xlfc`;
        const newFileName = `${newCategoryName}.xlfc`;

        try {
            const fileData = window.tempData[oldFileName];
            if (fileData) {
                window.tempData[newFileName] = fileData;
                delete window.tempData[oldFileName];
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

            const tabList = document.getElementById('tabList');
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

// Add Row
// Adds a new entry to the current category
export async function rowAdd() {
    const dialog = document.getElementById('databasecontrolrowaddDialog');
    if (!dialog) return;
    
    const appNameInput = dialog.querySelector('#appNameInput');
    const appCmdInput = dialog.querySelector('#appCmdInput');
    
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

    if (!window.tempData[fileName]) {
        window.tempData[fileName] = JSON.stringify({});
    }
    let fileData = JSON.parse(window.tempData[fileName]);

    if (fileData[" "] === " ") {
        delete fileData[" "];
    }

    fileData[appName] = appCmd;
    window.tempData[fileName] = JSON.stringify(fileData);

    const tableBody = document.querySelector('#appTable tbody');
    if (tableBody) {
        const newRow = document.createElement('tr');
        newRow.className = 'table-row';
        newRow.innerHTML = `
            <td class="app-column">${appName}</td>
            <td class="command-column">${appCmd}</td>
        `;

        const rows = Array.from(tableBody.querySelectorAll('.table-row'));
        let insertIndex = rows.findIndex(row => {
            const existingAppName = row.querySelector('.app-column').textContent;
            return appName.localeCompare(existingAppName) < 0;
        });

        if (insertIndex === -1) {
            tableBody.appendChild(newRow);
        } else {
            tableBody.insertBefore(newRow, rows[insertIndex]);
        }

        newRow.addEventListener('click', (event) => {
            const selectedRows = document.querySelectorAll('.table-row.selected');
            selectedRows.forEach(row => row.classList.remove('selected'));
            newRow.classList.add('selected');
            window.selectedRow = `${appName},${appCmd}`;
            xlp.updateEditButtonState();
            xlp.updateGreenButtonState();
        });
    }

    closeDialog('databasecontrolrowadd');
}

// Edit Row
// Updates an existing entry in the current category
export async function rowEdit() {
    const dialog = document.getElementById('databasecontrolroweditDialog');
    if (!dialog) return;
    
    const appNameInput = dialog.querySelector('#appNameInput');
    const appCmdInput = dialog.querySelector('#appCmdInput');
    
    if (!appNameInput || !appCmdInput) {
        return;
    }

    const newAppName = appNameInput.value.trim();
    const newAppCmd = appCmdInput.value.trim();

    if (!newAppName || !newAppCmd) {
        return;
    }

    const selectedRow = document.querySelector('#appTable .table-row.selected');
    if (!selectedRow) {
        return;
    }

    const oldAppName = selectedRow.querySelector('.app-column').textContent;

    const activeTab = document.querySelector('.tablinks.active');
    if (!activeTab) {
        return;
    }

    const categoryName = activeTab.textContent;
    const fileName = `${categoryName}.xlfc`;

    if (!window.tempData[fileName]) {
        return;
    }

    let fileData = JSON.parse(window.tempData[fileName]);

    if (oldAppName === newAppName) {
        fileData[newAppName] = newAppCmd;
    } else {
        delete fileData[oldAppName];
        fileData[newAppName] = newAppCmd;
    }

    window.tempData[fileName] = JSON.stringify(fileData);

    closeDialog('databasecontrolrowedit');
    
    const appCell = selectedRow.querySelector('.app-column');
    const commandCell = selectedRow.querySelector('.command-column');
    
    if (appCell && commandCell) {
        appCell.textContent = newAppName;
        commandCell.textContent = newAppCmd;
        window.selectedRow = `${newAppName},${newAppCmd}`;
    }
    
    xlp.updateEditButtonState();
    xlp.updateGreenButtonState();
}

// Remove Row
// Deletes an entry from the current category
export async function rowRemove() {
    const selectedRow = document.querySelector('#appTable .table-row.selected');
    if (!selectedRow) {
        return;
    }

    const appName = selectedRow.querySelector('.app-column').textContent;

    const activeTab = document.querySelector('.tablinks.active');
    if (!activeTab) {
        return;
    }

    const categoryName = activeTab.textContent;
    const fileName = `${categoryName}.xlfc`;

    if (!window.tempData[fileName]) {
        return;
    }

    let fileData = JSON.parse(window.tempData[fileName]);
    delete fileData[appName];

    if (Object.keys(fileData).length === 0) {
        fileData[" "] = " ";
        const tableBody = document.querySelector('#appTable tbody');
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

    window.tempData[fileName] = JSON.stringify(fileData);

    closeDialog('databasecontrolrowremove');

    window.selectedRow = null;
    xlp.updateEditButtonState();
}

// Confirm Row Removal
// Shows confirmation dialog before deletion
export async function confirmRowRemove() {
    if (!window.selectedRow) {
        return;
    }
    
    const [appName] = window.selectedRow.split(',');
    await showDialog('databasecontrolrowremove');
}

// Application File Selection
// Opens file selection dialog for application path
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
            
            const dialog = document.querySelector('.dialog:not(.dialog-hidden)');
            if (!dialog) return;
            
            const appNameInput = dialog.querySelector('#appNameInput');
            const appCmdInput = dialog.querySelector('#appCmdInput');
            
            if (appNameInput && appCmdInput) {
                appNameInput.value = shortcutInfo?.name || '';
                appCmdInput.value = shortcutInfo?.target || filePath;
                
                const okButton = dialog.querySelector('.ok-button');
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

// Dialog Event Management
// Manages event listeners for dialog close buttons and handles cleanup
function dialogCloseListener(r) {
    const dialog = document.querySelector('.dialog:not(.dialog-hidden)');
    if (dialog) {
        const closeButton = dialog.querySelector('.close-button');
        if (closeButton) {
            if (r) {
                closeButton.removeEventListener('click', () => closeDialog(dialog.id.replace('Dialog', '')));
            } else {
                closeButton.addEventListener('click', () => closeDialog(dialog.id.replace('Dialog', '')));
            }
        }
    }
}

// Unsaved Changes Handler
// Manages section navigation with pending changes
export async function showUnsavedChangesDialog(pendingSection) {
    await xlp.loadSection(pendingSection);
}

// Configuration Change Handler
// Manages unsaved configuration changes between sections
export async function showConfigChangeDialog(section) {
    return new Promise((resolve) => {
        const dialog = document.getElementById('configchangeDialog');
        const sectionSpan = dialog.querySelector('#configChangeSection');
        const saveButton = dialog.querySelector('.ok-button');
        const discardButton = dialog.querySelector('.close-button');

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
// Shows confirmation after saving configuration changes
export function showConfigSaveDialog(section) {
    const dialog = document.getElementById('configsaveDialog');
    const sectionSpan = dialog.querySelector('#configSaveSection');
    const okButton = dialog.querySelector('.ok-button');

    sectionSpan.textContent = section;
    dialog.classList.remove('dialog-hidden');

    const handleOk = () => {
        dialog.classList.add('dialog-hidden');
        okButton.removeEventListener('click', handleOk);
    };

    okButton.addEventListener('click', handleOk);
}

// Database Change Handler
// Manages unsaved database changes and handles dialog interactions
export async function showDatabaseChangeDialog() {
    return new Promise((resolve) => {
        xlp.showDialog('databasecontrolconfirm');
        const okButton = document.querySelector('#databasecontrolconfirmDialog .ok-button');
        const cancelButton = document.querySelector('#databasecontrolconfirmDialog .close-button');

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
