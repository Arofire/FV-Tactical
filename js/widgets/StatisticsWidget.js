class StatisticsWidget extends Widget {
    constructor(shipWidget = null, x = 900, y = 100) {
        if (typeof shipWidget === 'number') {
            y = typeof x === 'number' ? x : 100;
            x = shipWidget;
            shipWidget = null;
        }
        super('statistics', 'Statistics', x, y, 340);
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
        this.addNode('input', 'statistics', 'Statistics In', 0, 0.5, {
            sectionId: 'stats',
            allowMultipleConnections: true
        });
        this.addNode('output', 'statistics', 'Statistics Out', 1, 0.5, {
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
}
