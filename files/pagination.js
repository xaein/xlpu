// Pagination utility functions

// Initialize pagination state
window.pagination = {
    main: {
        currentPage: 1,
        totalPages: 1,
        rowsPerPage: window.xldbv?.rows?.main || 20
    },
    edb: {
        currentPage: 1,
        totalPages: 1,
        rowsPerPage: window.xldbv?.rows?.edit || 10
    }
};

// Update Page Layout
// Recalculates pagination and current page after window resize
function adjustPaginationAfterResize(isEditPage) {
    const state = isEditPage ? window.pagination.edb : window.pagination.main;
    const { mainRowsPerPage, editRowsPerPage } = js.F.getRowVariables();
    state.rowsPerPage = isEditPage ? editRowsPerPage : mainRowsPerPage;
    const totalRows = window.rows.length;
    const newTotalPages = Math.max(Math.ceil(totalRows / state.rowsPerPage), 1);
    
    if (state.currentPage > newTotalPages) {
        state.currentPage = newTotalPages;
    }
    
    // Clear selection on resize
    window.selectedApp = null;
    js.F.goToPage(state.currentPage, isEditPage);
}

// Change Page View
// Handles page navigation and updates the table and pagination accordingly
function goToPage(page, isEditPage, filteredRows) {
    const state = isEditPage ? window.pagination.edb : window.pagination.main;
    
    if (page < 1 || page > state.totalPages) {
        return;
    }
    
    // Clear selection when changing pages
    window.selectedApp = null;
    
    state.currentPage = page;
    const rowsCreated = js.F.createTable(state.currentPage, state.rowsPerPage, isEditPage, filteredRows);
    
    js.F.updatePagination(isEditPage, filteredRows);
    
    // Update button states after page change
    if (isEditPage) {
        js.F.updateEditButtonState();
    } else {
        js.F.updateLaunchButtonState();
    }
}

// Refresh Page Controls
// Updates pagination based on the current page and rows per page
function updatePagination(isEditPage, filteredRows) {
    const state = isEditPage ? window.pagination.edb : window.pagination.main;
    const rowsToUse = filteredRows || window.rows;
    
    if (!Array.isArray(rowsToUse)) {
        return;
    }
    
    state.totalPages = Math.max(Math.ceil(rowsToUse.length / state.rowsPerPage), 1);
    let paginationHTML = '';
    
    for (let i = 1; i <= state.totalPages; i++) {
        const isCurrentPage = state.currentPage === i;
        paginationHTML += `<button id="pageBtnNumber${i}" 
            class="page-number${isCurrentPage ? ' current' : ''}" 
            onclick="js.F.goToPage(${i}, ${isEditPage})"
            ${isCurrentPage ? 'disabled' : ''}>
            ${i}
        </button>`;
    }
    
    const pageButtons = document.getElementById('pageButtons');
    if (pageButtons) {
        pageButtons.innerHTML = paginationHTML;
        
        for (let i = 1; i <= state.totalPages; i++) {
            const button = document.getElementById(`pageBtnNumber${i}`);
            if (button) {
                const isCurrentPage = state.currentPage === i;
                button.disabled = isCurrentPage;
                if (isCurrentPage) {
                    button.classList.add('current', 'disabled');
                } else {
                    button.classList.remove('current', 'disabled');
                }
            }
        }
    }
    
    const buttons = {
        First: document.getElementById('pageBtnFirst'),
        Prev: document.getElementById('pageBtnPrev'),
        Next: document.getElementById('pageBtnNext'),
        Last: document.getElementById('pageBtnLast')
    };
    
    if (buttons.First && buttons.Prev && buttons.Next && buttons.Last) {
        const isFirstPage = state.currentPage === 1;
        const isLastPage = state.currentPage === state.totalPages;

        buttons.First.disabled = isFirstPage;
        buttons.Prev.disabled = isFirstPage;
        if (isFirstPage) {
            buttons.First.classList.add('disabled');
            buttons.Prev.classList.add('disabled');
        } else {
            buttons.First.classList.remove('disabled');
            buttons.Prev.classList.remove('disabled');
        }

        buttons.Next.disabled = isLastPage;
        buttons.Last.disabled = isLastPage;
        if (isLastPage) {
            buttons.Next.classList.add('disabled');
            buttons.Last.classList.add('disabled');
        } else {
            buttons.Next.classList.remove('disabled');
            buttons.Last.classList.remove('disabled');
        }

        buttons.First.onclick = () => !isFirstPage && js.F.goToPage(1, isEditPage);
        buttons.Prev.onclick = () => !isFirstPage && js.F.goToPage(state.currentPage - 1, isEditPage);
        buttons.Next.onclick = () => !isLastPage && js.F.goToPage(state.currentPage + 1, isEditPage);
        buttons.Last.onclick = () => !isLastPage && js.F.goToPage(state.totalPages, isEditPage);
    }
}

// Export pagination functions
window.paginationFunctions = {
    adjustPaginationAfterResize,
    goToPage,
    updatePagination
};