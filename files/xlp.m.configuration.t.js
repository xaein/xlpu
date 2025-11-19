// Theme Management Sub-Module
//   Controls theme selection, preview and application processes within configuration
//   Handles theme import, deletion, and compilation processes
//   Manages theme display, preview generation, and theme application
//   Provides theme configuration interface and file management

// Theme state variables
//   Tracks transition duration, current theme, selected theme, and available themes
//   Manages theme state including transition timing, active theme, selected theme, and theme list
const transitionDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-duration')) * 1000 || 300;
window.currentTheme = null;
window.selectedTheme = null;
window.themes = [];

// Initialize Theme System
//   Sets up and configures complete theme management interface
//   Loads themes from directory, creates theme list items, and sets up theme controls
export async function initializeThemes() {
    try {
        const themesDir = `files/${xlp.dirVar('themes')}`;
        const themesData = await e.Api.invoke('read-themes-directory', themesDir);
        
        if (!themesData?.length) {
            return;
        }

        const domCacheName = xlp.getState('ui.domCacheName');
        const themeList = xlp.getElement('themeList') || (domCacheName && window[domCacheName]?.themeList);
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

    } catch (error) {
        return;
    }
}

// Update Preview Display
//   Calculates and updates theme preview table row layout
//   Calculates available height and adjusts preview table row count and dimensions
export function adjustPreviewTableRows(height) {
    const domCacheName = xlp.getState('ui.domCacheName');
    const preview = xlp.getElement('themePreview') || (domCacheName && window[domCacheName]?.themePreview) || document.querySelector('.theme-preview');
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

// Process Theme Application
//   Compiles and applies selected theme across application interface
//   Compiles theme, updates config, reloads stylesheets, and updates UI
export async function applySelectedTheme() {
    if (!window.selectedTheme) {
        return;
    }

    try {
        const success = await e.Api.invoke('compile-theme', window.selectedTheme, 0);

        if (success) {
            if (!window.xldbv.configOpts) window.xldbv.configOpts = {};
            if (!window.xldbv.configOpts.theme) window.xldbv.configOpts.theme = {};
            window.xldbv.configOpts.theme.currentTheme = window.selectedTheme;
            window.currentTheme = window.selectedTheme;
            xlp.setData('xldbv', window.xldbv);

            const domCacheName = xlp.getState('ui.domCacheName');
        const themeList = xlp.getElement('themeList') || (domCacheName && window[domCacheName]?.themeList);
            if (themeList) {
                const items = themeList.getElementsByTagName('li');
                for (const item of items) {
                    item.classList.remove('current');
                    if (item.textContent === window.selectedTheme) {
                        item.classList.add('current');
                    }
                }
            }

            const styleLinks = xlp.getElement('dqa', 'link[rel="stylesheet"]');
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
        }
    } catch (error) {
        console.error('Error applying theme:', error);
    }
}

// Load Theme Content
//   Retrieves and processes complete theme data from storage
//   Loads theme file, removes comments, and parses JSON to extract theme variables
async function loadThemeData(themeName) {
    try {
        const appDir = await e.Api.invoke('get-app-dir');
        const themesDir = xlp.dirVar('themes');
        const themeFile = xlp.joinPath(appDir, 'files', themesDir, `${themeName}.thm`);
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
//   Creates and displays complete theme preview interface elements
//   Loads theme data, applies CSS variables to preview element, and adjusts table rows
async function previewTheme(themeName) {
    const domCacheName = xlp.getState('ui.domCacheName');
    const preview = xlp.getElement('themePreview') || (domCacheName && window[domCacheName]?.themePreview) || document.querySelector('.theme-preview');
    if (!preview) return;

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

// Process Theme Selection
//   Updates interface and preview with newly selected theme
//   Updates theme list selection state and generates theme preview
export function selectTheme(themeName) {
    const domCacheName = xlp.getState('ui.domCacheName');
    const themeList = xlp.getElement('themeList') || (domCacheName && window[domCacheName]?.themeList);
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

// Configure Theme Controls
//   Sets up and manages all theme interface elements (buttons handled via event delegation)
//   Sets up checkbox change handlers for theme protection toggling
function setupThemeControls() {
    const domCacheName = xlp.getState('ui.domCacheName');
    const themeList = xlp.getElement('themeList') || (domCacheName && window[domCacheName]?.themeList);

    if (themeList) {
        const checkboxes = themeList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((checkbox, index) => {
            checkbox.onchange = async (event) => {
                const theme = window.themes[index];
                const appDir = await e.Api.invoke('get-app-dir');
                const themesDir = xlp.dirVar('themes');
                const themePath = xlp.joinPath(appDir, 'files', themesDir, `${theme.name}.thm`);
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
}

