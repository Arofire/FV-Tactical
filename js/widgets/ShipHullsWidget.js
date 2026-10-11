class ShipHullsWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('shipHulls', 'Hull Plan', x, y, null);
        this.hullPlanFlyoutLocked = false;
        this.hullPlanFlyout = null;
        this.hullPlanFlyoutContent = null;
        this.hullPlanFlyoutHideTimer = null;
        this.layoutMode = 'three-column';
        this.init();
    }

    createContent(contentElement) {
        const sections = contentElement.querySelector('.widget-sections');
        const infoSection = this.createSection('info', '');
        this.setSectionContent(infoSection, `
            <button type="button" class="hull-plan-export" id="${this.id}-export">Export JSON</button>
            <button type="button" class="hull-plan-open" id="${this.id}-open" aria-haspopup="dialog" aria-expanded="false">
                Hull tiles
            </button>
            <div class="hull-plan-view" id="${this.id}-plan-view" aria-live="polite"></div>
        `);
        sections.appendChild(infoSection.section);
        this.createHullPlanFlyout();
        const openButton = contentElement.querySelector(`#${this.id}-open`);
        if (openButton) {
            openButton.addEventListener('mouseenter', () => this.showHullPlanFlyout());
            openButton.addEventListener('focus', () => this.showHullPlanFlyout());
            openButton.addEventListener('click', () => this.showHullPlanFlyout());
            openButton.addEventListener('mouseleave', () => this.scheduleHullPlanFlyoutHide());
            openButton.addEventListener('blur', () => this.scheduleHullPlanFlyoutHide());
            openButton.addEventListener('keydown', event => {
                if (event.key === 'Escape' && !this.hullPlanFlyoutLocked) {
                    this.hideHullPlanFlyout();
                }
            });
        }

        const exportButton = document.getElementById(`${this.id}-export`);
        if (exportButton) {
            exportButton.addEventListener('click', () => this.downloadJSON());
        }
        this.refreshPlan();
    }

    createHullPlanFlyout() {
        this.hullPlanFlyout?.remove();
        const flyout = document.createElement('section');
        flyout.className = 'hull-plan-flyout';
        flyout.id = `${this.id}-flyout`;
        flyout.setAttribute('role', 'dialog');
        flyout.setAttribute('aria-label', 'Hull tiles diagram');
        flyout.tabIndex = -1;
        flyout.hidden = true;

        const header = document.createElement('header');
        header.className = 'hull-plan-flyout-header';
        const title = document.createElement('strong');
        title.textContent = 'Hull tiles';
        const lockButton = document.createElement('button');
        lockButton.type = 'button';
        lockButton.className = 'hull-plan-flyout-lock';
        lockButton.textContent = 'Lock open';
        lockButton.setAttribute('aria-pressed', 'false');
        lockButton.addEventListener('click', () => {
            this.hullPlanFlyoutLocked = !this.hullPlanFlyoutLocked;
            lockButton.setAttribute('aria-pressed', String(this.hullPlanFlyoutLocked));
            lockButton.textContent = this.hullPlanFlyoutLocked ? 'Unlock' : 'Lock open';
            flyout.classList.toggle('is-locked', this.hullPlanFlyoutLocked);
            if (!this.hullPlanFlyoutLocked && !flyout.matches(':hover') &&
                !this.element?.querySelector(`#${this.id}-open`)?.matches(':hover')) {
                this.scheduleHullPlanFlyoutHide();
            }
        });
        header.append(title, lockButton);

        const content = document.createElement('div');
        content.className = 'hull-plan-flyout-content';
        flyout.append(header, content);
        flyout.addEventListener('mouseenter', () => this.showHullPlanFlyout());
        flyout.addEventListener('mouseleave', () => {
            if (!this.hullPlanFlyoutLocked &&
                !this.element?.querySelector(`#${this.id}-open`)?.matches(':hover')) {
                this.scheduleHullPlanFlyoutHide();
            }
        });
        flyout.addEventListener('focusout', () => this.scheduleHullPlanFlyoutHide());
        flyout.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !this.hullPlanFlyoutLocked) {
                this.hideHullPlanFlyout();
                this.element?.querySelector(`#${this.id}-open`)?.focus();
            }
        });

        this.hullPlanFlyout = flyout;
        this.hullPlanFlyoutContent = content;
        document.body.appendChild(flyout);
    }

    showHullPlanFlyout() {
        const flyout = this.hullPlanFlyout;
        const trigger = this.element?.querySelector(`#${this.id}-open`);
        if (!flyout || !trigger) return;
        clearTimeout(this.hullPlanFlyoutHideTimer);
        flyout.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        this.positionHullPlanFlyout();
    }

    scheduleHullPlanFlyoutHide() {
        clearTimeout(this.hullPlanFlyoutHideTimer);
        this.hullPlanFlyoutHideTimer = setTimeout(() => {
            const flyout = this.hullPlanFlyout;
            const trigger = this.element?.querySelector(`#${this.id}-open`);
            if (this.hullPlanFlyoutLocked || flyout?.matches(':hover, :focus-within') ||
                trigger?.matches(':hover, :focus-within')) return;
            this.hideHullPlanFlyout();
        }, 150);
    }

    hideHullPlanFlyout() {
        if (this.hullPlanFlyoutLocked || !this.hullPlanFlyout) return;
        this.hullPlanFlyout.hidden = true;
        this.element?.querySelector(`#${this.id}-open`)?.setAttribute('aria-expanded', 'false');
    }

    positionHullPlanFlyout() {
        const flyout = this.hullPlanFlyout;
        const trigger = this.element?.querySelector(`#${this.id}-open`);
        if (!flyout || flyout.hidden || !trigger) return;

        const margin = 8;
        const anchor = trigger.getBoundingClientRect();
        const rect = flyout.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;
        const left = Math.min(
            Math.max(margin, anchor.right + margin),
            Math.max(margin, viewportWidth - rect.width - margin)
        );
        const top = Math.min(
            Math.max(margin, anchor.top),
            Math.max(margin, viewportHeight - rect.height - margin)
        );
        flyout.style.left = `${left}px`;
        flyout.style.top = `${top}px`;
    }

    close() {
        clearTimeout(this.hullPlanFlyoutHideTimer);
        this.hullPlanFlyout?.remove();
        super.close();
    }

    createNodes() {
        this.clearNodes();

        this.addNode('input', 'Class', 'Class', 0, 0.2, {
            sectionId: 'info',
            anchorId: `${this.id}-info`,
            minSpacing: 30
        });
        this.addNode('input', 'Outfit', 'Outfit', 0, 0.52, {
            sectionId: 'info',
            anchorId: `${this.id}-info`,
            minSpacing: 30,
            allowMultipleConnections: true
        });
        this.addNode('output', 'Statistics', 'Statistics', 1, 0.5, {
            sectionId: 'info',
            anchorId: `${this.id}-info`,
            minSpacing: 32
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
        this.element.classList.toggle('has-connected-hull-plan-inputs', hasConnectedInputs);
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
            shipPrototype: 'Class',
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
                console.warn(`[ShipHullsWidget ${this.id}] Unable to read connected ${inputType} data`, error);
            }

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
        const classData = classes[0]?.shipData || classes[0] || null;
        const outfits = this.getSourceData(components, 'Outfit')
            .map(data => {
                const outfit = data?.outfitData || data || {};
                return {
                    ...outfit,
                    spinalWeapon: data?.spinalWeapon || outfit.spinalWeapon || null
                };
            })
            .filter(Boolean);
        const cores = outfits.map(outfit => outfit.selectedCore).filter(Boolean);
        const hullComposition = classData?.hullComposition || {};
        const outfitModules = outfits.flatMap(outfit => outfit.systemsData?.modules || []);
        const quantumModules = outfitModules.filter(module =>
            /quantum|\bqsystem\b/i.test(`${module.moduleId || ''} ${module.name || ''}`)
        );
        const quantumHullCount = quantumModules.reduce(
            (sum, module) => sum + this.getSystemModuleSize(module),
            0
        );

        const rawCounts = {
            Emplacement: this.getCount(hullComposition, ['emplacement', 'Emplacement']),
            Hangar: this.getCount(hullComposition, ['hangar', 'Hangar']),
            Magazine: this.getCount(hullComposition, ['magazine', 'Magazine']),
            System: null,
            Quantum: quantumModules.length ? quantumHullCount : (classData ? 0 : null),
            Freight: this.getCount(hullComposition, ['freight', 'Freight', 'containment']),
            Tankage: this.getCount(hullComposition, ['tankage', 'Tankage', 'remass']),
            Core: this.getCount(hullComposition, ['core', 'Core'])
        };
        const systemHullCapacity = this.getCount(hullComposition, ['system', 'System']);
        const fittedSystemHulls = systemHullCapacity === null
            ? outfits.reduce((sum, outfit) => sum + this.numeric(outfit.systemsData?.usedSystemHulls), 0)
            : systemHullCapacity;
        rawCounts.System = fittedSystemHulls === 0 && !classData && !outfits.some(outfit =>
            outfit.systemsData?.usedSystemHulls !== undefined
        )
            ? null
            : Math.max(0, fittedSystemHulls - quantumHullCount);

        if (rawCounts.Core === null && outfits.length) {
            const outfitCore = outfits
                .map(outfit => this.getCount(outfit.resources || {}, ['core', 'Core']))
                .find(count => count !== null);
            if (outfitCore !== undefined) rawCounts.Core = outfitCore;
        }
        const classConnected = !!classData;
        const counts = {};
        for (const category of Object.keys(ShipHullsWidget.HULL_CODES)) {
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
            .map(outfit => this.getCount(outfit.resources || {}, ['utilities', 'utility']))
            .filter(value => value !== null);
        const utilityTotal = utilityValues.length
            ? utilityValues.reduce((sum, value) => sum + value, 0)
            : null;
        const sources = components.map(component => component.data);
        const hasOutfitArmor = outfits.some(outfit => outfit.defenses?.armor !== undefined);
        const armor = hasOutfitArmor
            ? outfits.reduce((sum, outfit) => sum + this.numeric(outfit.armorHits), 0)
            : this.numeric(this.getMetricValue(sources, [
                'armor', 'armour', 'activeArmor', 'activeArmour'
            ]));
        const outfitHardpoints = outfits
            .map(outfit => this.getCount(outfit.resources || {}, ['hardpoints', 'Hardpoints']))
            .find(count => count !== null);
        const hardpoints = outfitHardpoints ?? cores
            .map(core => this.getCount(core, ['hardpoints', 'Hardpoints']))
            .find(count => count !== null) ?? null;
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

    getSystemModuleSize(module) {
        const size = module.systemHulls ?? module.size ?? module.systemSize ?? module.hulls;
        return size === undefined || size === null ? 1 : this.numeric(size);
    }

    createHullItems(outfits) {
        const items = {
            Emplacement: [],
            System: [],
            Quantum: []
        };
        for (const outfit of outfits) {
            const modules = outfit.systemsData?.modules || [];
            for (const module of modules) {
                const item = {
                    name: module.name || module.moduleId || 'System module',
                    count: this.getSystemModuleSize(module),
                    moduleId: module.moduleId || null
                };
                items[/quantum|\bqsystem\b/i.test(`${module.moduleId || ''} ${module.name || ''}`) ? 'Quantum' : 'System'].push(item);
            }

            const weapons = outfit.weapons || {};
            const addWeapon = (weapon, count, arc = '') => {
                const weaponCount = this.numeric(count);
                if (!weapon || weapon.resourceType !== 'emplacements' || weaponCount < 1) return;
                const resourceCost = this.numeric(weapon.resourceCount) || 1;
                const isMain = !!weapon.isMain;
                const validArcs = Array.from(new Set(String(arc || '')
                    .split('')
                    .filter(value => (isMain ? 'PS' : 'FPSA').includes(value))));
                const arcSurcharge = (isMain ? validArcs.slice(0, 1) : validArcs).length > 1 ? 1 : 0;
                const slotsPerWeapon = resourceCost + arcSurcharge;
                for (let index = 0; index < weaponCount * slotsPerWeapon; index++) {
                    items.Emplacement.push({
                        name: weapon.name || weapon.label || weapon.id || 'Weapon',
                        resourceCost: slotsPerWeapon
                    });
                }
            };

            const spinal = outfit.spinalWeapon;
            if (weapons.spinal && spinal) addWeapon(spinal, 1);
            for (const weapon of [...(weapons.offensive || []), ...(weapons.defensive || [])]) {
                addWeapon(weapon, weapon?.count, weapon?.arc);
            }
        }
        items.Emplacement.sort((a, b) => a.resourceCost - b.resourceCost);
        return items;
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
                const normalizedKey = key.toLowerCase();
                if ((normalizedKey === 'technologies' || normalizedKey === 'technology' ||
                    normalizedKey === 'techrequirements' || normalizedKey === 'techrequirement' ||
                    normalizedKey === 'technologyid' || normalizedKey === 'technologyname' ||
                    normalizedKey === 'techid' || normalizedKey === 'techs') && item) {
                    const values = Array.isArray(item) ? item : [item];
                    for (const entry of values) {
                        if (typeof entry === 'string' && entry.trim()) found.add(entry.trim());
                        else if (entry && typeof entry === 'object') {
                            const name = entry.name || entry.id || entry.key;
                            if (name) found.add(String(name));
                            else Object.keys(entry).forEach(technology => found.add(technology));
                        }
                    }
                    visit(item);
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
        const { classData, outfits, cores, counts, components } = model;
        const ship = classData || {};
        const outfitData = outfits;
        const sources = components.map(component => component.data);
        const magneticSystems = outfitData.reduce(
            (sum, outfit) => sum + this.numeric(outfit.systemsData?.heatManagement?.magneticSystems),
            0
        );
        const reserve = this.getMetricValue(sources, ['magneticReserve', 'barrierReserve', 'magneticBarrierReserve']);
        const barriers = this.getMetricValue(sources, ['magneticBarriers', 'magneticBarrier', 'barriers']);
        const activeArmor = this.getMetricValue(sources, ['activeArmor', 'activeArmour']);
        const plasmaFields = this.getMetricValue(sources, ['plasmaFields', 'plasmaField']);
        const crewCapacity = this.getMetricValue(sources, [
            'crewBerthings', 'crewBerths', 'crewCapacity', 'berthingCapacity', 'berthCapacity'
        ]);
        const activeRadiance = this.getMetricValue(sources, ['activeRadiance']);
        const passiveRadiance = this.getMetricValue(sources, ['passiveRadiance']);
        const coreInterval = this.getMetricValue([...sources, ...cores], ['coreInterval']);
        const entropyCapacity = this.getMetricValue(sources, ['entropyCapacity']);
        const entropyBands = this.getMetricValue(sources, ['entropyBands', 'entropyBand']);
        const magazineCells = counts.Magazine * 50;
        const hangarBays = counts.Hangar * 4;

        const metric = (label, value, format = item =>
            item && typeof item === 'object' ? JSON.stringify(item) : String(item)) => ({
            label,
            value: value === undefined || value === null || value === ''
                ? 'Not available from connected data'
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
                    : magneticSystems > 0 ? `${magneticSystems} magnetic system(s); barrier/reserve not reported` : 'Not available from connected data',
                available: barriers !== null || reserve !== null
            },
            metric('Crew berthings', crewCapacity),
            metric('Hardpoints', model.hardpoints, value => String(value)),
            metric('Active radiance', activeRadiance),
            metric('Passive radiance', passiveRadiance),
            metric('Core interval', coreInterval),
            metric('Entropy capacity', entropyCapacity),
            metric('Entropy bands', entropyBands),
            metric('Magazine cells', magazineCells, value => String(value)),
            metric('Hangar bays', hangarBays, value => String(value))
        ];
    }

    static get HULL_CODES() {
        return {
            Emplacement: 'E',
            Hangar: 'H',
            Magazine: 'M',
            System: 'S',
            Quantum: 'Q',
            Freight: 'F',
            Tankage: 'T',
            Core: 'C'
        };
    }

    static get STACK_ORDER() {
        return ['Core', 'Quantum'];
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
        for (const category of ShipHullsWidget.STACK_ORDER) {
            for (let index = 0; index < (counts[category] || 0); index++) {
                const slot = descending[cells.length];
                if (!slot) break;
                cells.push({ ...slot, category });
            }
        }
        const occupied = new Set(cells.map(cell => `${cell.row}:${cell.col}`));
        const flowSlots = slots.filter(slot => !occupied.has(`${slot.row}:${slot.col}`));
        let flowIndex = 0;
        for (const category of ShipHullsWidget.FLOW_ORDER) {
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
        const metrics = this.getMetrics(model);
        const armorSection = document.createElement('section');
        armorSection.className = 'widget-section hull-plan-metrics-section';
        const armorTitle = document.createElement('h4');
        armorTitle.className = 'section-title';
        armorTitle.textContent = 'Armor & field systems';
        const armorContent = document.createElement('div');
        armorContent.className = 'section-content';
        armorContent.appendChild(this.createTable(null, [
            metrics[0], metrics[1], metrics[2]
        ]));
        armorSection.append(armorTitle, armorContent);
        container.appendChild(armorSection);

        if (this.hullPlanFlyoutContent) this.hullPlanFlyoutContent.replaceChildren();
        const layout = this.createLayout(model.counts);
        const armorCount = this.numeric(model.armor);
        const utilityCount = this.numeric(model.utilityTotal);
        if (!layout.cells.length && armorCount === 0 && utilityCount === 0) {
            const empty = document.createElement('div');
            empty.className = 'hull-plan-empty';
            empty.textContent = model.classData
                ? 'No hulls are allocated in the connected ship class.'
                : 'Connect a Ship Class and/or Outfit to populate the hull plan.';
            (this.hullPlanFlyoutContent || container).appendChild(empty);
        } else {
            const grid = document.createElement('div');
            grid.className = 'hull-plan-grid';
            const cols = layout.cols || Math.max(1, Math.ceil(Math.sqrt(Math.max(armorCount, utilityCount))));
            grid.setAttribute('role', 'grid');
            const appendRow = cells => {
                const row = document.createElement('div');
                row.className = 'hull-plan-row';
                for (let colIndex = 0; colIndex < cols; colIndex++) {
                    row.appendChild(cells[colIndex] || document.createElement('span'));
                }
                grid.appendChild(row);
            };
            const appendTiles = (table, title) => {
                table.forEach(row => {
                    appendRow(row.map(code => {
                        if (!code) return null;
                        const cell = document.createElement('div');
                        const tileType = { D: 'armor', A: 'hardpoint', U: 'utility' }[code] || code.toLowerCase();
                        cell.className = `hull-plan-cell hull-plan-${tileType}`;
                        cell.setAttribute('role', 'gridcell');
                        cell.title = title;
                        cell.setAttribute('aria-label', `${title}: ${code}`);
                        const label = document.createElement('strong');
                        label.className = 'hull-plan-cell-code';
                        label.textContent = code;
                        cell.appendChild(label);
                        return cell;
                    }));
                });
            };

            appendTiles(this.buildArmorTable(model.armor, model.hardpoints, cols), 'Armour/Hardpoints');
            appendTiles(this.blockTable(model.utilityTotal, cols, 'U'), 'Utilities');

            const hullRows = Array.from({ length: layout.rows }, () => new Array(cols).fill(null));
            const totals = {};
            layout.cells.forEach(cell => {
                totals[cell.category] = (totals[cell.category] || 0) + 1;
                const element = document.createElement('div');
                element.className = `hull-plan-cell hull-plan-${cell.category.toLowerCase()}`;
                element.setAttribute('role', 'gridcell');

                const code = document.createElement('strong');
                code.className = 'hull-plan-cell-code';
                code.textContent = ShipHullsWidget.HULL_CODES[cell.category];
                element.appendChild(code);

                const items = (model.hullItems[cell.category] || []);
                const item = items[totals[cell.category] - 1];
                if (cell.category === 'Emplacement' && item) {
                    const costLabel = `${item.resourceCost} emplacement${item.resourceCost === 1 ? '' : 's'}`;
                    element.title = `${item.name} (${costLabel})`;
                    element.setAttribute('aria-label', `${ShipHullsWidget.HULL_CODES[cell.category]}: ${item.name} (${costLabel})`);
                } else {
                    element.title = cell.category === 'Emplacement'
                        ? 'Unassigned emplacement'
                        : ShipHullsWidget.HULL_CODES[cell.category];
                    element.setAttribute('aria-label', `${ShipHullsWidget.HULL_CODES[cell.category]}: ${cell.category}`);
                }
                hullRows[cell.row][cell.col] = element;
            });
            hullRows.forEach(row => appendRow(row));
            (this.hullPlanFlyoutContent || container).appendChild(grid);
        }
        this.positionHullPlanFlyout();

        container.appendChild(this.createTable(null, metrics.slice(3)));
        if (model.technologies.length) {
            const techSection = document.createElement('section');
            techSection.className = 'hull-plan-technologies';
            const techTitle = document.createElement('h4');
            techTitle.textContent = 'Technologies';
            const techList = document.createElement('p');
            techList.textContent = model.technologies.join(', ');
            techSection.append(techTitle, techList);
            container.appendChild(techSection);
        }
    }

    createTable(title, rows) {
        const table = document.createElement('table');
        table.className = 'hull-plan-table';
        if (title) {
            const caption = document.createElement('caption');
            caption.textContent = title;
            table.appendChild(caption);
        }
        const body = document.createElement('tbody');
        for (const row of rows) {
            const tr = document.createElement('tr');
            const label = document.createElement('th');
            label.scope = 'row';
            label.textContent = row.label;
            const value = document.createElement('td');
            value.textContent = row.value;
            if (!row.available) value.className = 'unavailable';
            tr.append(label, value);
            body.appendChild(tr);
        }
        table.appendChild(body);
        return table;
    }

    getExportData() {
        const components = this.getConnectedComponents();
        const model = this.getModel(components);
        const metrics = this.getMetrics(model);
        const layout = this.createLayout(model.counts);
        return {
            schema: 'fv-tactical.hull-plan/v1',
            hullPlan: {},
            hullCodes: { ...ShipHullsWidget.HULL_CODES },
            layout: {
                rows: layout.rows,
                columns: layout.cols,
                missingSlots: layout.missing,
                cells: layout.cells.map(cell => ({
                    row: cell.row + 1,
                    column: cell.col + 1,
                    type: cell.category,
                    code: ShipHullsWidget.HULL_CODES[cell.category]
                }))
            },
            totals: {
                hulls: model.total,
                utility: model.utilityTotal,
                containmentHullBasis: model.containmentHullBasis,
                byHullType: model.counts,
                requested: metrics
            },
            technologies: model.technologies,
            unavailableMetrics: metrics.filter(item => !item.available).map(item => item.label),
            components
        };
    }

    downloadJSON() {
        const payload = this.getExportData();
        if (typeof Blob === 'undefined' || !window.URL?.createObjectURL) return payload;
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'hull-plan.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 0);
        return payload;
    }

    refreshPlan() {
        if (!this.element) return;
        const container = this.element.querySelector(`#${this.id}-plan-view`);
        if (!container) return;
        this.renderPlan(container, this.getModel());
    }

    renderSummary(container) {
        if (!container) return;
        container.replaceChildren();
        const title = document.createElement('div');
        title.className = 'summary-title';
        title.textContent = 'Hull Plan';
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
