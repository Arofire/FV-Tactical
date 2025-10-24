// Preflight check system for validating designs and identifying issues
class PreflightCheck {
    constructor(empire, widgetManager, nodeSystem) {
        this.empire = empire;
        this.widgetManager = widgetManager;
        this.nodeSystem = nodeSystem;
        
    this.alerts = [];
    this.warnings = [];
        this.errors = [];
        this.techRequirements = [];
        
        // Track issues by widget ID
    this.widgetIssues = new Map(); // widgetId -> { alerts: [], warnings: [], errors: [], techRequirements: [] }
        
        // New floating overlay elements
        this.preflightToggle = document.getElementById('preflightControl');
        this.preflightOverlay = document.getElementById('preflightOverlay');
        this.preflightIssues = document.getElementById('preflightIssues');
        this.preflightSummary = document.getElementById('preflightSummary');
        this.preflightMinimizeBtn = document.getElementById('preflightMinimizeBtn');
        
    // Initialize toggle state (load persisted)
    const persisted = localStorage.getItem('preflightExpanded');
    this.isExpanded = persisted ? persisted === 'true' : false;
    this.initToggle();
        
        // Track previous issues for animation
        this.previousIssues = new Map(); // issueId -> issueData
        this.currentIssueElements = new Map(); // issueId -> DOM element
    }

    runCheck() {
    this.alerts = [];
    this.warnings = [];
        this.errors = [];
        this.techRequirements = [];
        this.widgetIssues.clear();
        
        // Check all widgets
        if (this.widgetManager) {
            for (const widget of this.widgetManager.widgets.values()) {
                this.checkWidget(widget);
            }
        }
        
        // Check connections
        if (this.nodeSystem) {
            this.checkConnections();
        }
        
        // Check empire-wide issues
        this.checkEmpireWide();
        
        // Update widget indicators
        this.updateWidgetIndicators();
        
        // Update UI
        this.updateUI();
    }

    checkWidget(widget) {
        switch (widget.type) {
            case 'ship':
                this.checkShipWidget(widget);
                break;
            case 'craft':
                this.checkCraftWidget(widget);
                break;
            case 'troops':
                this.checkTroopsWidget(widget);
                break;
            case 'missiles':
                this.checkMissilesWidget(widget);
                break;
            case 'outfit':
                this.checkOutfitWidget(widget);
                break;
            case 'loadouts':
                this.checkLoadoutsWidget(widget);
                break;
            case 'powerplants':
                this.checkPowerplantsWidget(widget);
                break;
            case 'factories':
                this.checkFactoriesWidget(widget);
                break;
            case 'shipyards':
                this.checkShipyardsWidget(widget);
                break;
            case 'shipCore':
                this.checkShipCoreWidget(widget);
                break;
            case 'shipBerth':
                this.checkShipBerthWidget(widget);
                break;
            case 'shipHulls':
                this.checkShipHullsWidget(widget);
                break;
        }
    }

    checkShipWidget(widget) {
        const data = widget.getSerializedData();
        
        // Handle new hull-based ship design
        if (data.shipData) {
            this.checkHullBasedShip(widget, data.shipData);
            return;
        }
        
        // Legacy component-based system (keep for backward compatibility)
        if (!data.components || data.components.length === 0) {
            this.addWarning(`Ship "${widget.title}" has no components`, widget.id);
            return;
        }
        
        let hasHull = false;
        let hasEngine = false;
        let hasPower = false;
        let totalMass = 0;
        let totalPowerConsumption = 0;
        let totalPowerGeneration = 0;
        
        // Analyze components
        for (const component of data.components) {
            // Check tech requirements
            if (component.requiredTech && !data.ignoreTechRequirements) {
                for (const tech of component.requiredTech) {
                    if (!this.empire.hasTech(tech)) {
                        this.addTechRequirement(
                            `Ship "${widget.title}" component "${component.name}" requires ${tech}`,
                            tech, widget.id
                        );
                    }
                }
            }
            
            // Component type checking
            if (component.type === 'hull') hasHull = true;
            if (component.type === 'engine') hasEngine = true;
            if (component.type === 'reactor') hasPower = true;
            
            // Calculate totals
            if (component.mass) totalMass += component.mass;
            if (component.powerConsumption) totalPowerConsumption += component.powerConsumption;
            if (component.powerOutput) totalPowerGeneration += component.powerOutput;
        }
        
        // Essential component checks
        if (!hasHull) {
            this.addError(`Ship "${widget.title}" requires a hull component`, widget.id);
        }
        if (!hasEngine) {
            this.addError(`Ship "${widget.title}" requires an engine component`, widget.id);
        }
        if (!hasPower && totalPowerConsumption > 0) {
            this.addError(`Ship "${widget.title}" requires power generation for its components`, widget.id);
        }
        
        // Power balance check
        if (totalPowerConsumption > totalPowerGeneration) {
            this.addError(`Ship "${widget.title}" has insufficient power: ${totalPowerGeneration} generated, ${totalPowerConsumption} required`, widget.id);
        } else if (totalPowerConsumption < totalPowerGeneration * 0.5) {
            this.addWarning(`Ship "${widget.title}" has excess power generation`, widget.id);
        }
        
        // Mass warnings
        if (totalMass > 1000) {
            this.addWarning(`Ship "${widget.title}" is very heavy (${totalMass} mass units)`, widget.id);
        }
    }

