class SummaryWidget extends Widget {
    static calculateEntropyBands(entropyCapacity, radiatorOffset = 0) {
        if (!Number.isFinite(entropyCapacity) || entropyCapacity < 0 ||
            !Number.isFinite(radiatorOffset)) {
            return null;
        }
        return Array.from({ length: 6 }, (_, index) => {
            const base = Math.min(
                entropyCapacity,
                Math.max(1, Math.round(entropyCapacity * (index + 1) / 6))
            );
            return Math.min(
                entropyCapacity,
                Math.max(0, base + radiatorOffset * (index + 1))
            );
        });
    }

    constructor(x = 100, y = 100, type = 'summary', title = 'Summary') {
        super(type, title, x, y, null);
        this.exportMenuRoot = null;
        this.exportMenu = null;
        this.exportButton = null;
        this.exportMenuOutsideHandler = event => {
            if (!this.exportMenuRoot?.contains(event.target)) this.closeExportMenu();
        };
        this.exportMenuFocusoutHandler = event => {
            if (event.relatedTarget && !this.exportMenuRoot?.contains(event.relatedTarget)) {
                this.closeExportMenu();
            }
        };
        this.exportMenuKeydownHandler = event => this.handleExportMenuKeydown(event);
        this.init();
    }

    createContent(contentElement) {
        const sections = contentElement.querySelector('.widget-sections');
        const infoSection = this.createSection('info', '');
        this.setSectionContent(infoSection, `
            <div class="hull-plan-export">
                <button type="button" class="hull-plan-export-trigger" id="${this.id}-export"
                    aria-haspopup="menu" aria-expanded="false" aria-controls="${this.id}-export-menu">
                    Export
                </button>
                <div class="hull-plan-export-menu" id="${this.id}-export-menu" role="menu"
                        aria-label="Summary export options" hidden>
                        <button type="button" role="menuitem" data-export-format="json">JSON</button>
                        <button type="button" role="menuitem" data-export-format="pdf">PDF</button>
                    </div>
                </div>
                <div class="hull-plan-view" id="${this.id}-plan-view" aria-live="polite"></div>
        `);
        sections.appendChild(infoSection.section);
        this.exportMenuRoot = contentElement.querySelector('.hull-plan-export');
        this.exportMenu = contentElement.querySelector(`#${this.id}-export-menu`);
        this.exportButton = contentElement.querySelector(`#${this.id}-export`);
        this.exportButton?.addEventListener('click', () => this.toggleExportMenu());
        this.exportMenu?.addEventListener('click', event => {
            const option = event.target instanceof Element
                ? event.target.closest('[data-export-format]')
                : null;
            if (!option) return;
            this.closeExportMenu(true);
            if (option.dataset.exportFormat === 'json') {
                this.exportJSON();
            } else if (option.dataset.exportFormat === 'pdf') {
                this.exportPDF();
            }
        });
        this.exportMenuRoot?.addEventListener('focusout', this.exportMenuFocusoutHandler);
        this.refreshPlan();
    }

    toggleExportMenu() {
        if (!this.exportMenu || !this.exportButton) return;
        if (!this.exportMenu.hidden) {
            this.closeExportMenu();
            return;
        }
        this.exportMenu.hidden = false;
        this.exportButton.setAttribute('aria-expanded', 'true');
        this.exportMenu.addEventListener('keydown', this.exportMenuKeydownHandler);
        document.addEventListener('pointerdown', this.exportMenuOutsideHandler);
        this.exportMenu.querySelector('[role="menuitem"]')?.focus();
    }

