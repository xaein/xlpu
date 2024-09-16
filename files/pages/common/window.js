// Window-related functions

// Adjust preview table rows
// Dynamically adjusts the number of rows in the theme preview table
function adjustPreviewTableRows(height) {
    const preview = document.querySelector('.theme-preview');
    if (!preview) return;

    const tableBody = preview.querySelector('.preview-table-body');
    if (!tableBody) return;

    const titlebarHeight = preview.querySelector('.preview-titlebar')?.offsetHeight || 0;
    const headerHeight = preview.querySelector('.preview-header')?.offsetHeight || 0;
    const tabContainerHeight = preview.querySelector('.preview-tab-container')?.offsetHeight || 0;
    const tableHeaderHeight = preview.querySelector('.preview-table-header')?.offsetHeight || 0;
    const editControlsHeight = preview.querySelector('.preview-edit-controls')?.offsetHeight || 0;
    const footerHeight = preview.querySelector('.preview-footer')?.offsetHeight || 0;

    const previewHeight = height || preview.offsetHeight;
    const availableHeight = previewHeight - titlebarHeight - headerHeight - tabContainerHeight - tableHeaderHeight - editControlsHeight - footerHeight;

    const rowHeight = 17;
    const numRows = Math.max(Math.floor(availableHeight / rowHeight) - 2, 0);

    tableBody.innerHTML = '';

    const hoverColor = getComputedStyle(preview).getPropertyValue('--preview-table-row-hover-background-color');
    const selectedColor = getComputedStyle(preview).getPropertyValue('--preview-table-row-selected-background-color');

    for (let i = 0; i < numRows; i++) {
        const row = document.createElement('div');
        row.className = 'preview-row';
        row.innerHTML = '<div style="flex: 0 0 29.2%;"></div><div style="flex: 1;"></div>';
        
        row.addEventListener('mouseover', () => {
            row.style.backgroundColor = hoverColor;
        });
        row.addEventListener('mouseout', () => {
            if (row.classList.contains('selected')) {
                row.style.backgroundColor = selectedColor;
            } else {
                row.style.backgroundColor = '';
            }
        });

        if (i === 1) {
            row.classList.add('selected');
            row.style.backgroundColor = selectedColor;
        }

        tableBody.appendChild(row);
    }
}

// Handle resize
// Main resize handler function
async function handleResize(page, height, initialRowsPerPage) {
    switch (page) {
        case 'launchlist':
            return handleResizeMain(height, initialRowsPerPage);
        case 'databasecontrol':
            return handleResizeEdit(height, initialRowsPerPage);
        case 'themes':
            return handleResizeThemes(height);
        default:
            return;
    }
}

// Handle resize edit
// Calculates and sets the number of rows per page based on available height
async function handleResizeEdit(height, initialRowsPerPage) {
    if (!height) {
        const windowSize = await e.Api.invoke('get-window-size');
        height = windowSize.height;
    }

    const headerHeight = document.getElementById('headerContainer')?.offsetHeight || 0;
    const footerHeight = document.getElementById('footerContainer')?.offsetHeight || 0;
    const editControlsHeight = document.getElementById('editControlsContainer')?.offsetHeight || 0;
    const tabContainerHeight = document.getElementById('tabContainer')?.offsetHeight || 0;
    const tableHeaderHeight = document.querySelector('#appTable thead')?.offsetHeight || 0;

    const availableHeight = height - headerHeight - footerHeight - editControlsHeight - tabContainerHeight - tableHeaderHeight;

    const rowHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--table-row-height')) || 28;

    let newRowsPerPage = Math.floor((availableHeight - (rowHeight * 2.1)) / rowHeight);

    window.xldbv.rows = { ...window.xldbv.rows, edit: newRowsPerPage };
    js.F.setData('xldbv', window.xldbv);

    js.F.adjustPaginationAfterResize(true);
    js.F.updatePagination(true);

    return newRowsPerPage;
}

// Handle resize main
// Calculates and sets the number of rows per page based on available height
async function handleResizeMain(height, initialRowsPerPage) {
    if (!height) {
        const windowSize = await e.Api.invoke('get-window-size');
        height = windowSize.height;
    }

    const headerHeight = document.getElementById('headerContainer')?.offsetHeight || 0;
    const footerHeight = document.getElementById('footerContainer')?.offsetHeight || 0;
    const paginationHeight = document.getElementById('paginationWrapper')?.offsetHeight || 0;

    const availableHeight = height - headerHeight - footerHeight - paginationHeight;

    const rowHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--table-row-height')) || 28;

    let newRowsPerPage = Math.floor((availableHeight - (rowHeight * 1.4)) / rowHeight);

    window.xldbv.rows = { ...window.xldbv.rows, main: newRowsPerPage };
    js.F.setData('xldbv', window.xldbv);

    js.F.adjustPaginationAfterResize(false);
    js.F.updatePagination(false);

    return newRowsPerPage;
}

// Handle resize themes
// Adjusts the height of the main content area for the themes page
async function handleResizeThemes(height) {
    if (!height) {
        const windowSize = await e.Api.invoke('get-window-size');
        height = windowSize.height;
    }

    const headerHeight = document.getElementById('headerContainer')?.offsetHeight || 0;
    const footerHeight = document.getElementById('footerContainer')?.offsetHeight || 0;

    const mainContent = document.getElementById('mainContent');
    const newHeight = height - headerHeight - footerHeight - 40;
    mainContent.style.height = `${newHeight}px`;

    adjustPreviewTableRows(newHeight);
}

// Export window functions
window.windowFunctions = {
    handleResize,
    handleResizeMain,
    handleResizeEdit,
    handleResizeThemes,
    adjustPreviewTableRows
};