    checkHullBasedShip(widget, shipData) {
        const hull = shipData.hullComposition;
        const totalHulls = typeof widget.getTotalHulls === 'function'
            ? widget.getTotalHulls()
            : Object.values(hull || {}).reduce((sum, count) => sum + count, 0);

        // Connection expectations for new node layout
        const outfitConnections = this.countNodeConnections(widget, 'outfit', 'output');
        if (outfitConnections === 0) {
            this.addWarning(`Ship "${widget.title}" requires an Outfit connection`, widget.id);
        }

        const loadoutConnections = this.countNodeConnections(widget, 'loadout', 'output');
        const magazineHulls = (hull?.magazine || 0);
        const hangarHulls = (hull?.hangar || 0);
        if ((magazineHulls + hangarHulls) > 0 && loadoutConnections === 0) {
            this.addWarning(`Ship "${widget.title}" has magazine or hangar hulls without a Loadout connection`, widget.id);
        }

        const parentShip = this.getShipParent(widget);
        if (parentShip) {
            const parentTotal = typeof parentShip.getTotalHulls === 'function'
                ? parentShip.getTotalHulls()
                : Object.values(parentShip.shipData?.hullComposition || {}).reduce((sum, count) => sum + count, 0);
            if (totalHulls !== parentTotal) {
                this.addError(
                    `Ship "${widget.title}" inherits from "${parentShip.title}" and must keep ${parentTotal} hulls (currently ${totalHulls}).`,
                    widget.id
                );
            }

            const parentFoundations = parentShip.shipData?.foundations || {};
            const childFoundations = shipData.foundations || {};
            const mismatched = [];
            Object.keys(parentFoundations).forEach(key => {
                if (!!parentFoundations[key] !== !!childFoundations[key]) {
                    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
                    mismatched.push(label);
                }
            });
            if (mismatched.length > 0) {
                this.addError(
                    `Ship "${widget.title}" foundations must match parent "${parentShip.title}" (${mismatched.join(', ')}).`,
                    widget.id
                );
            }
        }
        
        // Check foundations tech requirements if not ignored
        if (!shipData.ignoreTechRequirements && shipData.foundations) {
            Object.entries(shipData.foundations).forEach(([tech, enabled]) => {
                if (enabled && !this.empire.hasTech(tech)) {
                    this.addTechRequirement(
                        `Ship "${widget.title}" foundation "${tech}" requires technology`,
                        tech, widget.id
                    );
                }
            });
        }
        
        // Basic hull validation
        if (totalHulls === 0) {
            this.addWarning(`Ship "${widget.title}" has no hull sections`, widget.id);
        }
    }

    getShipParent(widget) {
        if (!widget?.parents || widget.parents.size === 0 || !this.widgetManager) return null;
        for (const parentId of widget.parents) {
            const parentWidget = this.widgetManager.getWidget(parentId);
            if (parentWidget && (parentWidget.type === 'ship' || parentWidget.type === 'shipPrototype')) {
                return parentWidget;
            }
        }
        return null;
    }

