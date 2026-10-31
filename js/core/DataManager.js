// Data management system for saving/loading empire data
class DataManager {
    constructor() {
        this.storageKey = 'fv-tactical-empire';
        this.fileVersion = '2.1';
    }

    // Save empire data to localStorage
    saveToLocalStorage(empire, widgets, connections) {
        try {
            const data = this.serializeEmpireData(empire, widgets, connections);
            localStorage.setItem(this.storageKey, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
            return false;
        }
    }

    // Load empire data from localStorage
    loadFromLocalStorage() {
        const data = localStorage.getItem(this.storageKey);
        return data ? this.deserializeEmpireData(JSON.parse(data)) : null;
    }

    // Export empire data as JSON file
    exportToFile(empire, widgets, connections) {
        try {
            const data = this.serializeEmpireData(empire, widgets, connections);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `${empire.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_empire.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            return true;
        } catch (error) {
            console.error('Failed to export to file:', error);
            return false;
        }
    }

    // Import empire data from JSON file
    importFromFile(file) {
        return new Promise((resolve, reject) => {
            if (!file || file.type !== 'application/json') {
                reject(new Error('Invalid file type. Please select a JSON file.'));
                return;
            }

            // Check file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                reject(new Error('File too large. Maximum size is 10MB.'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const jsonData = JSON.parse(e.target.result);
                    
                    const data = this.deserializeEmpireData(jsonData);
                    resolve(data);
                } catch (error) {
                    reject(new Error(`Failed to process import file: ${error.message}`));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file.'));
            };
            
            reader.readAsText(file);
        });
    }

    // Serialize all empire data
    serializeEmpireData(empire, widgets, connections) {
        const widgetsData = [];
        const roleLists = {};
        if (widgets) {
            for (const widget of widgets.values()) {
                widgetsData.push(widget.toJSON());
                if (widget.type === 'ship' && Array.isArray(widget.availableRoles)) {
                    roleLists.ship = [...widget.availableRoles];
                } else if (widget.type === 'outfit' && Array.isArray(widget.availableRoles)) {
                    roleLists.outfit = [...widget.availableRoles];
                }
            }
        }
        if (!Array.isArray(roleLists.ship) && typeof ShipWidget !== 'undefined') {
            roleLists.ship = ShipWidget.loadStoredRoles(ShipWidget.getDefaultRoles());
        }
        if (!Array.isArray(roleLists.outfit) && typeof OutfitWidget !== 'undefined') {
            roleLists.outfit = OutfitWidget.loadStoredRoles(OutfitWidget.getDefaultRoles());
        }
        const hasRoleLists = Object.keys(roleLists).length > 0;

        return {
            fileVersion: this.fileVersion,
            timestamp: new Date().toISOString(),
            empire: empire.toJSON(),
            ...(hasRoleLists ? { roleLists } : {}),
            widgets: widgetsData,
            connections: connections ? connections.toJSON() : []
        };
    }

    // Deserialize empire data
    deserializeEmpireData(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('Invalid empire file: expected a JSON object.');
        }
        if (data.fileVersion !== this.fileVersion) {
            throw new Error(`Unsupported empire file version "${data.fileVersion ?? 'missing'}". Expected ${this.fileVersion}.`);
        }
        if (!this.validateImportData(data)) {
            throw new Error('Invalid empire file structure.');
        }

        return {
            empire: data.empire,
            roleLists: data.roleLists,
            widgets: data.widgets,
            connections: data.connections,
            timestamp: data.timestamp
        };
    }

    // Validate imported data structure
    validateImportData(data) {
        // Check required top-level properties
        if (typeof data !== 'object' || data === null) {
            return false;
        }

        // Check for required fields
        if (!data.empire || typeof data.empire !== 'object') {
            return false;
        }

        // Check empire data structure
        const empire = data.empire;
        if (typeof empire.name !== 'string' ||
            typeof empire.techPoints !== 'number' ||
            !Array.isArray(empire.researchedTech) ||
            !Array.isArray(empire.availableTech) ||
            !empire.designs || typeof empire.designs !== 'object' || Array.isArray(empire.designs)) {
            return false;
        }

        // Check widgets array
        if (!Array.isArray(data.widgets)) {
            return false;
        }

        // Check connections array
        if (!Array.isArray(data.connections)) {
            return false;
        }

        if (data.roleLists !== undefined &&
            (!data.roleLists || typeof data.roleLists !== 'object' || Array.isArray(data.roleLists) ||
                Object.entries(data.roleLists).some(([type, roles]) =>
                    !['ship', 'outfit'].includes(type) ||
                    !Array.isArray(roles) ||
                    roles.some(role => typeof role !== 'string')
                ))) {
            return false;
        }

        const supportedWidgetTypes = new Set([
            'ship', 'craft', 'troops', 'munitions', 'outfit', 'shipCore', 'shipLoadout', 'summary', 'hullTiles'
        ]);
        const widgetIds = new Set();
        for (const widget of data.widgets) {
            if (!widget || typeof widget !== 'object' ||
                !supportedWidgetTypes.has(widget.type) || typeof widget.id !== 'string' || !widget.id ||
                typeof widget.title !== 'string' || !Number.isFinite(widget.x) || !Number.isFinite(widget.y) ||
                !Number.isFinite(widget.width) || widget.width <= 0 ||
                !Number.isFinite(widget.height) || widget.height <= 0 ||
                typeof widget.explicitWidth !== 'boolean' || typeof widget.explicitHeight !== 'boolean' ||
                typeof widget.minimized !== 'boolean' || !Array.isArray(widget.parents) ||
                !Array.isArray(widget.children) ||
                !widget.data || typeof widget.data !== 'object' || Array.isArray(widget.data) ||
                widgetIds.has(widget.id)) {
                return false;
            }
            widgetIds.add(widget.id);
        }
        if (typeof data.timestamp !== 'string' ||
            data.connections.some(connection => !connection || typeof connection !== 'object' ||
                typeof connection.sourceNodeId !== 'string' || !connection.sourceNodeId ||
                typeof connection.targetNodeId !== 'string' || !connection.targetNodeId)) {
            return false;
        }

        if (!Array.isArray(empire.taskForces) || !Array.isArray(empire.fleetShips)) return false;
        const forceIds = new Set();
        for (const force of empire.taskForces) {
            if (!force || typeof force.id !== 'string' || !force.id ||
                typeof force.name !== 'string' || forceIds.has(force.id)) return false;
            forceIds.add(force.id);
        }
        const fleetIds = new Set();
        const membershipOrders = new Set();
        const validEntries = (entries, idField = 'id') => Array.isArray(entries) &&
            entries.every(entry => entry && typeof entry === 'object' &&
                typeof entry[idField] === 'string' && entry[idField] &&
                Number.isSafeInteger(entry.count) && entry.count >= 0);
        for (const ship of empire.fleetShips) {
            const contents = ship?.contents;
            const orderKey = JSON.stringify([ship?.taskForceId, ship?.taskForceOrder]);
            if (!ship || typeof ship.id !== 'string' || !ship.id || fleetIds.has(ship.id) ||
                typeof ship.name !== 'string' || typeof ship.role !== 'string' ||
                typeof ship.classWidgetId !== 'string' || typeof ship.outfitWidgetId !== 'string' ||
                typeof ship.loadoutWidgetId !== 'string' ||
                !(ship.taskForceId === null || forceIds.has(ship.taskForceId)) ||
                !Number.isSafeInteger(ship.taskForceOrder) || ship.taskForceOrder < 0 ||
                membershipOrders.has(orderKey) || !contents || typeof contents !== 'object' ||
                Object.hasOwn(contents, 'hardpoints') ||
                !validEntries(contents.berths) || !validEntries(contents.magazine) ||
                !validEntries(contents.hangar) || !contents.hardpointLoadout ||
                !Array.isArray(contents.hardpointLoadout.devices) ||
                !validEntries(contents.hardpointLoadout.weapons, 'weaponId') ||
                !ship.stores || !Number.isFinite(ship.stores.cargo) || ship.stores.cargo < 0 ||
                !Number.isFinite(ship.stores.remass) || ship.stores.remass < 0) return false;
            const deviceIds = new Set();
            for (const device of contents.hardpointLoadout.devices) {
                if (!device || typeof device.instanceId !== 'string' || !device.instanceId ||
                    deviceIds.has(device.instanceId) || typeof device.deviceId !== 'string' ||
                    !device.deviceId || !validEntries(device.contents)) return false;
                deviceIds.add(device.instanceId);
            }
            if (contents.hardpointLoadout.weapons.some(entry =>
                typeof entry.arc !== 'string' || !/^[FPSA]$/.test(entry.arc))) return false;
            fleetIds.add(ship.id);
            membershipOrders.add(orderKey);
        }

        return true;
    }

    // Auto-save functionality
    enableAutoSave(empire, getWidgets, getConnections, intervalMs = 300000) { // 5 minutes default
        this.autoSaveInterval = setInterval(() => {
            const widgets = getWidgets();
            const connections = getConnections();
            
            if (this.saveToLocalStorage(empire, widgets, connections)) {
                console.log('Auto-saved empire data');
                this.showAutoSaveNotification();
            }
        }, intervalMs);
    }

    disableAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    showAutoSaveNotification() {
        // Create temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #2d4a2d;
            color: #90ee90;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s;
        `;
        notification.textContent = 'Auto-saved';
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.style.opacity = '1', 10);
        
        // Remove after delay
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 2000);
    }

