// XLauncher Stitch Module
// Combines multiple XLFC files into a single consolidated file

const path = require('path');
const FileSystemOperations = require('../xlauncherplusfs');

// Main stitch function
// Combines all category XLFC files into a single main XLFC file
async function xlstitch(appDir, appDirs) {
    const fsOps = new FileSystemOperations(appDir, appDirs);
    const xldbvPath = path.join(appDirs.utilsDir, 'xldbv.json');

    try {
        const jsonContent = await fsOps.getFile(xldbvPath);
        if (jsonContent.error) {
            throw new Error(`Error reading xldbv.json: ${jsonContent.error}`);
        }
        let xldbv = JSON.parse(jsonContent.data);

        const categoryDirectory = path.join(appDir, xldbv.directories.xldb);
        const xlfcFilePath = path.join(appDirs.utilsDir, xldbv.mainXLFC);

        let xldbFiles = xldbv.xldbFiles;

        // If xldbFiles is empty, check the directory for .xlfc files
        if (xldbFiles.length === 0) {
            const dirContents = await fsOps.readDir(categoryDirectory);
            if (dirContents.error) {
                throw new Error(`Error reading directory ${categoryDirectory}: ${dirContents.error}`);
            }

            xldbFiles = dirContents.files.filter(file => file.endsWith('.xlfc'));
            
            // Update xldbv.xldbFiles with the found .xlfc files
            if (xldbFiles.length > 0) {
                xldbv.xldbFiles = xldbFiles;
                const writeResult = await fsOps.writeFile(xldbvPath, JSON.stringify(xldbv, null, 2), false);
                if (!writeResult) {
                    throw new Error(`Failed to update xldbv.json with new xldbFiles`);
                }
            }
        }

        // Data gathering function
        // Collects and merges data from all XLFC files
        async function gatherData() {
            const allData = {};
            for (const file of xldbFiles) {
                const filePath = path.join(categoryDirectory, file);
                if (await fsOps.fileExists(filePath)) {
                    const fileContent = await fsOps.getFile(filePath);
                    if (fileContent.error) {
                        continue;
                    }
                    try {
                        const parsedContent = JSON.parse(fileContent.data);
                        Object.assign(allData, parsedContent);
                    } catch (parseError) {
                        // Silently continue if parsing fails
                    }
                }
            }
            return allData;
        }

        let allData = await gatherData();

        // If no data was found, recheck the xldbFiles
        if (Object.keys(allData).length === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            allData = await gatherData();
        }

        // If still no data, throw an error
        if (Object.keys(allData).length === 0) {
            throw new Error('No data found in xldbFiles after rechecking');
        }

        const writeResult = await fsOps.writeFile(xlfcFilePath, JSON.stringify(allData, null, 2), false);
        if (!writeResult) {
            throw new Error(`Failed to write to ${xldbv.mainXLFC}`);
        }

        // Verify the written file
        const verificationContent = await fsOps.getFile(xlfcFilePath);
        if (verificationContent.error) {
            throw new Error(`Error reading ${xldbv.mainXLFC} after writing: ${verificationContent.error}`);
        }

        const verifiedData = JSON.parse(verificationContent.data);
        if (Object.keys(verifiedData).length === 0) {
            throw new Error(`${xldbv.mainXLFC} is empty after writing`);
        }

        return true;
    } catch (error) {
        return false;
    }
}

module.exports = xlstitch;
