"""Tkinter desktop interface for the workload tool MVP."""

from __future__ import annotations

import sqlite3
import tkinter as tk
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from tkinter import filedialog, messagebox, simpledialog, ttk
from typing import Any, Callable

from app.database import Database
from app.i18n import tr
from app.services.calculator import ValidationError, calculate, display_decimal, parse_decimal
from app.services.export_service import ExportService
from app.services.record_service import RecordService
from app.ui.date_widgets import DatePicker, MonthPicker


MODE_LABELS = {
    "AUTO_1TO1": "实际数量直接计量",
    "AUTO_DIV100": "实际长度 ÷ 100",
    "MANUAL_STANDARDIZED": "人工确认标准化数量",
    "MANUAL_BASE_SCORE": "人工填写本次基准分",
    "LINKED_WORKLOAD": "人工填写关联工作量",
    "DISABLED": "不可计算",
}


def _active_text(value: Any) -> str:
    return "启用" if bool(value) else "停用"


class WorkloadApp(tk.Tk):
    def __init__(self, database: Database, export_directory: Path):
        super().__init__()
        self.database = database
        self.records = RecordService(database)
        self.exports = ExportService(database)
        self.export_directory = export_directory
        self.title(f"{tr('app_title')} V0.1")
        self.geometry("1180x760")
        self.minsize(1000, 680)
        self._configure_style()

        title = ttk.Label(self, text=tr("app_title"), style="Title.TLabel")
        title.pack(anchor="w", padx=20, pady=(14, 6))
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill="both", expand=True, padx=16, pady=(0, 12))

        self.entry_page = EntryPage(self.notebook, self)
        self.history_page = HistoryPage(self.notebook, self)
        self.export_page = ExportPage(self.notebook, self)
        self.settings_page = SettingsPage(self.notebook, self)
        self.notebook.add(self.entry_page, text=tr("entry"))
        self.notebook.add(self.history_page, text=tr("history"))
        self.notebook.add(self.export_page, text=tr("export"))
        self.notebook.add(self.settings_page, text=tr("settings"))

        self.status_var = tk.StringVar(value=f"数据库：{self.database.path}")
        ttk.Label(self, textvariable=self.status_var, style="Status.TLabel").pack(
            fill="x", padx=16, pady=(0, 8)
        )
        self.refresh_all()

    def _configure_style(self) -> None:
        style = ttk.Style(self)
        if "vista" in style.theme_names():
            style.theme_use("vista")
        style.configure(".", font=("Microsoft YaHei UI", 10))
        style.configure("Title.TLabel", font=("Microsoft YaHei UI", 18, "bold"))
        style.configure("Section.TLabel", font=("Microsoft YaHei UI", 11, "bold"))
        style.configure("Score.TLabel", font=("Microsoft YaHei UI", 13, "bold"), foreground="#1F4E78")
        style.configure("Hint.TLabel", foreground="#666666")
        style.configure("Success.TLabel", foreground="#167D32")
        style.configure("Error.TLabel", foreground="#B42318")
        style.configure("Status.TLabel", foreground="#666666", font=("Microsoft YaHei UI", 9))
        style.configure("Treeview", rowheight=28)
        style.configure("Treeview.Heading", font=("Microsoft YaHei UI", 10, "bold"))

    def refresh_all(self) -> None:
        self.entry_page.refresh_data()
        self.history_page.refresh_filters()
        self.history_page.refresh_records()
        self.settings_page.refresh_all()

    def set_status(self, text: str) -> None:
        self.status_var.set(text)


