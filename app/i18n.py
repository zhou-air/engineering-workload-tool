"""Centralized UI text for future localization.

V0.1 intentionally renders Chinese only.  Keeping UI strings here avoids
scattering literal labels throughout widgets when an English build is added.
"""

ZH_CN = {
    "app_title": "工作量量化工具",
    "entry": "工作录入",
    "history": "历史记录",
    "export": "导出",
    "settings": "设置",
    "save": "保存",
    "add": "新增",
    "edit": "编辑",
    "enable": "启用",
    "disable": "停用",
    "refresh": "刷新",
    "cancel": "取消",
    "close": "关闭",
}


def tr(key: str) -> str:
    """Return the current Chinese UI label."""

    return ZH_CN.get(key, key)
