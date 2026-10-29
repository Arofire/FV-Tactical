#!/usr/bin/env python3
"""Import the published weapon catalogue into the browser's JSON data file."""

import argparse
import csv
import io
import json
import math
import os
import re
import stat
import tempfile
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
# Troop weapons have no CSV cost; these are the costs used by the troop widget
# (anything missing defaults to TROOP_DEFAULT_COST).
TROOP_CATEGORY = "Troops"
TROOP_WEAPON_COSTS = {
    "light-weapons": 1,
    "heavy-weapons": 1,
    "nuclear-weapons": 2,
}
TROOP_DEFAULT_COST = 1
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


def get_cost(value, category_name, weapon_id):
    cost = parse_value(value)
    if cost is None and category_name == TROOP_CATEGORY:
        return TROOP_WEAPON_COSTS.get(weapon_id, TROOP_DEFAULT_COST)
    return cost


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


def load_previous_requirements(path=OUTPUT_PATH):
    if not path.exists():
        return {}
    try:
        previous = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Cannot read previous weapon requirements from {path}: {error}") from error
    if not isinstance(previous, dict) or not isinstance(previous.get("categories"), list):
        raise ValueError(f"Previous weapon catalogue {path} must contain a categories array.")

    requirements = {}
    for category_index, category in enumerate(previous["categories"]):
        if not isinstance(category, dict) or not isinstance(category.get("weapons"), list):
            raise ValueError(
                f"Previous weapon catalogue {path} has an invalid category at index {category_index}."
            )
        for weapon_index, weapon in enumerate(category["weapons"]):
            context = f"category {category_index}, weapon {weapon_index}"
            if not isinstance(weapon, dict):
                raise ValueError(f"Previous weapon catalogue {path} has invalid {context}.")
            name = weapon.get("name")
            tech = weapon.get("requiredTech")
            if not isinstance(name, str) or not isinstance(tech, list) or any(
                not isinstance(item, str) for item in tech
            ):
                raise ValueError(
                    f"Previous weapon catalogue {path} has invalid name/requiredTech at {context}."
                )
            if tech:
                requirements[normalize(name)] = tech[0]
    return requirements


