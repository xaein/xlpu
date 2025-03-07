// Theme Management System
// Controls theme selection, preview and application processes

// Theme state variables
const transitionDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-duration')) * 1000 || 300;
const delay = transitionDuration;
window.currentTheme = null;
window.selectedTheme = null;
window.themes = [];

// Initialize Theme System
// Sets up and configures complete theme management interface
export async function initializeThemes() {
    try {
        const themesDir = `files/${xlp.dirVar('themes')}`;
        const themesData = await e.Api.invoke('read-themes-directory', themesDir);
        
        if (!themesData?.length) {
            return;
        }

        const themeList = document.getElementById('themeList');
        if (!themeList) {
            return;
        }

        themeList.innerHTML = '';
        
        const currentTheme = window.xldbv.configOpts?.theme?.currentTheme || 'green light';
        window.currentTheme = currentTheme;

        window.themes = themesData.sort((a, b) => a.name.localeCompare(b.name));

        window.themes.forEach(theme => {
            const li = document.createElement('li');
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'theme-name';
            nameSpan.textContent = theme.name;
            li.appendChild(nameSpan);
            
            const protectionDiv = document.createElement('div');
            protectionDiv.className = 'theme-protection';
            protectionDiv.dataset.tooltip = `Theme Protection: ${theme.readonly ? 'Enabled' : 'Disabled'}`;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = theme.readonly;
            protectionDiv.appendChild(checkbox);
            li.appendChild(protectionDiv);
            
            li.onclick = (event) => {
                if (event.target !== checkbox) {
                    selectTheme(theme.name);
                }
            };
            
            if (theme.name === currentTheme) {
                li.classList.add('current');
            }
            
            themeList.appendChild(li);
        });

        setupThemeControls();
        adjustPreviewTableRows();

        if (currentTheme) {
            selectTheme(currentTheme);
        }

        xlp.verifyAndSetSection();

    } catch (error) {
        return;
    }
}

// Configure Theme Controls
// Sets up and manages all theme interface buttons
function setupThemeControls() {
    const importButton = document.getElementById('importThemeButton');
    const removeButton = document.getElementById('removeThemeButton');
    const themeList = document.getElementById('themeList');

    if (themeList) {
        const checkboxes = themeList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((checkbox, index) => {
            checkbox.onchange = async (event) => {
                const theme = window.themes[index];
                const themePath = xlp.joinPath('files', xlp.dirVar('themes'), `${theme.name}.thm`);
                const success = await e.Api.invoke('toggle-theme-readonly', themePath, event.target.checked);
                if (!success) {
                    event.target.checked = !event.target.checked;
                } else {
                    theme.readonly = event.target.checked;
                    event.target.parentElement.dataset.tooltip = `Theme Protection: ${theme.readonly ? 'Enabled' : 'Disabled'}`;
                }
            };
        });
    }

    if (importButton) {
        importButton.onclick = () => {
            xlp.showDialog('themeImport');
            
            const selectFileButton = document.getElementById('selectThemeFile');
            const importOkButton = document.querySelector('#themeImportDialog .ok-button');
            const importPathInput = document.getElementById('themeImportPath');
            let fullPath = '';

            if (importPathInput) {
                importPathInput.value = '';
            }

            if (selectFileButton) {
                selectFileButton.onclick = async () => {
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
                    }
                };
            }

            if (importOkButton && importPathInput) {
                importOkButton.onclick = async () => {
                    if (fullPath) {
                        try {
                            const themesDir = xlp.dirVar('themes');
                            const importResult = await e.Api.invoke('import-theme', fullPath, themesDir);

                            if (importResult && importResult.success) {
                                await initializeThemes();
                                selectTheme(importResult.themeName);
                                xlp.closeDialog('themeImport');
                            }
                        } catch (error) {
                            xlp.closeDialog('themeImport');
                        }
                    }
                };
            }
        };
    }

    if (removeButton) {
        removeButton.onclick = () => {
            const selectedThemeData = window.themes.find(theme => theme.name === window.selectedTheme);
            if (window.selectedTheme && selectedThemeData && !selectedThemeData.readonly) {
                const themeSpan = document.getElementById('themeToDelete');
                if (themeSpan) {
                    themeSpan.textContent = window.selectedTheme;
                }
                xlp.showDialog('themeDelete');

                const okButton = document.querySelector('#themeDeleteDialog .ok-button');
                if (okButton) {
                    okButton.onclick = async () => {
                        try {
                            const themesDir = xlp.dirVar('themes');
                            const themeFile = `${window.selectedTheme}.thm`;
                            const themePath = xlp.joinPath('files', themesDir, themeFile);
                            const success = await e.Api.invoke('remove-file', themePath);
                            
                            if (success) {
                                await initializeThemes();
                                xlp.closeDialog('themeDelete');
                            }
                        } catch (error) {
                            xlp.closeDialog('themeDelete');
                        }
                    };
                }
            }
        };
    }
}

