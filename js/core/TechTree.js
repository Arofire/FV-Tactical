// Technology tree system
class TechTree {
    static techData = {
        // ===== EMPIRE TECHNOLOGIES =====
        
        // Information Technology
        'intelligence-models': {
            name: 'Intelligence Models',
            category: 'Information Technology',
            abbreviation: 'IT0',
            cost: 0,
            prerequisites: [],
            description: 'Basic artificial intelligence and data processing systems'
        },
        'quantum-integration': {
            name: 'Quantum Integration',
            category: 'Information Technology',
            abbreviation: 'IT1',
            cost: 30,
            prerequisites: ['intelligence-models'],
            description: 'Integration of quantum computing with classical systems'
        },
        'living-network': {
            name: 'Living Network',
            category: 'Information Technology',
            abbreviation: 'IT2',
            cost: 60,
            prerequisites: ['quantum-integration'],
            description: 'Self-adapting and evolving network systems'
        },
        'oracle-machines': {
            name: 'Oracle Machines',
            category: 'Information Technology',
            abbreviation: 'IT3',
            cost: 90,
            prerequisites: ['living-network'],
            description: 'Predictive computational systems with near-perfect accuracy'
        },
        'conformal-field-computing': {
            name: 'Conformal Field Computing',
            category: 'Information Technology',
            abbreviation: 'IT4',
            cost: 120,
            prerequisites: ['oracle-machines'],
            description: 'Computing systems based on conformal field theory'
        },
        'relativistic-simulation': {
            name: 'Relativistic Simulation',
            category: 'Information Technology',
            abbreviation: 'IT5',
            cost: 150,
            prerequisites: ['conformal-field-computing'],
            description: 'Simulation systems accounting for relativistic effects'
        },

        // Energy Generation
        'chemomechanical': {
            name: 'Chemomechanical',
            category: 'Energy Generation',
            abbreviation: 'EG0',
            cost: 0,
            prerequisites: [],
            description: 'Basic chemical and mechanical energy generation'
        },
        'fission': {
            name: 'Fission',
            category: 'Energy Generation',
            abbreviation: 'EG1',
            cost: 30,
            prerequisites: ['chemomechanical'],
            description: 'Nuclear fission power generation'
        },
        'fusion': {
            name: 'Fusion',
            category: 'Energy Generation',
            abbreviation: 'EG2',
            cost: 60,
            prerequisites: ['fission'],
            description: 'Controlled nuclear fusion power systems'
        },
        'antimatter': {
            name: 'Antimatter',
            category: 'Energy Generation',
            abbreviation: 'EG3',
            cost: 90,
            prerequisites: ['fusion'],
            description: 'Antimatter containment and power generation'
        },
        'singularity': {
            name: 'Singularity',
            category: 'Energy Generation',
            abbreviation: 'EG4',
            cost: 120,
            prerequisites: ['antimatter'],
            description: 'Controlled singularity power extraction'
        },
        'zero-point-vacuum': {
            name: 'Zero Point Vacuum',
            category: 'Energy Generation',
            abbreviation: 'EG5',
            cost: 150,
            prerequisites: ['singularity'],
            description: 'Zero-point energy harvesting from quantum vacuum'
        },

        // Materials Science
        'automation': {
            name: 'Automation',
            category: 'Materials Science',
            abbreviation: 'MS0',
            cost: 0,
            prerequisites: [],
            description: 'Basic industrial automation and manufacturing'
        },
        'microgravity-engineering': {
            name: 'Microgravity Engineering',
            category: 'Materials Science',
            abbreviation: 'MS1',
            cost: 30,
            prerequisites: ['automation'],
            description: 'Engineering and manufacturing in microgravity environments'
        },
        'atomic-manufacturing': {
            name: 'Atomic Manufacturing',
            category: 'Materials Science',
            abbreviation: 'MS2',
            cost: 60,
            prerequisites: ['microgravity-engineering'],
            description: 'Precision manufacturing at the atomic level'
        },
        'metamaterials': {
            name: 'Metamaterials',
            category: 'Materials Science',
            abbreviation: 'MS3',
            cost: 90,
            prerequisites: ['atomic-manufacturing'],
            description: 'Artificially structured materials with novel properties'
        },
        'chronal-condensates': {
            name: 'Chronal Condensates',
            category: 'Materials Science',
            abbreviation: 'MS4',
            cost: 120,
            prerequisites: ['metamaterials'],
            description: 'Time-affecting material states and condensates'
        },
        'boson-mastery': {
            name: 'Boson Mastery',
            category: 'Materials Science',
            abbreviation: 'MS5',
            cost: 150,
            prerequisites: ['chronal-condensates'],
            description: 'Complete control over bosonic matter states'
        },

        // ===== WEAPON TECHNOLOGIES =====
        
        // Gun Technologies
        'heavy-cannon': {
            name: 'Heavy Cannon',
            category: 'Gun',
            cost: 0,
            prerequisites: [],
            description: 'Heavy kinetic projectile weapons'
        },
        'light-cannon': {
            name: 'Light Cannon',
            category: 'Gun',
            cost: 0,
            prerequisites: [],
            description: 'Light kinetic projectile weapons'
        },
        'nuclear-cannon': {
            name: 'Nuclear Cannon',
            category: 'Gun',
            cost: 0,
            prerequisites: ['heavy-cannon'],
            description: 'Nuclear-enhanced kinetic weapons'
        },
        'pd-gun-pack': {
            name: 'PD Gun Pack',
            category: 'Gun',
            cost: 0,
            prerequisites: [],
            description: 'Point defense gun systems'
        },
        'pd-chaingun': {
            name: 'PD Chaingun',
            category: 'Gun',
            cost: 0,
            prerequisites: [],
            description: 'Rapid-fire point defense systems'
        },
        'troop-light-weapons': {
            name: 'Troop Light Weapons',
            category: 'Gun',
            cost: 0,
            prerequisites: [],
            description: 'Personal light weapons for troops'
        },
        'troop-heavy-weapons': {
            name: 'Troop Heavy Weapons',
            category: 'Gun',
            cost: 0,
            prerequisites: [],
            description: 'Heavy weapons for infantry units'
        },
        'troop-anti-tank-weapons': {
            name: 'Troop Anti-Tank Weapons',
            category: 'Gun',
            cost: 0,
            prerequisites: [],
            description: 'Anti-armor weapons for ground forces'
        },
        'troop-nuclear-weapons': {
            name: 'Troop Nuclear Weapons',
            category: 'Gun',
            cost: 0,
            prerequisites: [],
            description: 'Tactical nuclear weapons for troops'
        },

        // Kinetic Weapons - Chemrail
        'heavy-chemrail': {
            name: 'Heavy Chemrail',
            category: 'Kinetic - Chemrail',
            cost: 0,
            prerequisites: ['nuclear-cannon'],
            description: 'Heavy chemical-assisted railgun systems'
        },
        'nuclear-chemrail': {
            name: 'Nuclear Chemrail',
            category: 'Kinetic - Chemrail',
            cost: 0,
            prerequisites: ['heavy-chemrail'],
            description: 'Nuclear-enhanced chemrail technology'
        },
        'light-chemrail': {
            name: 'Light Chemrail',
            category: 'Kinetic - Chemrail',
            cost: 0,
            prerequisites: ['nuclear-chemrail'],
            description: 'Light chemical-assisted railgun systems'
        },
        'pd-chemrail': {
            name: 'PD Chemrail',
            category: 'Kinetic - Chemrail',
            cost: 0,
            prerequisites: ['nuclear-chemrail'],
            description: 'Point defense chemrail systems'
        },

        // Kinetic Weapons - Railgun
        'heavy-railgun': {
            name: 'Heavy Railgun',
            category: 'Kinetic - Railgun',
            cost: 0,
            prerequisites: ['nuclear-chemrail'],
            description: 'Heavy electromagnetic railgun systems'
        },
        'medium-railgun': {
            name: 'Medium Railgun',
            category: 'Kinetic - Railgun',
            cost: 0,
            prerequisites: ['heavy-railgun'],
            description: 'Medium electromagnetic railgun systems'
        },
        'light-railgun': {
            name: 'Light Railgun',
            category: 'Kinetic - Railgun',
            cost: 0,
            prerequisites: ['heavy-railgun'],
            description: 'Light electromagnetic railgun systems'
        },
        'pd-railgun': {
            name: 'PD Railgun',
            category: 'Kinetic - Railgun',
            cost: 0,
            prerequisites: ['heavy-railgun'],
            description: 'Point defense railgun systems'
        },

        // Kinetic Weapons - Coilgun
        'heavy-coilgun': {
            name: 'Heavy Coilgun',
            category: 'Kinetic - Coilgun',
            cost: 0,
            prerequisites: ['nuclear-chemrail'],
            description: 'Heavy magnetic coilgun systems'
        },
        'nuclear-coilgun': {
            name: 'Nuclear Coilgun',
            category: 'Kinetic - Coilgun',
            cost: 0,
            prerequisites: ['heavy-coilgun'],
            description: 'Nuclear-enhanced coilgun technology'
        },
        'light-coilgun': {
            name: 'Light Coilgun',
            category: 'Kinetic - Coilgun',
            cost: 0,
            prerequisites: ['nuclear-coilgun'],
            description: 'Light magnetic coilgun systems'
        },
        'pd-coilgun': {
            name: 'PD Coilgun',
            category: 'Kinetic - Coilgun',
            cost: 0,
            prerequisites: ['nuclear-coilgun'],
            description: 'Point defense coilgun systems'
        },
        'spinal-coilgun-01': {
            name: 'Spinal Coilgun-01',
            category: 'Kinetic - Coilgun',
            cost: 0,
            prerequisites: ['nuclear-coilgun'],
            description: 'First generation spinal-mount coilgun'
        },
        'spinal-coilgun-02': {
            name: 'Spinal Coilgun-02',
            category: 'Kinetic - Coilgun',
            cost: 6,
            prerequisites: ['spinal-coilgun-01'],
            description: 'Second generation spinal-mount coilgun'
        },
        'spinal-coilgun-03': {
            name: 'Spinal Coilgun-03',
            category: 'Kinetic - Coilgun',
            cost: 6,
            prerequisites: ['spinal-coilgun-01'],
            description: 'Third generation spinal-mount coilgun'
        },
        'spinal-coilgun-04': {
            name: 'Spinal Coilgun-04',
            category: 'Kinetic - Coilgun',
            cost: 6,
            prerequisites: ['spinal-coilgun-01'],
            description: 'Fourth generation spinal-mount coilgun'
        },
        'spinal-coilgun-05': {
            name: 'Spinal Coilgun-05',
            category: 'Kinetic - Coilgun',
            cost: 6,
            prerequisites: ['spinal-coilgun-01'],
            description: 'Fifth generation spinal-mount coilgun'
        },

        // Miniature Coilgun
        'troop-coilgun': {
            name: 'Troop Coilgun',
            category: 'Kinetic - Miniature Coilgun',
            cost: 0,
            prerequisites: ['nuclear-coilgun'],
            specialRequirement: 'Tier3',
            description: 'Personal coilgun weapons for troops'
        },

        // Kinetic Weapons - Macron Gun
        'heavy-macron-gun': {
            name: 'Heavy Macron Gun',
            category: 'Kinetic - Macron Gun',
            cost: 0,
            prerequisites: ['heavy-railgun'],
            description: 'Heavy particle acceleration weapons'
        },
        'light-macron-gun': {
            name: 'Light Macron Gun',
            category: 'Kinetic - Macron Gun',
            cost: 0,
            prerequisites: ['heavy-macron-gun'],
            description: 'Light particle acceleration weapons'
        },

        // Kinetic Weapons - Helical Driver
        'heavy-helical-driver': {
            name: 'Heavy Helical Driver',
            category: 'Kinetic - Helical Driver',
            cost: 0,
            prerequisites: ['heavy-railgun', 'heavy-coilgun'],
            description: 'Heavy helical magnetic acceleration systems'
        },
        'nuclear-helical-driver': {
            name: 'Nuclear Helical Driver',
            category: 'Kinetic - Helical Driver',
            cost: 0,
            prerequisites: ['heavy-helical-driver'],
            description: 'Nuclear-enhanced helical driver technology'
        },
        'light-helical-driver': {
            name: 'Light Helical Driver',
            category: 'Kinetic - Helical Driver',
            cost: 0,
            prerequisites: ['nuclear-helical-driver'],
            description: 'Light helical magnetic acceleration systems'
        },
        'pd-helical-driver': {
            name: 'PD Helical Driver',
            category: 'Kinetic - Helical Driver',
            cost: 0,
            prerequisites: ['nuclear-helical-driver'],
            description: 'Point defense helical driver systems'
        },
        'spinal-helical-driver-01': {
            name: 'Spinal Helical Driver-01',
            category: 'Kinetic - Helical Driver',
            cost: 0,
            prerequisites: ['nuclear-helical-driver'],
            description: 'First generation spinal-mount helical driver'
        },
        'spinal-helical-driver-02': {
            name: 'Spinal Helical Driver-02',
            category: 'Kinetic - Helical Driver',
            cost: 6,
            prerequisites: ['spinal-helical-driver-01'],
            description: 'Second generation spinal-mount helical driver'
        },
        'spinal-helical-driver-03': {
            name: 'Spinal Helical Driver-03',
            category: 'Kinetic - Helical Driver',
            cost: 6,
            prerequisites: ['spinal-helical-driver-01'],
            description: 'Third generation spinal-mount helical driver'
        },
        'spinal-helical-driver-04': {
            name: 'Spinal Helical Driver-04',
            category: 'Kinetic - Helical Driver',
            cost: 6,
            prerequisites: ['spinal-helical-driver-01'],
            description: 'Fourth generation spinal-mount helical driver'
        },
        'spinal-helical-driver-05': {
            name: 'Spinal Helical Driver-05',
            category: 'Kinetic - Helical Driver',
            cost: 6,
            prerequisites: ['spinal-helical-driver-01'],
            description: 'Fifth generation spinal-mount helical driver'
        },

        // Kinetic Weapons - Thermonuclear Torch
        'spinal-thermonuclear-torch-01': {
            name: 'Spinal Thermonuclear Torch-01',
            category: 'Kinetic - Thermonuclear Torch',
            cost: 0,
            prerequisites: ['heavy-macron-gun'],
            description: 'First generation spinal thermonuclear torch'
        },
        'spinal-thermonuclear-torch-02': {
            name: 'Spinal Thermonuclear Torch-02',
            category: 'Kinetic - Thermonuclear Torch',
            cost: 6,
            prerequisites: ['spinal-thermonuclear-torch-01'],
            description: 'Second generation spinal thermonuclear torch'
        },
        'spinal-thermonuclear-torch-03': {
            name: 'Spinal Thermonuclear Torch-03',
            category: 'Kinetic - Thermonuclear Torch',
            cost: 6,
            prerequisites: ['spinal-thermonuclear-torch-01'],
            description: 'Third generation spinal thermonuclear torch'
        },
        'spinal-thermonuclear-torch-04': {
            name: 'Spinal Thermonuclear Torch-04',
            category: 'Kinetic - Thermonuclear Torch',
            cost: 6,
            prerequisites: ['spinal-thermonuclear-torch-01'],
            description: 'Fourth generation spinal thermonuclear torch'
        },
        'spinal-thermonuclear-torch-05': {
            name: 'Spinal Thermonuclear Torch-05',
            category: 'Kinetic - Thermonuclear Torch',
            cost: 6,
            prerequisites: ['spinal-thermonuclear-torch-01'],
            description: 'Fifth generation spinal thermonuclear torch'
        },
        'thermonuclear-cluster-warhead': {
            name: 'Thermonuclear Cluster Warhead',
            category: 'Kinetic - Thermonuclear Torch',
            cost: 0,
            prerequisites: ['spinal-thermonuclear-torch-01'],
            description: 'Cluster warhead with thermonuclear payloads'
        },

        // Kinetic Weapons - Disruptor
        'disruptor': {
            name: 'Disruptor',
            category: 'Kinetic - Disruptor',
            cost: 0,
            prerequisites: ['heavy-macron-gun'],
            description: 'Matter-disrupting weapon systems'
        },
        'disruptor-warhead': {
            name: 'Disruptor Warhead',
            category: 'Kinetic - Disruptor',
            cost: 0,
            prerequisites: ['disruptor'],
            description: 'Warheads with disruptor technology'
        },

        // Kinetic Weapons - Field Effect Gun (requires ZPE)
        'heavy-field-effect-gun': {
            name: 'Heavy Field Effect Gun',
            category: 'Kinetic - Field Effect Gun',
            cost: 0,
            prerequisites: ['nuclear-helical-driver'],
            specialRequirement: 'zero-point-vacuum',
            description: 'Heavy field-manipulation weapon systems'
        },
        'light-field-effect-gun': {
            name: 'Light Field Effect Gun',
            category: 'Kinetic - Field Effect Gun',
            cost: 0,
            prerequisites: ['heavy-field-effect-gun'],
            description: 'Light field-manipulation weapon systems'
        },

        // Kinetic Weapons - Vortex Cannon (requires ZPE)
        'light-vortex-cannon': {
            name: 'Light Vortex Cannon',
            category: 'Kinetic - Vortex Cannon',
            cost: 0,
            prerequisites: ['heavy-field-effect-gun'],
            specialRequirement: 'zero-point-vacuum',
            description: 'Light vortex generation weapons'
        },
        'medium-vortex-cannon': {
            name: 'Medium Vortex Cannon',
            category: 'Kinetic - Vortex Cannon',
            cost: 0,
            prerequisites: ['light-vortex-cannon'],
            description: 'Medium vortex generation weapons'
        },
        'heavy-vortex-cannon': {
            name: 'Heavy Vortex Cannon',
            category: 'Kinetic - Vortex Cannon',
            cost: 0,
            prerequisites: ['medium-vortex-cannon'],
            description: 'Heavy vortex generation weapons'
        },
        'vortex-warhead': {
            name: 'Vortex Warhead',
            category: 'Kinetic - Vortex Cannon',
            cost: 0,
            prerequisites: ['heavy-vortex-cannon'],
            description: 'Warheads with vortex generation capability'
        },

        // Kinetic Weapons - Wave-motion Cannon (requires ZPE)
        'spinal-wave-motion-cannon-01': {
            name: 'Spinal Wave-motion Cannon-01',
            category: 'Kinetic - Wave-motion Cannon',
            cost: 0,
            prerequisites: ['heavy-field-effect-gun'],
            specialRequirement: 'zero-point-vacuum',
            description: 'First generation spinal wave-motion cannon'
        },
        'spinal-wave-motion-cannon-02': {
            name: 'Spinal Wave-motion Cannon-02',
            category: 'Kinetic - Wave-motion Cannon',
            cost: 6,
            prerequisites: ['spinal-wave-motion-cannon-01'],
            description: 'Second generation spinal wave-motion cannon'
        },
        'spinal-wave-motion-cannon-03': {
            name: 'Spinal Wave-motion Cannon-03',
            category: 'Kinetic - Wave-motion Cannon',
            cost: 6,
            prerequisites: ['spinal-wave-motion-cannon-01'],
            description: 'Third generation spinal wave-motion cannon'
        },
        'spinal-wave-motion-cannon-04': {
            name: 'Spinal Wave-motion Cannon-04',
            category: 'Kinetic - Wave-motion Cannon',
            cost: 6,
            prerequisites: ['spinal-wave-motion-cannon-01'],
            description: 'Fourth generation spinal wave-motion cannon'
        },
        'spinal-wave-motion-cannon-05': {
            name: 'Spinal Wave-motion Cannon-05',
            category: 'Kinetic - Wave-motion Cannon',
            cost: 6,
            prerequisites: ['spinal-wave-motion-cannon-01'],
            description: 'Fifth generation spinal wave-motion cannon'
        },

        // ===== LASER TECHNOLOGIES =====

        // LASER Ordnance
        'heavy-chemical-laser': {
            name: 'Heavy Chemical LASER',
            category: 'LASER - Ordnance',
            cost: 0,
            prerequisites: ['nuclear-cannon'],
            description: 'Heavy chemical laser weapon systems'
        },
        'light-chemical-laser': {
            name: 'Light Chemical LASER',
            category: 'LASER - Ordnance',
            cost: 0,
            prerequisites: ['heavy-chemical-laser'],
            description: 'Light chemical laser weapon systems'
        },
        'pd-chemical-laser': {
            name: 'PD Chemical LASER',
            category: 'LASER - Ordnance',
            cost: 0,
            prerequisites: ['heavy-chemical-laser'],
            description: 'Point defense chemical laser systems'
        },
        'chemlaser-warhead': {
            name: 'ChemLASER Warhead',
            category: 'LASER - Ordnance',
            cost: 0,
            prerequisites: ['heavy-chemical-laser'],
            description: 'Chemical laser warhead systems'
        },

        // Basic Collimator
        'heavy-optical-aperture': {
            name: 'Heavy Optical Aperture',
            category: 'LASER - Basic Collimator',
            cost: 0,
            prerequisites: ['heavy-chemical-laser'],
            description: 'Heavy optical focusing systems'
        },
        'light-optical-aperture': {
            name: 'Light Optical Aperture',
            category: 'LASER - Basic Collimator',
            cost: 0,
            prerequisites: ['heavy-optical-aperture'],
            description: 'Light optical focusing systems'
        },
        'pd-optical-aperture': {
            name: 'PD Optical Aperture',
            category: 'LASER - Basic Collimator',
            cost: 0,
            prerequisites: ['heavy-optical-aperture'],
            description: 'Point defense optical focusing systems'
        },

        // Multiplex Aperture
        'heavy-multiplex-aperture': {
            name: 'Heavy Multiplex Aperture',
            category: 'LASER - Multiplex Aperture',
            cost: 0,
            prerequisites: ['heavy-optical-aperture'],
            description: 'Heavy multiplexed laser focusing systems'
        },
        'light-multiplex-aperture': {
            name: 'Light Multiplex Aperture',
            category: 'LASER - Multiplex Aperture',
            cost: 0,
            prerequisites: ['heavy-multiplex-aperture'],
            description: 'Light multiplexed laser focusing systems'
        },
        'pd-multiplex-aperture': {
            name: 'PD Multiplex Aperture',
            category: 'LASER - Multiplex Aperture',
            cost: 0,
            prerequisites: ['heavy-multiplex-aperture'],
            description: 'Point defense multiplexed laser focusing systems'
        },

        // Phased Array Aperture
        'heavy-array-aperture': {
            name: 'Heavy Array Aperture',
            category: 'LASER - Phased Array Aperture',
            cost: 0,
            prerequisites: ['heavy-multiplex-aperture'],
            description: 'Heavy phased array laser systems'
        },
        'light-array-aperture': {
            name: 'Light Array Aperture',
            category: 'LASER - Phased Array Aperture',
            cost: 0,
            prerequisites: ['heavy-array-aperture'],
            description: 'Light phased array laser systems'
        },
        'pd-array-aperture': {
            name: 'PD Array Aperture',
            category: 'LASER - Phased Array Aperture',
            cost: 0,
            prerequisites: ['heavy-array-aperture'],
            description: 'Point defense phased array laser systems'
        },

        // Uninterrupted Beam Aperture
        'heavy-ub-aperture': {
            name: 'Heavy UB Aperture',
            category: 'LASER - Uninterrupted Beam Aperture',
            cost: 0,
            prerequisites: ['heavy-array-aperture'],
            description: 'Heavy uninterrupted beam laser systems'
        },
        'light-ub-aperture': {
            name: 'Light UB Aperture',
            category: 'LASER - Uninterrupted Beam Aperture',
            cost: 0,
            prerequisites: ['heavy-ub-aperture'],
            description: 'Light uninterrupted beam laser systems'
        },
        'pd-ub-aperture': {
            name: 'PD UB Aperture',
            category: 'LASER - Uninterrupted Beam Aperture',
            cost: 0,
            prerequisites: ['heavy-ub-aperture'],
            description: 'Point defense uninterrupted beam laser systems'
        },

        // Generator - MASER (requires Fusion)
        'magnetron-maser-generator-01': {
            name: 'Magnetron MASER Generator-01',
            category: 'LASER - Generator',
            abbreviation: 'MASER01',
            cost: 0,
            prerequisites: ['heavy-chemical-laser'],
            specialRequirement: 'fusion',
            description: 'First generation magnetron MASER systems'
        },
        'magnetron-maser-generator-02': {
            name: 'Magnetron MASER Generator-02',
            category: 'LASER - Generator',
            cost: 6,
            prerequisites: ['magnetron-maser-generator-01'],
            description: 'Second generation magnetron MASER systems'
        },
        'magnetron-maser-generator-03': {
            name: 'Magnetron MASER Generator-03',
            category: 'LASER - Generator',
            cost: 6,
            prerequisites: ['magnetron-maser-generator-01'],
            description: 'Third generation magnetron MASER systems'
        },
        'magnetron-maser-generator-04': {
            name: 'Magnetron MASER Generator-04',
            category: 'LASER - Generator',
            cost: 6,
            prerequisites: ['magnetron-maser-generator-01'],
            description: 'Fourth generation magnetron MASER systems'
        },
        'magnetron-maser-generator-05': {
            name: 'Magnetron MASER Generator-05',
            category: 'LASER - Generator',
            cost: 6,
            prerequisites: ['magnetron-maser-generator-01'],
            description: 'Fifth generation magnetron MASER systems'
        },

        // Generator - UVASER (requires Fusion)
        'excimer-uvaser-generator-01': {
            name: 'Excimer UVASER Generator-01',
            category: 'LASER - Generator',
            abbreviation: 'UVASER01',
            cost: 0,
            prerequisites: ['magnetron-maser-generator-01'],
            specialRequirement: 'fusion',
            description: 'First generation excimer UVASER systems'
        },
        'excimer-uvaser-generator-02': {
            name: 'Excimer UVASER Generator-02',
            category: 'LASER - Generator',
            cost: 6,
            prerequisites: ['excimer-uvaser-generator-01'],
            description: 'Second generation excimer UVASER systems'
        },
        'excimer-uvaser-generator-03': {
            name: 'Excimer UVASER Generator-03',
            category: 'LASER - Generator',
            cost: 6,
            prerequisites: ['excimer-uvaser-generator-01'],
            description: 'Third generation excimer UVASER systems'
        },
        'excimer-uvaser-generator-04': {
            name: 'Excimer UVASER Generator-04',
            category: 'LASER - Generator',
            cost: 6,
            prerequisites: ['excimer-uvaser-generator-01'],
            description: 'Fourth generation excimer UVASER systems'
        },
        'excimer-uvaser-generator-05': {
            name: 'Excimer UVASER Generator-05',
            category: 'LASER - Generator',
            cost: 6,
            prerequisites: ['excimer-uvaser-generator-01'],
            description: 'Fifth generation excimer UVASER systems'
        },

        // Generator - FEL (requires Antimatter)
        'fel-generator-01': {
            name: 'FEL Generator-01',
            category: 'LASER - Generator',
            abbreviation: 'FEL01',
            cost: 0,
            prerequisites: ['excimer-uvaser-generator-01'],
            specialRequirement: 'antimatter',
            description: 'First generation free electron laser systems'
        },
        'fel-generator-02': {
            name: 'FEL Generator-02',
            category: 'LASER - Generator',
            cost: 6,
            prerequisites: ['fel-generator-01'],
            description: 'Second generation free electron laser systems'
        },
        'fel-generator-03': {
            name: 'FEL Generator-03',
            category: 'LASER - Generator',
            cost: 6,
            prerequisites: ['fel-generator-01'],
            description: 'Third generation free electron laser systems'
        },
        'fel-generator-04': {
            name: 'FEL Generator-04',
            category: 'LASER - Generator',
            cost: 6,
            prerequisites: ['fel-generator-01'],
            description: 'Fourth generation free electron laser systems'
        },
        'fel-generator-05': {
            name: 'FEL Generator-05',
            category: 'LASER - Generator',
            cost: 6,
            prerequisites: ['fel-generator-01'],
            description: 'Fifth generation free electron laser systems'
        },

        // Generator - HASER (requires ZPE)
        'haser-generator-01': {
            name: 'HASER Generator-01',
            category: 'LASER - Generator',
            abbreviation: 'HASER01',
            cost: 0,
            prerequisites: ['fel-generator-01'],
            specialRequirement: 'zero-point-vacuum',
            description: 'First generation hyperon laser systems'
        },
        'haser-generator-02': {
            name: 'HASER Generator-02',
            category: 'LASER - Generator',
            cost: 6,
            prerequisites: ['haser-generator-01'],
            description: 'Second generation hyperon laser systems'
        },
        'haser-generator-03': {
            name: 'HASER Generator-03',
            category: 'LASER - Generator',
            cost: 6,
            prerequisites: ['haser-generator-01'],
            description: 'Third generation hyperon laser systems'
        },
        'haser-generator-04': {
            name: 'HASER Generator-04',
            category: 'LASER - Generator',
            cost: 6,
            prerequisites: ['haser-generator-01'],
            description: 'Fourth generation hyperon laser systems'
        },
        'haser-generator-05': {
            name: 'HASER Generator-05',
            category: 'LASER - Generator',
            cost: 6,
            prerequisites: ['haser-generator-01'],
            description: 'Fifth generation hyperon laser systems'
        },
        'hyperon-warhead': {
            name: 'Hyperon Warhead',
            category: 'LASER - Generator',
            cost: 0,
            prerequisites: ['haser-generator-01'],
            description: 'Hyperon-based warhead systems'
        },

        // Miniature LASER
        'troop-laser-weapons': {
            name: 'Troop LASER Weapons',
            category: 'LASER - Miniature',
            cost: 0,
            prerequisites: ['heavy-multiplex-aperture'],
            specialRequirement: 'Tier3',
            description: 'Personal laser weapons for troops'
        },

        // ===== PARTICLE TECHNOLOGIES =====

        // Electron Gun
        'electron-gun': {
            name: 'Electron Gun',
            category: 'Particle - Electron Gun',
            cost: 0,
            prerequisites: ['nuclear-cannon'],
            description: 'Basic electron beam weapon systems'
        },
        'electron-repeater': {
            name: 'Electron Repeater',
            category: 'Particle - Electron Gun',
            cost: 0,
            prerequisites: ['electron-gun'],
            description: 'Rapid-fire electron beam systems'
        },

        // Linear Accelerator
        'linac': {
            name: 'LINAC',
            category: 'Particle - Linear Accelerator',
            cost: 0,
            prerequisites: ['electron-gun'],
            description: 'Linear particle acceleration systems'
        },

        // Toroidal Accelerator
        'torac': {
            name: 'TORAC',
            category: 'Particle - Toroidal Accelerator',
            cost: 0,
            prerequisites: ['electron-gun'],
            description: 'Toroidal particle acceleration systems'
        },
        'pd-torac': {
            name: 'PD TORAC',
            category: 'Particle - Toroidal Accelerator',
            cost: 0,
            prerequisites: ['torac'],
            description: 'Point defense toroidal accelerator systems'
        },

        // Neutron Ordnance
        'neutron-beam': {
            name: 'Neutron Beam',
            category: 'Particle - Neutron Ordnance',
            cost: 0,
            prerequisites: ['electron-gun'],
            description: 'Neutron beam weapon systems'
        },
        'neutron-beam-warhead': {
            name: 'Neutron Beam Warhead',
            category: 'Particle - Neutron Ordnance',
            cost: 0,
            prerequisites: ['neutron-beam'],
            description: 'Neutron beam warhead systems'
        },

        // Transuranic Linear Accelerator
        'spinal-tur-linac-01': {
            name: 'Spinal TUR-LINAC-01',
            category: 'Particle - Transuranic Linear Accelerator',
            cost: 0,
            prerequisites: ['linac'],
            description: 'First generation transuranic linear accelerator'
        },
        'spinal-tur-linac-02': {
            name: 'Spinal TUR-LINAC-02',
            category: 'Particle - Transuranic Linear Accelerator',
            cost: 6,
            prerequisites: ['spinal-tur-linac-01'],
            description: 'Second generation transuranic linear accelerator'
        },
        'spinal-tur-linac-03': {
            name: 'Spinal TUR-LINAC-03',
            category: 'Particle - Transuranic Linear Accelerator',
            cost: 6,
            prerequisites: ['spinal-tur-linac-01'],
            description: 'Third generation transuranic linear accelerator'
        },
        'spinal-tur-linac-04': {
            name: 'Spinal TUR-LINAC-04',
            category: 'Particle - Transuranic Linear Accelerator',
            cost: 6,
            prerequisites: ['spinal-tur-linac-01'],
            description: 'Fourth generation transuranic linear accelerator'
        },
        'spinal-tur-linac-05': {
            name: 'Spinal TUR-LINAC-05',
            category: 'Particle - Transuranic Linear Accelerator',
            cost: 6,
            prerequisites: ['spinal-tur-linac-01'],
            description: 'Fifth generation transuranic linear accelerator'
        },

        // Miniature Toroidal Accelerator
        'troop-torac': {
            name: 'Troop TORAC',
            category: 'Particle - Miniature Toroidal Accelerator',
            cost: 0,
            prerequisites: ['torac'],
            specialRequirement: 'Tier3',
            description: 'Personal toroidal accelerator weapons for troops'
        },

        // Hydrogen Toroidal Accelerator
        'h-torac': {
            name: 'H-TORAC',
            category: 'Particle - Hydrogen Toroidal Accelerator',
            cost: 0,
            prerequisites: ['torac'],
            description: 'Hydrogen-optimized toroidal accelerator systems'
        },

        // Muon Projector
        'muon-projector': {
            name: 'Muon Projector',
            category: 'Particle - Muon Projector',
            cost: 0,
            prerequisites: ['h-torac'],
            description: 'Muon particle projection systems'
        },
        'pd-muon-projector': {
            name: 'PD Muon Projector',
            category: 'Particle - Muon Projector',
            cost: 0,
            prerequisites: ['muon-projector'],
            description: 'Point defense muon projection systems'
        },

        // Hadron Cannon
        'hadron-cannon': {
            name: 'Hadron Cannon',
            category: 'Particle - Hadron Cannon',
            cost: 0,
            prerequisites: ['spinal-tur-linac-01'],
            description: 'Hadron particle cannon systems'
        },

        // Graviton Beam
        'spinal-graviton-beam-01': {
            name: 'Spinal Graviton Beam-01',
            category: 'Particle - Graviton Beam',
            cost: 0,
            prerequisites: ['hadron-cannon'],
            description: 'First generation graviton beam systems'
        },
        'spinal-graviton-beam-02': {
            name: 'Spinal Graviton Beam-02',
            category: 'Particle - Graviton Beam',
            cost: 6,
            prerequisites: ['spinal-graviton-beam-01'],
            description: 'Second generation graviton beam systems'
        },
        'spinal-graviton-beam-03': {
            name: 'Spinal Graviton Beam-03',
            category: 'Particle - Graviton Beam',
            cost: 6,
            prerequisites: ['spinal-graviton-beam-01'],
            description: 'Third generation graviton beam systems'
        },
        'spinal-graviton-beam-04': {
            name: 'Spinal Graviton Beam-04',
            category: 'Particle - Graviton Beam',
            cost: 6,
            prerequisites: ['spinal-graviton-beam-01'],
            description: 'Fourth generation graviton beam systems'
        },
        'spinal-graviton-beam-05': {
            name: 'Spinal Graviton Beam-05',
            category: 'Particle - Graviton Beam',
            cost: 6,
            prerequisites: ['spinal-graviton-beam-01'],
            description: 'Fifth generation graviton beam systems'
        },

        // ===== HYBRID TECHNOLOGIES =====

        // LASER/Kinetic - XRASER
        'heavy-photolytic-xraser': {
            name: 'Heavy Photolytic XRASER',
            category: 'LASER/Kinetic - XRASER',
            cost: 0,
            prerequisites: ['heavy-railgun', 'excimer-uvaser-generator-01'],
            description: 'Heavy X-ray laser systems with kinetic enhancement'
        },
        'light-photolytic-xraser': {
            name: 'Light Photolytic XRASER',
            category: 'LASER/Kinetic - XRASER',
            cost: 0,
            prerequisites: ['heavy-photolytic-xraser'],
            description: 'Light X-ray laser systems with kinetic enhancement'
        },

        // Advanced XRASER
        'advanced-photolytic-xraser': {
            name: 'Advanced Photolytic XRASER',
            category: 'LASER/Kinetic - Advanced XRASER',
            cost: 0,
            prerequisites: ['heavy-photolytic-xraser'],
            description: 'Advanced X-ray laser systems'
        },

        // GRASER
        'heavy-z-pinch-graser': {
            name: 'Heavy Z-Pinch GRASER',
            category: 'LASER/Kinetic - GRASER',
            cost: 0,
            prerequisites: ['heavy-photolytic-xraser'],
            description: 'Heavy gamma-ray laser systems'
        },
        'light-z-pinch-graser': {
            name: 'Light Z-Pinch GRASER',
            category: 'LASER/Kinetic - GRASER',
            cost: 0,
            prerequisites: ['heavy-z-pinch-graser'],
            description: 'Light gamma-ray laser systems'
        },

        // Advanced GRASER
        'advanced-z-pinch-graser': {
            name: 'Advanced Z-Pinch GRASER',
            category: 'LASER/Kinetic - Advanced GRASER',
            cost: 0,
            prerequisites: ['heavy-z-pinch-graser'],
            description: 'Advanced gamma-ray laser systems'
        },

        // Star Cannon
        'pulsar-cannon': {
            name: 'PULSAR Cannon',
            category: 'LASER/Kinetic - Star Cannon',
            cost: 0,
            prerequisites: ['heavy-z-pinch-graser'],
            description: 'Pulsar-inspired energy weapon systems'
        },
        'blitzar-cannon': {
            name: 'BLITZAR Cannon',
            category: 'LASER/Kinetic - Star Cannon',
            cost: 0,
            prerequisites: ['pulsar-cannon'],
            description: 'Blitzar-inspired energy weapon systems'
        },
        'quasar-cannon': {
            name: 'QUASAR Cannon',
            category: 'LASER/Kinetic - Star Cannon',
            cost: 0,
            prerequisites: ['blitzar-cannon'],
            description: 'Quasar-inspired energy weapon systems'
        },

        // ===== KINETIC/PARTICLE HYBRIDS =====

        // Plasma Cannon
        'heavy-plasma-cannon': {
            name: 'Heavy Plasma Cannon',
            category: 'Kinetic/Particle - Plasma Cannon',
            cost: 0,
            prerequisites: ['nuclear-coilgun', 'torac'],
            description: 'Heavy plasma acceleration systems'
        },
        'light-plasma-cannon': {
            name: 'Light Plasma Cannon',
            category: 'Kinetic/Particle - Plasma Cannon',
            cost: 0,
            prerequisites: ['heavy-plasma-cannon'],
            description: 'Light plasma acceleration systems'
        },
        'spinal-plasma-cannon-01': {
            name: 'Spinal Plasma Cannon-01',
            category: 'Kinetic/Particle - Plasma Cannon',
            cost: 0,
            prerequisites: ['heavy-plasma-cannon'],
            description: 'First generation spinal plasma cannon'
        },
        'spinal-plasma-cannon-02': {
            name: 'Spinal Plasma Cannon-02',
            category: 'Kinetic/Particle - Plasma Cannon',
            cost: 6,
            prerequisites: ['spinal-plasma-cannon-01'],
            description: 'Second generation spinal plasma cannon'
        },
        'spinal-plasma-cannon-03': {
            name: 'Spinal Plasma Cannon-03',
            category: 'Kinetic/Particle - Plasma Cannon',
            cost: 6,
            prerequisites: ['spinal-plasma-cannon-01'],
            description: 'Third generation spinal plasma cannon'
        },
        'spinal-plasma-cannon-04': {
            name: 'Spinal Plasma Cannon-04',
            category: 'Kinetic/Particle - Plasma Cannon',
            cost: 6,
            prerequisites: ['spinal-plasma-cannon-01'],
            description: 'Fourth generation spinal plasma cannon'
        },
        'spinal-plasma-cannon-05': {
            name: 'Spinal Plasma Cannon-05',
            category: 'Kinetic/Particle - Plasma Cannon',
            cost: 6,
            prerequisites: ['spinal-plasma-cannon-01'],
            description: 'Fifth generation spinal plasma cannon'
        },
        'plasma-bottle-warhead': {
            name: 'Plasma Bottle Warhead',
            category: 'Kinetic/Particle - Plasma Cannon',
            cost: 0,
            prerequisites: ['heavy-plasma-cannon'],
            description: 'Contained plasma warhead systems'
        },

        // Miniature Plasma
        'troop-plasma': {
            name: 'Troop Plasma',
            category: 'Kinetic/Particle - Miniature Plasma',
            cost: 0,
            prerequisites: ['heavy-plasma-cannon'],
            description: 'Personal plasma weapons for troops'
        },

        // Magnetically Accelerated Ring System
        'magnetic-ring': {
            name: 'Magnetic Ring',
            category: 'Kinetic/Particle - MARS',
            cost: 0,
            prerequisites: ['heavy-plasma-cannon'],
            description: 'Magnetically accelerated ring projectile systems'
        },
        'pd-magnetic-ring': {
            name: 'PD Magnetic Ring',
            category: 'Kinetic/Particle - MARS',
            cost: 0,
            prerequisites: ['magnetic-ring'],
            description: 'Point defense magnetic ring systems'
        },
        'spinal-corona-cannon-01': {
            name: 'Spinal Corona Cannon-01',
            category: 'Kinetic/Particle - MARS',
            cost: 0,
            prerequisites: ['magnetic-ring'],
            description: 'First generation spinal corona cannon'
        },
        'spinal-corona-cannon-02': {
            name: 'Spinal Corona Cannon-02',
            category: 'Kinetic/Particle - MARS',
            cost: 6,
            prerequisites: ['spinal-corona-cannon-01'],
            description: 'Second generation spinal corona cannon'
        },
        'spinal-corona-cannon-03': {
            name: 'Spinal Corona Cannon-03',
            category: 'Kinetic/Particle - MARS',
            cost: 6,
            prerequisites: ['spinal-corona-cannon-01'],
            description: 'Third generation spinal corona cannon'
        },
        'spinal-corona-cannon-04': {
            name: 'Spinal Corona Cannon-04',
            category: 'Kinetic/Particle - MARS',
            cost: 6,
            prerequisites: ['spinal-corona-cannon-01'],
            description: 'Fourth generation spinal corona cannon'
        },
        'spinal-corona-cannon-05': {
            name: 'Spinal Corona Cannon-05',
            category: 'Kinetic/Particle - MARS',
            cost: 6,
            prerequisites: ['spinal-corona-cannon-01'],
            description: 'Fifth generation spinal corona cannon'
        },

        // ===== PARTICLE/LASER HYBRIDS =====

        // LASER Coupled Particle Beam
        'laser-coupled-particle-beam': {
            name: 'LASER Coupled Particle Beam',
            category: 'Particle/LASER - Coupled Beam',
            cost: 0,
            prerequisites: ['heavy-multiplex-aperture', 'linac'],
            description: 'LASER-guided particle beam systems'
        },
        'laser-coupled-particle-pd': {
            name: 'LASER Coupled Particle PD',
            category: 'Particle/LASER - Coupled Beam',
            cost: 0,
            prerequisites: ['laser-coupled-particle-beam'],
            description: 'Point defense LASER-coupled particle systems'
        },

        // Relativistic Particle Beam
        'relativistic-particle-beam': {
            name: 'Relativistic Particle Beam',
            category: 'Particle/LASER - Relativistic Beam',
            cost: 0,
            prerequisites: ['laser-coupled-particle-beam'],
            description: 'Relativistic particle acceleration systems'
        },
        'pd-relativistic-particle-beam': {
            name: 'PD Relativistic Particle Beam',
            category: 'Particle/LASER - Relativistic Beam',
            cost: 0,
            prerequisites: ['relativistic-particle-beam'],
            description: 'Point defense relativistic particle systems'
        },

        // False Vacuum Projector
        'spinal-false-vacuum-projector-01': {
            name: 'Spinal False Vacuum Projector-01',
            category: 'Particle/LASER - False Vacuum Projector',
            cost: 0,
            prerequisites: ['relativistic-particle-beam'],
            description: 'First generation false vacuum projection system'
        },
        'spinal-false-vacuum-projector-02': {
            name: 'Spinal False Vacuum Projector-02',
            category: 'Particle/LASER - False Vacuum Projector',
            cost: 6,
            prerequisites: ['spinal-false-vacuum-projector-01'],
            description: 'Second generation false vacuum projection system'
        },
        'spinal-false-vacuum-projector-03': {
            name: 'Spinal False Vacuum Projector-03',
            category: 'Particle/LASER - False Vacuum Projector',
            cost: 6,
            prerequisites: ['spinal-false-vacuum-projector-01'],
            description: 'Third generation false vacuum projection system'
        },
        'spinal-false-vacuum-projector-04': {
            name: 'Spinal False Vacuum Projector-04',
            category: 'Particle/LASER - False Vacuum Projector',
            cost: 6,
            prerequisites: ['spinal-false-vacuum-projector-01'],
            description: 'Fourth generation false vacuum projection system'
        },
        'spinal-false-vacuum-projector-05': {
            name: 'Spinal False Vacuum Projector-05',
            category: 'Particle/LASER - False Vacuum Projector',
            cost: 6,
            prerequisites: ['spinal-false-vacuum-projector-01'],
            description: 'Fifth generation false vacuum projection system'
        }
    };

