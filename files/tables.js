// Table-related functions

// Build Edit View
// Generates and populates the edit table with app entries and their commands
function createEditTable(page, rowsPerPage) {
    if (rowsPerPage === undefined) {
        rowsPerPage = window.xldbv.rows.edit;
    }

    const tableBody = document.querySelector('#appTable tbody');
    if (!tableBody) {
        return;
    }
    tableBody.innerHTML = '';

    if (!Array.isArray(window.rows) || window.rows.length === 0) {
        return;
    }

    const startIndex = (page - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, window.rows.length);

    const rowsCreated = [];
    for (let i = startIndex; i < endIndex; i++) {
        const row = document.createElement('tr');
        row.className = 'table-row';
        const rowData = window.rows[i].split(',');

        const appCell = document.createElement('td');
        appCell.className = 'app-column';
        appCell.textContent = rowData[0] || '';
        row.appendChild(appCell);

        const commandCell = document.createElement('td');
        commandCell.className = 'command-column';
        commandCell.textContent = rowData[1] || '';
        row.appendChild(commandCell);

        row.onclick = function() { js.F.selectRow(row, rowData[0], true); };

        tableBody.appendChild(row);
        rowsCreated.push(row);
    }

    while (tableBody.children.length < rowsPerPage) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'table-row empty-row';
        emptyRow.innerHTML = '<td class="app-column"></td><td class="command-column"></td>';
        tableBody.appendChild(emptyRow);
    }

    return rowsCreated;
}

// Build Main View
// Generates and populates the main table with app entries, applying sorting and filtering
async function createMainTable(page, rowsPerPage, filteredRows) {
    const favourites = window.xldbf.favourites;
    const rowsToUse = filteredRows || window.rows;

    if (rowsPerPage === undefined) {
        rowsPerPage = window.xldbv.rows.main;
    }

    const tableBody = document.querySelector('#appTable tbody');
    tableBody.innerHTML = '';

    if (!rowsToUse || rowsToUse.length === 0) {
        return [];
    }

    const favouriteChar = window.xldbv.configOpts?.theme?.favourite || '★';

    const favoriteRows = [];
    const remainingRows = rowsToUse.filter(row => {
        const [appName] = row.split(',');
        if (favourites.includes(appName)) {
            favoriteRows.push(row);
            return false;
        }
        return true;
    });

    favoriteRows.sort((a, b) => {
        const [appNameA] = a.split(',');
        const [appNameB] = b.split(',');
        return appNameA.localeCompare(appNameB);
    });

    remainingRows.sort((a, b) => {
        const [appNameA] = a.split(',');
        const [appNameB] = b.split(',');
        return appNameA.localeCompare(appNameB);
    });

    const sortedRows = [...favoriteRows, ...remainingRows];

    let rowsCreated = 0;
    const startIndex = (page - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, sortedRows.length);

    for (let i = startIndex; i < endIndex; i++) {
        const row = document.createElement('tr');
        row.className = 'table-row';
        const [appName, command] = sortedRows[i].split(',');
        const isStarred = favourites.includes(appName);

        const starCell = document.createElement('td');
        starCell.className = 'star-column';
        const starIcon = document.createElement('span');
        starIcon.className = `star-icon ${isStarred ? 'starred' : ''}`;
        starIcon.innerHTML = `${favouriteChar}&nbsp;&nbsp;`;
        starIcon.onclick = (event) => {
            event.stopPropagation();
            js.F.toggleStar(appName, event);
        };
        starCell.appendChild(starIcon);

        const appCell = document.createElement('td');
        appCell.className = 'app-column app-name-cell';
        appCell.textContent = appName;

        row.appendChild(starCell);
        row.appendChild(appCell);

        const highlight = await createRowHighlight(row);

        row.onclick = function() { 
            js.F.selectRow(row, appName, false);
        };
        
        tableBody.appendChild(row);
        rowsCreated++;
    }

    while (rowsCreated < rowsPerPage) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'table-row empty-row';
        emptyRow.innerHTML = '<td class="star-column"></td><td class="app-column"></td>';
        tableBody.appendChild(emptyRow);
        rowsCreated++;
    }

    return sortedRows;
}

