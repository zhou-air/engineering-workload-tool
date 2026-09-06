"""Application entry point and packaged self-check."""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

from app.database import Database
from app.services.export_service import ExportService
from app.services.record_service import RecordService


def application_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="工作量量化工具")
    parser.add_argument("--data-dir", type=Path, help="覆盖默认数据目录")
    parser.add_argument("--self-check", action="store_true", help="执行无界面自检")
    return parser


def run_self_check() -> int:
    with tempfile.TemporaryDirectory(prefix="workload_tool_check_") as temp:
        base = Path(temp)
        database = Database(base / "data" / "workload.db")
        database.initialize()
        persons = database.list_persons(active_only=True)
        projects = database.list_projects(active_only=True)
        pump = next(row for row in database.list_rules(active_only=True) if row["rule_code"] == "M1-03-D")
        record_id = RecordService(database).save(
            work_date="2026-09-05", person_id=persons[0]["id"], project_id=projects[0]["id"],
            rule_id=pump["id"], quantity="6", remark="packaged self-check",
        )
        export_path = base / "check.xlsx"
        ExportService(database).export_day("2026-09-05", export_path)
        result = {
            "ok": True,
            "schema_version": 1,
            "active_persons": len(persons),
            "active_projects": len(projects),
            "active_rules": len(database.list_rules(active_only=True)),
            "record_id": record_id,
            "workload_score": database.get_record(record_id)["workload_score"],
            "xlsx_created": export_path.exists(),
        }
        print(json.dumps(result, ensure_ascii=False))
    return 0


def main() -> int:
    args = build_parser().parse_args()
    if args.self_check:
        return run_self_check()
    root = application_root()
    data_dir = args.data_dir.resolve() if args.data_dir else root / "data"
    export_dir = root / "exports"
    database = Database(data_dir / "workload.db")
    database.initialize()
    export_dir.mkdir(parents=True, exist_ok=True)
    from app.ui.main_window import WorkloadApp

    app = WorkloadApp(database, export_dir)
    app.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
