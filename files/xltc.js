const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class TriggerCmdGenerator {
    constructor(appDir, configOpts) {
        this.appDir = appDir;
        this.configOpts = configOpts;
        this.mainXLFC = 'xlauncher.xlfc'; // Changed from .csv to .xlfc
    }

    async generateCommands() {
        const filePath = path.join(this.appDir, 'utils', this.mainXLFC);

        try {
            const fileContent = await fs.readFile(filePath, 'utf8');
            const appsData = JSON.parse(fileContent);
            const gamesList = [];

            for (const [appName, command] of Object.entries(appsData)) {
                const capitalizedAppName = appName.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

                if (this.configOpts.triggercmd.addCommands === 'all' || 
                    (this.configOpts.triggercmd.addCommands === 'favourited' && await this.isFavorited(appName))) {
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
            if (this.configOpts.triggercmd.overwriteFile === 'keep') {
                try {
                    const existingContent = await fs.readFile(jsonFilePath, 'utf8');
                    const existingCommands = JSON.parse(existingContent);
                    
                    // Remove all XLauncher blocks
                    const nonXLauncherCommands = existingCommands.filter(cmd => 
                        !(cmd.trigger && cmd.trigger.startsWith("XLauncher:") &&
                          cmd.command && cmd.command.startsWith("xlaunch"))
                    );
                    
                    // Add non-XLauncher commands and new XLauncher commands
                    finalCommands = [...nonXLauncherCommands, ...gamesList];
                } catch (error) {
                    finalCommands = gamesList;
                }
            } else {
                // 'overwrite' setting: just use the new gamesList
                finalCommands = gamesList;
            }

            const combinedJson = JSON.stringify(finalCommands, null, 2);

            await fs.writeFile(jsonFilePath, combinedJson);

            return true;
        } catch (error) {
            return false;
        }
    }

    async isFavorited(appName) {
        const xldbfPath = path.join(this.appDir, 'utils', 'xldbf.json');
        try {
            const xldbfContent = await fs.readFile(xldbfPath, 'utf8');
            const xldbf = JSON.parse(xldbfContent);
            if (xldbf.favourites && Array.isArray(xldbf.favourites)) {
                return xldbf.favourites.includes(appName);
            }
            return false;
        } catch (error) {
            return false;
        }
    }
}

module.exports = TriggerCmdGenerator;