    static getTech(techId) {
        return this.techData[techId];
    }

    static getAllTech() {
        return new Map(Object.entries(this.techData));
    }

    static getTechsByCategory() {
        const categories = {};
        for (const [techId, tech] of Object.entries(this.techData)) {
            if (!categories[tech.category]) {
                categories[tech.category] = [];
            }
            categories[tech.category].push({ id: techId, ...tech });
        }
        return categories;
    }

    static getTechPrerequisites(techId) {
        const tech = this.getTech(techId);
        return tech ? tech.prerequisites : [];
    }

    static getTechDependents(techId) {
        const dependents = [];
        for (const [id, tech] of Object.entries(this.techData)) {
            if (tech.prerequisites.includes(techId)) {
                dependents.push(id);
            }
        }
        return dependents;
    }

    static validateTechChain(researchedTech) {
        const errors = [];
        const researched = new Set(researchedTech);
        
        for (const techId of researched) {
            const tech = this.getTech(techId);
            if (tech) {
                // Check normal prerequisites
                for (const prereq of tech.prerequisites) {
                    if (!researched.has(prereq)) {
                        errors.push({
                            tech: techId,
                            missingPrereq: prereq,
                            message: `${tech.name} requires ${this.getTech(prereq)?.name || prereq}`
                        });
                    }
                }
                
                // Check special requirements (empire tech requirements)
                if (tech.specialRequirement) {
                    if (!researched.has(tech.specialRequirement)) {
                        const reqTech = this.getTech(tech.specialRequirement);
                        errors.push({
                            tech: techId,
                            missingPrereq: tech.specialRequirement,
                            message: `${tech.name} requires empire technology: ${reqTech?.name || tech.specialRequirement}`
                        });
                    }
                }
            }
        }
        
        return errors;
    }
    
