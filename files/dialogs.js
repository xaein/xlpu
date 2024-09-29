// Dialog management and interaction

// Add new category
// Creates a new category and associated file
async function categoryAdd() {
    const categoryNameInput = document.getElementById('categoryNameInput');
    const categoryName = categoryNameInput.value.trim();

    if (categoryName) {
        const fileName = `${categoryName}.xlfc`;
        
        if (!window.tempData) {
            window.tempData = {};
        }
        const initialData = { " ": " " };
        window.tempData[fileName] = JSON.stringify(initialData);

        js.F.setData('tempData', window.tempData);

        try {
            const appDir = await e.Api.invoke('get-app-dir');
            const xldbDir = window.xldbv.directories?.xldb || 'xldb';
            const filePath = js.F.joinPath(appDir, xldbDir, fileName);
            await e.Api.invoke('write-file', filePath, JSON.stringify(initialData));

            updateVariables('addCategory', fileName);

            closeDialog('categoryAdd');

            await js.F.loadTabButtons(categoryName);
        } catch (error) {}
    }
}

// Remove existing category
// Deletes a category and its associated file
async function categoryRemove() {
    const categoryName = document.getElementById('categoryToRemove').textContent;
    if (categoryName) {
        const tabList = document.getElementById('tabList');
        const button = Array.from(tabList.children).find(btn => btn.textContent === categoryName);
        if (button) {
            tabList.removeChild(button);
        }

        const fileName = `${categoryName}.xlfc`;
        
        delete window.tempData[fileName];
        js.F.setData('tempData', window.tempData);

        updateVariables('removeCategory', fileName);

        const appDir = await e.Api.invoke('get-app-dir');
        const filePath = js.F.joinPath(appDir, 'xldb', fileName);
        const result = await e.Api.invoke('remove-file', filePath);
        if (!result.success) {}

        js.F.loadTabButtons();
        closeDialog('categoryRemove');
    }
}

// Rename existing category
// Changes the name of a category and updates associated file
async function categoryRename() {
    const currentCategoryName = document.getElementById('currentCategoryName').textContent;
    const newCategoryNameInput = document.getElementById('newCategoryNameInput');
    const newCategoryName = newCategoryNameInput.value.trim();
    if (newCategoryName && currentCategoryName !== newCategoryName) {
        const tabList = document.getElementById('tabList');
        const activeTab = document.querySelector('.tablinks.active');
        if (activeTab) {
            activeTab.textContent = newCategoryName;
            activeTab.classList.remove('active');
        }

        const oldFileName = `${currentCategoryName}.xlfc`;
        const newFileName = `${newCategoryName}.xlfc`;
        
        window.tempData[newFileName] = window.tempData[oldFileName];
        delete window.tempData[oldFileName];
        js.F.setData('tempData', window.tempData);

        updateVariables('renameCategory', { oldFileName, newFileName });

        const appDir = await e.Api.invoke('get-app-dir');
        const oldFilePath = js.F.joinPath(appDir, 'xldb', oldFileName);
        const newFilePath = js.F.joinPath(appDir, 'xldb', newFileName);
        await e.Api.invoke('rename-file', oldFilePath, newFilePath);

        js.F.loadTabButtons();

        const newTab = Array.from(tabList.children).find(tab => tab.textContent === newCategoryName);
        if (newTab) {
            newTab.classList.add('active');
            js.F.loadFileData(newFileName);
        }

        closeDialog('categoryRename');
    }
}

// Close dialog
// Hides the specified dialog
function closeDialog(dialogName) {
    const dialog = document.getElementById(`${dialogName}Dialog`);
    if (dialog) {
        dialog.style.display = 'none';
        dialog.style.visibility = 'hidden';

        // Deselect the row if closing the launch dialog
        if (dialogName === 'launch') {
            const selectedRow = document.querySelector('#appTable .table-row.selected');
            if (selectedRow) {
                selectedRow.classList.remove('selected');
            }
            window.selectedApp = null;
            
            // Update launch button state
            const launchButton = document.getElementById('footerLeftButton');
            if (launchButton) {
                launchButton.disabled = true;
                launchButton.classList.add('disabled');
            }
        }
    }
}

