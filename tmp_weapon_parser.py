import json
import os
import re


def split_line(line: str) -> list[str]:
    """Split a row into columns while preserving empty cells."""
    if '\t' in line:
        parts = line.rstrip('\n').split('\t')
    else:
        parts = re.split(r'\s{2,}', line.strip())
    return [p.strip() for p in parts]


def parse_numeric(value: str | None):
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    if value.upper() == 'N/A':
        return 'N/A'
    try:
        if '.' in value:
            return float(value)
        return int(value)
    except ValueError:
        try:
            return int(value)
        except ValueError:
            try:
                return float(value)
            except ValueError:
                return value


def parse_notes(notes_str: str) -> list[dict]:
    if not notes_str:
        return []
    parts = [p.strip() for p in notes_str.split(',') if p.strip()]
    parsed = []
    for part in parts:
        match = re.match(r'^([^()]+)\(([^()]+)\)$', part)
        if match:
            name = match.group(1).strip()
            raw_value = match.group(2).strip()
            value = parse_numeric(raw_value)
            parsed.append({"name": name, "value": value})
        else:
            parsed.append({"name": part})
    return parsed


def slugify(name: str) -> str:
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    slug = re.sub(r'-{2,}', '-', slug)
    return slug or 'weapon'


raw_data = """Cannon3		5					
Light Autocannon	-2	1	-4	1						Projectile, Swarm(3)	UHP	
Autocannon	-2	1	-4	1						Projectile, Swarm(12)	SHP	14
Boosted Cannon	3	5	2	5	1	5				Projectile, Durable(3), Volume(2)	PHP	10
PD Gun Pack	+1	1							Antimissile, One-shot, Swarm(15)	UHP	20
PD Chaingun	5	1							Antimissile, Strafe	hHP	1
LASER											0
Light Chemical LASER	6	3							Strafe, Beam, One-shot	UHP	4
Heavy Chemical LASER	5	5	4	3					Strafe, Beam, One-shot	SHP	9
PD Fission LASER	7	2							Antimissile, Strafe, Beam, One-shot	UHP	3
Light Atomic LASER	7	3	3	1						SHP	6
Heavy Atomic LASER	6	4	4	3					Strafe	PHP	9
PD Chemical LASER	7	1							Antimissile	UHP	2
Light Optical Aperture	7	4	4	2					Energy(2), Repeat(2)	UHP	10
Heavy Optical Aperture	6	5	5	4					Energy(3), Repeat(1)	SHP	13
PD Optical Aperture	8	1							Energy(1), Antimissile, Repeat(3)	UHP	3
Light Multiplex Aperture	7	4	6	3					Energy(5), Multiuse(2), Strafe, Beam	UHP	15
Heavy Multiplex Aperture	6	5	5	4	3	2			Energy(5), Repeat(2), Strafe, Beam	SHP	17
PD Multiplex Aperture	8	2							Energy(2), Antimissile, Repeat(3), Strafe	UHP	5
Light Array Aperture	+3	3	+1	2					Energy(10), Salvo(2), Swarm(5), See Description	SHP	29
Heavy Array Aperture	+2	4	+0	3	-2	3	-6	2		Energy(10), Salvo(2), Swarm(5), See Description	PHP	50
PD Array Aperture	+3	1							Energy(4), Antimissile, Multiuse(3), Swarm(5)	UHP	10
Light Beam Aperture	8	6	6	3	3	2			Energy(10), Multiuse(3), Blast, Beam	SHP	26
Heavy Beam Aperture	7	8	5	6	4	3	2	2	1	2	Energy(10), Multiuse(2), Blast, Beam	PHP	35
PD Beam Aperture	9	2							Energy(5), Antimissile, Multiuse(3), Blast, Beam	UHP	7
MASER Generator 01	0	0	0	-1	0	-1	-1	-2	-1	-2	Modifies, See Description	MHP	200
MASER Generator 02												MHP	220
MASER Generator 03												MHP	240
MASER Generator 04												MHP	260
MASER Generator 05												MHP	280
UVASER Generator 01	0	1	0	0	0	0	0	-1	-1	-1	Modifies, See Description	MHP	300
UVASER Generator 02												MHP	330
UVASER Generator 03												MHP	360
UVASER Generator 04												MHP	390
UVASER Generator 05												MHP	420
FEL Generator 01	1	2	1	1	0	1	0	0	0	-1	Modifies, See Description	MHP	350
FEL Generator 02												MHP	385
FEL Generator 03												MHP	420
FEL Generator 04												MHP	455
FEL Generator 05												MHP	490
HASER Generator 01	2	4	1	2	1	1	0	1	0	0	See Description '+1 Hit Success, garuntees 1 hit even on misses. Cascade	MHP	600
HASER Generator 02												MHP	660
HASER Generator 03												MHP	720
HASER Generator 04												MHP	780
HASER Generator 05												MHP	840
Light Optical MASER	7	4	4	1					Energy(2), Repeat(2)		9
Heavy Optical MASER	6	5	5	3					Energy(3), Repeat(1)		12
PD Optical MASER	8	1							Energy(1), Antimissile, Repeat(3)		3
Light Multiplex MASER	7	4	6	2					Energy(5), Multiuse(2), Strafe, Beam		13
Heavy Multiplex MASER	6	5	5	3	3	1			Energy(5), Repeat(2), Strafe, Beam		14
PD Multiplex MASER	8	2							Energy(2), Antimissile, Repeat(3), Strafe		5
Light Array MASER	3	3	1	1					Energy(10), Salvo(2), Swarm(5), See Description		3
Heavy Array MASER	2	4	0	2	-3	1			Energy(10), Salvo(2), Swarm(5), See Description		34
PD Array MASER	3	1							Energy(4), Antimissile, Multiuse(3), Swarm(5)		2
Light Beam MASER	8	6	6	2	3	1			Energy(10), Multiuse(3), Blast, Beam		21
Heavy Beam MASER	7	8	5	5	4	2	1	0	0	0	Energy(10), Multiuse(2), Blast, Beam		26
PD Beam MASER	9	2							Energy(5), Antimissile, Multiuse(3), Blast, Beam		7
Light Optical UVASER	7	5	4	2					Energy(2), Repeat(2)		12
Heavy Optical UVASER	6	6	5	4					Energy(3), Repeat(1)		14
PD Optical UVASER	8	2							Energy(1), Antimissile, Repeat(3)		5
Light Multiplex UVASER	7	5	6	3					Energy(5), Multiuse(2), Strafe, Beam		17
Heavy Multiplex UVASER	6	6	5	4	3	2			Energy(5), Repeat(2), Strafe, Beam		18
PD Multiplex UVASER	8	3							Energy(2), Antimissile, Repeat(3), Strafe		7
Light Array UVASER	3	4	1	2					Energy(10), Salvo(2), Swarm(5), See Description		4
Heavy Array UVASER	2	5	0	3	-2	2			Energy(10), Salvo(2), Swarm(5), See Description		50
PD Array UVASER	3	2							Energy(4), Antimissile, Multiuse(3), Swarm(5)		3
Light Beam UVASER	8	7	6	3	3	2			Energy(10), Multiuse(3), Blast, Beam		28
Heavy Beam UVASER	7	9	5	6	4	3	2	1	0	1	Energy(10), Multiuse(2), Blast, Beam		33
PD Beam UVASER	9	3							Energy(5), Antimissile, Repeat(3), Blast, Beam		10
Light Optical FEL	8	6	5	3					Energy(2), Repeat(2)		18
Heavy Optical FEL	7	7	6	5					Energy(3), Repeat(1)		20
PD Optical FEL	9	3							Energy(1), Antimissile, Repeat(3)		8
Light Multiplex FEL	8	6	7	4					Energy(5), Multiuse(2), Strafe, Beam		25
Heavy Multiplex FEL	7	7	6	5	3	3			Energy(5), Repeat(2), Strafe, Beam		26
PD Multiplex FEL	9	4							Energy(2), Antimissile, Repeat(3), Strafe		11
Light Array FEL	4	5	2	3					Energy(10), Salvo(2), Swarm(5), See Description		7
Heavy Array FEL	3	6	1	4	-1	3			Energy(10), Salvo(2), Swarm(5), See Description		76
PD Array FEL	4	3							Energy(4), Antimissile, Multiuse(3), Swarm(5)		6
Light Beam FEL	9	8	7	4	3	3			Energy(10), Multiuse(3), Blast, Beam		39
Heavy Beam FEL	8	10	6	7	4	4	2	2	1	1	Energy(10), Multiuse(2), Blast, Beam		45
PD Beam FEL	10	4							Energy(5), Antimissile, Multiuse(3), Blast, Beam		14
Light Optical HASER	9	8	5	4					Energy(2), Repeat(2)		26
Heavy Optical HASER	8	9	6	6					Energy(3), Repeat(1)		27
PD Optical HASER	10	5							Energy(1), Antimissile, Repeat(3)		15
Light Multiplex HASER	9	8	7	5					Energy(5), Multiuse(2), Strafe, Beam		34
Heavy Multiplex HASER	8	9	6	6	4	3			Energy(5), Repeat(2), Strafe, Beam		35
PD Multiplex HASER	10	6							Energy(2), Antimissile, Repeat(3), Strafe		18
Light Array HASER	5	7	2	4					Energy(10), Salvo(2), Swarm(5), See Description		12
Heavy Array HASER	4	8	1	5	-1	4			Energy(10), Salvo(2), Swarm(5), See Description		104
PD Array HASER	5	5							Energy(4), Antimissile, Multiuse(3), Swarm(5)		11
Light Beam HASER	10	10	7	5	4	3			Energy(10), Multiuse(3), Blast, Beam		52
Heavy Beam HASER	9	12	6	8	5	4	2	3	1	2	Energy(10), Multiuse(2), Blast, Beam		58
PD Beam HASER	11	6							Energy(5), Antimissile, Multiuse(3), Blast, Beam		23
LASER/Kinetic											0
Light XRASER	8	8	5	5	4	4			Charge to Strafe, Beam	SHP	14
Heavy XRASER	7	9	6	5	5	4	4	3		Charge to Strafe, Beam	PHP	19
Advanced XRASER	8	12	7	7	6	5	5	4	3	1	Strafe, Beam	MHP	62
Light GRASER	8	10	7	6	5	4	4	3		Charge to Blast, Beam	SHP	23
Heavy GRASER	7	12	7	7	6	5	5	4	3	1	Charge to Blast, Beam	PHP	30
Advanced GRASER	8	14	8	9	7	6	5	5	4	2	Blast, Beam	MHP	85
PULSAR Cannon									black hole guns, perpetual drifting aoe black holes	MH2	0
BLITZAR Cannon									See Description	MH4	0
QUASAR Cannon									See Description	MH6	0
Kinetic											0
Light Chemrail	6	2	5	2					Projectile, Charge to Strafe	UHP	3
Heavy Chemrail	7	3	6	3	4	3			Projectile, Charge to Strafe	SHP	8
Versatile Chemrail	7	4	6	4	4	4			Charge(1), Projectile, Volume(2), See Description	PHP	10
PD Chemrail	6	1							Antimissile, Projectile, Strafe	hHP	2
Light Railgun	6	3	5	3	4	3	3	4		Hybrid, Strafe	UHP	14
Heavy Railgun	7	4	6	4	5	4	3	4		Hybrid, Strafe, Durable(1)	SHP	30
Fissile Railgun	7	4	7	4	6	4	4	4		Hybrid, Blast, Durable(2), Reinforced?	PHP	38
PD Railgun	8	2							Antimissile, Hybrid, Charge to Strafe, Smart	hHP	2
Light Coilgun	5	2	6	2	5	2			Projectile, Steer(1), Strafe	UHP	11
Heavy Coilgun	5	4	6	4	5	4	2	4		Projectile, Steer(1), Charge to Swarm(3)	SHP	16
Versatile Coilgun	5	5	6	5	6	5	5	5		Charge(1), Projectile, Steer(1), Swarm(3), Volume(0.5), See Description	PHP	26
PD Coilgun	7	1	2	1					Antimissile, Projectile, Strafe, Smart	hHP	2
Spinal Coilgun 01	+0	12	+1	12	+0	12	-3	12		Charge(1), Projectile, Steer(1), Swarm(3)	MHP	85
Spinal Coilgun 02	+0	9	+1	9	+0	9	-3	9		Charge(1), Projectile, Steer(1), Repeat(1), Swarm(3)	MHP	94
Spinal Coilgun 03	+0	8	+1	8	+0	8	-3	8		Charge(1), Projectile, Steer(1), Repeat(2), Swarm(3)	MHP	102
Spinal Coilgun 04	+0	7	+1	7	+0	7	-3	7		Charge(1), Projectile, Steer(1), Repeat(3), Swarm(3)	MHP	111
Spinal Coilgun 05	+0	7	+1	7	+0	7	-3	7		Charge(1), Projectile, Steer(1), Repeat(4), Swarm(3)	MHP	119
Light Helical Driver	7	4	6	4	5	4	3	4		Hybrid, Steer(2), Strafe	UHP	35
Heavy Helical Driver	7	5	6	5	5	5	4	5	3	5	Hybrid, Steer(3), Strafe	SHP	72
Nuclear Helical Driver	7	6	7	6	6	6	5	6	4	6	Hybrid, Steer(3), Blast	PHP	105
PD Helical Driver	8	2	3	2					Antimissile, Hybrid, Strafe, Smart	hHP	5
Spinal Helical Driver 01	8	6	7	6	7	6	6	6	5	6	Hybrid, Steer(3), Blast	MHP	122
Spinal Helical Driver 02	8	6	7	6	7	6	6	6	5	6	Hybrid, Steer(3), Repeat(1), Blast	MHP	134
Spinal Helical Driver 03	8	6	7	6	7	6	6	6	5	6	Hybrid, Steer(3), Repeat(2), Blast	MHP	146
Spinal Helical Driver 04	8	6	7	6	7	6	6	6	5	6	Hybrid, Steer(3), Repeat(3), Blast	MHP	159
Spinal Helical Driver 05	8	6	7	6	7	6	6	6	5	6	Hybrid, Steer(3), Repeat(4), Blast	MHP	171
Light Macron Gun	+1	4	+0	4	-2	4			Charge(1), Hybrid, Safe, Swarm(5)	SHP	30
Heavy Macron Gun	+1	6	+0	6	-2	6			Charge(1), Hybrid, Safe, Swarm(8)	PHP	80
Spinal Thermonuclear Torch 01	+2	3	+1	3	-3	3			Charge(1), Hybrid, Safe, Terminal, Swarm(15)	MHP	102
Spinal Thermonuclear Torch 02	+2	3	+1	3	-3	3			Charge(2), Hybrid, Safe, Terminal, Repeat(1), Swarm(15)	MHP	112
Spinal Thermonuclear Torch 03	+2	3	+1	3	-3	3			Charge(3), Hybrid, Safe, Terminal, Repeat(2), Swarm(15)	MHP	122
Spinal Thermonuclear Torch 04	+2	3	+1	3	-3	3			Charge(4), Hybrid, Safe, Terminal, Repeat(3), Swarm(15)	MHP	133
Spinal Thermonuclear Torch 05	+2	3	+1	3	-3	3			Charge(5), Hybrid, Safe, Terminal, Repeat(4), Swarm(15)	MHP	143
Disruptor	8	10	7	10	5	10	3	10		Hybrid, Safe, Strafe, Beam, Fragile	PHP	76
Light Field Effect Driver	5	2	6	3	6	5	5	5	4	5	Projectile, Strafe	SHP	55
Heavy Field Effect Driver	5	3	6	4	7	7	6	7	5	7	Projectile, Durable(2), Strafe, Volume(2)	PHP	101
Spinal Wave Motion Cannon 01	-1	3	+0	5	+1	10	+1	15	+1	22	Charge(1), Projectile, Swarm(3), See Description	MHP	284
Spinal Wave Motion Cannon 02	+0	3	+0	5	+1	10	+1	16	+1	23	Charge(2), Projectile, Swarm(4), Charge hyperdrive to use	MHP	312
Spinal Wave Motion Cannon 03	+0	3	+1	6	+1	11	+1	17	+1	24	Charge(3), Projectile, Swarm(4)	MHP	341
Spinal Wave Motion Cannon 04	+0	4	+1	6	+2	11	+2	18	+2	25	Charge(4), Projectile, Swarm(5)	MHP	369
Spinal Wave Motion Cannon 05	+0	4	+1	7	+2	12	+2	19	+2	26	Charge(5), Projectile, Swarm(5)	MHP	398
Light Vortex Cannon	N/A	8d6	N/A	6-4d6	N/A	2d6			Charge(6), Area, Fragile, See Description	MH2	0
Medium Vortex Cannon	N/A	10d6	N/A	8-6d6	N/A	4-2d6			Charge(8), Area, Fragile, See Description	MH4	0
Heavy Vortex Cannon	N/A	12d6	N/A	10-8d6	N/A	6-2d6			Charge(10), Area, Fragile, See Description	MH6	0
Kintetic/Particle											0
Light Plasma Cannon	5	4	6	4	5	4			Projectile, Steer(1), Durable(3), Repeat(2), Charge to Blast	SHP	17
Heavy Plasma Cannon	5	5	6	5	5	5	4	4		Projectile, Steer(2), Durable(4), Repeat(2), Charge to Blast	PHP	34
Spinal Plasma Cannon 01	5	6	6	6	6	6	5	5	3	5	Charge(1), Projectile, Steer(2), Durable(6), Blast	MHP	51
Spinal Plasma Cannon 02	5	6	6	6	6	6	5	5	3	5	Charge(1), Projectile, Steer(2), Durable(6), Repeat(2), Blast	MHP	56
Spinal Plasma Cannon 03	5	6	6	6	6	6	5	5	3	5	Charge(1), Projectile, Steer(2), Durable(6), Repeat(3), Blast	MHP	61
Spinal Plasma Cannon 04	5	6	6	6	6	6	5	5	3	5	Charge(1), Projectile, Steer(2), Durable(6), Repeat(4), Blast	MHP	66
Spinal Plasma Cannon 05	5	6	6	6	6	6	5	5	3	5	Charge(1), Projectile, Steer(2), Durable(6), Repeat(5), Blast	MHP	71
Magnetic Ring	5	8	7	7	6	7	5	6	4	5	Projectile, Seek, Durable(5), Salvo(3), Blast	MH2	153
PD Magnetic Ring	6	3	6	2					Antimissile, Projectile, Seek, Durable(2), Salvo(2), Smart	UHP	11
Spinal Corona Cannon 01	+2	5	+2	5	+1	5	+0	4	-1	4	Charge(1), Seek, Blast, Swarm(10), Fragile	MHP	553
Spinal Corona Cannon 02	+2	5	+2	5	+1	5	+0	4	-1	4	Charge(2), Seek, Salvo(2), Blast, Swarm(10), Fragile	MHP	608
Spinal Corona Cannon 03	+2	6	+2	6	+1	6	+0	5	-1	5	Charge(3), Seek, Salvo(3), Blast, Swarm(10), Fragile	MHP	664
Spinal Corona Cannon 04	+2	6	+2	6	+1	6	+0	5	-1	5	Charge(4), Seek, Salvo(4), Blast, Swarm(10), Fragile	MHP	719
Spinal Corona Cannon 05	+2	7	+2	7	+1	7	+0	6	-1	6	Charge(5), Seek, Salvo(5), Blast, Swarm(10), Fragile	MHP	774
Particle											0
Electron Gun	5	3	4	2						UHP	6
Electron Repeater	5	3	4	2					Strafe	SHP	6
TORAC	6	4	6	3	5	2			Charge to Strafe	SHP	8
PD TORAC	7	2							Antimissile, Strafe	UHP	3
LINAC	6	5	5	5	4	4	3	2		Charge, Hybrid, Strafe, Safe	PHP	12
Neutron Beam	7	8	5	6	2	3			Blast, Beam, Cascade, One-shot, Overload	SHP	23
H TORAC	7	3	7	3	6	2	6	2		Charge, Strafe, Beam, Cascade, Overload	PHP	12
TUR LINAC	7	6	6	6	5	5	4	5	3	5	Charge, Projectile, Blast, Safe	MHP	29
PD TUR LINAC	6	3							Blast, Antimissile, Terminal	SHP	4
Pulse Accelerator	6	14	6	12	5	10	5	7	4	5	Charge(1), Hybrid, Safe, Cascade	PHP	51
Muon Gun	8	8	7	7	7	6	6	6		Charge(2), Strafe, Beam, Cascade, Overload	MHP	34
Spinal Hadron Cannon 01	7	10	6	10	5	9	4	8		Charge(1), Hybrid, Safe, Salvo(1), Blast	MHP	41
Spinal Hadron Cannon 02	7	10	6	10	5	9	4	8		Charge(2), Hybrid, Safe, Salvo(2), Blast	MHP	45
Spinal Hadron Cannon 03	7	10	6	10	5	9	4	8		Charge(3), Hybrid, Safe, Salvo(3), Blast	MHP	49
Spinal Hadron Cannon 04	7	10	6	10	5	9	4	8		Charge(4), Hybrid, Safe, Salvo(4), Blast	MHP	53
Spinal Hadron Cannon 05	7	10	6	10	5	9	4	8		Charge(5), Hybrid, Safe, Salvo(5), Blast	MHP	57
Graviton Cannon	6	4	5	3					See Description	PHP	10
PD Graviton Cannon	6	1							See Description	SHP	2
Spinal Graviton Projector 01	7	6	6	5	5	4	4	3	3	2	Charge(1), See Description, Steps down Blast/Strafe/None for None/Rotate/Push up to an number of hexes/hexfaces equal to hits - maximum equals charge. Movement is in the direction of attack. displace as if thrusting. Recirculating is a cool word from chips' page for puling, could use	MHP	20
Spinal Graviton Projector 02	7	7	6	6	5	5	4	4	3	3	Charge(2), See Description	MHP	25
Spinal Graviton Projector 03	8	7	7	6	6	5	5	4	4	Charge(3), See Description	MHP	31
Spinal Graviton Projector 04	8	8	7	7	6	6	5	5	4	4	Charge(4), See Description	MHP	37
Spinal Graviton Projector 05	9	8	8	7	7	6	6	5	5	4	Charge(5), See Description	MHP	44
Particle/LASER											0
Particle Collimator	7	6	6	5	6	4	4	2		Energy(3), Steer(1), Strafe, Charge to Strafe, Beam	PHP	17
PD Particle Collimator	8	2	5	1					Energy(2), Antimissile, Charge to Strafe, Beam	UHP	3
REVLAC Collimator	8	6	8	7	7	9	6	12	5	16	Energy(12), Seek, Charge to Blast, Beam	MH2	62
PD REVLAC Collimator	8	1	7	1	5	2			Energy(8), Antimissile, Repeat(1), Charge to Blast, Beam	SHP	4
Particle MASER	7	6	6	4	6	3	3	0		Energy(3), Steer(1), Strafe, Charge to Strafe, Beam		12
PD Particle MASER	8	2	5	0					Energy(2), Antimissile, Charge to Strafe, Beam		2
REVLAC MASER	8	6	8	6	7	8	5	10	4	14	Energy(12), Seek, Charge to Blast, Beam		47
PD REVLAC MASER	8	1	7	0	5	1			Energy(8), Antimissile, Repeat(1), Charge to Blast, Beam		2
Particle UVASER	7	7	6	5	6	4	4	1		Energy(3), Steer(1), Strafe, Charge to Strafe, Beam		16
PD Particle UVASER	8	3	5	1					Energy(2), Antimissile, Charge to Strafe, Beam		4
REVLAC UVASER	8	7	8	7	7	9	6	11	4	15	Energy(12), Seek, Charge to Blast, Beam		54
PD REVLAC UVASER	8	2	7	1	5	2			Energy(8), Antimissile, Repeat(1), Charge to Blast, Beam		5
Particle FEL	8	8	7	6	6	5	4	2		Energy(3), Steer(1), Strafe, Charge to Strafe, Beam		22
PD Particle FEL	9	4	6	2					Energy(2), Antimissile, Charge to Strafe, Beam		6
REVLAC FEL	9	8	9	8	7	10	6	12	5	15	Energy(12), Seek, Charge to Blast, Beam		64
PD REVLAC FEL	9	3	8	2	5	3			Energy(8), Antimissile, Repeat(1), Charge to Blast, Beam		8
Particle HASER	9	10	7	7	7	5	4	3		Energy(3), Steer(1), Strafe, Charge to Strafe, Beam		28
PD Particle HASER	10	6	6	3					Energy(2), Antimissile, Charge to Strafe, Beam		9
REVLAC HASER	10	10	9	9	8	10	6	13	5	16	Energy(12), Seek, Charge to Blast, Beam		72
PD REVLAC HASER	10	5	8	3	6	3			Energy(8), Antimissile, Repeat(1), Charge to Blast, Beam		12
False Vacuum Projector	8	N/A	8	N/A	7	N/A	7	N/A	7	N/A	Energy(20), Hybrid, Steer(1), Safe, Fragile, See Description	MHP	408
Troops											0
Light Weapons	6	1							Antipersonnel	THP	2
Heavy Weapons	7	1							Antipersonnel, Charge to Strafe	THP	1
Anti-Tank Weapons	7	1							Antipersonnel, Projectile, Seek, Strafe, Smart	THP	2
Nuclear Weapons	8	2							Antipersonnel, Projectile, Seek, Salvo(3), Blast, Smart, One-shot	THP	5
Demolition Weapons	5	3							One-shot, See Description	THP	
Coil Weapons	+1	2							Antipersonnel, Projectile, Steer(1), Swarm(3)	THP	11
Particle Weapons	9	2							Antipersonnel, Charge to Blast	THP	2
LASER Weapons	8	1							Antipersonnel, Salvo(2), Strafe	THP	3
Plasma Weapons	8	2							Antipersonnel, Projectile, Seek, Durable(2), Charge to Blast, Smart	THP	2"""