    hasConnectedNode(widget, nodeType, nodeDirection) {
        return this.countNodeConnections(widget, nodeType, nodeDirection) > 0;
    }

    countNodeConnections(widget, nodeType, nodeDirection) {
        if (!widget?.nodes) return 0;
        let total = 0;
        for (const node of widget.nodes.values()) {
            if (node.nodeType === nodeType && node.type === nodeDirection) {
                total += node.connections ? node.connections.size : 0;
            }
        }
        return total;
    }

    getParentWidgetByType(widget, type) {
        if (!widget?.parents || widget.parents.size === 0 || !this.widgetManager) return null;
        for (const parentId of widget.parents) {
            const parentWidget = this.widgetManager.getWidget(parentId);
            if (parentWidget && parentWidget.type === type) {
                return parentWidget;
            }
        }
        return null;
    }

    checkCraftWidget(widget) {
        const data = widget.getSerializedData();
        
        if (!data.components || data.components.length === 0) {
            this.addWarning(`Craft "${widget.title}" has no components`, widget.id);
            return;
        }
        
        // Similar to ship but with different thresholds
        let totalMass = 0;
        for (const component of data.components) {
            if (component.requiredTech) {
                for (const tech of component.requiredTech) {
                    if (!this.empire.hasTech(tech)) {
                        this.addTechRequirement(
                            `Craft "${widget.title}" component "${component.name}" requires ${tech}`,
                            tech, widget.id
                        );
                    }
                }
            }
            if (component.mass) totalMass += component.mass;
        }
        
        // Craft should be lighter than ships
        if (totalMass > 200) {
            this.addWarning(`Craft "${widget.title}" is heavy for a small craft (${totalMass} mass units)`, widget.id);
        }

        const craftLinks = this.countNodeConnections(widget, 'craft', 'output');
        if (craftLinks === 0) {
            this.addAlert(`Craft "${widget.title}" is not assigned to any loadout`, widget.id);
        }
    }

    checkTroopsWidget(widget) {
        const data = widget.getSerializedData();
        
        if (!data.equipment || data.equipment.length === 0) {
            this.addWarning(`Troop unit "${widget.title}" has no equipment`, widget.id);
        }
        
        // Check equipment tech requirements
        if (data.equipment) {
            for (const equipment of data.equipment) {
                if (equipment.requiredTech) {
                    for (const tech of equipment.requiredTech) {
                        if (!this.empire.hasTech(tech)) {
                            this.addTechRequirement(
                                `Troop unit "${widget.title}" equipment "${equipment.name}" requires ${tech}`,
                                tech, widget.id
                            );
                        }
                    }
                }
            }
        }

        const troopLinks = this.countNodeConnections(widget, 'troop', 'output');
        if (troopLinks === 0) {
            this.addAlert(`Troop unit "${widget.title}" is not assigned to any berth plan`, widget.id);
        }
    }

    checkMissilesWidget(widget) {
        const data = widget.getSerializedData();
        
        if (!data.warhead && !data.guidance) {
            this.addError(`Missile "${widget.title}" requires warhead and guidance systems`, widget.id);
        }
        
        // Check tech requirements for missile components
        const components = [data.warhead, data.guidance, data.propulsion].filter(Boolean);
        for (const component of components) {
            if (component.requiredTech) {
                for (const tech of component.requiredTech) {
                    if (!this.empire.hasTech(tech)) {
                        this.addTechRequirement(
                            `Missile "${widget.title}" component "${component.name}" requires ${tech}`,
                            tech, widget.id
                        );
                    }
                }
            }
        }

        const weaponLinks = this.countNodeConnections(widget, 'weapon', 'output');
        if (weaponLinks === 0) {
            this.addAlert(`Missile design "${widget.title}" is not assigned to any loadout`, widget.id);
        }
    }

