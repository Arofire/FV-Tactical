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

    static async getTechPrerequisites(techId) {
        const tech = await this.getTech(techId);
        return tech ? [...(tech.prerequisites || [])] : [];
    }

    static async getTechDependents(techId) {
        const data = await this.ensureLoaded();
        const dependents = [];
        for (const [id, tech] of Object.entries(data)) {
            if ((tech.prerequisites || []).includes(techId)) {
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

            for (const prereq of tech.prerequisites || []) {
                if (!researched.has(prereq)) {
                    errors.push({
                        tech: techId,
                        missingPrereq: prereq,
                        message: `${tech.name} requires ${data[prereq]?.name || prereq}`
                    });
                }
            }

            if (tech.specialRequirement) {
                if (!researched.has(tech.specialRequirement)) {
                    const reqTech = data[tech.specialRequirement];
                    errors.push({
                        tech: techId,
                        missingPrereq: tech.specialRequirement,
                        message: `${tech.name} requires empire technology: ${reqTech?.name || tech.specialRequirement}`
                    });
                }
            }
        }

        return errors;
    }

    static async getEffectivePrerequisites(techId) {
        const tech = await this.getTech(techId);
        if (!tech) {
            return [];
        }

        const prerequisites = [...(tech.prerequisites || [])];
        if (tech.specialRequirement && tech.specialRequirement !== 'Tier3') {
            prerequisites.push(tech.specialRequirement);
        }

        return prerequisites;
    }

    static async canResearch(techId, researchedTech, empireLevel = 1) {
        const tech = await this.getTech(techId);
        if (!tech) {
            return false;
        }

        const researched = new Set(researchedTech);

        for (const prereq of tech.prerequisites || []) {
            if (!researched.has(prereq)) {
                return false;
            }
        }

        if (tech.specialRequirement) {
            if (tech.specialRequirement === 'Tier3') {
                if (empireLevel < 3) {
                    return false;
                }
            } else if (!researched.has(tech.specialRequirement)) {
                return false;
            }
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
        const queue = [...(target.prerequisites || [])];

        while (queue.length > 0) {
            const techId = queue.shift();
            if (researched.has(techId) || path.includes(techId)) {
                continue;
            }

            const tech = data[techId];
            if (tech) {
                const prereqs = tech.prerequisites || [];
                for (const prereq of prereqs) {
                    if (!researched.has(prereq) && !path.includes(prereq)) {
                        queue.unshift(prereq);
                    }
                }

                if (prereqs.every(p => researched.has(p) || path.includes(p))) {
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