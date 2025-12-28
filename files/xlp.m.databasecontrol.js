// Database Control Module
//   Manages application database categories and entries
//   Handles category management, row operations, and table display
//   Provides database editing interface with add, edit, and remove functionality
//   Manages temporary data state and change tracking for database operations

// Module state variables
//   Tracks current category, category list, selected row, and temporary data
//   Manages database control state including active category, available categories, selected row, and unsaved changes
window.currentCategory = null;
window.categories = [];
window.selectedRow = null;
window.tempData = {};

// Initialize Database Control
//   Sets up all database interface components and event handlers
//   Initializes DOM cache, loads data, sets up event listeners, and configures UI elements
export async function initializeDatabasecontrol() {
    try {
        initializeDatabasecontrolDomCache();
        
        window.xldbv = xlp.getData('xldbv') ?? {};
        window.xldbf = xlp.getData('xldbf') ?? {};
        const preloadedData = xlp.getData('preloadedData') ?? {};
        window.tempData = JSON.parse(JSON.stringify(preloadedData));
        
        setupTempDataProxy();
        
        if (!Array.isArray(window.xldbv.xldbFiles)) {
            window.xldbv.xldbFiles = [];
        }
        
        if (xlp.setupEventListenersFromConfig) {
            xlp.setupEventListenersFromConfig('databasecontrol');
        }
        
        loadTabButtons();
        
        updateEditButtonState();
        xlp.updateGreenButtonState();
        
        setupTableScrollSnapping();
        
        xlp.verifyAndSetSection();
    } catch (error) {
        xlp.silentError();
    }
}

// Create Single Tab Button
//   Creates and configures a single category tab button element
//   Sets button text, class, and data attributes before appending to tab list
function createTabButton(categoryName, tabList) {
    const button = document.createElement('button');
    button.className = 'tablinks';
    button.textContent = categoryName;
    button.setAttribute('data-category', categoryName);
    tabList.appendChild(button);
    return button;
}

