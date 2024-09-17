// Update-related functions

// Fetch file
// Fetches a file from the specified URL with the given response type
async function fetchFile(url, responseType = 'json') {
    try {
        const response = await e.Api.invoke('fetch-url', url, responseType);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        return response.data;
    } catch (error) {
        throw error;
    }
}

// Fetch version info
// Fetches the version information from the specified URL
async function getVersionInfo() {
    const baseUrl = window.xldbv.uurl;
    const url = `${baseUrl}/version.json`;
    return await fetchFile(url, 'json');
}

// Update files
// Updates the files based on the version information
async function updateFiles() {
    const versionInfo = await getVersionInfo();
    const appDir = await e.Api.invoke('get-app-dir');
    const updateInfoPreview = document.getElementById('updateInfoPreview');
    const baseUrl = window.xldbv.uurl;
    let mainFilesUpdated = false;

    // Update normal files
    for (const [fileName, destinationDir] of Object.entries(versionInfo.files)) {
        updateInfoPreview.value = updateInfoPreview.value.replace(`- ${fileName}`, `↓ ${fileName}`);
        const fileUrl = `${baseUrl}/files/${fileName}`;
        const responseType = fileName.endsWith('.exe') ? 'arraybuffer' : 'text';
        const fileContent = await fetchFile(fileUrl, responseType);
        const destinationPath = js.F.joinPath(appDir, destinationDir, fileName);
        const result = await e.Api.invoke('write-file', destinationPath, fileContent, responseType === 'arraybuffer');
        if (!result) {}
        await new Promise(resolve => setTimeout(resolve, 500));
        updateInfoPreview.value = updateInfoPreview.value.replace(`↓ ${fileName}`, `✔ ${fileName}`);
        scrollToLine(updateInfoPreview, `✔ ${fileName}`);
    }

    // Update main files
    for (const [fileName, shouldUpdate] of Object.entries(versionInfo.mainFiles)) {
        if (shouldUpdate) {
            mainFilesUpdated = true;
            updateInfoPreview.value = updateInfoPreview.value.replace(`- ${fileName}`, `↓ ${fileName}`);
            const fileUrl = `${baseUrl}/files/${fileName}`;
            const responseType = fileName.endsWith('.exe') ? 'arraybuffer' : 'text';
            const fileContent = await fetchFile(fileUrl, responseType);
            const destinationPath = js.F.joinPath(appDir, fileName);
            const result = await e.Api.invoke('write-file', destinationPath, fileContent, responseType === 'arraybuffer');
            await new Promise(resolve => setTimeout(resolve, 500));
            updateInfoPreview.value = updateInfoPreview.value.replace(`↓ ${fileName}`, `✔ ${fileName}`);
            scrollToLine(updateInfoPreview, `✔ ${fileName}`);
        }
    }

    // Display message if main files were updated
    if (mainFilesUpdated) {
        updateInfoPreview.value += '\nApplication will need to be reopened for changes to take effect.';
        scrollToLine(updateInfoPreview, 'Application will need to be reopened for changes to take effect.');
    }
}

// Scroll to line
// This function scrolls the given element to the line containing the specified text
function scrollToLine(element, text) {
    const lines = element.value.split('\n');
    const lineIndex = lines.findIndex(line => line.includes(text));
    if (lineIndex !== -1) {
        const lineHeight = getLineHeight(element); // Get the approximate line height
        const scrollTop = lineIndex * lineHeight;
        element.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
        });
    }
}

// Get line height
// This function creates a temporary element to measure the line height
function getLineHeight(element) {
    const temp = document.createElement('div');
    temp.style.position = 'absolute';
    temp.style.visibility = 'hidden';
    temp.style.whiteSpace = 'nowrap';
    temp.style.font = getComputedStyle(element).font;
    temp.innerText = 'A';
    document.body.appendChild(temp);
    const lineHeight = temp.clientHeight;
    document.body.removeChild(temp);
    return lineHeight;
}

// Exposes functions to the global scope
window.updateFunctions = {
    fetchFile,
    getVersionInfo,
    updateFiles
};