// Confirm row removal
// Removes the selected row from the current category
async function confirmRowRemove() {
    const appName = document.getElementById('appToRemove').textContent;

    const activeTab = document.querySelector('.tablinks.active');
    if (!activeTab) {
        return;
    }

    const categoryName = activeTab.textContent.toLowerCase();
    const fileName = `${categoryName}.xlfc`;

    if (window.tempData[fileName]) {
        const fileData = JSON.parse(window.tempData[fileName]);
        delete fileData[appName];
        window.tempData[fileName] = JSON.stringify(fileData);

        js.F.setData('tempData', window.tempData);
    }

    const xldbf = js.F.getData('xldbf') || {};
    if (xldbf[appName]) {
        delete xldbf[appName];
        js.F.setData('xldbf', xldbf);
    }

    await js.F.loadFileData(fileName);
    closeDialog('rowRemove');
}

// Get circular replacer
// Handles circular references in JSON.stringify
function getCircularReplacer() {
    const seen = new WeakSet();
    return (key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return "[Circular]";
            }
            seen.add(value);
        }
        return value;
    };
}

// Launch application
// Launches the selected application, shows a countdown dialog, and removes selection/hover effects
async function launchApp() {
    if (window.selectedApp) {
        await showDialog('launch');
        let countdown = 10;
        const appNameElement = document.getElementById('appName');
        const countdownElement = document.getElementById('countdown');
        appNameElement.textContent = window.selectedApp;
        countdownElement.textContent = `Closing in ${countdown}s`;
        await e.Api.invoke('launch-app', window.selectedApp);

        const interval = setInterval(() => {
            countdown -= 1;
            countdownElement.textContent = `Closing in ${countdown}s`;
            if (countdown <= 0) {
                clearInterval(interval);
                closeDialog('launch');
                
                // Deselect the row and remove hover effects
                const selectedRow = document.querySelector('#appTable .table-row.selected');
                if (selectedRow) {
                    selectedRow.classList.remove('selected');
                }
                window.selectedApp = null;
                
                // Remove hover effects from all rows
                const allRows = document.querySelectorAll('#appTable .table-row');
                allRows.forEach(row => {
                    row.style.pointerEvents = 'none';
                });
                
                // Update launch button state
                const launchButton = document.getElementById('footerLeftButton');
                if (launchButton) {
                    launchButton.disabled = true;
                    launchButton.classList.add('disabled');
                }
                
                // Re-enable hover effects after a short delay
                setTimeout(() => {
                    allRows.forEach(row => {
                        row.style.pointerEvents = 'auto';
                    });
                }, 1000); // Adjust this delay as needed
            }
        }, 1000);
    }
}

// Lazy load dialog
// Dynamically loads dialog HTML and CSS
async function lazyLoadDialog(dialogName) {
    const dialogId = `${dialogName}Dialog`;
    if (!document.getElementById(dialogId)) {
        try {
            const htmlFileName = `${dialogName.toLowerCase()}.html`;

            const [html] = await Promise.all([
                fetch(`include/dialog/${htmlFileName}`).then(response => response.text()),
                lazyLoadStylesheet('common/styles/dialogs.css')
            ]);

            const container = document.getElementById('dialogContainer') || document.body;
            container.insertAdjacentHTML('beforeend', html);
        } catch (error) {}
    }
}

