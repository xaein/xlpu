// Launch List Module
//   Manages application list display and launch functionality for apps
//   Handles application listing, filtering, and launch operations
//   Provides search functionality and application selection interface
//   Manages row highlighting and application information display

// Launch list state variables
//   Tracks selected application, row information, and search handlers
//   Manages selected app state, row data array, and search functionality handlers
window.selectedApp = null;
window.rowInfo = [];
let searchHandlers = null;

// Initialize Launch System
//   Sets up and configures complete launch list functionality
//   Initializes DOM cache, loads main XLFC file, creates table, and sets up search and events
export async function initializeLaunchlist() {
    try {
        initializeLaunchlistDomCache();
        
        const xldbv = xlp.getData('xldbv');
        const xldbf = xlp.getData('xldbf') ?? {};
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
        xlp.silentError();
    }
}

// Calculate Row Position
//   Determines optimal row positioning after status changes
//   Calculates new position for row based on favorite status and alphabetical sorting
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

// Handle Launch Process
//   Triggers launch dialog and countdown for selected application
//   Shows launch dialog and starts countdown timer for selected app
export function handleLaunch() {
    if (window.selectedApp) {
        xlp.showDialog('launch');
        startLaunchCountdown();
    }
}

// Process Double Click
//   Handles all double click interactions within launch table
//   Selects row and triggers launch dialog with countdown
export function handleRowDoubleClick(event) {
    const row = event.target.closest('.table-row');
    if (row) {
        const appName = row.querySelector('.app-column').textContent;
        selectRow(row, appName, false, true);
    }
}

// Initialize DOM Cache
//   Creates cached DOM element references for launchlist section
//   Creates DOM cache object with references to launchlist section elements
function initializeLaunchlistDomCache() {
    const section = xlp.sections.launchlist;
    if (!section?.domElements) {
        return;
    }
    
    const sectionLabel = section.label.replace(/\s+/g, '');
    const domCacheName = `${sectionLabel}Dom`;
    window[domCacheName] = {};
    window.domCacheName = domCacheName;
    
    section.domElements.forEach(elementId => {
        const element = xlp.getElement(elementId);
        if (element) {
            window[domCacheName][elementId] = element;
        }
    });
}

// Clear App Selection
//   Resets and cleans up current application selection state
//   Removes selected class from row, resets highlight, and clears selected app state
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
    xlp.setState('app.selectedApp', null);
    xlp.updateGreenButtonState();
}

