class ShipCoreWidget extends DesignWidget {
    static optionsPromise = null;
    static options = null;

    static loadOptions() {
        if (!this.optionsPromise) {
            this.optionsPromise = fetch('data/ship-cores.json')
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                })
                .then(options => {
                    const components = ['reactor', 'engine', 'manifold'];
                    if (!options || components.some(component =>
                        !options[component]?.options || typeof options[component].options !== 'object'
                    )) {
                        throw new Error('Ship core data must define reactor, engine, and manifold options');
                    }
                    this.options = options;
                    return options;
                })
                .catch(error => {
                    this.optionsPromise = null;
                    throw error;
                });
        }
        return this.optionsPromise;
    }

    // Core cost in CV/IP: reactor threshold, engine thrust demand, and manifold entropy capacity.
    static calculateCost(core, hulls, options = this.options) {
        if (!core || !options || !Number.isFinite(hulls) || hulls <= 0) return null;
        const isSelected = component => Boolean(core[component] && options[component]?.options?.[core[component]]);
        const reactor = isSelected('reactor')
            ? Math.floor(Number(core.reactorStability) || 0) * options.reactor.costPerThreshold
            : 0;
        let engine = 0;
        if (isSelected('engine')) {
            const metrics = OutfitWidget.calculateGearBurnMetrics(hulls, core.engineEfficiency, 0);
            if (metrics) {
                const reactionFactor = options.engine.options[core.engine].reaction ? 1 / 3 : 1;
                engine = Math.pow(metrics.thrustRequired, 1 / core.engineEfficiency) * hulls * reactionFactor;
            }
        }
        const entropy = isSelected('manifold') ? Math.floor(hulls * (Number(core.manifoldEfficiency) || 0)) : 0;
        const manifold = entropy * options.manifold.costPerEntropy;
        return { reactor, engine, manifold, entropy, total: reactor + engine + manifold };
    }

    static formatCost(value) {
        const unit = window.empire?.economyMode === 'campaign' ? 'IP' : 'CV';
        return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`;
    }

    constructor(x = 100, y = 100) {
        super('shipCore', 'Ship Core', x, y);
        this.coreData = {
            name: 'Ship Core',
            role: '',
            notes: '',
            operational: false,
            ignoreRequiredTech: false,
            developmentCost: 0,
            powerplantSize: 1,
            reactor: '',
            engine: '',
            manifold: '',
            reactorValue: 5,
            engineValue: 5,
            manifoldValue: 5,
            reactorStability: 2,
            engineEfficiency: 2,
            manifoldEfficiency: 2,
            gears: [{ name: 'Normal', instability: 1 }]
        };
        this.coreUpdateTimer = null;
        this.coreOptions = null;
        this.init();
        this.loadCoreOptions();
    }

    get designData() {
        return this.coreData;
    }

    get defaultTitle() {
        return 'Ship Core';
    }

    async loadCoreOptions() {
        try {
            this.coreOptions = await ShipCoreWidget.loadOptions();
        } catch (error) {
            this.reportCatalogueError('Ship core catalogue (data/ship-cores.json)', error);
            return;
        }
        ['reactor', 'engine', 'manifold'].forEach(component => {
            if (this.coreData[component]) return;
            const availableOptions = this.getComponentOptions(component);
            const highestOption = availableOptions[availableOptions.length - 1];
            if (highestOption) {
                this.coreData[component] = highestOption.key;
            }
        });
        this.refresh();
    }

    populateTechDropdowns() {
        ['reactor', 'engine', 'manifold'].forEach(component => {
            const select = document.getElementById(`${this.id}-${component}`);
            if (select) {
                this.populateDropdown(
                    select,
                    this.getComponentOptions(component),
                    this.coreData[component],
                    component
                );
            }
        });
    }

    populateDropdown(selectElement, techList, selectedValue, component) {
        while (selectElement.options.length > 0) {
            selectElement.remove(0);
        }

        let hasSelection = false;
        // Add tech options
        techList.forEach(tech => {
            const option = document.createElement('option');
            option.value = tech.key;
            option.textContent = tech.name;
            if (tech.key === selectedValue) {
                option.selected = true;
                hasSelection = true;
            }
            selectElement.appendChild(option);
        });
        if (selectedValue && !hasSelection) {
            const saved = this.coreOptions?.[component]?.options?.[selectedValue];
            const option = document.createElement('option');
            option.value = selectedValue;
            option.textContent = `${saved?.name || selectedValue} (unavailable)`;
            option.selected = true;
            selectElement.appendChild(option);
            hasSelection = true;
        }
        if (!hasSelection) {
            selectElement.selectedIndex = -1;
        }
    }

    // Options whose required technologies are researched (or all, when ignoring required tech).
    getComponentOptions(component) {
        const options = this.coreOptions?.[component]?.options || {};
        return Object.entries(options)
            .map(([key, option]) => ({ key, ...option }))
            .filter(option => this.isOptionAvailable(option));
    }

    isOptionAvailable(option) {
        return super.isOptionAvailable(option);
    }

    getSelectedRequiredTech() {
        const required = ['reactor', 'engine', 'manifold'].flatMap(component =>
            this.coreOptions?.[component]?.options?.[this.coreData[component]]?.requiredTech || []);
        return Array.from(new Set(required));
    }

    // Output = formula(selected tech parameters, pips allocated, core size).
    recomputeStats() {
        if (!this.coreOptions) return;
        ['reactor', 'engine', 'manifold'].forEach(component => {
            const def = this.coreOptions[component];
            if (!def?.statField) return;
            const option = def.options?.[this.coreData[component]];
            const pips = this.coreData[`${component}Value`];
            let value;
            if (!option) {
                value = def.defaultStat;
            } else if (def.formula === 'base * pips * coreSize') {
                value = option.base * pips * this.coreData.powerplantSize;
            } else if (def.formula === 'base + perPip * pips') {
                value = option.base + option.perPip * pips;
            }
            if (!Number.isFinite(value)) return;
            value = Math.round(value * 10000) / 10000;
            this.coreData[def.statField] = value;
            const inputId = def.statField.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
            const valueElement = document.getElementById(`${this.id}-${inputId}`);
            if (valueElement) valueElement.textContent = value;
        });
        this.refreshCostDisplay();
    }

    scheduleCoreUpdate() {
        window.clearTimeout(this.coreUpdateTimer);
        this.coreUpdateTimer = window.setTimeout(() => this.flushCoreUpdate(), 50);
    }

    flushCoreUpdate() {
        window.clearTimeout(this.coreUpdateTimer);
        this.coreUpdateTimer = null;
        this.recomputeStats();
        this.refreshSummary();
        this.notifyChildrenOfChange();
    }

    getClassHullCount() {
        const composition = this.getConnectedClassData()?.hullComposition;
        if (!composition || typeof composition !== 'object') return null;
        return Object.values(composition).reduce((total, count) => {
            const number = Number(count);
            return total + (Number.isFinite(number) && number > 0 ? number : 0);
        }, 0);
    }

    isConnectedToOutfit() {
        return Array.from(this.children).some(id => window.widgetManager?.getWidget(id)?.type === 'outfit');
    }

    onChildrenChanged() {
        this.refreshCostDisplay();
    }

    // Hidden while an outfit shows this core's cost instead.
    refreshCostDisplay() {
        this.refreshDevelopmentMetric();
        const totals = this.getCostTotals();
        this.setHeaderMetric('cost', '', Object.keys(totals).length ? this.formatCostTotals(totals) : null);
    }

    getCostTotals() {
        if (this.isConnectedToOutfit()) return {};
        const cost = ShipCoreWidget.calculateCost(this.coreData, this.getClassHullCount(), this.coreOptions);
        if (!cost) return {};
        return { [window.empire?.economyMode === 'campaign' ? 'IP' : 'CV']: cost.total };
    }

    onEconomyModeChanged() {
        this.refreshCostDisplay();
    }

    // Called when tech tree changes - refresh tech-dependent content
    onTechTreeUpdated() {
        this.refresh();
    }

    createContent(contentElement) {
        const sections = contentElement.querySelector('.widget-sections');
        
        // Header section with flags
        const headerSection = this.createDesignSection('header', '');
        this.setSectionContent(headerSection, this.renderFlags());
        sections.appendChild(headerSection.section);

        // Components section
        const componentsSection = this.createDesignSection('components', 'Components');
        componentsSection.contentContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;">
                <div class="input-group">
                    <label for="${this.id}-reactor">Reactor</label>
                    <select id="${this.id}-reactor" class="component-dropdown">
                    ${this.getComponentOptions('reactor').map(t =>
                            `<option value="${t.key}" ${this.coreData.reactor === t.key ? 'selected' : ''}>${t.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="input-group">
                    <label for="${this.id}-engine">Engine</label>
                    <select id="${this.id}-engine" class="component-dropdown">
                    ${this.getComponentOptions('engine').map(t =>
                            `<option value="${t.key}" ${this.coreData.engine === t.key ? 'selected' : ''}>${t.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="input-group">
                    <label for="${this.id}-manifold">Manifold</label>
                    <select id="${this.id}-manifold" class="component-dropdown">
                    ${this.getComponentOptions('manifold').map(t =>
                            `<option value="${t.key}" ${this.coreData.manifold === t.key ? 'selected' : ''}>${t.name}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
            <div class="composition-item">
                <label for="${this.id}-powerplant">Power Plant Size</label>
                <input type="number" min="1" step="1" id="${this.id}-powerplant" value="${this.coreData.powerplantSize}" class="hull-spin core-powerplant-size">
                <output class="composition-value core-powerplant-value" id="${this.id}-powerplant-value" aria-label="Powerplant size"></output>
            </div>
        `;
        sections.appendChild(componentsSection.section);

        // Triangle widget section
        const triangleSection = this.createDesignSection('triangle', 'Distribution');
        const triangleContent = `
            <div class="core-triangle-container">
                <div class="core-triangle" id="${this.id}-triangle-widget"></div>
                <div class="triangle-values">
                    <div class="triangle-component">
                        <div class="triangle-component-title">Manifold</div>
                        <div class="triangle-value">
                            <span>Pips:</span>
                            <span id="${this.id}-manifold-value">${this.coreData.manifoldValue}</span>
                        </div>
                        <div class="triangle-value">
                            <span>Multiplier:</span>
                            <span id="${this.id}-manifold-efficiency">${this.coreData.manifoldEfficiency}</span>
                        </div>
                    </div>
                    <div class="triangle-component">
                        <div class="triangle-component-title">Reactor</div>
                        <div class="triangle-value">
                            <span>Pips:</span>
                            <span id="${this.id}-reactor-value">${this.coreData.reactorValue}</span>
                        </div>
                        <div class="triangle-value">
                            <span>Threshold:</span>
                            <span id="${this.id}-reactor-stability">${this.coreData.reactorStability}</span>
                        </div>
                    </div>
                    <div class="triangle-component">
                        <div class="triangle-component-title">Engine</div>
                        <div class="triangle-value">
                            <span>Pips:</span>
                            <span id="${this.id}-engine-value">${this.coreData.engineValue}</span>
                        </div>
                        <div class="triangle-value">
                            <span>Exponent:</span>
                            <span id="${this.id}-engine-efficiency">${this.coreData.engineEfficiency}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        triangleSection.contentContainer.innerHTML = triangleContent;
        sections.appendChild(triangleSection.section);

        const gearingSection = this.createDesignSection('gearing', 'Gears');
        gearingSection.section.classList.add('outfit-category-section', 'core-gears-section');
        gearingSection.titleElement.classList.add('outfit-category-title');
        gearingSection.titleElement.replaceChildren();
        const gearsToggle = document.createElement('button');
        gearsToggle.type = 'button';
        gearsToggle.className = 'outfit-category-toggle';
        gearsToggle.setAttribute('aria-expanded', 'true');
        gearsToggle.setAttribute('aria-controls', `${this.id}-gears-content`);
        gearsToggle.textContent = 'Gears';
        gearsToggle.addEventListener('click', () => {
            const expanded = gearsToggle.getAttribute('aria-expanded') !== 'true';
            gearingSection.section.classList.toggle('is-collapsed', !expanded);
            gearsToggle.setAttribute('aria-expanded', String(expanded));
        });
        gearingSection.titleElement.appendChild(gearsToggle);
        this.setSectionContent(gearingSection, `
            <div id="${this.id}-gears-content" class="outfit-category-content">
                <button type="button" id="${this.id}-add-gear" class="widget-add-action">Add</button>
                <div id="${this.id}-gears" class="core-gears"></div>
            </div>
        `);
        sections.appendChild(gearingSection.section);

        this.renderGears();
        this.renderTriangleWidget();
    }

    setupEventListeners() {
        // Call parent class setupEventListeners to enable dragging
        super.setupEventListeners();

        this.setupFlagListeners(() => {
            this.refresh();
            this.refreshOutfitCoreAvailability();
        });
        const operationalCheckbox = this.element?.querySelector(`#${this.id}-operational`);
        operationalCheckbox?.addEventListener('change', () => this.refreshOutfitCoreAvailability());
        const powerplantInput = this.getPowerplantInput();
        if (powerplantInput) {
            powerplantInput.addEventListener('input', (e) => {
                if (powerplantInput.disabled || powerplantInput.readOnly) {
                    this.refreshPowerplantSize();
                    return;
                }
                this.coreData.powerplantSize = parseInt(e.target.value, 10) || 1;
                this.recomputeStats();
                this.refreshSummary();
                this.notifyChildrenOfChange();
            });
        }

        // Component dropdowns
        ['reactor', 'engine', 'manifold'].forEach(component => {
            const select = document.getElementById(`${this.id}-${component}`);
            if (select) {
                select.addEventListener('change', (e) => {
                    this.coreData[component] = e.target.value;
                    this.recomputeStats();
                    this.refreshSummary();
                    this.notifyChildrenOfChange();
                });
            }
        });

        const addGearButton = document.getElementById(`${this.id}-add-gear`);
        if (addGearButton) {
            addGearButton.addEventListener('click', () => {
                if (this.coreData.gears.length >= 4) return;
                this.coreData.gears.push({
                    instability: 1
                });
                this.renderGears();
                this.refreshSummary();
                this.notifyChildrenOfChange();
            });
        }

        this.element?.addEventListener('mouseleave', () => this.sortGearsByInstability());
    }

    getGearNames(count) {
        return {
            1: ['Normal'],
            2: ['Low', 'High'],
            3: ['Low', 'High', 'Cruise'],
            4: ['Low', 'Medium', 'High', 'Cruise']
        }[count] || [];
    }

    renderGears() {
        const container = this.element?.querySelector(`#${this.id}-gears`);
        if (!container) return;
        container.replaceChildren();
        this.coreData.gears = this.coreData.gears.slice(0, 4);
        const names = this.getGearNames(this.coreData.gears.length);
        const addGearButton = this.element.querySelector(`#${this.id}-add-gear`);
        if (addGearButton) addGearButton.disabled = this.coreData.gears.length >= 4;
        this.coreData.gears.forEach((gear, index) => {
            gear.name = names[index];
            const row = document.createElement('div');
            row.className = 'composition-item core-gear-row';
            const instabilityInputId = `${this.id}-gear-instability-${index}`;
            row.innerHTML = `
                <label class="core-gear-name" for="${instabilityInputId}">${gear.name}</label>
                <div class="hull-controls">
                    <input id="${instabilityInputId}" type="number" class="hull-spin" min="1" step="1" data-gear-instability="${index}" aria-label="${gear.name} instability">
                    <button type="button" class="widget-remove-action" data-remove-gear="${index}" aria-label="Remove gear ${index + 1}">×</button>
                </div>
            `;
            const instabilityInput = row.querySelector(`[data-gear-instability="${index}"]`);
            gear.instability = Math.max(1, Number.parseInt(gear.instability, 10) || 1);
            instabilityInput.value = gear.instability;
            instabilityInput.addEventListener('input', () => {
                gear.instability = Math.max(1, Number.parseInt(instabilityInput.value, 10) || 1);
                this.refreshSummary();
                this.notifyChildrenOfChange();
            });
            instabilityInput.addEventListener('change', () => {
                instabilityInput.value = gear.instability;
            });
            row.querySelector('[data-remove-gear]').addEventListener('click', () => {
                this.coreData.gears.splice(index, 1);
                this.renderGears();
                this.refreshSummary();
                this.notifyChildrenOfChange();
            });
            container.appendChild(row);
        });

    }

    sortGearsByInstability() {
        const sorted = [...this.coreData.gears].sort((first, second) =>
            (Number(first.instability) || 0) - (Number(second.instability) || 0)
        );
        if (sorted.every((gear, index) => gear === this.coreData.gears[index])) return;
        this.coreData.gears = sorted;
        this.renderGears();
        this.refreshSummary();
        this.notifyChildrenOfChange();
    }

    renderTriangleWidget() {
        const container = this.element?.querySelector(`#${this.id}-triangle-widget`);
        if (!container) {
            throw new Error(`Ship Core distribution widget is missing for ${this.id}.`);
        }

        const width = 300;
        const height = 250;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.style.cursor = 'crosshair';
        canvas.setAttribute('aria-label', 'Adjust reactor, engine, and manifold distribution');

        const ctx = canvas.getContext('2d');
        this.drawTriangle(ctx, width, height);

        container.innerHTML = '';
        container.appendChild(canvas);

        // Store triangle parameters for drag handling
        const margin = 34;
        const bottomY = height - 26;
        const triangleHeight = (width - 2 * margin) * Math.sqrt(3) / 2;
        const triangleParams = {
            width,
            height,
            margin,
            top: [width / 2, bottomY - triangleHeight],
            bottomLeft: [margin, bottomY],
            bottomRight: [width - margin, bottomY]
        };

        // Add mouse interaction - both click and drag
        let isDraggingIndicator = false;
        
        const updateIndicator = (e) => this.updateTriangleIndicator(e, canvas, triangleParams);
        
        canvas.addEventListener('mousedown', (e) => {
            isDraggingIndicator = true;
            updateIndicator(e);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDraggingIndicator) {
                updateIndicator(e);
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isDraggingIndicator) {
                isDraggingIndicator = false;
                this.flushCoreUpdate();
            }
        });
    }

    redrawTriangleCanvas(canvas, width, height) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.drawTriangle(ctx, width, height);
    }

    drawTriangle(ctx, width, height) {
        const margin = 34;
        const bottomY = height - 18;
        const triangleHeight = (width - 2 * margin) * Math.sqrt(3) / 2;

        // Triangle vertices
        const top = [width / 2, bottomY - triangleHeight];
        const bottomLeft = [margin, bottomY];
        const bottomRight = [width - margin, bottomY];

        ctx.beginPath();
        ctx.moveTo(top[0], top[1]);
        ctx.lineTo(bottomLeft[0], bottomLeft[1]);
        ctx.lineTo(bottomRight[0], bottomRight[1]);
        ctx.closePath();
        ctx.fillStyle = 'rgba(74, 144, 226, 0.08)';
        ctx.fill();

        ctx.strokeStyle = '#5b9ee8';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(top[0], top[1]);
        ctx.lineTo(bottomLeft[0], bottomLeft[1]);
        ctx.lineTo(bottomRight[0], bottomRight[1]);
        ctx.closePath();
        ctx.stroke();

        // Draw the three directions of the 12-step allocation grid.
        ctx.strokeStyle = 'rgba(190, 205, 225, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 12; i++) {
            const t = i / 12;
            [
                [this.lerpPoint(top, bottomLeft, t), this.lerpPoint(top, bottomRight, t)],
                [this.lerpPoint(top, bottomRight, t), this.lerpPoint(bottomLeft, bottomRight, t)],
                [this.lerpPoint(top, bottomLeft, t), this.lerpPoint(bottomRight, bottomLeft, t)]
            ].forEach(([start, end]) => {
                ctx.beginPath();
                ctx.moveTo(start[0], start[1]);
                ctx.lineTo(end[0], end[1]);
                ctx.stroke();
            });
        }

        const drawVertexLabel = (text, point, angle, baseline = 'middle') => {
            ctx.save();
            ctx.translate(point[0], point[1]);
            ctx.rotate(angle);
            ctx.fillStyle = '#d2dae5';
            ctx.font = '600 12px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = baseline;
            ctx.fillText(text, 0, 0);
            ctx.restore();
        };
        const outwardOffset = 12;
        const manifoldLabelPoint = this.lerpPoint(bottomLeft, top, 0.16);
        const engineLabelPoint = this.lerpPoint(bottomRight, top, 0.16);
        drawVertexLabel('Reactor', top, 0, 'bottom');
        drawVertexLabel('Manifold', [
            manifoldLabelPoint[0] - Math.sqrt(3) / 2 * outwardOffset,
            manifoldLabelPoint[1] - 0.5 * outwardOffset
        ], -Math.PI / 3);
        drawVertexLabel('Engine', [
            engineLabelPoint[0] + Math.sqrt(3) / 2 * outwardOffset,
            engineLabelPoint[1] - 0.5 * outwardOffset
        ], Math.PI / 3);

        // Draw indicator at current position
        this.drawTriangleIndicator(ctx, top, bottomLeft, bottomRight);
    }

    drawTriangleIndicator(ctx, top, bottomLeft, bottomRight) {
        const r = (this.coreData.reactorValue - 1) / 12;
        const e = (this.coreData.engineValue - 1) / 12;
        const m = (this.coreData.manifoldValue - 1) / 12;

        const pos = [
            r * top[0] + e * bottomRight[0] + m * bottomLeft[0],
            r * top[1] + e * bottomRight[1] + m * bottomLeft[1]
        ];

        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(pos[0], pos[1], 6, 0, Math.PI * 2);
        ctx.fill();
    }

    updateTriangleIndicator(e, canvas, triangleParams) {
        const rect = canvas.getBoundingClientRect();

        let x = (e.clientX - rect.left) * (canvas.width / rect.width);
        let y = (e.clientY - rect.top) * (canvas.height / rect.height);

        const { top, bottomLeft, bottomRight, width, height } = triangleParams;

        // Clamp coordinates to triangle bounds
        const clampedCoords = this.clampPointToTriangle(x, y, top, bottomLeft, bottomRight);
        x = clampedCoords[0];
        y = clampedCoords[1];

        const { reactor, engine, manifold } = this.calculateTriangleCoordinates(x, y, top, bottomLeft, bottomRight);
        const values = this.getTriangleValues([reactor, engine, manifold]);
        [this.coreData.reactorValue, this.coreData.engineValue, this.coreData.manifoldValue] = values;

        document.getElementById(`${this.id}-reactor-value`).textContent = this.coreData.reactorValue;
        document.getElementById(`${this.id}-engine-value`).textContent = this.coreData.engineValue;
        document.getElementById(`${this.id}-manifold-value`).textContent = this.coreData.manifoldValue;

        // Redraw the canvas to show updated indicator position
        this.redrawTriangleCanvas(canvas, width, height);

        this.scheduleCoreUpdate();
    }

    getTriangleValues(weights) {
        const normalizedWeights = weights.map(weight =>
            Number.isFinite(weight) && weight > 0 ? weight : 0
        );
        const total = normalizedWeights.reduce((sum, weight) => sum + weight, 0);
        const allocations = (total > 0
            ? normalizedWeights.map(weight => weight / total * 12)
            : [4, 4, 4]);
        const values = allocations.map(allocation => Math.floor(allocation));
        const remaining = 12 - values.reduce((sum, value) => sum + value, 0);
        const remainders = allocations
            .map((allocation, index) => ({ index, remainder: allocation - values[index] }))
            .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
        for (let index = 0; index < remaining; index++) {
            values[remainders[index].index]++;
        }
        return values.map(value => value + 1);
    }

    calculateTriangleCoordinates(x, y, top, bottomLeft, bottomRight) {
        // Barycentric coordinate calculation
        // Vertices: top=Reactor, bottomLeft=Manifold, bottomRight=Engine
        const A = this.triangleArea(top, bottomLeft, bottomRight);
        // Area opposite to each vertex gives that vertex's coordinate
        const A1 = this.triangleArea([x, y], bottomLeft, bottomRight);  // Area opposite to Reactor = Reactor coordinate
        const A2 = this.triangleArea(top, [x, y], bottomRight);        // Area opposite to Manifold = Manifold coordinate
        const A3 = this.triangleArea(top, bottomLeft, [x, y]);         // Area opposite to Engine = Engine coordinate

        return {
            reactor: A1 / A,
            manifold: A2 / A,
            engine: A3 / A
        };
    }

    triangleArea(p1, p2, p3) {
        return Math.abs((p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1])) / 2);
    }

    lerpPoint(a, b, t) {
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }

    clampPointToTriangle(x, y, top, bottomLeft, bottomRight) {
        // Check if point is inside the triangle using barycentric coordinates
        const coords = this.calculateTriangleCoordinates(x, y, top, bottomLeft, bottomRight);
        
        // For a point to be inside the triangle:
        // 1. All barycentric coordinates must be >= 0
        // 2. All barycentric coordinates must be <= 1
        // 3. Their sum must equal 1 (within floating point tolerance)
        const sum = coords.reactor + coords.manifold + coords.engine;
        const epsilon = 0.001; // Floating point tolerance
        
        if (coords.reactor >= 0 && coords.reactor <= 1 &&
            coords.manifold >= 0 && coords.manifold <= 1 &&
            coords.engine >= 0 && coords.engine <= 1 &&
            Math.abs(sum - 1) < epsilon) {
            return [x, y]; // Point is inside, return as-is
        }
        
        // Point is outside, find the closest point on the triangle boundary
        // Calculate distances to each edge and find the closest point on the nearest edge
        
        const edges = [
            { p1: top, p2: bottomLeft, name: 'left' },
            { p1: bottomLeft, p2: bottomRight, name: 'bottom' },
            { p1: bottomRight, p2: top, name: 'right' }
        ];
        
        let closestPoint = [x, y];
        let minDistance = Infinity;
        
        for (const edge of edges) {
            const closestOnEdge = this.closestPointOnLineSegment(x, y, edge.p1[0], edge.p1[1], edge.p2[0], edge.p2[1]);
            const distance = Math.hypot(closestOnEdge[0] - x, closestOnEdge[1] - y);
            
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = closestOnEdge;
            }
        }
        
        return closestPoint;
    }

    closestPointOnLineSegment(px, py, x1, y1, x2, y2) {
        // Find the closest point on a line segment to a given point
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSq = dx * dx + dy * dy;
        
        if (lengthSq === 0) return [x1, y1]; // Segment is a point
        
        // Calculate the projection of (px, py) onto the line
        let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t)); // Clamp to [0, 1]
        
        return [x1 + t * dx, y1 + t * dy];
    }

    createNodes() {
        this.clearNodes();
        this.addNode('input', 'Class', 'Class', 0, 0.25, {
            sectionId: 'header',
            anchorId: `${this.id}-header`,
            optional: true
        });
        this.addNode('output', 'Core', 'Core', 1, 0.5, {
            sectionId: 'header',
            anchorId: `${this.id}-header`,
            optional: true
        });
        this.reflowNodes();
        this.refreshPowerplantSize();
    }

    getConnectedClassData() {
        const linked = this.getConnectedDataByNodeType('Class')[0]?.data;
        return linked?.shipData || null;
    }

    getPowerplantInput() {
        return this.element?.querySelector('.core-powerplant-size') || null;
    }

    getPowerplantOutput() {
        return this.element?.querySelector('.core-powerplant-value') || null;
    }

    refreshPowerplantSize() {
        const classInputNode = Array.from(this.nodes.values()).find(node =>
            node.type === 'input' && node.nodeType === 'Class'
        );
        const isClassConnected = !!classInputNode?.connections?.size;
        const classData = this.getConnectedClassData();
        const powerplantInput = this.getPowerplantInput();
        const powerplantOutput = this.getPowerplantOutput();
        if (!isClassConnected) {
            if (powerplantInput) {
                powerplantInput.readOnly = false;
                powerplantInput.disabled = false;
                powerplantInput.min = '1';
                powerplantInput.hidden = false;
            }
            if (powerplantOutput) powerplantOutput.hidden = true;
            this.refreshCostDisplay();
            return;
        }

        if (powerplantInput) {
            powerplantInput.readOnly = true;
            powerplantInput.disabled = true;
            powerplantInput.min = '0';
            powerplantInput.hidden = true;
        }
        if (powerplantOutput) powerplantOutput.hidden = false;
        if (!classData) return;
        const coreHulls = Number(classData.hullComposition?.core ?? 0);
        if (!Number.isFinite(coreHulls) || coreHulls < 0) {
            console.warn(`[ShipCoreWidget ${this.id}] Connected class has an invalid core hull count`);
            return;
        }
        this.coreData.powerplantSize = Math.floor(coreHulls);
        if (powerplantInput) {
            powerplantInput.value = String(this.coreData.powerplantSize);
        }
        if (powerplantOutput) powerplantOutput.textContent = String(this.coreData.powerplantSize);
        this.recomputeStats();
    }

    getContainmentHullCount() {
        const classData = this.getConnectedClassData();
        const composition = classData?.hullComposition || {};
        const containmentHulls = Number(classData?.containmentHulls);
        if (classData?.containmentHulls !== null && classData?.containmentHulls !== undefined &&
            classData.containmentHulls !== '' && Number.isFinite(containmentHulls) && containmentHulls >= 0) {
            return containmentHulls;
        }
        const freight = Number(composition.freight ?? 0);
        const tankage = Number(composition.tankage ?? 0);
        return Number.isFinite(freight) && Number.isFinite(tankage)
            ? Math.max(0, freight + tankage)
            : 0;
    }

    getHardpointCapacity() {
        if (!this.getConnectedClassData()) return null;
        const containmentHulls = this.getContainmentHullCount();
        const capacity = Math.pow(containmentHulls, 2 / 3);
        return Math.floor(capacity + Number.EPSILON * Math.max(1, capacity));
    }

    getSerializedData() {
        const gears = this.coreData.gears.map(gear => {
            const savedGear = { ...gear };
            delete savedGear.burnRatio;
            delete savedGear.adjustedRatio;
            delete savedGear.entropy;
            delete savedGear.remassPerBurn;
            return savedGear;
        });
        return {
            ...this.coreData,
            gears,
            shipData: this.getConnectedClassData(),
            reactorName: this.coreOptions?.reactor?.options?.[this.coreData.reactor]?.name || '',
            engineName: this.coreOptions?.engine?.options?.[this.coreData.engine]?.name || '',
            manifoldName: this.coreOptions?.manifold?.options?.[this.coreData.manifold]?.name || '',
            requiredTech: this.getSelectedRequiredTech(),
            cost: ShipCoreWidget.calculateCost(this.coreData, this.getClassHullCount(), this.coreOptions)?.total ?? null,
            hardpoints: this.getHardpointCapacity()
        };
    }

    handleNodeConnectionChange(nodeId) {
        super.handleNodeConnectionChange(nodeId);
        this.refreshPowerplantSize();
        this.notifyChildrenOfChange();
    }

    onParentLinked() {
        this.refreshPowerplantSize();
        this.notifyChildrenOfChange();
    }

    onParentDataChanged() {
        this.refreshPowerplantSize();
        this.notifyChildrenOfChange();
    }

    refreshOutfitCoreAvailability() {
        const widgets = window.widgetManager?.getAllWidgets?.() || [];
        for (const widget of widgets) {
            if (widget.type !== 'outfit') continue;
            widget.refreshCoreOptions();
        }
    }

    notifyChildrenOfChange() {
        super.notifyChildrenOfChange();
        const widgets = window.widgetManager?.getAllWidgets?.() || [];
        for (const widget of widgets) {
            if (widget.type === 'outfit') widget.refreshSelectedCoreData(this.id);
        }
    }

    loadSerializedData(data) {
        const currentFields = [
            'operational', 'ignoreRequiredTech', 'developmentCost', 'powerplantSize',
            'reactor', 'engine', 'manifold', 'reactorValue', 'engineValue', 'manifoldValue',
            'reactorStability', 'engineEfficiency', 'manifoldEfficiency'
        ];
        const incoming = data && typeof data === 'object' ? data : {};
        this.coreData = {
            ...this.coreData,
            ...Object.fromEntries(currentFields
                .filter(key => Object.prototype.hasOwnProperty.call(incoming, key))
                .map(key => [key, incoming[key]])),
            name: typeof incoming.name === 'string' && incoming.name.trim()
                ? incoming.name
                : this.defaultTitle,
            role: typeof incoming.role === 'string' ? incoming.role : this.coreData.role,
            notes: typeof incoming.notes === 'string' ? incoming.notes : this.coreData.notes,
            gears: Array.isArray(incoming.gears)
                ? incoming.gears
                    .filter(gear => gear && typeof gear === 'object')
                    .map(gear => ({
                        ...(typeof gear.name === 'string' ? { name: gear.name } : {}),
                        instability: gear.instability
                    }))
                : this.coreData.gears
        };
        this.coreData.gears = this.coreData.gears.slice(0, 4);
        this.coreData.gears.forEach(gear => {
            gear.instability = Math.max(1, Number.parseInt(gear.instability, 10) || 1);
        });
        [
            this.coreData.reactorValue,
            this.coreData.engineValue,
            this.coreData.manifoldValue
        ] = this.getTriangleValues([
            this.coreData.reactorValue,
            this.coreData.engineValue,
            this.coreData.manifoldValue
        ]);
        this.updateTitle();
        this.refresh();
    }

    syncFormFromData() {
        const operationalCheckbox = document.getElementById(`${this.id}-operational`);
        if (operationalCheckbox) operationalCheckbox.checked = this.coreData.operational;

        const ignoreRequiredTechCheckbox = document.getElementById(`${this.id}-ignore-required-tech`);
        if (ignoreRequiredTechCheckbox) ignoreRequiredTechCheckbox.checked = this.coreData.ignoreRequiredTech;

        const powerplantInput = this.getPowerplantInput();
        if (powerplantInput) powerplantInput.value = this.coreData.powerplantSize;
        const powerplantOutput = this.getPowerplantOutput();
        if (powerplantOutput) powerplantOutput.textContent = String(this.coreData.powerplantSize);
        this.refreshPowerplantSize();

        ['reactor', 'engine', 'manifold'].forEach(component => {
            const select = document.getElementById(`${this.id}-${component}`);
            if (select) select.value = this.coreData[component] || '';
        });

        const reactorValueEl = document.getElementById(`${this.id}-reactor-value`);
        if (reactorValueEl) reactorValueEl.textContent = this.coreData.reactorValue;

        const engineValueEl = document.getElementById(`${this.id}-engine-value`);
        if (engineValueEl) engineValueEl.textContent = this.coreData.engineValue;

        const manifoldValueEl = document.getElementById(`${this.id}-manifold-value`);
        if (manifoldValueEl) manifoldValueEl.textContent = this.coreData.manifoldValue;

        const reactorStabilityEl = document.getElementById(`${this.id}-reactor-stability`);
        if (reactorStabilityEl) reactorStabilityEl.textContent = this.coreData.reactorStability;

        const engineEfficiencyEl = document.getElementById(`${this.id}-engine-efficiency`);
        if (engineEfficiencyEl) engineEfficiencyEl.textContent = this.coreData.engineEfficiency;

        const manifoldEfficiencyEl = document.getElementById(`${this.id}-manifold-efficiency`);
        if (manifoldEfficiencyEl) manifoldEfficiencyEl.textContent = this.coreData.manifoldEfficiency;

        this.renderGears();
        this.renderTriangleWidget();
    }

    refresh() {
        if (!this.element) return;
        this.populateTechDropdowns();
        this.syncFormFromData();
        this.recomputeStats();
        this.refreshPowerplantSize();
        this.refreshSummary();
        this.notifyChildrenOfChange();
    }

    renderSummary(container) {
        if (!container) return;
        container.innerHTML = '';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'summary-title';
        titleDiv.textContent = this.coreData.name || this.defaultTitle;
        container.appendChild(titleDiv);

        const gridDiv = document.createElement('div');
        gridDiv.className = 'summary-grid';
        if (this.coreData.role) {
            this.addSummaryField(gridDiv, 'Role', this.coreData.role);
        }

        // Technologies used
        const techs = ['reactor', 'engine', 'manifold']
            .map(component => this.coreOptions?.[component]?.options?.[this.coreData[component]]?.name)
            .filter(Boolean);

        if (techs.length > 0) {
            this.addSummaryField(gridDiv, 'Technologies', techs.join(', '));
        }

        this.addSummaryField(gridDiv, 'Size', `${this.coreData.powerplantSize}`);
        this.addSummaryField(gridDiv, 'Reactor Threshold', `${this.coreData.reactorStability}`);
        this.addSummaryField(gridDiv, 'Engine Exponent', `${this.coreData.engineEfficiency}`);
        this.addSummaryField(gridDiv, 'Manifold Multiplier', `${this.coreData.manifoldEfficiency}`);
        this.addSummaryField(gridDiv, 'Gears', `${this.coreData.gears.length}`);

        container.appendChild(gridDiv);
    }

    refreshSummary() {
        this.refreshCostDisplay();
        if (!this.element) return;
        const summaryContainer = this.element.querySelector('.widget-summary');
        if (!summaryContainer) return;
        
        const isMinimized = this.element.classList.contains('minimized');
        if (isMinimized) {
            this.renderSummary(summaryContainer);
        }
    }

    onMinimizeStateChanged(isMinimized) {
        if (isMinimized) {
            this.refreshSummary();
        }
    }

    addSummaryField(container, label, value) {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'summary-label';
        labelDiv.textContent = label;

        const valueDiv = document.createElement('div');
        valueDiv.className = 'summary-value';
        valueDiv.textContent = value;

        container.appendChild(labelDiv);
        container.appendChild(valueDiv);
    }
}