    checkOutfitWidget(widget) {
        const classLinks = this.countNodeConnections(widget, 'outfit', 'input');
        if (classLinks === 0) {
            this.addError(`Outfit "${widget.title}" must connect to a Ship Class`, widget.id);
        }

        const coreLinks = this.countNodeConnections(widget, 'core', 'input');
        if (coreLinks === 0) {
            this.addError(`Outfit "${widget.title}" requires at least one Ship Core`, widget.id);
        }

        const berthLinks = this.countNodeConnections(widget, 'berth', 'output');
        if (berthLinks === 0) {
            this.addWarning(`Outfit "${widget.title}" is not providing any Berth plans`, widget.id);
        }

        const hullLinks = this.countNodeConnections(widget, 'outfit-hull', 'output');
        if (hullLinks === 0) {
            this.addAlert(`Outfit "${widget.title}" is not assigned to any Hull plan`, widget.id);
        }
    }

    checkShipCoreWidget(widget) {
        const coreLinks = this.countNodeConnections(widget, 'core', 'output');
        if (coreLinks === 0) {
            this.addAlert(`Ship core "${widget.title}" is unused`, widget.id);
        }
    }

    checkShipBerthWidget(widget) {
        const outfitLinks = this.countNodeConnections(widget, 'berth', 'input');
        if (outfitLinks === 0) {
            this.addAlert(`Berth plan "${widget.title}" is not linked to an Outfit`, widget.id);
        }

        const troopLinks = this.countNodeConnections(widget, 'troop', 'input');
        if (troopLinks === 0) {
            this.addAlert(`Berth plan "${widget.title}" has unused berth capacity`, widget.id);
        }

        const staffLinks = this.countNodeConnections(widget, 'staff', 'output');
        if (staffLinks === 0) {
            this.addAlert(`Berth plan "${widget.title}" does not produce a staff plan`, widget.id);
        }
    }

    checkShipHullsWidget(widget) {
        const outfitLinks = this.countNodeConnections(widget, 'outfit-hull', 'input');
        if (outfitLinks === 0) {
            this.addError(`Hull plan "${widget.title}" requires an Outfit connection`, widget.id);
        }

        const loadoutLinks = this.countNodeConnections(widget, 'loadout-hull', 'input');
        const staffLinks = this.countNodeConnections(widget, 'staff', 'input');

        const outfitWidget = this.getParentWidgetByType(widget, 'outfit');
        const shipWidget = outfitWidget ? this.getShipParent(outfitWidget) : null;

        if (shipWidget) {
            const hulls = shipWidget.shipData?.hullComposition || {};
            const magazineHulls = hulls.magazine || 0;
            const hangarHulls = hulls.hangar || 0;
            if ((magazineHulls + hangarHulls) > 0 && loadoutLinks === 0) {
                this.addAlert(`Hull plan "${widget.title}" has magazine or hangar capacity without a Loadout connection`, widget.id);
            }
        }

        if (outfitWidget) {
            const modules = outfitWidget.outfitData?.systemsData?.modules || [];
            const hasBerthingSystems = modules.some(module => {
                const key = (module?.moduleId || module?.name || '').toString().toLowerCase();
                return key.includes('berth');
            });
            if (hasBerthingSystems && staffLinks === 0) {
                this.addAlert(`Hull plan "${widget.title}" has berthing systems but no Staff plan connection`, widget.id);
            }
        }
    }

    checkLoadoutsWidget(widget) {
        const data = widget.getSerializedData();
        
        if (!data.items || data.items.length === 0) {
            this.addWarning(`Loadout "${widget.title}" is empty`, widget.id);
        }
        
        // Check for conflicting items or missing dependencies
        if (data.items) {
            const weaponCount = data.items.filter(item => item.type === 'weapon').length;
            const ammoCount = data.items.filter(item => item.type === 'ammunition').length;
            
            if (weaponCount > 0 && ammoCount === 0) {
                this.addWarning(`Loadout "${widget.title}" has weapons but no ammunition`, widget.id);
            }
        }

        const classLinks = this.countNodeConnections(widget, 'loadout', 'input');
        if (classLinks === 0) {
            this.addAlert(`Loadout "${widget.title}" is not linked to a ship class`, widget.id);
        }

        const craftLinks = this.countNodeConnections(widget, 'craft', 'input');
        if (craftLinks === 0) {
            this.addAlert(`Loadout "${widget.title}" has unused hangar bays`, widget.id);
        }

        const weaponLinks = this.countNodeConnections(widget, 'weapon', 'input');
        if (weaponLinks === 0) {
            this.addAlert(`Loadout "${widget.title}" has unused magazines`, widget.id);
        }

        const hullLinks = this.countNodeConnections(widget, 'loadout-hull', 'output');
        if (hullLinks === 0) {
            this.addAlert(`Loadout "${widget.title}" is not assigned to a hull plan`, widget.id);
        }
    }

