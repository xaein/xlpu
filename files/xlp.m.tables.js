// Table Management Module
// Manages table creation and row filtering functionality

// Calculate Table Dimensions
// Measures and computes optimal table column width settings
function measureRowContent() {
    const measureDiv = document.getElementById('measureDiv');
    const star = window.xldbv.configOpts?.theme?.favourite || '★';
    
    const longestName = window.rowInfo.reduce((longest, current) => {
        const appName = current.split(',')[0];
        return appName.length > longest.length ? appName : longest;
    }, '');
    
    measureDiv.innerHTML = `${star}&nbsp;&nbsp;${longestName}`;
    const totalContentWidth = Math.round(measureDiv.getBoundingClientRect().width);
    
    const starColumnPercentage = Math.round((totalContentWidth / 10 - 3));
    const appColumnPercentage = 100 - starColumnPercentage;
    
    document.documentElement.style.setProperty('--app-column-width', `${appColumnPercentage}%`);
}

// Generate Table Structure
// Creates and populates complete application launch table interface
export async function createLaunchlistTable(searchResults = null) {
    const dimensions = await xlp.calculateTableDimensions();
    if (!dimensions) {
        return [];
    }

    document.documentElement.style.setProperty('--table-row-height', `${dimensions.rowHeight}px`);
    
    measureRowContent();

    const favourites = xlp.getData('xldbf')?.favourites || [];
    const entries = searchResults || window.rowInfo || [];

    const tableBody = document.querySelector('#appTable tbody');
    if (!tableBody) {
        return [];
    }
    tableBody.innerHTML = '';

    if (entries.length === 0) {
        return [];
    }

    const favoriteRows = [];
    const remainingRows = entries.filter(row => {
        const [appName] = row.split(',');
        if (favourites.includes(appName)) {
            favoriteRows.push(row);
            return false;
        }
        return true;
    });

    favoriteRows.sort((a, b) => a.split(',')[0].localeCompare(b.split(',')[0]));
    remainingRows.sort((a, b) => a.split(',')[0].localeCompare(b.split(',')[0]));

    const sortedRows = [...favoriteRows, ...remainingRows];
    
    const favouriteChar = window.xldbv.configOpts?.theme?.favourite || '★';
    
    for (let i = 0; i < sortedRows.length; i++) {
        const row = document.createElement('tr');
        row.className = 'table-row';
        row.style.height = `${dimensions.rowHeight}px`;
        row.style.lineHeight = `${dimensions.rowHeight}px`;
        
        const [appName] = sortedRows[i].split(',');
        const isStarred = favourites.includes(appName);

        const starCell = document.createElement('td');
        starCell.className = 'star-column';
        starCell.style.height = `${dimensions.rowHeight}px`;
        starCell.style.lineHeight = `${dimensions.rowHeight}px`;
        const starIcon = document.createElement('span');
        starIcon.className = `star-icon ${isStarred ? 'starred' : ''}`;
        starIcon.innerHTML = `${favouriteChar}&nbsp;&nbsp;`;
        starIcon.onclick = (event) => {
            event.stopPropagation();
            xlp.toggleStar(appName, event.currentTarget);
        };
        starCell.appendChild(starIcon);

        const appCell = document.createElement('td');
        appCell.className = 'app-column app-name-cell';
        appCell.style.height = `${dimensions.rowHeight}px`;
        appCell.style.lineHeight = `${dimensions.rowHeight}px`;
        appCell.style.paddingLeft = '25px';
        appCell.textContent = appName;

        row.appendChild(starCell);
        row.appendChild(appCell);

        await xlp.createRowHighlight(row);

        row.onclick = () => xlp.selectRow(row, appName, false);
        
        tableBody.appendChild(row);
    }
    
    return sortedRows;
}

// Process Search Filter
// Applies search criteria and filters table row content
export function filterRows(searchTerm) {
    if (!searchTerm) {
        return window.rowInfo || [];
    }
    
    const startsWithWildcard = searchTerm.startsWith('*');
    
    const searchRegex = new RegExp(
        (startsWithWildcard ? '' : '^') +
        searchTerm.toLowerCase()
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.')
    , 'i');
    
    return (window.rowInfo || []).filter(row => {
        const appName = row.split(',')[0];
        return searchRegex.test(appName);
    });
}

// Create Database Control Table
// Generates and populates table for database control section
export async function createDatabaseTable() {
    const tableContainer = document.getElementById('tableContainer');
    const tableBody = document.querySelector('#appTable tbody');
    if (!tableBody || !tableContainer) {
        return;
    }
    
    tableBody.innerHTML = '';
    
    const fileName = `${window.currentCategory}.xlfc`;
    const fileData = window.tempData[fileName];
    if (!fileData) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'table-row empty-row';
        emptyRow.innerHTML = '<td colspan="2" class="empty-message">No entries found</td>';
        tableBody.appendChild(emptyRow);
        return;
    }
    
    try {
        const parsedData = JSON.parse(fileData);
        const rows = Object.entries(parsedData)
            .map(([appName, command]) => `${appName},${command}`)
            .sort((a, b) => a.localeCompare(b));
            
        if (rows.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.className = 'table-row empty-row';
            emptyRow.innerHTML = '<td colspan="2" class="empty-message">No entries found</td>';
            tableBody.appendChild(emptyRow);
            return;
        }
    
        const dimensions = await xlp.calculateTableDimensions();
        if (!dimensions) return;
        
        document.documentElement.style.setProperty('--table-row-height', `${dimensions.rowHeight}px`);
        
        for (const rowData of rows) {
            const [appName, command] = rowData.split(',');
            
            const row = document.createElement('tr');
            row.className = 'table-row';
            row.style.height = `${dimensions.rowHeight}px`;
            row.style.lineHeight = `${dimensions.rowHeight}px`;
            
            const appCell = document.createElement('td');
            appCell.className = 'app-column';
            appCell.textContent = appName;
            appCell.style.height = `${dimensions.rowHeight}px`;
            appCell.style.lineHeight = `${dimensions.rowHeight}px`;
            appCell.style.paddingLeft = '15px';
            appCell.style.borderRight = '2px solid var(--table-border-color, #444)';
            
            const commandCell = document.createElement('td');
            commandCell.className = 'command-column';
            commandCell.textContent = command;
            commandCell.style.height = `${dimensions.rowHeight}px`;
            commandCell.style.lineHeight = `${dimensions.rowHeight}px`;
            commandCell.style.paddingLeft = '8px';
            
            row.appendChild(appCell);
            row.appendChild(commandCell);
            
            tableBody.appendChild(row);
        }
    } catch (error) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'table-row empty-row';
        emptyRow.innerHTML = '<td colspan="2" class="empty-message">Error loading data</td>';
        tableBody.appendChild(emptyRow);
    }
}