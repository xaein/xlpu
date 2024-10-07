const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class TriggerCmdGenerator {
    constructor(appDir, configOpts) {
        this.appDir = appDir;
        this.configOpts = configOpts.triggercmd; // Note this change
        this.mainXLFC = 'xlauncher.xlfc'; // Changed from .csv to .xlfc
    }

    async generateCommands() {
        const filePath = path.join(this.appDir, 'utils', this.mainXLFC);

        try {
            console.log('Reading file:', filePath);
            const fileContent = await fs.readFile(filePath, 'utf8');
            const appsData = JSON.parse(fileContent);
            console.log('Apps data loaded, count:', Object.keys(appsData).length);

            const gamesList = [];

            for (const [appName, command] of Object.entries(appsData)) {
                const capitalizedAppName = appName.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

                const shouldAdd = this.configOpts.addCommands === 'all' || 
                    (this.configOpts.addCommands === 'favourited' && await this.isFavorited(appName));

                console.log(`App: ${appName}, Should add: ${shouldAdd}`);

                if (shouldAdd) {
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

            console.log('Games list created, count:', gamesList.length);

            const userDirectory = os.homedir();
            const subfolder = ".TRIGGERcmdData";
            const jsonFilePath = path.join(userDirectory, subfolder, "commands.json");

            console.log('Target file path:', jsonFilePath);

            let finalCommands = [];
            if (this.configOpts.overwriteFile === 'keep') {
                try {
                    console.log('Reading existing commands file');
                    const existingContent = await fs.readFile(jsonFilePath, 'utf8');
                    const existingCommands = JSON.parse(existingContent);
                    
                    const nonXLauncherCommands = existingCommands.filter(cmd => 
                        !(cmd.trigger && cmd.trigger.startsWith("XLauncher:") &&
                          cmd.command && cmd.command.startsWith("xlaunch"))
                    );
                    
                    finalCommands = [...nonXLauncherCommands, ...gamesList];
                    console.log('Merged commands, total count:', finalCommands.length);
                } catch (error) {
                    console.log('No existing file or error reading it, using only new commands');
                    finalCommands = gamesList;
                }
            } else {
                console.log('Overwriting with new commands only');
                finalCommands = gamesList;
            }

            const combinedJson = JSON.stringify(finalCommands, null, 2);

            console.log('Writing to file:', jsonFilePath);
            await fs.writeFile(jsonFilePath, combinedJson);

            console.log('File written successfully');
            return true;
        } catch (error) {
            console.error('Error generating commands:', error);
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
