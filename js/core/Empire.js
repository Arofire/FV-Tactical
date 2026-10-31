// Empire management system
class Empire {
    constructor() {
        this.name = 'New Empire';
        this.techPoints = 1000; // Starting tech points for testing
        this.researchedTech = new Set();
        this.availableTech = new Set();
        this.economyMode = 'skirmish';
        this.campaignCostRules = {
            categories: {
                weapons: 'materiel',
                equipment: 'materiel',
                munitions: 'materiel',
                systems: 'industry',
                hulls: 'industry',
                technology: 'industry',
                features: 'split',
                roles: 'split',
                general: 'split'
            },
            items: {}
        };
        this.fleetShips = [];
        this.taskForces = [];

        this.designs = {
            ships: [],
            craft: [],
            troops: [],
            munitions: [],
            powerplants: []
        };
        // Initialize available technologies asynchronously
        this.initialized = this.initialize();
    }

    async initialize() {
        console.log('Empire: Starting initialization...');
        await this.initializeAvailableTech();
        console.log('Empire: Available tech initialized');

        // Auto-unlock (research) any technologies that have zero cost and no required tech
        // These represent baseline starting capabilities the player should always have.
        const allTech = await TechTree.getAllTech();
        for (const [techId, tech] of allTech) {
            if (tech.cost === 0 && tech.requiredTech.length === 0 && !tech.requiredEmpireTier) {
                // Add directly to researched if not already
                if (!this.researchedTech.has(techId)) {
                    this.researchedTech.add(techId);
                    // Ensure they're not listed as merely available
                    this.availableTech.delete(techId);
                }
            }
        }

        // After auto-unlock, update availability for next tier
        await this.updateAvailableTech();
    }
    
    // Initialize technologies that have no required tech
    async initializeAvailableTech() {
        const allTech = await TechTree.getAllTech();
        for (const [techId, tech] of allTech) {
            if (tech.requiredTech.length === 0 && !tech.requiredEmpireTier) {
                this.availableTech.add(techId);
            }
        }
    }

    // Research a technology
    async researchTech(techId) {
        if (this.availableTech.has(techId) && !this.researchedTech.has(techId)) {
            const tech = await TechTree.getTech(techId);
            if (tech && this.techPoints >= tech.cost) {
                this.techPoints -= tech.cost;
                this.researchedTech.add(techId);
                this.availableTech.delete(techId);
                
                // Unlock new technologies
                await this.updateAvailableTech();
                
                // Trigger events
                await this.onTechResearched(techId);
                return true;
            }
        }
        return false;
    }

    // Update available technologies based on research
    async updateAvailableTech() {
        const allTech = await TechTree.getAllTech();
        for (const [techId, tech] of allTech) {
            if (!this.researchedTech.has(techId) && !this.availableTech.has(techId)) {
                const requiredTechMet = tech.requiredTech.every(id => this.researchedTech.has(id));
                // Empire tier is not tracked yet, so requiredEmpireTier is treated as met

                if (requiredTechMet) {
                    this.availableTech.add(techId);
                }
            }
        }
    }

    // Check if technology is available for use
    hasTech(techId) {
        return this.researchedTech.has(techId);
    }

    // Check if technology is available for research
    canResearch(techId) {
        return this.availableTech.has(techId);
    }

    // Add a design to the empire
    addDesign(type, design) {
        if (this.designs[type]) {
            design.id = this.generateDesignId(type);
            this.designs[type].push(design);
            this.onDesignAdded(type, design);
        }
    }

    // Remove a design from the empire
    removeDesign(type, designId) {
        if (this.designs[type]) {
            const index = this.designs[type].findIndex(d => d.id === designId);
            if (index !== -1) {
                const design = this.designs[type].splice(index, 1)[0];
                this.onDesignRemoved(type, design);
                return design;
            }
        }
        return null;
    }

    // Generate unique design ID
    generateDesignId(type) {
        const existing = this.designs[type].map(d => d.id);
        let id = 1;
        while (existing.includes(`${type}-${id}`)) {
            id++;
        }
        return `${type}-${id}`;
    }

    // --- Fleet management --------------------------------------------------

