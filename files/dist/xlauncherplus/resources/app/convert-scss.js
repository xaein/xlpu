const fs = require('fs-extra');
const path = require('path');
const sass = require('sass');

const scssDir = path.join(__dirname, 'scss');
const cssDir = path.join(__dirname, 'pages', 'styles');

// Ensure the CSS directory exists
fs.ensureDirSync(cssDir);

// Read all .scss files from the scss directory
fs.readdir(scssDir, (err, files) => {
    if (err) {
        console.error('Error reading SCSS directory:', err);
        return;
    }

    files.forEach(file => {
        if (path.extname(file) === '.scss' && file !== 'default.scss') {
            const scssFilePath = path.join(scssDir, file);
            const cssFilePath = path.join(cssDir, file.replace('.scss', '.css'));

            // Compile SCSS to CSS
            sass.render({ file: scssFilePath }, (err, result) => {
                if (err) {
                    console.error('Error compiling SCSS:', err);
                    return;
                }

                // Write the compiled CSS to the target directory
                fs.writeFile(cssFilePath, result.css, err => {
                    if (err) {
                        console.error('Error writing CSS file:', err);
                    } else {
                        console.log(`Compiled ${file} to ${cssFilePath}`);
                    }
                });
            });
        }
    });
});