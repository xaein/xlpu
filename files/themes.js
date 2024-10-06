// Theme-related functions

// Global variables
window.currentTheme = window.xldbv.currentTheme || 'green light';
const transitionDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-duration')) * 1000 || 300;
const delay = transitionDuration;
let isThemePageSetupRunning = false;

// Apply selected theme
// Applies the currently selected theme if different from the current one
async function applySelectedTheme() {
    if (window.currentTheme && window.currentTheme !== window.xldbv.currentTheme) {
        try {
            await js.F.lazyLoadScript('common/dialogs.js');
            await js.F.lazyLoadStylesheet('common/styles/dialogs.css');
            await js.F.showDialog('applyTheme');

            const success = await compileAndApplyTheme();

            if (success) {
                await new Promise(resolve => setTimeout(resolve, delay * 2));
                
                window.xldbv.currentTheme = window.currentTheme;
                
                js.F.setData('xldbv', window.xldbv);
                
                await refreshPageStyles();

                await loadThemeList();
                selectTheme(window.currentTheme);

                updateApplyButtonState();

                js.F.closeDialog('applyTheme');
            } else {
                throw new Error('Theme compilation failed');
            }
        } catch (error) {
            
            await new Promise(resolve => setTimeout(resolve, delay));
            updateApplyButtonState();
            js.F.closeDialog('applyTheme');
        }
    }
}

// Compile and apply theme
// Compiles the selected theme and applies it to the application
async function compileAndApplyTheme() {
    try {
        const totalFiles = await e.Api.invoke('get-scss-file-count');

        const progressBar = document.getElementById('applyThemeProgressBar');
        const progressText = document.getElementById('applyThemeProgressText');

        e.Api.on('theme-compile-progress', ({ processedFiles, totalFiles, progress }) => {
            if (progressBar) progressBar.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `${progress}%`;
        });

        const headerMain = document.getElementById('applyThemeHeaderMain');
        if (headerMain) {
            headerMain.textContent = window.currentTheme;
        }

        const success = await e.Api.invoke('compile-theme', window.currentTheme, delay);

        if (success) {
            window.xldbv.currentTheme = window.currentTheme;
            
            js.F.setData('xldbv', window.xldbv);
            
            return true;
        } else {
            throw new Error('Theme compilation failed');
        }
    } catch (error) {
        
        return false;
    } finally {
        e.Api.removeListener('theme-compile-progress');
    }
}

// Import theme
// Allows user to import a theme file and apply it
async function importTheme() {
    try {
        let themesDir = window.xldbv?.directories?.themes;
        if (!themesDir) {
            const xldbvData = js.F.getData('xldbv');
            themesDir = xldbvData?.directories?.themes;
        }

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

        if (result.canceled || result.filePaths.length === 0) {
            return;
        }

        const sourcePath = result.filePaths[0];
        const importResult = await e.Api.invoke('import-theme', sourcePath, themesDir);

        if (importResult && importResult.success) {
            await loadThemeList();
            await selectTheme(importResult.themeName);
        }
    } catch {}
}

// Load theme data
// Fetches and parses theme data from a file
async function loadThemeData(themeName) {
    const themeFilePath = `themes/${themeName}.thm`;
    try {
        const response = await fetch(themeFilePath);
        if (!response.ok) throw new Error(`Failed to load theme file: ${response.status} ${response.statusText}`);
        let themeContent = await response.text();
        
        themeContent = themeContent.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) => g ? "" : m);
        
        const themeData = JSON.parse(themeContent);
        return themeData.variables;
    } catch (error) {
        throw error;
    }
}

// Load theme list
// Fetches and displays the list of available themes
async function loadThemeList() {
    try {
        const themesDir = window.xldbv.directories.themes || 'themes';
        
        const themes = await e.Api.invoke('read-themes-directory', themesDir);
        
        const themeList = document.getElementById('themeList');
        if (!themeList) {
            return;
        }
        
        themeList.innerHTML = '';
        
        if (themes.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No themes available';
            themeList.appendChild(li);
        } else {
            themes.forEach(theme => {
                const li = document.createElement('li');
                li.textContent = theme;
                li.onclick = () => selectTheme(theme);
                themeList.appendChild(li);
            });
            
            selectTheme(window.xldbv.currentTheme);
        }
    } catch {}
}

// Preview theme
// Loads and displays a preview of the selected theme
async function previewTheme(themeName) {
    const preview = document.getElementById('themePreview');
    if (!preview) {
        return;
    }
    try {
        const themeData = await loadThemeData(themeName);
        Object.entries(themeData).forEach(([key, value]) => {
            const cssVarName = `--preview-${key}`;
            preview.style.setProperty(cssVarName, value);
        });

        js.F.adjustPreviewTableRows();

    } catch (error) {
        preview.innerHTML = '<p>Error loading theme preview</p>';
    }
}

// Refresh page styles
// Reloads all stylesheets to apply theme changes
async function refreshPageStyles() {
    const styleSheets = document.querySelectorAll('link[rel="stylesheet"]');

    const refreshPromises = Array.from(styleSheets).map(link => {
        return new Promise((resolve) => {
            const newLink = document.createElement('link');
            newLink.rel = 'stylesheet';
            newLink.href = link.href.split('?')[0] + '?refresh=' + new Date().getTime();

            document.head.appendChild(newLink);

            newLink.onload = () => {
                link.remove();
                resolve();
            };
        });
    });

    await Promise.all(refreshPromises);

    document.body.offsetHeight;
}

// Select theme
// Updates UI and previews the selected theme
async function selectTheme(theme) {
    const themeItems = document.querySelectorAll('#themeList li');
    themeItems.forEach(item => {
        item.classList.remove('selected', 'current');
        if (item.textContent === theme) {
            item.classList.add('selected');
            if (theme === window.xldbv.currentTheme) {
                item.classList.add('current');
            }
        }
    });
    
    window.currentTheme = theme;
    
    await previewTheme(theme);
    updateApplyButtonState();
}

// Setup theme page
// Initializes the theme page with current theme data
async function themePageSetup() {
    if (isThemePageSetupRunning) return;
    isThemePageSetupRunning = true;

    try {
        await loadThemeList();
        await previewTheme(window.currentTheme);
        updateApplyButtonState();
        js.F.adjustPreviewTableRows();
    } catch {} finally {
        isThemePageSetupRunning = false;
    }
}

// Update apply button state
// Enables or disables the apply button based on theme selection
function updateApplyButtonState() {
    const applyButton = document.getElementById('footerLeftButton');
    if (applyButton) {
        const isDifferent = window.currentTheme !== window.xldbv.currentTheme;
        applyButton.disabled = !isDifferent;
        applyButton.classList.toggle('disabled', !isDifferent);
    }
}

// Export theme functions
window.themeFunctions = {
    applySelectedTheme,
    importTheme,
    themePageSetup
};