    handleExportMenuKeydown(event) {
        const items = Array.from(this.exportMenu?.querySelectorAll('[role="menuitem"]') || []);
        if (event.key === 'Escape') {
            event.preventDefault();
            this.closeExportMenu(true);
            return;
        }
        if (!items.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const activeIndex = items.indexOf(document.activeElement);
        const nextIndex = event.key === 'Home'
            ? 0
            : event.key === 'End'
                ? items.length - 1
                : (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[nextIndex].focus();
    }

    closeExportMenu(restoreFocus = false) {
        if (this.exportMenu) {
            this.exportMenu.hidden = true;
            this.exportMenu.removeEventListener('keydown', this.exportMenuKeydownHandler);
        }
        this.exportButton?.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', this.exportMenuOutsideHandler);
        if (restoreFocus) this.exportButton?.focus();
    }

    close() {
        this.closeExportMenu();
        super.close();
    }

    createNodes() {
        this.clearNodes();
        this.addNode('input', 'Outfit', 'Outfit', 0, 0.5, {
            sectionId: 'info',
            anchorId: `${this.id}-info`,
            minSpacing: 30,
            allowMultipleConnections: true
        });
        this.addNode('input', 'Craft', 'Craft', 0, 0.7, {
            sectionId: 'info',
            anchorId: `${this.id}-info`,
            minSpacing: 30,
            allowMultipleConnections: true
        });
        this.reflowNodes();
    }

    getSerializedData() {
        return {};
    }

    loadSerializedData() {
        this.refreshPlan();
    }

    handleNodeConnectionChange(nodeId) {
        super.handleNodeConnectionChange(nodeId);
        this.updateConnectedInputLayer();
        this.refreshPlan();
        this.refreshSummary();
    }

    onParentLinked() {
        this.updateConnectedInputLayer();
        this.refreshPlan();
        this.refreshSummary();
    }

    updateConnectedInputLayer() {
        if (!this.element) return;
        const hasConnectedInputs = Array.from(this.nodes.values()).some(node =>
            node.type === 'input' && node.connections?.size
        );
        this.element.classList.toggle('has-connected-summary-inputs', hasConnectedInputs);
        this.element.style.zIndex = this.isDragging
            ? '100'
            : hasConnectedInputs ? '30' : (this.selected ? '20' : '10');
    }

    select() {
        super.select();
        this.updateConnectedInputLayer();
    }

    deselect() {
        super.deselect();
        this.updateConnectedInputLayer();
    }

    onParentDataChanged() {
        this.refreshPlan();
        this.refreshSummary();
    }

    syncConnectedData() {
        this.refreshPlan();
    }

    getConnectedComponents() {
        const components = [];
        if (!window.nodeSystem) return components;

        const componentTypes = {
            ship: 'Class',
            shipCore: 'Core',
            outfit: 'Outfit'
        };
        const visitedWidgets = new Set();
        const addComponent = (inputNodeId, inputType, sourceWidget, sourceNodeId) => {
            if (!sourceWidget || visitedWidgets.has(sourceWidget.id) ||
                typeof sourceWidget.getSerializedData !== 'function') return;
            visitedWidgets.add(sourceWidget.id);

            try {
                components.push({
                    inputNodeId,
                    inputType,
                    sourceNodeId,
                    sourceWidgetId: sourceWidget.id,
                    sourceWidgetType: sourceWidget.type,
                    sourceWidgetTitle: sourceWidget.title,
                    data: sourceWidget.getSerializedData()
                });
            } catch (error) {
                console.warn(`[SummaryWidget ${this.id}] Unable to read connected ${inputType} data`, error);
            }
            // Craft statistics stand alone; a craft's core is not part of the ship plan.
            if (inputType === 'Craft') return;

            for (const parentId of sourceWidget.parents || []) {
                const parentWidget = window.widgetManager?.getWidget(parentId);
                const parentInputType = componentTypes[parentWidget?.type];
                if (!parentWidget || !parentInputType) continue;
                const parentOutput = Array.from(parentWidget.nodes.values())
                    .find(parentNode => parentNode.type === 'output' && parentNode.nodeType === parentInputType);
                addComponent(inputNodeId, parentInputType, parentWidget, parentOutput?.id || sourceNodeId);
            }
        };

        for (const node of this.nodes.values()) {
            if (node.type !== 'input' || !node.connections?.size) continue;
            for (const connectionId of node.connections) {
                const connection = window.nodeSystem.connections?.get(connectionId);
                if (!connection) continue;
                const sourceNodeId = node.id === connection.targetNodeId
                    ? connection.sourceNodeId
                    : connection.targetNodeId;
                const sourceNode = window.nodeSystem.getNodeById(sourceNodeId);
                const sourceWidget = sourceNode && window.widgetManager?.getWidget(sourceNode.widgetId);
                addComponent(node.id, node.nodeType, sourceWidget, sourceNodeId);
            }
        }
        return components;
    }

    getSourceData(components, inputType) {
        return components
            .filter(component => component.inputType === inputType)
            .map(component => component.data);
    }

    getModel(components = this.getConnectedComponents()) {
        const classes = this.getSourceData(components, 'Class');
        const classData = classes[0]?.shipData || null;
        const outfits = components
            .filter(component => component.inputType === 'Outfit')
            .map(component => {
                const data = component.data || {};
                const outfit = data.outfitData || {};
                const widget = window.widgetManager?.getWidget(component.sourceWidgetId);
                if (typeof widget?.getHullPlanExportDevices !== 'function') {
                    throw new Error(`Connected outfit ${component.sourceWidgetId} cannot provide Summary export devices.`);
                }
                return {
                    ...outfit,
                    spinalWeapon: data.spinalWeapon || outfit.spinalWeapon || null,
                    hullPlanExportDevices: widget.getHullPlanExportDevices()
                };
            });
        const cores = outfits.map(outfit => outfit.selectedCore).filter(Boolean);
        const hullComposition = classData?.hullComposition || {};
        const rawCounts = {
            Emplacement: this.getCount(hullComposition, ['emplacement']),
            Hangar: this.getCount(hullComposition, ['hangar']),
            Magazine: this.getCount(hullComposition, ['magazine']),
            System: this.getCount(hullComposition, ['system']),
            Freight: this.getCount(hullComposition, ['freight']),
            Tankage: this.getCount(hullComposition, ['tankage']),
            Core: this.getCount(hullComposition, ['core'])
        };
        if (rawCounts.System === null && outfits.length > 0) {
            rawCounts.System = outfits.reduce(
                (sum, outfit) => sum + this.numeric(outfit.resourceUse?.systems),
                0
            );
        }

        if (rawCounts.Core === null && outfits.length) {
            const outfitCore = outfits
                .map(outfit => this.getCount(outfit.resources || {}, ['core']))
                .find(count => count !== null);
            if (outfitCore !== undefined) rawCounts.Core = outfitCore;
        }
        const classConnected = !!classData;
        const counts = {};
        for (const category of Object.keys(SummaryWidget.HULL_CODES)) {
            counts[category] = rawCounts[category] === null
                ? (classConnected ? 0 : null)
                : rawCounts[category];
        }

        const technologies = this.collectTechnologies(components);
        const hullItems = this.createHullItems(outfits);
        const knownTotal = Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0);
        const complete = Object.values(counts).every(count => count !== null);
        const total = complete ? knownTotal : null;
        const utilityValues = outfits
            .map(outfit => this.getCount(outfit.resources || {}, ['utilities']))
            .filter(value => value !== null);
        const utilityTotal = utilityValues.length
            ? utilityValues.reduce((sum, value) => sum + value, 0)
            : null;
        const sources = components.map(component => component.data);
        const hasOutfitArmor = outfits.some(outfit => outfit.defenses?.armor !== undefined);
        const armor = hasOutfitArmor
            ? outfits.reduce((sum, outfit) => sum + this.numeric(outfit.armorHits), 0)
            : this.numeric(this.getMetricValue(sources, [
                'armor', 'armour',
            ]));
        const outfitHardpoints = outfits
            .map(outfit => this.getCount(outfit.resources || {}, ['hardpoints']))
            .find(count => count !== null);
        const hardpoints = outfitHardpoints ?? null;
        const containmentHullBasis = counts.Freight === null || counts.Tankage === null
            ? null
            : counts.Freight + counts.Tankage;

        return {
            classData,
            cores,
            outfits,
            counts,
            total,
            utilityTotal,
            armor,
            hardpoints,
            containmentHullBasis,
            technologies,
            hullItems,
            components
        };
    }

    getCount(object, keys) {
        for (const key of keys) {
            if (object && Object.prototype.hasOwnProperty.call(object, key) && object[key] !== null && object[key] !== '') {
                return this.numeric(object[key]);
            }
        }
        return null;
    }

    numeric(value) {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
    }

    createHullItems(outfits) {
        const items = {
            Emplacement: [],
            System: []
        };
        const emplacementWeapons = [];
        for (const outfit of outfits) {
            const weapons = outfit.weapons || {};
            const addWeapon = (weapon, count) => {
                const weaponCount = this.numeric(count);
                if (!weapon || weapon.resourceType !== 'emplacements' || weaponCount < 1) return;
                const resourceCost = this.numeric(weapon.resourceCount) || 1;
                const isTurretEligible = resourceCost === 2 || resourceCost === 3;
                const slotsPerWeapon = resourceCost +
                    (isTurretEligible && weapon.isTurreted ? 1 : 0);
                const weaponId = weapon.weaponId || weapon.id || null;
                const weaponKey = String(weaponId || weapon.name || weapon.label || 'Weapon');
                for (let index = 0; index < weaponCount; index++) {
                    emplacementWeapons.push({
                        weaponKey,
                        weaponId,
                        name: weapon.name || weapon.label || weapon.id || 'Weapon',
                        resourceCost: slotsPerWeapon
                    });
                }
            };

            const spinal = outfit.spinalWeapon;
            if (weapons.spinal && spinal) addWeapon(spinal, 1);
            for (const weapon of [...(weapons.offensive || []), ...(weapons.defensive || [])]) {
                addWeapon(weapon, weapon?.count);
            }
        }

        const weaponInstanceCounts = new Map();
        for (const weapon of emplacementWeapons) {
            weaponInstanceCounts.set(
                weapon.weaponKey,
                (weaponInstanceCounts.get(weapon.weaponKey) || 0) + 1
            );
        }
        const weaponInstanceNumbers = new Map();
        for (const weapon of emplacementWeapons) {
            const instanceNumber = (weaponInstanceNumbers.get(weapon.weaponKey) || 0) + 1;
            weaponInstanceNumbers.set(weapon.weaponKey, instanceNumber);
            const hasDuplicates = weaponInstanceCounts.get(weapon.weaponKey) > 1;
            const weaponInstanceId = hasDuplicates
                ? `${weapon.weaponKey}:${instanceNumber}`
                : null;
            for (let index = 0; index < weapon.resourceCost; index++) {
                items.Emplacement.push({
                    name: weapon.name,
                    weaponId: weapon.weaponId,
                    weaponInstanceId,
                    weaponInstanceNumber: hasDuplicates ? instanceNumber : null,
                    resourceCost: weapon.resourceCost
                });
            }
        }
        items.Emplacement.sort((a, b) => a.resourceCost - b.resourceCost);
        return items;
    }

    formatEmplacementWeaponsForExport(outfits) {
        const groupedWeapons = new Map();
        const arcOrder = ['F', 'P', 'S', 'A'];
        const arcNames = {
            F: 'Fore',
            P: 'Port',
            S: 'Starboard',
            A: 'Aft'
        };
        const removeTerm = (name, term) => name.replace(
            new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
            ''
        );

        const addWeapon = (weapon, count, type) => {
            if (!weapon || weapon.resourceType !== 'emplacements') return;
            const weaponName = weapon.name || weapon.label || weapon.id || 'Weapon';
            const weaponCount = this.numeric(count);
            if (weaponCount < 1) return;

            const resourceCount = this.numeric(weapon.resourceCount) || 1;
            const weaponClass = resourceCount === 1
                ? 'Tertiary'
                : resourceCount === 2 ? 'Secondary' : 'Primary';
            const isMain = type === 'offensive' && Boolean(weapon.isMain);
            const isSpinal = type === 'spinal' || Boolean(weapon.isSpinal);
            const isTurreted = !isMain && !isSpinal &&
                resourceCount > 1 && type === 'offensive' && Boolean(weapon.isTurreted);
            const selectedArcs = Array.from(new Set(
                String(weapon.arc || '')
                    .toUpperCase()
                    .split('')
                    .filter(arc => arcOrder.includes(arc))
            )).sort((first, second) => arcOrder.indexOf(first) - arcOrder.indexOf(second));
            const hasSelectableArcs = !isSpinal && resourceCount > 1 &&
                type === 'offensive';
            const arcTerms = hasSelectableArcs && !isTurreted
                ? selectedArcs.map(arc => arcNames[arc])
                : isTurreted ? [selectedArcs.join('')].filter(Boolean) : [];
            let nameWithoutModifiers = weaponName;
            for (const term of [weaponClass, ...(isTurreted ? ['Turreted'] : []), ...arcTerms]) {
                nameWithoutModifiers = removeTerm(nameWithoutModifiers, term);
            }
            nameWithoutModifiers = nameWithoutModifiers.replace(/\s+/g, ' ').trim();
            const text = [
                weaponClass,
                isTurreted ? 'Turreted' : null,
                ...arcTerms,
                nameWithoutModifiers || weaponName
            ].filter(Boolean).join(' ');

            const existing = groupedWeapons.get(text);
            if (existing) existing.count += weaponCount;
            else groupedWeapons.set(text, { text, count: weaponCount });
        };

        for (const outfit of outfits) {
            const weapons = outfit.weapons || {};
            const spinal = outfit.spinalWeapon;
            if (weapons.spinal && spinal) addWeapon(spinal, 1, 'spinal');
            for (const weapon of weapons.offensive || []) {
                addWeapon(weapon, weapon?.count, 'offensive');
            }
            for (const weapon of weapons.defensive || []) {
                addWeapon(weapon, weapon?.count, 'defensive');
            }
        }

        return Array.from(groupedWeapons.values(), weapon =>
            weapon.count <= 1
                ? weapon.text
                : `${weapon.text} x${weapon.count}`
        );
    }

    collectTechnologies(components) {
        const found = new Set();
        const visited = new Set();
        const visit = value => {
            if (!value || typeof value !== 'object' || visited.has(value)) return;
            visited.add(value);
            if (Array.isArray(value)) {
                value.forEach(visit);
                return;
            }
            for (const [key, item] of Object.entries(value)) {
                if (key === 'requiredTech' && Array.isArray(item)) {
                    item.forEach(entry => {
                        if (typeof entry === 'string' && entry.trim()) found.add(entry.trim());
                    });
                } else {
                    visit(item);
                }
            }
        };
        components.forEach(component => visit(component.data));
        return Array.from(found).sort((a, b) => a.localeCompare(b));
    }

    getMetricValue(objects, keys) {
        for (const object of objects) {
            const value = this.findValue(object, keys);
            if (value !== undefined && value !== null && value !== '') return value;
        }
        return null;
    }

    findValue(object, keys) {
        if (!object || typeof object !== 'object') return undefined;
        const keySet = new Set(keys.map(key => key.toLowerCase()));
        const queue = [object];
        const visited = new Set();
        while (queue.length) {
            const current = queue.shift();
            if (!current || typeof current !== 'object' || visited.has(current)) continue;
            visited.add(current);
            for (const [key, value] of Object.entries(current)) {
                if (keySet.has(key.toLowerCase()) && value !== undefined && value !== null) return value;
                if (value && typeof value === 'object') queue.push(value);
            }
        }
        return undefined;
    }

    getMetrics(model) {
        const { outfits, cores, counts, components } = model;
        const outfitData = outfits;
        const sources = components.map(component => component.data);
        const reserve = this.getMetricValue(sources, ['magneticReserve', 'barrierReserve', 'magneticBarrierReserve']);
        const barriers = this.getMetricValue(sources, ['magneticBarriers', 'magneticBarrier', 'barriers']);
        const activeArmor = this.getMetricValue(sources, ['activeArmor', 'activeArmour']);
        const plasmaFields = this.getMetricValue(sources, ['plasmaFields', 'plasmaField']);
        const reportedCrewCapacity = this.getMetricValue(sources, [
            'crewBerthings', 'crewBerths', 'crewCapacity', 'berthingCapacity', 'berthCapacity'
        ]);
        const crewCapacity = reportedCrewCapacity ?? (outfitData.length
            ? outfitData.reduce((total, outfit) => {
                const generalSystems = outfit.systems?.general;
                const berthingSystems = this.numeric(generalSystems?.berthing);
                const cargoAllocation = Math.min(
                    this.numeric(generalSystems?.berthingCargo),
                    berthingSystems * 50
                );
                return total + Math.max(0, berthingSystems * 5 - cargoAllocation / 10);
            }, 0)
            : null);
        const sumDeviceMetric = (collection, property) => outfitData.reduce((total, outfit) =>
            total + (Array.isArray(outfit.utilityDevices?.[collection])
                ? outfit.utilityDevices[collection].reduce((subtotal, selection) => {
                    const value = Number(selection?.[property]);
                    return subtotal + (Number.isFinite(value)
                        ? value * this.numeric(selection?.count)
                        : 0);
                }, 0)
                : 0), 0);
        const sumEntropyRadiance = () => outfitData.reduce((total, outfit) => {
            const systems = outfit.systems?.entropy;
            if (!systems || typeof systems !== 'object') return total;
            return total + Object.values(systems).reduce((subtotal, selection) => {
                const value = Number(selection?.radiance);
                return subtotal + (Number.isFinite(value)
                    ? value * this.numeric(selection?.count)
                    : 0);
            }, 0);
        }, 0);
        const radiatorRadiance = sumDeviceMetric('radiators', 'radiance');
        const passiveDeviceRadiance = sumEntropyRadiance();
        const combineRadiance = (existing, added) => {
            if (existing === null && added === 0) return null;
            const value = Number(existing);
            return (Number.isFinite(value) ? value : 0) + added;
        };
        const activeRadiance = combineRadiance(
            this.getMetricValue(sources, ['activeRadiance']),
            radiatorRadiance
        );
        const passiveRadiance = combineRadiance(
            this.getMetricValue(sources, ['passiveRadiance']),
            passiveDeviceRadiance
        );
        const threshold = this.getMetricValue(cores, ['reactorStability']);
        const outfitEntropyCapacities = outfitData
            .map(outfit => outfit.selectedCore?.burnAnalysis?.totalEntropy)
            .filter(capacity => Number.isFinite(capacity) && capacity >= 0);
        const entropyCapacity = outfitEntropyCapacities.length
            ? outfitEntropyCapacities.reduce((total, capacity) => total + capacity, 0)
            : null;
        const radiatorOffset = sumDeviceMetric('radiators', 'offset');
        const entropyBands = entropyCapacity === null
            ? null
            : SummaryWidget.calculateEntropyBands(entropyCapacity, radiatorOffset);
        const magazineCells = counts.Magazine === null ? null : counts.Magazine * 25;
        const hangarBays = counts.Hangar === null ? null : counts.Hangar * 4;

        const metric = (label, value, format = item =>
            item && typeof item === 'object' ? JSON.stringify(item) : String(item)) => ({
            label,
            value: value === undefined || value === null || value === ''
                ? 'Not available'
                : format(value),
            available: value !== undefined && value !== null && value !== ''
        });

        return [
            metric('Plasma fields', plasmaFields),
            metric('Active armor', activeArmor),
            {
                label: 'Magnetic barriers / reserve',
                value: barriers !== null || reserve !== null
                    ? [barriers !== null ? `${barriers} barriers` : null, reserve !== null ? `${reserve} reserve` : null].filter(Boolean).join(' · ')
                    : 'Not available',
                available: barriers !== null || reserve !== null
            },
            metric('Crew berthings', crewCapacity),
            metric('Hardpoints', model.hardpoints, value => String(value)),
            metric('Active radiance', activeRadiance),
            metric('Passive radiance', passiveRadiance),
            metric('Threshold', threshold),
            metric('Entropy capacity', entropyCapacity),
            metric('Entropy bands', entropyBands, values => values.join('  ')),
            metric('Magazine cells', magazineCells, value => String(value)),
            metric('Hangar bays', hangarBays, value => String(value))
        ];
    }

    getHullResourceMetrics(model) {
        const outfitCargo = this.getMetricValue(
            model.outfits.map(outfit => outfit.resources || {}),
            ['cargo']
        );
        const classCargo = this.getMetricValue([model.classData?.resources || {}], ['cargo']);
        const berthingCargo = model.outfits.reduce(
            (total, outfit) => total + this.numeric(outfit.systems?.general?.berthingCargo),
            0
        );
        const cargoBase = outfitCargo ?? classCargo;
        const cargo = cargoBase !== null
            ? this.numeric(cargoBase) + berthingCargo
            : berthingCargo > 0 ? berthingCargo : null;
        const consumption = model.outfits.length
            ? model.outfits.reduce((total, outfit) =>
                total + this.numeric(outfit.resources?.systems) +
                    this.numeric(outfit.resources?.core), 0)
            : null;

        return {
            cargo,
            consumption,
            endurance: cargo !== null && consumption > 0
                ? Math.floor(cargo / consumption)
                : null
        };
    }

    static get HULL_CODES() {
        return {
            Emplacement: 'E',
            Hangar: 'H',
            Magazine: 'M',
            System: 'S',
            Freight: 'F',
            Tankage: 'T',
            Core: 'C'
        };
    }

    static get STACK_ORDER() {
        return ['Core'];
    }

    static get FLOW_ORDER() {
        return ['Freight', 'Tankage', 'Emplacement', 'Hangar', 'Magazine', 'System'];
    }

    createLayout(counts) {
        const total = Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0);
        if (!total) return { rows: 0, cols: 0, missing: 0, cells: [] };

        const rows = Math.ceil(Math.sqrt(total) / 2);
        const cols = Math.ceil(total / rows);
        const missing = rows * cols - total;
        const slots = [];
        for (let row = 0; row < rows; row++) {
            const rowLength = row === rows - 1 ? cols - missing : cols;
            for (let col = 0; col < rowLength; col++) slots.push({ row, col });
        }

        const descending = [...slots].sort((a, b) => b.col - a.col || b.row - a.row);
        const cells = [];
        for (const category of SummaryWidget.STACK_ORDER) {
            for (let index = 0; index < (counts[category] || 0); index++) {
                const slot = descending[cells.length];
                if (!slot) break;
                cells.push({ ...slot, category });
            }
        }
        const occupied = new Set(cells.map(cell => `${cell.row}:${cell.col}`));
        const flowSlots = slots.filter(slot => !occupied.has(`${slot.row}:${slot.col}`));
        let flowIndex = 0;
        for (const category of SummaryWidget.FLOW_ORDER) {
            for (let index = 0; index < (counts[category] || 0); index++) {
                const slot = flowSlots[flowIndex++];
                if (!slot) break;
                cells.push({ ...slot, category });
            }
        }
        return { rows, cols, missing, cells };
    }