// Lazy load stylesheet
// Dynamically loads a CSS file
function lazyLoadStylesheet(href) {
    return new Promise((resolve, reject) => {
        if (!document.querySelector(`link[href="${href}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
        } else {
            resolve();
        }
    });
}

// Add new row
// Adds a new application to the current category
async function rowAdd() {
    const appNameInput = document.getElementById('appNameInput');
    const appCmdInput = document.getElementById('appCmdInput');
    const appName = appNameInput.value.trim();
    const appCmd = appCmdInput.value.trim();

    appNameInput.value = '';
    appCmdInput.value = '';

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

    js.F.setData('tempData', window.tempData);

    await js.F.loadFileData(fileName);
    closeDialog('rowAdd');
}

// Edit existing row
// Opens dialog to edit an existing application
async function rowEdit() {
    const appNameInput = document.getElementById('editAppNameInput');
    const appCmdInput = document.getElementById('editAppCmdInput');
    
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
    const currentCategory = activeTab.textContent;
    const currentFileName = `${currentCategory}.xlfc`;

    if (window.tempData[currentFileName]) {
        let categoryData = JSON.parse(window.tempData[currentFileName]);
        if (oldAppName !== newAppName) {
            delete categoryData[oldAppName];
        }
        categoryData[newAppName] = newAppCmd;
        window.tempData[currentFileName] = JSON.stringify(categoryData);
    }

    closeDialog('rowEdit');

    js.F.loadFileData(currentFileName);
    js.F.updateSaveButtonState();
}

// Remove row
// Opens dialog to confirm row removal
async function rowRemove() {
    const selectedRow = document.querySelector('#appTable .table-row.selected');
    if (!selectedRow) {
        return;
    }

    const appName = selectedRow.querySelector('.app-column').textContent.trim();

    await showDialog('rowRemove');
    document.getElementById('appToRemove').textContent = appName;
}

// Select application file
// Opens a file dialog to select an application and populates the input fields for both Add and Edit dialogs
async function selectApplicationFile(isEdit = false) {
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
            
            const prefix = isEdit ? 'edit' : '';
            const appNameInput = document.getElementById(`${prefix}AppNameInput`);
            const appCmdInput = document.getElementById(`${prefix}AppCmdInput`);
            
            if (appNameInput && appCmdInput) {
                appNameInput.value = shortcutInfo?.name || '';
                appCmdInput.value = shortcutInfo?.target || filePath;
            }
            
            updateOkButtonState(isEdit ? 'rowEdit' : 'rowAdd');
        }
    } catch (error) {
        console.error('Error selecting application file:', error);
    }
}

// Setup dialog input listeners
// Sets up input listeners for various dialog types
function setupDialogInputListeners(dialogName) {
    switch (dialogName) {
        case 'categoryAdd':
            const categoryNameInput = document.getElementById('categoryNameInput');
            categoryNameInput.addEventListener('input', () => updateOkButtonState(dialogName));
            break;
        case 'categoryRename':
            const newCategoryNameInput = document.getElementById('newCategoryNameInput');
            newCategoryNameInput.addEventListener('input', () => updateOkButtonState(dialogName));
            break;
        case 'rowAdd':
            const appNameInput = document.getElementById('appNameInput');
            const appCmdInput = document.getElementById('appCmdInput');
            appNameInput.addEventListener('input', () => updateOkButtonState(dialogName));
            appCmdInput.addEventListener('input', () => updateOkButtonState(dialogName));
            break;
        case 'rowEdit':
            const editAppNameInput = document.getElementById('editAppNameInput');
            const editAppCmdInput = document.getElementById('editAppCmdInput');
            editAppNameInput.addEventListener('input', () => updateOkButtonState(dialogName));
            editAppCmdInput.addEventListener('input', () => updateOkButtonState(dialogName));
            break;
    }
}

// Show delete theme dialog
// Opens dialog to confirm theme deletion
async function showDeleteThemeDialog() {
    const selectedTheme = document.querySelector('#themeList .selected');
    if (selectedTheme) {
        const themeName = selectedTheme.textContent;
        await showDialog('themeDelete');
        document.getElementById('themeToDelete').textContent = themeName;
        const confirmDeleteButton = document.getElementById('confirmDeleteTheme');
        if (confirmDeleteButton) {
            confirmDeleteButton.onclick = js.F.deleteTheme;
        }
    }
}

// Show dialog
// Displays the specified dialog and sets up necessary event listeners
async function showDialog(dialogName, sectionName) {
    await lazyLoadDialog(dialogName);
    const dialog = document.getElementById(`${dialogName}Dialog`);
    if (dialog) {
        if (dialogName === 'categoryRename' || dialogName === 'categoryRemove') {
            const activeTab = document.querySelector('.tablinks.active');
            if (activeTab) {
                const currentCategoryName = activeTab.textContent;
                const elementId = dialogName === 'categoryRename' ? 'currentCategoryName' : 'categoryToRemove';
                document.getElementById(elementId).textContent = currentCategoryName;

                if (dialogName === 'categoryRename') {
                    const newCategoryNameInput = document.getElementById('newCategoryNameInput');
                    newCategoryNameInput.value = '';
                    newCategoryNameInput.focus();

                    newCategoryNameInput.addEventListener('keydown', function(event) {
                        if (event.key === 'Enter') {
                            js.F.categoryRename();
                        }
                    });
                }
            }
        }

        if (dialogName === 'categoryAdd') {
            const categoryNameInput = document.getElementById('categoryNameInput');
            categoryNameInput.value = '';
            categoryNameInput.focus();

            categoryNameInput.addEventListener('keydown', function(event) {
                if (event.key === 'Enter') {
                    js.F.categoryAdd();
                }
            });
        }

        if (dialogName === 'rowRemove') {
            const selectedRow = document.querySelector('#appTable .table-row.selected');
            if (selectedRow) {
                const appName = selectedRow.querySelector('.app-column').textContent;
                document.getElementById('appToRemove').textContent = appName;
            }
        }

        if (dialogName === 'applyTheme') {
            const headerMain = dialog.querySelector('#applyThemeHeaderMain');
            const progressBar = dialog.querySelector('#applyThemeProgressBar');
            const progressText = dialog.querySelector('#applyThemeProgressText');
            const cancelButton = dialog.querySelector('#applyThemeCancelButton');

            if (headerMain) {
                headerMain.textContent = `Applying Theme: ${window.currentTheme}`;
            }

            if (progressBar) progressBar.style.width = '0%';
            if (progressText) progressText.textContent = '0%';

            if (cancelButton) {
                cancelButton.onclick = () => {
                    closeDialog('applyTheme');
                };
            }
        }

        if (dialogName === 'save') {
            const progressBar = dialog.querySelector('#saveProgressBar');
            const savePercentage = dialog.querySelector('#savePercentage');
            const reloadPercentage = dialog.querySelector('#reloadPercentage');

            if (progressBar) progressBar.style.width = '0%';
            if (savePercentage) savePercentage.textContent = '0%';
            if (reloadPercentage) reloadPercentage.textContent = '0%';

            dialog.querySelector('#saveHeaderMain').textContent = 'Saving:';
            dialog.querySelector('#saveCategoryLabel').textContent = 'Category:';
            dialog.querySelector('#saveCurrentCategory').textContent = '';
            dialog.querySelector('#reloadHeaderMain').textContent = 'Reload Pending';
            dialog.querySelector('#reloadCategoryLabel').textContent = '';
            dialog.querySelector('#reloadCurrentCategory').textContent = '';

            progressBar.classList.remove('reloading');
        }

        if (dialogName === 'themeDelete') {
            const confirmDeleteButton = document.getElementById('confirmDeleteTheme');
            if (confirmDeleteButton) {
                confirmDeleteButton.onclick = deleteTheme;
            }
        }

        if (dialogName === 'configSave' && sectionName) {
            const capitalizedSection = sectionName.charAt(0).toUpperCase() + sectionName.slice(1);
            const sectionSpan = dialog.querySelector('#configSaveSection');
            if (sectionSpan) {
                sectionSpan.textContent = capitalizedSection;
            }
        }

        if (dialogName === 'configConfirm' && sectionName) {
            const capitalizedSection = sectionName.charAt(0).toUpperCase() + sectionName.slice(1);         
            const sectionSpan = dialog.querySelector('#configConfirmSection');
            if (sectionSpan) {
                sectionSpan.textContent = capitalizedSection;
            }
        }

        switch (dialogName) {
            case 'categoryAdd':
            case 'categoryRename':
            case 'rowAdd':
            case 'rowEdit':
                setupDialogInputListeners(dialogName);
                updateOkButtonState(dialogName);
                break;
        }

        dialog.style.display = 'flex';
        dialog.style.visibility = 'visible';
    }
}

// Show row edit dialog
// Opens dialog to edit an existing row
async function showRowEditDialog() {
    const selectedRow = document.querySelector('#appTable .table-row.selected');
    if (!selectedRow) {
        return;
    }

    await showDialog('rowEdit');

    const appName = selectedRow.querySelector('.app-column').textContent;
    const appCmd = selectedRow.querySelector('.command-column').textContent;

    const appNameInput = document.getElementById('editAppNameInput');
    const appCmdInput = document.getElementById('editAppCmdInput');

    if (appNameInput && appCmdInput) {
        appNameInput.value = appName;
        appCmdInput.value = appCmd;
    }
}

// Show save dialog
// Displays the save dialog and initiates the save process
async function showSaveDialog() {
    await lazyLoadDialog('databasesave');
    await lazyLoadStylesheet('common/styles/loadsave.css');
    await js.F.lazyLoadScript('common/loadsave.js');
    
    js.F.updateJsF();
    js.F.updateVariablesOnExit();
    
    const saveDialog = document.getElementById('saveDialog');
    if (saveDialog) {
        const progressBar = document.getElementById('saveProgressBar');

        document.getElementById('saveHeaderMain').textContent = 'Saving:';
        document.getElementById('saveCategoryLabel').textContent = 'Category:';
        document.getElementById('saveCurrentCategory').textContent = '';
        document.getElementById('savePercentage').textContent = '0%';
        document.getElementById('reloadPercentage').textContent = '0%';
        document.getElementById('reloadHeaderMain').textContent = 'Reload Pending';
        document.getElementById('reloadCategoryLabel').textContent = '';
        document.getElementById('reloadCurrentCategory').textContent = '';

        progressBar.style.width = '0%';
        progressBar.classList.remove('reloading');
        
        document.documentElement.style.setProperty('--progress-bar-background', getComputedStyle(document.documentElement).getPropertyValue('--progress-bar-background').trim());

        saveDialog.style.display = 'flex';
        saveDialog.style.visibility = 'visible';

        await js.F.saveAllData();

        await new Promise(resolve => setTimeout(resolve, window.delay));

        closeDialog('save');
    }
}

// Update OK button state
// Enables or disables the OK button based on input validity
function updateOkButtonState(dialogName) {
    const dialog = document.getElementById(`${dialogName}Dialog`);
    const okButton = dialog.querySelector('.ok-button');
    let shouldEnable = true;

    switch (dialogName) {
        case 'categoryAdd':
            shouldEnable = !!document.getElementById('categoryNameInput').value.trim();
            break;
        case 'categoryRename':
            shouldEnable = !!document.getElementById('newCategoryNameInput').value.trim();
            break;
        case 'rowAdd':
            shouldEnable = !!document.getElementById('appNameInput').value.trim() &&
                           !!document.getElementById('appCmdInput').value.trim();
            break;
        case 'rowEdit':
            shouldEnable = !!document.getElementById('editAppNameInput').value.trim() &&
                           !!document.getElementById('editAppCmdInput').value.trim();
            break;
    }

    okButton.disabled = !shouldEnable;
    okButton.style.opacity = shouldEnable ? '1' : '0.5';
    okButton.style.cursor = shouldEnable ? 'pointer' : 'not-allowed';
}

// Update variables
// Updates the xldbv object based on category operations
function updateVariables(operation, data) {
    let xldbv = js.F.getData('xldbv') || {};

    if (typeof xldbv.xldbFiles === 'string') {
        xldbv.xldbFiles = xldbv.xldbFiles.split(',');
    } else if (!Array.isArray(xldbv.xldbFiles)) {
        xldbv.xldbFiles = [];
    }

    switch (operation) {
        case 'addCategory':
            if (!xldbv.xldbFiles.includes(data)) {
                xldbv.xldbFiles.push(data);
            }
            break;
        case 'renameCategory':
            const index = xldbv.xldbFiles.indexOf(data.oldFileName);
            if (index !== -1) {
                xldbv.xldbFiles[index] = data.newFileName;
            }
            break;
        case 'removeCategory':
            xldbv.xldbFiles = xldbv.xldbFiles.filter(file => file !== data);
            break;
    }

    if (!Array.isArray(xldbv.xldbFiles)) {
        xldbv.xldbFiles = [];
    }

    js.F.setData('xldbv', xldbv);
    window.xldbv = xldbv;
}

// Export dialog functions
window.dialogFunctions = {
    categoryAdd,
    categoryRemove,
    categoryRename,
    closeDialog,
    confirmRowRemove,
    launchApp,
    lazyLoadDialog,
    lazyLoadStylesheet,
    rowAdd,
    rowEdit,
    rowRemove,
    showDeleteThemeDialog,
    showDialog,
    showRowEditDialog,
    showSaveDialog,
    updateVariables
};