// Manage Row Selection
//   Updates and maintains selected row state across interface
//   Handles row selection, deselection, highlighting, and launch dialog triggering
export function selectRow(row, appName, skipLaunch = false, shouldLaunch = false) {
    const previousSelected = document.querySelector('.table-row.selected');
    
    if (previousSelected && previousSelected === row) {
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

// Configure Search System
//   Implements and manages complete search functionality with filters
//   Sets up search input, clear button, expand/collapse behavior, and search filtering
function setupSearch() {
    const searchContainer = window[window.domCacheName]?.searchContainer || xlp.getElement('dqs', '.search-container');
    const searchWrapper = window[window.domCacheName]?.searchWrapper || xlp.getElement('dqs', '.search-wrapper');
    const searchInput = xlp.getElement('searchInput') || window[window.domCacheName]?.searchInput;
    const iconCircle = window[window.domCacheName]?.iconCircle || xlp.getElement('dqs', '.icon-circle');
    const clearButton = window[window.domCacheName]?.clearButton || xlp.getElement('dqs', '.clear-button');
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
            const appNameCell = row.querySelector('.app-name-cell') || row.querySelector('.app-column');
            if (!appNameCell) return false;
            const appName = appNameCell.textContent;
            return !filteredRows.some(r => r.split(',')[0] === appName);
        });

        const matchingRows = allRows.filter(row => {
            const appNameCell = row.querySelector('.app-name-cell') || row.querySelector('.app-column');
            if (!appNameCell) return false;
            const appName = appNameCell.textContent;
            return filteredRows.some(r => r.split(',')[0] === appName);
        });

        nonMatchingRows.forEach(row => {
            row.classList.add('fade-out');
        });

        await new Promise(resolve => setTimeout(resolve, duration));

        nonMatchingRows.forEach(row => {
            row.style.display = 'none';
        });
        matchingRows.forEach(row => {
            row.style.display = '';
            row.classList.add('fade-in');
            setTimeout(() => row.classList.remove('fade-in'), duration);
        });

        const selectedApp = window.selectedApp;
        if (selectedApp) {
            const isVisible = filteredRows.some(row => row.split(',')[0] === selectedApp);
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

    window.handleIconClick = handleIconClick;
    window.clearSearch = clearSearch;
    window.handleInput = handleInput;
    window.handleKeydown = handleKeydown;
    window.resetShrinkTimeout = resetShrinkTimeout;
    window.handleOutsideClick = handleOutsideClick;

    if (xlp.setupEventListenersFromConfig) {
        xlp.setupEventListenersFromConfig('launchlist');
    } else {
        xlp.addTrackedEventListener(iconCircle, 'click', handleIconClick, 'launchlist');
        xlp.addTrackedEventListener(clearButton, 'click', clearSearch, 'launchlist');
        xlp.addTrackedEventListener(searchInput, 'input', handleInput, 'launchlist');
        xlp.addTrackedEventListener(searchInput, 'keydown', handleKeydown, 'launchlist');
        xlp.addTrackedEventListener(searchInput, 'focus', resetShrinkTimeout, 'launchlist');
        xlp.addTrackedEventListener(document, 'click', handleOutsideClick, 'launchlist');
    }

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
//   Configures and manages all table interaction event handlers
//   Sets up scroll snapping, double click delegation, and event listeners from configuration
function setupTableEvents() {
    const tabContent = xlp.getElement('tabContent') || window[window.domCacheName]?.tabContent;
    
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
        window.handleScrollEnd = handleScrollEnd;
    }
    
    if (xlp.setupEventListenersFromConfig) {
        xlp.setupEventListenersFromConfig('launchlist');
    } else {
        const table = xlp.getElement('appTable');
        const tabContent = xlp.getElement('tabContent') || window[window.domCacheName]?.tabContent;
        
        if (table) {
            xlp.addTrackedEventDelegation(table, 'dblclick', '.table-row', handleRowDoubleClick, 'launchlist');
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
            xlp.addTrackedEventListener(tabContent, 'scroll', handleScrollEnd, 'launchlist');
        }
    }
}

// Initialize Launch Timer
//   Sets up and executes complete launch countdown sequence
//   Displays countdown dialog, launches app, updates recent apps, and closes dialog after countdown
export function startLaunchCountdown() {
    const dialog = xlp.getElement('launchDialog') || window[window.domCacheName]?.launchDialog;
    const countdownElement = dialog?.querySelector('#countdown');
    const appNameElement = dialog?.querySelector('#appName');
    
    if (!dialog || !countdownElement || !appNameElement) {
        return;
    }

    const selectedApp = window.selectedApp;
    if (!selectedApp) {
        return;
    }

    appNameElement.textContent = selectedApp;
    let countdown = 5;
    countdownElement.textContent = `in ${countdown} seconds`;

    xlp.updateRecentApps(selectedApp);
    e.Api.invoke('launch-app', selectedApp).catch(() => {});
    
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

// Process Favorite Changes
//   Handles and synchronizes all favorite status modifications
//   Toggles favorite status, saves to xldbf.json, and repositions row in table
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

// Cleanup Launch System
//   Performs complete cleanup of launch list functionality
//   Removes event listeners, clears search handlers, and resets module state
export async function cleanupLaunchlist() {
    const table = document.querySelector('#appTable');
    if (table) {
        table.removeEventListener('dblclick', handleRowDoubleClick);
    }
    
    const tabContent = xlp.getElement('tabContent');
    if (tabContent && tabContent.scrollHandler) {
        tabContent.removeEventListener('scroll', tabContent.scrollHandler);
        tabContent.scrollHandler = null;
    }

    if (searchHandlers) {
        const searchInput = xlp.getElement('searchInput') || window[window.domCacheName]?.searchInput;
        const clearButton = window[window.domCacheName]?.clearButton || document.querySelector('.clear-button');
        const iconCircle = window[window.domCacheName]?.iconCircle || document.querySelector('.icon-circle');
        
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
    
    if (window.domCacheName && window[window.domCacheName]) {
        delete window[window.domCacheName];
    }
    delete window.domCacheName;
}