class EntryPage(ttk.Frame):
    def __init__(self, parent: Any, app: WorkloadApp):
        super().__init__(parent, padding=18)
        self.app = app
        self.person_map: dict[str, int] = {}
        self.project_map: dict[str, int] = {}
        self.rules: list[dict[str, Any]] = []
        self.rule_by_subtype: dict[str, dict[str, Any]] = {}
        self.current_rule: dict[str, Any] | None = None

        self.columnconfigure(1, weight=1)
        self.columnconfigure(3, weight=1)
        self.date_var = tk.StringVar(value=date.today().isoformat())
        self.person_var = tk.StringVar()
        self.project_var = tk.StringVar()
        self.module_var = tk.StringVar()
        self.category_var = tk.StringVar()
        self.subtype_var = tk.StringVar()
        self.quantity_var = tk.StringVar()
        self.base_var = tk.StringVar()
        self.rule_code_var = tk.StringVar(value="—")
        self.standard_var = tk.StringVar(value="—")
        self.score_var = tk.StringVar(value="—")
        self.rule_hint_var = tk.StringVar()
        self.result_status_var = tk.StringVar()

        self._field(0, "工作日期", DatePicker(self, self.date_var, width=14), 0)
        self.person_combo = ttk.Combobox(self, textvariable=self.person_var, state="readonly", width=32)
        self._field(0, "人员", self.person_combo, 2)
        self.project_combo = ttk.Combobox(self, textvariable=self.project_var, state="readonly", width=32)
        self._field(1, "项目", self.project_combo, 0)
        self.module_combo = ttk.Combobox(self, textvariable=self.module_var, state="readonly", width=32)
        self._field(1, "工作模块", self.module_combo, 2)
        self.category_combo = ttk.Combobox(self, textvariable=self.category_var, state="readonly", width=32)
        self._field(2, "工作类别", self.category_combo, 0)
        self.subtype_combo = ttk.Combobox(self, textvariable=self.subtype_var, state="readonly", width=32)
        self._field(2, "具体规则 / 子类型", self.subtype_combo, 2)

        self.quantity_label = ttk.Label(self, text="数量")
        self.quantity_label.grid(row=3, column=0, sticky="e", padx=(0, 8), pady=8)
        quantity_box = ttk.Frame(self)
        quantity_box.grid(row=3, column=1, sticky="ew", pady=8)
        quantity_box.columnconfigure(0, weight=1)
        self.quantity_entry = ttk.Entry(quantity_box, textvariable=self.quantity_var)
        self.quantity_entry.grid(row=0, column=0, sticky="ew")
        self.input_unit_label = ttk.Label(quantity_box, text="")
        self.input_unit_label.grid(row=0, column=1, padx=(8, 0))

        self.manual_base_label = ttk.Label(self, text="本次基准分")
        self.manual_base_label.grid(row=3, column=2, sticky="e", padx=(12, 8), pady=8)
        self.manual_base_entry = ttk.Entry(self, textvariable=self.base_var)
        self.manual_base_entry.grid(row=3, column=3, sticky="ew", pady=8)
        self.manual_base_entry.configure(state="disabled")

        info = ttk.LabelFrame(self, text="自动计算", padding=12)
        info.grid(row=4, column=0, columnspan=4, sticky="ew", pady=(12, 8))
        for index in range(6):
            info.columnconfigure(index, weight=1 if index in {1, 3, 5} else 0)
        ttk.Label(info, text="规则 ID").grid(row=0, column=0, sticky="w")
        ttk.Label(info, textvariable=self.rule_code_var, style="Section.TLabel").grid(row=0, column=1, sticky="w", padx=(8, 20))
        ttk.Label(info, text="标准化数量").grid(row=0, column=2, sticky="w")
        ttk.Label(info, textvariable=self.standard_var, style="Section.TLabel").grid(row=0, column=3, sticky="w", padx=(8, 20))
        ttk.Label(info, text="工作量").grid(row=0, column=4, sticky="w")
        ttk.Label(info, textvariable=self.score_var, style="Score.TLabel").grid(row=0, column=5, sticky="w", padx=(8, 0))
        ttk.Label(info, textvariable=self.rule_hint_var, style="Hint.TLabel", wraplength=1000).grid(
            row=1, column=0, columnspan=6, sticky="w", pady=(10, 0)
        )

        ttk.Label(self, text="备注 / 人工确认依据").grid(row=5, column=0, sticky="ne", padx=(0, 8), pady=8)
        self.remark = tk.Text(self, height=4, wrap="word", font=("Microsoft YaHei UI", 10))
        self.remark.grid(row=5, column=1, columnspan=3, sticky="nsew", pady=8)
        self.rowconfigure(5, weight=1)

        actions = ttk.Frame(self)
        actions.grid(row=6, column=0, columnspan=4, sticky="ew", pady=(12, 0))
        ttk.Button(actions, text="添加记录", command=self.save_record).pack(side="left")
        ttk.Button(actions, text="清空本条", command=self.clear_current).pack(side="left", padx=8)
        self.result_status_label = ttk.Label(actions, textvariable=self.result_status_var)
        self.result_status_label.pack(side="left", padx=12)

        self.module_combo.bind("<<ComboboxSelected>>", self._module_changed)
        self.category_combo.bind("<<ComboboxSelected>>", self._category_changed)
        self.subtype_combo.bind("<<ComboboxSelected>>", self._rule_changed)
        self.quantity_var.trace_add("write", lambda *_: self.update_preview())
        self.base_var.trace_add("write", lambda *_: self.update_preview())

    def _field(self, row: int, label: str, widget: Any, column: int) -> None:
        ttk.Label(self, text=label).grid(row=row, column=column, sticky="e", padx=(0, 8), pady=8)
        widget.grid(row=row, column=column + 1, sticky="ew", pady=8)

    def refresh_data(self) -> None:
        persons = self.app.database.list_persons(active_only=True)
        projects = self.app.database.list_projects(active_only=True)
        self.rules = self.app.database.list_rules(active_only=True)
        old_person, old_project = self.person_var.get(), self.project_var.get()
        self.person_map = {row["name"]: row["id"] for row in persons}
        self.project_map = {row["name"]: row["id"] for row in projects}
        self.person_combo["values"] = list(self.person_map)
        self.project_combo["values"] = list(self.project_map)
        modules = list(dict.fromkeys(row["module"] for row in self.rules))
        self.module_combo["values"] = modules
        if old_person in self.person_map:
            self.person_var.set(old_person)
        elif persons:
            self.person_var.set(persons[0]["name"])
        if old_project in self.project_map:
            self.project_var.set(old_project)
        elif projects:
            self.project_var.set(projects[0]["name"])
        if self.module_var.get() not in modules:
            self.module_var.set(modules[0] if modules else "")
        self._module_changed()

    def _module_changed(self, _event: Any = None) -> None:
        categories = list(
            dict.fromkeys(row["category"] for row in self.rules if row["module"] == self.module_var.get())
        )
        self.category_combo["values"] = categories
        if self.category_var.get() not in categories:
            self.category_var.set(categories[0] if categories else "")
        self._category_changed()

    def _category_changed(self, _event: Any = None) -> None:
        candidates = [
            row for row in self.rules
            if row["module"] == self.module_var.get() and row["category"] == self.category_var.get()
        ]
        self.rule_by_subtype = {row["subtype"]: row for row in candidates}
        values = list(self.rule_by_subtype)
        self.subtype_combo["values"] = values
        if self.subtype_var.get() not in values:
            self.subtype_var.set(values[0] if values else "")
        self._rule_changed()

    def _rule_changed(self, _event: Any = None) -> None:
        self.current_rule = self.rule_by_subtype.get(self.subtype_var.get())
        rule = self.current_rule
        if not rule:
            self.rule_code_var.set("—")
            return
        self.rule_code_var.set(rule["rule_code"])
        self.quantity_label.configure(text=rule["input_label"] or "数量")
        self.input_unit_label.configure(text=rule["input_unit"] or "")
        manual = rule["quantity_mode"] == "MANUAL_BASE_SCORE"
        self.manual_base_entry.configure(state="normal" if manual else "disabled")
        if not manual:
            self.base_var.set("")
        base = rule["base_score"] if rule["base_score"] not in {None, ""} else "人工填写"
        hint = f"基准分：{base}；计量方式：{MODE_LABELS.get(rule['quantity_mode'], rule['quantity_mode'])}"
        if rule["remark"]:
            hint += f"。{rule['remark']}"
        self.rule_hint_var.set(hint)
        self.update_preview()

    def update_preview(self) -> None:
        if not self.current_rule or not self.quantity_var.get().strip():
            self.standard_var.set("—")
            self.score_var.set("—")
            return
        try:
            result = calculate(self.current_rule, self.quantity_var.get(), self.base_var.get())
            self.standard_var.set(
                f"{display_decimal(result.standardized_quantity)} {result.standard_unit}".strip()
            )
            self.score_var.set(display_decimal(result.workload_score))
        except ValidationError:
            self.standard_var.set("—")
            self.score_var.set("—")

    def save_record(self) -> None:
        try:
            if not self.current_rule:
                raise ValidationError("请选择具体规则")
            person_id = self.person_map.get(self.person_var.get())
            project_id = self.project_map.get(self.project_var.get())
            if not person_id:
                raise ValidationError("请选择人员")
            if not project_id:
                raise ValidationError("请选择项目")
            record_id = self.app.records.save(
                work_date=self.date_var.get().strip(),
                person_id=person_id,
                project_id=project_id,
                rule_id=self.current_rule["id"],
                quantity=self.quantity_var.get(),
                manual_base_score=self.base_var.get(),
                remark=self.remark.get("1.0", "end").strip(),
            )
        except (ValidationError, sqlite3.Error) as exc:
            self.result_status_var.set(str(exc))
            self.result_status_var_label_style("Error.TLabel")
            return
        self.result_status_var.set(f"已保存记录 #{record_id}，可继续录入")
        self.result_status_var_label_style("Success.TLabel")
        self.clear_current(keep_context=True)
        self.app.history_page.refresh_records()
        self.app.set_status(f"记录 #{record_id} 已写入 SQLite")

    def result_status_var_label_style(self, style: str) -> None:
        self.result_status_label.configure(style=style)

    def clear_current(self, keep_context: bool = False) -> None:
        self.quantity_var.set("")
        self.base_var.set("")
        self.remark.delete("1.0", "end")
        if not keep_context:
            self.result_status_var.set("")
        self.quantity_entry.focus_set()