lines = raw_data.strip('\n').split('\n')

result_categories: list[dict] = []
category_lookup: dict[str, dict] = {}
current_category_name: str | None = None
slug_counts: dict[str, int] = {}


def ensure_category(name: str) -> dict:
    entry = category_lookup.get(name)
    if not entry:
        entry = {"name": name, "weapons": []}
        category_lookup[name] = entry
        result_categories.append(entry)
        print('DEBUG added category', name)
    return entry


for line in lines:
    if not line.strip():
        continue
    parts = split_line(line)
    if len(parts) == 0:
        continue

    name = parts[0]
    if name in {'LASER', 'LASER/Kinetic', 'Kinetic', 'Kintetic/Particle', 'Particle', 'Particle/LASER', 'Troops'}:
        print('DEBUG raw parts for', name, ':', parts)
    data_cols = parts[1:]
    if name in {'Cannon', 'Light Autocannon'}:
        print(f'DEBUG {name} data_cols before pad:', data_cols)
    if len(data_cols) > 13:
        data_cols = data_cols[:13]
    if len(data_cols) < 13:
        offset = 13 - len(data_cols)
        data_cols = data_cols + [''] * offset

    parts = [name] + data_cols

    if name in {'LASER'}:
        print('DEBUG LASER data_cols after pad:', data_cols)

    if name in {'Cannon', 'Light Autocannon'}:
        print(f'DEBUG {name} raw parts length:', len(parts), 'parts:', parts)

    if not name or name.lower() == 'weapon':
        continue
    if 'generator' in name.lower():
        continue
    range_cols = parts[1:11]
    notes_col = parts[11]
    hp_col = parts[12]
    cost_col = parts[13]
    has_range_data = any(col.strip() for col in range_cols)
    has_detail = notes_col.strip() or hp_col.strip()

    non_empty_columns = sum(1 for col in parts[1:] if col.strip())
    if name in {'LASER', 'LASER/Kinetic', 'Kinetic', 'Kintetic/Particle', 'Particle', 'Particle/LASER', 'Troops'}:
        print('DEBUG category candidate', name, 'non_empty', non_empty_columns, 'cost_col', repr(cost_col), 'has_detail', has_detail)
    if non_empty_columns <= 1 and cost_col.strip() in {'', '0'} and not has_detail:
        current_category_name = name
        ensure_category(current_category_name)
        continue
    if current_category_name is None:
        current_category_name = 'General'
        ensure_category(current_category_name)

    ranges = []
    for i in range(0, 10, 2):
        acc = parse_numeric(range_cols[i])
        dmg = parse_numeric(range_cols[i + 1])
        ranges.append({"accuracy": acc, "damage": dmg})

    notes = parse_notes(notes_col)
    hardpoint = hp_col or None
    cost = parse_numeric(cost_col)
    if cost == 'N/A':
        cost = None

    base_slug = slugify(name)
    count = slug_counts.get(base_slug, 0)
    slug_counts[base_slug] = count + 1
    weapon_id = base_slug if count == 0 else f"{base_slug}-{count + 1}"

    weapon_entry = {
        "id": weapon_id,
        "name": name,
        "ranges": ranges,
        "notes": notes,
        "hardpoint": hardpoint,
        "cost": cost,
    }

    category_entry = ensure_category(current_category_name)
    category_entry["weapons"].append(weapon_entry)

os.makedirs('data', exist_ok=True)
result = {"categories": result_categories}

os.makedirs('data', exist_ok=True)
with open('data/weapons.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, indent=2)

total_weapons = sum(len(cat['weapons']) for cat in result_categories)
print('Wrote data/weapons.json with', total_weapons, 'weapons across', len(result_categories), 'categories')
print('Category names:', [cat['name'] for cat in result_categories])
first_with_weapons = next((cat for cat in result_categories if cat["weapons"]), None)
if first_with_weapons:
    print('First weapon sample:', first_with_weapons["weapons"][0])
