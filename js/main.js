// Main application entry point
class FVTacticalApp {
    constructor() {
        this.empire = new Empire();
        this.widgetManager = new WidgetManager();
        this.nodeSystem = new NodeSystem();
        this.dataManager = new DataManager();
        this.preflightCheck = new PreflightCheck(this.empire, this.widgetManager, this.nodeSystem);
        this.cascadeDragEnabled = false;
        
    // Tech tree filter states
    this.hideUnavailableTech = false; // hides locked techs
    this.collapseOlderResearched = false; // shows only highest tier researched in linear chains
        
        // Make globally accessible
        window.empire = this.empire;
        window.widgetManager = this.widgetManager;
        window.nodeSystem = this.nodeSystem;
        window.dataManager = this.dataManager;
        window.preflightCheck = this.preflightCheck;
        window.app = this;
        
        this.init();
    }

    init() {
        this.setupUI();
        this.setupEventListeners();
        this.initializeTechTree();
        this.updateEmpireDisplay();
        
        // Try to load saved data
        this.loadSavedData();
        
        // Enable auto-save
        this.dataManager.enableAutoSave(
            this.empire,
            () => this.widgetManager.widgets,
            () => this.nodeSystem
        );
        
        // Initial preflight check
        this.preflightCheck.runCheck();
        
        console.log('FV-Tactical initialized successfully');
    }

    setupUI() {
        // Setup panel toggles
        this.setupPanelToggles();
        
        // Setup empire controls
        this.setupEmpireControls();
        
        // Update empty canvas text visibility
        this.updateEmptyCanvasText();

        // Setup workspace utilities
        this.setupWorkspaceUtilities();

        // Initialize minimap (after DOM elements exist)
        this.initMinimap();
    }

    setupPanelToggles() {
        const techTreeToggle = document.getElementById('techTreeToggle');
        const techTreePanel = document.getElementById('techTreePanel');
        
        if (techTreeToggle && techTreePanel) {
            techTreeToggle.addEventListener('click', () => {
                techTreePanel.classList.toggle('collapsed');
                techTreeToggle.textContent = techTreePanel.classList.contains('collapsed') ? '+' : '−';
            });
        }
        
        // Setup tech tree controls
        this.setupTechTreeControls();
    }

