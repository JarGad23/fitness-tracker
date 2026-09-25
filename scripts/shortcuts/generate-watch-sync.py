#!/usr/bin/env python3
"""Generate and sign the "Watch Sync v2" Apple Shortcut (macOS only: needs `shortcuts`).

The shortcut does no math. It reads Apple Health samples and posts them to
/api/watch-sync as plain text lines; src/lib/health-sync.ts does the aggregation.

    python3 scripts/shortcuts/generate-watch-sync.py --email you@example.com
    python3 scripts/shortcuts/generate-watch-sync.py --email ... --days 90 --sleep-days 14 \
        --name "Watch Sync backfill" --show-result          # one-off history backfill
    python3 scripts/shortcuts/generate-watch-sync.py --email ... \
        --url http://<mac-lan-ip>:3000/api/watch-sync?dry=1 --show-result   # local test

Then `open` the .shortcut file to import it (it syncs to the iPhone via iCloud).
The bearer token is read from .env (WATCH_SYNC_SECRET) and baked into the output,
so the output directory is gitignored — never commit or share the generated file.

Action structures were copied from shortcuts built in the Shortcuts app and
checked against real phone output. Non-obvious bits:
  - Start Date filter: Operator 1001 + Unit 16 = "in the last N days".
    Operator 1002 = "is today" (its Number is ignored) — the v1 shortcut's bug.
  - Per-sample loops slow down sharply with list length: 90 days of raw sleep
    (~2700 samples) hung the phone, 14 days (~400) takes ~30 s. Keep --sleep-days small.
"""

import argparse
import plistlib
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROD_URL = "https://fitness-tracker-sooty-mu.vercel.app/api/watch-sync"
OBJ = "￼"  # placeholder char marking where a variable sits inside a text token

REPEAT_ITEM = {"Type": "Variable", "VariableName": "Repeat Item"}
VALUE_OF_ITEM = dict(
    REPEAT_ITEM,
    Aggrandizements=[{"Type": "WFPropertyVariableAggrandizement", "PropertyName": "Value"}],
)
# Output names are display labels only (the phone is in Polish); UUIDs do the linking.
SAMPLES, FORMATTED, REPEAT_RESULTS = "Próbki aplikacji Zdrowie", "Sformatowana data", "Wyniki powtórzenia"


def read_secret() -> str:
    for line in (ROOT / ".env").read_text().splitlines():
        key, _, value = line.partition("=")
        if key.strip() == "WATCH_SYNC_SECRET":
            return value.strip().strip("\"'")
    sys.exit("WATCH_SYNC_SECRET not found in .env")