    blockTable(count, cols, code) {
        const cellCount = this.numeric(count);
        if (cellCount <= 0 || cols <= 0) return [];
        const rows = Math.ceil(cellCount / cols);
        const table = Array.from({ length: rows }, () => new Array(cols).fill(''));
        for (let index = 0; index < cellCount; index++) {
            table[Math.floor(index / cols)][index % cols] = code;
        }
        return table;
    }

    buildArmorTable(armor, hardpoints, cols) {
        const table = this.blockTable(armor, cols, 'D');
        let remainingHardpoints = Math.min(this.numeric(hardpoints), this.numeric(armor));
        for (let row = table.length - 1; row >= 0 && remainingHardpoints > 0; row--) {
            for (let col = cols - 1; col >= 0 && remainingHardpoints > 0; col--) {
                if (!table[row][col]) continue;
                table[row][col] = 'A';
                remainingHardpoints--;
            }
        }
        return table;
    }

    renderPlan(container, model) {
        if (!container) return;
        container.replaceChildren();
        const craftComponents = model.components.filter(component => component.inputType === 'Craft');
        const hasShipInputs = model.components.some(component => component.inputType !== 'Craft');
        if (hasShipInputs || !craftComponents.length) this.renderShipPlan(container, model);
        craftComponents.forEach(component => this.renderCraftStatistics(container, component));
    }

