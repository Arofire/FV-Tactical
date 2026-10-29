import csv
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from scripts import import_weapons


ROOT = Path(__file__).resolve().parents[1]


def csv_row(name, *, accuracy=None, damage=None, tags="", implied="", reasoning="",
            tier="", hp="", cost=""):
    row = [""] * 18
    row[0] = name
    for index in range(5):
        row[1 + index * 2] = "" if accuracy is None else str(accuracy[index])
        row[2 + index * 2] = "" if damage is None else str(damage[index])
    row[11] = tags
    row[13] = implied
    row[14] = reasoning
    row[15] = tier
    row[16] = hp
    row[17] = cost
    return row


def section_row(name, description=""):
    row = [""] * 18
    row[0] = name
    row[11] = description
    return row


class ImportWeaponsTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.directory = Path(self.temp_dir.name)
        self.csv_path = self.directory / "weapons.csv"
        self.tech_path = self.directory / "tech-tree.json"
        self.previous_path = self.directory / "previous.json"

        with self.tech_path.open("w", encoding="utf-8") as file:
            json.dump({
                "tech-a": {"name": "Mapped By Name"},
                "tech-previous": {"name": "Previous Technology"},
                "spinal-coilgun-01": {"name": "Spinal Coilgun"},
            }, file)
        with self.previous_path.open("w", encoding="utf-8") as file:
            json.dump({
                "categories": [{
                    "name": "Old",
                    "weapons": [{
                        "name": "Mapped Weapon",
                        "requiredTech": ["tech-previous"],
                    }],
                }],
            }, file)

    def fixture_rows(self):
        header = ["" for _ in range(18)]
        header[0] = "Weapon"
        header[16] = "HP"
        return [
            header,
            section_row("Cannon", "Test category"),
            csv_row(
                "Main Test",
                accuracy=["+0", "", "-2", "7: -1", "N/A"],
                damage=["0", "", "2.5", "3", "text"],
                tags="Antimissile, Expendable(4)",
                implied="Implied text",
                reasoning="Reasoning text",
                tier="0",
                hp="E05",
                cost="0",
            ),
            csv_row("Mapped Weapon", hp="U02"),
            csv_row("Main Coilgun", hp="E04", cost="12"),
            csv_row("Hardpoint Example", hp="H02"),
            csv_row("Duplicate Name", hp="H01"),
            csv_row("Duplicate Name", hp="H01"),
            section_row("Troops"),
            csv_row("Light Weapons", tier="0"),
            csv_row("Nuclear Weapons", tier="0"),
            section_row("Warheads"),
            csv_row("Excluded Payload", hp="H01"),
        ]

    def save_csv(self, rows=None):
        with self.csv_path.open("w", encoding="utf-8", newline="") as file:
            csv.writer(file).writerows(rows or self.fixture_rows())
        return self.csv_path

    def build(self):
        return import_weapons.build_catalogue(
            self.fixture_rows()[1:],
            technology_tree_path=self.tech_path,
            previous_path=self.previous_path,
        )

    def test_build_preserves_import_rules_and_compact_special_values(self):
        catalogue = self.build()
        self.assertEqual(catalogue["schemaVersion"], 1)
        self.assertEqual([category["name"] for category in catalogue["categories"]],
                         ["Cannon", "Troops"])
        self.assertNotIn("Warheads", [category["name"] for category in catalogue["categories"]])
        weapons = {
            weapon["name"]: weapon
            for category in catalogue["categories"]
            for weapon in category["weapons"]
        }

        main = weapons["Main Test"]
        self.assertEqual(main["accuracy"], [0, None, -2, "7: -1", "N/A"])
        self.assertEqual(main["damage"], [0, None, 2.5, 3, "text"])
        self.assertEqual(main["requiredTech"], [])
        self.assertEqual(main["sourceRow"], 3)
        self.assertTrue(main["isMain"])
        self.assertTrue(main["isSpinal"])
        self.assertTrue(main["isPointDefense"])
        self.assertEqual(main["hp"], "E05")
        self.assertEqual(main["tier"], 0)
        self.assertEqual(main["cost"], 0)
        self.assertNotIn("ranges", main)
        self.assertNotIn("notes", main)
        self.assertNotIn("resourceType", main)
        self.assertNotIn("resourceCount", main)

        self.assertEqual(weapons["Mapped Weapon"]["requiredTech"], ["tech-previous"])
        for field in ("tagsDescription", "implied", "reasoning", "tier", "cost", "isMain", "isSpinal"):
            self.assertNotIn(field, weapons["Mapped Weapon"])
        self.assertEqual(weapons["Main Coilgun"]["requiredTech"], ["spinal-coilgun-01"])
        weapon_ids = {
            weapon["id"]
            for category in catalogue["categories"]
            for weapon in category["weapons"]
        }
        self.assertIn("duplicate-name", weapon_ids)
        self.assertIn("duplicate-name-2", weapon_ids)
        self.assertEqual(weapons["Hardpoint Example"]["hp"], "H02")
        troop_prices = {weapon["id"]: weapon["cost"] for weapon in catalogue["categories"][1]["weapons"]}
        self.assertEqual(troop_prices, {"light-weapons": 1, "nuclear-weapons": 2})

    def test_bundled_catalogue_retains_all_baseline_warheads(self):
        bundled = json.loads((ROOT / "data" / "weapons.json").read_text(encoding="utf-8"))
        warheads = next(category for category in bundled["categories"] if category["name"] == "Warheads")
        self.assertEqual(sum(len(category["weapons"]) for category in bundled["categories"]), 281)
        self.assertEqual(
            [weapon["id"] for weapon in warheads["weapons"]],
            [
                "swarmer-warhead", "candle-warhead", "antipersonnel-warhead",
                "light-interceptor-warhead", "new-interceptor-warhead",
                "ultralight-interceptor-warhead", "chemlaser-warhead",
                "nuclear-interceptor-warhead", "standard-nuclear-warhead",
                "sprint-nuclear-warhead", "nuclear-lance-warhead",
                "antimatter-burst-warhead", "flash-mortar-warhead",
                "plasma-bottle-warhead", "xraser-warhead", "graser-warhead",
                "neutron-beam-warhead", "disruptor-warhead", "nefp-warhead",
                "hyperon-warhead",
            ],
        )

    def test_deterministic_inline_formatting_and_idempotence(self):
        catalogue = self.build()
        text = import_weapons.serialize_catalogue(catalogue)
        self.assertTrue(text.endswith("\n"))
        self.assertIn('"accuracy": [0, null, -2, "7: -1", "N/A"]', text)
        self.assertIn('"requiredTech": ["tech-previous"]', text)
        self.assertEqual(import_weapons.serialize_catalogue(json.loads(text)), text)

    def test_invalid_catalogue_does_not_replace_existing_output(self):
        output = self.directory / "existing.json"
        output.write_text("keep this file\n", encoding="utf-8")
        catalogue = self.build()
        catalogue["categories"][0]["weapons"][0]["accuracy"] = [1, 2]
        with self.assertRaisesRegex(ValueError, "exactly five"):
            import_weapons.write_catalogue(output, catalogue)
        self.assertEqual(output.read_text(encoding="utf-8"), "keep this file\n")
        self.assertEqual(list(self.directory.glob(".existing.json.*.tmp")), [])

    def test_validated_atomic_write_preserves_existing_permissions(self):
        output = self.directory / "permissions.json"
        output.write_text("old\n", encoding="utf-8")
        output.chmod(0o640)
        import_weapons.write_catalogue(output, self.build())
        self.assertEqual(output.stat().st_mode & 0o777, 0o640)
        self.assertEqual(json.loads(output.read_text(encoding="utf-8"))["schemaVersion"], 1)

    def test_duplicate_ids_and_legacy_properties_are_rejected(self):
        catalogue = self.build()
        weapon = catalogue["categories"][0]["weapons"][0]
        catalogue["categories"][0]["weapons"].append(dict(weapon))
        with self.assertRaisesRegex(ValueError, "duplicate id"):
            import_weapons.validate_catalogue(catalogue)

        catalogue["categories"][0]["weapons"].pop()
        weapon["resourceType"] = "hardpoints"
        with self.assertRaisesRegex(ValueError, "unsupported fields"):
            import_weapons.validate_catalogue(catalogue)

    def test_validation_matches_native_loader_optional_values_and_bounds(self):
        catalogue = self.build()
        weapon = catalogue["categories"][0]["weapons"][0]
        weapon.update({
            "hp": "H9007199254740991",
            "cost": None,
            "tier": None,
            "tagsDescription": "",
            "reasoning": "",
            "isMain": False,
        })
        import_weapons.validate_catalogue(catalogue)

        for field, value, message in (
            ("sourceRow", 1, "at least 2"),
            ("hp", "E9007199254740992", "safe integer"),
            ("cost", {}, "number, string, or null"),
            ("tier", float("inf"), "number, string, or null"),
            ("isMain", "true", "boolean"),
            ("hp", None, "hp must be a string"),
        ):
            invalid_catalogue = self.build()
            invalid_catalogue["categories"][0]["weapons"][0][field] = value
            with self.subTest(field=field, value=value):
                with self.assertRaisesRegex(ValueError, message):
                    import_weapons.validate_catalogue(invalid_catalogue)

    def test_validation_rejects_boolean_numbers_and_preserves_or_rejects_unknown_fields(self):
        boolean_fields = (
            ("schemaVersion", True, "schemaVersion"),
            ("sourceRow", True, "sourceRow"),
            ("accuracy", [True, None, None, None, None], "accuracy\\[0\\]"),
            ("damage", [None, False, None, None, None], "damage\\[1\\]"),
            ("cost", True, "cost"),
            ("tier", False, "tier"),
        )
        for field, value, message in boolean_fields:
            catalogue = self.build()
            if field in ("accuracy", "damage"):
                catalogue["categories"][0]["weapons"][0][field] = value
            elif field in ("cost", "tier", "sourceRow"):
                catalogue["categories"][0]["weapons"][0][field] = value
            else:
                catalogue[field] = value
            with self.subTest(field=field):
                with self.assertRaisesRegex(ValueError, message):
                    import_weapons.validate_catalogue(catalogue)

        catalogue = self.build()
        catalogue["source"]["revision"] = "preserved"
        serialized = import_weapons.serialize_catalogue(catalogue)
        self.assertEqual(json.loads(serialized)["source"]["revision"], "preserved")

        catalogue["categories"][0]["revision"] = "unsupported"
        with self.assertRaisesRegex(ValueError, "category .* unsupported fields"):
            import_weapons.validate_catalogue(catalogue)

    def test_malformed_previous_requirements_are_actionable(self):
        self.previous_path.write_text("{", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "previous weapon requirements"):
            import_weapons.load_previous_requirements(self.previous_path)

    def test_cli_local_csv_and_wrapper_forward_arguments(self):
        self.save_csv()
        output = self.directory / "cli-output.json"
        result = subprocess.run(
            [sys.executable, str(ROOT / "tmp_weapon_parser.py"),
             "--source", str(self.csv_path), "--output", str(output)],
            cwd=ROOT, text=True, capture_output=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Wrote 8 weapons across 2 categories", result.stdout)
        imported = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(imported["schemaVersion"], 1)
        self.assertEqual([weapon["name"] for category in imported["categories"]
                          for weapon in category["weapons"]][-2:],
                         ["Light Weapons", "Nuclear Weapons"])

    def test_cli_bad_source_leaves_requested_output_unchanged(self):
        invalid_header = [""] * 18
        invalid_header[0] = "wrong"
        invalid_header[16] = "HP"
        self.save_csv([invalid_header])
        output = self.directory / "protected.json"
        output.write_text("unchanged\n", encoding="utf-8")
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "import_weapons.py"),
             "--source", str(self.csv_path), "--output", str(output)],
            cwd=ROOT, text=True, capture_output=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("does not match", result.stderr)
        self.assertEqual(output.read_text(encoding="utf-8"), "unchanged\n")


if __name__ == "__main__":
    unittest.main()
