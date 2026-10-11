class ShipCoreWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('shipCore', 'Ship Core', x, y, null);
        this.coreData = {
            operational: false,
            ignoreTechRequirements: false,
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
            armorEfficiency: 1,
            demoHulls: 1,
            gears: [{ name: 'Gear 1', instability: 0 }]
        };
        this.techData = null;
        this.layoutMode = 'three-column';
        this.init();
        this.loadTechData();
    }

    async loadTechData() {
        try {
            const response = await fetch('data/tech-tree.json');
            this.techData = await response.json();
            console.log('Tech tree loaded:', Object.keys(this.techData).length, 'technologies');
            // After tech data loads, render triangle widget if it's not visible yet
            if (this.element) {
                this.renderTriangleWidget();
                // Populate tech dropdowns after data loads
                this.populateTechDropdowns();
            }
        } catch (error) {
            console.error('Failed to load tech tree:', error);
            this.techData = {};
        }
    }

    populateTechDropdowns() {
        const reactorSelect = document.getElementById(`${this.id}-reactor`);
        const engineSelect = document.getElementById(`${this.id}-engine`);
        const manifoldSelect = document.getElementById(`${this.id}-manifold`);

        if (reactorSelect) {
            const reactorOptions = this.getTechsByCategory('Energy Generation');
            this.populateDropdown(reactorSelect, reactorOptions, this.coreData.reactor);
        }

        if (engineSelect) {
            const engineOptions = this.getTechsByCategory('Materials Science');
            this.populateDropdown(engineSelect, engineOptions, this.coreData.engine);
        }

        if (manifoldSelect) {
            const manifoldOptions = this.getTechsByCategory('Information Technology');
            this.populateDropdown(manifoldSelect, manifoldOptions, this.coreData.manifold);
        }
    }

    populateDropdown(selectElement, techList, selectedValue) {
        // Clear existing options except the first one
        while (selectElement.options.length > 1) {
            selectElement.remove(1);
        }
        
        // Add tech options
        techList.forEach(tech => {
            const option = document.createElement('option');
            option.value = tech.key;
            option.textContent = tech.name;
            if (tech.key === selectedValue) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    }

    getTechsByCategory(category) {
        if (!this.techData) return [];
        return Object.entries(this.techData)
            .filter(([, tech]) => tech.category === category)
            .map(([key, tech]) => ({ key, name: tech.name, ...tech }));
    }

    // Called when tech tree changes - refresh tech-dependent content
    onTechTreeUpdated() {
        this.populateTechDropdowns();
    }

    createContent(contentElement) {
        const sections = contentElement.querySelector('.widget-sections');
        
        // Header section with flags and DVP cost
        const headerSection = this.createSection('header', 'Configuration');
        headerSection.contentContainer.innerHTML = `
            <div class="ship-information-header">
                <label class="ship-flag"><input type="checkbox" id="${this.id}-operational" ${this.coreData.operational ? 'checked' : ''}> Operational</label>
                <label class="ship-flag"><input type="checkbox" id="${this.id}-ignore-tech" ${this.coreData.ignoreTechRequirements ? 'checked' : ''}> Ignore Tech</label>
                <div class="ship-dvp">
                    <label for="${this.id}-dvp-cost">DvP Cost</label>
                    <input type="number" min="0" step="1" id="${this.id}-dvp-cost" value="${this.coreData.developmentCost ?? 0}" placeholder="0">
                </div>
            </div>
        `;
        sections.appendChild(headerSection.section);

        // Powerplant section
        const powerplantSection = this.createSection('powerplant', 'Powerplant');
        powerplantSection.contentContainer.innerHTML = `
            <div class="composition-item">
                <label for="${this.id}-powerplant">Powerplant Size</label>
                <input type="number" min="1" step="1" id="${this.id}-powerplant" value="${this.coreData.powerplantSize}" class="hull-spin core-powerplant-size">
                <output class="composition-value core-powerplant-value" id="${this.id}-powerplant-value" aria-label="Powerplant size"></output>
            </div>
        `;
        sections.appendChild(powerplantSection.section);

        // Components section
        const componentsSection = this.createSection('components', 'Components');
        componentsSection.contentContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;">
                <div class="input-group">
                    <label for="${this.id}-reactor">Reactor</label>
                    <select id="${this.id}-reactor" class="component-dropdown">
                        <option value="">Select Reactor...</option>
                        ${this.getTechsByCategory('Energy Generation').map(t => 
                            `<option value="${t.key}" ${this.coreData.reactor === t.key ? 'selected' : ''}>${t.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="input-group">
                    <label for="${this.id}-engine">Engine</label>
                    <select id="${this.id}-engine" class="component-dropdown">
                        <option value="">Select Engine...</option>
                        ${this.getTechsByCategory('Materials Science').map(t => 
                            `<option value="${t.key}" ${this.coreData.engine === t.key ? 'selected' : ''}>${t.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="input-group">
                    <label for="${this.id}-manifold">Manifold</label>
                    <select id="${this.id}-manifold" class="component-dropdown">
                        <option value="">Select Manifold...</option>
                        ${this.getTechsByCategory('Information Technology').map(t => 
                            `<option value="${t.key}" ${this.coreData.manifold === t.key ? 'selected' : ''}>${t.name}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
        `;
        sections.appendChild(componentsSection.section);

        // Triangle widget section
        const triangleSection = this.createSection('triangle', 'Distribution');
        const triangleContent = `
            <div class="core-triangle-container">
                <div class="core-triangle" id="${this.id}-triangle-widget"></div>
                <div class="triangle-values">
                    <div class="triangle-value">
                        <span>Reactor:</span>
                        <span id="${this.id}-reactor-value">${this.coreData.reactorValue}</span>
                    </div>
                    <div class="triangle-value">
                        <span>Engine:</span>
                        <span id="${this.id}-engine-value">${this.coreData.engineValue}</span>
                    </div>
                    <div class="triangle-value">
                        <span>Manifold:</span>
                        <span id="${this.id}-manifold-value">${this.coreData.manifoldValue}</span>
                    </div>
                </div>
            </div>
        `;
        triangleSection.contentContainer.innerHTML = triangleContent;
        sections.appendChild(triangleSection.section);

        // Stats section
        const statsSection = this.createSection('stats', 'Statistics');
        statsSection.contentContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;">
                <div class="input-group">
                    <label for="${this.id}-reactor-stability">Reactor Stability</label>
                    <input type="number" min="0" step="1" id="${this.id}-reactor-stability" value="${this.coreData.reactorStability}" placeholder="0" class="stat-spinbox">
                </div>
                <div class="input-group">
                    <label for="${this.id}-engine-efficiency">Engine Efficiency</label>
                    <input type="number" min="0" step="1" id="${this.id}-engine-efficiency" value="${this.coreData.engineEfficiency}" placeholder="0" class="stat-spinbox">
                </div>
                <div class="input-group">
                    <label for="${this.id}-manifold-efficiency">Manifold Efficiency</label>
                    <input type="number" min="0" step="1" id="${this.id}-manifold-efficiency" value="${this.coreData.manifoldEfficiency}" placeholder="0" class="stat-spinbox">
                </div>
            </div>
        `;
        sections.appendChild(statsSection.section);

        const gearingSection = this.createSection('gearing', 'Gearing');
        gearingSection.contentContainer.innerHTML = `
            <div class="input-group">
                <label for="${this.id}-demo-hulls">Simulation hulls</label>
                <input type="number" min="1" step="1" id="${this.id}-demo-hulls" value="${this.coreData.demoHulls}" class="stat-spinbox">
            </div>
            <div id="${this.id}-gears" class="core-gears"></div>
            <button type="button" id="${this.id}-add-gear" class="core-add-gear">Add gear</button>
        `;
        sections.appendChild(gearingSection.section);

        this.renderGears();
        this.renderTriangleWidget();
    }

    setupEventListeners() {
        // Call parent class setupEventListeners to enable dragging
        super.setupEventListeners();

        const operationalCheckbox = document.getElementById(`${this.id}-operational`);
        if (operationalCheckbox) {
            operationalCheckbox.addEventListener('change', (e) => {
                this.coreData.operational = e.target.checked;
                this.refreshSummary();
                this.notifyChildrenOfChange();
                this.refreshOutfitCoreAvailability();
            });
        }

        const ignoreTechCheckbox = document.getElementById(`${this.id}-ignore-tech`);
        if (ignoreTechCheckbox) {
            ignoreTechCheckbox.addEventListener('change', (e) => {
                this.coreData.ignoreTechRequirements = e.target.checked;
                this.refreshSummary();
            });
        }

        const dvpInput = document.getElementById(`${this.id}-dvp-cost`);
        if (dvpInput) {
            dvpInput.addEventListener('input', (e) => {
                this.coreData.developmentCost = parseInt(e.target.value, 10) || 0;
                this.refreshSummary();
            });
        }

        const powerplantInput = this.getPowerplantInput();
        if (powerplantInput) {
            powerplantInput.addEventListener('input', (e) => {
                if (powerplantInput.disabled || powerplantInput.readOnly) {
                    this.refreshPowerplantSize();
                    return;
                }
                this.coreData.powerplantSize = parseInt(e.target.value, 10) || 1;
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
                    this.refreshSummary();
                    this.notifyChildrenOfChange();
                });
            }
        });

        // Stat spinboxes
        ['reactor-stability', 'engine-efficiency', 'manifold-efficiency'].forEach(stat => {
            const input = document.getElementById(`${this.id}-${stat}`);
            if (input) {
                input.addEventListener('input', (e) => {
                    const dataKey = {
                        'reactor-stability': 'reactorStability',
                        'engine-efficiency': 'engineEfficiency',
                        'manifold-efficiency': 'manifoldEfficiency'
                    }[stat];
                    this.coreData[dataKey] = parseInt(e.target.value, 10) || 0;
                    this.refreshSummary();
                    this.notifyChildrenOfChange();
                });
            }
        });

        const demoHullsInput = document.getElementById(`${this.id}-demo-hulls`);
        if (demoHullsInput) {
            demoHullsInput.addEventListener('input', () => {
                this.coreData.demoHulls = Math.max(1, parseInt(demoHullsInput.value, 10) || 1);
                demoHullsInput.value = this.coreData.demoHulls;
                this.refreshSummary();
                this.notifyChildrenOfChange();
            });
        }

        const addGearButton = document.getElementById(`${this.id}-add-gear`);
        if (addGearButton) {
            addGearButton.addEventListener('click', () => {
                this.coreData.gears.push({
                    name: `Gear ${this.coreData.gears.length + 1}`,
                    instability: 0
                });
                this.renderGears();
                this.refreshSummary();
                this.notifyChildrenOfChange();
            });
        }
    }

    renderGears() {
        const container = this.element?.querySelector(`#${this.id}-gears`);
        if (!container) return;
        container.replaceChildren();
        this.coreData.gears.forEach((gear, index) => {
            const row = document.createElement('div');
            row.className = 'core-gear-row';
            row.innerHTML = `
                <label>Gear ${index + 1} name
                    <input type="text" data-gear-name="${index}">
                </label>
                <label>Instability
                    <input type="number" min="0" step="1" data-gear-instability="${index}">
                </label>
                <button type="button" data-remove-gear="${index}" aria-label="Remove gear ${index + 1}">×</button>
            `;
            const nameInput = row.querySelector(`[data-gear-name="${index}"]`);
            const instabilityInput = row.querySelector(`[data-gear-instability="${index}"]`);
            nameInput.value = gear.name || `Gear ${index + 1}`;
            instabilityInput.value = gear.instability ?? 0;
            nameInput.addEventListener('input', () => {
                gear.name = nameInput.value;
                this.refreshSummary();
                this.notifyChildrenOfChange();
            });
            instabilityInput.addEventListener('input', () => {
                gear.instability = Math.max(0, parseInt(instabilityInput.value, 10) || 0);
                this.refreshSummary();
                this.notifyChildrenOfChange();
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

    renderTriangleWidget() {
        // First try to find by current ID (normal case)
        let container = document.getElementById(`${this.id}-triangle-widget`);
        
        // If not found, try to find by class within this widget (handles ID mismatch during load)
        if (!container && this.element) {
            container = this.element.querySelector('.core-triangle');
        }
        
        if (!container) {
            // Container doesn't exist yet, retry after a short delay
            setTimeout(() => this.renderTriangleWidget(), 50);
            return;
        }

        const size = 300;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.style.border = '1px solid #555';
        canvas.style.cursor = 'crosshair';

        const ctx = canvas.getContext('2d');
        this.drawTriangle(ctx, size);

        container.innerHTML = '';
        container.appendChild(canvas);

        // Store triangle parameters for drag handling
        const triangleParams = {
            size,
            margin: 40,
            top: [size / 2, 40],
            bottomLeft: [40, size - 40],
            bottomRight: [size - 40, size - 40]
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
                // Final update after drag ends to refresh summary
                this.refreshSummary();
                this.notifyChildrenOfChange();
            }
        });
        
        // Also support click for single interactions
        canvas.addEventListener('click', updateIndicator);
    }

    redrawTriangleCanvas(canvas, size) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.drawTriangle(ctx, size);
    }

    drawTriangle(ctx, size) {
        const margin = 40;
        const h = size - 2 * margin;
        const w = size - 2 * margin;

        // Triangle vertices
        const top = [size / 2, margin];
        const bottomLeft = [margin, size - margin];
        const bottomRight = [size - margin, size - margin];

        // Draw triangle
        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(top[0], top[1]);
        ctx.lineTo(bottomLeft[0], bottomLeft[1]);
        ctx.lineTo(bottomRight[0], bottomRight[1]);
        ctx.closePath();
        ctx.stroke();

        // Draw grid lines for the 12 allocatable points between each vertex.
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        for (let i = 1; i < 12; i++) {
            const t = i / 12;
            // Horizontal lines
            const p1 = this.lerpPoint(top, bottomLeft, t);
            const p2 = this.lerpPoint(top, bottomRight, t);
            ctx.beginPath();
            ctx.moveTo(p1[0], p1[1]);
            ctx.lineTo(p2[0], p2[1]);
            ctx.stroke();
        }

        // Draw labels
        ctx.fillStyle = '#c0c0c0';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Reactor', top[0], top[1] - 20);
        ctx.fillText('Manifold', bottomLeft[0] - 30, bottomLeft[1] + 20);
        ctx.fillText('Engine', bottomRight[0] + 30, bottomRight[1] + 20);

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
        
        // Account for any CSS scale transforms on the canvas or its parents
        let element = canvas;
        let scale = 1;
        while (element && element !== document.body) {
            const transform = window.getComputedStyle(element).transform;
            if (transform && transform !== 'none') {
                const matrix = transform.match(/matrix.*\((.+)\)/);
                if (matrix) {
                    const transformScale = parseFloat(matrix[1].split(',')[0]);
                    scale *= transformScale;
                }
            }
            element = element.parentElement;
        }
        
        // Calculate coordinates relative to canvas, accounting for scale
        let x = (e.clientX - rect.left) / scale;
        let y = (e.clientY - rect.top) / scale;

        const { top, bottomLeft, bottomRight, size } = triangleParams;

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
        this.redrawTriangleCanvas(canvas, size);

        this.refreshSummary();
        this.notifyChildrenOfChange();
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
            anchorId: `${this.id}-header`
        });
        this.addNode('output', 'Core', 'Core', 1, 0.5, {
            sectionId: 'header',
            anchorId: `${this.id}-header`
        });
        this.reflowNodes();
        this.refreshPowerplantSize();
    }

    getConnectedClassData() {
        const linked = this.getConnectedDataByNodeType('Class')[0]?.data;
        return linked?.shipData || linked || null;
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
        const coreHulls = Number(classData.hullComposition?.core ?? classData.hullComposition?.Core ?? 0);
        if (!Number.isFinite(coreHulls) || coreHulls < 0) {
            console.warn(`[ShipCoreWidget ${this.id}] Connected class has an invalid core hull count`);
            return;
        }
        this.coreData.powerplantSize = Math.floor(coreHulls);
        if (powerplantInput) {
            powerplantInput.value = String(this.coreData.powerplantSize);
        }
        if (powerplantOutput) powerplantOutput.textContent = String(this.coreData.powerplantSize);
    }

    getContainmentHullCount() {
        const classData = this.getConnectedClassData();
        const composition = classData?.hullComposition || {};
        const containmentHulls = Number(classData?.containmentHulls);
        if (classData?.containmentHulls !== null && classData?.containmentHulls !== undefined &&
            classData.containmentHulls !== '' && Number.isFinite(containmentHulls) && containmentHulls >= 0) {
            return containmentHulls;
        }
        const freight = Number(composition.freight ?? composition.Freight ?? 0);
        const tankage = Number(composition.tankage ?? composition.Tankage ?? 0);
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
        return {
            ...this.coreData,
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
        this.coreData = {
            ...this.coreData,
            ...data,
            operational: Boolean(data.operational || data.developed),
            gears: Array.isArray(data.gears) ? data.gears.map(gear => ({ ...gear })) : this.coreData.gears
        };
        [
            this.coreData.reactorValue,
            this.coreData.engineValue,
            this.coreData.manifoldValue
        ] = this.getTriangleValues([
            this.coreData.reactorValue,
            this.coreData.engineValue,
            this.coreData.manifoldValue
        ]);
        delete this.coreData.developed;
        this.syncFormFromData();
    }

    syncFormFromData() {
        const operationalCheckbox = document.getElementById(`${this.id}-operational`);
        if (operationalCheckbox) operationalCheckbox.checked = this.coreData.operational;

        const ignoreTechCheckbox = document.getElementById(`${this.id}-ignore-tech`);
        if (ignoreTechCheckbox) ignoreTechCheckbox.checked = this.coreData.ignoreTechRequirements;

        const dvpInput = document.getElementById(`${this.id}-dvp-cost`);
        if (dvpInput) dvpInput.value = this.coreData.developmentCost ?? 0;

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
        if (reactorStabilityEl) reactorStabilityEl.value = this.coreData.reactorStability;

        const engineEfficiencyEl = document.getElementById(`${this.id}-engine-efficiency`);
        if (engineEfficiencyEl) engineEfficiencyEl.value = this.coreData.engineEfficiency;

        const manifoldEfficiencyEl = document.getElementById(`${this.id}-manifold-efficiency`);
        if (manifoldEfficiencyEl) manifoldEfficiencyEl.value = this.coreData.manifoldEfficiency;

        const demoHullsInput = document.getElementById(`${this.id}-demo-hulls`);
        if (demoHullsInput) demoHullsInput.value = this.coreData.demoHulls;
        this.renderGears();
        this.renderTriangleWidget();
    }

    renderSummary(container) {
        if (!container) return;
        container.innerHTML = '';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'summary-title';
        titleDiv.textContent = 'Ship Core';
        container.appendChild(titleDiv);

        const gridDiv = document.createElement('div');
        gridDiv.className = 'summary-grid';

        // Technologies used
        const techs = [];
        if (this.coreData.reactor) {
            const reactor = this.techData?.[this.coreData.reactor];
            if (reactor) techs.push(reactor.name);
        }
        if (this.coreData.engine) {
            const engine = this.techData?.[this.coreData.engine];
            if (engine) techs.push(engine.name);
        }
        if (this.coreData.manifold) {
            const manifold = this.techData?.[this.coreData.manifold];
            if (manifold) techs.push(manifold.name);
        }

        if (techs.length > 0) {
            this.addSummaryField(gridDiv, 'Technologies', techs.join(', '));
        }

        this.addSummaryField(gridDiv, 'Size', `${this.coreData.powerplantSize}`);
        this.addSummaryField(gridDiv, 'Reactor Stability', `${this.coreData.reactorStability}`);
        this.addSummaryField(gridDiv, 'Engine Efficiency', `${this.coreData.engineEfficiency}`);
        this.addSummaryField(gridDiv, 'Manifold Efficiency', `${this.coreData.manifoldEfficiency}`);
        this.addSummaryField(gridDiv, 'Simulation Hulls', `${this.coreData.demoHulls}`);
        this.addSummaryField(gridDiv, 'Gears', `${this.coreData.gears.length}`);

        container.appendChild(gridDiv);
    }

    refreshSummary() {
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