    static getEffectivePrerequisites(techId) {
        const tech = this.getTech(techId);
        if (!tech) return [];
        
        const prerequisites = [...(tech.prerequisites || [])];
        
        // Add special requirements
        if (tech.specialRequirement && tech.specialRequirement !== 'Tier3') {
            prerequisites.push(tech.specialRequirement);
        }
        
        return prerequisites;
    }
    
    static canResearch(techId, researchedTech, empireLevel = 1) {
        const tech = this.getTech(techId);
        if (!tech) return false;
        
        const researched = new Set(researchedTech);
        
        // Check normal prerequisites
        for (const prereq of tech.prerequisites) {
            if (!researched.has(prereq)) {
                return false;
            }
        }
        
        // Check special requirements
        if (tech.specialRequirement) {
            if (tech.specialRequirement === 'Tier3' && empireLevel < 3) {
                return false;
            } else if (tech.specialRequirement !== 'Tier3' && !researched.has(tech.specialRequirement)) {
                return false;
            }
        }
        
        return true;
    }

    static calculateTechCost(techIds) {
        let totalCost = 0;
        for (const techId of techIds) {
            const tech = this.getTech(techId);
            if (tech) {
                totalCost += tech.cost;
            }
        }
        return totalCost;
    }

    static getOptimalResearchPath(targetTech, currentTech = []) {
        const target = this.getTech(targetTech);
        if (!target) return null;

        const researched = new Set(currentTech);
        const path = [];
        const queue = [...target.prerequisites];

        while (queue.length > 0) {
            const techId = queue.shift();
            if (researched.has(techId) || path.includes(techId)) {
                continue;
            }

            const tech = this.getTech(techId);
            if (tech) {
                // Add prerequisites to queue first
                for (const prereq of tech.prerequisites) {
                    if (!researched.has(prereq) && !path.includes(prereq)) {
                        queue.unshift(prereq);
                    }
                }
                
                if (tech.prerequisites.every(p => researched.has(p) || path.includes(p))) {
                    path.push(techId);
                }
            }
        }

        if (!path.includes(targetTech)) {
            path.push(targetTech);
        }

        return path;
    }
}

