// Launch List Module
// Manages application list display and launch functionality for apps

// Launch list state variables
window.selectedApp = null;
let searchHandlers = null;

// Initialize Launch System
// Sets up and configures complete launch list functionality
export async function initializeLaunchlist() {
    try {
        const xldbv = xlp.getData('xldbv');
        const xldbf = xlp.getData('xldbf') || {};
        const preloadedData = xlp.getData('preloadedData');
        
        if (!xldbv?.mainXLFC) {
            return;
        }
        
        let mainXLFCFile = xldbv.mainXLFC;
        
        const content = preloadedData[mainXLFCFile];
        if (!content) {
            return;
        }
        
        const parsedData = JSON.parse(content);
        window.rowInfo = Object.entries(parsedData)
            .map(([appName, command]) => `${appName},${command}`);
        
        if (window.rowInfo.length === 0) {
            return;
        }
        
        await xlp.createLaunchlistTable();
     
        setupTableEvents();
        setupSearch();

        xlp.verifyAndSetSection();      
    } catch (error) {
    }
}

// Configure Search System
// Implements and manages complete search functionality with filters
function setupSearch() {
    const searchContainer = document.querySelector('.search-container');
    const searchWrapper = document.querySelector('.search-wrapper');
    const searchInput = document.getElementById('searchInput');
    const iconCircle = document.querySelector('.icon-circle');
    const clearButton = document.querySelector('.clear-button');
    let isExpanded = false;
    let shrinkTimeout;

    function clearSearch() {
        searchInput.value = '';
        performSearch();
        clearButton.style.display = 'none';
    }

    function shrinkSearchBar() {
        isExpanded = false;
        searchWrapper.classList.remove('expanded');
        clearSearch();
        if (shrinkTimeout) {
            clearTimeout(shrinkTimeout);
            shrinkTimeout = null;
        }
    }

    function expandSearchBar() {
        isExpanded = true;
        searchWrapper.classList.add('expanded');
        searchInput.focus();
        clearButton.style.display = searchInput.value ? 'flex' : 'none';
        resetShrinkTimeout();
    }

    function resetShrinkTimeout() {
        if (shrinkTimeout) {
            clearTimeout(shrinkTimeout);
        }
        shrinkTimeout = setTimeout(() => {
            if (isExpanded && !searchInput.value) {
                shrinkSearchBar();
            }
        }, 120000);
    }

    const performSearch = xlp.debounce(async () => {
        const searchTerm = searchInput.value.trim();
        clearButton.style.display = searchTerm ? 'flex' : 'none';

        if (typeof xlp.filterRows !== 'function') return;

        const filteredRows = xlp.filterRows(searchTerm);
        const tableBody = document.querySelector('#appTable tbody');
        const allRows = Array.from(tableBody.querySelectorAll('.table-row'));
        
        const duration = parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue('--transition-duration')) * 1000;

        allRows.forEach(row => {
            row.classList.remove('fade-out', 'fade-in');
        });

        const nonMatchingRows = allRows.filter(row => {
            const appName = row.querySelector('.app-name-cell').textContent;
            return !filteredRows.some(r => r.split(',')[0] === appName);
        });

        const matchingRows = allRows.filter(row => {
            const appName = row.querySelector('.app-name-cell').textContent;
            return filteredRows.some(r => r.split(',')[0] === appName);
        });

        nonMatchingRows.forEach(row => row.classList.add('fade-out'));

        await new Promise(resolve => setTimeout(resolve, duration));

        nonMatchingRows.forEach(row => row.style.display = 'none');
        matchingRows.forEach(row => {
            row.style.display = '';
            row.classList.add('fade-in');
            setTimeout(() => row.classList.remove('fade-in'), duration);
        });

        if (window.selectedApp) {
            const isVisible = filteredRows.some(row => row.split(',')[0] === window.selectedApp);
            if (!isVisible) {
                resetAppSelection();
            }
        }
    }, 300);

    const handleIconClick = () => {
        if (isExpanded) {
            shrinkSearchBar();
        } else {
            expandSearchBar();
        }
    };

    const handleInput = () => {
        performSearch();
        resetShrinkTimeout();
    };

    const handleKeydown = (e) => {
        if (e.key === 'Escape') {
            shrinkSearchBar();
        }
        resetShrinkTimeout();
    };

    const handleOutsideClick = (e) => {
        if (isExpanded && 
            !searchContainer.contains(e.target) && 
            !e.target.closest('.table-row')) {
            shrinkSearchBar();
        }
    };

    iconCircle.addEventListener('click', handleIconClick);
    clearButton.addEventListener('click', clearSearch);
    searchInput.addEventListener('input', handleInput);
    searchInput.addEventListener('keydown', handleKeydown);
    searchInput.addEventListener('focus', resetShrinkTimeout);
    document.addEventListener('click', handleOutsideClick);

    searchHandlers = {
        iconClick: handleIconClick,
        clearSearch,
        input: handleInput,
        keydown: handleKeydown,
        focus: resetShrinkTimeout,
        outsideClick: handleOutsideClick,
        shrinkTimeout
    };
}

