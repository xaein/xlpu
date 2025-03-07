// System Tray Module
// Manages system tray functionality and notifications

// Update check timer
let updateCheckInterval = null;

// Setup Tray System
// Initializes system tray icon and configures automatic update checking
export async function initializeSysTray() {
    try {
        await e.Api.invoke('create-tray');
        
        const { updates } = window.xldbv.configOpts;
        if (updates?.periodic?.enable) {
            xlp.startPeriodicUpdateCheck();
        }
    } catch (error) { }
}

// Begin Update Checks
// Configures and starts periodic version checking at specified intervals
export function startPeriodicUpdateCheck() {
    if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
    }
    
    const interval = window.xldbv.configOpts.updates.periodic.interval || 24;
    const intervalMs = interval * 60 * 60 * 1000;
    
    updateCheckInterval = setInterval(async () => {
        try {
            const uurl = window.xldbv.uurl;
            const response = await e.Api.invoke('fetch-url', `${uurl}/version.json`);
            if (!response.ok) return;
            
            const latestVersion = response.data;
            const currentVersion = window.xldbv.version;
            
            if (xlp.isNewerVersion(currentVersion, latestVersion.version)) {
                xlp.showAlert('Update Available', `Version ${latestVersion.version} is available`);
                const windowTitle = document.querySelector('.window-title');
                if (windowTitle) {
                    windowTitle.textContent = `xLauncher Plus v${currentVersion} (Update Available)`;
                }
            }
        } catch (error) { }
    }, intervalMs);
}

// Stop Update Checks
// Terminates periodic version checking and cleans up timer resources
export function stopPeriodicUpdateCheck() {
    if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
        updateCheckInterval = null;
    }
}

// Display Alert Message
// Shows system tray notification with title and message content
export function showAlert(title, body) {
    if (process.platform === 'win32') {
        e.Api.invoke('show-tray-balloon', title, body);
    } else {
        e.Api.invoke('show-notification', title, body);
    }
}

// Update Recent List
// Maintains and updates list of five most recently used apps
export function updateRecentApps(appName) {
    if (!window.xldbf.recent) {
        window.xldbf.recent = [];
    }
    window.xldbf.recent = [appName, ...window.xldbf.recent.filter(app => app !== appName)].slice(0, 5);
    xlp.setData('xldbf', window.xldbf);
    xlp.updateTrayMenu();
}

// Refresh Tray Menu
// Updates system tray context menu with current recent applications
export async function updateTrayMenu() {
    try {
        const recent = window.xldbf.recent || [];
        const recentApps = recent.map(appName => ({ name: appName }));
        await e.Api.invoke('update-tray-menu', recentApps);
    } catch (error) { }
}

// Toggle Tray Icon
// Controls visibility of system tray icon based on state
export async function updateVisibility(show) {
    try {
        await e.Api.invoke('update-tray-visibility', show);
    } catch (error) { }
} 