    // Clear all stored data
    clearStoredData() {
        try {
            localStorage.removeItem(this.storageKey);
            return true;
        } catch (error) {
            console.error('Failed to clear stored data:', error);
            return false;
        }
    }

    // Get storage usage info
    getStorageInfo() {
        try {
            const data = localStorage.getItem(this.storageKey);
            const sizeBytes = data ? new Blob([data]).size : 0;
            const sizeKB = Math.round(sizeBytes / 1024 * 100) / 100;
            
            return {
                hasData: !!data,
                sizeBytes: sizeBytes,
                sizeKB: sizeKB,
                lastModified: data ? new Date().toISOString() : null
            };
        } catch (error) {
            console.error('Failed to get storage info:', error);
            return {
                hasData: false,
                sizeBytes: 0,
                sizeKB: 0,
                lastModified: null
            };
        }
    }

    // Backup functionality
    createBackup(empire, widgets, connections) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupKey = `${this.storageKey}_backup_${timestamp}`;
        
        try {
            const data = this.serializeEmpireData(empire, widgets, connections);
            localStorage.setItem(backupKey, JSON.stringify(data));
            
            // Keep only last 5 backups
            this.cleanupOldBackups();
            
            return backupKey;
        } catch (error) {
            console.error('Failed to create backup:', error);
            return null;
        }
    }

    cleanupOldBackups() {
        try {
            const backupKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(`${this.storageKey}_backup_`)) {
                    backupKeys.push(key);
                }
            }
            
            // Sort by timestamp (newest first)
            backupKeys.sort((a, b) => {
                const timestampA = a.split('_backup_')[1];
                const timestampB = b.split('_backup_')[1];
                return timestampB.localeCompare(timestampA);
            });
            
            // Remove old backups (keep only 5)
            for (let i = 5; i < backupKeys.length; i++) {
                localStorage.removeItem(backupKeys[i]);
            }
        } catch (error) {
            console.error('Failed to cleanup old backups:', error);
        }
    }

    listBackups() {
        const backups = [];
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(`${this.storageKey}_backup_`)) {
                    const timestamp = key.split('_backup_')[1];
                    const data = localStorage.getItem(key);
                    const size = data ? new Blob([data]).size : 0;
                    
                    backups.push({
                        key: key,
                        timestamp: timestamp,
                        date: new Date(timestamp.replace(/-/g, ':')),
                        sizeBytes: size
                    });
                }
            }
            
            // Sort by date (newest first)
            backups.sort((a, b) => b.date - a.date);
        } catch (error) {
            console.error('Failed to list backups:', error);
        }
        
        return backups;
    }

    restoreFromBackup(backupKey) {
        const data = localStorage.getItem(backupKey);
        return data ? this.deserializeEmpireData(JSON.parse(data)) : null;
    }
}