// Initialize DOM Cache
//   Creates cached DOM element references for databasecontrol section
//   Stores element references in window object for faster access throughout the module
function initializeDatabasecontrolDomCache() {
    const section = xlp.sections.databasecontrol;
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

// Load File Content
//   Retrieves and displays database entries from selected file
//   Parses file data from tempData and renders table with entries, updates button states
function loadFileData(fileName) {
    const fileData = window.tempData[fileName];
    
    if (!fileData) {
        return;
    }

    try {
        xlp.createDatabaseTable();
        updateEditButtonState();
        xlp.updateGreenButtonState();
    } catch (error) {
        xlp.silentError();
    }
}

// Create Tab Buttons
//   Generates and configures category tab buttons in navigation panel
//   Creates buttons for each database file, handles initial tab selection, and updates button states
function loadTabButtons(newCategoryName = null) {
    const tabList = xlp.getElement('tabList') || window[window.domCacheName]?.tabList;

    if (!window.xldbv || !window.xldbv.xldbFiles || !Array.isArray(window.xldbv.xldbFiles)) {
        updateCategoryButtonStates(false);
        return;
    }

    if (!tabList) {
        return;
    }

    while (tabList.firstChild) {
        tabList.removeChild(tabList.firstChild);
    }

    let newTabButton = null;

    window.xldbv.xldbFiles.forEach((fileName, index) => {
        const categoryName = fileName.replace('.xlfc', '');
        const button = createTabButton(categoryName, tabList);

        if (categoryName === newCategoryName) {
            newTabButton = button;
        }

        if (index === 0 && !newCategoryName && !document.querySelector('.tablinks.active')) {
            selectTab(categoryName, { currentTarget: button });
        }
    });

    if (newCategoryName && newTabButton) {
        selectTab(newCategoryName, { currentTarget: newTabButton });
    }

    const hasCategories = window.xldbv.xldbFiles.length > 0;
    updateCategoryButtonStates(hasCategories);
}

// Handle Tab Selection
//   Updates active tab and loads corresponding category data
//   Removes active class from all tabs, sets new active tab, and loads file data for selected category
export function selectTab(categoryName, event) {
    xlp.getElement('dqa', '.tablinks').forEach(tab => {
        tab.classList.remove('active');
    });
    event.currentTarget.classList.add('active');

    window.currentCategory = categoryName;
    loadFileData(`${categoryName}.xlfc`);
}

// Configure Table Scrolling
//   Implements smooth scrolling behavior for database table rows
//   Adds debounced scroll handler that snaps to nearest row boundary for better UX
function setupTableScrollSnapping() {
    const scrollContainer = xlp.getElement('dqs', '.table-scroll-container');
    if (!scrollContainer) return;
    
    let lastScrollTop = 0;
    
    const handleScrollEnd = xlp.debounce(function() {
        const { scrollTop, rowHeight, currentRow } = xlp.getTableScrollPosition() ?? {};
        if (!scrollTop || !rowHeight) return;
        
        const scrollingDown = scrollTop > lastScrollTop;
        lastScrollTop = scrollTop;
        
        const targetRow = scrollingDown 
            ? Math.ceil(scrollTop / rowHeight)
            : Math.floor(scrollTop / rowHeight);
        
        const targetScroll = targetRow * rowHeight;
        
        if (Math.abs(scrollTop - targetScroll) > 1) {
            scrollContainer.scrollTo({
                top: targetScroll,
                behavior: 'smooth'
            });
        }
    }, 150);
    
    scrollContainer.scrollHandler = handleScrollEnd;
    scrollContainer.addEventListener('scroll', handleScrollEnd);
}

// Setup Data Proxy
//   Creates proxy object to track changes in temporary data
//   Wraps tempData in Proxy to automatically update green button state when data changes
function setupTempDataProxy() {
    window.tempData = new Proxy(window.tempData ?? {}, {
        set: function(target, property, value) {
            target[property] = value;
            xlp.updateGreenButtonState();
            return true;
        }
    });
}

// Update Category Button States
//   Enables or disables category-related buttons based on category availability
//   Controls add, rename, and remove category button states when no categories exist
export function updateCategoryButtonStates(hasCategories) {
    const addRowButton = xlp.getElement('addRowButton') || window[window.domCacheName]?.addRowButton;
    const renameCategoryButton = xlp.getElement('renameCategoryButton') || window[window.domCacheName]?.renameCategoryButton;
    const removeCategoryButton = xlp.getElement('removeCategoryButton') || window[window.domCacheName]?.removeCategoryButton;
    
    if (addRowButton) addRowButton.disabled = !hasCategories;
    if (renameCategoryButton) renameCategoryButton.disabled = !hasCategories;
    if (removeCategoryButton) removeCategoryButton.disabled = !hasCategories;
}

// Update Button States
//   Enables or disables edit buttons based on row selection
//   Checks if a row is selected and updates edit and remove button disabled states accordingly
export function updateEditButtonState() {
    const editButton = xlp.getElement('editRowButton') || window[window.domCacheName]?.editRowButton;
    const removeButton = xlp.getElement('removeRowButton') || window[window.domCacheName]?.removeRowButton;
    
    if (!editButton || !removeButton) return;
    
    const selectedRow = window.selectedRow;
    const isRowSelected = selectedRow !== undefined && selectedRow !== null;
    
    editButton.disabled = !isRowSelected;
    removeButton.disabled = !isRowSelected;
}

// Cleanup Database Control
//   Removes all event listeners and resets module state
//   Clears tracked listeners, removes scroll handlers, empties DOM elements, and resets window variables
export async function cleanupDatabasecontrol() {
    if (xlp.removeTrackedEventListeners) {
        xlp.removeTrackedEventListeners('databasecontrol');
    }
    
    const tableContainer = xlp.getElement('tableContainer') || window[window.domCacheName]?.tableContainer;
    if (tableContainer && tableContainer.scrollHandler) {
        tableContainer.removeEventListener('scroll', tableContainer.scrollHandler);
        tableContainer.scrollHandler = null;
    }
    
    const tabList = xlp.getElement('tabList') || window[window.domCacheName]?.tabList;
    if (tabList) {
        tabList.innerHTML = '';
    }
    
    const tableBody = xlp.getElement('dqs', '#appTable tbody');
    if (tableBody) {
        tableBody.innerHTML = '';
    }
    
    window.currentCategory = null;
    window.categories = [];
    window.selectedRow = null;
    window.tempData = {};
    
    if (window.domCacheName && window[window.domCacheName]) {
        delete window[window.domCacheName];
    }
    delete window.domCacheName;
}