    setupWorkspaceUtilities() {
        const resetBtn = document.getElementById('resetViewBtn');
        const cascadeBtn = document.getElementById('toggleCascadeDrag');
        const workspace = document.getElementById('workspace');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.fitToContent());
        }

        if (cascadeBtn) {
            cascadeBtn.addEventListener('click', () => {
                const enabled = cascadeBtn.getAttribute('data-enabled') === 'true';
                const next = !enabled;
                cascadeBtn.setAttribute('data-enabled', String(next));
                cascadeBtn.title = next ? 'Cascade drag: ON' : 'Cascade drag: OFF';
                cascadeBtn.style.background = next ? '#4a90e2' : '';
                this.cascadeDragEnabled = next;
                // Apply to all existing widgets
                if (this.widgetManager) {
                    for (const widget of this.widgetManager.widgets.values()) {
                        widget.enableCascadeDrag = next;
                    }
                }
            });
            cascadeBtn.title = 'Cascade drag: OFF';
        }
        // Removed workspace double-click to avoid accidental zoom/scale changes when adding widgets.
    }

    fitToContent(padding = 80) {
        const bounds = this.getWorkspaceBounds();
        const workspace = document.getElementById('workspace');
        if (!bounds || !workspace) return;
        const viewportWidth = workspace.clientWidth;
        const viewportHeight = workspace.clientHeight;
        const contentWidth = bounds.maxX - bounds.minX;
        const contentHeight = bounds.maxY - bounds.minY;
        if (contentWidth <= 0 || contentHeight <= 0) {
            // If no measurable content, avoid unexpected zoom/translate flicker
            if (this.workspaceTransform.scale !== 1) {
                this.resetView();
            }
            return;
        }
        const scaleX = (viewportWidth - padding) / contentWidth;
        const scaleY = (viewportHeight - padding) / contentHeight;
        const targetScale = Math.max(0.1, Math.min(2.5, Math.min(scaleX, scaleY)));
        this.workspaceTransform.scale = targetScale;
        // Center
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        this.workspaceTransform.translateX = viewportWidth / 2 - centerX * targetScale;
        this.workspaceTransform.translateY = viewportHeight / 2 - centerY * targetScale;
        this.updateWorkspaceTransform();
    }

    resetView() {
        const workspace = document.getElementById('workspace');
        if (!workspace) return;
        const viewportWidth = workspace.clientWidth;
        const viewportHeight = workspace.clientHeight;
        this.workspaceTransform.scale = 1;
        this.workspaceTransform.translateX = viewportWidth / 2 - 400; // Assume nominal center region
        this.workspaceTransform.translateY = viewportHeight / 2 - 300;
        this.updateWorkspaceTransform();
    }

    setupTechTreeControls() {
        const expandCollapseBtn = document.getElementById('toggleExpandCollapseTech');
        const toggleUnavailableBtn = document.getElementById('toggleUnavailableTech');
        const toggleResearchedBtn = document.getElementById('toggleResearchedTech');

        // Load persisted states
        const persisted = JSON.parse(localStorage.getItem('techTreeFilters') || '{}');
        this.hideUnavailableTech = !!persisted.hideUnavailable;
        this.hideResearchedTech = !!persisted.hideResearched;

        if (toggleUnavailableBtn) {
            if (this.hideUnavailableTech) toggleUnavailableBtn.classList.add('active-filter');
            toggleUnavailableBtn.textContent = this.hideUnavailableTech ? 'Show Unavailable' : 'Hide Unavailable';
        }
        if (toggleResearchedBtn) {
            if (this.hideResearchedTech) toggleResearchedBtn.classList.add('active-filter');
            toggleResearchedBtn.textContent = this.hideResearchedTech ? 'Show Researched' : 'Hide Researched';
        }

        if (expandCollapseBtn) {
            expandCollapseBtn.addEventListener('click', () => {
                const mode = expandCollapseBtn.dataset.mode;
                const categories = document.querySelectorAll('.tech-category');
                if (mode === 'expanded') {
                    categories.forEach(c => c.classList.remove('expanded'));
                    expandCollapseBtn.dataset.mode = 'collapsed';
                    expandCollapseBtn.textContent = 'Expand All';
                } else {
                    categories.forEach(c => c.classList.add('expanded'));
                    expandCollapseBtn.dataset.mode = 'expanded';
                    expandCollapseBtn.textContent = 'Collapse All';
                }
                this.updateTechTreeIndicators();
            });
        }

        if (toggleUnavailableBtn) {
            toggleUnavailableBtn.addEventListener('click', () => {
                this.hideUnavailableTech = !this.hideUnavailableTech;
                toggleUnavailableBtn.classList.toggle('active-filter', this.hideUnavailableTech);
                toggleUnavailableBtn.textContent = this.hideUnavailableTech ? 'Show Unavailable' : 'Hide Unavailable';
                this.persistTechFilters();
                this.updateTechTree();
            });
        }

        if (toggleResearchedBtn) {
            toggleResearchedBtn.addEventListener('click', () => {
                this.hideResearchedTech = !this.hideResearchedTech;
                toggleResearchedBtn.classList.toggle('active-filter', this.hideResearchedTech);
                toggleResearchedBtn.textContent = this.hideResearchedTech ? 'Show Researched' : 'Hide Researched';
                this.persistTechFilters();
                this.updateTechTree();
            });
        }
    }

    persistTechFilters() {
        localStorage.setItem('techTreeFilters', JSON.stringify({
            hideUnavailable: this.hideUnavailableTech,
            hideResearched: this.hideResearchedTech
        }));
    }

    setupEmpireControls() {
        const saveBtn = document.getElementById('saveEmpire');
        const loadBtn = document.getElementById('loadEmpire');
        const exportBtn = document.getElementById('exportData');
        const importBtn = document.getElementById('importDataBtn');
        const importFile = document.getElementById('importData');

        if (saveBtn) saveBtn.addEventListener('click', () => this.saveEmpire());
        if (loadBtn) loadBtn.addEventListener('click', () => this.loadEmpire());
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportEmpire());
        if (importBtn && importFile) {
            importBtn.addEventListener('click', () => importFile.click());
            importFile.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.importEmpire(e.target.files[0]);
                }
            });
        }
    }

    updateEmptyCanvasText() {
        const emptyText = document.getElementById('emptyCanvasText');
        if (emptyText) {
            const hasWidgets = this.widgetManager.widgets.size > 0;
            const hasEmpire = this.empire.name !== 'New Empire';
            
            // Show text only when no widgets and no empire loaded
            if (!hasWidgets && !hasEmpire) {
                emptyText.classList.remove('hidden');
            } else {
                emptyText.classList.add('hidden');
            }
        }
    }

    setupEventListeners() {
        // Initialize workspace interaction
        this.initWorkspaceInteraction();
        
        // Canvas click to deselect widgets and show context menu
        const canvas = document.getElementById('canvas');
        if (canvas) {
            canvas.addEventListener('click', (e) => {
                if (e.target === canvas) {
                    this.widgetManager.deselectAll();
                    this.hideContextMenu();
                }
            });
            
            canvas.addEventListener('dblclick', (e) => {
                if (e.target === canvas) {
                    e.preventDefault();
                    e.stopPropagation(); // Prevent workspace-level dblclick handlers from firing (fitToContent)
                    this.showContextMenu(e.clientX, e.clientY);
                }
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        this.saveEmpire();
                        break;
                    case 'o':
                        e.preventDefault();
                        document.getElementById('loadEmpire')?.click();
                        break;
                    case 'e':
                        e.preventDefault();
                        this.exportEmpire();
                        break;
                }
            }
            
            if (e.key === 'Delete') {
                this.widgetManager.deleteSelected();
            }
        });
    }

    createWidget(type, x = null, y = null) {
        const canvas = document.getElementById('canvas');
        if (!canvas) {
            console.error('Canvas not found');
            return;
        }
        
        // Use provided position or calculate default position
        if (x === null || y === null) {
            const existingWidgets = Array.from(this.widgetManager.widgets.values())
                .filter(w => w.type === type);
            const offset = existingWidgets.length * 30;
            
            x = 150 + offset;
            y = 100 + offset;
        }
        
        // Defensive: If coordinates blew up due to stale transform, clamp into canvas bounds
        if (x !== null && y !== null) {
            if (Math.abs(x) > 20000 || Math.abs(y) > 20000) {
                console.warn('Clamping extreme widget creation coords', x, y);
                x = Math.max(0, Math.min(x, canvas.offsetWidth - 500));
                y = Math.max(0, Math.min(y, canvas.offsetHeight - 400));
            }
        }

        let widget;
        
        try {
            switch (type) {
                case 'ship':
                    widget = new ShipWidget(x, y);
                    break;
                case 'craft':
                    widget = new CraftWidget(x, y);
                    break;
                case 'troops':
                    widget = new TroopsWidget(x, y);
                    break;
                case 'missiles':
                    widget = new MissilesWidget(x, y);
                    break;
                case 'systems':
                    widget = new SystemsWidget(x, y);
                    break;
                case 'loadouts':
                    widget = new LoadoutsWidget(x, y);
                    break;
                case 'powerplants':
                    widget = new PowerplantsWidget(x, y);
                    break;
                case 'factories':
                    widget = new FactoriesWidget(x, y);
                    break;
                case 'shipyards':
                    widget = new ShipyardsWidget(x, y);
                    break;
                default:
                    console.warn('Unknown widget type:', type);
                    return;
            }
        } catch (error) {
            console.error('Error creating widget:', error);
            this.showNotification(`Failed to create ${type} widget: ${error.message}`, 'error');
            return;
        }
        
        if (widget) {
            this.widgetManager.addWidget(widget);
            widget.select();
            this.preflightCheck.runCheck();
            // Ensure new widget is visible (only adjust if outside viewport)
            this.ensureWidgetVisible(widget);
            return widget; // Return widget for auto-connection system
        }
    }

    focusWidget(widget) {
        if (!widget) return;
        const workspace = document.getElementById('workspace');
        if (!workspace) return;
        const viewportWidth = workspace.clientWidth;
        const viewportHeight = workspace.clientHeight;
        const scale = this.workspaceTransform?.scale || 1;
        const centerX = widget.x + widget.width / 2;
        const centerY = widget.y + widget.height / 2;
        this.workspaceTransform.translateX = viewportWidth / 2 - centerX * scale;
        this.workspaceTransform.translateY = viewportHeight / 2 - centerY * scale;
        this.updateWorkspaceTransform();
    }

    ensureWidgetVisible(widget, margin = 40) {
        if (!widget) return;
        const workspace = document.getElementById('workspace');
        if (!workspace) return;
        // Current transform
        const t = this.workspaceTransform || { translateX:0, translateY:0, scale:1 };
        const scale = t.scale;
        // Visible world bounds
        const viewMinX = -t.translateX / scale;
        const viewMinY = -t.translateY / scale;
        const viewMaxX = (workspace.clientWidth - t.translateX) / scale;
        const viewMaxY = (workspace.clientHeight - t.translateY) / scale;
        const wMinX = widget.x;
        const wMinY = widget.y;
        const wMaxX = widget.x + widget.width;
        const wMaxY = widget.y + widget.height;
        let adjustX = 0, adjustY = 0;
        if (wMinX < viewMinX + margin) {
            adjustX = (viewMinX + margin - wMinX) * scale;
        } else if (wMaxX > viewMaxX - margin) {
            adjustX = (viewMaxX - margin - wMaxX) * scale;
        }
        if (wMinY < viewMinY + margin) {
            adjustY = (viewMinY + margin - wMinY) * scale;
        } else if (wMaxY > viewMaxY - margin) {
            adjustY = (viewMaxY - margin - wMaxY) * scale;
        }
        if (adjustX !== 0 || adjustY !== 0) {
            this.workspaceTransform.translateX += adjustX;
            this.workspaceTransform.translateY += adjustY;
            this.updateWorkspaceTransform();
        }
    }

    initializeTechTree() {
        const techTreeContainer = document.getElementById('techTreeContainer');
        if (!techTreeContainer) return;
        
        const categories = TechTree.getTechsByCategory();
        
        for (const [categoryName, techs] of Object.entries(categories)) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'tech-category expanded';
            
            const header = document.createElement('div');
            header.className = 'tech-category-header';
            
            const headerText = document.createElement('span');
            headerText.className = 'tech-category-title';
            headerText.textContent = categoryName;
            
            const indicator = document.createElement('span');
            indicator.className = 'tech-available-indicator';
            indicator.textContent = '0';
            indicator.style.display = 'none';
            
            header.appendChild(headerText);
            header.appendChild(indicator);
            
            header.addEventListener('click', () => {
                categoryDiv.classList.toggle('expanded');
                // Use a small delay to allow CSS transition to complete
                setTimeout(() => {
                    this.updateTechTreeIndicators();
                }, 50);
            });
            
            const content = document.createElement('div');
            content.className = 'tech-category-content';
            
            for (const tech of techs) {
                const techItem = document.createElement('div');
                techItem.className = 'tech-item';
                techItem.title = tech.description;
                
                // Create main content row
                const mainRow = document.createElement('div');
                mainRow.className = 'tech-item-main';
                
                const titleDiv = document.createElement('div');
                titleDiv.className = 'tech-item-title';
                titleDiv.textContent = tech.name;
                
                const costDiv = document.createElement('div');
                costDiv.className = 'tech-item-cost';
                costDiv.textContent = `${tech.cost} pts`;
                
                mainRow.appendChild(titleDiv);
                mainRow.appendChild(costDiv);
                techItem.appendChild(mainRow);
                
                // Create prerequisites row (initially hidden, shown when unmet)
                const prereqRow = document.createElement('div');
                prereqRow.className = 'tech-item-prereqs';
                techItem.appendChild(prereqRow);
                
                techItem.addEventListener('click', () => {
                    if (this.empire.canResearch(tech.id)) {
                        if (confirm(`Research "${tech.name}" for ${tech.cost} tech points?`)) {
                            if (this.empire.researchTech(tech.id)) {
                                this.updateTechTree();
                                this.updateEmpireDisplay();
                                this.preflightCheck.runCheck();
                            } else {
                                alert('Insufficient tech points!');
                            }
                        }
                    }
                });
                
                content.appendChild(techItem);
            }
            
            categoryDiv.appendChild(header);
            categoryDiv.appendChild(content);
            techTreeContainer.appendChild(categoryDiv);
        }
        
        this.updateTechTree();
    }

    updateTechTreeIndicators() {
        const categories = document.querySelectorAll('.tech-category');
        
        categories.forEach(categoryDiv => {
            const indicator = categoryDiv.querySelector('.tech-available-indicator');
            const isCollapsed = !categoryDiv.classList.contains('expanded');
            
            if (isCollapsed && indicator) {
                // Count visible available techs in this category (respect filters)
                const techItems = Array.from(categoryDiv.querySelectorAll('.tech-item.available'))
                    .filter(el => el.style.display !== 'none');
                const count = techItems.length;
                
                indicator.textContent = count.toString();
                indicator.style.display = count > 0 ? 'flex' : 'none';
            } else if (indicator) {
                indicator.style.display = 'none';
            }
        });
    }

    updateTechTree() {
        const techItems = document.querySelectorAll('.tech-item');

        // Build mapping of techId to chain
        const researched = this.empire.researchedTech;
        const highestResearched = new Set();
        if (this.hideResearchedTech) {
            for (const techId of researched) {
                if ([...highestResearched].some(id => TechTree.getTechPrerequisites(id).includes(techId))) continue;
                let current = techId;
                while (true) {
                    const deps = TechTree.getTechDependents(current).filter(d => researched.has(d));
                    if (deps.length === 1) { current = deps[0]; continue; }
                    break;
                }
                highestResearched.add(current);
            }
        }

        techItems.forEach(item => {
            const titleElement = item.querySelector('.tech-item-title');
            const prereqElement = item.querySelector('.tech-item-prereqs');
            if (!titleElement) return;
            const techName = titleElement.textContent;
            const techId = Object.keys(TechTree.techData).find(id => TechTree.techData[id].name === techName);
            if (!techId) return;
            const tech = TechTree.techData[techId];
            item.classList.remove('researched', 'available', 'locked');
            item.style.display = '';

            if (researched.has(techId)) {
                item.classList.add('researched');
                prereqElement.style.display = 'none';
                if (this.hideResearchedTech && !highestResearched.has(techId)) item.style.display = 'none';
            } else if (this.empire.availableTech.has(techId)) {
                item.classList.add('available');
                prereqElement.style.display = 'none';
            } else {
                item.classList.add('locked');
                if (this.hideUnavailableTech) item.style.display = 'none';
                const unmetPrereqs = tech.prerequisites.filter(p => !researched.has(p));
                if (unmetPrereqs.length) {
                    prereqElement.textContent = 'Requires: ' + unmetPrereqs.map(p => TechTree.techData[p]?.name || p).join(', ');
                    prereqElement.style.display = 'block';
                } else {
                    prereqElement.style.display = 'none';
                }
            }
        });

        // Hide empty categories
        document.querySelectorAll('.tech-category').forEach(cat => {
            const visible = Array.from(cat.querySelectorAll('.tech-item')).some(i => i.style.display !== 'none');
            cat.style.display = visible ? '' : 'none';
        });

        this.updateTechTreeIndicators();
    }

    updateEmpireDisplay() {
        const empireName = document.getElementById('empireName');
        const techPoints = document.getElementById('techPoints');
        
        if (empireName) {
            empireName.textContent = this.empire.name;
        }
        
        if (techPoints) {
            techPoints.textContent = `Tech Points: ${this.empire.techPoints}`;
        }
        
        // Update empty canvas text visibility
        this.updateEmptyCanvasText();
    }

    saveEmpire() {
        if (this.dataManager.saveToLocalStorage(this.empire, this.widgetManager.widgets, this.nodeSystem)) {
            this.showNotification('Empire saved successfully', 'success');
        } else {
            this.showNotification('Failed to save empire', 'error');
        }
    }

    loadEmpire() {
        const data = this.dataManager.loadFromLocalStorage();
        if (data) {
            this.loadEmpireData(data);
            this.showNotification('Empire loaded successfully', 'success');
        } else {
            this.showNotification('No saved empire found', 'warning');
        }
    }

    exportEmpire() {
        if (this.dataManager.exportToFile(this.empire, this.widgetManager.widgets, this.nodeSystem)) {
            this.showNotification('Empire exported successfully', 'success');
        } else {
            this.showNotification('Failed to export empire', 'error');
        }
    }

    async importEmpire(file) {
        if (!file) return;
        
        try {
            const data = await this.dataManager.importFromFile(file);
            this.loadEmpireData(data);
            this.showNotification('Empire imported successfully', 'success');
        } catch (error) {
            this.showNotification(`Import failed: ${error.message}`, 'error');
        }
    }

    loadEmpireData(data) {
        // Clear existing widgets
        this.widgetManager.clearAll();
        
        // Load empire data
        this.empire.fromJSON(data.empire);
        
        // Recreate widgets
        for (const widgetData of data.widgets || []) {
            let widget;
            switch (widgetData.type) {
                case 'ship': widget = new ShipWidget(); break;
                case 'craft': widget = new CraftWidget(); break;
                case 'troops': widget = new TroopsWidget(); break;
                case 'missiles': widget = new MissilesWidget(); break;
                case 'systems': widget = new SystemsWidget(); break;
                case 'loadouts': widget = new LoadoutsWidget(); break;
                case 'powerplants': widget = new PowerplantsWidget(); break;
                case 'factories': widget = new FactoriesWidget(); break;
                case 'shipyards': widget = new ShipyardsWidget(); break;
            }
            
            if (widget) {
                widget.fromJSON(widgetData);
                this.widgetManager.addWidget(widget);
            }
        }
        
        // Restore connections
        if (data.connections) {
            this.nodeSystem.fromJSON(data.connections);
        }
        
        // Update UI
        this.updateTechTree();
        this.updateEmpireDisplay();
        this.preflightCheck.runCheck();
        

    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-size: 14px;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s;
        `;
        
        switch (type) {
            case 'success':
                notification.style.background = '#2d4a2d';
                break;
            case 'error':
                notification.style.background = '#4a2d2d';
                break;
            case 'warning':
                notification.style.background = '#4a3d2d';
                break;
            default:
                notification.style.background = '#2d3d4a';
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.style.opacity = '1', 10);
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    runPreflightCheck() {
        this.preflightCheck.runCheck();
    }

    addTechPoints(amount) {
        this.empire.techPoints += amount;
        this.updateEmpireDisplay();
    }

    showContextMenu(x, y) {
        this.hideContextMenu(); // Remove any existing context menu
        
        const contextMenu = document.createElement('div');
        contextMenu.id = 'widget-context-menu';
        contextMenu.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            background: #2d2d2d;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 4px 0;
            min-width: 160px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        const widgetTypes = [
            { type: 'ship', label: '🚢 Ship Design' },
            { type: 'craft', label: '✈️ Craft Design' },
            { type: 'troops', label: '👥 Troop Unit' },
            { type: 'missiles', label: '🚀 Missile Design' },
            { type: 'systems', label: '🖥️ Ship Systems' },
            { type: 'loadouts', label: '📦 Equipment Loadout' },
            { type: 'powerplants', label: '⚡ Powerplant' },
            { type: 'factories', label: '🏭 Factory' },
            { type: 'shipyards', label: '🔧 Shipyard' }
        ];
        
        widgetTypes.forEach(({ type, label }) => {
            const menuItem = document.createElement('div');
            menuItem.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                font-size: 14px;
                color: #e0e0e0;
                transition: background 0.2s;
            `;
            menuItem.textContent = label;
            
            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.background = '#4a4a4a';
            });
            
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.background = 'transparent';
            });
            
            menuItem.addEventListener('click', () => {
                // Translate screen coords (x,y) to world (pre-transform) coords
                const workspace = document.getElementById('workspace');
                const canvas = document.getElementById('canvas');
                if (!workspace || !canvas) return;
                const workspaceRect = workspace.getBoundingClientRect();
                // Mouse position relative to workspace viewport
                const relX = x - workspaceRect.left;
                const relY = y - workspaceRect.top;
                const t = this.workspaceTransform || { translateX: 0, translateY: 0, scale: 1 };
                const worldX = (relX - t.translateX) / t.scale;
                const worldY = (relY - t.translateY) / t.scale;
                this.createWidget(type, worldX, worldY);
                this.hideContextMenu();
            });
            
            contextMenu.appendChild(menuItem);
        });
        
        document.body.appendChild(contextMenu);
        
        // Hide menu when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('click', this.hideContextMenuHandler);
        }, 0);
    }

    hideContextMenu() {
        const existingMenu = document.getElementById('widget-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        document.removeEventListener('click', this.hideContextMenuHandler);
    }

    hideContextMenuHandler = () => {
        this.hideContextMenu();
    }

    initWorkspaceInteraction() {
        const workspace = document.getElementById('workspace');
        const canvas = document.getElementById('canvas');
        
        if (!workspace || !canvas) return;
        
        // Initialize workspace transform state (scale 1) and center on canvas middle
        const canvasWidth = canvas.offsetWidth;
        const canvasHeight = canvas.offsetHeight;
        const viewportWidth = workspace.clientWidth;
        const viewportHeight = workspace.clientHeight;
        this.workspaceTransform = {
            scale: 1,
            translateX: viewportWidth / 2 - canvasWidth / 2,
            translateY: viewportHeight / 2 - canvasHeight / 2
        };
        // Track current canvas extents for dynamic growth
        this.canvasBounds = { width: canvasWidth, height: canvasHeight };

    // Apply initial transform immediately so user sees centered view without needing to pan
    this.updateWorkspaceTransform();
        
        this.isDraggingWorkspace = false;
        this.dragStart = { x: 0, y: 0 };
        
        // Add pan functionality (drag empty canvas background)
        canvas.addEventListener('mousedown', (e) => {
            if (e.target === canvas) {
                this.isDraggingWorkspace = true;
                this.dragStart.x = e.clientX;
                this.dragStart.y = e.clientY;
                canvas.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });

        // Middle mouse panning anywhere (even over widgets)
        workspace.addEventListener('mousedown', (e) => {
            if (e.button === 1) { // middle button
                this.isDraggingWorkspace = true;
                this.dragStart.x = e.clientX;
                this.dragStart.y = e.clientY;
                document.body.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.isDraggingWorkspace) {
                const deltaX = e.clientX - this.dragStart.x;
                const deltaY = e.clientY - this.dragStart.y;
                
                this.workspaceTransform.translateX += deltaX;
                this.workspaceTransform.translateY += deltaY;
                
                this.updateWorkspaceTransform();
                
                this.dragStart.x = e.clientX;
                this.dragStart.y = e.clientY;
            }
            // Track last mouse screen position for coordinate display
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            this.updateCursorCoords(this.lastMousePos);
        });
        
        document.addEventListener('mouseup', () => {
            if (this.isDraggingWorkspace) {
                this.isDraggingWorkspace = false;
                canvas.style.cursor = '';
                document.body.style.cursor = '';
            }
        });
        
        // Add zoom functionality (scroll wheel) - only on empty space
        workspace.addEventListener('wheel', (e) => {
            // Zoom temporarily disabled
            return; // Remove this return to re-enable zoom logic below
            /*
            // Previous zoom logic retained for easy restoration
            const target = e.target;
            const widget = target.closest('.widget');
            if (widget && !widget.classList.contains('pinned-widget')) return;
            e.preventDefault();
            const rect = workspace.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const step = 0.08;
            const zoomFactor = e.deltaY > 0 ? (1 - step) : (1 + step);
            const newScale = Math.max(0.1, Math.min(5, this.workspaceTransform.scale * zoomFactor));
            if (newScale !== this.workspaceTransform.scale) {
                const canvasX = (mouseX - this.workspaceTransform.translateX) / this.workspaceTransform.scale;
                const canvasY = (mouseY - this.workspaceTransform.translateY) / this.workspaceTransform.scale;
                this.workspaceTransform.scale = newScale;
                this.workspaceTransform.translateX = mouseX - canvasX * newScale;
                this.workspaceTransform.translateY = mouseY - canvasY * newScale;
                this.updateWorkspaceTransform();
            }
            */
        });
    }
    
    getWorkspaceBounds() {
        const workspace = document.getElementById('workspace');
        const canvas = document.getElementById('canvas');
        if (!workspace || !canvas) return null;
        const canvasWidth = canvas.offsetWidth;
        const canvasHeight = canvas.offsetHeight;
        // Bounds are fixed to canvas edges (world space 0..canvasWidth/Height)
        return { minX: 0, minY: 0, maxX: canvasWidth, maxY: canvasHeight };
    }

    constrainWorkspaceTransform() {
        const workspace = document.getElementById('workspace');
        const canvas = document.getElementById('canvas');
        if (!workspace || !canvas) return;
        const bounds = this.getWorkspaceBounds();
        if (!bounds) return;
        const vw = workspace.clientWidth;
        const vh = workspace.clientHeight;
        const scale = this.workspaceTransform.scale;
        const minTranslateX = Math.min(0, vw - bounds.maxX * scale);
        const maxTranslateX = 0;
        const minTranslateY = Math.min(0, vh - bounds.maxY * scale);
        const maxTranslateY = 0;
        if (this.workspaceTransform.translateX < minTranslateX) this.workspaceTransform.translateX = minTranslateX;
        if (this.workspaceTransform.translateX > maxTranslateX) this.workspaceTransform.translateX = maxTranslateX;
        if (this.workspaceTransform.translateY < minTranslateY) this.workspaceTransform.translateY = minTranslateY;
        if (this.workspaceTransform.translateY > maxTranslateY) this.workspaceTransform.translateY = maxTranslateY;
    }

    updateWorkspaceTransform() {
        // Apply boundary constraints only if there are widgets (prevents artificial boundary when empty)
        if (this.widgetManager && this.widgetManager.widgets.size > 0) {
            this.constrainWorkspaceTransform();
        }
        
        const canvas = document.getElementById('canvas');
        const svg = document.getElementById('connectionSvg');
        
        if (canvas) {
            canvas.style.transform = `translate(${this.workspaceTransform.translateX}px, ${this.workspaceTransform.translateY}px) scale(${this.workspaceTransform.scale})`;
        }
        if (svg) {
            svg.style.transform = `translate(${this.workspaceTransform.translateX}px, ${this.workspaceTransform.translateY}px) scale(${this.workspaceTransform.scale})`;
        }
        
        // Update node connections after transform
        if (window.nodeSystem) {
            window.nodeSystem.updateConnections();
        }
        // Intentionally NOT updating cursor coordinates here to avoid large
        // apparent jumps when programmatic recenter/fit/focus occurs. The
        // coordinate readout will refresh on the next real mousemove event.

        // Update minimap viewport
        this.updateMinimap();
    }

    updateCursorCoords(screenPos) {
        const coordEl = document.getElementById('cursorCoords');
        const workspace = document.getElementById('workspace');
        if (!coordEl || !workspace) return;
        if (!screenPos) return;
        const rect = workspace.getBoundingClientRect();
        // Ignore if last stored mouse position is far outside viewport (e.g., after transform recenter)
        if (screenPos.x < rect.left - 5 || screenPos.x > rect.right + 5 || screenPos.y < rect.top - 5 || screenPos.y > rect.bottom + 5) {
            return;
        }
        const relX = screenPos.x - rect.left;
        const relY = screenPos.y - rect.top;
        const t = this.workspaceTransform || { translateX:0, translateY:0, scale:1 };
        const worldX = (relX - t.translateX) / t.scale;
        const worldY = (relY - t.translateY) / t.scale;
        coordEl.textContent = `${Math.round(worldX)} , ${Math.round(worldY)}`;
    }

    // ------------------ Minimap ------------------
    initMinimap() {
        this.minimapEl = document.getElementById('minimap');
        this.minimapViewportEl = document.getElementById('minimapViewport');
        this.isDraggingMinimapViewport = false;
        if (!this.minimapEl || !this.minimapViewportEl) return; // Graceful if markup absent

        // Interaction: click to center
        this.minimapEl.addEventListener('mousedown', (e) => {
            // If clicking on viewport -> start drag; else recentre immediately
            if (e.target === this.minimapViewportEl) {
                this.isDraggingMinimapViewport = true;
                this.minimapDragOffset = {
                    x: e.offsetX - this.minimapViewportEl.offsetLeft,
                    y: e.offsetY - this.minimapViewportEl.offsetTop
                };
                e.preventDefault();
            } else {
                this.minimapJumpToEvent(e);
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDraggingMinimapViewport) return;
            const rect = this.minimapEl.getBoundingClientRect();
            const x = e.clientX - rect.left - this.minimapDragOffset.x + this.minimapViewportEl.clientWidth / 2;
            const y = e.clientY - rect.top - this.minimapDragOffset.y + this.minimapViewportEl.clientHeight / 2;
            this.minimapCenterTo(x, y);
        });

        document.addEventListener('mouseup', () => {
            this.isDraggingMinimapViewport = false;
        });

        // Initial draw
        this.updateMinimap();
    }

    minimapJumpToEvent(e) {
        if (!this.minimapEl) return;
        const rect = this.minimapEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.minimapCenterTo(x, y);
    }

    minimapCenterTo(minimapX, minimapY) {
        const canvas = document.getElementById('canvas');
        const workspace = document.getElementById('workspace');
        if (!canvas || !workspace) return;
        const canvasWidth = canvas.offsetWidth;
        const canvasHeight = canvas.offsetHeight;
        const scaleX = this.minimapEl.clientWidth / canvasWidth;
        const scaleY = this.minimapEl.clientHeight / canvasHeight;
        // Clamp to minimap bounds
        minimapX = Math.max(0, Math.min(minimapX, this.minimapEl.clientWidth));
        minimapY = Math.max(0, Math.min(minimapY, this.minimapEl.clientHeight));
        const worldX = minimapX / scaleX;
        const worldY = minimapY / scaleY;
        const viewScale = this.workspaceTransform.scale;
        // Center viewport on chosen world point
        let tx = workspace.clientWidth / 2 - worldX * viewScale;
        let ty = workspace.clientHeight / 2 - worldY * viewScale;
        // Clamp translation to canvas bounds so blank space is never exposed
        const minTranslateX = Math.min(0, workspace.clientWidth - canvasWidth * viewScale);
        const maxTranslateX = 0;
        const minTranslateY = Math.min(0, workspace.clientHeight - canvasHeight * viewScale);
        const maxTranslateY = 0;
        if (tx < minTranslateX) tx = minTranslateX;
        if (tx > maxTranslateX) tx = maxTranslateX;
        if (ty < minTranslateY) ty = minTranslateY;
        if (ty > maxTranslateY) ty = maxTranslateY;
        this.workspaceTransform.translateX = tx;
        this.workspaceTransform.translateY = ty;
        this.updateWorkspaceTransform();
    }

    updateMinimap() {
        if (!this.minimapEl || !this.minimapViewportEl) return;
        const canvas = document.getElementById('canvas');
        const workspace = document.getElementById('workspace');
        if (!canvas || !workspace) return;

        const canvasWidth = canvas.offsetWidth;
        const canvasHeight = canvas.offsetHeight;
        const scaleX = this.minimapEl.clientWidth / canvasWidth;
        const scaleY = this.minimapEl.clientHeight / canvasHeight;

        // Map existing widgets
        const existing = new Set();
        for (const widget of this.widgetManager.widgets.values()) {
            existing.add(widget.id);
            let item = this.minimapEl.querySelector(`.minimap-item[data-id="${widget.id}"]`);
            if (!item) {
                item = document.createElement('div');
                item.className = 'minimap-item';
                item.dataset.id = widget.id;
                this.minimapEl.appendChild(item);
            }
            item.style.left = (widget.x * scaleX) + 'px';
            item.style.top = (widget.y * scaleY) + 'px';
            item.style.width = Math.max(2, widget.width * scaleX) + 'px';
            item.style.height = Math.max(2, widget.height * scaleY) + 'px';
        }

        // Remove stale items
        this.minimapEl.querySelectorAll('.minimap-item').forEach(el => {
            if (!existing.has(el.dataset.id)) el.remove();
        });

        // Update viewport rectangle (visible region)
        const t = this.workspaceTransform || { translateX:0, translateY:0, scale:1 };
        const viewMinX = -t.translateX / t.scale;
        const viewMinY = -t.translateY / t.scale;
        const viewWidth = workspace.clientWidth / t.scale;
        const viewHeight = workspace.clientHeight / t.scale;
        const maxViewportLeft = canvasWidth - viewWidth;
        const maxViewportTop = canvasHeight - viewHeight;
        const clampedMinX = Math.max(0, Math.min(viewMinX, maxViewportLeft));
        const clampedMinY = Math.max(0, Math.min(viewMinY, maxViewportTop));
        this.minimapViewportEl.style.left = (clampedMinX * scaleX) + 'px';
        this.minimapViewportEl.style.top = (clampedMinY * scaleY) + 'px';
        this.minimapViewportEl.style.width = Math.max(8, Math.min(viewWidth, canvasWidth) * scaleX) + 'px';
        this.minimapViewportEl.style.height = Math.max(8, Math.min(viewHeight, canvasHeight) * scaleY) + 'px';
    }
}

// Widget Manager class
class WidgetManager {
    constructor() {
        this.widgets = new Map();
    }

    addWidget(widget) {
        this.widgets.set(widget.id, widget);
        if (window.app) {
            widget.enableCascadeDrag = !!window.app.cascadeDragEnabled;
        }
        // Update empty canvas text visibility
        if (window.app) {
            window.app.updateEmptyCanvasText();
            window.app.updateMinimap && window.app.updateMinimap();
        }
    }

    removeWidget(widgetId) {
        const widget = this.widgets.get(widgetId);
        if (widget) {
            // Remove all connections
            for (const nodeId of widget.nodes.keys()) {
                window.nodeSystem.removeNodeConnections(nodeId);
            }
            this.widgets.delete(widgetId);
            
            // Update empty canvas text visibility
            if (window.app) {
                window.app.updateEmptyCanvasText();
                window.app.updateMinimap && window.app.updateMinimap();
            }
        }
    }

    getWidget(widgetId) {
        return this.widgets.get(widgetId);
    }

    deselectAll() {
        for (const widget of this.widgets.values()) {
            widget.deselect();
        }
    }

    deleteSelected() {
        const selected = Array.from(this.widgets.values()).filter(w => w.selected);
        for (const widget of selected) {
            widget.close();
        }
    }

    clearAll() {
        for (const widget of this.widgets.values()) {
            widget.element.remove();
        }
        this.widgets.clear();
        window.nodeSystem.clearAllConnections();
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FVTacticalApp();
});