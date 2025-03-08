// Electron API Preload Script
// Provides secure IPC communication between renderer and main processes

const { contextBridge, ipcRenderer } = require('electron');

// IPC Bridge Configuration
// Exposes protected methods for renderer process to use ipcRenderer safely
contextBridge.exposeInMainWorld('e', {
    Api: {
        // Send messages
        // Sends messages from renderer to main process
        send: (channel, data) => {
            let validChannels = ['toMain'];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },

        // Invoke methods
        // Calls main process methods and waits for results
        invoke: (channel, ...args) => {
            let validChannels = [
                'check-triggercmd-file', 'close-window', 'compile-theme', 'copy-file', 'create-startup-shortcut', 'create-tray', 'download-file', 
                'ensure-directory', 'extract-zip', 'fetch-url', 'file-exists', 'generate-triggercmd', 'get-app-dir', 'get-desktop-dir', 'get-file',
                'get-file-path', 'get-variables', 'get-window-dpi', 'get-window-size', 'import-theme', 'launch-app', 'maximize-window', 'minimize-window',
                'minimize-to-tray', 'open-external', 'open-file-dialog', 'parse-shortcut', 'read-directory', 'read-themes-directory', 'remove-directory',
                'remove-file', 'remove-startup-shortcut', 'rename-file', 'run-xlstitch', 'run-xlu', 'show-notification', 'show-tray-balloon',
                'toggle-theme-readonly', 'update-favs', 'update-tray-menu', 'update-tray-visibility', 'update-vars', 'update-xlaunch-config', 'write-file'
            ];
            if (validChannels.includes(channel)) {
                return ipcRenderer.invoke(channel, ...args);
            }
        },

        // Event handlers
        // Manages event listeners for app closing and theme compilation
        on: (channel, func) => {
            let validChannels = [
                'app-closing', 'theme-compile-progress'
            ];
            if (validChannels.includes(channel)) {
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        },

        // Remove listeners
        // Removes specific event listeners
        removeListener: (channel) => {
            if (channel) {
                ipcRenderer.removeAllListeners(channel);
            } else {
                ipcRenderer.removeAllListeners();
            }
        },

        // Remove all listeners
        // Cleans up event listeners for specific or all channels
        removeAllListeners: (channel) => {
            if (channel) {
                ipcRenderer.removeAllListeners(channel);
            } else {
                ipcRenderer.removeAllListeners();
            }
        },

        // Console logging
        // Exposes console.log for debugging
        log: (...args) => console.log(...args),
        
        // Error logging
        // Exposes console.error for error reporting
        error: (...args) => console.error(...args),
    }
});