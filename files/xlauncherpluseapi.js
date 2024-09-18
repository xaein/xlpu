// Electron API preload script

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire Electron API
contextBridge.exposeInMainWorld('e', {
    Api: {
        // Send messages to the main process
        send: (channel, data) => {
            let validChannels = ['toMain'];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        // Invoke methods in the main process and wait for result
        invoke: (channel, ...args) => {
            let validChannels = [
                'close-window', 'compile-theme', 'copy-file', 'get-app-dir', 'get-file',
                'get-file-path', 'get-scss-file-count', 'get-variables', 'get-window-size',
                'import-theme', 'launch-app', 'maximize-window', 'minimize-window',
                'open-file-dialog', 'parse-shortcut', 'read-directory', 'read-themes-directory',
                'remove-file', 'rename-file', 'run-xlstitch', 'update-favs', 'update-vars',
                'write-csv-file', 'write-file', 'check-triggercmd-file', 'update-xlaunch-config',
                'generate-triggercmd', 'add-to-path', 'remove-from-path', 'fetch-url',
                'open-external'
            ];
            if (validChannels.includes(channel)) {
                return ipcRenderer.invoke(channel, ...args);
            }
        },
        // Handle app closing event and theme compile progress
        on: (channel, func) => {
            let validChannels = ['app-closing', 'theme-compile-progress'];
            if (validChannels.includes(channel)) {
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        },
        // Remove listeners
        removeListener: (channel) => {
            if (channel) {
                ipcRenderer.removeAllListeners(channel);
            } else {
                ipcRenderer.removeAllListeners();
            }
        },
        // Remove all listeners for a specific channel or all channels
        removeAllListeners: (channel) => {
            if (channel) {
                ipcRenderer.removeAllListeners(channel);
            } else {
                ipcRenderer.removeAllListeners();
            }
        },
        // Expose console.log
        log: (...args) => console.log(...args),
        // Expose console.error
        error: (...args) => console.error(...args)
    }
});