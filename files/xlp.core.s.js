// System Tray Module
//   Manages system tray functionality and notifications
//   Handles system tray icon creation, menu setup, and context menu interactions
//   Provides application window control from system tray
//   Manages tray visibility and application state synchronization

// Update check timer
let updateCheckInterval = null;

// Setup Tray System
//   Initializes system tray icon and configures automatic update checking
//   Creates tray icon, populates menu with recent apps, and starts periodic update checks if enabled
export async function initializeSysTray() {
    try {
        await e.Api.invoke('create-tray');
        
        await xlp.updateTrayMenu();
        
        const { updates } = window.xldbv.configOpts;
        if (updates?.periodic?.enable) {
            xlp.startPeriodicUpdateCheck();
        }
    } catch (error) {
        xlp.silentError();
    }
}

// Display Alert Message
//   Shows system tray notification with title and message content
//   Displays platform-specific notification using tray balloon or notification API
export function showAlert(title, body) {
    if (process.platform === 'win32') {
        e.Api.invoke('show-tray-balloon', title, body);
    } else {
        e.Api.invoke('show-notification', title, body);
    }
}

// Begin Update Checks
//   Configures and starts periodic version checking at specified intervals
//   Sets up interval timer to check for updates and displays notification when new version is available
export function startPeriodicUpdateCheck() {
    if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
    }
    
    const interval = window.xldbv?.configOpts?.updates?.periodic?.interval ?? 24;
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
                const windowTitle = xlp.getElement('dqs', '.window-title');
                if (windowTitle) {
                    windowTitle.textContent = `xLauncher Plus v${currentVersion}`;
                }

                const updateButton = xlp.getElement('titlebarUpdateIndicator');
                if (updateButton) {
                    updateButton.textContent = window.xldbv.updtico || "⥥";
                    updateButton.classList.add('visible');
                }
            }
        } catch (error) {
            xlp.silentError();
        }
    }, intervalMs);
}

// Stop Update Checks
//   Terminates periodic version checking and cleans up timer resources
//   Clears update check interval and resets timer reference
export function stopPeriodicUpdateCheck() {
    if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
        updateCheckInterval = null;
    }
}

// Update Recent List
//   Maintains and updates list of five most recently used apps
//   Adds app to recent list, removes duplicates, limits to 5 items, and updates tray menu
export function updateRecentApps(appName) {
    if (!window.xldbf.recent) {
        window.xldbf.recent = [];
    }
    window.xldbf.recent = [appName, ...window.xldbf.recent.filter(app => app !== appName)].slice(0, 5);
    xlp.setData('xldbf', window.xldbf);
    xlp.updateTrayMenu();
}

// Refresh Tray Menu
//   Updates system tray context menu with current recent applications
//   Retrieves recent apps from xldbf and updates tray menu via Electron API
export async function updateTrayMenu() {
    try {
        const recent = window.xldbf.recent ?? [];
        const recentApps = recent.map(appName => ({ name: appName }));
        await e.Api.invoke('update-tray-menu', recentApps);
    } catch (error) {
        xlp.silentError();
    }
}

// Toggle Tray Icon
//   Controls visibility of system tray icon based on state
//   Updates tray icon visibility using Electron API
export async function updateVisibility(show) {
    try {
        await e.Api.invoke('update-tray-visibility', show);
    } catch (error) {
        xlp.silentError();
    }
}