// Component definitions with tech requirements
class ComponentLibrary {
    static components = {
        // Weapon Components - Gun
        guns: {
            'heavy-cannon': {
                name: 'Heavy Cannon',
                type: 'weapon',
                requiredTech: ['heavy-cannon'],
                mass: 50,
                damage: 100,
                range: 1000,
                cost: 25
            },
            'light-cannon': {
                name: 'Light Cannon',
                type: 'weapon',
                requiredTech: ['light-cannon'],
                mass: 20,
                damage: 40,
                range: 800,
                cost: 15
            },
            'nuclear-cannon': {
                name: 'Nuclear Cannon',
                type: 'weapon',
                requiredTech: ['nuclear-cannon'],
                mass: 60,
                damage: 200,
                range: 1200,
                cost: 50
            }
        },
        
        // Weapon Components - Kinetic
        kinetic: {
            'heavy-railgun': {
                name: 'Heavy Railgun',
                type: 'weapon',
                requiredTech: ['heavy-railgun'],
                mass: 80,
                damage: 150,
                range: 1500,
                powerConsumption: 40,
                cost: 75
            },
            'heavy-coilgun': {
                name: 'Heavy Coilgun',
                type: 'weapon',
                requiredTech: ['heavy-coilgun'],
                mass: 70,
                damage: 120,
                range: 1300,
                powerConsumption: 30,
                cost: 60
            },
            'spinal-coilgun-01': {
                name: 'Spinal Coilgun-01',
                type: 'spinal-weapon',
                requiredTech: ['spinal-coilgun-01'],
                mass: 200,
                damage: 500,
                range: 3000,
                powerConsumption: 150,
                cost: 200
            }
        },
        
        // Weapon Components - LASER
        lasers: {
            'heavy-chemical-laser': {
                name: 'Heavy Chemical LASER',
                type: 'weapon',
                requiredTech: ['heavy-chemical-laser'],
                mass: 40,
                damage: 80,
                range: 2000,
                cost: 45
            },
            'magnetron-maser-generator-01': {
                name: 'Magnetron MASER-01',
                type: 'weapon',
                requiredTech: ['magnetron-maser-generator-01'],
                mass: 60,
                damage: 120,
                range: 2500,
                powerConsumption: 50,
                cost: 80
            },
            'haser-generator-01': {
                name: 'HASER Generator-01',
                type: 'weapon',
                requiredTech: ['haser-generator-01'],
                mass: 100,
                damage: 300,
                range: 4000,
                powerConsumption: 200,
                cost: 300
            }
        },
        
        // Power Generation Components
        reactors: {
            'chemomechanical-reactor': {
                name: 'Chemomechanical Reactor',
                type: 'reactor',
                requiredTech: ['chemomechanical'],
                mass: 30,
                powerOutput: 50,
                cost: 20
            },
            'fission-reactor': {
                name: 'Fission Reactor',
                type: 'reactor',
                requiredTech: ['fission'],
                mass: 60,
                powerOutput: 150,
                cost: 60
            },
            'fusion-reactor': {
                name: 'Fusion Reactor',
                type: 'reactor',
                requiredTech: ['fusion'],
                mass: 80,
                powerOutput: 400,
                cost: 150
            },
            'antimatter-reactor': {
                name: 'Antimatter Reactor',
                type: 'reactor',
                requiredTech: ['antimatter'],
                mass: 100,
                powerOutput: 1200,
                cost: 500
            },
            'zero-point-reactor': {
                name: 'Zero Point Reactor',
                type: 'reactor',
                requiredTech: ['zero-point-vacuum'],
                mass: 120,
                powerOutput: 3000,
                cost: 1500
            }
        },
        
        // Computing Components
        computers: {
            'intelligence-models': {
                name: 'Intelligence Models',
                type: 'computer',
                requiredTech: ['intelligence-models'],
                mass: 5,
                computingPower: 10,
                cost: 15
            },
            'quantum-integration': {
                name: 'Quantum Computer',
                type: 'computer',
                requiredTech: ['quantum-integration'],
                mass: 8,
                computingPower: 50,
                cost: 75
            },
            'oracle-machines': {
                name: 'Oracle Machine',
                type: 'computer',
                requiredTech: ['oracle-machines'],
                mass: 12,
                computingPower: 200,
                cost: 300
            }
        },
        
        // Particle Weapons
        particle: {
            'electron-gun': {
                name: 'Electron Gun',
                type: 'weapon',
                requiredTech: ['electron-gun'],
                mass: 35,
                damage: 60,
                range: 1800,
                powerConsumption: 25,
                cost: 40
            },
            'torac': {
                name: 'TORAC',
                type: 'weapon',
                requiredTech: ['torac'],
                mass: 55,
                damage: 90,
                range: 2200,
                powerConsumption: 45,
                cost: 70
            },
            'spinal-tur-linac-01': {
                name: 'Spinal TUR-LINAC-01',
                type: 'spinal-weapon',
                requiredTech: ['spinal-tur-linac-01'],
                mass: 180,
                damage: 400,
                range: 3500,
                powerConsumption: 120,
                cost: 180
            },
            'hadron-cannon': {
                name: 'Hadron Cannon',
                type: 'weapon',
                requiredTech: ['hadron-cannon'],
                mass: 120,
                damage: 250,
                range: 2800,
                powerConsumption: 80,
                cost: 150
            },
            'spinal-graviton-beam-01': {
                name: 'Spinal Graviton Beam-01',
                type: 'spinal-weapon',
                requiredTech: ['spinal-graviton-beam-01'],
                mass: 300,
                damage: 800,
                range: 5000,
                powerConsumption: 250,
                cost: 400
            }
        },
        
        // Hybrid Weapons
        hybrid: {
            'heavy-photolytic-xraser': {
                name: 'Heavy Photolytic XRASER',
                type: 'weapon',
                requiredTech: ['heavy-photolytic-xraser'],
                mass: 90,
                damage: 180,
                range: 3000,
                powerConsumption: 70,
                cost: 120
            },
            'heavy-z-pinch-graser': {
                name: 'Heavy Z-Pinch GRASER',
                type: 'weapon',
                requiredTech: ['heavy-z-pinch-graser'],
                mass: 110,
                damage: 220,
                range: 3500,
                powerConsumption: 90,
                cost: 160
            },
            'quasar-cannon': {
                name: 'QUASAR Cannon',
                type: 'weapon',
                requiredTech: ['quasar-cannon'],
                mass: 200,
                damage: 500,
                range: 6000,
                powerConsumption: 200,
                cost: 600
            },
            'heavy-plasma-cannon': {
                name: 'Heavy Plasma Cannon',
                type: 'weapon',
                requiredTech: ['heavy-plasma-cannon'],
                mass: 80,
                damage: 160,
                range: 2000,
                powerConsumption: 60,
                cost: 100
            },
            'spinal-plasma-cannon-01': {
                name: 'Spinal Plasma Cannon-01',
                type: 'spinal-weapon',
                requiredTech: ['spinal-plasma-cannon-01'],
                mass: 220,
                damage: 450,
                range: 3200,
                powerConsumption: 140,
                cost: 220
            },
            'relativistic-particle-beam': {
                name: 'Relativistic Particle Beam',
                type: 'weapon',
                requiredTech: ['relativistic-particle-beam'],
                mass: 150,
                damage: 350,
                range: 4000,
                powerConsumption: 120,
                cost: 280
            },
            'spinal-false-vacuum-projector-01': {
                name: 'Spinal False Vacuum Projector-01',
                type: 'spinal-weapon',
                requiredTech: ['spinal-false-vacuum-projector-01'],
                mass: 400,
                damage: 1200,
                range: 8000,
                powerConsumption: 400,
                cost: 1000
            }
        },
        
        // Manufacturing Components
        manufacturing: {
            'automation': {
                name: 'Basic Automation',
                type: 'manufacturing',
                requiredTech: ['automation'],
                mass: 20,
                productionBonus: 0.1,
                cost: 30
            },
            'atomic-manufacturing': {
                name: 'Atomic Manufacturing',
                type: 'manufacturing',
                requiredTech: ['atomic-manufacturing'],
                mass: 40,
                productionBonus: 0.5,
                cost: 150
            },
            'boson-mastery': {
                name: 'Boson Mastery System',
                type: 'manufacturing',
                requiredTech: ['boson-mastery'],
                mass: 60,
                productionBonus: 2.0,
                cost: 750
            }
        }
    };

    static getComponent(category, componentId) {
        return this.components[category]?.[componentId];
    }

    static getComponentsByCategory(category) {
        return this.components[category] || {};
    }

    static getAllComponents() {
        return this.components;
    }

    static getAvailableComponents(category, empire) {
        const components = this.getComponentsByCategory(category);
        const available = {};
        
        for (const [id, component] of Object.entries(components)) {
            const techMet = component.requiredTech.every(tech => empire.hasTech(tech));
            if (techMet) {
                available[id] = component;
            }
        }
        
        return available;
    }
}