// Window Resize Module
// Manages window resizing and handles all interface dimension updates

// Resize Setup
// Initializes window resize handling and maintains event listener state
export function setupResizeListeners() {
    window.addEventListener('resize', handleResize);
    handleResize();
}

// Resize Handler
// Processes window resize events and updates all interface elements
export async function handleResize() {
    
    if (document.getElementById('modalOverlay')?.style.display === 'block') {
        handleResizeModal();
    }

    await adjustContentHeight();
    
    const activeDialog = document.querySelector('.dialog[style*="display: flex"]');
    if (activeDialog) {
        const windowHeight = window.innerHeight;
        const dialogHeight = activeDialog.offsetHeight;
        activeDialog.style.top = `${Math.max(0, (windowHeight - dialogHeight) / 2)}px`;
    }

    if (window.state?.currentSection === 'themes') {
        await handleResizeThemes();
    } else if (window.state?.currentSection === 'databasecontrol') {
        await handleResizeDatabaseControl();
    } else if (window.state?.currentSection === 'configuration') {
        
        const updateConfig = document.getElementById('updateConfig');
        
        if (updateConfig && !updateConfig.classList.contains('hidden')) {
            if (typeof xlp.createOverlayCutout === 'function') {
                xlp.createOverlayCutout();
            }
        }
    }
}

// Database Control Resize
// Handles specific resize operations for the database control section
export async function handleResizeDatabaseControl() {
    const tableContainer = document.getElementById('tableContainer');
    const appTable = document.getElementById('appTable');
    
    if (tableContainer && appTable) {
        const headerHeight = document.getElementById('headerContainer')?.offsetHeight || 0;
        const footerHeight = document.querySelector('.footer')?.offsetHeight || 0;
        const tabContainerHeight = document.getElementById('tabContainer')?.offsetHeight || 0;
        const controlPanelHeight = document.getElementById('controlPanel')?.offsetHeight || 0;
        
        const windowHeight = window.innerHeight;
        const availableHeight = windowHeight - headerHeight - footerHeight - tabContainerHeight - controlPanelHeight - 20;
        
        tableContainer.style.height = `${Math.max(availableHeight, 200)}px`;
        
        const tableHeader = appTable.querySelector('thead');
        const headerHeight2 = tableHeader ? tableHeader.offsetHeight : 0;
        const tableBody = appTable.querySelector('tbody');
        
        if (tableBody) {
            tableBody.style.height = `${Math.max(availableHeight - headerHeight2, 150)}px`;
        }
    }
    
    const tabContainer = document.getElementById('tabContainer');
    const tabList = document.getElementById('tabList');
    
    if (tabContainer && tabList) {
        const tabs = tabList.querySelectorAll('.tablinks');
        let totalWidth = 0;
        
        tabs.forEach(tab => {
            totalWidth += tab.offsetWidth;
        });
        
        if (totalWidth > tabContainer.offsetWidth) {
            tabList.classList.add('scrollable');
            
            if (!document.getElementById('tabScrollLeft')) {
                const scrollLeft = document.createElement('button');
                scrollLeft.id = 'tabScrollLeft';
                scrollLeft.className = 'tab-scroll-button';
                scrollLeft.innerHTML = '&lt;';
                scrollLeft.addEventListener('click', () => {
                    tabList.scrollLeft -= 100;
                });
                
                const scrollRight = document.createElement('button');
                scrollRight.id = 'tabScrollRight';
                scrollRight.className = 'tab-scroll-button';
                scrollRight.innerHTML = '&gt;';
                scrollRight.addEventListener('click', () => {
                    tabList.scrollLeft += 100;
                });
                
                tabContainer.insertBefore(scrollLeft, tabList);
                tabContainer.appendChild(scrollRight);
            }
        } else {
            tabList.classList.remove('scrollable');
            
            const scrollLeft = document.getElementById('tabScrollLeft');
            const scrollRight = document.getElementById('tabScrollRight');
            
            if (scrollLeft) scrollLeft.remove();
            if (scrollRight) scrollRight.remove();
        }
    }
    
    const selectedRow = document.querySelector('#appTable .table-row.selected');
    if (selectedRow) {
        const highlight = selectedRow.querySelector('.row-highlight');
        if (highlight) {
            highlight.style.opacity = '1';
            const svg = highlight.querySelector('svg');
            if (svg) {
                svg.innerHTML = svg.innerHTML.replace(/var\(--main-table-hover-color\)/g, 'var(--main-table-selected-color)');
            }
        }
    }
}

