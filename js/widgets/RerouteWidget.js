class RerouteWidget extends Widget {
    constructor(x = 100, y = 100) {
        super('reroute', 'Reroute', x, y, 220);
        this.routes = new Map();
        this.init();
    }

    createContent(contentElement) {
        const sections = contentElement.querySelector('.widget-sections');
        const routesSection = this.createSection('routes', 'Routes');
        routesSection.contentContainer.innerHTML = `
            <div class="component-list" id="${this.id}-route-list">
                <div class="component-item placeholder" data-placeholder="true">Drag a connection into this widget to add ports</div>
            </div>
        `;
        sections.appendChild(routesSection.section);
    }

    createNodes() {
        this.clearNodes();
        this.reflowNodes();
    }

    formatNodeType(nodeType) {
        return (nodeType || 'Route').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    configureForNodeType(nodeType, preservedIds = {}) {
        if (!nodeType) return null;
        if (this.routes.has(nodeType)) {
            this.updateRoutePositions();
            this.updateRouteDisplay();
            return this.routes.get(nodeType);
        }

        const label = this.formatNodeType(nodeType);
        const groupId = `reroute-${nodeType}`;
        const input = this.addNode('input', nodeType, `${label} In`, 0, 0.5, {
            sectionId: 'routes',
            groupId,
            allowMultipleConnections: false,
            nodeId: preservedIds.inputId
        });
        const output = this.addNode('output', nodeType, `${label} Out`, 1, 0.5, {
            sectionId: 'routes',
            groupId,
            allowMultipleConnections: true,
            nodeId: preservedIds.outputId
        });

        const routeRecord = { inputId: input, outputId: output, nodeType };
        this.routes.set(nodeType, routeRecord);
        this.updateRoutePositions();
        this.updateRouteDisplay();
        return routeRecord;
    }

    updateRoutePositions() {
        const total = this.routes.size;
        if (total === 0) return;
        let index = 0;
        for (const route of this.routes.values()) {
            const relativeY = total === 1 ? 0.5 : (index + 1) / (total + 1);
            const inputNode = this.nodes.get(route.inputId);
            const outputNode = this.nodes.get(route.outputId);
            if (inputNode) {
                inputNode.relativeY = relativeY;
                this.updateNodePosition(route.inputId);
            }
            if (outputNode) {
                outputNode.relativeY = relativeY;
                this.updateNodePosition(route.outputId);
            }
            index += 1;
        }
        this.reflowNodes();
    }

    updateRouteDisplay() {
        const list = document.getElementById(`${this.id}-route-list`);
        if (!list) return;

        list.innerHTML = '';
        if (this.routes.size === 0) {
            const placeholder = document.createElement('div');
            placeholder.className = 'component-item placeholder';
            placeholder.dataset.placeholder = 'true';
            placeholder.textContent = 'Drag a connection into this widget to add ports';
            list.appendChild(placeholder);
            return;
        }

        for (const [nodeType, route] of this.routes.entries()) {
            const inputNode = this.nodes.get(route.inputId);
            const outputNode = this.nodes.get(route.outputId);
            const inputCount = inputNode?.connections?.size || 0;
            const outputCount = outputNode?.connections?.size || 0;

            const item = document.createElement('div');
            item.className = 'component-item';
            item.innerHTML = `
                <div>
                    <div class="component-name">${this.formatNodeType(nodeType)}</div>
                    <div class="component-details">${inputCount} in • ${outputCount} out</div>
                </div>
            `;
            list.appendChild(item);
        }
    }

    handleNodeConnectionChange(nodeId) {
        super.handleNodeConnectionChange(nodeId);
        this.updateRouteDisplay();
    }

    getSerializedData() {
        return {
            routes: Array.from(this.routes.entries()).map(([nodeType, route]) => ({
                nodeType,
                inputId: route.inputId,
                outputId: route.outputId
            }))
        };
    }

    loadSerializedData(data) {
        if (data && Array.isArray(data.routes)) {
            data.routes.forEach((route) => {
                if (!route || !route.nodeType) return;
                this.configureForNodeType(route.nodeType, {
                    inputId: route.inputId,
                    outputId: route.outputId
                });
            });
        }
        this.updateRouteDisplay();
    }
}
