// File system operations

// Electron dependencies
const { dialog, BrowserWindow } = require('electron');

// Node.js core modules
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Third-party modules
const AdmZip = require('adm-zip');

class FileSystemOperations {
    constructor(appDir) {
        this.appDir = appDir;
    }

    // Check TRIGGERcmd file
    // Checks if the TRIGGERcmd file exists in the user's home directory
    checkTriggerCmdFile() {
        const userHomeDir = os.homedir();
        const filePath = path.join(userHomeDir, '.TRIGGERcmdData', 'commands.json');
        return fs.existsSync(filePath);
    }

    // Copy file
    // Copies a file from source to destination
    async copyFile(sourcePath, destPath) {
        try {
            await fs.ensureDir(path.dirname(destPath));
            await fs.copy(sourcePath, destPath);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Count SCSS files
    // Returns the number of SCSS files in the themes styles directory
    async countScssFiles() {
        const stylesDir = path.join(this.appDir, 'pages', 'themes', 'styles');
        try {
            const files = await this.readDirectory(stylesDir);
            return files.filter(file => file.endsWith('.scss')).length;
        } catch (error) {
            return 0;
        }
    }

    // Ensure directory exists
    // Creates the directory if it doesn't exist and returns false, otherwise returns true
    ensureDirectoryExists(directory) {
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
            return false;
        }
        return true;
    }

    // Ensure favourites file exists
    // Checks if the favourites file exists in the utils directory, creates it with empty JSON if not
    async ensureFavouritesFileExists(utilsDir) {
        const favouritesFilePath = path.join(utilsDir, 'xldbf.json');
        try {
            await fs.promises.access(favouritesFilePath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.promises.writeFile(favouritesFilePath, JSON.stringify({}));
            }
        }
    }

    // Extract zip file
    // Extracts contents of a zip file to a subdirectory in the application directory
    async extractZip(zipPath) {
        try {
            const zip = new AdmZip(zipPath);
            const zipFileName = path.basename(zipPath, '.zip');
            const extractPath = path.join(this.appDir, zipFileName);

            // Ensure the extraction directory exists
            await fs.ensureDir(extractPath);

            // Extract zip contents, overwriting existing files
            zip.extractAllTo(extractPath, true);

            // Clean up the zip file
            await fs.unlink(zipPath);

            return true;
        } catch (error) {
            console.error(`Error extracting zip file ${zipPath}:`, error);
            return false;
        }
    }

    // Check if file exists
    // Returns true if the file exists, false otherwise
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    // Get file contents
    // Reads the contents of a file and returns the data or an error message
    async getFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                const data = await fs.readFile(filePath, 'utf8');
                return { data };
            } else {
                return { error: 'File not found' };
            }
        } catch (error) {
            return { error: error.message };
        }
    }

    // Get file path
    // Constructs and returns the full file path given a directory and filename
    getFilePath(directory, fileName) {
        return path.join(this.appDir, directory, fileName);
    }

    // Get variables
    // Reads and parses the variables JSON file, returns null if an error occurs
    getVariables(utilsDir) {
        const variablesFilePath = path.join(utilsDir, 'xldbv.json');
        try {
            const data = fs.readFileSync(variablesFilePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return null;
        }
    }

    // Open file dialog
    // Opens a file dialog and returns the selected file path(s)
    async openFileDialog(options) {
        const window = BrowserWindow.getFocusedWindow();
        const result = await dialog.showOpenDialog(window, options);
        return result;
    }

    // Read directory contents
    // Returns an array of filenames in the specified directory
    async readDirectory(dirPath) {
        try {
            const fullPath = path.isAbsolute(dirPath) ? dirPath : path.join(this.appDir, dirPath);
            const files = await fs.readdir(fullPath);
            return files;
        } catch (error) {
            return [];
        }
    }

    // Read files with specific extension
    // Returns an array of filenames (without extension) that match the given extension
    async readFilesWithExtension(dirPath, extension) {
        const fullPath = path.join(this.appDir, dirPath);
        try {
            const files = await this.readDirectory(fullPath);
            return files.filter(file => file.endsWith(extension)).map(file => path.basename(file, extension));
        } catch (error) {
            return [];
        }
    }

    // Read themes directory
    // Returns an array of theme names (JSON files) in the themes directory
    async readThemesDirectory(themesDir) {
        return this.readFilesWithExtension(path.join('pages', themesDir), '.thm');
    }

    // Remove file
    // Deletes a file and returns true if successful, false otherwise
    async removeFile(filePath) {
        try {
            await fs.promises.unlink(filePath);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Rename file
    // Renames a file and returns true if successful, false otherwise
    renameFile(oldFilePath, newFilePath) {
        try {
            fs.renameSync(oldFilePath, newFilePath);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Update favourites
    // Writes the updated favourites to the xldbf.json file
    async updateFavs(xldbfPath, favourites) {
        try {
            const directory = path.dirname(xldbfPath);
            this.ensureDirectoryExists(directory);
            await fs.outputJson(xldbfPath, favourites, { spaces: 2 });
            return true;
        } catch (error) {
            return false;
        }
    }

    // Update variables
    // Writes the updated variables to the xldbv.json file
    async updateVars(xldbvPath, variables) {
        try {
            const directory = path.dirname(xldbvPath);
            this.ensureDirectoryExists(directory);
            await fs.outputJson(xldbvPath, variables, { spaces: 2 });
            return true;
        } catch (error) {
            return false;
        }
    }

    // Write file
    // Writes content to a file and returns true if successful, false otherwise
    async writeFile(filePath, content, isBinary = false) {
        try {
            if (isBinary) {
                await fs.writeFile(filePath, Buffer.from(content));
            } else {
                await fs.writeFile(filePath, content, 'utf8');
            }
            return true;
        } catch (error) {
            return false;
        }
    }

    // Update xlaunch config
    async updateXlaunchConfig(configData) {
        const configPath = path.join(this.appDir, 'utils', 'xlaunch.cfg');
        try {
            let content = '';
            const quoteKeys = ['leftEncapsule', 'rightEncapsule', 'messageSeperator', 'messagePrefix'];
            const orderedKeys = [
                'maxLogEntries',
                'dateFormat',
                'timeFormat',
                'construct',
                'leftEncapsule',
                'rightEncapsule',
                'messageSeperator',
                'messagePrefix'
            ];

            for (const key of orderedKeys) {
                if (key in configData && configData[key] !== undefined) {
                    let value = configData[key];
                    if (quoteKeys.includes(key)) {
                        value = `'${value}'`; // Add quotes around specific values
                    }
                    content += `${key}=${value}\n`;
                }
            }

            // Write the new content to the file, overwriting any existing content
            await fs.writeFile(configPath, content.trim(), 'utf8');
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = FileSystemOperations;