class HistoryPage(ttk.Frame):
    def __init__(self, parent: Any, app: WorkloadApp):
        super().__init__(parent, padding=14)
        self.app = app
        self.person_map: dict[str, int | None] = {"全部": None}
        self.project_map: dict[str, int | None] = {"全部": None}
        self.date_from_var = tk.StringVar()
        self.date_to_var = tk.StringVar()
        self.person_var = tk.StringVar(value="全部")
        self.project_var = tk.StringVar(value="全部")
        self.module_var = tk.StringVar(value="全部")
        self.include_void_var = tk.BooleanVar(value=False)
        self.columnconfigure(0, weight=1)
        self.rowconfigure(1, weight=1)

        filters = ttk.Frame(self)
        filters.grid(row=0, column=0, sticky="ew", pady=(0, 10))
        for label, variable in [
            ("开始日期", self.date_from_var), ("结束日期", self.date_to_var)
        ]:
            ttk.Label(filters, text=label).pack(side="left")
            DatePicker(filters, variable, width=10, allow_clear=True).pack(side="left", padx=(5, 12))
        ttk.Label(filters, text="人员").pack(side="left")
        self.person_combo = ttk.Combobox(filters, textvariable=self.person_var, state="readonly", width=16)
        self.person_combo.pack(side="left", padx=(5, 12))
        ttk.Label(filters, text="项目").pack(side="left")
        self.project_combo = ttk.Combobox(filters, textvariable=self.project_var, state="readonly", width=16)
        self.project_combo.pack(side="left", padx=(5, 12))
        ttk.Label(filters, text="模块").pack(side="left")
        self.module_combo = ttk.Combobox(filters, textvariable=self.module_var, state="readonly", width=16)
        self.module_combo.pack(side="left", padx=(5, 12))
        ttk.Checkbutton(filters, text="含作废", variable=self.include_void_var).pack(side="left")
        ttk.Button(filters, text="查询", command=self.refresh_records).pack(side="right")

        table = ttk.Frame(self)
        table.grid(row=1, column=0, sticky="nsew")
        table.columnconfigure(0, weight=1)
        table.rowconfigure(0, weight=1)
        columns = ("id", "date", "person", "team", "project", "work", "quantity", "score", "state")
        self.tree = ttk.Treeview(table, columns=columns, show="headings", selectmode="browse")
        headings = {
            "id": "ID", "date": "日期", "person": "人员", "team": "小组", "project": "项目",
            "work": "工作内容", "quantity": "数量", "score": "工作量", "state": "状态",
        }
        widths = {"id": 55, "date": 95, "person": 105, "team": 105, "project": 115, "work": 240, "quantity": 110, "score": 85, "state": 70}
        for column in columns:
            self.tree.heading(column, text=headings[column])
            self.tree.column(column, width=widths[column], anchor="center" if column not in {"work"} else "w")
        scroll_y = ttk.Scrollbar(table, orient="vertical", command=self.tree.yview)
        scroll_x = ttk.Scrollbar(table, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=scroll_y.set, xscrollcommand=scroll_x.set)
        self.tree.grid(row=0, column=0, sticky="nsew")
        scroll_y.grid(row=0, column=1, sticky="ns")
        scroll_x.grid(row=1, column=0, sticky="ew")

        actions = ttk.Frame(self)
        actions.grid(row=2, column=0, sticky="ew", pady=(10, 0))
        ttk.Button(actions, text="编辑选中", command=self.edit_selected).pack(side="left")
        ttk.Button(actions, text="作废选中", command=self.void_selected).pack(side="left", padx=8)
        self.summary_var = tk.StringVar()
        ttk.Label(actions, textvariable=self.summary_var).pack(side="right")

    def refresh_filters(self) -> None:
        persons = self.app.database.list_persons()
        projects = self.app.database.list_projects()
        self.person_map = {"全部": None, **{row["name"]: row["id"] for row in persons}}
        self.project_map = {"全部": None, **{row["name"]: row["id"] for row in projects}}
        self.person_combo["values"] = list(self.person_map)
        self.project_combo["values"] = list(self.project_map)
        modules = list(dict.fromkeys(row["module"] for row in self.app.database.list_rules()))
        self.module_combo["values"] = ["全部", *modules]
        if self.person_var.get() not in self.person_map:
            self.person_var.set("全部")
        if self.project_var.get() not in self.project_map:
            self.project_var.set("全部")

    def refresh_records(self) -> None:
        for item in self.tree.get_children():
            self.tree.delete(item)
        module = self.module_var.get()
        rows = self.app.database.list_records(
            date_from=self.date_from_var.get().strip() or None,
            date_to=self.date_to_var.get().strip() or None,
            person_id=self.person_map.get(self.person_var.get()),
            project_id=self.project_map.get(self.project_var.get()),
            module=None if module in {"", "全部"} else module,
            include_void=self.include_void_var.get(),
        )
        total = Decimal("0")
        for row in rows:
            if row["state"] == "ACTIVE":
                total += Decimal(str(row["workload_score"]))
            quantity = f"{display_decimal(row['quantity'])} {row['input_unit_snapshot']}"
            self.tree.insert(
                "", "end", iid=str(row["id"]),
                values=(row["id"], row["work_date"], row["person_name_snapshot"], row["team_name_snapshot"],
                        row["project_name_snapshot"], row["rule_name_snapshot"], quantity,
                        display_decimal(row["workload_score"]), "有效" if row["state"] == "ACTIVE" else "已作废"),
            )
        self.summary_var.set(f"{len(rows)} 条；有效工作量 {display_decimal(total)}")

    def _selected_id(self) -> int | None:
        selection = self.tree.selection()
        return int(selection[0]) if selection else None

    def edit_selected(self) -> None:
        record_id = self._selected_id()
        if record_id is None:
            messagebox.showinfo("提示", "请先选择一条记录", parent=self)
            return
        record = self.app.database.get_record(record_id)
        if not record or record["state"] != "ACTIVE":
            messagebox.showinfo("提示", "只能编辑有效记录", parent=self)
            return
        dialog = RecordEditDialog(self, self.app, record)
        self.wait_window(dialog)
        if dialog.saved:
            self.refresh_records()

    def void_selected(self) -> None:
        record_id = self._selected_id()
        if record_id is None:
            messagebox.showinfo("提示", "请先选择一条记录", parent=self)
            return
        record = self.app.database.get_record(record_id)
        if not record or record["state"] != "ACTIVE":
            messagebox.showinfo("提示", "该记录已经作废", parent=self)
            return
        reason = simpledialog.askstring("作废记录", "请输入作废原因：", parent=self)
        if reason is None:
            return
        if not reason.strip():
            messagebox.showerror("无法作废", "必须填写作废原因", parent=self)
            return
        if not messagebox.askyesno("确认作废", f"确认作废记录 #{record_id}？\n该操作会从汇总中排除该记录。", parent=self):
            return
        self.app.database.void_record(record_id, reason)
        self.refresh_records()
        self.app.set_status(f"记录 #{record_id} 已作废；数据仍保留在数据库中")