    // Combined statistics for a connected craft design.
    renderCraftStatistics(container, component) {
        const widget = window.widgetManager?.getWidget(component.sourceWidgetId);
        if (typeof widget?.calculateStats !== 'function') return;
        const stats = widget.calculateStats();
        const list = values => (values?.length ? values.join(', ') : '—');
        const usage = resource => `${stats[`${resource}Used`]} / ${stats[resource]}`;
        const section = document.createElement('section');
        section.className = 'widget-section hull-plan-metrics-section summary-craft-statistics';
        const title = document.createElement('h4');
        title.className = 'section-title';
        title.textContent = `${widget.title || 'Craft'} statistics`;
        const content = document.createElement('div');
        content.className = 'section-content';
        content.appendChild(this.createPropertiesGrid([
            ['Profile', stats.profile],
            ['Roles', `${list(stats.roles)} (${stats.roleCount} / ${stats.roleLimit})`],
            ['Combat value', widget.formatOptionCost?.(stats.combatValue, 'general') || `${stats.combatValue} CV`],
            ['Cohesion', stats.cohesion],
            ['Burns', stats.burns],
            ['Power', stats.power],
            ['Fuel', stats.fuel],
            ['Hardpoints', usage('hardpoints')],
            ['Utilities', usage('utilities')],
            ['Equipment', usage('equipment')],
            ['Troops', stats.troops],
            ['Cells', stats.cells],
            ['Containment', stats.containment],
            ['Bays required', stats.baysRequired],
            ['Facing', stats.facing],
            ['Traits', list(stats.traits)],
            ['Tags', list(stats.tags)],
            ['Actions', list(stats.actions)]
        ].map(([label, value]) => ({ label, value: String(value), available: true }))));
        section.append(title, content);
        container.appendChild(section);
    }

