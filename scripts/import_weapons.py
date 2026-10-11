#!/usr/bin/env python3
"""Import the published weapon catalogue into the browser's JSON data file."""

import argparse
import csv
import io
import json
import re
import urllib.request
from pathlib import Path


SOURCE_URL = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vQWHExCdUgGcby87ZzTN-FlKwLEjWvg1pNlr6DpSeNo31j4gwvk1Tpty1K7DJ2CgWxMteNzgigWXq-A/"
    "pub?gid=923591294&single=true&output=csv&range=A2:R328"
)
ROOT = Path(__file__).resolve().parents[1]
TECH_TREE_PATH = ROOT / "data" / "tech-tree.json"
OUTPUT_PATH = ROOT / "data" / "weapons.json"
RESOURCE_BY_PREFIX = {
    "H": "hardpoints",
    "U": "utilities",
    "E": "emplacements",
}
TECH_ALIASES = {
    "main beam aperture": "heavy-ub-aperture",
    "main beam maser": "heavy-ub-aperture",
    "main beam uvaser": "heavy-ub-aperture",
    "main beam fel": "heavy-ub-aperture",
    "main beam haser": "heavy-ub-aperture",
    "main xraser": "heavy-photolytic-xraser",
    "main graser": "heavy-z-pinch-graser",
    "main coilgun": "spinal-coilgun-01",
    "main helical driver": "spinal-helical-driver-01",
    "main thermonuclear torch": "spinal-thermonuclear-torch-01",
    "main wave motion cannon": "spinal-wave-motion-cannon-01",
    "main vortex cannon": "heavy-vortex-cannon",
    "main plasma cannon": "spinal-plasma-cannon-01",
    "main tur linac": "spinal-tur-linac-01",
    "main hadron cannon": "hadron-cannon",
    "small tur linac": "linac",
    "small relvac collimator": "relativistic-particle-beam",
    "small relvac maser": "relativistic-particle-beam",
    "small relvac uvaser": "relativistic-particle-beam",
    "small relvac fel": "relativistic-particle-beam",
    "small relvac haser": "relativistic-particle-beam",
}


def normalize(value):
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def slugify(value):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", value.casefold())).strip("-")


def parse_value(value):
    value = value.strip()
    if not value:
        return None
    if value.upper() == "N/A":
        return "N/A"
    try:
        number = float(value)
    except ValueError:
        return value
    return int(number) if number.is_integer() else number


def parse_notes(value):
    notes = []
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        match = re.fullmatch(r"([^()]+)\(([^()]*)\)", part)
        if match:
            notes.append({"name": match.group(1).strip(), "value": parse_value(match.group(2))})
        else:
            notes.append({"name": part})
    return notes


def is_section_header(row):
    hp = row[16].strip()
    tier = row[15].strip()
    cost = row[17].strip()
    no_damage = not any(row[index].strip() for index in (2, 4, 6, 8, 10))
    return not hp and not tier and cost in ("", "0") and no_damage


def get_mount(hp):
    code = hp.strip().upper()
    match = re.fullmatch(r"([HUE])(\d+)", code)
    if match:
        prefix, size = match.groups()
        resource_count = int(size)
        return {
            "resourceType": RESOURCE_BY_PREFIX[prefix],
            "resourceCount": resource_count,
            "isSpinal": prefix == "E" and resource_count > 4,
        }
    return {"resourceType": None, "resourceCount": None, "isSpinal": False}


def get_technology(name, technology_names, technology_ids, previous_requirements):
    normalized_name = normalize(name)
    if normalized_name in technology_names:
        return technology_names[normalized_name]
    previous_requirement = previous_requirements.get(normalized_name)
    if previous_requirement in technology_ids:
        return previous_requirement

    for prefix, technology_id in TECH_ALIASES.items():
        if normalized_name.startswith(normalize(prefix)) and technology_id in technology_ids:
            return technology_id
    return None


