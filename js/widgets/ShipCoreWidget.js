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
            thrusterLayout: 'Standard',
            reactorValue: 2,
            engineValue: 2,
            manifoldValue: 2,
            reactorStability: 2,
            engineEfficiency: 2,
            manifoldEfficiency: 2
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
            <div class="input-group">
                <label for="${this.id}-powerplant">Powerplant Size</label>
                <input type="number" min="1" step="1" id="${this.id}-powerplant" value="${this.coreData.powerplantSize}" class="spinbox-input">
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
                <div class="input-group">
                    <label for="${this.id}-thruster">Thruster Layout</label>
                    <select id="${this.id}-thruster" class="component-dropdown">
                        <option value="Standard" ${this.coreData.thrusterLayout === 'Standard' ? 'selected' : ''}>Standard</option>
                        <option value="Retro" ${this.coreData.thrusterLayout === 'Retro' ? 'selected' : ''}>Retro</option>
                        <option value="Gimbal" ${this.coreData.thrusterLayout === 'Gimbal' ? 'selected' : ''}>Gimbal</option>
                        <option value="Omni" ${this.coreData.thrusterLayout === 'Omni' ? 'selected' : ''}>Omni</option>
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

        this.setupEventListeners();
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

        const powerplantInput = document.getElementById(`${this.id}-powerplant`);
        if (powerplantInput) {
            powerplantInput.addEventListener('input', (e) => {
                this.coreData.powerplantSize = parseInt(e.target.value, 10) || 1;
                this.refreshSummary();
                this.notifyChildrenOfChange();
            });
        }

        // Component dropdowns
        ['reactor', 'engine', 'manifold', 'thruster'].forEach(component => {
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
                    const key = stat.replace('-', '').replace('Stability', 'Stability').replace('efficiency', 'Efficiency');
                    const dataKey = stat.replace(/-/g, '').match(/[a-z]+/gi).map((x, i) => i === 0 ? x : x.charAt(0).toUpperCase() + x.slice(1)).join('');
                    this.coreData[dataKey] = parseInt(e.target.value, 10) || 0;
                    this.refreshSummary();
                    this.notifyChildrenOfChange();
                });
            }
        });
    }

    renderTriangleWidget() {
        const container = document.getElementById(`${this.id}-triangle-widget`);
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
        
        const updateIndicator = (e) => this.updateTriangleIndicator(e, canvas, triangleParams, false);
        const updateIndicatorFinal = (e) => this.updateTriangleIndicator(e, canvas, triangleParams, true);
        
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
        canvas.addEventListener('click', (e) => updateIndicatorFinal(e));
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

        // Draw grid lines (15 points per axis)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        for (let i = 1; i < 15; i++) {
            const t = i / 15;
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
        const total = this.coreData.reactorValue + this.coreData.engineValue + this.coreData.manifoldValue;
        const r = this.coreData.reactorValue / total;
        const e = this.coreData.engineValue / total;
        const m = this.coreData.manifoldValue / total;

        const pos = [
            r * top[0] + e * bottomRight[0] + m * bottomLeft[0],
            r * top[1] + e * bottomRight[1] + m * bottomLeft[1]
        ];

        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(pos[0], pos[1], 6, 0, Math.PI * 2);
        ctx.fill();
    }

    updateTriangleIndicator(e, canvas, triangleParams, isFinal = false) {
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
        
        // Since we've clamped the coordinates to the triangle, the barycentric coordinates
        // should be in the valid range [0, 1]. However, due to floating point precision,
        // we still need to ensure they don't exceed 1 and sum to 1.
        const total = reactor + engine + manifold;
        
        // Normalize so they sum to 1
        if (total > 0) {
            const normalizedR = reactor / total;
            const normalizedE = engine / total;
            const normalizedM = manifold / total;
            
            this.coreData.reactorValue = Math.round(normalizedR * 15);
            this.coreData.engineValue = Math.round(normalizedE * 15);
            this.coreData.manifoldValue = Math.round(normalizedM * 15);
        } else {
            // Fallback if all are zero (shouldn't happen)
            this.coreData.reactorValue = 5;
            this.coreData.engineValue = 5;
            this.coreData.manifoldValue = 5;
        }

        document.getElementById(`${this.id}-reactor-value`).textContent = this.coreData.reactorValue;
        document.getElementById(`${this.id}-engine-value`).textContent = this.coreData.engineValue;
        document.getElementById(`${this.id}-manifold-value`).textContent = this.coreData.manifoldValue;

        // Redraw the canvas to show updated indicator position
        this.redrawTriangleCanvas(canvas, size);

        // Only update summary and notify children on final update (click or drag end)
        if (isFinal) {
            this.refreshSummary();
            this.notifyChildrenOfChange();
        }
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
        this.addNode('output', 'Core', 'Core', 1, 0.5, {
            sectionId: 'header',
            anchorId: `${this.id}-header`
        });
        this.reflowNodes();
    }

    getSerializedData() {
        return { ...this.coreData };
    }

    loadSerializedData(data) {
        this.coreData = { ...this.coreData, ...data };
        this.syncFormFromData();
    }

    syncFormFromData() {
        const operationalCheckbox = document.getElementById(`${this.id}-operational`);
        if (operationalCheckbox) operationalCheckbox.checked = this.coreData.operational;

        const ignoreTechCheckbox = document.getElementById(`${this.id}-ignore-tech`);
        if (ignoreTechCheckbox) ignoreTechCheckbox.checked = this.coreData.ignoreTechRequirements;

        const dvpInput = document.getElementById(`${this.id}-dvp-cost`);
        if (dvpInput) dvpInput.value = this.coreData.developmentCost ?? 0;

        const powerplantInput = document.getElementById(`${this.id}-powerplant`);
        if (powerplantInput) powerplantInput.value = this.coreData.powerplantSize;

        ['reactor', 'engine', 'manifold', 'thruster'].forEach(component => {
            const select = document.getElementById(`${this.id}-${component}`);
            if (select) select.value = this.coreData[component] || '';
        });

        document.getElementById(`${this.id}-reactor-value`).textContent = this.coreData.reactorValue;
        document.getElementById(`${this.id}-engine-value`).textContent = this.coreData.engineValue;
        document.getElementById(`${this.id}-manifold-value`).textContent = this.coreData.manifoldValue;

        document.getElementById(`${this.id}-reactor-stability`).value = this.coreData.reactorStability;
        document.getElementById(`${this.id}-engine-efficiency`).value = this.coreData.engineEfficiency;
        document.getElementById(`${this.id}-manifold-efficiency`).value = this.coreData.manifoldEfficiency;

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
