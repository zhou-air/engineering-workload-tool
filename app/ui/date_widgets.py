"""Reusable calendar and month selectors built only with Tkinter."""

from __future__ import annotations

import calendar
import tkinter as tk
from datetime import date
from tkinter import ttk
from typing import Any


class CalendarPopup(tk.Toplevel):
    """Small modal-free calendar that writes an ISO date to a StringVar."""

    def __init__(self, parent: Any, variable: tk.StringVar):
        super().__init__(parent)
        self.variable = variable
        try:
            selected = date.fromisoformat(variable.get())
        except ValueError:
            selected = date.today()
        self.year = selected.year
        self.month = selected.month
        self.title("选择日期")
        self.resizable(False, False)
        self.transient(parent.winfo_toplevel())
        self.protocol("WM_DELETE_WINDOW", self.destroy)
        self.bind("<Escape>", lambda _event: self.destroy())
        self._draw()
        self.update_idletasks()
        x = parent.winfo_rootx()
        y = parent.winfo_rooty() + parent.winfo_height()
        self.geometry(f"+{x}+{y}")
        self.grab_set()

    def _draw(self) -> None:
        for child in self.winfo_children():
            child.destroy()
        header = ttk.Frame(self, padding=(8, 8, 8, 4))
        header.pack(fill="x")
        ttk.Button(header, text="‹", width=3, command=lambda: self._move(-1)).pack(side="left")
        ttk.Label(header, text=f"{self.year} 年 {self.month} 月", anchor="center").pack(
            side="left", fill="x", expand=True, padx=12
        )
        ttk.Button(header, text="›", width=3, command=lambda: self._move(1)).pack(side="right")

        body = ttk.Frame(self, padding=(8, 4, 8, 8))
        body.pack()
        for column, label in enumerate(("一", "二", "三", "四", "五", "六", "日")):
            ttk.Label(body, text=label, anchor="center", width=4).grid(row=0, column=column, pady=(0, 3))
        today = date.today()
        selected_text = self.variable.get()
        for row, week in enumerate(calendar.monthcalendar(self.year, self.month), start=1):
            for column, day_number in enumerate(week):
                if not day_number:
                    ttk.Label(body, text="", width=4).grid(row=row, column=column)
                    continue
                candidate = date(self.year, self.month, day_number)
                style = "Accent.TButton" if candidate.isoformat() == selected_text else "TButton"
                text = f"[{day_number}]" if candidate == today else str(day_number)
                ttk.Button(
                    body, text=text, width=4, style=style,
                    command=lambda chosen=candidate: self._choose(chosen),
                ).grid(row=row, column=column, padx=1, pady=1)
        ttk.Button(self, text="今天", command=lambda: self._choose(today)).pack(pady=(0, 8))

    def _move(self, offset: int) -> None:
        month_index = self.year * 12 + self.month - 1 + offset
        self.year, zero_based_month = divmod(month_index, 12)
        self.month = zero_based_month + 1
        self._draw()

    def _choose(self, chosen: date) -> None:
        self.variable.set(chosen.isoformat())
        self.destroy()


class DatePicker(ttk.Frame):
    """Read-only ISO date field with a calendar button."""

    def __init__(self, parent: Any, variable: tk.StringVar, width: int = 12, allow_clear: bool = False):
        super().__init__(parent)
        self.variable = variable
        self.entry = ttk.Entry(self, textvariable=variable, width=width, state="readonly")
        self.entry.pack(side="left")
        ttk.Button(self, text="日历 ▾", width=7, command=self.open_calendar).pack(side="left", padx=(4, 0))
        if allow_clear:
            ttk.Button(self, text="清除", width=5, command=lambda: variable.set("")).pack(side="left", padx=(4, 0))

    def open_calendar(self) -> None:
        CalendarPopup(self, self.variable)


class MonthPicker(ttk.Frame):
    """Year/month two-level selector backed by a YYYY-MM StringVar."""

    def __init__(self, parent: Any, variable: tk.StringVar):
        super().__init__(parent)
        self.variable = variable
        current = date.today()
        try:
            year_text, month_text = variable.get().split("-", 1)
            initial_year, initial_month = int(year_text), int(month_text)
        except (ValueError, AttributeError):
            initial_year, initial_month = current.year, current.month
        years = [str(year) for year in range(current.year - 10, current.year + 11)]
        if str(initial_year) not in years:
            years.append(str(initial_year))
            years.sort()
        self.year_var = tk.StringVar(value=str(initial_year))
        self.month_var = tk.StringVar(value=f"{initial_month:02d}")
        ttk.Combobox(self, textvariable=self.year_var, values=years, state="readonly", width=6).pack(side="left")
        ttk.Label(self, text="年").pack(side="left", padx=(3, 6))
        ttk.Combobox(
            self, textvariable=self.month_var,
            values=[f"{month:02d}" for month in range(1, 13)], state="readonly", width=4,
        ).pack(side="left")
        ttk.Label(self, text="月").pack(side="left", padx=(3, 0))
        self.year_var.trace_add("write", self._update_value)
        self.month_var.trace_add("write", self._update_value)
        self._update_value()

    def _update_value(self, *_args: Any) -> None:
        if self.year_var.get() and self.month_var.get():
            self.variable.set(f"{self.year_var.get()}-{self.month_var.get()}")
