// Logging Module
//   Manages log content display and automatic refresh functionality
//   Handles log file reading, parsing, and display formatting
//   Provides automatic log updates and scroll management
//   Manages log filtering and content display interface

// Refresh interval state
//   Tracks automatic log refresh interval timer
//   Manages interval ID for automatic log content updates
let logRefreshInterval;

// Initialize Log System
//   Sets up and manages complete logging display functionality
//   Initializes DOM cache, loads log content, and sets up automatic refresh interval
export async function initializeLogging() {
    initializeLoggingDomCache();
    
    loadLogContent();
    xlp.verifyAndSetSection();
    logRefreshInterval = setInterval(loadLogContent, 5000);
}

// Apply Color Formatting
//   Processes and applies color styling to all log entries
//   Applies error class to lines containing "error" and normal class to other lines
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

// Initialize DOM Cache
//   Creates cached DOM element references for logging section
//   Creates DOM cache object with references to logging section elements
function initializeLoggingDomCache() {
    const section = xlp.sections.logging;
    if (!section?.domElements) {
        return;
    }
    
    const sectionLabel = section.label.replace(/\s+/g, '');
    const domCacheName = `${sectionLabel}Dom`;
    window[domCacheName] = {};
    xlp.setState('ui.domCacheName', domCacheName);
    
    section.domElements.forEach(elementId => {
        const element = xlp.getElement(elementId);
        if (element) {
            window[domCacheName][elementId] = element;
        }
    });
}

// Process Log Content
//   Retrieves and formats complete log file with styling
//   Loads log file, applies color formatting, and scrolls to bottom of log display
async function loadLogContent() {
    try {
        const appDir = await e.Api.invoke('get-app-dir');
        const utilsDir = xlp.dirVar('utils');
        const logFilePath = xlp.joinPath(appDir, utilsDir, window.xldbv.logfile);
        const { data: logContent } = await e.Api.invoke('get-file', logFilePath);
        
        if (!logContent) {
            return;
        }
        
        const logPre = xlp.getElement('logContent') || window[window.domCacheName]?.logContent;
        if (logPre) {
            logPre.innerHTML = colorizeLogContent(logContent);
            logPre.scrollTop = logPre.scrollHeight;
        }
    } catch (error) {
        return;
    }
}

// Cleanup Log System
//   Performs complete cleanup of logging display functionality
//   Clears refresh interval, removes DOM cache, and resets state
export function cleanupLogging() {
    if (logRefreshInterval) {
        clearInterval(logRefreshInterval);
        logRefreshInterval = null;
    }
    
    const domCacheName = xlp.getState('ui.domCacheName');
    if (domCacheName && window[domCacheName]) {
        delete window[domCacheName];
    }
    xlp.setState('ui.domCacheName', null);
} 