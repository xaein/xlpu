// Database Control Module
// Manages application database categories and entries

// Module state variables
window.currentCategory = null;
window.categories = [];
window.selectedRow = null;
window.tempData = {};

// Initialize Database Control
// Sets up all database interface components and event handlers
export async function initializeDatabasecontrol() {
    try {
        window.xldbv = xlp.getData('xldbv') || {};
        window.xldbf = xlp.getData('xldbf') || {};
        const preloadedData = xlp.getData('preloadedData') || {};
        window.tempData = JSON.parse(JSON.stringify(preloadedData));
        
        setupTempDataProxy();
        
        if (!Array.isArray(window.xldbv.xldbFiles)) {
            window.xldbv.xldbFiles = [];
        }
        
        const controlPanel = document.getElementById('controlPanel');
        if (controlPanel) {
            controlPanel.addEventListener('click', function(event) {
                const target = event.target.closest('button');
                if (!target) return;
                
                switch (target.id) {
                    case 'addCategoryButton':
                        xlp.showDialog('databasecontrolcatadd');
                        break;
                    case 'renameCategoryButton':
                        xlp.showDialog('databasecontrolcatrename');
                        break;
                    case 'removeCategoryButton':
                        xlp.showDialog('databasecontrolcatremove');
                        break;
                    
                    case 'addRowButton':
                        xlp.showDialog('databasecontrolrowadd');
                        break;
                    case 'editRowButton':
                        xlp.showDialog('databasecontrolrowedit');
                        break;
                    case 'removeRowButton':
                        xlp.confirmRowRemove();
                        break;
                }
            });
        }
        
        const tabList = document.getElementById('tabList');
        if (tabList) {
            tabList.addEventListener('click', function(event) {
                const target = event.target.closest('.tablinks');
                if (!target) return;
                
                const categoryName = target.getAttribute('data-category');
                if (categoryName) {
                    selectTab(categoryName, { currentTarget: target });
                }
            });
        }
        
        const appTable = document.getElementById('appTable');
        if (appTable) {
            appTable.addEventListener('click', function(event) {
                const row = event.target.closest('.table-row');
                if (!row || row.classList.contains('empty-row')) return;
                
                const appCell = row.querySelector('.app-column');
                const commandCell = row.querySelector('.command-column');
                if (!appCell || !commandCell) return;
                
                const appName = appCell.textContent;
                const command = commandCell.textContent;
                const rowData = `${appName},${command}`;
                
                document.querySelectorAll('#appTable .table-row').forEach(r => {
                    r.classList.remove('selected');
                });
                
                row.classList.add('selected');
                window.selectedRow = rowData;
                
                updateEditButtonState();
                xlp.updateGreenButtonState();
            });
        }
        
        loadTabButtons();
        
        updateEditButtonState();
        xlp.updateGreenButtonState();
        
        window.addEventListener('resize', () => xlp.handleResize());
        
        setupTableScrollSnapping();
        
        xlp.verifyAndSetSection();
    } catch (error) { }
}

// Create Tab Buttons
// Generates and configures category tab buttons in navigation panel
function loadTabButtons(newCategoryName = null) {
    const tabList = document.getElementById('tabList');
    const addRowButton = document.getElementById('addRowButton');
    const renameCategoryButton = document.getElementById('renameCategoryButton');
    const removeCategoryButton = document.getElementById('removeCategoryButton');

    if (!window.xldbv || !window.xldbv.xldbFiles || !Array.isArray(window.xldbv.xldbFiles)) {
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
        const button = document.createElement('button');
        button.className = 'tablinks';
        button.textContent = categoryName;
        button.setAttribute('data-category', categoryName);
        tabList.appendChild(button);

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
    if (addRowButton) addRowButton.disabled = !hasCategories;
    if (renameCategoryButton) renameCategoryButton.disabled = !hasCategories;
    if (removeCategoryButton) removeCategoryButton.disabled = !hasCategories;
}

// Handle Tab Selection
// Updates active tab and loads corresponding category data
export function selectTab(categoryName, event) {
    document.querySelectorAll('.tablinks').forEach(tab => {
        tab.classList.remove('active');
    });
    event.currentTarget.classList.add('active');

    window.currentCategory = categoryName;
    loadFileData(`${categoryName}.xlfc`);
}

// Load File Content
// Retrieves and displays database entries from selected file
function loadFileData(fileName) {
    const fileData = window.tempData[fileName];
    
    if (!fileData) {
        return;
    }

    try {
        xlp.createDatabaseTable();
        updateEditButtonState();
        xlp.updateGreenButtonState();
    } catch (error) { }
}

// Update Button States
// Enables or disables edit buttons based on row selection
export function updateEditButtonState() {
    const editButton = document.getElementById('editRowButton');
    const removeButton = document.getElementById('removeRowButton');
    
    if (!editButton || !removeButton) return;
    
    const isRowSelected = window.selectedRow !== undefined && window.selectedRow !== null;
    
    editButton.disabled = !isRowSelected;
    removeButton.disabled = !isRowSelected;
}

// Setup Data Proxy
// Creates proxy object to track changes in temporary data
function setupTempDataProxy() {
    window.tempData = new Proxy(window.tempData || {}, {
        set: function(target, property, value) {
            target[property] = value;
            xlp.updateGreenButtonState();
            return true;
        }
    });
}

// Configure Table Scrolling
// Implements smooth scrolling behavior for database table rows
function setupTableScrollSnapping() {
    const scrollContainer = document.querySelector('.table-scroll-container');
    if (!scrollContainer) return;
    
    let lastScrollTop = 0;
    
    const handleScrollEnd = xlp.debounce(function() {
        const { scrollTop, rowHeight, currentRow } = xlp.getTableScrollPosition() || {};
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

// Cleanup Database Control
// Removes all event listeners and resets module state
export async function cleanupDatabasecontrol() {
    const containers = [
        document.querySelector('.category-buttons-container') || document.getElementById('tabContainer'),
        document.querySelector('.row-buttons-container') || document.getElementById('tableControls'),
        document.getElementById('tabList'),
        document.getElementById('appTable')
    ];
    
    containers.forEach(container => {
        if (container && container.parentNode) {
            const clone = container.cloneNode(true);
            container.parentNode.replaceChild(clone, container);
        }
    });
    
    const tableContainer = document.getElementById('tableContainer');
    if (tableContainer && tableContainer.scrollHandler) {
        tableContainer.removeEventListener('scroll', tableContainer.scrollHandler);
        tableContainer.scrollHandler = null;
    }
    
    window.removeEventListener('resize', () => xlp.handleResize());
    
    const tabList = document.getElementById('tabList');
    if (tabList) {
        tabList.innerHTML = '';
    }
    
    const tableBody = document.querySelector('#appTable tbody');
    if (tableBody) {
        tableBody.innerHTML = '';
    }
    
    window.currentCategory = null;
    window.categories = [];
    window.selectedRow = null;
    window.tempData = null;
} 