def build_catalogue(rows, technology_tree_path=TECH_TREE_PATH, previous_path=OUTPUT_PATH):
    try:
        technology_tree = json.loads(technology_tree_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Cannot read technology tree from {technology_tree_path}: {error}") from error
    if not isinstance(technology_tree, dict):
        raise ValueError(f"Technology tree {technology_tree_path} must be a JSON object.")
    technology_names = {
        normalize(value.get("name", key)): key
        for key, value in technology_tree.items()
        if isinstance(value, dict)
    }
    technology_ids = set(technology_tree)
    previous_requirements = load_previous_requirements(previous_path)
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

        accuracy = []
        damage = []
        for index in range(1, 11, 2):
            accuracy.append(parse_value(row[index]))
            damage.append(parse_value(row[index + 1]))
        mount = get_mount(row[16])
        notes = parse_notes(row[11])
        tech_requirement = get_technology(name, technology_names, technology_ids, previous_requirements)
        is_spinal = (
            mount["isSpinal"]
            or "spinal" in name.casefold()
            or "spinal" in (tech_requirement or "").casefold()
        )
        weapon = {"id": weapon_id, "name": name, "accuracy": accuracy, "damage": damage}
        tags_description = row[11].strip()
        implied = row[13].strip()
        reasoning = row[14].strip()
        tier = parse_value(row[15])
        hp = row[16].strip()
        cost = get_cost(row[17], current_category["name"], weapon_id)
        if tags_description:
            weapon["tagsDescription"] = tags_description
        if implied:
            weapon["implied"] = implied
        if reasoning:
            weapon["reasoning"] = reasoning
        if tier is not None:
            weapon["tier"] = tier
        if hp:
            weapon["hp"] = hp
        if is_spinal:
            weapon["isSpinal"] = True
        if any(note["name"].casefold() == "antimissile" for note in notes) or name.casefold().startswith("pd "):
            weapon["isPointDefense"] = True
        if name.casefold().startswith("main "):
            weapon["isMain"] = True
        if cost is not None:
            weapon["cost"] = cost
        weapon["requiredTech"] = [tech_requirement] if tech_requirement else []
        weapon["sourceRow"] = csv_row_number
        current_category["weapons"].append(weapon)

    catalogue = {
        "schemaVersion": 1,
        "source": {
            "url": SOURCE_URL,
            "description": "Imported from the published weapons CSV.",
        },
        # Warheads are curated in data/munitions.json as munition payloads and
        # are intentionally excluded from the weapons catalogue.
        "categories": [
            category for category in categories if category["name"] != "Warheads"
        ],
    }
    validate_catalogue(catalogue)
    return catalogue


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate_catalogue(catalogue):
    """Validate compact weapon JSON before serialization or replacing a file."""
    if not isinstance(catalogue, dict):
        raise ValueError("Weapon catalogue must be a JSON object.")
    if catalogue.get("schemaVersion") != 1 or isinstance(catalogue.get("schemaVersion"), bool):
        raise ValueError("Weapon catalogue schemaVersion must be 1.")
    source = catalogue.get("source")
    if not isinstance(source, dict) or any(
        not isinstance(source.get(key), str) for key in ("url", "description")
    ):
        raise ValueError("Weapon catalogue source must contain url and description strings.")
    categories = catalogue.get("categories")
    if not isinstance(categories, list):
        raise ValueError("Weapon catalogue categories must be an array.")

    ids = set()
    for category_index, category in enumerate(categories):
        category_context = f"category at index {category_index}"
        if not isinstance(category, dict):
            raise ValueError(f"{category_context} must be an object.")
        if not isinstance(category.get("name"), str) or not category["name"].strip():
            raise ValueError(f"{category_context} must have a non-empty name.")
        if not isinstance(category.get("description"), str):
            raise ValueError(f"category {category['name']!r} description must be a string.")
        unknown_category_fields = set(category) - {"name", "description", "weapons"}
        if unknown_category_fields:
            raise ValueError(
                f"category {category['name']!r} contains unsupported fields: "
                + ", ".join(sorted(unknown_category_fields))
                + "."
            )
        weapons = category.get("weapons")
        if not isinstance(weapons, list):
            raise ValueError(f"category {category['name']!r} weapons must be an array.")

        for weapon_index, weapon in enumerate(weapons):
            context = f"category {category['name']!r}, weapon at index {weapon_index}"
            if not isinstance(weapon, dict):
                raise ValueError(f"{context} must be an object.")
            weapon_id = weapon.get("id")
            name = weapon.get("name")
            if not isinstance(weapon_id, str) or not weapon_id:
                raise ValueError(f"{context} must have a non-empty id.")
            if weapon_id in ids:
                raise ValueError(f"{context} has duplicate id {weapon_id!r}.")
            ids.add(weapon_id)
            if not isinstance(name, str) or not name:
                raise ValueError(f"{context} must have a non-empty name.")

            for stat in ("accuracy", "damage"):
                values = weapon.get(stat)
                if not isinstance(values, list) or len(values) != 5:
                    raise ValueError(f"{context} {stat} must contain exactly five entries.")
                for band_index, value in enumerate(values):
                    if value is not None and not (
                        isinstance(value, str) or _is_number(value)
                    ):
                        raise ValueError(
                            f"{context} {stat}[{band_index}] must be a string, number, or null."
                        )

            required_tech = weapon.get("requiredTech")
            if not isinstance(required_tech, list) or any(
                not isinstance(tech_id, str) or not tech_id for tech_id in required_tech
            ):
                raise ValueError(f"{context} requiredTech must be an array of non-empty tech IDs.")
            if (
                not isinstance(weapon.get("sourceRow"), int)
                or isinstance(weapon["sourceRow"], bool)
                or weapon["sourceRow"] < 2
            ):
                raise ValueError(f"{context} sourceRow must be an integer of at least 2.")

            for field in ("tagsDescription", "implied", "reasoning"):
                if field in weapon and not isinstance(weapon[field], str):
                    raise ValueError(f"{context} {field} must be a string when present.")
            for field in ("tier", "cost"):
                if field in weapon and weapon[field] is not None and not (
                    _is_number(weapon[field]) or isinstance(weapon[field], str)
                ):
                    raise ValueError(f"{context} {field} must be a number, string, or null.")
            if "hp" in weapon:
                hp = weapon["hp"]
                if not isinstance(hp, str):
                    raise ValueError(f"{context} hp must be a string when present.")
                mount_match = re.fullmatch(r"([HUE])(\d+)", hp.strip().upper())
                if mount_match and int(mount_match.group(2)) > 9007199254740991:
                    raise ValueError(f"{context} hp mount size must be a safe integer.")
            for flag in ("isSpinal", "isMain", "isPointDefense"):
                if flag in weapon and not isinstance(weapon[flag], bool):
                    raise ValueError(f"{context} {flag} must be a boolean when present.")

            allowed = {
                "id", "name", "accuracy", "damage", "tagsDescription", "implied",
                "reasoning", "tier", "hp", "isSpinal", "isMain", "isPointDefense",
                "cost", "requiredTech", "sourceRow",
            }
            unknown = set(weapon) - allowed
            if unknown:
                raise ValueError(f"{context} contains unsupported fields: {', '.join(sorted(unknown))}.")

    unknown_top_level = set(catalogue) - {"schemaVersion", "source", "categories"}
    if unknown_top_level:
        raise ValueError(
            "Weapon catalogue contains unsupported top-level fields: "
            + ", ".join(sorted(unknown_top_level))
            + "."
        )


def _format_json(value, depth=0, inline=False):
    """Format JSON deterministically, keeping catalogue stat/tech arrays inline."""
    indent = "  " * depth
    if isinstance(value, dict):
        if not value:
            return "{}"
        entries = []
        for key, item in value.items():
            item_inline = key in ("accuracy", "damage", "requiredTech")
            rendered = _format_json(item, depth + 1, inline=item_inline)
            entries.append(f'{"  " * (depth + 1)}{json.dumps(key, ensure_ascii=False)}: {rendered}')
        return "{\n" + ",\n".join(entries) + f"\n{indent}" + "}"
    if isinstance(value, list):
        if inline:
            return "[" + ", ".join(json.dumps(item, ensure_ascii=False, allow_nan=False) for item in value) + "]"
        if not value:
            return "[]"
        items = [f'{"  " * (depth + 1)}{_format_json(item, depth + 1)}' for item in value]
        return "[\n" + ",\n".join(items) + f"\n{indent}]"
    return json.dumps(value, ensure_ascii=False, allow_nan=False)


def serialize_catalogue(catalogue):
    validate_catalogue(catalogue)
    return _format_json(catalogue) + "\n"


def write_catalogue(path, catalogue):
    """Validate and atomically replace an output file after a completed write."""
    text = serialize_catalogue(catalogue)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        output_mode = stat.S_IMODE(path.stat().st_mode)
    else:
        current_umask = os.umask(0)
        os.umask(current_umask)
        output_mode = 0o666 & ~current_umask
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", newline="\n", dir=path.parent,
            prefix=f".{path.name}.", suffix=".tmp", delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
            os.chmod(temporary_path, output_mode)
            temporary.write(text)
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()


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
    write_catalogue(args.output, catalogue)
    weapon_count = sum(len(category["weapons"]) for category in catalogue["categories"])
    print(f"Wrote {weapon_count} weapons across {len(catalogue['categories'])} categories to {args.output}")


if __name__ == "__main__":
    main()