class RecordEditDialog(tk.Toplevel):
    def __init__(self, parent: Any, app: WorkloadApp, record: dict[str, Any]):
        super().__init__(parent)
        self.app = app
        self.record = record
        self.saved = False
        self.title(f"编辑记录 #{record['id']}")
        self.transient(parent)
        self.grab_set()
        self.resizable(False, False)
        body = ttk.Frame(self, padding=16)
        body.pack(fill="both", expand=True)

        persons = app.database.list_persons(active_only=True)
        projects = app.database.list_projects(active_only=True)
        rules = app.database.list_rules(active_only=True)
        current_person = app.database.get_person(record["person_id"])
        current_project = app.database.get_project(record["project_id"])
        current_rule = app.database.get_rule(record["rule_id"])
        if current_person and all(row["id"] != current_person["id"] for row in persons):
            persons.append(current_person)
        if current_project and all(row["id"] != current_project["id"] for row in projects):
            projects.append(current_project)
        if current_rule and all(row["id"] != current_rule["id"] for row in rules):
            rules.append(current_rule)
        self.person_map = {row["name"]: row["id"] for row in persons}
        self.project_map = {row["name"]: row["id"] for row in projects}
        self.rule_map = {f"{row['rule_code']}  {row['display_name']}": row for row in rules}
        current_rule_label = next((label for label, row in self.rule_map.items() if row["id"] == record["rule_id"]), "")

        self.date_var = tk.StringVar(value=record["work_date"])
        self.person_var = tk.StringVar(value=record["person_name_snapshot"])
        self.project_var = tk.StringVar(value=record["project_name_snapshot"])
        self.rule_var = tk.StringVar(value=current_rule_label)
        self.quantity_var = tk.StringVar(value=record["quantity"])
        self.base_var = tk.StringVar(value=record["base_score_snapshot"])
        self.remark_var = tk.StringVar(value=record["remark"])
        fields = [
            ("日期", DatePicker(body, self.date_var, width=38)),
            ("人员", ttk.Combobox(body, textvariable=self.person_var, values=list(self.person_map), state="readonly", width=45)),
            ("项目", ttk.Combobox(body, textvariable=self.project_var, values=list(self.project_map), state="readonly", width=45)),
            ("规则", ttk.Combobox(body, textvariable=self.rule_var, values=list(self.rule_map), state="readonly", width=45)),
            ("数量", ttk.Entry(body, textvariable=self.quantity_var, width=48)),
            ("本次基准分", ttk.Entry(body, textvariable=self.base_var, width=48)),
            ("备注 / 依据", ttk.Entry(body, textvariable=self.remark_var, width=48)),
        ]
        for row_index, (label, widget) in enumerate(fields):
            ttk.Label(body, text=label).grid(row=row_index, column=0, sticky="e", padx=(0, 8), pady=6)
            widget.grid(row=row_index, column=1, sticky="ew", pady=6)
        actions = ttk.Frame(body)
        actions.grid(row=len(fields), column=0, columnspan=2, sticky="e", pady=(14, 0))
        ttk.Button(actions, text="取消", command=self.destroy).pack(side="right")
        ttk.Button(actions, text="保存修改", command=self._save).pack(side="right", padx=8)

    def _save(self) -> None:
        rule = self.rule_map.get(self.rule_var.get())
        if not rule:
            messagebox.showerror("无法保存", "请选择规则", parent=self)
            return
        manual_base = self.base_var.get() if rule["quantity_mode"] == "MANUAL_BASE_SCORE" else None
        if not messagebox.askyesno(
            "确认修改",
            "修改规则或数量会按当前规则重新生成快照和工作量。确认保存吗？",
            parent=self,
        ):
            return
        try:
            self.app.records.save(
                record_id=self.record["id"], work_date=self.date_var.get().strip(),
                person_id=self.person_map[self.person_var.get()],
                project_id=self.project_map[self.project_var.get()], rule_id=rule["id"],
                quantity=self.quantity_var.get(), manual_base_score=manual_base,
                remark=self.remark_var.get(),
            )
        except (ValidationError, sqlite3.Error, KeyError) as exc:
            messagebox.showerror("无法保存", str(exc), parent=self)
            return
        self.saved = True
        self.app.set_status(f"记录 #{self.record['id']} 已按当前规则更新快照")
        self.destroy()


