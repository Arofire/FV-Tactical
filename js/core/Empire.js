// Empire management system
class Empire {
    constructor() {
        this.name = 'New Empire';
        this.techPoints = 1000; // Starting tech points for testing
        this.researchedTech = new Set();
        this.availableTech = new Set();

        this.designs = {
            ships: [],
            craft: [],
            troops: [],
            missiles: [],
            loadouts: [],
            powerplants: [],
            factories: [],
            shipyards: []
        };
        
        // Initialize available technologies asynchronously
        this.initialized = this.initialize();
    }

    async initialize() {
        console.log('Empire: Starting initialization...');
        await this.initializeAvailableTech();
        console.log('Empire: Available tech initialized');

        // Auto-unlock (research) any technologies that have zero cost and no prerequisites
        // These represent baseline starting capabilities the player should always have.
        const allTech = await TechTree.getAllTech();
        for (const [techId, tech] of allTech) {
            if (tech.cost === 0 && tech.prerequisites.length === 0 && !tech.specialRequirement) {
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
    
    // Initialize technologies that have no prerequisites
    async initializeAvailableTech() {
        const allTech = await TechTree.getAllTech();
        for (const [techId, tech] of allTech) {
            if (tech.prerequisites.length === 0 && !tech.specialRequirement) {
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
                // Check if prerequisites are met
                const prereqsMet = tech.prerequisites.every(prereq => 
                    this.researchedTech.has(prereq)
                );
                
                // Check special requirements
                let specialReqMet = true;
                if (tech.specialRequirement) {
                    if (tech.specialRequirement === 'Tier3') {
                        // For now, assume empire is always high enough tier
                        specialReqMet = true;
                    } else {
                        specialReqMet = this.researchedTech.has(tech.specialRequirement);
                    }
                }
                
                if (prereqsMet && specialReqMet) {
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

            designs: this.designs
        };
    }

    // Deserialization
    fromJSON(data) {
        this.name = data.name || 'New Empire';
        this.techPoints = data.techPoints || 0;
        this.researchedTech = new Set(data.researchedTech || []);
        this.availableTech = new Set(data.availableTech || ['basic-hull', 'basic-engine', 'basic-weapon']);

        this.designs = data.designs || {
            ships: [],
            craft: [],
            troops: [],
            missiles: [],
            loadouts: [],
            powerplants: [],
            factories: [],
            shipyards: []
        };
    }

    // Get tech requirements for all designs
    getTechRequirements() {
        const requirements = new Set();
        
        for (const [type, designs] of Object.entries(this.designs)) {
            for (const design of designs) {
                if (design.components) {
                    for (const component of design.components) {
                        if (component.requiredTech) {
                            for (const tech of component.requiredTech) {
                                const hasIgnoreTech = design.ignoreTechRequirements || false;
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