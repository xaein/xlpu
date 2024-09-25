const path = require('path');
const FileSystemOperations = require('../xlauncherplusfs');

async function xlstitch(appDir) {
    const fsOps = new FileSystemOperations(appDir);
    const xldbvPath = path.join(appDir, 'utils', 'xldbv.json');

    try {
        const jsonContent = await fsOps.getFile(xldbvPath);
        if (jsonContent.error) {
            throw new Error(`Error reading xldbv.json: ${jsonContent.error}`);
        }
        const xldbv = JSON.parse(jsonContent.data);

        const categoryDirectory = path.join(appDir, xldbv.directories.xldb);
        const xlfcFilePath = path.join(appDir, 'utils', xldbv.mainXLFC);

        const xldbFiles = xldbv.xldbFiles;

        const allData = {};
        for (const file of xldbFiles) {
            // Use path.join to properly handle filenames with spaces
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
                }
            }
        }

        const writeResult = await fsOps.writeFile(xlfcFilePath, JSON.stringify(allData, null, 2), false);
        if (!writeResult) {
            throw new Error(`Failed to write to ${xldbv.mainXLFC}`);
        }

        return true;
    } catch (error) {
        return false;
    }
}

module.exports = xlstitch;
