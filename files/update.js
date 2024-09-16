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
        console.error(`Error fetching file from ${url}:`, error);
        throw error;
    }
}

// Fetch version info
// Fetches the version information from the specified URL
async function getVersionInfo() {
    const url = 'https://raw.githubusercontent.com/xaein/xlpu/main/version.json';
    return await fetchFile(url, 'json');
}

// Update files
// Updates the files based on the version information
async function updateFiles() {
    const versionInfo = await getVersionInfo();
    const appDir = await e.Api.invoke('get-app-dir');
    const updateInfoPreview = document.getElementById('updateInfoPreview');
    for (const [fileName, destinationDir] of Object.entries(versionInfo.files)) {
        updateInfoPreview.value = updateInfoPreview.value.replace(`- ${fileName}`, `↓ ${fileName}`);
        const fileUrl = `https://raw.githubusercontent.com/xaein/xlpu/main/files/${fileName}`;
        const fileContent = await fetchFile(fileUrl, 'text');
        const destinationPath = js.F.joinPath(appDir, destinationDir, fileName);
        const result = await e.Api.invoke('write-file', destinationPath, fileContent);
        if (!result) {
            console.error(`Failed to write file: ${fileName} to path: ${destinationPath}`);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        updateInfoPreview.value = updateInfoPreview.value.replace(`↓ ${fileName}`, `✔ ${fileName}`);
        scrollToLine(updateInfoPreview, `✔ ${fileName}`);
    }
}

// Scroll to line
// This function scrolls the given element to the line containing the specified text
function scrollToLine(element, text) {
    const lines = element.value.split('\n');
    const lineIndex = lines.findIndex(line => line.includes(text));
    if (lineIndex !== -1) {
        const lineHeight = 22; // Approximate line height in pixels
        element.scrollTop = lineIndex * lineHeight;
    }
}

// Exposes functions to the global scope
window.updateFunctions = {
    fetchFile,
    getVersionInfo,
    updateFiles
};