    addTaskForce(name = '') {
        const taskForce = {
            id: `task-force-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: name || `Task Force ${this.taskForces.length + 1}`
        };
        this.taskForces.push(taskForce);
        return taskForce;
    }

    removeTaskForce(taskForceId) {
        const index = this.taskForces.findIndex(force => force.id === taskForceId);
        if (index === -1) return null;
        const removed = this.taskForces.splice(index, 1)[0];
        for (const ship of this.fleetShips) {
            if (ship.taskForceId === taskForceId) this.assignFleetShip(ship.id, null);
        }
        return removed;
    }

    getTaskForceShips(taskForceId) {
        return this.fleetShips.filter(ship => ship.taskForceId === taskForceId)
            .sort((first, second) => first.taskForceOrder - second.taskForceOrder);
    }

    assignFleetShip(shipId, taskForceId) {
        return this.assignFleetShips([shipId], taskForceId)[0];
    }

    assignFleetShips(shipIds, taskForceId) {
        if (!Array.isArray(shipIds) || !shipIds.length ||
            shipIds.some(id => typeof id !== 'string' || !id)) {
            throw new Error('Select ships to assign.');
        }
        const ships = [...new Set(shipIds)].map(id => {
            const ship = this.fleetShips.find(entry => entry.id === id);
            if (!ship) throw new Error(`Ship "${id}" does not exist.`);
            return ship;
        });
        const destination = taskForceId || null;
        if (destination && !this.taskForces.some(force => force.id === destination)) {
            throw new Error(`Task force "${destination}" does not exist.`);
        }
        const transfers = ships.filter(ship => ship.taskForceId !== destination);
        if (!transfers.length) return ships;
        let nextOrder = this.getNextTaskForceOrder(destination);
        if (!Number.isSafeInteger(nextOrder + transfers.length - 1)) {
            throw new Error('Task-force membership order exceeds its limit.');
        }
        for (const ship of transfers) {
            ship.taskForceOrder = nextOrder++;
            ship.taskForceId = destination;
        }
        return ships;
    }

    getNextTaskForceOrder(taskForceId) {
        const next = this.fleetShips.filter(ship => ship.taskForceId === taskForceId)
            .reduce((maximum, ship) => Math.max(maximum, ship.taskForceOrder), -1) + 1;
        if (!Number.isSafeInteger(next)) throw new Error('Task-force membership order exceeds its limit.');
        return next;
    }

    addFleetShip(ship) {
        const taskForceId = ship.taskForceId || null;
        if (taskForceId && !this.taskForces.some(force => force.id === taskForceId)) {
            throw new Error(`Task force "${taskForceId}" does not exist.`);
        }
        if (ship.contents && Object.hasOwn(ship.contents, 'hardpoints')) {
            throw new Error('Direct hardpoint contents are not part of the current ship format.');
        }
        this.fleetShips.push({
            id: ship.id || `fleet-ship-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            classWidgetId: ship.classWidgetId ?? '',
            outfitWidgetId: ship.outfitWidgetId ?? '',
            loadoutWidgetId: ship.loadoutWidgetId ?? '',
            name: ship.name ?? '',
            role: ship.role ?? '',
            taskForceId,
            taskForceOrder: this.getNextTaskForceOrder(taskForceId),
            contents: {
                berths: ship.contents?.berths ?? [],
                magazine: ship.contents?.magazine ?? [],
                hangar: ship.contents?.hangar ?? [],
                hardpointLoadout: {
                    devices: ship.contents?.hardpointLoadout?.devices ?? [],
                    weapons: ship.contents?.hardpointLoadout?.weapons ?? []
                }
            },
            stores: {
                cargo: Math.max(0, Number(ship.stores?.cargo) || 0),
                remass: Math.max(0, Number(ship.stores?.remass) || 0)
            }
        });
        return this.fleetShips[this.fleetShips.length - 1];
    }

    removeFleetShip(shipId) {
        const index = this.fleetShips.findIndex(ship => ship.id === shipId);
        return index === -1 ? null : this.fleetShips.splice(index, 1)[0];
    }

    // Event handlers
    async onTechResearched(techId) {
        // Update UI
        if (window.app) {
            await window.app.updateTechTree();
            window.app.updateEmpireDisplay();
            window.app.runPreflightCheck();
        }
    }

    onDesignAdded(type, design) {
        if (window.app) {
            window.app.runPreflightCheck();
        }
    }

    onDesignRemoved(type, design) {
        if (window.app) {
            window.app.runPreflightCheck();
        }
    }

    // Serialization
    toJSON() {
        return {
            name: this.name,
            techPoints: this.techPoints,
            researchedTech: Array.from(this.researchedTech),
            availableTech: Array.from(this.availableTech),
            economyMode: this.economyMode,
            campaignCostRules: this.campaignCostRules,
            fleetShips: this.fleetShips,
            taskForces: this.taskForces,
            designs: this.designs
        };
    }

    // Deserialization
    fromJSON(data) {
        for (const ship of data.fleetShips || []) {
            if (!Number.isSafeInteger(ship.taskForceOrder) || ship.taskForceOrder < 0 ||
                !ship.contents || Object.hasOwn(ship.contents, 'hardpoints')) {
                throw new Error('Fleet ships must use the current contents and task-force ordering format.');
            }
        }
        this.name = data.name || 'New Empire';
        this.techPoints = data.techPoints || 0;
        this.researchedTech = new Set(data.researchedTech || []);
        this.availableTech = new Set(data.availableTech || ['basic-hull', 'basic-engine', 'basic-weapon']);
        this.economyMode = data.economyMode === 'campaign' ? 'campaign' : 'skirmish';
        this.campaignCostRules = {
            categories: {
                ...this.campaignCostRules.categories,
                ...(data.campaignCostRules?.categories || {})
            },
            items: { ...(data.campaignCostRules?.items || {}) }
        };
        this.taskForces = Array.isArray(data.taskForces)
            ? data.taskForces
                .filter(force => force && typeof force === 'object')
                .map(force => ({
                    id: force.id || `task-force-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    name: force.name ?? 'Task Force'
                }))
            : [];

        const normalizeContentEntries = entries => Array.isArray(entries)
            ? entries
                .filter(entry => entry && typeof entry === 'object')
                .map(entry => ({ ...entry, count: Math.max(0, Number(entry.count) || 0) }))
            : [];

        this.fleetShips = Array.isArray(data.fleetShips)
            ? data.fleetShips
                .filter(ship => ship && typeof ship === 'object')
                .map(ship => ({
                    id: ship.id,
                    classWidgetId: ship.classWidgetId ?? '',
                    outfitWidgetId: ship.outfitWidgetId ?? '',
                    loadoutWidgetId: ship.loadoutWidgetId ?? '',
                    name: ship.name ?? '',
                    role: ship.role ?? '',
                    taskForceId: ship.taskForceId ?? null,
                    taskForceOrder: ship.taskForceOrder,
                    contents: {
                        berths: normalizeContentEntries(ship.contents?.berths),
                        magazine: normalizeContentEntries(ship.contents?.magazine),
                        hangar: normalizeContentEntries(ship.contents?.hangar),
                        hardpointLoadout: {
                            devices: Array.isArray(ship.contents?.hardpointLoadout?.devices)
                                ? ship.contents.hardpointLoadout.devices
                                    .filter(entry => entry && typeof entry === 'object')
                                    .map(entry => ({
                                        instanceId: String(entry.instanceId || ''),
                                        deviceId: String(entry.deviceId || ''),
                                        contents: normalizeContentEntries(entry.contents)
                                    }))
                                : [],
                            weapons: normalizeContentEntries(ship.contents?.hardpointLoadout?.weapons)
                                .map(entry => ({
                                    ...entry,
                                    weaponId: String(entry.weaponId),
                                    arc: String(entry.arc || 'F').toUpperCase()
                                }))
                        }
                    },
                    stores: {
                        cargo: Math.max(0, Number(ship.stores?.cargo) || 0),
                        remass: Math.max(0, Number(ship.stores?.remass) || 0)
                    }
                }))
            : [];

        this.designs = data.designs || {
            ships: [],
            craft: [],
            troops: [],
            munitions: [],
            powerplants: []
        };
    }

    // Get missing required tech for all designs
    getRequiredTech() {
        const requirements = new Set();
        
        for (const [type, designs] of Object.entries(this.designs)) {
            for (const design of designs) {
                if (design.components) {
                    for (const component of design.components) {
                        if (component.requiredTech) {
                            for (const tech of component.requiredTech) {
                                const hasIgnoreTech = design.ignoreRequiredTech || false;
                                if (!hasIgnoreTech && !this.hasTech(tech)) {
                                    requirements.add({
                                        tech: tech,
                                        design: design.name,
                                        component: component.name,
                                        type: type
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return Array.from(requirements);
    }
}