const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class TriggerCmdGenerator {
    constructor(appDir, configOpts) {
        this.appDir = appDir;
        this.configOpts = configOpts;
        this.mainCSV = 'xlauncher.csv'; // Set this to the correct filename
    }

    async generateCommands() {
        const filePath = path.join(this.appDir, 'utils', this.mainCSV);
        console.log(`Reading ${this.mainCSV} file...`);

        try {
            const fileContent = await fs.readFile(filePath, 'utf8');
            const lines = fileContent.split('\n');
            const gamesList = [];

            for (const line of lines) {
                const parts = line.split(',').map(part => part.trim()).filter(Boolean);
                if (parts.length > 0) {
                    const gameName = parts[0];
                    const capitalizedGameName = gameName.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

                    if (this.configOpts.tcao === 'all' || 
                        (this.configOpts.tcao === 'favourited' && await this.isFavorited(gameName))) {
                        gamesList.push({
                            trigger: "XLauncher: " + capitalizedGameName,
                            command: "xlaunch " + gameName,
                            offCommand: "",
                            ground: "foreground",
                            voice: gameName,
                            voiceReply: "",
                            allowParams: "false"
                        });
                    }
                }
            }

            const userDirectory = os.homedir();
            const subfolder = ".TRIGGERcmdData";
            const jsonFilePath = path.join(userDirectory, subfolder, "commands.json");

            let finalCommands = [];
            if (this.configOpts.tcuo === 'keep') {
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
                    console.log('No existing commands.json found or error reading it. Creating new file.');
                    finalCommands = gamesList;
                }
            } else {
                // 'overwrite' setting: just use the new gamesList
                finalCommands = gamesList;
            }

            const combinedJson = JSON.stringify(finalCommands, null, 2);

            console.log("Writing TriggerCMD JSON file.");
            await fs.writeFile(jsonFilePath, combinedJson);

            console.log("TriggerCMD commands generated successfully.");
            return true;
        } catch (error) {
            console.error('Error generating TriggerCMD commands:', error);
            return false;
        }
    }

    async isFavorited(gameName) {
        const xldbfPath = path.join(this.appDir, 'utils', 'xldbf.json');
        try {
            const xldbfContent = await fs.readFile(xldbfPath, 'utf8');
            const xldbf = JSON.parse(xldbfContent);
            return xldbf.hasOwnProperty(gameName);
        } catch (error) {
            console.error('Error checking if game is favorited:', error);
            return false;
        }
    }
}

module.exports = TriggerCmdGenerator;
