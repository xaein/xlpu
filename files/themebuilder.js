const fs = require('fs-extra');
const path = require('path');
const sass = require('sass');

// Compile Sass themes
// Processes and compiles Sass files into CSS themes
async function compileSassThemes(themeName, progressCallback, baseDir = __dirname, delay = 0) {
    const themesDir = path.join(baseDir, 'pages', 'themes');
    const stylesDir = path.join(themesDir, 'styles');
    const outputDir = path.join(baseDir, 'pages', 'common', 'styles');
    const baseThemeScssPath = path.join(stylesDir, 'base.theme.scss');
    const themeJsonPath = path.join(themesDir, `${themeName}.thm`);

    try {
        await cleanDirectory(outputDir);
        await convertJsonToScss(themeJsonPath, baseThemeScssPath);

        const scssFiles = await fs.readdir(stylesDir);
        const totalFiles = scssFiles.filter(file => file.endsWith('.scss')).length;
        
        progressCallback(0, totalFiles);

        let processedFiles = 0;
        
        for (const file of scssFiles) {
            if (file.endsWith('.scss')) {
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

// Convert JSON to SCSS
// Transforms theme JSON file into SCSS variables
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

// Compile Sass
// Compiles a single Sass file to CSS
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

// Clean directory
// Removes all files from the specified directory
async function cleanDirectory(directory) {
    try {
        await fs.emptyDir(directory);
    } catch (error) {
        console.error('Error cleaning directory:', error);
        throw error;
    }
}

// Main execution
// Handles command-line execution of the theme builder
if (require.main === module) {
    const themeName = process.argv.slice(2).join(' ').trim();
    if (!themeName) {
        console.error('No theme name provided. Usage: npm run themebuilder -- "theme name"');
        process.exit(1);
    }
    
    compileSassThemes(themeName, (processed, total) => {
        // Progress callback (left empty as per original code)
    }, path.join(__dirname, '..'), 0)
        .then(success => {
            if (success) {
                // Success handling (left empty as per original code)
            } else {
                console.error(`Failed to compile theme "${themeName}"`);
                process.exit(1);
            }
        })
        .catch(error => {
            console.error(`Error compiling theme "${themeName}":`, error);
            process.exit(1);
        });
}

module.exports = { compileSassThemes };