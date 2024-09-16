const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire Electron API
contextBridge.exposeInMainWorld(
    'api', {
        send: (channel, data) => {
            let validChannels = ['toMain', 'read-csv-file', 'get-csv-files', 'read-cfg-file', 'save-updated-data', 'run-xlstitch', 'launch-app'];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data); // Send data to the main process
            }
        },
        receive: (channel, func) => {
            let validChannels = ['fromMain', 'csvData', 'read-csv-file', 'get-csv-files', 'read-cfg-file', 'xlstitch-done'];
            if (validChannels.includes(channel)) {
                ipcRenderer.on(channel, (event, ...args) => {
                    func(...args); // Call the provided function with the received arguments
                });
            }
        },
        invoke: (channel, data) => {
            let validChannels = ['read-csv-file', 'get-csv-files', 'read-cfg-file'];
            if (validChannels.includes(channel)) {
                return ipcRenderer.invoke(channel, data); // Invoke a channel and return the result
            }
        }
    }
);