def read_csv(source):
    if source.startswith(("https://", "http://")):
        with urllib.request.urlopen(source, timeout=30) as response:
            content = response.read().decode("utf-8-sig")
    else:
        content = Path(source).read_text(encoding="utf-8-sig")
    rows = list(csv.reader(io.StringIO(content, newline="")))
    if not rows or len(rows[0]) < 18:
        raise ValueError("The weapon CSV must contain all 18 expected columns.")
    if rows[0][0].strip() != "Weapon" or rows[0][16].strip() != "HP":
        raise ValueError("The weapon CSV does not match the expected published sheet.")
    return rows[1:]


def load_previous_requirements():
    if not OUTPUT_PATH.exists():
        return {}
    try:
        previous = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return {
        normalize(weapon["name"]): weapon["techRequirement"]
        for category in previous.get("categories", [])
        for weapon in category.get("weapons", [])
        if weapon.get("name") and weapon.get("techRequirement")
    }


def build_catalogue(rows):
    technology_tree = json.loads(TECH_TREE_PATH.read_text(encoding="utf-8"))
    technology_names = {
        normalize(value.get("name", key)): key
        for key, value in technology_tree.items()
        if isinstance(value, dict)
    }
    technology_ids = set(technology_tree)
    previous_requirements = load_previous_requirements()
    categories = []
    slug_counts = {}
    current_category = None

    for csv_row_number, raw_row in enumerate(rows, start=2):
        row = raw_row + [""] * max(0, 18 - len(raw_row))
        name = row[0].strip()
        if not name:
            continue
        if is_section_header(row):
            current_category = {
                "name": name,
                "description": row[11].strip(),
                "weapons": [],
            }
            categories.append(current_category)
            continue
        if current_category is None:
            current_category = {"name": "General", "description": "", "weapons": []}
            categories.append(current_category)

        base_id = slugify(name) or "weapon"
        count = slug_counts.get(base_id, 0)
        slug_counts[base_id] = count + 1
        weapon_id = base_id if count == 0 else f"{base_id}-{count + 1}"

        ranges = []
        for index in range(1, 11, 2):
            ranges.append({
                "accuracy": parse_value(row[index]),
                "damage": parse_value(row[index + 1]),
            })
        mount = get_mount(row[16])
        notes = parse_notes(row[11])
        tech_requirement = get_technology(name, technology_names, technology_ids, previous_requirements)
        is_spinal = (
            mount["isSpinal"]
            or "spinal" in name.casefold()
            or "spinal" in (tech_requirement or "").casefold()
        )
        weapon = {
            "id": weapon_id,
            "name": name,
            "ranges": ranges,
            "notes": notes,
            "tagsDescription": row[11].strip(),
            "implied": row[13].strip(),
            "reasoning": row[14].strip(),
            "tier": parse_value(row[15]),
            "hp": row[16].strip() or None,
            "resourceType": mount["resourceType"],
            "resourceCount": mount["resourceCount"],
            "isSpinal": is_spinal,
            "isPointDefense": (
                any(note["name"].casefold() == "antimissile" for note in notes)
                or name.casefold().startswith("pd ")
            ),
            "cost": parse_value(row[17]),
            "techRequirement": tech_requirement,
            "sourceRow": csv_row_number,
        }
        current_category["weapons"].append(weapon)

    return {
        "source": {
            "url": SOURCE_URL,
            "description": "Imported from the published weapons CSV.",
        },
        "categories": categories,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        default=SOURCE_URL,
        help="Published CSV URL or a local CSV file for offline imports.",
    )
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    args = parser.parse_args()

    catalogue = build_catalogue(read_csv(args.source))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(catalogue, indent=2) + "\n", encoding="utf-8")
    weapon_count = sum(len(category["weapons"]) for category in catalogue["categories"])
    print(f"Wrote {weapon_count} weapons across {len(catalogue['categories'])} categories to {args.output}")


if __name__ == "__main__":
    main()
