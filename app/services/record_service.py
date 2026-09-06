"""Work-record validation, snapshotting, and persistence."""

from __future__ import annotations

from datetime import date
from typing import Any

from app.database import Database
from app.services.calculator import calculate, decimal_text, ValidationError


class RecordService:
    def __init__(self, database: Database):
        self.database = database

    def save(
        self,
        *,
        work_date: str,
        person_id: int,
        project_id: int,
        rule_id: int,
        quantity: Any,
        manual_base_score: Any = None,
        remark: str = "",
        record_id: int | None = None,
    ) -> int:
        self._validate_date(work_date)
        current = self.database.get_record(record_id) if record_id is not None else None
        if record_id is not None and (not current or current["state"] != "ACTIVE"):
            raise ValidationError("只能编辑有效记录")
        person = self.database.get_person(int(person_id))
        project = self.database.get_project(int(project_id))
        rule = self.database.get_rule(int(rule_id))
        same_inactive_person = bool(current and current["person_id"] == int(person_id))
        same_inactive_project = bool(current and current["project_id"] == int(project_id))
        same_inactive_rule = bool(current and current["rule_id"] == int(rule_id))
        if not person or (not person["active"] and not same_inactive_person):
            raise ValidationError("请选择启用的人员")
        if not project or (not project["active"] and not same_inactive_project):
            raise ValidationError("请选择启用的项目")
        if (
            not rule
            or (not rule["active"] and not same_inactive_rule)
            or rule["quantity_mode"] == "DISABLED"
        ):
            raise ValidationError("请选择启用且可计算的规则")

        result = calculate(rule, quantity, manual_base_score)
        clean_remark = remark.strip()
        if result.requires_basis and not clean_remark:
            raise ValidationError("该规则需要在备注中填写人工确认依据")

        values = {
            "work_date": work_date,
            "person_id": int(person_id),
            "team_id": person.get("team_id"),
            "project_id": int(project_id),
            "rule_id": int(rule_id),
            "quantity": decimal_text(result.quantity),
            "standardized_quantity": decimal_text(result.standardized_quantity),
            "input_unit_snapshot": result.input_unit,
            "rule_code_snapshot": rule["rule_code"],
            "rule_name_snapshot": rule["display_name"],
            "module_snapshot": rule["module"],
            "category_snapshot": rule["category"],
            "subtype_snapshot": rule["subtype"],
            "unit_snapshot": result.standard_unit,
            "base_score_snapshot": decimal_text(result.base_score),
            "adjustment_factor_snapshot": decimal_text(result.adjustment_factor),
            "workload_score": decimal_text(result.workload_score),
            "person_name_snapshot": person["name"],
            "team_name_snapshot": person.get("team_name") or "",
            "project_name_snapshot": project["name"],
            "remark": clean_remark,
        }
        if record_id is None:
            return self.database.create_record(values)
        self.database.update_record(record_id, values)
        return record_id

    @staticmethod
    def _validate_date(value: str) -> None:
        try:
            date.fromisoformat(value)
        except (TypeError, ValueError) as exc:
            raise ValidationError("日期必须采用 YYYY-MM-DD 格式") from exc
