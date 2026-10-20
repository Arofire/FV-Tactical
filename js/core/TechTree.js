// Technology tree system
class TechTree {
    static techData = null;
    static isLoading = false;
    static loadPromise = null;
    static loadFailed = false;

    static async loadTechData() {
        if (this.techData) {
            console.log('TechTree: Using cached tech data');
            return this.techData;
        }

        if (this.loadPromise) {
            console.log('TechTree: Waiting for existing load promise');
            return this.loadPromise;
        }

        console.log('TechTree: Starting to load tech-tree.json');
        console.log('TechTree: Current location:', window.location.href);
        console.log('TechTree: Attempting to fetch:', new URL('data/tech-tree.json', window.location.href).href);
        this.isLoading = true;

        this.loadPromise = fetch('data/tech-tree.json')
            .then(response => {
                console.log('TechTree: Fetch response:', response.status, response.ok);
                if (!response.ok) {
                    throw new Error(`Failed to load tech tree data (HTTP ${response.status})`);
                }
                return response.json();
            })
            .then(data => {
                this.techData = data;
                this.isLoading = false;
                this.loadFailed = false;
                console.log(`TechTree: Successfully loaded ${Object.keys(data).length} technologies`);
                return data;
            })
            .catch(error => {
                this.isLoading = false;
                this.loadFailed = true;
                console.error('TechTree: Failed to load tech tree:', error);
                this.techData = {};
                throw error;
            })
            .finally(() => {
                this.loadPromise = null;
            });

        return this.loadPromise;
    }

    static async ensureLoaded() {
        if (!this.techData) {
            await this.loadTechData();
        }
        return this.techData || {};
    }

    static async getTech(techId) {
        const data = await this.ensureLoaded();
        return data[techId];
    }

    static async getAllTech() {
        const data = await this.ensureLoaded();
        return new Map(Object.entries(data));
    }

    static async getTechsByCategory() {
        const data = await this.ensureLoaded();
        const categories = {};
        for (const [techId, tech] of Object.entries(data)) {
            const key = tech.category || 'Uncategorized';
            if (!categories[key]) {
                categories[key] = [];
            }
            categories[key].push({ id: techId, ...tech });
        }
        return categories;
    }

    static async getTechCategoryGroups() {
        const categories = await this.getTechsByCategory();
        const categoryEntries = Object.entries(categories);
        const prefixCounts = new Map();
        const prefixPattern = /^([A-Za-z]+)\s*[-/]\s*(.+)$/;

        for (const [categoryName] of categoryEntries) {
            const match = categoryName.match(prefixPattern);
            if (match) {
                const key = match[1].toLowerCase();
                prefixCounts.set(key, (prefixCounts.get(key) || 0) + 1);
            }
        }

        const groups = [];
        const supercategories = new Map();
        for (const [categoryName, techs] of categoryEntries) {
            const match = categoryName.match(prefixPattern);
            const key = match?.[1].toLowerCase();
            if (match && prefixCounts.get(key) > 1) {
                let supercategory = supercategories.get(key);
                if (!supercategory) {
                    supercategory = { name: match[1], categories: [] };
                    supercategories.set(key, supercategory);
                    groups.push(supercategory);
                }
                supercategory.categories.push({
                    name: categoryName.replace(prefixPattern, '$2'),
                    techs
                });
            } else {
                groups.push({ name: categoryName, techs });
            }
        }

        return groups;
    }

    static async getTechRequiredTech(techId) {
        const tech = await this.getTech(techId);
        return tech ? [...(tech.requiredTech || [])] : [];
    }

    static async getTechDependents(techId) {
        const data = await this.ensureLoaded();
        const dependents = [];
        for (const [id, tech] of Object.entries(data)) {
            if ((tech.requiredTech || []).includes(techId)) {
                dependents.push(id);
            }
        }
        return dependents;
    }

    static async validateTechChain(researchedTech) {
        const data = await this.ensureLoaded();
        const errors = [];
        const researched = new Set(researchedTech);

        for (const techId of researched) {
            const tech = data[techId];
            if (!tech) {
                continue;
            }

            for (const requiredId of tech.requiredTech || []) {
                if (!researched.has(requiredId)) {
                    errors.push({
                        tech: techId,
                        missingRequiredTech: requiredId,
                        message: `${tech.name} requires ${data[requiredId]?.name || requiredId}`
                    });
                }
            }
        }

        return errors;
    }

    static async canResearch(techId, researchedTech, empireLevel = 1) {
        const tech = await this.getTech(techId);
        if (!tech) {
            return false;
        }

        const researched = new Set(researchedTech);

        for (const requiredId of tech.requiredTech || []) {
            if (!researched.has(requiredId)) {
                return false;
            }
        }

        if (tech.requiredEmpireTier && empireLevel < tech.requiredEmpireTier) {
            return false;
        }

        return true;
    }

    static async calculateTechCost(techIds) {
        const data = await this.ensureLoaded();
        let totalCost = 0;
        for (const techId of techIds) {
            const tech = data[techId];
            if (tech) {
                totalCost += tech.cost || 0;
            }
        }
        return totalCost;
    }

    static async getOptimalResearchPath(targetTech, currentTech = []) {
        const data = await this.ensureLoaded();
        const target = data[targetTech];
        if (!target) {
            return null;
        }

        const researched = new Set(currentTech);
        const path = [];
        const queue = [...(target.requiredTech || [])];

        while (queue.length > 0) {
            const techId = queue.shift();
            if (researched.has(techId) || path.includes(techId)) {
                continue;
            }

            const tech = data[techId];
            if (tech) {
                const required = tech.requiredTech || [];
                for (const requiredId of required) {
                    if (!researched.has(requiredId) && !path.includes(requiredId)) {
                        queue.unshift(requiredId);
                    }
                }

                if (required.every(id => researched.has(id) || path.includes(id))) {
                    path.push(techId);
                }
            }
        }

        if (!path.includes(targetTech)) {
            path.push(targetTech);
        }

        return path;
    }
}