// Process Theme Selection
// Updates interface and preview with newly selected theme
function selectTheme(themeName) {
    const themeList = document.getElementById('themeList');
    if (!themeList) return;

    const items = themeList.getElementsByTagName('li');
    for (const item of items) {
        item.classList.remove('selected');
        if (item.textContent === themeName) {
            item.classList.add('selected');
        }
    }

    window.selectedTheme = themeName;
    previewTheme(themeName);
    xlp.updateGreenButtonState();
}

// Load Theme Content
// Retrieves and processes complete theme data from storage
async function loadThemeData(themeName) {
    const themesDir = xlp.dirVar('themes');
    const themeFile = `files/${themesDir}/${themeName}.thm`;
    try {
        const { data: themeContent } = await e.Api.invoke('get-file', themeFile);
        if (!themeContent) throw new Error('No content found in theme file');
        
        let processedContent = themeContent.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) => g ? "" : m);
        
        const themeData = JSON.parse(processedContent);
        return themeData.variables;
    } catch (error) {
        throw error;
    }
}

// Generate Theme Preview
// Creates and displays complete theme preview interface elements
async function previewTheme(themeName) {
    const preview = document.querySelector('.theme-preview');
    if (!preview) {
        return;
    }

    try {
        const variables = await loadThemeData(themeName);

        Object.entries(variables).forEach(([key, value]) => {
            const cssVar = `--preview-${key.replace(/_/g, '-')}`;
            preview.style.setProperty(cssVar, value);
        });

        await new Promise(resolve => setTimeout(resolve, 50));
        adjustPreviewTableRows();

    } catch (error) {
        return;
    }
}

// Process Theme Application
// Compiles and applies selected theme across application interface
export async function applySelectedTheme() {
    if (!window.selectedTheme) {
        return;
    }

    try {
        xlp.showDialog('themeapply');
        const progressBar = document.getElementById('applyThemeProgressBar');
        const progressText = document.getElementById('applyThemeProgressText');
        const headerText = document.getElementById('applyThemeHeaderMain');

        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '0%';

        if (headerText) {
            headerText.textContent = `Applying theme: ${window.selectedTheme}`;
        }

        e.Api.on('theme-compile-progress', ({ processedFiles, totalFiles, progress }) => {
            if (progressBar) progressBar.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `${progress}%`;
        });

        const success = await e.Api.invoke('compile-theme', window.selectedTheme, delay);

        if (success) {
            if (!window.xldbv.configOpts) window.xldbv.configOpts = {};
            if (!window.xldbv.configOpts.theme) window.xldbv.configOpts.theme = {};
            window.xldbv.configOpts.theme.currentTheme = window.selectedTheme;
            window.currentTheme = window.selectedTheme;
            xlp.setData('xldbv', window.xldbv);

            const themeList = document.getElementById('themeList');
            if (themeList) {
                const items = themeList.getElementsByTagName('li');
                for (const item of items) {
                    item.classList.remove('current');
                    if (item.textContent === window.selectedTheme) {
                        item.classList.add('current');
                    }
                }
            }

            await new Promise(resolve => setTimeout(resolve, delay * 2));

            const styleLinks = document.querySelectorAll('link[rel="stylesheet"]');
            const reloadPromises = Array.from(styleLinks).map(link => {
                return new Promise(resolve => {
                    const newLink = document.createElement('link');
                    newLink.rel = 'stylesheet';
                    newLink.href = link.href.split('?')[0] + '?t=' + Date.now();
                    newLink.onload = () => {
                        link.remove();
                        resolve();
                    };
                    link.parentNode.insertBefore(newLink, link.nextSibling);
                });
            });

            await Promise.all(reloadPromises);
            
            adjustPreviewTableRows();
            xlp.updateGreenButtonState();
            xlp.closeDialog('themeapply');
        } else {
            await new Promise(resolve => setTimeout(resolve, delay));
            xlp.closeDialog('themeapply');
        }

    } catch (error) {
        await new Promise(resolve => setTimeout(resolve, delay));
        xlp.closeDialog('themeapply');
    } finally {
        e.Api.removeListener('theme-compile-progress');
    }
}

