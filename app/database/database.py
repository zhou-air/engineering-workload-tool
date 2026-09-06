"""SQLite schema, initialization, and repository-style queries."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator

from .seed import PERSONS, PROJECTS, RULES, TEAMS


SCHEMA_VERSION = 1

SCHEMA_SQL = r"""
CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    leader_name TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
    remark TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS persons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    team_id INTEGER,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
    remark TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(team_id) REFERENCES teams(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
    remark TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quota_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    module TEXT NOT NULL,
    module_en TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    category_en TEXT NOT NULL DEFAULT '',
    subtype TEXT NOT NULL,
    subtype_en TEXT NOT NULL DEFAULT '',
    display_name TEXT NOT NULL,
    display_name_en TEXT NOT NULL DEFAULT '',
    input_label TEXT NOT NULL DEFAULT '数量',
    input_unit TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL DEFAULT '',
    unit_en TEXT NOT NULL DEFAULT '',
    base_score TEXT,
    quantity_mode TEXT NOT NULL CHECK(quantity_mode IN (
        'AUTO_1TO1', 'AUTO_DIV100', 'MANUAL_STANDARDIZED',
        'MANUAL_BASE_SCORE', 'LINKED_WORKLOAD', 'DISABLED'
    )),
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
    requires_basis INTEGER NOT NULL DEFAULT 0 CHECK(requires_basis IN (0, 1)),
    remark TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    work_date TEXT NOT NULL,
    person_id INTEGER NOT NULL,
    team_id INTEGER,
    project_id INTEGER NOT NULL,
    rule_id INTEGER NOT NULL,
    quantity TEXT NOT NULL,
    standardized_quantity TEXT NOT NULL,
    input_unit_snapshot TEXT NOT NULL DEFAULT '',
    rule_code_snapshot TEXT NOT NULL,
    rule_name_snapshot TEXT NOT NULL,
    module_snapshot TEXT NOT NULL,
    category_snapshot TEXT NOT NULL,
    subtype_snapshot TEXT NOT NULL,
    unit_snapshot TEXT NOT NULL,
    base_score_snapshot TEXT NOT NULL,
    adjustment_factor_snapshot TEXT NOT NULL DEFAULT '1',
    workload_score TEXT NOT NULL,
    person_name_snapshot TEXT NOT NULL,
    team_name_snapshot TEXT NOT NULL DEFAULT '',
    project_name_snapshot TEXT NOT NULL,
    remark TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(state IN ('ACTIVE', 'VOID')),
    void_reason TEXT NOT NULL DEFAULT '',
    voided_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(person_id) REFERENCES persons(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY(team_id) REFERENCES teams(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY(rule_id) REFERENCES quota_rules(id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_records_date ON work_records(work_date);
CREATE INDEX IF NOT EXISTS idx_records_person_date ON work_records(person_id, work_date);
CREATE INDEX IF NOT EXISTS idx_records_project_date ON work_records(project_id, work_date);
CREATE INDEX IF NOT EXISTS idx_records_rule_date ON work_records(rule_id, work_date);
CREATE INDEX IF NOT EXISTS idx_records_state_date ON work_records(state, work_date);
"""


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


class Database:
    """Small synchronous data layer suitable for a single-user desktop app."""

    def __init__(self, path: str | Path):
        self.path = Path(path)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 10000")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.execute("PRAGMA journal_mode = WAL")
            connection.executescript(SCHEMA_SQL)
            row = connection.execute(
                "SELECT value FROM schema_meta WHERE key = 'schema_version'"
            ).fetchone()
            if row and int(row["value"]) > SCHEMA_VERSION:
                raise RuntimeError("数据库版本高于当前程序支持的版本")
            connection.execute(
                "INSERT INTO schema_meta(key, value) VALUES('schema_version', ?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (str(SCHEMA_VERSION),),
            )
            self._seed(connection)

    def _seed(self, connection: sqlite3.Connection) -> None:
        now = _now()
        for code, name, leader_name, remark in TEAMS:
            connection.execute(
                "INSERT OR IGNORE INTO teams(code, name, leader_name, active, remark, created_at, updated_at) "
                "VALUES(?, ?, ?, 1, ?, ?, ?)",
                (code, name, leader_name, remark, now, now),
            )
        team_ids = {
            row["code"]: row["id"]
            for row in connection.execute("SELECT id, code FROM teams")
        }
        for name, team_code, remark in PERSONS:
            connection.execute(
                "INSERT OR IGNORE INTO persons(name, team_id, active, remark, created_at, updated_at) "
                "VALUES(?, ?, 1, ?, ?, ?)",
                (name, team_ids.get(team_code), remark, now, now),
            )
        for code, name in PROJECTS:
            connection.execute(
                "INSERT OR IGNORE INTO projects(code, name, active, remark, created_at, updated_at) "
                "VALUES(?, ?, 1, '', ?, ?)",
                (code, name, now, now),
            )
        columns = (
            "rule_code, module, module_en, category, category_en, subtype, subtype_en, "
            "display_name, display_name_en, input_label, input_unit, unit, unit_en, "
            "base_score, quantity_mode, active, requires_basis, remark, created_at, updated_at"
        )
        placeholders = ",".join("?" for _ in range(20))
        for rule in RULES:
            connection.execute(
                f"INSERT OR IGNORE INTO quota_rules({columns}) VALUES({placeholders})",
                (*rule, now, now),
            )

    def list_teams(self, active_only: bool = False) -> list[dict[str, Any]]:
        where = "WHERE active = 1" if active_only else ""
        return self._rows(
            f"SELECT * FROM teams {where} ORDER BY active DESC, name COLLATE NOCASE"
        )

    def list_persons(self, active_only: bool = False) -> list[dict[str, Any]]:
        where = "WHERE p.active = 1" if active_only else ""
        return self._rows(
            "SELECT p.*, t.name AS team_name FROM persons p "
            "LEFT JOIN teams t ON t.id = p.team_id "
            f"{where} ORDER BY p.active DESC, p.name COLLATE NOCASE"
        )

    def list_projects(self, active_only: bool = False) -> list[dict[str, Any]]:
        where = "WHERE active = 1" if active_only else ""
        return self._rows(
            f"SELECT * FROM projects {where} ORDER BY active DESC, name COLLATE NOCASE"
        )

    def list_rules(self, active_only: bool = False) -> list[dict[str, Any]]:
        where = "WHERE active = 1 AND quantity_mode <> 'DISABLED'" if active_only else ""
        return self._rows(
            f"SELECT * FROM quota_rules {where} "
            "ORDER BY rule_code COLLATE NOCASE"
        )

    def get_team(self, item_id: int) -> dict[str, Any] | None:
        rows = self._rows("SELECT * FROM teams WHERE id=?", (item_id,))
        return rows[0] if rows else None

    def get_person(self, item_id: int) -> dict[str, Any] | None:
        rows = self._rows(
            "SELECT p.*, t.name AS team_name FROM persons p "
            "LEFT JOIN teams t ON t.id=p.team_id WHERE p.id=?",
            (item_id,),
        )
        return rows[0] if rows else None

    def get_project(self, item_id: int) -> dict[str, Any] | None:
        rows = self._rows("SELECT * FROM projects WHERE id=?", (item_id,))
        return rows[0] if rows else None

    def get_rule(self, rule_id: int) -> dict[str, Any] | None:
        rows = self._rows("SELECT * FROM quota_rules WHERE id = ?", (rule_id,))
        return rows[0] if rows else None

    def add_team(self, code: str, name: str, leader_name: str = "", remark: str = "") -> int:
        return self._insert(
            "INSERT INTO teams(code, name, leader_name, active, remark, created_at, updated_at) "
            "VALUES(?, ?, ?, 1, ?, ?, ?)",
            (code.strip(), name.strip(), leader_name.strip(), remark.strip(), _now(), _now()),
        )

    def update_team(self, item_id: int, code: str, name: str, leader_name: str, remark: str) -> None:
        self._execute(
            "UPDATE teams SET code=?, name=?, leader_name=?, remark=?, updated_at=? WHERE id=?",
            (code.strip(), name.strip(), leader_name.strip(), remark.strip(), _now(), item_id),
        )

    def add_person(self, name: str, team_id: int | None, remark: str = "") -> int:
        return self._insert(
            "INSERT INTO persons(name, team_id, active, remark, created_at, updated_at) "
            "VALUES(?, ?, 1, ?, ?, ?)",
            (name.strip(), team_id, remark.strip(), _now(), _now()),
        )

    def update_person(self, item_id: int, name: str, team_id: int | None, remark: str) -> None:
        self._execute(
            "UPDATE persons SET name=?, team_id=?, remark=?, updated_at=? WHERE id=?",
            (name.strip(), team_id, remark.strip(), _now(), item_id),
        )

    def add_project(self, code: str, name: str, remark: str = "") -> int:
        return self._insert(
            "INSERT INTO projects(code, name, active, remark, created_at, updated_at) "
            "VALUES(?, ?, 1, ?, ?, ?)",
            (code.strip(), name.strip(), remark.strip(), _now(), _now()),
        )

    def update_project(self, item_id: int, code: str, name: str, remark: str) -> None:
        self._execute(
            "UPDATE projects SET code=?, name=?, remark=?, updated_at=? WHERE id=?",
            (code.strip(), name.strip(), remark.strip(), _now(), item_id),
        )

    def set_active(self, table: str, item_id: int, active: bool) -> None:
        if table not in {"teams", "persons", "projects", "quota_rules"}:
            raise ValueError("不支持的数据表")
        self._execute(
            f"UPDATE {table} SET active=?, updated_at=? WHERE id=?",
            (1 if active else 0, _now(), item_id),
        )

    def add_rule(self, values: dict[str, Any]) -> int:
        now = _now()
        keys = [
            "rule_code", "module", "module_en", "category", "category_en",
            "subtype", "subtype_en", "display_name", "display_name_en",
            "input_label", "input_unit", "unit", "unit_en", "base_score",
            "quantity_mode", "requires_basis", "remark",
        ]
        return self._insert(
            "INSERT INTO quota_rules(" + ",".join(keys) + ",active,created_at,updated_at) "
            "VALUES(" + ",".join("?" for _ in keys) + ",1,?,?)",
            tuple(values.get(key, "") for key in keys) + (now, now),
        )

    def update_rule(self, item_id: int, values: dict[str, Any]) -> None:
        keys = [
            "rule_code", "module", "module_en", "category", "category_en",
            "subtype", "subtype_en", "display_name", "display_name_en",
            "input_label", "input_unit", "unit", "unit_en", "base_score",
            "quantity_mode", "requires_basis", "remark",
        ]
        assignments = ",".join(f"{key}=?" for key in keys)
        self._execute(
            f"UPDATE quota_rules SET {assignments}, updated_at=? WHERE id=?",
            tuple(values.get(key, "") for key in keys) + (_now(), item_id),
        )

    def create_record(self, values: dict[str, Any]) -> int:
        keys = [
            "work_date", "person_id", "team_id", "project_id", "rule_id",
            "quantity", "standardized_quantity", "input_unit_snapshot",
            "rule_code_snapshot", "rule_name_snapshot", "module_snapshot",
            "category_snapshot", "subtype_snapshot", "unit_snapshot",
            "base_score_snapshot", "adjustment_factor_snapshot", "workload_score",
            "person_name_snapshot", "team_name_snapshot", "project_name_snapshot", "remark",
        ]
        now = _now()
        sql = (
            "INSERT INTO work_records(" + ",".join(keys) + ",state,created_at,updated_at) "
            "VALUES(" + ",".join("?" for _ in keys) + ",'ACTIVE',?,?)"
        )
        return self._insert(sql, tuple(values[key] for key in keys) + (now, now))

    def update_record(self, record_id: int, values: dict[str, Any]) -> None:
        keys = [
            "work_date", "person_id", "team_id", "project_id", "rule_id",
            "quantity", "standardized_quantity", "input_unit_snapshot",
            "rule_code_snapshot", "rule_name_snapshot", "module_snapshot",
            "category_snapshot", "subtype_snapshot", "unit_snapshot",
            "base_score_snapshot", "adjustment_factor_snapshot", "workload_score",
            "person_name_snapshot", "team_name_snapshot", "project_name_snapshot", "remark",
        ]
        self._execute(
            "UPDATE work_records SET " + ",".join(f"{key}=?" for key in keys)
            + ", updated_at=? WHERE id=? AND state='ACTIVE'",
            tuple(values[key] for key in keys) + (_now(), record_id),
        )

    def void_record(self, record_id: int, reason: str) -> None:
        now = _now()
        self._execute(
            "UPDATE work_records SET state='VOID', void_reason=?, voided_at=?, updated_at=? "
            "WHERE id=? AND state='ACTIVE'",
            (reason.strip(), now, now, record_id),
        )

    def list_records(
        self,
        *,
        date_from: str | None = None,
        date_to: str | None = None,
        person_id: int | None = None,
        project_id: int | None = None,
        module: str | None = None,
        include_void: bool = False,
    ) -> list[dict[str, Any]]:
        clauses: list[str] = []
        parameters: list[Any] = []
        if not include_void:
            clauses.append("state = 'ACTIVE'")
        if date_from:
            clauses.append("work_date >= ?")
            parameters.append(date_from)
        if date_to:
            clauses.append("work_date <= ?")
            parameters.append(date_to)
        if person_id:
            clauses.append("person_id = ?")
            parameters.append(person_id)
        if project_id:
            clauses.append("project_id = ?")
            parameters.append(project_id)
        if module:
            clauses.append("module_snapshot = ?")
            parameters.append(module)
        where = "WHERE " + " AND ".join(clauses) if clauses else ""
        return self._rows(
            f"SELECT * FROM work_records {where} ORDER BY work_date DESC, id DESC",
            tuple(parameters),
        )

    def get_record(self, record_id: int) -> dict[str, Any] | None:
        rows = self._rows("SELECT * FROM work_records WHERE id=?", (record_id,))
        return rows[0] if rows else None

    def count_records(self) -> int:
        rows = self._rows("SELECT COUNT(*) AS count FROM work_records")
        return int(rows[0]["count"])

    def backup_to(self, target: str | Path) -> Path:
        target_path = Path(target)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as source:
            destination = sqlite3.connect(target_path)
            try:
                source.backup(destination)
            finally:
                destination.close()
        return target_path

    def _rows(self, sql: str, parameters: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        with self.connect() as connection:
            return [dict(row) for row in connection.execute(sql, parameters).fetchall()]

    def _execute(self, sql: str, parameters: tuple[Any, ...]) -> None:
        with self.connect() as connection:
            connection.execute(sql, parameters)

    def _insert(self, sql: str, parameters: tuple[Any, ...]) -> int:
        with self.connect() as connection:
            cursor = connection.execute(sql, parameters)
            return int(cursor.lastrowid)