    renderShipPlan(container, model) {
        const metrics = this.getMetrics(model);
        const hullResourceMetrics = this.getHullResourceMetrics(model);
        const supplySection = document.createElement('section');
        supplySection.className = 'widget-section hull-plan-metrics-section';
        const supplyTitle = document.createElement('h4');
        supplyTitle.className = 'section-title';
        supplyTitle.textContent = 'Supply';
        const supplyContent = document.createElement('div');
        supplyContent.className = 'section-content';
        const resourceTiles = document.createElement('div');
        resourceTiles.className = 'triangle-values hull-plan-resource-tiles';
        for (const [label, value] of [
            ['Cargo', hullResourceMetrics.cargo],
            ['Consumption', hullResourceMetrics.consumption],
            ['Endurance', hullResourceMetrics.endurance]
        ]) {
            const tile = document.createElement('div');
            tile.className = 'triangle-value hull-plan-resource-tile';
            const title = document.createElement('div');
            title.className = 'triangle-component-title';
            title.textContent = label;
            const valueText = document.createElement('span');
            valueText.className = 'hull-plan-resource-value';
            valueText.textContent = value === null ? 'Not available' : String(value);
            valueText.setAttribute(
                'aria-label',
                `${label}: ${value === null ? 'Not available' : String(value)}`
            );
            tile.append(title, valueText);
            resourceTiles.appendChild(tile);
        }
        supplyContent.appendChild(resourceTiles);
        supplySection.append(supplyTitle, supplyContent);
        container.appendChild(supplySection);

        const armorSection = document.createElement('section');
        armorSection.className = 'widget-section hull-plan-metrics-section';
        const armorTitle = document.createElement('h4');
        armorTitle.className = 'section-title';
        armorTitle.textContent = 'Armor & field systems';
        const armorContent = document.createElement('div');
        armorContent.className = 'section-content';
        armorContent.appendChild(this.createPropertiesGrid([
            metrics[0], metrics[1], metrics[2]
        ]));
        armorSection.append(armorTitle, armorContent);
        container.appendChild(armorSection);

        const statisticsSection = document.createElement('section');
        statisticsSection.className = 'widget-section hull-plan-metrics-section';
        const statisticsTitle = document.createElement('h4');
        statisticsTitle.className = 'section-title';
        statisticsTitle.textContent = 'Ship statistics';
        const statisticsContent = document.createElement('div');
        statisticsContent.className = 'section-content';
        statisticsContent.appendChild(this.createPropertiesGrid(metrics.slice(3)));
        statisticsSection.append(statisticsTitle, statisticsContent);
        container.appendChild(statisticsSection);
        if (model.technologies.length) {
            const techSection = document.createElement('section');
            techSection.className = 'widget-section hull-plan-metrics-section';
            const techTitle = document.createElement('h4');
            techTitle.className = 'section-title';
            techTitle.textContent = 'Technologies';
            const techContent = document.createElement('div');
            techContent.className = 'section-content';
            techContent.appendChild(this.createPropertiesGrid([{
                label: 'Required',
                value: model.technologies.join(', '),
                available: true
            }]));
            techSection.append(techTitle, techContent);
            container.appendChild(techSection);
        }
    }

