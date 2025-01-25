// System tray management functions

// Create System Tray
// Creates the system tray icon
async function initializeTray() {
    try {
        await e.Api.invoke('create-tray');
        
        const { updates } = window.xldbv.configOpts;
        if (updates?.periodic?.enable) {
            startPeriodicUpdateCheck();
        }
    } catch (error) {}
}

// Start Update Check
// Sets up interval to check for updates based on config
function startPeriodicUpdateCheck() {
    if (window.updateCheckInterval) {
        clearInterval(window.updateCheckInterval);
    }
    
    const interval = window.xldbv.configOpts.updates.periodic.interval || 24;
    const intervalMs = interval * 60 * 60 * 1000;
    
    window.updateCheckInterval = setInterval(async () => {
        try {
            const uurl = window.xldbv.uurl;
            const response = await e.Api.invoke('fetch-url', `${uurl}/version.json`);
            if (!response.ok) return;
            
            const latestVersion = response.data;
            const currentVersion = window.xldbv.version;
            
            const currentNum = parseInt(currentVersion.replace(/\./g, ''));
            const latestNum = parseInt(latestVersion.version.replace(/\./g, ''));
            
            if (latestNum > currentNum) {
                showAlert('Update Available', `Version ${latestVersion.version} is available`);
                const windowTitle = document.querySelector('.window-title');
                if (windowTitle) {
                    windowTitle.textContent = `xLauncher Plus v${currentVersion} (Update Available)`;
                }
            }
        } catch (error) {}
    }, intervalMs);
}

// Stop Update Check
// Clears the update check interval
function stopPeriodicUpdateCheck() {
    if (window.updateCheckInterval) {
        clearInterval(window.updateCheckInterval);
        window.updateCheckInterval = null;
    }
}

// Display System Alert
// Displays a notification using tray balloon on Windows and desktop notification on other platforms
function showAlert(title, body) {
    if (process.platform === 'win32') {
        e.Api.invoke('show-tray-balloon', title, body);
    } else {
        e.Api.invoke('show-notification', title, body);
    }
}

// Update Recent List
// Adds an app to the recent apps list and updates the tray menu
function updateRecentApps(appName) {
    if (!window.xldbf.recent) {
        window.xldbf.recent = [];
    }
    window.xldbf.recent = [appName, ...window.xldbf.recent.filter(app => app !== appName)].slice(0, 5);
    js.F.setData('xldbf', window.xldbf);
    js.F.updateFavoritesOnExit();
    updateTrayMenu();
}

// Refresh Tray Menu
// Updates the tray menu with the list of recent apps
async function updateTrayMenu() {
    try {
        const recent = window.xldbf.recent || [];
        const recentApps = recent.map(appName => ({ name: appName }));
        await e.Api.invoke('update-tray-menu', recentApps);
    } catch (error) {}
}

// Toggle Tray Icon
// Shows or hides the system tray icon
async function updateTrayVisibility(show) {
    try {
        await e.Api.invoke('update-tray-visibility', show);
    } catch (error) {}
}

// Export systray functions
window.systrayFunctions = {
    initializeTray,
    startPeriodicUpdateCheck,
    stopPeriodicUpdateCheck,
    updateRecentApps,
    updateTrayMenu,
    updateTrayVisibility
};
