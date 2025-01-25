// Theme Builder Module
// Handles SCSS compilation and theme generation for xLauncher Plus

const fs = require('fs-extra');
const path = require('path');
const sass = require('sass');

// Theme compilation
// Processes and compiles all SCSS files into CSS themes with progress tracking
async function compileSassThemes(themeName, progressCallback, baseDir = __dirname, delay = 0) {
    const themesDir = path.join(baseDir, 'common', 'themes');
    const stylesDir = path.join(themesDir, 'base');
    const outputDir = path.join(themesDir, 'compiled');
    const baseThemeScssPath = path.join(stylesDir, 'base.theme.scss');
    const themeJsonPath = path.join(themesDir, `${themeName}.thm`);

    try {
        await cleanDirectory(outputDir);
        await convertJsonToScss(themeJsonPath, baseThemeScssPath);

        const scssFiles = await fs.readdir(stylesDir);
        const totalFiles = scssFiles.filter(file => file.endsWith('.scss') && !file.startsWith('base.theme')).length;
        
        progressCallback(0, totalFiles);

        let processedFiles = 0;
        
        for (const file of scssFiles) {
            if (file.endsWith('.scss') && !file.startsWith('base.theme')) {
                const themeName = path.basename(file, '.scss');
                const themeScssPath = path.join(stylesDir, file);
                const themeCssPath = path.join(outputDir, `${themeName}.css`);

                const result = await compileSass(themeScssPath, stylesDir);
                await fs.outputFile(themeCssPath, result.css);

                processedFiles++;
                progressCallback(processedFiles, totalFiles);

                if (delay > 0) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        return true;
    } catch (error) {
        console.error('Error during theme compilation:', error);
        return false;
    }
}

// JSON to SCSS conversion
// Transforms theme JSON configuration into SCSS variables for compilation
async function convertJsonToScss(jsonFilePath, scssFilePath) {
    try {
        const jsonContent = await fs.readFile(jsonFilePath, 'utf8');
        
        const jsonContentStripped = jsonContent.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) => g ? "" : m);
        
        const jsonData = JSON.parse(jsonContentStripped);

        let scssContent = '';
        for (const [key, value] of Object.entries(jsonData.variables)) {
            scssContent += `$${key}: ${value};\n`;
        }

        await fs.writeFile(scssFilePath, scssContent);
    } catch (error) {
        console.error('Error converting JSON to SCSS:', error);
        throw error;
    }
}

// SCSS compilation
// Compiles a single SCSS file into CSS using the Sass compiler
async function compileSass(file, includePath) {
    try {
        const result = await sass.compileAsync(file, {
            loadPaths: [includePath],
            style: 'compressed'
        });
        return result;
    } catch (error) {
        console.error(`Error compiling Sass file ${file}:`, error);
        throw error;
    }
}

// Directory cleanup
// Removes all files from the output directory before compilation
async function cleanDirectory(directory) {
    try {
        await fs.emptyDir(directory);
    } catch (error) {
        console.error('Error cleaning directory:', error);
        throw error;
    }
}

module.exports = { compileSassThemes }; 