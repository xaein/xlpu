// TriggerCmd Generator Module
// Generates TriggerCmd commands from xLauncher Plus applications

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// TriggerCmd Generator Class
// Handles the generation and management of TriggerCmd commands
class TriggerCmdGenerator {
    // Constructor
    // Initializes the generator with application directory and configuration
    constructor(appDir, configOpts) {
        this.appDir = appDir;
        this.configOpts = configOpts;
        this.mainXLFC = 'xlauncher.xlfc';
    }

    // Command generation
    // Creates TriggerCmd commands from xLauncher Plus applications
    async generateCommands() {
        const filePath = path.join(this.appDir, 'utils', this.mainXLFC);

        try {
            const fileContent = await fs.readFile(filePath, 'utf8');
            const appsData = JSON.parse(fileContent);
            const gamesList = [];

            for (const [appName, command] of Object.entries(appsData)) {
                const capitalizedAppName = appName.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

                if (this.configOpts.addCommands === 'all' || 
                    (this.configOpts.addCommands === 'favourited' && await this.isFavorited(appName))) {
                    gamesList.push({
                        trigger: "XLauncher: " + capitalizedAppName,
                        command: "xlaunch " + appName,
                        offCommand: "",
                        ground: "foreground",
                        voice: appName,
                        voiceReply: "",
                        allowParams: "false"
                    });
                }
            }

            const userDirectory = os.homedir();
            const subfolder = ".TRIGGERcmdData";
            const jsonFilePath = path.join(userDirectory, subfolder, "commands.json");

            let finalCommands = [];
            if (this.configOpts.overwriteFile === 'keep') {
                try {
                    const existingContent = await fs.readFile(jsonFilePath, 'utf8');
                    const existingCommands = JSON.parse(existingContent);
                    
                    // Remove existing XLauncher commands
                    const nonXLauncherCommands = existingCommands.filter(cmd => 
                        !(cmd.trigger && cmd.trigger.startsWith("XLauncher:") &&
                          cmd.command && cmd.command.startsWith("xlaunch"))
                    );
                    
                    // Combine with new commands
                    finalCommands = [...nonXLauncherCommands, ...gamesList];
                } catch (error) {
                    finalCommands = gamesList;
                }
            } else {
                // Use only new commands for 'overwrite' setting
                finalCommands = gamesList;
            }

            const combinedJson = JSON.stringify(finalCommands, null, 2);
            await fs.writeFile(jsonFilePath, combinedJson);

            return true;
        } catch (error) {
            return false;
        }
    }

    // Favorite check
    // Verifies if an application is in the favorites list
    async isFavorited(appName) {
        const xldbfPath = path.join(this.appDir, 'utils', 'xldbf.json');
        try {
            const xldbfContent = await fs.readFile(xldbfPath, 'utf8');
            const xldbf = JSON.parse(xldbfContent);
            return Array.isArray(xldbf.favourites) && xldbf.favourites.includes(appName);
        } catch (error) {
            return false;
        }
    }
}

module.exports = TriggerCmdGenerator;