    createPropertiesGrid(rows) {
        const grid = document.createElement('dl');
        grid.className = 'hull-plan-properties-grid';
        for (const row of rows) {
            const label = document.createElement('dt');
            label.textContent = row.label;
            const value = document.createElement('dd');
            value.textContent = row.value;
            if (!row.available) value.className = 'unavailable';
            grid.append(label, value);
        }
        return grid;
    }

    getExportData() {
        const components = this.getConnectedComponents();
        const model = this.getModel(components);
        const metrics = this.getMetrics(model);
        const layout = this.createLayout(model.counts);
        const riggingTotals = this.getConnectedRiggingTotals(components);
        const deviceLines = this.getOutfitDeviceLines(model.outfits);
        const formFields = this.getPdfFormFields(model, layout, metrics, riggingTotals, deviceLines);
        const exportedCellCounts = {};
        const layoutCells = layout.cells.map(cell => {
            exportedCellCounts[cell.category] = (exportedCellCounts[cell.category] || 0) + 1;
            const item = (model.hullItems[cell.category] || [])[exportedCellCounts[cell.category] - 1];
            return {
                row: cell.row + 1,
                column: cell.col + 1,
                type: cell.category,
                code: SummaryWidget.HULL_CODES[cell.category],
                ...(cell.category === 'Emplacement' && item
                    ? {
                        weaponId: item.weaponId,
                        ...(item.weaponInstanceId
                            ? {
                                weaponInstanceId: item.weaponInstanceId,
                                weaponInstanceNumber: item.weaponInstanceNumber
                            }
                            : {})
                    }
                    : {})
            };
        });
        return {
            schema: 'fv-tactical.hull-plan/v2',
            hullPlan: {
                formFields,
                deviceLines,
                layout: {
                    rows: layout.rows,
                    columns: layout.cols,
                    missingSlots: layout.missing
                }
            },
            formFields,
            deviceLines,
            unavailableFormFields: Object.entries(formFields)
                .filter(([, value]) => value === null || value === '')
                .map(([fieldName]) => fieldName),
            formFieldMappingNotes: {
                ArmourHull: 'Uses a separate armour count when present; otherwise falls back to the outfit armour value.',
                CampaignValue: 'Uses the connected widgets\' campaign resource totals (IP, MP, and EP) for the active economy mode.',
                CombatValue: 'Uses the connected widgets\' combat value total when the active economy mode provides CV.',
                CoreCombatValue: 'Uses the connected core\'s serialized cost.',
                CoreName: 'Uses the core name or widget title; falls back to the selected reactor, engine, and manifold names.',
                DevValue: 'Uses the connected ship class development cost, falling back to its serialized value. The totals object reports the full connected development-point total.',
                QuantumHull: 'Uses the connected class hull-composition quantum count when available.',
                EmplacementWeapon1To7: 'Maps up to seven selected outfit emplacement weapons to their individual PDF fields.',
                SystemDevice1To7: 'Maps up to seven selected outfit systems to their individual PDF fields.',
                UtilityDevice1To7: 'Maps up to seven selected outfit utilities to their individual PDF fields.'
            },
            hullCodes: { ...SummaryWidget.HULL_CODES },
            layout: {
                rows: layout.rows,
                columns: layout.cols,
                missingSlots: layout.missing,
                cells: layoutCells
            },
            totals: {
                hulls: model.total,
                utility: model.utilityTotal,
                containmentHullBasis: model.containmentHullBasis,
                byHullType: model.counts,
                requested: metrics,
                developmentPoints: riggingTotals.developmentPoints,
                resourceCost: riggingTotals.resourceCost
            },
            technologies: model.technologies,
            unavailableMetrics: metrics.filter(item => !item.available).map(item => item.label),
            components
        };
    }

    getConnectedRiggingTotals(components) {
        const resourceCost = {};
        let developmentPoints = null;
        let classDevelopmentPoints = null;
        let coreDevelopmentPoints = null;
        const hasConnectedCoreWidget = components.some(component =>
            component.sourceWidgetType === 'shipCore'
        );
        const visitedWidgets = new Set();
        for (const component of components) {
            if (!component.sourceWidgetId || visitedWidgets.has(component.sourceWidgetId)) continue;
            visitedWidgets.add(component.sourceWidgetId);
            const widget = window.widgetManager?.getWidget(component.sourceWidgetId);
            for (const [unit, value] of Object.entries(widget?.getCostTotals?.() || {})) {
                if (Number.isFinite(value)) {
                    resourceCost[unit] = (resourceCost[unit] || 0) + value;
                }
            }

            const serializedData = component.data || {};
            const fallbackDevelopmentCost = component.sourceWidgetType === 'ship'
                ? serializedData.shipData?.developmentCost
                : component.sourceWidgetType === 'shipCore'
                    ? serializedData.developmentCost
                : component.sourceWidgetType === 'outfit' && !hasConnectedCoreWidget
                    ? serializedData.outfitData?.selectedCore?.developmentCost
                : null;
            const widgetDevelopmentCost = widget?.getDevelopmentCost?.();
            const value = Number.isFinite(widgetDevelopmentCost)
                ? widgetDevelopmentCost
                : fallbackDevelopmentCost;
            if (Number.isFinite(value)) {
                developmentPoints = (developmentPoints || 0) + value;
                if (component.sourceWidgetType === 'ship') {
                    classDevelopmentPoints = (classDevelopmentPoints || 0) + value;
                } else if (component.sourceWidgetType === 'shipCore') {
                    coreDevelopmentPoints = (coreDevelopmentPoints || 0) + value;
                } else if (component.sourceWidgetType === 'outfit' && !hasConnectedCoreWidget) {
                    coreDevelopmentPoints = (coreDevelopmentPoints || 0) + value;
                }
            }
        }
        return { developmentPoints, classDevelopmentPoints, coreDevelopmentPoints, resourceCost };
    }