class Builder:
    def __init__(self):
        self.actions = []

    def add(self, ident, params):
        params = {**params, "UUID": str(uuid.uuid4()).upper()}
        self.actions.append({"WFWorkflowActionIdentifier": ident, "WFWorkflowActionParameters": params})
        return params["UUID"]

    @staticmethod
    def output(uid, name):
        return {"Type": "ActionOutput", "OutputUUID": uid, "OutputName": name}

    @staticmethod
    def attach(ref):
        return {"Value": ref, "WFSerializationType": "WFTextTokenAttachment"}

    @staticmethod
    def text(*parts):
        """Text token: plain strings mixed with variable refs."""
        string, attachments = "", {}
        for part in parts:
            if isinstance(part, str):
                string += part
            else:
                attachments[f"{{{len(string.encode('utf-16-le')) // 2}, 1}}"] = part
                string += OBJ
        value = {"string": string}
        if attachments:
            value["attachmentsByRange"] = attachments
        return {"Value": value, "WFSerializationType": "WFTextTokenString"}

    def format_date(self, uid, name, pattern):
        return self.add("is.workflow.actions.format.date", {
            "WFDateFormatStyle": "Custom", "WFDateFormat": pattern,
            "WFDate": self.text(self.output(uid, name)),
        })

    def item_property(self, name):
        return self.add("is.workflow.actions.properties.health.quantity", {
            "WFInput": self.attach(REPEAT_ITEM), "WFContentItemPropertyName": name,
        })

    def health_samples(self, type_name, days, source=None, **options):
        templates = [
            {"Property": "Type", "Operator": 4, "Removable": False, "Bounded": True,
             "Values": {"Enumeration": {"Value": type_name, "WFSerializationType": "WFStringSubstitutableState"}}},
            {"Property": "Start Date", "Operator": 1001, "Removable": False, "Bounded": True,
             "Values": {"Unit": 16, "Number": str(days)}},
        ]
        if source:
            templates.append({"Property": "Source", "Operator": 4, "Removable": True,
                              "Values": {"Unit": 4, "Enumeration": {
                                  "Value": source, "WFSerializationType": "WFStringSubstitutableState"}}})
        return self.add("is.workflow.actions.filter.health.quantity", {
            "WFContentItemFilter": {
                "Value": {"WFActionParameterFilterPrefix": 1, "WFContentPredicateBoundedDate": False,
                          "WFActionParameterFilterTemplates": templates},
                "WFSerializationType": "WFContentPredicateTableTemplate",
            },
            **options,
        })

    def each(self, samples_uid, body):
        """Repeat with each sample; returns the UUID whose output is the list of results."""
        group = str(uuid.uuid4()).upper()
        self.add("is.workflow.actions.repeat.each", {
            "WFInput": self.attach(self.output(samples_uid, SAMPLES)),
            "GroupingIdentifier": group, "WFControlFlowMode": 0,
        })
        body()
        return self.add("is.workflow.actions.repeat.each", {"GroupingIdentifier": group, "WFControlFlowMode": 2})

    def daily_line(self):
        """"YYYY-MM-DD;value" for the current sample."""
        start = self.item_property("Start Date")
        day = self.format_date(start, "Data początkowa", "yyyy-MM-dd")
        self.add("is.workflow.actions.gettext", {
            "WFTextActionText": self.text(self.output(day, FORMATTED), ";", VALUE_OF_ITEM)})

    def sleep_line(self):
        """"start;end;stage" for the current sleep sample (local wall-clock time)."""
        pattern = "yyyy-MM-dd'T'HH:mm:ss"
        start = self.format_date(self.item_property("Start Date"), "Data początkowa", pattern)
        end = self.format_date(self.item_property("End Date"), "Data końcowa", pattern)
        self.add("is.workflow.actions.gettext", {"WFTextActionText": self.text(
            self.output(start, FORMATTED), ";", self.output(end, FORMATTED), ";", VALUE_OF_ITEM)})


