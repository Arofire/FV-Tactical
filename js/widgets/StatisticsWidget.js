class StatisticsWidget extends Widget {
    constructor(shipWidget = null, x = 900, y = 100) {
        if (typeof shipWidget === 'number') {
            y = typeof x === 'number' ? x : 100;
            x = shipWidget;
            shipWidget = null;
        }
        super('statistics', 'Statistics', x, y, null);
        this.shipWidget = shipWidget;
        this.stats = {
            endurance: 0,
            developmentPoints: 0,
            shipyardMonths: 0,
            thrustRatio: 0,
            burns: 0,
            cargo: 0,
            remass: 0,
            hFuel: 0,
            hangarBays: 0,
            quantumRating: 0,
            qcm: 0,
            troopCapacity: 0
        };
        this.layoutMode = 'three-column';
        this.init();
    }

    createContent(contentElement) {
        const sectionsContainer = contentElement.querySelector('.widget-sections');

        const statsSection = this.createSection('stats', 'Ship Statistics');
        const statFields = [
            ['endurance', 'Endurance'],
            ['developmentPoints', 'Development Points'],
            ['shipyardMonths', 'Shipyard Months'],
            ['thrustRatio', 'Thrust Ratio'],
            ['burns', 'Burns'],
            ['cargo', 'Cargo Capacity'],
            ['remass', 'Remass'],
            ['hFuel', 'H-Fuel'],
            ['hangarBays', 'Hangar Bays'],
            ['quantumRating', 'Quantum Rating'],
            ['qcm', 'QCM'],
            ['troopCapacity', 'Troop Capacity']
        ];

        this.setSectionContent(statsSection, `
            <div class="stats-grid">
                ${statFields.map(([key, label]) => `
                    <div class="stat-input">
                        <label>${label}</label>
                        <input type="number" id="${this.id}-stat-${key}" value="${this.stats[key]}" min="0">
                    </div>
                `).join('')}
            </div>
        `);
        sectionsContainer.appendChild(statsSection.section);

        const connectionsSection = this.createSection('sources', 'Linked Sources');
        this.setSectionContent(connectionsSection, `
            <div class="component-list" id="${this.id}-source-list">
                <div class="component-item placeholder" data-placeholder="true">No statistics connections</div>
            </div>
        `);
        sectionsContainer.appendChild(connectionsSection.section);

        this.refreshStatInputs();
        this.updateSources();
    }

    bindStatInputs() {
        Object.keys(this.stats).forEach((key) => {
            const input = document.getElementById(`${this.id}-stat-${key}`);
            if (input) {
                input.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    this.stats[key] = Number.isFinite(val) ? val : 0;
                    this.syncToShip();
                    this.refreshSummary();
                });
            }
        });
    }

    setupEventListeners() {
        super.setupEventListeners();
        this.bindStatInputs();
    }

    createNodes() {
        this.clearNodes();
        this.addNode('input', 'Statistics', 'Statistics', 0, 0.5, {
            sectionId: 'stats',
            allowMultipleConnections: true
        });
        this.reflowNodes();
    }

    handleNodeConnectionChange(nodeId) {
        super.handleNodeConnectionChange(nodeId);
        this.updateSources();
    }

    updateSources() {
        const list = document.getElementById(`${this.id}-source-list`);
        if (!list || !window.nodeSystem) return;

        list.innerHTML = '';
        const connectedWidgets = new Map();

        for (const node of this.nodes.values()) {
            if (node.nodeType !== 'statistics' || node.type !== 'input') continue;
            if (!node.connections) continue;
            for (const connectionId of node.connections) {
                const connection = window.nodeSystem.connections.get(connectionId);
                if (!connection) continue;
                const otherNodeId = connection.sourceNodeId === node.id
                    ? connection.targetNodeId
                    : connection.sourceNodeId;
                const otherNode = window.nodeSystem.getNodeById(otherNodeId);
                if (!otherNode) continue;
                const widget = window.widgetManager?.getWidget(otherNode.widgetId);
                if (widget) {
                    connectedWidgets.set(widget.id, widget);
                }
            }
        }

        if (connectedWidgets.size === 0) {
            const placeholder = document.createElement('div');
            placeholder.className = 'component-item placeholder';
            placeholder.dataset.placeholder = 'true';
            placeholder.textContent = 'No statistics connections';
            list.appendChild(placeholder);
            return;
        }

        let primaryShip = null;

        connectedWidgets.forEach((widget) => {
            const item = document.createElement('div');
            item.className = 'component-item';
            item.textContent = widget.title || widget.type;
            list.appendChild(item);

            if (!primaryShip && (widget.type === 'ship' || widget.type === 'shipPrototype')) {
                primaryShip = widget;
            }
        });

        if (primaryShip) {
            this.shipWidget = primaryShip;
            this.syncToShip();
        }
    }

    syncToShip() {
        if (!this.shipWidget) return;
        this.shipWidget.shipData = this.shipWidget.shipData || {};
        this.shipWidget.shipData.statistics = { ...this.stats };
    }

    refreshStatInputs() {
        Object.keys(this.stats).forEach((key) => {
            const input = document.getElementById(`${this.id}-stat-${key}`);
            if (input) {
                input.value = this.stats[key];
            }
        });
    }

    getSerializedData() {
        return { stats: { ...this.stats } };
    }

    loadSerializedData(data) {
        if (data.stats) {
            this.stats = { ...this.stats, ...data.stats };
            this.refreshStatInputs();
        }
        this.syncToShip();
        this.updateSources();
    }

    renderSummary(container) {
        if (!container) return;
        container.innerHTML = '';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'summary-title';
        titleDiv.textContent = 'Statistics';
        container.appendChild(titleDiv);

        const badgesDiv = document.createElement('div');
        badgesDiv.className = 'summary-badges';
        
        // Count non-zero stats
        const nonZeroCount = Object.values(this.stats).filter(v => v > 0).length;
        if (nonZeroCount > 0) {
            badgesDiv.appendChild(this.createBadge(`${nonZeroCount} Stats`, 'info'));
        }

        container.appendChild(badgesDiv);

        const gridDiv = document.createElement('div');
        gridDiv.className = 'summary-grid';

        // Show key stats in summary
        if (this.stats.endurance) {
            this.addSummaryField(gridDiv, 'Endurance', this.stats.endurance.toString());
        }
        if (this.stats.developmentPoints) {
            this.addSummaryField(gridDiv, 'Dev Points', this.stats.developmentPoints.toString());
        }
        if (this.stats.shipyardMonths) {
            this.addSummaryField(gridDiv, 'Shipyard Months', this.stats.shipyardMonths.toString());
        }
        if (this.stats.thrustRatio) {
            this.addSummaryField(gridDiv, 'Thrust Ratio', this.stats.thrustRatio.toString());
        }

        // Count source connections
        let sourceCount = 0;
        for (const node of this.nodes.values()) {
            if (node.nodeType === 'statistics' && node.type === 'input' && node.connections) {
                sourceCount += node.connections.size || 0;
            }
        }
        this.addSummaryField(gridDiv, 'Sources', sourceCount.toString());

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

    createBadge(text, variant = '') {
        const badge = document.createElement('span');
        badge.className = variant ? `summary-badge badge-${variant}` : 'summary-badge';
        badge.textContent = text;
        return badge;
    }
}