// Setup Table Events
// Configures and manages all table interaction event handlers
function setupTableEvents() {
    const table = document.querySelector('#appTable');
    const tabContent = document.getElementById('tabContent');
    
    if (table) {
        table.addEventListener('dblclick', handleRowDoubleClick);
    }
    
    if (tabContent) {
        let lastScrollTop = 0;
        
        const handleScrollEnd = xlp.debounce(() => {
            const { scrollTop, rowHeight } = xlp.getTableScrollPosition();
            if (!scrollTop || !rowHeight) return;
            
            const scrollingDown = scrollTop > lastScrollTop;
            lastScrollTop = scrollTop;
            
            const targetRow = scrollingDown 
                ? Math.ceil(scrollTop / rowHeight)
                : Math.floor(scrollTop / rowHeight);
            
            const targetScroll = targetRow * rowHeight;
            
            if (scrollTop !== targetScroll) {
                tabContent.scrollTo({
                    top: targetScroll,
                    behavior: 'smooth'
                });
            }
        }, 150);
        
        tabContent.scrollHandler = handleScrollEnd;
        tabContent.addEventListener('scroll', handleScrollEnd);
    }
}

// Process Double Click
// Handles all double click interactions within launch table
export function handleRowDoubleClick(event) {
    const row = event.target.closest('.table-row');
    if (row) {
        const appName = row.querySelector('.app-column').textContent;
        selectRow(row, appName, false, true);
    }
}

// Manage Row Selection
// Updates and maintains selected row state across interface
export function selectRow(row, appName, skipLaunch = false, shouldLaunch = false) {
    const previousSelected = document.querySelector('.table-row.selected');
    
    // Check if we're clicking the same row that's already selected (deselect case)
    if (previousSelected && previousSelected === row) {
        // Deselect the row
        previousSelected.classList.remove('selected');
        const prevHighlight = previousSelected.querySelector('.row-highlight');
        if (prevHighlight) {
            prevHighlight.style.opacity = '0';
            const prevSvg = prevHighlight.querySelector('svg');
            if (prevSvg) {
                prevSvg.innerHTML = prevSvg.innerHTML.replace(/var\(--main-table-selected-color\)/g, 'var(--main-table-hover-color)');
            }
        }
        window.selectedApp = null;
    } else {
        // Deselect previous row if there was one
        if (previousSelected) {
            previousSelected.classList.remove('selected');
            const prevHighlight = previousSelected.querySelector('.row-highlight');
            if (prevHighlight) {
                prevHighlight.style.opacity = '0';
                const prevSvg = prevHighlight.querySelector('svg');
                if (prevSvg) {
                    prevSvg.innerHTML = prevSvg.innerHTML.replace(/var\(--main-table-selected-color\)/g, 'var(--main-table-hover-color)');
                }
            }
        }
        
        // Select the new row
        row.classList.add('selected');
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
        
        window.selectedApp = appName;
        
        if (shouldLaunch && !skipLaunch) {
            if (window.selectedApp) {
                xlp.showDialog('launch');
                startLaunchCountdown();
            }
        }
    }

    xlp.updateGreenButtonState();
}

// Process Favorite Changes
// Handles and synchronizes all favorite status modifications
export async function toggleStar(appName, starElement) {
    const xldbf = xlp.getData('xldbf') || { favourites: [] };
    const favourites = xldbf.favourites;
    const isStarring = !favourites.includes(appName);
    
    const currentRow = starElement.closest('.table-row');
    if (!currentRow) return;
    
    const duration = parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue('--transition-duration')) * 1000;
    
    currentRow.classList.add('fade-out');
    await new Promise(resolve => setTimeout(resolve, duration));
    
    if (isStarring) {
        favourites.push(appName);
    } else {
        const index = favourites.indexOf(appName);
        if (index !== -1) favourites.splice(index, 1);
    }
    xlp.setData('xldbf', xldbf);
    
    // Save xldbf to file with proper validation
    const cleanedXldbfData = xlp.validateXldbfJson(xldbf);
    if (cleanedXldbfData) {
        const baseDir = await e.Api.invoke('get-app-dir');
        const utilsDir = xlp.dirVar('utils');
        const xldbfPath = xlp.joinPath(baseDir, utilsDir, 'xldbf.json');
        const xldbfResult = await e.Api.invoke('update-favs', xldbfPath, cleanedXldbfData);
        if (!xldbfResult) {
            throw new Error('Failed to update xldbf.json');
        }
    } else {
        throw new Error('Invalid xldbf.json structure');
    }
    
    const allRows = Array.from(document.querySelectorAll('.table-row'));
    const newPosition = calculateNewPosition(appName, isStarring, allRows);
    
    currentRow.remove();
    const tableBody = document.querySelector('#appTable tbody');
    if (newPosition === 0) {
        tableBody.insertBefore(currentRow, tableBody.firstChild);
    } else {
        const beforeRow = tableBody.children[newPosition];
        tableBody.insertBefore(currentRow, beforeRow);
    }
    
    currentRow.classList.remove('fade-out');
    currentRow.classList.add('fade-in');
    setTimeout(() => currentRow.classList.remove('fade-in'), duration);
    
    const starIcon = currentRow.querySelector('.star-icon');
    if (starIcon) {
        starIcon.classList.toggle('starred', isStarring);
    }
}