    formatCampaignResourceCost(resourceCost) {
        const values = ['IP', 'MP', 'EP']
            .filter(unit => Number.isFinite(resourceCost[unit]))
            .map(unit => `${resourceCost[unit]} ${unit}`);
        return values.length ? values.join(' + ') : null;
    }

    getOutfitDeviceLines(outfits) {
        const formatLine = (name, count) => {
            const quantity = this.numeric(count);
            if (!name || quantity < 1) return null;
            return quantity > 1 ? `${name} x${quantity}` : name;
        };
        const formatLines = items => items
            .map(item => formatLine(item?.name, item?.count))
            .filter(Boolean);
        const systems = [];
        const utilities = [];
        for (const outfit of outfits) {
            const devices = outfit.hullPlanExportDevices;
            systems.push(...formatLines(devices.systems));
            utilities.push(...formatLines(devices.utilities));
        }

        return {
            systems,
            emplacements: this.formatEmplacementWeaponsForExport(outfits),
            utilities
        };
    }

    getPdfFormFields(model, layout, metrics, riggingTotals = {
        developmentPoints: null,
        classDevelopmentPoints: null,
        coreDevelopmentPoints: null,
        resourceCost: {}
    }, deviceLines = this.getOutfitDeviceLines(model.outfits)) {
        const classData = model.classData || {};
        const hullResourceMetrics = this.getHullResourceMetrics(model);
        const coreComponent = model.components.find(component =>
            component.sourceWidgetType === 'shipCore'
        );
        const core = {
            ...(coreComponent?.data || {}),
            ...(model.cores[0] || {})
        };
        const resourceCost = riggingTotals.resourceCost || {};
        const className = classData.name ||
            model.components.find(component =>
                component.sourceWidgetType === 'ship'
            )?.sourceWidgetTitle || null;
        const outfitNames = model.outfits.map(outfit => outfit.name).filter(Boolean);
        const metricValue = label => {
            const metric = metrics.find(item => item.label === label);
            return metric?.available ? metric.value : null;
        };
        const firstValue = (...values) => values.find(value =>
            value !== undefined && value !== null && value !== ''
        ) ?? null;
        const industryMateriel = firstValue(
            classData.campaignValue,
            classData.campaignCost,
            classData.indMatValue,
            classData.industryMateriel,
            classData.industryAndMateriel
        );
        const industryValue = firstValue(classData.industryCost, classData.industry);
        const materielValue = firstValue(classData.materielCost, classData.materiel);
        const classIndMatValue = industryMateriel ??
            (industryValue !== null || materielValue !== null
                ? [industryValue, materielValue].filter(value => value !== null).join(' / ')
                : null);
        const armorHullCount = this.getCount(classData.hullComposition || {}, [
            'armour', 'Armour', 'armor', 'Armor'
        ]);
        const classResources = classData.resources || {};
        const statistics = classData.statistics || {};
        const coreName = firstValue(
            core.name,
            coreComponent?.sourceWidgetTitle,
            [core.reactor, core.engine, core.manifold].filter(Boolean).join(' / ')
        );
        const formFields = {
            DevValue: firstValue(
                riggingTotals.classDevelopmentPoints,
                classData.developmentCost,
                statistics.developmentPoints
            ),
            CombatValue: firstValue(resourceCost.CV),
            CampaignValue: this.formatCampaignResourceCost(resourceCost) ?? classIndMatValue,
            HullWidth: firstValue(classData.hullWidth, classData.width, layout.cols),
            ClassOutfit: [
                className,
                outfitNames.length ? outfitNames.join(', ') : null
            ].filter(Boolean).join(' / ') || null,
            HullRows: layout.rows,
            ArmourHull: armorHullCount ?? (model.outfits.length ? model.armor : null),
            CoreHull: model.counts.Core,
            EmplacementHull: model.counts.Emplacement,
            SystemHull: model.counts.System,
            UtilityHull: model.utilityTotal,
            CoreName: coreName,
            CoreSize: firstValue(core.powerplantSize),
            CoreManifoldTech: core.manifold || null,
            UtilityReserved: model.outfits.length
                ? model.outfits.reduce((sum, outfit) =>
                    sum + this.numeric(outfit.resourceUse?.utilities), 0)
                : null,
            ArmourHits: model.outfits.length ? model.armor : null,
            CoreManifoldPips: firstValue(core.manifoldValue, core.manifoldPips),
            CoreManifoldEffect: firstValue(core.manifoldEfficiency, core.manifoldEffect),
            CoreReactorTech: core.reactor || null,
            CoreReactorPips: firstValue(core.reactorValue, core.reactorPips),
            CoreReactorEffect: firstValue(core.reactorStability, core.reactorEffect),
            CoreEngineTech: core.engine || null,
            CoreEnginePips: firstValue(core.engineValue, core.enginePips),
            CoreEngineEffect: firstValue(core.engineEfficiency, core.engineEffect),
            CoreOperational: typeof core.operational === 'boolean' ? core.operational : null,
            CoreDevValue: firstValue(riggingTotals.coreDevelopmentPoints, core.developmentCost),
            CoreCombatValue: firstValue(core.cost, core.combatValue, core.combatCost),
            FreightHull: model.counts.Freight,
            TankageHull: model.counts.Tankage,
            HullCount: model.total,
            QuantumHull: this.getCount(classData.hullComposition || {}, [
                'quantum', 'quantumHull', 'quantumHulls'
            ]),
            ContainmentCargo: firstValue(classResources.cargo, statistics.cargo),
            ContainmentRemass: firstValue(classResources.remass, statistics.remass),
            Endurance: hullResourceMetrics.endurance,
            Hardpoints: model.hardpoints,
            Berthing: metricValue('Crew berthings'),
            HangarHull: model.counts.Hangar,
            HangarBays: metricValue('Hangar bays'),
            MagazineHull: model.counts.Magazine,
            MagazineCells: metricValue('Magazine cells')
        };
        for (let index = 1; index <= 7; index++) {
            formFields[`EmplacementWeapon${index}`] =
                deviceLines.emplacements[index - 1] || null;
            formFields[`SystemDevice${index}`] =
                deviceLines.systems[index - 1] || null;
            formFields[`UtilityDevice${index}`] =
                deviceLines.utilities[index - 1] || null;
        }
        return formFields;
    }

    downloadJSON() {
        const payload = this.getExportData();
        this.downloadBlob(
            new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
            'hull-plan.json'
        );
        return payload;
    }

    downloadBlob(blob, filename) {
        if (typeof window.URL?.createObjectURL !== 'function') {
            throw new Error('This browser does not support file downloads.');
        }
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        try {
            document.body.appendChild(link);
            link.click();
        } finally {
            link.remove();
            setTimeout(() => window.URL.revokeObjectURL(url), 0);
        }
    }