class ExportPage(ttk.Frame):
    def __init__(self, parent: Any, app: WorkloadApp):
        super().__init__(parent, padding=24)
        self.app = app
        today = date.today()
        self.day_var = tk.StringVar(value=today.isoformat())
        self.month_var = tk.StringVar(value=today.strftime("%Y-%m"))
        self.columnconfigure(1, weight=1)
        ttk.Label(self, text="按日期导出", style="Section.TLabel").grid(row=0, column=0, columnspan=3, sticky="w")
        ttk.Label(self, text="日期").grid(row=1, column=0, sticky="e", padx=(0, 8), pady=12)
        DatePicker(self, self.day_var, width=14).grid(row=1, column=1, sticky="w")
        ttk.Button(self, text="导出每日明细 Excel", command=self.export_day).grid(row=1, column=2, sticky="w")
        ttk.Separator(self).grid(row=2, column=0, columnspan=3, sticky="ew", pady=16)
        ttk.Label(self, text="按月份导出", style="Section.TLabel").grid(row=3, column=0, columnspan=3, sticky="w")
        ttk.Label(self, text="月份").grid(row=4, column=0, sticky="e", padx=(0, 8), pady=12)
        MonthPicker(self, self.month_var).grid(row=4, column=1, sticky="w")
        month_actions = ttk.Frame(self)
        month_actions.grid(row=4, column=2, sticky="w")
        ttk.Button(month_actions, text="导出月度 Excel", command=self.export_month).pack(side="left")
        ttk.Button(month_actions, text="导出 AI 数据", command=self.export_ai).pack(side="left", padx=8)
        ttk.Label(
            self,
            text="所有导出均从 SQLite 当前有效记录生成。Excel 仅用于查看和提交。",
            style="Hint.TLabel",
        ).grid(row=5, column=0, columnspan=3, sticky="w", pady=(16, 0))

    def export_day(self) -> None:
        default = f"工作量记录_{self.day_var.get().strip()}.xlsx"
        path = filedialog.asksaveasfilename(
            parent=self, initialdir=self.app.export_directory, initialfile=default,
            defaultextension=".xlsx", filetypes=[("Excel 工作簿", "*.xlsx")]
        )
        if not path:
            return
        try:
            self.app.exports.export_day(self.day_var.get().strip(), path)
        except Exception as exc:
            messagebox.showerror("导出失败", str(exc), parent=self)
            return
        messagebox.showinfo("导出完成", f"文件已保存：\n{path}", parent=self)

    def export_month(self) -> None:
        default = f"工作量汇总_{self.month_var.get().strip()}.xlsx"
        path = filedialog.asksaveasfilename(
            parent=self, initialdir=self.app.export_directory, initialfile=default,
            defaultextension=".xlsx", filetypes=[("Excel 工作簿", "*.xlsx")]
        )
        if not path:
            return
        try:
            self.app.exports.export_month(self.month_var.get().strip(), path)
        except Exception as exc:
            messagebox.showerror("导出失败", str(exc), parent=self)
            return
        messagebox.showinfo("导出完成", f"文件已保存：\n{path}", parent=self)

    def export_ai(self) -> None:
        directory = filedialog.askdirectory(parent=self, initialdir=self.app.export_directory)
        if not directory:
            return
        try:
            target = self.app.exports.export_ai(self.month_var.get().strip(), directory)
        except Exception as exc:
            messagebox.showerror("导出失败", str(exc), parent=self)
            return
        messagebox.showinfo("导出完成", f"结构化数据已保存：\n{target}", parent=self)


