class WeaponCatalogue {
    static loadPromise = null;
    static RESOURCE_BY_PREFIX = { H: 'hardpoints', U: 'utilities', E: 'emplacements' };

    static async load() {
        if (!this.loadPromise) {
            this.loadPromise = fetch('data/weapons.json')
                .then(response => {
                    if (!response.ok) throw new Error(`Unable to load weapons (${response.status})`);
                    return response.json();
                })
                .then(data => this.validate(data))
                .catch(error => {
                    this.loadPromise = null;
                    throw error;
                });
        }
        return this.loadPromise;
    }

    static validate(data) {
        const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
        const stat = value => value === null || typeof value === 'string' ||
            (typeof value === 'number' && Number.isFinite(value));
        if (!object(data) || data.schemaVersion !== 1 || !Array.isArray(data.categories) ||
            !object(data.source) || typeof data.source.url !== 'string' ||
            typeof data.source.description !== 'string') {
            throw new Error('Weapons catalogue must use schemaVersion 1 with source metadata and categories.');
        }
        if (Object.keys(data).some(key => !['schemaVersion', 'source', 'categories'].includes(key))) {
            throw new Error('Weapons catalogue contains unsupported fields.');
        }
        const ids = new Set();
        const fields = new Set([
            'id', 'name', 'accuracy', 'damage', 'tagsDescription', 'implied', 'reasoning',
            'tier', 'hp', 'cost', 'requiredTech', 'sourceRow', 'isSpinal', 'isMain', 'isPointDefense'
        ]);
        for (const category of data.categories) {
            if (!object(category) || typeof category.name !== 'string' || !category.name.trim() ||
                typeof category.description !== 'string' || !Array.isArray(category.weapons)) {
                throw new Error('Weapon categories must contain a name, description, and weapons array.');
            }
            if (Object.keys(category).some(key => !['name', 'description', 'weapons'].includes(key))) {
                throw new Error(`Weapon category "${category.name}" contains unsupported fields.`);
            }
            for (const weapon of category.weapons) {
                const context = `Weapon "${weapon?.id || '?'}" in "${category.name}"`;
                const fail = message => { throw new Error(`${context}: ${message}`); };
                if (!object(weapon) || typeof weapon.id !== 'string' || !weapon.id.trim() ||
                    typeof weapon.name !== 'string' || !weapon.name.trim()) {
                    fail('id and name must be nonempty strings.');
                }
                if (ids.has(weapon.id)) fail('duplicate weapon ID.');
                ids.add(weapon.id);
                for (const field of ['ranges', 'notes', 'resourceType', 'resourceCount']) {
                    if (Object.hasOwn(weapon, field)) fail(`${field} is not part of the compact format.`);
                }
                if (Object.keys(weapon).some(key => !fields.has(key))) fail('unsupported weapon fields.');
                for (const field of ['accuracy', 'damage']) {
                    if (!Array.isArray(weapon[field]) || weapon[field].length !== 5 ||
                        !weapon[field].every(stat)) {
                        fail(`${field} must contain exactly five numbers, strings, or nulls.`);
                    }
                }
                if (!Array.isArray(weapon.requiredTech) ||
                    !weapon.requiredTech.every(id => typeof id === 'string' && id.trim())) {
                    fail('requiredTech must be an array of technology IDs.');
                }
                if (!Number.isInteger(weapon.sourceRow) || weapon.sourceRow < 2) {
                    fail('sourceRow must be an integer of at least 2.');
                }
                for (const field of ['tagsDescription', 'implied', 'reasoning', 'hp']) {
                    if (Object.hasOwn(weapon, field) && typeof weapon[field] !== 'string') {
                        fail(`${field} must be a string when present.`);
                    }
                }
                const mount = this.getMount(weapon);
                if (mount.resourceCount !== null && !Number.isSafeInteger(mount.resourceCount)) {
                    fail('hp mount size must be a safe integer.');
                }
                for (const field of ['cost', 'tier']) {
                    if (Object.hasOwn(weapon, field) && !stat(weapon[field])) {
                        fail(`${field} must be a number, string, or null.`);
                    }
                }
                for (const field of ['isSpinal', 'isMain', 'isPointDefense']) {
                    if (Object.hasOwn(weapon, field) && typeof weapon[field] !== 'boolean') {
                        fail(`${field} must be a boolean when present.`);
                    }
                }
            }
        }
        return data;
    }

    static getMount(weapon) {
        const match = /^([HUE])(\d+)$/.exec((weapon?.hp || '').trim().toUpperCase());
        return match
            ? { resourceType: this.RESOURCE_BY_PREFIX[match[1]], resourceCount: Number(match[2]) }
            : { resourceType: null, resourceCount: null };
    }

    static parseNotes(text = '') {
        return text.split(',').map(part => part.trim()).filter(Boolean).map(part => {
            const match = /^([^()]+)\(([^()]*)\)$/.exec(part);
            if (!match) return { name: part };
            const textValue = match[2].trim();
            const number = Number(textValue);
            const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(textValue);
            const value = !textValue ? null
                : textValue.toUpperCase() === 'N/A' ? 'N/A'
                : numeric && Number.isFinite(number) ? number : textValue;
            return { name: match[1].trim(), value };
        });
    }

    static getNote(weapon, name) {
        return this.parseNotes(weapon?.tagsDescription).find(note =>
            note.name.toLowerCase() === name.toLowerCase());
    }

    static hasTag(weapon, name) {
        return this.getNote(weapon, name) !== undefined;
    }
}
