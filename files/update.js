async function fetchFile(url, responseType = 'json') {
    try {
        const response = await e.Api.invoke('fetch-url', url, responseType);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        return response.data; // Return the fetched content
    } catch (error) {
        console.error(`Error fetching file from ${url}:`, error);
        throw error;
    }
}

async function getVersionInfo() {
    const url = 'https://raw.githubusercontent.com/xaein/xlpu/main/version.json';
    return await fetchFile(url, 'json');
}

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
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        updateInfoPreview.value = updateInfoPreview.value.replace(`↓ ${fileName}`, `✔ ${fileName}`);
    }
}

// Expose functions to the global scope
window.updateFunctions = {
    fetchFile,
    getVersionInfo,
    updateFiles
};