class SettingsPage(ttk.Frame):
    def __init__(self, parent: Any, app: WorkloadApp):
        super().__init__(parent, padding=10)
        self.app = app
        top = ttk.Frame(self)
        top.pack(fill="x", pady=(0, 8))
        ttk.Label(top, text="基础字典修改只影响新记录；历史记录使用保存时快照。", style="Hint.TLabel").pack(side="left")
        ttk.Button(top, text="备份数据库", command=self.backup_database).pack(side="right")
        self.tabs = ttk.Notebook(self)
        self.tabs.pack(fill="both", expand=True)
        self.team_tab = MasterDataTab(self.tabs, app, "teams")
        self.person_tab = MasterDataTab(self.tabs, app, "persons")
        self.project_tab = MasterDataTab(self.tabs, app, "projects")
        self.rule_tab = RuleDataTab(self.tabs, app)
        self.tabs.add(self.person_tab, text="人员管理")
        self.tabs.add(self.team_tab, text="小组管理")
        self.tabs.add(self.project_tab, text="项目管理")
        self.tabs.add(self.rule_tab, text="定额规则管理")

    def refresh_all(self) -> None:
        self.team_tab.refresh()
        self.person_tab.refresh()
        self.project_tab.refresh()
        self.rule_tab.refresh()

    def backup_database(self) -> None:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = filedialog.asksaveasfilename(
            parent=self, initialfile=f"workload_backup_{stamp}.db",
            defaultextension=".db", filetypes=[("SQLite 数据库", "*.db")]
        )
        if not path:
            return
        try:
            self.app.database.backup_to(path)
        except Exception as exc:
            messagebox.showerror("备份失败", str(exc), parent=self)
            return
        messagebox.showinfo("备份完成", f"数据库已备份：\n{path}", parent=self)


class MasterDataTab(ttk.Frame):
    def __init__(self, parent: Any, app: WorkloadApp, kind: str):
        super().__init__(parent, padding=10)
        self.app = app
        self.kind = kind
        configs = {
            "teams": (("id", "code", "name", "leader", "active", "remark"), ("ID", "编码", "小组名称", "负责人", "状态", "备注")),
            "persons": (("id", "name", "team", "active", "remark"), ("ID", "姓名", "小组", "状态", "备注")),
            "projects": (("id", "code", "name", "active", "remark"), ("ID", "项目编码", "项目名称", "状态", "备注")),
        }
        columns, headings = configs[kind]
        self.tree = ttk.Treeview(self, columns=columns, show="headings", selectmode="browse")
        for column, heading in zip(columns, headings):
            self.tree.heading(column, text=heading)
            self.tree.column(column, width=70 if column in {"id", "active"} else 160, anchor="center" if column in {"id", "active"} else "w")
        self.tree.pack(fill="both", expand=True)
        actions = ttk.Frame(self)
        actions.pack(fill="x", pady=(8, 0))
        ttk.Button(actions, text="新增", command=self.add).pack(side="left")
        ttk.Button(actions, text="编辑", command=self.edit).pack(side="left", padx=6)
        ttk.Button(actions, text="启用", command=lambda: self.set_active(True)).pack(side="left", padx=6)
        ttk.Button(actions, text="停用", command=lambda: self.set_active(False)).pack(side="left")

    def refresh(self) -> None:
        for item in self.tree.get_children():
            self.tree.delete(item)
        if self.kind == "teams":
            rows = self.app.database.list_teams()
            value_fn = lambda r: (r["id"], r["code"], r["name"], r["leader_name"], _active_text(r["active"]), r["remark"])
        elif self.kind == "persons":
            rows = self.app.database.list_persons()
            value_fn = lambda r: (r["id"], r["name"], r["team_name"] or "未分组", _active_text(r["active"]), r["remark"])
        else:
            rows = self.app.database.list_projects()
            value_fn = lambda r: (r["id"], r["code"], r["name"], _active_text(r["active"]), r["remark"])
        for row in rows:
            self.tree.insert("", "end", iid=str(row["id"]), values=value_fn(row))

    def _selected(self) -> int | None:
        selection = self.tree.selection()
        return int(selection[0]) if selection else None

    def add(self) -> None:
        self._open_dialog(None)

    def edit(self) -> None:
        item_id = self._selected()
        if item_id is None:
            messagebox.showinfo("提示", "请先选择一项", parent=self)
            return
        self._open_dialog(item_id)

    def _open_dialog(self, item_id: int | None) -> None:
        dialog = MasterEditDialog(self, self.app, self.kind, item_id)
        self.wait_window(dialog)
        if dialog.saved:
            self.app.refresh_all()

    def set_active(self, active: bool) -> None:
        item_id = self._selected()
        if item_id is None:
            messagebox.showinfo("提示", "请先选择一项", parent=self)
            return
        if not active and not messagebox.askyesno("确认停用", "停用后不会出现在新记录下拉框中，历史记录不受影响。继续吗？", parent=self):
            return
        self.app.database.set_active(self.kind, item_id, active)
        self.app.refresh_all()


