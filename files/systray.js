// System tray management functions

// Check for updates
// Checks for available updates and notifies if found
async function checkForUpdates(isPeriodic = false) {
    
    
    try {
        const baseUrl = window.xldbv.uurl;
        const url = `${baseUrl}/version.json`;
        const versionInfo = await e.Api.invoke('fetch-url', url, 'json');
        
        const currentVersion = window.xldbv.version;
        if (currentVersion !== versionInfo.version) {
            if (isPeriodic) {
                showAlert('Update Available', `A new version (${versionInfo.version}) of xLauncher Plus is available.`);
            }
            // Set a flag or update UI to indicate an update is available
            js.F.setData('updateAvailable', true);
            js.F.loadTitleBar();
        }
    } catch {}
}

// Initialize tray
// Creates the system tray icon
async function initializeTray() {
    try {
        if (window.xldbv.configOpts.tray.show) {
            await e.Api.invoke('create-tray');
        }
    } catch {}
}

// Show alert
// Displays a notification using tray balloon on Windows and desktop notification on other platforms
function showAlert(title, body) {
    if (process.platform === 'win32') {
        e.Api.invoke('show-tray-balloon', title, body);
    } else {
        e.Api.invoke('show-notification', title, body);
    }
}

// Update recent apps
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

// Update tray menu
// Updates the tray menu with the list of recent apps
async function updateTrayMenu() {
    try {
        if (window.xldbv.configOpts.tray.show) {
            const recent = window.xldbf.recent || [];
            const recentApps = recent.map(appName => ({ name: appName }));
            await e.Api.invoke('update-tray-menu', recentApps);
        }
    } catch {}
}

// Update tray visibility
// Shows or hides the system tray icon
async function updateTrayVisibility(show) {
    try {
        window.xldbv.configOpts.tray.show = show;
        await e.Api.invoke('update-tray-visibility', show);
        if (show) {
            await updateTrayMenu();
        }
    } catch {}
}

// Export common functions
window.systrayFunctions = {
    checkForUpdates,
    initializeTray,
    showAlert,
    updateRecentApps,
    updateTrayMenu,
    updateTrayVisibility
};