// Update Preview Display
// Calculates and updates theme preview table row layout
export function adjustPreviewTableRows(height) {
    const preview = document.querySelector('.theme-preview');
    if (!preview) return;

    const tableBody = preview.querySelector('.preview-table-body');
    if (!tableBody) return;

    const titlebarHeight = preview.querySelector('.preview-titlebar')?.offsetHeight || 0;
    const headerHeight = preview.querySelector('.preview-header')?.offsetHeight || 0;
    const tabContainerHeight = preview.querySelector('.preview-tab-container')?.offsetHeight || 0;
    const tableHeaderHeight = preview.querySelector('.preview-table-header')?.offsetHeight || 0;
    const editControlsHeight = preview.querySelector('.preview-edit-controls')?.offsetHeight || 0;
    const footerHeight = preview.querySelector('.preview-footer')?.offsetHeight || 0;

    const previewHeight = height || preview.offsetHeight;
    const availableHeight = previewHeight - titlebarHeight - headerHeight - tabContainerHeight - tableHeaderHeight - editControlsHeight - footerHeight;

    const rowHeight = 17;
    const numRows = Math.max(Math.floor(availableHeight / rowHeight) - 2, 0);

    tableBody.innerHTML = '';

    const hoverColor = getComputedStyle(preview).getPropertyValue('--preview-table-row-hover-background-color');
    const selectedColor = getComputedStyle(preview).getPropertyValue('--preview-table-row-selected-background-color');

    for (let i = 0; i < numRows; i++) {
        const row = document.createElement('div');
        row.className = 'preview-row';
        row.innerHTML = '<div style="flex: 0 0 29.2%;"></div><div style="flex: 1;"></div>';
        
        row.addEventListener('mouseover', () => {
            row.style.backgroundColor = hoverColor;
        });
        row.addEventListener('mouseout', () => {
            if (row.classList.contains('selected')) {
                row.style.backgroundColor = selectedColor;
            } else {
                row.style.backgroundColor = '';
            }
        });

        if (i === 1) {
            row.classList.add('selected');
            row.style.backgroundColor = selectedColor;
        }

        tableBody.appendChild(row);
    }
}

// Cleanup Theme System
// Performs complete cleanup of theme management functionality
export function cleanupThemes() {
    const importButton = document.getElementById('importThemeButton');
    const removeButton = document.getElementById('removeThemeButton');
    
    if (importButton) {
        importButton.onclick = null;
    }
    
    if (removeButton) {
        removeButton.onclick = null;
    }

    const themeList = document.getElementById('themeList');
    if (themeList) {
        const items = themeList.getElementsByTagName('li');
        for (const item of items) {
            item.onclick = null;
        }
        themeList.innerHTML = '';
    }

    window.selectedTheme = null;
} 