class MasterEditDialog(tk.Toplevel):
    def __init__(self, parent: Any, app: WorkloadApp, kind: str, item_id: int | None):
        super().__init__(parent)
        self.app, self.kind, self.item_id = app, kind, item_id
        self.saved = False
        self.title("新增" if item_id is None else "编辑")
        self.transient(parent)
        self.grab_set()
        body = ttk.Frame(self, padding=16)
        body.pack(fill="both", expand=True)
        self.vars: dict[str, tk.StringVar] = {}
        self.team_map: dict[str, int | None] = {"未分组": None}

        existing: dict[str, Any] = {}
        if item_id is not None:
            rows = {
                "teams": app.database.list_teams,
                "persons": app.database.list_persons,
                "projects": app.database.list_projects,
            }[kind]()
            existing = next(row for row in rows if row["id"] == item_id)

        specs: list[tuple[str, str, str, list[str] | None]]
        if kind == "teams":
            specs = [("code", "小组编码", "entry", None), ("name", "小组名称", "entry", None),
                     ("leader_name", "负责人", "entry", None), ("remark", "备注", "entry", None)]
        elif kind == "projects":
            specs = [("code", "项目编码", "entry", None), ("name", "项目名称", "entry", None),
                     ("remark", "备注", "entry", None)]
        else:
            teams = app.database.list_teams(active_only=True)
            self.team_map.update({row["name"]: row["id"] for row in teams})
            specs = [("name", "姓名", "entry", None), ("team_name", "小组", "combo", list(self.team_map)),
                     ("remark", "备注", "entry", None)]
        for row_index, (key, label, field_type, values) in enumerate(specs):
            default = existing.get(key, "") or ("未分组" if key == "team_name" else "")
            variable = tk.StringVar(value=str(default))
            self.vars[key] = variable
            ttk.Label(body, text=label).grid(row=row_index, column=0, sticky="e", padx=(0, 8), pady=6)
            if field_type == "combo":
                widget = ttk.Combobox(body, textvariable=variable, values=values, state="readonly", width=32)
            else:
                widget = ttk.Entry(body, textvariable=variable, width=35)
            widget.grid(row=row_index, column=1, sticky="ew", pady=6)
        actions = ttk.Frame(body)
        actions.grid(row=len(specs), column=0, columnspan=2, sticky="e", pady=(12, 0))
        ttk.Button(actions, text="取消", command=self.destroy).pack(side="right")
        ttk.Button(actions, text="保存", command=self._save).pack(side="right", padx=8)

    def _save(self) -> None:
        values = {key: variable.get().strip() for key, variable in self.vars.items()}
        if not values.get("name"):
            messagebox.showerror("无法保存", "名称不能为空", parent=self)
            return
        try:
            if self.kind == "teams":
                if not values.get("code"):
                    raise ValueError("小组编码不能为空")
                if self.item_id is None:
                    self.app.database.add_team(values["code"], values["name"], values["leader_name"], values["remark"])
                else:
                    self.app.database.update_team(self.item_id, values["code"], values["name"], values["leader_name"], values["remark"])
            elif self.kind == "projects":
                if not values.get("code"):
                    raise ValueError("项目编码不能为空")
                if self.item_id is None:
                    self.app.database.add_project(values["code"], values["name"], values["remark"])
                else:
                    self.app.database.update_project(self.item_id, values["code"], values["name"], values["remark"])
            else:
                team_id = self.team_map.get(values.get("team_name", "未分组"))
                if self.item_id is None:
                    self.app.database.add_person(values["name"], team_id, values["remark"])
                else:
                    self.app.database.update_person(self.item_id, values["name"], team_id, values["remark"])
        except (sqlite3.Error, ValueError) as exc:
            messagebox.showerror("无法保存", str(exc), parent=self)
            return
        self.saved = True
        self.destroy()