// Calculate Row Position
// Determines optimal row positioning after status changes
function calculateNewPosition(appName, isStarring, allRows) {
    const rows = allRows.map(row => ({
        name: row.querySelector('.app-column').textContent,
        isFavorite: row.querySelector('.star-icon.starred') !== null
    }));
    
    if (isStarring) {
        const favoriteRows = rows.filter(r => r.isFavorite || r.name === appName);
        return favoriteRows.sort((a, b) => a.name.localeCompare(b.name))
            .findIndex(r => r.name === appName);
    } else {
        const nonFavoriteRows = rows.filter(r => !r.isFavorite || r.name === appName);
        const position = nonFavoriteRows.sort((a, b) => a.name.localeCompare(b.name))
            .findIndex(r => r.name === appName);
        return rows.filter(r => r.isFavorite).length + position;
    }
}

// Initialize Launch Timer
// Sets up and executes complete launch countdown sequence
export function startLaunchCountdown() {
    const dialog = document.getElementById('launchDialog');
    const countdownElement = dialog?.querySelector('#countdown');
    const appNameElement = dialog?.querySelector('#appName');
    
    if (!dialog || !countdownElement || !appNameElement) {
        return;
    }

    if (!window.selectedApp) {
        return;
    }

    appNameElement.textContent = window.selectedApp;
    let countdown = 5;
    countdownElement.textContent = `in ${countdown} seconds`;

    xlp.updateRecentApps(window.selectedApp);
    e.Api.invoke('launch-app', window.selectedApp).catch(() => {});
    
    const interval = setInterval(() => {
        countdown -= 1;
        countdownElement.textContent = `in ${countdown} seconds`;
        if (countdown <= 0) {
            clearInterval(interval);
            xlp.closeDialog('launch');
            resetAppSelection();
        }
    }, 1000);
}

// Clear App Selection
// Resets and cleans up current application selection state
export function resetAppSelection() {
    const selectedRow = document.querySelector('.table-row.selected');
    if (selectedRow) {
        selectedRow.classList.remove('selected');
        const highlight = selectedRow.querySelector('.row-highlight');
        if (highlight) {
            highlight.style.opacity = '0';
            const svg = highlight.querySelector('svg');
            if (svg) {
                svg.innerHTML = svg.innerHTML.replace(/var\(--main-table-selected-color\)/g, 'var(--main-table-hover-color)');
            }
        }
    }
    window.selectedApp = null;
    xlp.updateGreenButtonState();
}

// Cleanup Launch System
// Performs complete cleanup of launch list functionality
export async function cleanupLaunchlist() {
    const table = document.querySelector('#appTable');
    if (table) {
        table.removeEventListener('dblclick', handleRowDoubleClick);
    }
    
    const tabContent = document.getElementById('tabContent');
    if (tabContent && tabContent.scrollHandler) {
        tabContent.removeEventListener('scroll', tabContent.scrollHandler);
        tabContent.scrollHandler = null;
    }

    if (searchHandlers) {
        const searchInput = document.getElementById('searchInput');
        const clearButton = document.querySelector('.clear-button');
        const iconCircle = document.querySelector('.icon-circle');
        
        if (searchInput) {
            searchInput.value = '';
            searchInput.removeEventListener('input', searchHandlers.input);
            searchInput.removeEventListener('keydown', searchHandlers.keydown);
            searchInput.removeEventListener('focus', searchHandlers.focus);
        }
        
        if (clearButton) {
            clearButton.removeEventListener('click', searchHandlers.clearSearch);
        }
        
        if (iconCircle) {
            iconCircle.removeEventListener('click', searchHandlers.iconClick);
        }

        document.removeEventListener('click', searchHandlers.outsideClick);
        
        if (searchHandlers.shrinkTimeout) {
            clearTimeout(searchHandlers.shrinkTimeout);
        }

        searchHandlers = null;
    }
    
    window.selectedApp = null;
    window.rowInfo = [];
}