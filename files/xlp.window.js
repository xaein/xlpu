// Window Action Configuration
//   Maps window action names to API calls
//   Provides configuration object for window control actions
//   Handles minimize, maximize, close, and help button functionality
//   Centralizes window action mapping and API integration

// Window Action Configuration Object
//   Maps window action names to their API calls or handler functions
//   Defines minimize, maximize, close, and help button behaviors
export const windowActionConfig = {
    minimize: {
        apiCall: 'minimize-window'
    },
    maximize: {
        apiCall: 'maximize-window'
    },
    close: {
        apiCall: null,
        handler: async () => {
            if (window.xldbv?.configOpts?.system?.closeTo) {
                await e.Api.invoke('minimize-to-tray');
            } else {
                await xlp.exitApp();
            }
        }
    },
    help: {
        apiCall: null,
        handler: async () => {
            await xlp.openHelpFile();
        }
    }
};