class RuleDataTab(ttk.Frame):
    def __init__(self, parent: Any, app: WorkloadApp):
        super().__init__(parent, padding=10)
        self.app = app
        columns = ("id", "code", "module", "category", "subtype", "unit", "base", "mode", "active")
        self.tree = ttk.Treeview(self, columns=columns, show="headings", selectmode="browse")
        headings = ("ID", "规则ID", "模块", "工作类别", "子类型", "单位", "基准分", "计算方式", "状态")
        widths = (45, 95, 130, 125, 175, 90, 80, 170, 65)
        for column, heading, width in zip(columns, headings, widths):
            self.tree.heading(column, text=heading)
            self.tree.column(column, width=width, anchor="center" if column not in {"subtype"} else "w")
        self.tree.pack(fill="both", expand=True)
        actions = ttk.Frame(self)
        actions.pack(fill="x", pady=(8, 0))
        ttk.Button(actions, text="新增", command=lambda: self.open_dialog(None)).pack(side="left")
        ttk.Button(actions, text="编辑", command=self.edit).pack(side="left", padx=6)
        ttk.Button(actions, text="启用", command=lambda: self.set_active(True)).pack(side="left", padx=6)
        ttk.Button(actions, text="停用", command=lambda: self.set_active(False)).pack(side="left")

    def refresh(self) -> None:
        for item in self.tree.get_children():
            self.tree.delete(item)
        for row in self.app.database.list_rules():
            self.tree.insert("", "end", iid=str(row["id"]), values=(
                row["id"], row["rule_code"], row["module"], row["category"], row["subtype"], row["unit"],
                row["base_score"] or "人工", MODE_LABELS.get(row["quantity_mode"], row["quantity_mode"]), _active_text(row["active"]),
            ))

    def selected(self) -> int | None:
        selection = self.tree.selection()
        return int(selection[0]) if selection else None

    def edit(self) -> None:
        item_id = self.selected()
        if item_id is None:
            messagebox.showinfo("提示", "请先选择一条规则", parent=self)
            return
        self.open_dialog(item_id)

    def open_dialog(self, item_id: int | None) -> None:
        dialog = RuleEditDialog(self, self.app, item_id)
        self.wait_window(dialog)
        if dialog.saved:
            self.app.refresh_all()

    def set_active(self, active: bool) -> None:
        item_id = self.selected()
        if item_id is None:
            messagebox.showinfo("提示", "请先选择一条规则", parent=self)
            return
        if not active and not messagebox.askyesno("确认停用", "停用后新记录不能再选择该规则，历史快照不受影响。继续吗？", parent=self):
            return
        self.app.database.set_active("quota_rules", item_id, active)
        self.app.refresh_all()


class RuleEditDialog(tk.Toplevel):
    def __init__(self, parent: Any, app: WorkloadApp, item_id: int | None):
        super().__init__(parent)
        self.app, self.item_id = app, item_id
        self.saved = False
        self.title("新增定额规则" if item_id is None else "编辑定额规则")
        self.transient(parent)
        self.grab_set()
        row = app.database.get_rule(item_id) if item_id else {}
        row = row or {}
        body = ttk.Frame(self, padding=16)
        body.pack(fill="both", expand=True)
        self.vars: dict[str, tk.StringVar] = {}
        specs = [
            ("rule_code", "规则 ID"), ("module", "模块"), ("category", "工作类别"),
            ("subtype", "子类型"), ("display_name", "显示名称"), ("input_label", "输入字段名"),
            ("input_unit", "实际输入单位"), ("unit", "定额单位"), ("base_score", "基准分"),
        ]
        for row_index, (key, label) in enumerate(specs):
            variable = tk.StringVar(value=str(row.get(key) or ""))
            self.vars[key] = variable
            ttk.Label(body, text=label).grid(row=row_index, column=0, sticky="e", padx=(0, 8), pady=5)
            ttk.Entry(body, textvariable=variable, width=42).grid(row=row_index, column=1, sticky="ew", pady=5)
        mode_index = len(specs)
        self.mode_var = tk.StringVar(value=str(row.get("quantity_mode") or "AUTO_1TO1"))
        ttk.Label(body, text="计算方式").grid(row=mode_index, column=0, sticky="e", padx=(0, 8), pady=5)
        ttk.Combobox(body, textvariable=self.mode_var, values=list(MODE_LABELS), state="readonly", width=39).grid(row=mode_index, column=1, sticky="ew", pady=5)
        self.requires_basis_var = tk.BooleanVar(value=bool(row.get("requires_basis", False)))
        ttk.Checkbutton(body, text="保存时必须填写人工确认依据", variable=self.requires_basis_var).grid(row=mode_index + 1, column=1, sticky="w", pady=5)
        self.remark_var = tk.StringVar(value=str(row.get("remark") or ""))
        ttk.Label(body, text="规则备注").grid(row=mode_index + 2, column=0, sticky="e", padx=(0, 8), pady=5)
        ttk.Entry(body, textvariable=self.remark_var, width=42).grid(row=mode_index + 2, column=1, sticky="ew", pady=5)
        actions = ttk.Frame(body)
        actions.grid(row=mode_index + 3, column=0, columnspan=2, sticky="e", pady=(12, 0))
        ttk.Button(actions, text="取消", command=self.destroy).pack(side="right")
        ttk.Button(actions, text="保存", command=self._save).pack(side="right", padx=8)

    def _save(self) -> None:
        values = {key: variable.get().strip() for key, variable in self.vars.items()}
        for required in ("rule_code", "module", "category", "subtype", "display_name", "input_label", "unit"):
            if not values[required]:
                messagebox.showerror("无法保存", f"{required} 不能为空", parent=self)
                return
        base = values["base_score"]
        if base:
            try:
                parse_decimal(base, "基准分", allow_zero=False)
            except ValidationError:
                messagebox.showerror("无法保存", "基准分必须是大于 0 的数字，或留空表示人工填写", parent=self)
                return
        values.update({
            "module_en": "", "category_en": "", "subtype_en": "", "display_name_en": "",
            "unit_en": "", "quantity_mode": self.mode_var.get(),
            "requires_basis": 1 if self.requires_basis_var.get() else 0,
            "remark": self.remark_var.get().strip(),
        })
        if self.item_id:
            current = self.app.database.get_rule(self.item_id) or {}
            for key in ("module_en", "category_en", "subtype_en", "display_name_en", "unit_en"):
                values[key] = current.get(key, "")
        try:
            if self.item_id is None:
                self.app.database.add_rule(values)
            else:
                self.app.database.update_rule(self.item_id, values)
        except sqlite3.Error as exc:
            messagebox.showerror("无法保存", str(exc), parent=self)
            return
        self.saved = True
        self.destroy()
