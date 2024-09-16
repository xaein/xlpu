// Pagination-related functions

// Adjust pagination after resize
// Recalculates pagination and current page after window resize
function adjustPaginationAfterResize(isEditPage) {
    const { mainRowsPerPage, editRowsPerPage } = js.F.getRowVariables();
    const rowsPerPage = isEditPage ? editRowsPerPage : mainRowsPerPage;
    const totalRows = window.rows.length;
    const newTotalPages = Math.max(Math.ceil(totalRows / rowsPerPage), 1);

    if (currentPage > newTotalPages) {
        currentPage = newTotalPages;
    }
    js.F.goToPage(currentPage, isEditPage);
}

// Navigate to a specific page
// Handles page navigation and updates the table and pagination accordingly
function goToPage(page, isEditPage, filteredRows) {
    const { mainRowsPerPage, editRowsPerPage } = js.F.getRowVariables();
    const rowsPerPage = isEditPage ? editRowsPerPage : mainRowsPerPage;

    if (page < 1 || page > totalPages) {
        return;
    }

    currentPage = page;

    const rowsCreated = js.F.createTable(currentPage, rowsPerPage, isEditPage, filteredRows);
    if (rowsCreated.length > 0 || currentPage === 1) {
        js.F.updatePagination(isEditPage, filteredRows);
        if (typeof js.F.checkSelectedAppVisibility === 'function') {
            js.F.checkSelectedAppVisibility();
        }
    }
}

// Update pagination UI
// Updates pagination based on the current page and rows per page
function updatePagination(isEditPage, filteredRows) {
    const { mainRowsPerPage, editRowsPerPage } = js.F.getRowVariables();
    const rowsPerPage = isEditPage ? editRowsPerPage : mainRowsPerPage;

    const rowsToUse = filteredRows || window.rows;

    if (!Array.isArray(rowsToUse)) {
        return;
    }

    totalPages = Math.max(Math.ceil(rowsToUse.length / rowsPerPage), 1);

    let paginationHTML = '';

    for (let i = 1; i <= totalPages; i++) {
        paginationHTML += `<button id="pageBtnNumber${i}" onclick="js.F.goToPage(${i}, ${isEditPage})" ${currentPage === i ? 'disabled' : ''}>${i}</button>`;
    }

    const pageButtons = document.getElementById('pageButtons');
    if (pageButtons) {
        pageButtons.innerHTML = paginationHTML;
    }

    const buttons = {
        First: document.getElementById('pageBtnFirst'),
        Prev: document.getElementById('pageBtnPrev'),
        Next: document.getElementById('pageBtnNext'),
        Last: document.getElementById('pageBtnLast')
    };

    if (buttons.First && buttons.Prev && buttons.Next && buttons.Last) {
        buttons.First.disabled = currentPage === 1;
        buttons.Prev.disabled = currentPage === 1;
        buttons.Next.disabled = currentPage === totalPages;
        buttons.Last.disabled = currentPage === totalPages;

        buttons.First.setAttribute('onclick', `js.F.goToPage(1, ${isEditPage})`);
        buttons.Prev.setAttribute('onclick', `js.F.goToPage(${currentPage - 1}, ${isEditPage})`);
        buttons.Next.setAttribute('onclick', `js.F.goToPage(${currentPage + 1}, ${isEditPage})`);
        buttons.Last.setAttribute('onclick', `js.F.goToPage(${totalPages}, ${isEditPage})`);
    }
}

// Export pagination functions
window.paginationFunctions = {
    adjustPaginationAfterResize,
    goToPage,
    updatePagination
};