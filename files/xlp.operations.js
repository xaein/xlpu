// Operation Configuration
//   Defines handlers for database and other operations
//   Provides configuration objects for database operations and variable updates
//   Maps operation types to their handler functions and execution patterns
//   Centralizes operation configuration and handler management

// Database Operation Configuration
//   Defines handlers for database category operations
//   Maps operation types to handler functions for add, rename, and remove category operations
export const databaseOperationConfig = {
    addCategory: {
        handler: (xldbv, data) => {
            if (!xldbv.xldbFiles.includes(data)) {
                xldbv.xldbFiles.push(data);
            }
        }
    },
    renameCategory: {
        handler: (xldbv, data) => {
            const index = xldbv.xldbFiles.indexOf(data.oldFileName);
            if (index !== -1) {
                xldbv.xldbFiles[index] = data.newFileName;
            }
        }
    },
    removeCategory: {
        handler: (xldbv, data) => {
            xldbv.xldbFiles = xldbv.xldbFiles.filter(file => file !== data);
        }
    }
};