// Table Dimensions
// Calculates and adjusts table dimensions for optimal display settings
export async function calculateTableDimensions() {
    const titleBar = document.querySelector('.titlebar');
    const headerContainer = document.getElementById('headerContainer');
    const footer = document.querySelector('.footer');
    
    const titleBarHeight = titleBar?.offsetHeight || 0;
    const headerHeight = headerContainer?.offsetHeight || 0;
    const footerHeight = footer?.offsetHeight || 0;
    
    const dpiScale = await e.Api.invoke('get-window-dpi');
    
    const totalFixedHeight = (titleBarHeight + headerHeight + footerHeight);
    const availableHeight = (window.innerHeight - totalFixedHeight) * dpiScale;
    
    const textSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--table-text-size')) || 1;
    const lineHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--table-text-line-height')) || 1.2;
    const baseTextHeight = Math.floor(textSize * 16 * lineHeight);
    const maxPadding = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--table-cell-padding')) || 10;
    const minPadding = 1;
    
    const minRowHeight = baseTextHeight + (minPadding * 2);
    const maxVisibleRows = Math.floor(availableHeight / (minRowHeight * dpiScale));
    
    const exactRowHeight = Math.floor(availableHeight / (maxVisibleRows * dpiScale));
    
    const adjustedPadding = Math.min(
        maxPadding,
        Math.floor((exactRowHeight - baseTextHeight) / 2)
    );
    
    return {
        availableHeight: availableHeight / dpiScale,
        rowHeight: exactRowHeight,
        visibleRows: maxVisibleRows,
        cellPadding: adjustedPadding,
        dpiScale: dpiScale,
        baseTextHeight: baseTextHeight
    };
}

// Modal Resize
// Handles modal dialog positioning and adjusts dimensions during resize
export function handleResizeModal() {
    const dialogs = document.querySelectorAll('.dialog');
    const windowHeight = window.innerHeight;
    
    dialogs.forEach(dialog => {
        if (dialog.style.display === 'flex' || dialog.style.visibility === 'visible') {
            const dialogHeight = dialog.offsetHeight;
            dialog.style.top = `${Math.max(0, (windowHeight - dialogHeight) / 2)}px`;
        }
    });
}

// Content Height
// Calculates and adjusts main content area dimensions dynamically
export async function adjustContentHeight() {
    const header = document.getElementById('headerContainer');
    const footer = document.querySelector('.footer');
    const content = document.getElementById('dynamicContent');
    
    if (!content) return;

    const headerHeight = header?.offsetHeight || 0;
    const footerHeight = footer?.offsetHeight || 0;
    
    const dpiScale = await e.Api.invoke('get-window-dpi');
    
    if (!header?.classList.contains('hidden')) {
        content.style.height = `calc(100vh - ${(headerHeight + footerHeight) * dpiScale}px)`;
        content.style.top = `${headerHeight * dpiScale}px`;
    } else {
        content.style.height = '100vh';
        content.style.top = '0';
    }
}

// Scroll Position
// Retrieves and calculates current scroll position metrics and values
export function getTableScrollPosition() {
    const scrollContainer = document.querySelector('.table-scroll-container') || document.getElementById('tabContent');
    if (!scrollContainer) return null;

    const scrollTop = scrollContainer.scrollTop;
    
    const row = document.querySelector('.table-row');
    let rowHeight = 0;
    
    if (row) {
        rowHeight = row.getBoundingClientRect().height;
    } else {
        rowHeight = parseInt(getComputedStyle(document.documentElement)
            .getPropertyValue('--table-row-height'));
    }
    
    const currentRow = Math.floor(scrollTop / rowHeight);
    
    return {
        scrollTop,
        rowHeight,
        currentRow
    };
}

// Theme Preview Resize
// Adjusts theme preview container and table for window changes
export async function handleResizeThemes() {
    const headerHeight = document.getElementById('headerContainer')?.offsetHeight || 0;
    const footerHeight = document.querySelector('.footer')?.offsetHeight || 0;
    const mainContent = document.getElementById('mainContent');
    
    if (!mainContent) return;
    
    const newHeight = window.innerHeight - headerHeight - footerHeight - 40;
    mainContent.style.height = `${newHeight}px`;
    
    adjustPreviewTableRows(newHeight);
}

// Preview Table Rows
// Calculates and updates theme preview table rows during resize
export function adjustPreviewTableRows(height) {
    const preview = document.querySelector('.theme-preview');
    if (!preview) return;

    const titlebarHeight = preview.querySelector('.preview-titlebar')?.offsetHeight || 0;
    const headerHeight = preview.querySelector('.preview-header')?.offsetHeight || 0;
    const tabContainerHeight = preview.querySelector('.preview-tab-container')?.offsetHeight || 0;
    const tableHeaderHeight = preview.querySelector('.preview-table-header')?.offsetHeight || 0;
    const footerHeight = preview.querySelector('.preview-footer')?.offsetHeight || 0;

    const previewHeight = height || preview.offsetHeight;
    const availableHeight = previewHeight - titlebarHeight - headerHeight - tabContainerHeight - tableHeaderHeight - footerHeight;

    const rowHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--preview-table-row-height')) || 28;
    const numRows = Math.max(Math.floor(availableHeight / rowHeight) - 2, 0);

    xlp.createPreviewTableRows(numRows);
}