// Theme-related functions

// Global variables
window.currentTheme = window.xldbv.configOpts?.theme?.currentTheme || 'green light';
const transitionDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--transition-duration')) * 1000 || 300;
const delay = transitionDuration;
let isThemePageSetupRunning = false;

// Apply Theme Changes
// Applies the currently selected theme if different from the current one
async function applySelectedTheme() {
    if (window.currentTheme && window.currentTheme !== window.xldbv.configOpts?.theme?.currentTheme) {
        try {
            const scriptsDir = js.F.dirVar('scripts');
            const compiledDir = js.F.dirVar('themes', 'compiled');

            await js.F.lazyLoadScript(`${scriptsDir}/dialogs.js`);
            await js.F.lazyLoadStylesheet(`${compiledDir}/dialogs.css`);
            await js.F.showDialog('applyTheme');

            const success = await compileAndApplyTheme();

            if (success) {
                await new Promise(resolve => setTimeout(resolve, delay * 2));
                
                if (!window.xldbv.configOpts) window.xldbv.configOpts = {};
                if (!window.xldbv.configOpts.theme) window.xldbv.configOpts.theme = {};
                window.xldbv.configOpts.theme.currentTheme = window.currentTheme;
                
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

// Build Theme Files
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
            window.xldbv.configOpts.theme.currentTheme = window.currentTheme;
            
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

// Get Theme Data
// Fetches and parses theme data from a file
async function loadThemeData(themeName) {
    const themesDir = js.F.dirVar('themes');
    const themeFilePath = `${themesDir}/${themeName}.thm`;
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

// List Theme Options
// Fetches and displays the list of available themes
async function loadThemeList() {
    try {
        const themesDir = js.F.joinPath('common', js.F.dirVar('themes'));
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
            
            selectTheme(window.xldbv.configOpts?.theme?.currentTheme);
        }
    } catch (error) {}
}

// Show Theme Preview
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

        // Give the browser a moment to apply the styles
        await new Promise(resolve => setTimeout(resolve, 50));
        js.F.adjustPreviewTableRows();

    } catch (error) {
        // Log the error but don't modify the preview HTML
        console.error('Error loading theme preview:', error);
        // Reset any CSS variables that might have been partially set
        preview.style.cssText = '';
    }
}

// Reload Page Styles
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

// Update Theme Choice
// Updates UI and previews the selected theme
async function selectTheme(theme) {
    const themeItems = document.querySelectorAll('#themeList li');
    themeItems.forEach(item => {
        item.classList.remove('selected', 'current');
        if (item.textContent === theme) {
            item.classList.add('selected');
            if (theme === window.xldbv.configOpts?.theme?.currentTheme) {
                item.classList.add('current');
            }
        }
    });
    
    window.currentTheme = theme;
    
    await previewTheme(theme);
    updateApplyButtonState();
}

// Initialize Theme Page
// Initializes the theme page with current theme data
async function themePageSetup() {
    if (isThemePageSetupRunning) return;
    isThemePageSetupRunning = true;

    try {
        await loadThemeList();
        await previewTheme(window.currentTheme);
        updateApplyButtonState();
        js.F.adjustPreviewTableRows();
    } catch (error) {
    } finally {
        isThemePageSetupRunning = false;
    }
}

// Update Apply Button
// Enables or disables the apply button based on theme selection
function updateApplyButtonState() {
    const applyButton = document.getElementById('footerLeftButton');
    if (applyButton) {
        const isDifferent = window.currentTheme !== window.xldbv.configOpts?.theme?.currentTheme;
        applyButton.disabled = !isDifferent;
        applyButton.classList.toggle('disabled', !isDifferent);
    }
}

// Export theme functions
window.themeFunctions = {
    applySelectedTheme,
    themePageSetup
};