// Table Management Module
//   Manages table creation and row filtering functionality
//   Handles database and launchlist table generation with optimized DOM operations
//   Provides row creation, cell population, and table structure management
//   Optimizes table rendering using DocumentFragment and batched style operations

// Create Database Control Table
//   Generates and populates table for database control section
//   Creates table rows from database file data, uses DocumentFragment for batching, and applies styles
export async function createDatabaseTable() {
    const tableContainer = xlp.getElement('tableContainer') || window[window.domCacheName]?.tableContainer;
    const tableBody = xlp.getElement('dqs', '#appTable tbody');
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
        
        const fragment = document.createDocumentFragment();
        const rowHeight = `${dimensions.rowHeight}px`;
        
        for (const rowData of rows) {
            const [appName, command] = rowData.split(',');
            
            const row = document.createElement('tr');
            row.className = 'table-row';
            row.style.cssText = `height: ${rowHeight}; line-height: ${rowHeight};`;
            
            const appCell = document.createElement('td');
            appCell.className = 'app-column';
            appCell.textContent = appName;
            appCell.style.cssText = `height: ${rowHeight}; line-height: ${rowHeight}; padding-left: 15px; border-right: 2px solid var(--table-border-color, #444);`;
            
            const commandCell = document.createElement('td');
            commandCell.className = 'command-column';
            commandCell.textContent = command;
            commandCell.style.cssText = `height: ${rowHeight}; line-height: ${rowHeight}; padding-left: 8px;`;
            
            row.appendChild(appCell);
            row.appendChild(commandCell);
            
            fragment.appendChild(row);
        }
        
        tableBody.appendChild(fragment);
    } catch (error) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'table-row empty-row';
        emptyRow.innerHTML = '<td colspan="2" class="empty-message">Error loading data</td>';
        tableBody.appendChild(emptyRow);
    }
}

// Generate Table Structure
//   Creates and populates complete application launch table interface
//   Creates table rows with favorites first, uses DocumentFragment for batching, and applies styles
export async function createLaunchlistTable(searchResults = null) {
    const dimensions = await xlp.calculateTableDimensions();
    if (!dimensions) {
        return [];
    }

    document.documentElement.style.setProperty('--table-row-height', `${dimensions.rowHeight}px`);
    
    measureRowContent();

    const favourites = xlp.getData('xldbf')?.favourites ?? [];
    const rowInfo = window.rowInfo ?? [];
    const entries = searchResults ?? rowInfo ?? [];

    const tableBody = xlp.getElement('dqs', '#appTable tbody');
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
    
    const favouriteChar = window.xldbv.configOpts?.theme?.favourite ?? '★';
    const defaultPadding = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--table-cell-padding')) || 10;
    const rowHeight = `${dimensions.rowHeight}px`;

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < sortedRows.length; i++) {
        const row = document.createElement('tr');
        row.className = 'table-row';
        row.style.cssText = `height: ${rowHeight}; line-height: ${rowHeight};`;
        
        const [appName] = sortedRows[i].split(',');
        const isStarred = favourites.includes(appName);

        const starCell = document.createElement('td');
        starCell.className = 'star-column';
        starCell.style.cssText = `height: ${rowHeight}; line-height: ${rowHeight};`;
        const starIcon = document.createElement('span');
        starIcon.className = `star-icon ${isStarred ? 'starred' : ''}`;
        starIcon.innerHTML = `${favouriteChar}`;
        starIcon.onclick = (event) => {
            event.stopPropagation();
            xlp.toggleStar(appName, event.currentTarget);
        };
        starCell.appendChild(starIcon);

        const appCell = document.createElement('td');
        appCell.className = 'app-column app-name-cell';
        appCell.style.cssText = `height: ${rowHeight}; line-height: ${rowHeight}; padding-left: ${defaultPadding}px;`;
        appCell.textContent = appName;

        row.appendChild(starCell);
        row.appendChild(appCell);

        await xlp.createRowHighlight(row);

        row.onclick = () => xlp.selectRow(row, appName, false);
        
        fragment.appendChild(row);
    }
    
    tableBody.appendChild(fragment);
    
    return sortedRows;
}

// Process Search Filter
//   Applies search criteria and filters table row content
//   Filters rows based on search term with wildcard support and regex matching
export function filterRows(searchTerm) {
    if (!searchTerm) {
        const rowInfo = window.rowInfo ?? [];
        return rowInfo ?? [];
    }
    
    const startsWithWildcard = searchTerm.startsWith('*');
    
    const searchRegex = new RegExp(
        (startsWithWildcard ? '' : '^') +
        searchTerm.toLowerCase()
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.')
    , 'i');
    
    const rowInfo = window.rowInfo ?? [];
    return (rowInfo ?? []).filter(row => {
        const appName = row.split(',')[0];
        return searchRegex.test(appName);
    });
}

// Calculate Table Dimensions
//   Measures and computes optimal table column width settings
//   Calculates app column width percentage based on longest app name and table width
function measureRowContent() {
    const starColumnMinPercent = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--star-column-min-width') || '25');
    const starColumnMaxPercent = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--star-column-max-width') || '50');
    const measureDiv = xlp.getElement('measureDiv') || window[window.domCacheName]?.measureDiv;
    const appColumnMinPercent = 100 - starColumnMaxPercent;
    const appColumnMaxPercent = 100 - starColumnMinPercent;

    const rowInfo = window.rowInfo ?? [];
    const longestName = rowInfo.reduce((longest, current) => {
        const appName = current.split(',')[0];
        return appName.length > longest.length ? appName : longest;
    }, '');
    
    measureDiv.innerHTML = longestName;
    const nameWidth = measureDiv.getBoundingClientRect().width;   
    const tableWidth = (xlp.getElement('appTable') || window[window.domCacheName]?.appTable)?.getBoundingClientRect().width || 0;
    
    const basePercentage = Math.round((nameWidth / tableWidth) * 100);
    let appColumnPercentage = basePercentage > 35 ? basePercentage + 25 : Math.max(basePercentage, 65);
    appColumnPercentage = Math.min(appColumnMaxPercent, Math.max(appColumnMinPercent, appColumnPercentage));
    
    document.documentElement.style.setProperty('--app-column-width', `${appColumnPercentage}%`);
}