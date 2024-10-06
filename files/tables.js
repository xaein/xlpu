// Table-related functions

// Create edit table
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

// Create main table
// Generates and populates the main table with app entries, applying sorting and filtering
function createMainTable(page, rowsPerPage, filteredRows) {
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

    const favouriteChar = window.xldbv.favourite || '★';

    const sortedRows = rowsToUse.slice().sort((a, b) => {
        const [appNameA] = a.split(',');
        const [appNameB] = b.split(',');
        const isStarredA = favourites.includes(appNameA);
        const isStarredB = favourites.includes(appNameB);

        if (isStarredA && isStarredB) {
            return appNameA.localeCompare(appNameB);
        } else if (isStarredA) {
            return -1;
        } else if (isStarredB) {
            return 1;
        } else {
            return window.rows.indexOf(a) - window.rows.indexOf(b);
        }
    });

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
        
        const highlightPath = createRowHighlight(row);

        row.addEventListener('mouseenter', () => {
            const hoverColor = getTableHighlightVariable('hover-color');
            highlightPath.setAttribute("fill", hoverColor);
        });

        row.addEventListener('mouseleave', () => {
            if (!row.classList.contains('selected')) {
                highlightPath.setAttribute("fill", "transparent");
            } else {
                const selectedColor = getTableHighlightVariable('selected-color');
                highlightPath.setAttribute("fill", selectedColor);
            }
        });
        
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

// Create pointed path
// Generates SVG path for pointed highlight shape
function createPointedPath(width, height, pointDepth, xOffset, yOffset) {
    const x = xOffset;
    const y = yOffset;
    const w = width;
    const h = height;
    const d = pointDepth;

    if (d === 0) {
        return `
            M ${x} ${y}
            H ${x + w}
            V ${y + h}
            H ${x}
            V ${y}
            Z
        `;
    }

    const leftPointX = x - d;
    const rightPointX = x + w + d;
    const middleY = 50;

    return `
        M ${leftPointX} ${middleY}
        L ${x} ${y}
        L ${x + w} ${y}
        L ${rightPointX} ${middleY}
        L ${x + w} ${100 - y}
        L ${x} ${100 - y}
        Z
    `;
}

// Create rectangular path
// Generates SVG path for rectangular highlight shape
function createRectangularPath(width, height, pointDepth, xOffset, yOffset) {
    const x = xOffset;
    const y = yOffset;
    const w = width;
    const h = height;
    const d = pointDepth;

    if (d === 0) {
        return `
            M ${x} ${y}
            H ${x + w}
            V ${y + h}
            H ${x}
            V ${y}
            Z
        `;
    }

    const pointInset = (h / Math.abs(d)) + Math.abs(d);

    return `
        M ${x} ${y}
        H ${x + w}
        V ${y + pointInset}
        L ${x + w + d} ${y + h / 2}
        L ${x + w} ${y + h - pointInset}
        V ${y + h}
        H ${x}
        V ${y + h - pointInset}
        L ${x - d} ${y + h / 2}
        L ${x} ${y + pointInset}
        V ${y}
        Z
    `;
}

// Create rounded path
// Generates SVG path for curved highlight shape
function createRoundedPath(width, height, cornerRadius, pointDepth, xOffset, yOffset) {
    const x = xOffset;
    const y = yOffset;
    const w = width;
    const h = height;
    const r = Math.min(cornerRadius, Math.min(w, h) / 2);
    const d = pointDepth;

    const isOval = r > 60;
    const middleY = 50;
    const curveDepth = Math.abs(d);
    const sideX = d < 0 ? x + curveDepth : x;
    const sideControlX = d < 0 ? x : x + curveDepth;
    const oppositeSideX = d < 0 ? x + w - curveDepth : x + w;
    const oppositeSideControlX = d < 0 ? x + w : x + w - curveDepth;

    if (isOval) {
        return `
            M ${x} ${middleY}
            Q ${x} ${y} ${x + w/2} ${y}
            Q ${x + w} ${y} ${x + w} ${middleY}
            Q ${x + w} ${100 - y} ${x + w/2} ${100 - y}
            Q ${x} ${100 - y} ${x} ${middleY}
            Z
        `;
    } else {
        return `
            M ${x + r} ${y}
            L ${x + w - r} ${y}
            Q ${x + w} ${y} ${x + w} ${y + r}
            L ${oppositeSideX} ${middleY - curveDepth}
            Q ${oppositeSideControlX} ${middleY} ${oppositeSideX} ${middleY + curveDepth}
            L ${x + w} ${100 - y - r}
            Q ${x + w} ${100 - y} ${x + w - r} ${100 - y}
            L ${x + r} ${100 - y}
            Q ${x} ${100 - y} ${x} ${100 - y - r}
            L ${sideX} ${middleY + curveDepth}
            Q ${sideControlX} ${middleY} ${sideX} ${middleY - curveDepth}
            L ${x} ${y + r}
            Q ${x} ${y} ${x + r} ${y}
            Z
        `;
    }
}

// Create row highlight
// Generates SVG highlight for table rows with customizable shape and color
function createRowHighlight(row) {
    const existingSvg = row.querySelector('svg');
    if (existingSvg) {
        existingSvg.remove();
    }

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.pointerEvents = "none";
    svg.style.zIndex = "1";

    const highlightWidth = parseFloat(getTableHighlightVariable('highlight-width'));
    const highlightHeight = parseFloat(getTableHighlightVariable('highlight-height'));
    const cornerRadius = parseFloat(getTableHighlightVariable('highlight-corner-radius'));
    const shapeType = getTableHighlightVariable('highlight-shape-type');
    const pointDepth = parseFloat(getTableHighlightVariable('highlight-point-depth'));

    const xOffset = (100 - highlightWidth) / 2;
    const yOffset = (100 - highlightHeight) / 2;

    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");

    let path;
    switch (shapeType) {
        case 'pointed':
            path = createPointedPath(highlightWidth, highlightHeight, pointDepth, xOffset, yOffset);
            break;
        case 'curved':
            path = createRoundedPath(highlightWidth, highlightHeight, cornerRadius, pointDepth, xOffset, yOffset);
            break;
        case 'rectangle':
        default:
            path = createRectangularPath(highlightWidth, highlightHeight, pointDepth, xOffset, yOffset);
            break;
    }

    const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathElement.setAttribute("d", path);
    pathElement.setAttribute("fill", "transparent");
    pathElement.setAttribute("stroke", "none");

    svg.appendChild(pathElement);
    
    row.style.position = 'relative';
    
    row.insertBefore(svg, row.firstChild);

    return pathElement;
}

// Create table
// Determines whether to use main or edit table creation based on the isEditPage flag
function createTable(page, rowsPerPage, isEditPage, filteredRows) {
    if (isEditPage) {
        return createEditTable(page, rowsPerPage);
    } else {
        return createMainTable(page, rowsPerPage, filteredRows);
    }
}

// Filter rows
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

// Get table highlight variable
// Retrieves CSS variable values for table highlight customization
function getTableHighlightVariable(variableName) {
    const fullVariableName = `--main-table-${variableName}`;
    const style = getComputedStyle(document.documentElement);
    const value = style.getPropertyValue(fullVariableName).trim();
    
    if (variableName.includes('width') || variableName.includes('height') || 
        variableName.includes('depth') || variableName.includes('radius')) {
        const numericValue = parseFloat(value);
        return numericValue;
    }
    
    return value.toLowerCase();
}

// Restore selected row
// Re-applies selection to the previously selected row after table updates
function restoreSelectedRow(isEditPage) {
    if (window.selectedApp) {
        const rows = document.querySelectorAll('#appTable .table-row:not(.empty-row)');
        rows.forEach(row => {
            const appName = row.querySelector('.app-column').textContent;
            if (appName === window.selectedApp) {
                row.classList.add('selected');
            }
        });
    }
    if (isEditPage) {
        js.F.updateEditButtonState();
    } else {
        js.F.updateLaunchButtonState();
    }
}

// Select row
// Updates UI and button states based on the selected row in main or edit tables
function selectRow(row, appName, isEditPage, isDoubleClick = false) {
    if (!row.classList.contains('empty-row')) {
        const rows = document.querySelectorAll('#appTable .table-row:not(.empty-row)');
        rows.forEach(r => {
            r.classList.remove('selected');
            const path = r.querySelector('svg path');
            if (path) {
                path.setAttribute("fill", "transparent");
            }
        });
        
        if (window.selectedApp === appName && !isDoubleClick) {
            window.selectedApp = null;
            row.classList.remove('selected');
        } else {
            row.classList.add('selected');
            window.selectedApp = appName;
            const path = row.querySelector('svg path');
            if (path) {
                const selectedColor = getTableHighlightVariable('selected-color');
                path.setAttribute("fill", selectedColor);
            }
            
            if (isDoubleClick) {
                js.F.launchApp(appName);
            }
        }
        
        if (isEditPage) {
            js.F.updateEditButtonState();
        } else {
            js.F.updateLaunchButtonState();
        }
    }
}

// Toggle star
// Updates UI, localStorage, and re-renders the table with updated favorite status
function toggleStar(appName, event) {
    event.stopPropagation();

    const favourites = window.xldbf.favourites;
    const starIcon = event.target.closest('.star-icon');
    if (!starIcon) return;

    const favouriteChar = window.xldbv.favourite || '★';
    const animationDuration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--star-animation-duration')) * 1000 || 300;

    const favouriteIndex = favourites.indexOf(appName);
    if (favouriteIndex !== -1) {
        favourites.splice(favouriteIndex, 1);
        starIcon.classList.remove('starred', 'animate');
    } else {
        favourites.push(appName);
        starIcon.classList.add('starred', 'animate');
    }

    starIcon.innerHTML = `${favouriteChar}&nbsp;&nbsp;`;

    js.F.setData('xldbf', window.xldbf);

    setTimeout(() => {
        const { mainRowsPerPage } = js.F.getRowVariables();
        js.F.createTable(currentPage, mainRowsPerPage, false);
        js.F.checkSelectedAppVisibility();
        js.F.updatePagination(false);
    }, animationDuration);
}

// Export table functions
window.tableFunctions = {
    createTable,
    filterRows,
    restoreSelectedRow,
    selectRow,
    toggleStar
};