    async loadPdfLibrary() {
        if (window.PDFLib) return window.PDFLib;
        if (!SummaryWidget.pdfLibPromise) {
            const scriptUrl = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
            const loadPromise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = scriptUrl;
                script.async = true;
                script.onload = () => {
                    if (window.PDFLib) resolve(window.PDFLib);
                    else {
                        script.remove();
                        reject(new Error('PDF library loaded without its browser API.'));
                    }
                };
                script.onerror = () => {
                    script.remove();
                    reject(new Error('Unable to load the PDF library. Check your internet connection and try again.'));
                };
                document.head.appendChild(script);
            });
            SummaryWidget.pdfLibPromise = loadPromise.catch(error => {
                SummaryWidget.pdfLibPromise = null;
                throw error;
            });
        }
        return SummaryWidget.pdfLibPromise;
    }

    async downloadFilledPDF(payload) {
        const pdfLib = await this.loadPdfLibrary();
        const response = await fetch('data/Build%20Sheet%20Ship.pdf');
        if (!response.ok) {
            throw new Error(`Unable to load the build sheet PDF template (${response.status}).`);
        }
        const document = await pdfLib.PDFDocument.load(await response.arrayBuffer());
        const form = document.getForm();
        const templateFields = form.getFields();
        const templateFieldNames = templateFields.map(field => field.getName());
        const dataFieldNames = Object.keys(payload.formFields);
        const unmappedTemplateFields = templateFieldNames.filter(name =>
            !Object.prototype.hasOwnProperty.call(payload.formFields, name)
        );
        const missingTemplateFields = dataFieldNames.filter(name =>
            !templateFieldNames.includes(name)
        );
        if (unmappedTemplateFields.length || missingTemplateFields.length) {
            throw new Error(
                `PDF template fields do not match the export mapping. ` +
                `Unmapped template fields: ${unmappedTemplateFields.join(', ') || 'none'}. ` +
                `Missing template fields: ${missingTemplateFields.join(', ') || 'none'}.`
            );
        }

        for (const [name, value] of Object.entries(payload.formFields)) {
            const field = form.getField(name);
            if (field instanceof pdfLib.PDFCheckBox) {
                if (value === null || value === undefined) field.uncheck();
                else if (value) field.check();
                else field.uncheck();
            } else if (field instanceof pdfLib.PDFTextField) {
                field.setText(value === null || value === undefined ? '' : this.formatPdfFieldValue(value));
            } else {
                throw new Error(`PDF field "${name}" has an unsupported form-field type.`);
            }
        }

        form.acroForm.dict.set(pdfLib.PDFName.of('NeedAppearances'), pdfLib.PDFBool.True);
        const bytes = await document.save({ updateFieldAppearances: false });
        this.downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'hull-plan.pdf');
        return payload.unavailableFormFields;
    }

    formatPdfFieldValue(value) {
        if (Array.isArray(value)) return value.map(item => String(item)).join('\n');
        if (value && typeof value === 'object') return JSON.stringify(value);
        return String(value);
    }

    exportJSON() {
        try {
            const payload = this.downloadJSON();
            if (payload.unavailableFormFields.length) {
                window.app?.showNotification(
                    `JSON exported with ${payload.unavailableFormFields.length} unavailable PDF field(s). ` +
                    'See unavailableFormFields in the file for details.',
                    'warning'
                );
            } else {
                window.app?.showNotification('Summary JSON exported successfully', 'success');
            }
        } catch (error) {
            console.error(`[SummaryWidget ${this.id}] JSON export failed`, error);
            window.app?.showNotification(`Summary JSON export failed: ${error.message}`, 'error');
        }
    }

    async exportPDF() {
        try {
            const payload = this.getExportData();
            const unavailableFields = await this.downloadFilledPDF(payload);
            if (unavailableFields.length) {
                window.app?.showNotification(
                    `PDF exported with ${unavailableFields.length} blank field(s). ` +
                    'Export JSON to see the field names.',
                    'warning'
                );
            } else {
                window.app?.showNotification('Summary PDF exported successfully', 'success');
            }
        } catch (error) {
            console.error(`[SummaryWidget ${this.id}] PDF export failed`, error);
            window.app?.showNotification(`Summary PDF export failed: ${error.message}`, 'error');
        }
    }

    refreshPlan() {
        if (!this.element) return;
        const container = this.element.querySelector(`#${this.id}-plan-view`);
        if (!container) return;
        this.renderPlan(container, this.getModel());
        this.refreshCostMetrics();
    }

    // Sums each resource across the widgets feeding this summary.
    refreshCostMetrics() {
        const totals = this.getConnectedRiggingTotals(this.getConnectedComponents());
        this.setHeaderMetric('dvp', '', this.formatDevelopmentCost(totals.developmentPoints));
        this.setHeaderMetric('cost', '', this.formatCostTotals(totals.resourceCost));
    }

    onEconomyModeChanged() {
        this.refreshCostMetrics();
    }

    renderSummary(container) {
        if (!container) return;
        container.replaceChildren();
        const title = document.createElement('div');
        title.className = 'summary-title';
        title.textContent = 'Summary';
        container.appendChild(title);

        const model = this.getModel();
        const badges = document.createElement('div');
        badges.className = 'summary-badges';
        badges.appendChild(this.createBadge(`${model.total ?? '—'} hulls`));
        badges.appendChild(this.createBadge(`${model.components.length} connections`));
        container.appendChild(badges);

        const grid = document.createElement('div');
        grid.className = 'summary-grid';
        this.addSummaryField(grid, 'Utility total', model.utilityTotal ?? '—');
        container.appendChild(grid);
    }

    refreshSummary() {
        if (!this.element?.classList.contains('minimized')) return;
        const summaryContainer = this.element.querySelector('.widget-summary');
        if (summaryContainer) this.renderSummary(summaryContainer);
    }

    onMinimizeStateChanged(isMinimized) {
        if (isMinimized) this.refreshSummary();
    }

    addSummaryField(container, label, value) {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'summary-label';
        labelDiv.textContent = label;
        const valueDiv = document.createElement('div');
        valueDiv.className = 'summary-value';
        valueDiv.textContent = String(value);
        container.append(labelDiv, valueDiv);
    }

    createBadge(text, variant = '') {
        const badge = document.createElement('span');
        badge.className = variant ? `summary-badge badge-${variant}` : 'summary-badge';
        badge.textContent = text;
        return badge;
    }
}