    checkPowerplantsWidget(widget) {
        const data = widget.getSerializedData();
        
        if (!data.reactorType) {
            this.addError(`Powerplant "${widget.title}" requires a reactor type`, widget.id);
        }
        
        // Check reactor tech requirements
        if (data.reactorType && data.reactorType.requiredTech) {
            for (const tech of data.reactorType.requiredTech) {
                if (!this.empire.hasTech(tech)) {
                    this.addTechRequirement(
                        `Powerplant "${widget.title}" reactor requires ${tech}`,
                        tech, widget.id
                    );
                }
            }
        }
    }

    checkFactoriesWidget(widget) {
        const data = widget.getSerializedData();
        
        if (!data.productionLines || data.productionLines.length === 0) {
            this.addWarning(`Factory "${widget.title}" has no production lines`, widget.id);
        }
        
        // Check if factory can produce what it's set to produce
        if (data.productionLines) {
            for (const line of data.productionLines) {
                if (line.requiredTech) {
                    for (const tech of line.requiredTech) {
                        if (!this.empire.hasTech(tech)) {
                            this.addTechRequirement(
                                `Factory "${widget.title}" production line "${line.name}" requires ${tech}`,
                                tech, widget.id
                            );
                        }
                    }
                }
            }
        }
    }

    checkShipyardsWidget(widget) {
        const data = widget.getSerializedData();
        
        if (!data.shipClass && !data.capabilities) {
            this.addWarning(`Shipyard "${widget.title}" has no defined capabilities`, widget.id);
        }
        
        // Check shipyard tech requirements
        if (data.capabilities) {
            for (const capability of data.capabilities) {
                if (capability.requiredTech) {
                    for (const tech of capability.requiredTech) {
                        if (!this.empire.hasTech(tech)) {
                            this.addTechRequirement(
                                `Shipyard "${widget.title}" capability "${capability.name}" requires ${tech}`,
                                tech, widget.id
                            );
                        }
                    }
                }
            }
        }
    }

    checkConnections() {
        const connectionValidation = this.nodeSystem.validateConnections();
        
        for (const error of connectionValidation.errors) {
            this.addError(error.message, error.connectionId);
        }
        
        for (const warning of connectionValidation.warnings) {
            this.addWarning(warning.message, warning.connectionId);
        }
        
        // Check for unconnected critical nodes
        if (this.widgetManager) {
            for (const widget of this.widgetManager.widgets.values()) {
                for (const [nodeId, node] of widget.nodes) {
                    if (node.nodeType === 'power' && node.type === 'input' && node.connections.size === 0) {
                        this.addWarning(`${widget.title} has unconnected power input`, widget.id);
                    }
                }
            }
        }
    }