def build(args, secret):
    b = Builder()
    today = b.format_date(b.add("is.workflow.actions.date", {}), "Data", "yyyy-MM-dd")

    calories = b.each(
        b.health_samples("Active Calories", args.days, WFHKSampleFilteringGroupBy="Day",
                         WFHKSampleFilteringUnit="kcal", WFContentItemSortProperty="Start Date",
                         WFContentItemSortOrder="Latest First", WFContentItemLimitEnabled=False,
                         WFContentItemLimitNumber=1.0),
        b.daily_line)
    resting_hr = b.each(b.health_samples("Resting Heart Rate", args.days, source=args.hr_source), b.daily_line)
    sleep = b.each(
        b.health_samples("Sleep", args.sleep_days, WFContentItemSortProperty="Start Date",
                         WFContentItemSortOrder="Oldest First", WFContentItemLimitEnabled=False),
        b.sleep_line)

    # Workout-only signals, one value per day. Type names come from a shortcut built
    # in the Shortcuts app ("Typy"), not guessed.
    # A type with no samples at all in the window makes Shortcuts show a blocking
    # "no samples found" alert, which would stall the background automation — so only
    # request signals the user actually records (--signals).
    def per_day(type_name, unit=None, **extra):
        options = {"WFHKSampleFilteringGroupBy": "Day", **extra}
        if unit:
            options["WFHKSampleFilteringUnit"] = unit
        return b.each(b.health_samples(type_name, args.days, **options), b.daily_line)

    exercise = per_day("Exercise Time", "min")
    signals = {}
    if "cycling" in args.signals:
        signals["cycling_km"] = per_day("Cycling Distance", "km")
    if "swimming" in args.signals:
        signals["swimming_m"] = per_day("Swimming Distance", "m")
    if "running" in args.signals:
        # Unit left to Health's default; fill missing days so an empty week isn't "no samples".
        signals["running_speed"] = per_day("Running Speed", WFHKSampleFilteringFillMissing=True)

    def field(key, value, item_type=0):  # item_type: 0 text, 3 number
        return {"WFKey": b.text(key), "WFItemType": item_type, "WFValue": value}

    response = b.add("is.workflow.actions.downloadurl", {
        "WFURL": args.url, "WFHTTPMethod": "POST", "ShowHeaders": False,
        "WFHTTPHeaders": {"Value": {"WFDictionaryFieldValueItems": [
            field("Authorization", b.text(f"Bearer {secret}"))]},
            "WFSerializationType": "WFDictionaryFieldValue"},
        "WFJSONValues": {"Value": {"WFDictionaryFieldValueItems": [
            field("version", b.text("2"), 3),
            field("user_email", b.text(args.email)),
            field("today", b.text(b.output(today, FORMATTED))),
            field("active_calories", b.text(b.output(calories, REPEAT_RESULTS))),
            field("resting_hr", b.text(b.output(resting_hr, REPEAT_RESULTS))),
            field("sleep", b.text(b.output(sleep, REPEAT_RESULTS))),
            field("exercise_minutes", b.text(b.output(exercise, REPEAT_RESULTS))),
            *(field(key, b.text(b.output(uid, REPEAT_RESULTS))) for key, uid in signals.items()),
        ]}, "WFSerializationType": "WFDictionaryFieldValue"},
    })
    if args.show_result:
        b.add("is.workflow.actions.showresult", {"Text": b.text(b.output(response, "Zawartość adresu URL"))})

    return {
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowClientVersion": "4610.1",
        "WFWorkflowIcon": {"WFWorkflowIconStartColor": 1440408063, "WFWorkflowIconGlyphNumber": 61440},
        "WFWorkflowTypes": ["Watch", "WFWorkflowTypeShowInSearch"],
        "WFWorkflowInputContentItemClasses": [],
        "WFWorkflowOutputContentItemClasses": [],
        "WFWorkflowHasOutputFallback": False,
        "WFWorkflowHasShortcutInputVariables": False,
        "WFWorkflowImportQuestions": [],
        "WFQuickActionSurfaces": [],
        "WFWorkflowActions": b.actions,
    }


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--email", required=True, help="account email the data belongs to")
    p.add_argument("--url", default=PROD_URL)
    p.add_argument("--days", type=int, default=7, help="window for calories + resting HR")
    p.add_argument("--sleep-days", type=int, default=7, help="window for raw sleep samples (keep small)")
    p.add_argument("--signals", type=lambda v: set(v.split(",")), default={"cycling", "running"},
                   help="workout signals to request: cycling,running,swimming (default: cycling,running)")
    p.add_argument("--hr-source", help='only resting HR from this source, e.g. "Apple Watch (Name)"')
    p.add_argument("--name", default="Watch Sync v2", help="shortcut name (= output file name)")
    p.add_argument("--show-result", action="store_true", help="show the server response (manual runs)")
    p.add_argument("--out-dir", type=Path, default=ROOT / "scripts/shortcuts/out")
    args = p.parse_args()

    workflow = build(args, read_secret())
    args.out_dir.mkdir(parents=True, exist_ok=True)
    out = args.out_dir / f"{args.name}.shortcut"
    with tempfile.NamedTemporaryFile(suffix=".wflow") as unsigned:
        plistlib.dump(workflow, unsigned, fmt=plistlib.FMT_BINARY)
        unsigned.flush()
        subprocess.run(["shortcuts", "sign", "--mode", "anyone", "--input", unsigned.name, "--output", str(out)],
                       check=True, capture_output=True)
    print(f"{len(workflow['WFWorkflowActions'])} actions -> {out}")


if __name__ == "__main__":
    main()
