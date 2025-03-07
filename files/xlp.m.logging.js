// Logging Module
// Manages log content display and automatic refresh functionality

// Refresh interval state
let logRefreshInterval;

// Initialize Log System
// Sets up and manages complete logging display functionality
export async function initializeLogging() {
    loadLogContent();
    xlp.verifyAndSetSection();
    logRefreshInterval = setInterval(loadLogContent, 5000);
}

// Process Log Content
// Retrieves and formats complete log file with styling
async function loadLogContent() {
    try {
        const appDir = await e.Api.invoke('get-app-dir');
        const utilsDir = xlp.dirVar('utils');
        const logFilePath = xlp.joinPath(appDir, utilsDir, window.xldbv.logfile);
        const { data: logContent } = await e.Api.invoke('get-file', logFilePath);
        
        if (!logContent) {
            return;
        }
        
        const logPre = document.getElementById('logContent');
        if (logPre) {
            logPre.innerHTML = colorizeLogContent(logContent);
            logPre.scrollTop = logPre.scrollHeight;
        }
    } catch (error) {
        return;
    }
}

// Apply Color Formatting
// Processes and applies color styling to all log entries
function colorizeLogContent(logContent) {
    const lines = logContent.split('\n');
    const coloredLines = lines.map(line => {
        if (line.toLowerCase().includes('error')) {
            return `<span class="log-error">${line}</span>`;
        } else {
            return `<span class="log-normal">${line}</span>`;
        }
    });
    return coloredLines.join('\n');
}

// Cleanup Log System
// Performs complete cleanup of logging display functionality
export function cleanupLogging() {
    if (logRefreshInterval) {
        clearInterval(logRefreshInterval);
        logRefreshInterval = null;
    }
} 