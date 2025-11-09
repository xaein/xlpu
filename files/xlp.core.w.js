// Window Resize Module
//   Manages window resizing and handles all interface dimension updates
//   Handles window dimension calculations and responsive layout adjustments
//   Updates table dimensions, row heights, and interface element sizing
//   Synchronizes window state with application configuration

// Table Dimensions
//   Calculates and adjusts table dimensions for optimal display settings
//   Calculates available height, row height, visible rows, and cell padding based on DPI scale
export async function calculateTableDimensions() {
    const titleBar = xlp.getElement('dqs', '.titlebar');
    const headerContainer = xlp.getElement('headerContainer');
    const footer = xlp.getElement('dqs', '.footer');
    
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

// Scroll Position
//   Retrieves and calculates current scroll position metrics and values
//   Calculates scroll position, row height, and current row index for table scrolling
export function getTableScrollPosition() {
    const scrollContainer = xlp.getElement('dqs', '.table-scroll-container') || xlp.getElement('tabContent');
    if (!scrollContainer) return null;

    const scrollTop = scrollContainer.scrollTop;
    
    const row = xlp.getElement('dqs', '.table-row');
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

// Resize Handler
//   Processes window resize events and updates all interface elements
//   Handles modal overlay, dialog positioning, and section-specific resize operations
export async function handleResize() {
    
    if (xlp.getElement('modalOverlay')?.style.display === 'block') {
        handleResizeModal();
    }
  
    const activeDialog = xlp.getElement('dqs', '.dialog[style*="display: flex"]');
    if (activeDialog) {
        const windowHeight = window.innerHeight;
        const dialogHeight = activeDialog.offsetHeight;
        activeDialog.style.top = `${Math.max(0, (windowHeight - dialogHeight) / 2)}px`;
    }

    if (window.state?.currentSection === 'databasecontrol') {
        await handleResizeDatabaseControl();
    } else if (window.state?.currentSection === 'configuration') {
        const updateConfig = xlp.getElement('updateConfig');
        
        if (updateConfig && !updateConfig.classList.contains('hidden')) {
            if (typeof xlp.createOverlayCutout === 'function') {
                xlp.createOverlayCutout();
            }
        }
        
        if (xlp.getState('config.activePanel') === 'themes') {
            await handleResizeThemes();
        }
    }
}

// Database Control Resize
//   Handles specific resize operations for the database control section
//   Adjusts table container height, manages tab scrolling, and updates row highlights
export async function handleResizeDatabaseControl() {
    const tableContainer = xlp.getElement('tableContainer');
    const appTable = xlp.getElement('appTable');
    
    if (tableContainer && appTable) {
        const headerHeight = xlp.getElement('headerContainer')?.offsetHeight || 0;
        const footerHeight = xlp.getElement('dqs', '.footer')?.offsetHeight || 0;
        const tabContainerHeight = xlp.getElement('tabContainer')?.offsetHeight || 0;
        const controlPanelHeight = xlp.getElement('controlPanel')?.offsetHeight || 0;
        
        const windowHeight = window.innerHeight;
        const availableHeight = windowHeight - headerHeight - footerHeight - tabContainerHeight - controlPanelHeight - 20;
        
        tableContainer.style.height = `${Math.max(availableHeight, 200)}px`;
        
        const tableHeader = xlp.getElement('rqs', 'thead', appTable);
        const headerHeight2 = tableHeader ? tableHeader.offsetHeight : 0;
        const tableBody = xlp.getElement('rqs', 'tbody', appTable);
        
        if (tableBody) {
            tableBody.style.height = `${Math.max(availableHeight - headerHeight2, 150)}px`;
        }
    }
    
    const tabContainer = xlp.getElement('tabContainer');
    const tabList = xlp.getElement('tabList');
    
    if (tabContainer && tabList) {
        const tabs = tabList.querySelectorAll('.tablinks');
        let totalWidth = 0;
        
        tabs.forEach(tab => {
            totalWidth += tab.offsetWidth;
        });
        
        if (totalWidth > tabContainer.offsetWidth) {
            tabList.classList.add('scrollable');
            
            if (!xlp.getElement('tabScrollLeft')) {
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
            
            const scrollLeft = xlp.getElement('tabScrollLeft');
            const scrollRight = xlp.getElement('tabScrollRight');
            
            if (scrollLeft) scrollLeft.remove();
            if (scrollRight) scrollRight.remove();
        }
    }
    
    const selectedRow = xlp.getElement('dqs', '#appTable .table-row.selected');
    if (selectedRow) {
        const highlight = xlp.getElement('rqs', '.row-highlight', selectedRow);
        if (highlight) {
            highlight.style.opacity = '1';
            const svg = xlp.getElement('rqs', 'svg', highlight);
            if (svg) {
                svg.innerHTML = svg.innerHTML.replace(/var\(--main-table-hover-color\)/g, 'var(--main-table-selected-color)');
            }
        }
    }
}

// Modal Resize
//   Handles modal dialog positioning and adjusts dimensions during resize
//   Repositions all visible dialogs to center of window based on dialog height
export function handleResizeModal() {
    const dialogs = xlp.getElement('dqa', '.dialog');
    const windowHeight = window.innerHeight;
    
    dialogs.forEach(dialog => {
        if (dialog.style.display === 'flex' || dialog.style.visibility === 'visible') {
            const dialogHeight = dialog.offsetHeight;
            dialog.style.top = `${Math.max(0, (windowHeight - dialogHeight) / 2)}px`;
        }
    });
}

// Theme Preview Resize
//   Adjusts theme preview container and table for window changes within configuration
//   Calculates available height and adjusts config details and theme details containers
export async function handleResizeThemes() {
    const headerHeight = xlp.getElement('headerContainer')?.offsetHeight || 0;
    const footerHeight = xlp.getElement('dqs', '.footer')?.offsetHeight || 0;
    const configNavContainer = xlp.getElement('dqs', '.config-nav-container');
    const configNavHeight = configNavContainer?.offsetHeight || 0;
    const themesConfig = xlp.getElement('themesConfig');
    
    if (!themesConfig) return;
    
    const configDetails = themesConfig.closest('.config-details');
    if (!configDetails) return;
    
    const availableHeight = window.innerHeight - headerHeight - footerHeight - configNavHeight - 20;
    configDetails.style.height = `${availableHeight}px`;
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const themeDetails = xlp.getElement('dqs', '.theme-details');
    if (themeDetails && xlp.adjustPreviewTableRows) {
        const themeDetailsHeight = themeDetails.offsetHeight;
        if (themeDetailsHeight > 0) {
            xlp.adjustPreviewTableRows(themeDetailsHeight);
        }
    }
}

// Resize Setup
//   Initializes window resize handling and maintains event listener state
//   Adds window resize event listener and triggers initial resize handler
export function setupResizeListeners() {
    window.addEventListener('resize', handleResize);
    handleResize();
}
