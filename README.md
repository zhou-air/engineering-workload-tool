# Engineering Workload Tool · 工程工作量量化工具

Windows 单机离线工作量录入与计算工具。SQLite 是唯一真实数据源，Excel/CSV/JSON 只是导出结果。

本工具适用于集中录入人员工程工作量、按规则计算分值、查询历史记录与导出汇总的场景。当前为单机 MVP。

> 上传版的员工、小组名称和项目标识已替换为演示数据。首次初始化包含 4 个小组、15 名演示人员、8 个演示项目及 25 条规则；没有真实工作记录。内置定额是项目示例规则，实际使用前请按自己的业务口径审核或调整。

## 当前功能

- 人员、小组、项目、定额规则 GUI 管理；
- 三级规则级联、动态数量输入、Decimal 自动计算；
- 特殊规则人工确认和依据必填；
- 历史筛选、编辑后重建快照、软作废；
- 按日 Excel、按月 Excel、AI CSV/JSON 导出；
- SQLite 在线备份；
- 中文界面，数据模型为后续英文版保留英文规则字段。

## 源码运行

要求 Windows 和 Python 3.12：

```powershell
python -m pip install -r requirements.txt
python main.py
```

首次运行会在程序目录创建：

```text
data/workload.db
exports/
```

数据库初始化不会导入现有 Excel 历史记录。

## 自动测试

```powershell
python -m unittest discover -s tests -v
python main.py --self-check
```

## 生成便携版

运行：

```powershell
powershell -ExecutionPolicy Bypass -File build_portable.ps1
```

输出目录：

```text
dist/WorkloadTool/
```

把整个 `WorkloadTool` 文件夹复制到目标电脑，双击 `WorkloadTool.exe`。不要只复制 exe；便携版所需运行文件与 exe 位于同一目录。目标电脑不需要 Python、WPS、Excel或网络。

## 数据备份

在“设置 → 备份数据库”生成 `.db` 备份。也可以在程序完全退出后复制 `data/workload.db`。导出的 Excel 不是数据库备份。

## 规则边界

请先阅读 `docs/规则字段模型.md` 和 `docs/待确认问题.md`。建筑/结构、撬装设备、整体修改和 M2-04 不会被程序擅自自动推断。


## 项目结构

| 路径 | 用途 |
| --- | --- |
| `main.py` | 程序入口与无界面自检 |
| `app/database/` | SQLite 数据库及初始化字典 |
| `app/services/` | 工作量计算、记录管理与导出 |
| `app/ui/` | 中文桌面界面及日期输入组件 |
| `tests/` | 自动化测试 |
| `docs/` | 需求、数据库、规则与待确认事项 |
| `legacy/excel-scripts/` | 早期 Excel 原型生成脚本，独立于桌面程序 |

## 早期 Excel 原型

`legacy/excel-scripts/` 保留两个早期原型脚本供参考。它们依赖 `@oai/artifact-tool`、原始业务工作表和原开发环境路径，不能直接作为通用 npm 项目运行；实际工作表未上传。使用桌面程序无需运行这些脚本。

## 数据与使用边界

- 仓库不包含实际员工记录、SQLite 数据库、业务工作表、备份和历史导出。
- 当前不支持多人联网协作；已有 SQLite 数据库不会因演示种子变更自动重置。
- README 中的便携版使用方式适用于自行打包后的完整目录；本仓库本次交付为源码。