    checkEmpireWide() {
        // Check for orphaned designs
        for (const [type, designs] of Object.entries(this.empire.designs)) {
            if (designs.length === 0) {
                continue;
            }
            
            // Check if designs use components that are no longer available
            for (const design of designs) {
                if (design.components) {
                    for (const component of design.components) {
                        if (component.requiredTech) {
                            for (const tech of component.requiredTech) {
                                if (!this.empire.hasTech(tech)) {
                                    this.addTechRequirement(
                                        `Saved ${type} design "${design.name}" uses unavailable technology ${tech}`,
                                        tech, design.id
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    addAlert(message, sourceId) {
        this.alerts.push({ message, sourceId, type: 'alert' });
        this.addToWidgetIssues(sourceId, 'alerts', { message, type: 'alert' });
    }

    addWarning(message, sourceId) {
        this.warnings.push({ message, sourceId, type: 'warning' });
        this.addToWidgetIssues(sourceId, 'warnings', { message, type: 'warning' });
    }

    addError(message, sourceId) {
        this.errors.push({ message, sourceId, type: 'error' });
        this.addToWidgetIssues(sourceId, 'errors', { message, type: 'error' });
    }

    addTechRequirement(message, tech, sourceId) {
        this.techRequirements.push({ message, tech, sourceId, type: 'tech' });
        this.addToWidgetIssues(sourceId, 'techRequirements', { message, tech, type: 'tech' });
    }

    addToWidgetIssues(sourceId, category, issue) {
        if (!sourceId || sourceId === 'empire' || sourceId.startsWith('connection-')) return;
        
        if (!this.widgetIssues.has(sourceId)) {
            this.widgetIssues.set(sourceId, { alerts: [], warnings: [], errors: [], techRequirements: [] });
        }
        
        this.widgetIssues.get(sourceId)[category].push(issue);
    }

    clearWidgetIssues(widgetId) {
        this.widgetIssues.delete(widgetId);
        // Trigger a new check to update the UI
        setTimeout(() => this.runCheck(), 50);
    }

    updateWidgetIndicators() {
        for (const [widgetId, issues] of this.widgetIssues) {
            const widget = this.widgetManager.getWidget(widgetId);
            if (widget) {
                const allIssues = [
                    ...issues.alerts,
                    ...issues.errors,
                    ...issues.warnings,
                    ...issues.techRequirements
                ];
                widget.updatePreflightIndicator(
                    issues.warnings.length,
                    issues.errors.length + issues.techRequirements.length,
                    allIssues,
                    issues.alerts.length
                );
            }
        }
    }

    updateUI() {
        this.updateSummaryBadges();
        this.updateFloatingIssues();
    }

    initToggle() {
        if (!this.preflightMinimizeBtn) return;
        const toggleAction = () => {
            this.isExpanded = !this.isExpanded;
            localStorage.setItem('preflightExpanded', this.isExpanded);
            this.updateToggleState();
        };
        
        this.preflightMinimizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleAction();
        });
        
        this.updateToggleState();
    }

    updateToggleState() {
        if (!this.preflightOverlay) return;
        if (this.isExpanded) {
            if (this.preflightToggle) this.preflightToggle.classList.add('expanded');
            this.preflightOverlay.classList.remove('hidden');
            if (this.preflightSummary) this.preflightSummary.classList.add('is-hidden');
            if (this.preflightMinimizeBtn) this.preflightMinimizeBtn.textContent = '−';
        } else {
            if (this.preflightToggle) this.preflightToggle.classList.remove('expanded');
            this.preflightOverlay.classList.add('hidden');
            if (this.preflightSummary) this.preflightSummary.classList.remove('is-hidden');
            if (this.preflightMinimizeBtn) this.preflightMinimizeBtn.textContent = '+';
        }
    }

    updateSummaryBadges() {
        const summaryErrors = document.getElementById('summaryErrors');
        const summaryWarnings = document.getElementById('summaryWarnings');
        const summaryAlerts = document.getElementById('summaryAlerts');
        
        if (!summaryErrors || !summaryWarnings) return;
        const filteredWarnings = this.warnings;
        
        // Convert unmet tech requirements to errors
        const techErrors = this.techRequirements.length > 0 ? this.techRequirements : [];
        const totalErrors = this.errors.length + techErrors.length;

        if (summaryAlerts) {
            if (this.alerts.length > 0) {
                summaryAlerts.textContent = this.alerts.length;
                summaryAlerts.style.display = 'inline-block';
            } else {
                summaryAlerts.style.display = 'none';
            }
        }
        
        // Update warning badge
        if (filteredWarnings.length > 0) {
            summaryWarnings.textContent = filteredWarnings.length;
            summaryWarnings.style.display = 'inline-block';
        } else {
            summaryWarnings.style.display = 'none';
        }
        
        // Update error badge
        if (totalErrors > 0) {
            summaryErrors.textContent = totalErrors;
            summaryErrors.style.display = 'inline-block';
        } else {
            summaryErrors.style.display = 'none';
        }
    }

    updateFloatingIssues() {
        if (!this.preflightIssues) return;
        
        // Create current issues list with unique IDs
        const currentIssues = new Map();
        
        // Add alerts
        this.alerts.forEach(alert => {
            const id = `alert_${alert.message}_${alert.sourceId}`;
            currentIssues.set(id, {
                type: 'alert',
                message: alert.message,
                sourceId: alert.sourceId
            });
        });

        // Add warnings
        this.warnings.forEach(warning => {
            const id = `warning_${warning.message}_${warning.sourceId}`;
            currentIssues.set(id, {
                type: 'warning',
                message: warning.message,
                sourceId: warning.sourceId
            });
        });
        
        // Add errors
        this.errors.forEach(error => {
            const id = `error_${error.message}_${error.sourceId}`;
            currentIssues.set(id, {
                type: 'error',
                message: error.message,
                sourceId: error.sourceId
            });
        });
        
        // Convert tech requirements to errors
        this.techRequirements.forEach(req => {
            const id = `tech_error_${req.message}_${req.sourceId}`;
            currentIssues.set(id, {
                type: 'error',
                message: req.message,
                sourceId: req.sourceId
            });
        });
        
        // Animate changes
        this.animateIssueChanges(currentIssues);
        
        // Update tracking
        this.previousIssues = new Map(currentIssues);
    }

    animateIssueChanges(currentIssues) {
        // Find issues to remove
        const toRemove = [];
        for (const [id, element] of this.currentIssueElements) {
            if (!currentIssues.has(id)) {
                toRemove.push({ id, element });
            }
        }
        
        // Find issues to add
        const toAdd = [];
        for (const [id, issue] of currentIssues) {
            if (!this.currentIssueElements.has(id)) {
                toAdd.push({ id, issue });
            }
        }
        
        // Animate out removed issues
        toRemove.forEach(({ id, element }) => {
            element.style.animation = 'slideOutRight 0.3s ease-out';
            element.addEventListener('animationend', () => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                this.currentIssueElements.delete(id);
            }, { once: true });
        });
        
        // Add new issues with animation
        toAdd.forEach(({ id, issue }) => {
            const item = document.createElement('div');
            item.className = `preflight-issue-item ${issue.type}`;
            item.textContent = issue.message;
            item.onclick = () => this.focusOnSource(issue.sourceId);
            item.style.animation = 'slideInRight 0.3s ease-out';
            
            this.preflightIssues.appendChild(item);
            this.currentIssueElements.set(id, item);
        });
    }

    focusOnSource(sourceId) {
        if (!sourceId || sourceId === 'empire') return;
        
        // Try to find and focus the widget
        if (this.widgetManager) {
            const widget = this.widgetManager.widgets.get(sourceId);
            if (widget) {
                widget.select();
                
                // Scroll widget into view
                const canvas = document.getElementById('canvas');
                const canvasRect = canvas.getBoundingClientRect();
                const widgetRect = widget.element.getBoundingClientRect();
                
                if (widgetRect.top < canvasRect.top || widgetRect.bottom > canvasRect.bottom ||
                    widgetRect.left < canvasRect.left || widgetRect.right > canvasRect.right) {
                    canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    }

    updatePreflightSummary() {
        const summaryErrors = document.getElementById('summaryErrors');
        const summaryWarnings = document.getElementById('summaryWarnings');
        
        if (summaryErrors && summaryWarnings) {
            const totalErrors = this.errors.length + this.techRequirements.length;
            const totalWarnings = this.warnings.length;
            const summaryAlerts = document.getElementById('summaryAlerts');
            
            summaryErrors.textContent = totalErrors;
            summaryWarnings.textContent = totalWarnings;
            if (summaryAlerts) {
                summaryAlerts.textContent = this.alerts.length;
                summaryAlerts.style.display = this.alerts.length > 0 ? 'inline' : 'none';
            }
            
            // Hide badges if count is 0
            summaryErrors.style.display = totalErrors > 0 ? 'inline' : 'none';
            summaryWarnings.style.display = totalWarnings > 0 ? 'inline' : 'none';
        }
    }

    getSummary() {
        return {
            alertCount: this.alerts.length,
            errorCount: this.errors.length,
            warningCount: this.warnings.length,
            techRequirementCount: this.techRequirements.length,
            hasIssues: this.errors.length > 0 || this.techRequirements.length > 0
        };
    }
}