// Add Row Highlight
// Creates and returns a highlight element for a table row
async function createRowHighlight(row) {
    const existingHighlight = row.querySelector('.row-highlight');
    if (existingHighlight) {
        existingHighlight.remove();
    }

    const highlight = document.createElement('div');
    highlight.className = 'row-highlight';
    highlight.style.position = 'absolute';
    highlight.style.top = '0';
    
    const highlightWidth = window.xldbv.configOpts?.theme?.rowWidth || 100;
    const leftOffset = (100 - highlightWidth) / 2;
    highlight.style.left = `${leftOffset}%`;
    highlight.style.width = `${highlightWidth}%`;
    highlight.style.height = '100%';
    highlight.style.pointerEvents = 'none';
    highlight.style.zIndex = '0';
    highlight.style.opacity = '0';
    highlight.style.transition = 'opacity 0.2s ease-in-out';

    const rowSelector = window.xldbv.configOpts?.theme?.rowSelector || 'rectangle';
    const svgContent = await generateRowSelectorSVG(`${rowSelector}.svg`);
    
    if (svgContent) {
        highlight.innerHTML = svgContent;
    } else {
        highlight.style.backgroundColor = 'var(--main-table-hover-color)';
    }

    row.style.position = 'relative';
    row.insertBefore(highlight, row.firstChild);

    row.addEventListener('mouseenter', () => {
        highlight.style.opacity = '1';
    });

    row.addEventListener('mouseleave', () => {
        if (!row.classList.contains('selected')) {
            highlight.style.opacity = '0';
        }
    });

    if (row.classList.contains('selected')) {
        highlight.style.opacity = '1';
        const svg = highlight.querySelector('svg');
        if (svg) {
            svg.innerHTML = svg.innerHTML.replace(/var\(--main-table-hover-color\)/g, 'var(--main-table-selected-color)');
        }
    }

    return highlight;
}

// Generate Table View
// Determines whether to use main or edit table creation based on the isEditPage flag
function createTable(page, rowsPerPage, isEditPage, filteredRows) {
    if (isEditPage) {
        return createEditTable(page, rowsPerPage);
    } else {
        return createMainTable(page, rowsPerPage, filteredRows);
    }
}

// Filter Table Entries
// Applies wildcard search to app names using * for multiple characters and ? for single character
function filterRows(searchTerm) {
    if (!searchTerm) {
        return window.rows;
    }
    
    const startsWithWildcard = searchTerm.startsWith('*');
    
    const searchRegex = new RegExp(
        (startsWithWildcard ? '' : '^') +
        searchTerm.toLowerCase()
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.')
    , 'i');
    
    const filteredRows = window.rows.filter(row => {
        const appName = row.split(',')[0];
        return searchRegex.test(appName);
    });

    return filteredRows;
}

// Update Row Selection
// Updates UI and button states based on the selected row in main or edit tables
function selectRow(row, appName, isEditPage, isDoubleClick = false) {
    if (!row.classList.contains('empty-row')) {
        const rows = document.querySelectorAll('#appTable .table-row:not(.empty-row)');
        rows.forEach(r => {
            r.classList.remove('selected');
            const highlight = r.querySelector('.row-highlight');
            if (highlight) {
                highlight.style.opacity = '0';
            }
        });
        
        if (window.selectedApp === appName && !isDoubleClick) {
            window.selectedApp = null;
            row.classList.remove('selected');
        } else {
            row.classList.add('selected');
            window.selectedApp = appName;
            const highlight = row.querySelector('.row-highlight');
            if (highlight) {
                highlight.style.opacity = '1';
                const svg = highlight.querySelector('svg');
                if (svg) {
                    svg.innerHTML = svg.innerHTML
                        .replace(/var\(--main-table-hover-color\)/g, 'var(--main-table-selected-color)')
                        .replace(/opacity="[^"]*"/g, 'opacity="0.5"');
                }
            }
            
            if (isDoubleClick) {
                const currentApp = appName;
                js.F.launchApp(currentApp);
            }
        }

        if (isEditPage) {
            js.F.updateEditButtonState();
        } else {
            js.F.updateLaunchButtonState();
        }
    }
}

// Toggle Favorite State
// Updates UI and localStorage without recreating the entire table
function toggleStar(appName, event) {
    event.stopPropagation();

    const favourites = window.xldbf.favourites;
    const starIcon = event.target.closest('.star-icon');
    if (!starIcon) return;

    const favouriteChar = window.xldbv.configOpts?.theme?.favourite || '★';

    const favouriteIndex = favourites.indexOf(appName);
    if (favouriteIndex !== -1) {
        favourites.splice(favouriteIndex, 1);
        starIcon.classList.remove('starred');
    } else {
        favourites.push(appName);
        starIcon.classList.add('starred');
    }

    starIcon.innerHTML = `${favouriteChar}&nbsp;&nbsp;`;
    js.F.setData('xldbf', window.xldbf);

    // Just redraw the current page
    const { mainRowsPerPage } = js.F.getRowVariables();
    const currentPage = window.pagination.main.currentPage;
    js.F.createTable(currentPage, mainRowsPerPage, false);
    js.F.updatePagination(false);
}

// Create Row Selector
// Loads and colors SVG for row selector dropdown
async function generateRowSelectorSVG(svgPath, isConfig = false) {
    try {
        const appDir = await e.Api.invoke('get-app-dir');
        const themesDir = js.F.dirVar('themes');
        const fullPath = js.F.joinPath(appDir, 'common', themesDir, 'selectors', svgPath);
        const { data: svgContent } = await e.Api.invoke('get-file', fullPath);
        
        if (!svgContent) return null;

        const modifiedSvg = svgContent.replace(/currentColor/g, 'var(--main-table-hover-color)');
        return modifiedSvg;
    } catch (error) {
        return null;
    }
}

// Export table functions
window.tableFunctions = {
    createTable,
    filterRows,
    generateRowSelectorSVG,
    selectRow,
    toggleStar
};