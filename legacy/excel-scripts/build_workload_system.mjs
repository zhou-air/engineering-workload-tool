import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const baseDir = "C:/Users/DEMO/Desktop/埃塞";
const nodeRuntimeDir = "C:/Users/DEMO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node";
const outputDir = path.join(baseDir, "outputs", "workload_v01_01a06c20-f4fc-7940-adc9-cb889ca68a83");
const qaDir = path.join(baseDir, ".workbuddy", "qa", "workload_v01_01a06c20");
const sourceQuota = path.join(baseDir, "工作量量化管理表-Workload Quantification Management Form-20260831.xlsx");
const sourceQuotaOriginal = path.join(baseDir, "backup_20260904", "工作量量化管理表-Workload Quantification Management Form-20260831.xlsx");
const sourceAugust = path.join(baseDir, "August_2026_Workload_Magnitude_Final.xlsx");
const sourceDaily = path.join(baseDir, "Daily Work Log-海外埃塞员工日报体系-2026-09-01.xlsx");

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(qaDir, { recursive: true });

const colors = {
  navy: "#1F4E78",
  blue: "#D9EAF7",
  lightBlue: "#EAF3F8",
  input: "#FFF2CC",
  linked: "#E2F0D9",
  calculated: "#DDEBF7",
  warning: "#FCE4D6",
  grey: "#F2F2F2",
  darkGrey: "#666666",
  green: "#70AD47",
  orange: "#ED7D31",
  red: "#C00000",
  white: "#FFFFFF",
  border: "#B7C9D6",
};

function excelCol(n) {
  let s = "";
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function rangeAddress(row1, col1, row2, col2) {
  return `${excelCol(col1)}${row1}:${excelCol(col2)}${row2}`;
}

function padRows(rows, width) {
  return rows.map((row) => Array.from({ length: width }, (_, i) => row?.[i] ?? null));
}

function trimValue(v) {
  return v === null || v === undefined ? "" : String(v).replace(/\r/g, "").trim();
}

function asDate(v) {
  if (v instanceof Date) return v;
  if (typeof v === "number" && v > 30000 && v < 60000) {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + Math.round(v * 86400000));
  }
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v.trim());
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function isoDate(v) {
  const d = asDate(v);
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function numberOrNull(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = trimValue(v).replace(/,/g, "");
  if (!s || /根据实际情况|based on|actual situation/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function textOrBlank(v) {
  const s = trimValue(v);
  return s === "/" || s === "-" ? "" : s;
}

async function importWorkbook(filePath) {
  const blob = await FileBlob.load(filePath);
  return SpreadsheetFile.importXlsx(blob);
}

async function readUsedValues(filePath, sheetName) {
  const wb = await importWorkbook(filePath);
  const ws = sheetName ? wb.worksheets.getItem(sheetName) : wb.worksheets.getItemAt(0);
  return ws.getUsedRange().values;
}

const quotaValues = await readUsedValues(sourceQuota);
const quotaOriginalValues = await readUsedValues(sourceQuotaOriginal);
const augustValues = await importWorkbook(sourceAugust);
const dailyValues = await importWorkbook(sourceDaily);

function getQuota(rowNumber, colNumber) {
  return quotaValues?.[rowNumber - 1]?.[colNumber - 1] ?? null;
}

function getQuotaOriginal(rowNumber, colNumber) {
  return quotaOriginalValues?.[rowNumber - 1]?.[colNumber - 1] ?? null;
}

const moduleInfo = {
  M1: { cn: "三维建模", en: "3D Modeling" },
  M2: { cn: "图纸编制", en: "Drawing Preparation" },
  M3: { cn: "辅助管理类隐性工作", en: "Supporting Management-related Hidden Work" },
};

function makePath(moduleId, categoryCn, categoryEn, activityCn, activityEn, variantCn = "", variantEn = "") {
  const m = moduleInfo[moduleId];
  const variant = variantCn ? ` | ${variantCn}${variantEn ? ` / ${variantEn}` : ""}` : "";
  return `${moduleId} | ${m.cn} / ${m.en} | ${categoryCn} / ${categoryEn} | ${activityCn} / ${activityEn}${variant}`;
}

const activityRows = [];
function addActivity({ id, original, moduleId, categoryCn, categoryEn, activityCn, activityEn, variantCn, variantEn, sourceCnRow, sourceEnRow, calcType, unitCn, unitEn, formulaRule, condition, noteCn, noteEn, enabled = true, derivedFactor = null }) {
  const cnRow = sourceCnRow ? quotaValues?.[sourceCnRow - 1] ?? [] : [];
  const enRow = sourceEnRow ? quotaValues?.[sourceEnRow - 1] ?? [] : [];
  const quota = numberOrNull(cnRow[3]);
  const cnDesc = textOrBlank(cnRow[1]);
  const enDesc = textOrBlank(enRow[1]);
  const cnNote = noteCn ?? textOrBlank(cnRow[5]);
  const enNote = noteEn ?? textOrBlank(enRow[5]);
  activityRows.push([
    id,
    makePath(moduleId, categoryCn, categoryEn, activityCn, activityEn, variantCn, variantEn),
    moduleId,
    moduleInfo[moduleId].cn,
    moduleInfo[moduleId].en,
    categoryCn,
    categoryEn,
    activityCn,
    activityEn,
    original,
    cnDesc,
    enDesc,
    calcType,
    unitCn,
    unitEn,
    quota,
    formulaRule,
    condition ?? textOrBlank(cnRow[5]),
    cnNote,
    enNote,
    enabled,
    "2026-08-31-current",
    derivedFactor,
    id,
  ]);
}

// M1-01 and M1-02 are split because the source quota changes by floor condition.
addActivity({ id: "M1-01-A", original: "M1-01", moduleId: "M1", categoryCn: "建筑建模", categoryEn: "Architectural modeling", activityCn: "建筑建模", activityEn: "Architectural modeling", variantCn: "一层+屋顶", variantEn: "1 floor + roof", sourceCnRow: 7, sourceEnRow: 10, calcType: "PER_1000M2_FLOOR", unitCn: "1000㎡·层", unitEn: "1000 m²-floor", formulaRule: "Quantity × Standard_Quota", condition: "总共一层+屋顶 / 1 floor + roof" });
addActivity({ id: "M1-01-B", original: "M1-01", moduleId: "M1", categoryCn: "建筑建模", categoryEn: "Architectural modeling", activityCn: "建筑建模", activityEn: "Architectural modeling", variantCn: "二至四层+屋顶", variantEn: "2–4 floors + roof", sourceCnRow: 8, sourceEnRow: 11, calcType: "PER_1000M2_FLOOR", unitCn: "1000㎡·层", unitEn: "1000 m²-floor", formulaRule: "Quantity × Standard_Quota", condition: "总共二到四层+屋顶 / 2–4 floors + roof" });
addActivity({ id: "M1-01-C", original: "M1-01", moduleId: "M1", categoryCn: "建筑建模", categoryEn: "Architectural modeling", activityCn: "建筑建模", activityEn: "Architectural modeling", variantCn: "五层及以上+屋顶", variantEn: "5+ floors + roof", sourceCnRow: 9, sourceEnRow: 12, calcType: "PER_1000M2_FLOOR", unitCn: "1000㎡·层", unitEn: "1000 m²-floor", formulaRule: "Quantity × Standard_Quota", condition: "总共五层及以上+屋顶 / 5+ floors + roof" });
addActivity({ id: "M1-02-A", original: "M1-02", moduleId: "M1", categoryCn: "结构建模", categoryEn: "Structural modeling", activityCn: "结构建模", activityEn: "Structural modeling", variantCn: "一层+屋顶", variantEn: "1 floor + roof", sourceCnRow: 13, sourceEnRow: 16, calcType: "PER_1000M2_FLOOR", unitCn: "1000㎡·层", unitEn: "1000 m²-floor", formulaRule: "Quantity × Standard_Quota", condition: "总共一层+屋顶 / 1 floor + roof" });
addActivity({ id: "M1-02-B", original: "M1-02", moduleId: "M1", categoryCn: "结构建模", categoryEn: "Structural modeling", activityCn: "结构建模", activityEn: "Structural modeling", variantCn: "二至四层+屋顶", variantEn: "2–4 floors + roof", sourceCnRow: 14, sourceEnRow: 17, calcType: "PER_1000M2_FLOOR", unitCn: "1000㎡·层", unitEn: "1000 m²-floor", formulaRule: "Quantity × Standard_Quota", condition: "总共二到四层+屋顶 / 2–4 floors + roof" });
addActivity({ id: "M1-02-C", original: "M1-02", moduleId: "M1", categoryCn: "结构建模", categoryEn: "Structural modeling", activityCn: "结构建模", activityEn: "Structural modeling", variantCn: "五层及以上+屋顶", variantEn: "5+ floors + roof", sourceCnRow: 15, sourceEnRow: 18, calcType: "PER_1000M2_FLOOR", unitCn: "1000㎡·层", unitEn: "1000 m²-floor", formulaRule: "Quantity × Standard_Quota", condition: "总共五层及以上+屋顶 / 5+ floors + roof" });
addActivity({ id: "M1-03-A", original: "M1-03", moduleId: "M1", categoryCn: "设备建模", categoryEn: "Equipment modeling", activityCn: "设备建模", activityEn: "Equipment modeling", variantCn: "反应釜", variantEn: "Reactor", sourceCnRow: 19, sourceEnRow: 24, calcType: "PER_ITEM", unitCn: "个", unitEn: "unit", formulaRule: "Quantity × Standard_Quota" });
addActivity({ id: "M1-03-B", original: "M1-03", moduleId: "M1", categoryCn: "设备建模", categoryEn: "Equipment modeling", activityCn: "设备建模", activityEn: "Equipment modeling", variantCn: "换热器", variantEn: "Heat exchanger", sourceCnRow: 20, sourceEnRow: 25, calcType: "PER_ITEM", unitCn: "个", unitEn: "unit", formulaRule: "Quantity × Standard_Quota" });
addActivity({ id: "M1-03-C", original: "M1-03", moduleId: "M1", categoryCn: "设备建模", categoryEn: "Equipment modeling", activityCn: "设备建模", activityEn: "Equipment modeling", variantCn: "储罐", variantEn: "Storage tank", sourceCnRow: 21, sourceEnRow: 26, calcType: "PER_ITEM", unitCn: "个", unitEn: "unit", formulaRule: "Quantity × Standard_Quota" });
addActivity({ id: "M1-03-D", original: "M1-03", moduleId: "M1", categoryCn: "设备建模", categoryEn: "Equipment modeling", activityCn: "设备建模", activityEn: "Equipment modeling", variantCn: "泵", variantEn: "Pump", sourceCnRow: 22, sourceEnRow: 27, calcType: "PER_ITEM", unitCn: "个", unitEn: "unit", formulaRule: "Quantity × Standard_Quota" });
addActivity({ id: "M1-03-E", original: "M1-03", moduleId: "M1", categoryCn: "设备建模", categoryEn: "Equipment modeling", activityCn: "设备建模", activityEn: "Equipment modeling", variantCn: "撬装设备", variantEn: "Skid-mounted equipment", sourceCnRow: 23, sourceEnRow: 28, calcType: "MANUAL_REVIEW", unitCn: "个", unitEn: "unit", formulaRule: "Manual review; no automatic score", condition: "根据实际情况确定 / Based on the actual situation" });
addActivity({ id: "M1-04", original: "M1-04", moduleId: "M1", categoryCn: "外管廊建模", categoryEn: "External gallery modeling", activityCn: "外管廊建模", activityEn: "External gallery modeling", sourceCnRow: 29, sourceEnRow: 30, calcType: "PER_100M", unitCn: "100米", unitEn: "100 m", formulaRule: "Quantity × Standard_Quota" });
addActivity({ id: "M1-05", original: "M1-05", moduleId: "M1", categoryCn: "内管廊建模", categoryEn: "Internal gallery modeling", activityCn: "内管廊建模", activityEn: "Internal gallery modeling", sourceCnRow: 31, sourceEnRow: 32, calcType: "PER_FLOOR", unitCn: "层", unitEn: "floor", formulaRule: "Quantity × Standard_Quota" });
addActivity({ id: "M1-06-A", original: "M1-06", moduleId: "M1", categoryCn: "管道建模", categoryEn: "Pipeline modeling", activityCn: "车间内主管道", activityEn: "Main pipeline inside workshop", variantCn: "热力主管道", variantEn: "Thermal main pipe", sourceCnRow: 33, sourceEnRow: 38, calcType: "PER_ITEM", unitCn: "根", unitEn: "line", formulaRule: "Quantity × Standard_Quota" });
addActivity({ id: "M1-06-B", original: "M1-06", moduleId: "M1", categoryCn: "管道建模", categoryEn: "Pipeline modeling", activityCn: "车间内主管道", activityEn: "Main pipeline inside workshop", variantCn: "非热力主管道", variantEn: "Non-thermal main pipe", sourceCnRow: 34, sourceEnRow: 39, calcType: "PER_ITEM", unitCn: "根", unitEn: "line", formulaRule: "Quantity × Standard_Quota" });
addActivity({ id: "M1-06-C", original: "M1-06", moduleId: "M1", categoryCn: "管道建模", categoryEn: "Pipeline modeling", activityCn: "车间外主管道", activityEn: "Main pipeline outside workshop", variantCn: "热力主管道", variantEn: "Thermal main pipe", sourceCnRow: 35, sourceEnRow: 40, calcType: "PER_100M", unitCn: "100米", unitEn: "100 m", formulaRule: "Quantity × Standard_Quota" });
addActivity({ id: "M1-06-D", original: "M1-06", moduleId: "M1", categoryCn: "管道建模", categoryEn: "Pipeline modeling", activityCn: "车间外主管道", activityEn: "Main pipeline outside workshop", variantCn: "非热力主管道", variantEn: "Non-thermal main pipe", sourceCnRow: 36, sourceEnRow: 41, calcType: "PER_100M", unitCn: "100米", unitEn: "100 m", formulaRule: "Quantity × Standard_Quota" });
addActivity({ id: "M1-06-E", original: "M1-06", moduleId: "M1", categoryCn: "管道建模", categoryEn: "Pipeline modeling", activityCn: "设备接管建模", activityEn: "Equipment connection pipe", sourceCnRow: 37, sourceEnRow: 42, calcType: "PER_ITEM", unitCn: "根", unitEn: "line", formulaRule: "Quantity × Standard_Quota" });
addActivity({ id: "M1-07-A", original: "M1-07", moduleId: "M1", categoryCn: "模型修改", categoryEn: "Model modification", activityCn: "建模修改", activityEn: "Modeling modification", variantCn: "局部修改", variantEn: "Local modification", sourceCnRow: 43, sourceEnRow: 46, calcType: "PER_EVENT", unitCn: "次", unitEn: "event", formulaRule: "Quantity × Standard_Quota" });
addActivity({ id: "M1-07-B", original: "M1-07", moduleId: "M1", categoryCn: "模型修改", categoryEn: "Model modification", activityCn: "建模修改", activityEn: "Modeling modification", variantCn: "重要修改", variantEn: "Major modification", sourceCnRow: 44, sourceEnRow: 47, calcType: "PER_EVENT", unitCn: "次", unitEn: "event", formulaRule: "Quantity × Standard_Quota" });
addActivity({ id: "M1-07-C", original: "M1-07", moduleId: "M1", categoryCn: "模型修改", categoryEn: "Model modification", activityCn: "建模修改", activityEn: "Modeling modification", variantCn: "整体修改", variantEn: "Overall modification", sourceCnRow: 45, sourceEnRow: 48, calcType: "MANUAL_REVIEW", unitCn: "次", unitEn: "event", formulaRule: "Manual review; no automatic score", condition: "根据实际情况确定 / Based on the actual situation" });
addActivity({ id: "M2-01", original: "M2-01", moduleId: "M2", categoryCn: "图纸", categoryEn: "Drawing", activityCn: "管道平面布置图", activityEn: "Piping layout plan", sourceCnRow: 54, sourceEnRow: 55, calcType: "PER_DRAWING", unitCn: "A1图纸", unitEn: "A1 drawing", formulaRule: "Quantity × Standard_Quota" });
addActivity({ id: "M2-02", original: "M2-02", moduleId: "M2", categoryCn: "图纸", categoryEn: "Drawing", activityCn: "设备、管道外防腐一览表", activityEn: "External anti-corrosion summary table", sourceCnRow: 56, sourceEnRow: 57, calcType: "PER_DRAWING", unitCn: "A3图纸", unitEn: "A3 drawing", formulaRule: "Quantity × Standard_Quota" });
addActivity({ id: "M2-03", original: "M2-03", moduleId: "M2", categoryCn: "图纸", categoryEn: "Drawing", activityCn: "设备、管道外保温一览表", activityEn: "Thermal insulation summary table", sourceCnRow: 58, sourceEnRow: 59, calcType: "PER_DRAWING", unitCn: "A3图纸", unitEn: "A3 drawing", formulaRule: "Quantity × Standard_Quota" });
addActivity({ id: "M2-04", original: "M2-04", moduleId: "M2", categoryCn: "图纸", categoryEn: "Drawing", activityCn: "管道支吊架数据表", activityEn: "Pipe support data sheet", sourceCnRow: 60, sourceEnRow: 61, calcType: "DERIVED_FROM_ACTIVITY", unitCn: "关联建模记录", unitEn: "related modeling record", formulaRule: "Related modeling Base_Workload × Derived_Factor", derivedFactor: 0.25 });
addActivity({ id: "M3-01", original: "M3-01", moduleId: "M3", categoryCn: "模型自检", categoryEn: "Model self-check", activityCn: "模型内部自检", activityEn: "Internal self-check of the model", sourceCnRow: 68, sourceEnRow: 69, calcType: "DERIVED_FROM_ACTIVITY", unitCn: "关联建模记录", unitEn: "related modeling record", formulaRule: "Source quota retained; deferred", enabled: false, derivedFactor: 0.4 });
addActivity({ id: "M3-02", original: "M3-02", moduleId: "M3", categoryCn: "图纸自检", categoryEn: "Drawing self-check", activityCn: "图纸内部自检", activityEn: "Internal self-check of drawings", sourceCnRow: 70, sourceEnRow: 71, calcType: "DERIVED_FROM_ACTIVITY", unitCn: "关联图纸记录", unitEn: "related drawing record", formulaRule: "Source quota retained; deferred", enabled: false, derivedFactor: 0.3 });
addActivity({ id: "M3-03", original: "M3-03", moduleId: "M3", categoryCn: "会议沟通", categoryEn: "Meeting communication", activityCn: "会议沟通时间", activityEn: "Meeting communication time", sourceCnRow: 72, sourceEnRow: 73, calcType: "MANUAL_REVIEW", unitCn: "小时", unitEn: "hour", formulaRule: "Source quota retained; deferred", enabled: false, derivedFactor: 1.15 });
addActivity({ id: "M3-04", original: "M3-04", moduleId: "M3", categoryCn: "内部协调", categoryEn: "Internal coordination", activityCn: "内部协调、团队管理", activityEn: "Internal coordination, team management", sourceCnRow: 74, sourceEnRow: 75, calcType: "MANUAL_REVIEW", unitCn: "小时", unitEn: "hour", formulaRule: "Statistics only; deferred", enabled: false });

const employees = [
  ["EMP-001", "Employee01", "", "", "Manager", new Date("2026-08-18"), null, true, "OKR", "Manager sheet; excluded from M1/M2 ranking"],
  ["EMP-002", "Employee02", "", "T01", "Team Leader", new Date("2026-08-18"), null, true, "M1+M2", "August statistics / team leader daily log"],
  ["EMP-003", "Employee03", "", "T01", "Engineer", new Date("2026-08-18"), null, true, "M1+M2", "August statistics / junior engineers daily log"],
  ["EMP-004", "Employee04", "", "T01", "Engineer", new Date("2026-08-18"), null, true, "M1+M2", "August statistics / junior engineers daily log"],
  ["EMP-005", "Employee05", "", "T02", "Team Leader", new Date("2026-08-18"), null, true, "M1+M2", "August statistics / team leader daily log"],
  ["EMP-006", "Employee06", "", "T02", "Engineer", new Date("2026-08-18"), null, true, "M1+M2", "August statistics / junior engineers daily log"],
  ["EMP-007", "Employee07", "", "T02", "Engineer", new Date("2026-08-18"), null, true, "M1+M2", "August statistics / junior engineers daily log"],
  ["EMP-008", "Employee08", "", "T02", "Engineer", new Date("2026-08-18"), null, true, "M1+M2", "August statistics / junior engineers daily log"],
  ["EMP-009", "Employee09", "", "T03", "Team Leader", new Date("2026-08-18"), null, true, "M1+M2", "August statistics / team leader daily log"],
  ["EMP-010", "Employee10", "", "T03", "Engineer", new Date("2026-08-18"), null, true, "M1+M2", "August statistics / junior engineers daily log"],
  ["EMP-011", "Employee11", "", "T03", "Engineer", new Date("2026-08-18"), null, true, "M1+M2", "August statistics / junior engineers daily log"],
  ["EMP-012", "Employee12", "", "T03", "Engineer", new Date("2026-08-18"), null, true, "M1+M2", "August statistics / junior engineers daily log"],
  ["EMP-013", "Employee13", "", "T04", "Team Leader", new Date("2026-08-18"), null, true, "M1+M2", "August statistics / team leader daily log"],
  ["EMP-014", "Employee14", "", "T04", "Engineer", new Date("2026-08-18"), null, true, "M1+M2", "August statistics / junior engineers daily log"],
  ["EMP-015", "Employee15", "", "T04", "Engineer", new Date("2026-08-18"), null, true, "M1+M2", "August statistics / junior engineers daily log"],
];

const teams = [
  ["T01", "Employee02", "Employee02", true, "4 team leaders/teams observed in August statistics"],
  ["T02", "Employee05", "Employee05", true, "4 team leaders/teams observed in August statistics"],
  ["T03", "Employee09", "Employee09", true, "4 team leaders/teams observed in August statistics"],
  ["T04", "Employee13", "Employee13", true, "4 team leaders/teams observed in August statistics"],
];

const projects = [
  ["PRJ-001", "DEMO_PROJECT_01", "DEMO_PROJECT_01", "DEMO_PROJECT_01", "Active", true, "Observed in daily logs and August statistics", ""],
  ["PRJ-002", "DEMO_PROJECT_02", "DEMO_PROJECT_02", "DEMO_PROJECT_02", "Active", true, "Observed in daily logs and August statistics", ""],
  ["PRJ-003", "DEMO_PROJECT_03", "DEMO_PROJECT_03", "DEMO_PROJECT_03", "Active", true, "Observed in daily logs and August statistics", ""],
  ["PRJ-004", "DEMO_PROJECT_04", "DEMO_PROJECT_04", "DEMO_PROJECT_04", "Active", true, "Observed in daily logs and August statistics", ""],
  ["PRJ-005", "DEMO_PROJECT_05", "DEMO_PROJECT_05", "DEMO_PROJECT_05", "Active", true, "Observed in daily logs and August statistics", ""],
  ["PRJ-006", "DEMO_PROJECT_06", "DEMO_PROJECT_06", "DEMO_PROJECT_06", "Active", true, "Observed in daily logs and August statistics", ""],
  ["PRJ-007", "DEMO_PROJECT_07", "DEMO_PROJECT_07", "DEMO_PROJECT_07", "Active", true, "Observed in daily logs and August statistics", ""],
  ["PRJ-008", "DEMO_PROJECT_08", "DEMO_PROJECT_08", "DEMO_PROJECT_08", "Active", true, "Daily logs also contain SCSHOU; alias needs confirmation", "SCSHOU"],
];

const statusRows = [
  ["Started", 0.25, true, "V0.1 provisional; confirm before formal performance use"],
  ["In Progress", 0.5, true, "V0.1 provisional; confirm before formal performance use"],
  ["Mostly Completed", 0.8, true, "V0.1 provisional; confirm before formal performance use"],
  ["Completed", 1.0, true, "V0.1 provisional; confirm before formal performance use"],
];
const workObjectTypes = [["Pipe"], ["Equipment"], ["Drawing"], ["Model"], ["Area / Building"], ["Meeting"], ["Other"]];
const recordStatuses = [["Example"], ["User Input"], ["Review"]];
const confidenceValues = [["High"], ["Medium"], ["Low"], ["None"]];
const calculationTypes = [["PER_ITEM"], ["PER_EVENT"], ["PER_DRAWING"], ["PER_100M"], ["PER_1000M2_FLOOR"], ["PER_FLOOR"], ["DERIVED_FROM_ACTIVITY"], ["MANUAL_REVIEW"]];

const fieldRows = [
  ["Daily_Log", "DL-001", "记录编号", "Record_ID", "Calculated", "ID", "No", "No", "System", "Daily_Log row", "Input row", "Generated when a row has input", "DL-0001", "DL-0001", "Stable transaction identifier", "daily_log.record_id"],
  ["Daily_Log", "DL-002", "工作日期", "Work_Date", "Objective", "Date", "Yes", "Yes", "Employee", "Daily log", "", "Valid date; 2020–2100", "", "2026-08-18", "Fact date of work", "daily_log.work_date"],
  ["Daily_Log", "DL-003", "员工姓名（输入）", "Employee_Name_Input", "Fixed", "Enum", "Yes", "Yes", "Employee", "Employee_Master", "Employee_Master.Name", "List from helper range", "", "Employee02", "User-facing employee selection", "daily_log.employee_name_input"],
  ["Daily_Log", "DL-004", "员工编号", "Employee_ID", "Linked", "ID", "Yes", "No", "System", "Employee_Master", "Employee_Name_Input", "Exact name match", "", "EMP-002", "Stable employee key", "daily_log.employee_id"],
  ["Daily_Log", "DL-005", "团队编号", "Team_ID", "Linked", "ID", "No", "No", "System", "Employee_Master", "Employee_ID", "Linked to employee", "", "T01", "Team key at entry time", "daily_log.team_id"],
  ["Daily_Log", "DL-006", "团队", "Team_Name", "Linked", "Text", "No", "No", "System", "Team_Master", "Team_ID", "Linked to team", "", "Employee02", "Display team", "daily_log.team_name"],
  ["Daily_Log", "DL-007", "角色", "Role", "Linked", "Enum", "Yes", "No", "System", "Employee_Master", "Employee_ID", "Manager/Team Leader/Engineer", "", "Engineer", "Historical role-aware calculation scope", "daily_log.role"],
  ["Daily_Log", "DL-008", "项目代码（输入）", "Project_Code_Input", "Fixed", "Enum", "Yes", "Yes", "Employee", "Project_Master", "", "List from helper range", "", "DEMO_PROJECT_06", "User-facing project selection", "daily_log.project_code_input"],
  ["Daily_Log", "DL-009", "项目编号", "Project_ID", "Linked", "ID", "Yes", "No", "System", "Project_Master", "Project_Code_Input", "Exact code match", "", "PRJ-006", "Stable project key", "daily_log.project_id"],
  ["Daily_Log", "DL-010", "单体/区域", "Unit_Area", "Objective", "Text", "No", "Yes", "Employee", "Daily log", "", "Free text", "", "Main Plant", "Location or area context", "daily_log.unit_area"],
  ["Daily_Log", "DL-011", "工作路径（输入）", "Activity_Path_Input", "Fixed", "Enum", "Yes", "Yes", "Employee", "Activity_Master", "", "Enabled activity list only", "", "M1 | 三维建模 | 设备建模 | 泵", "Stable human-readable activity selection", "daily_log.activity_path_input"],
  ["Daily_Log", "DL-012", "模块", "Module", "Linked", "Enum", "Yes", "No", "System", "Activity_Master", "Activity_Path_Input", "M1/M2; M3 disabled", "", "M1", "Module used for summary", "daily_log.module"],
  ["Daily_Log", "DL-013", "工作类别", "Activity_Category", "Linked", "Text", "Yes", "No", "System", "Activity_Master", "Activity_Path_Input", "Linked to activity", "", "设备建模", "Category display", "daily_log.activity_category"],
  ["Daily_Log", "DL-014", "定额编码", "Activity_ID", "Linked", "ID", "Yes", "No", "System", "Activity_Master", "Activity_Path_Input", "Unique activity rule ID", "", "M1-03-D", "Calculation rule key", "daily_log.activity_id"],
  ["Daily_Log", "DL-015", "工作对象类型", "Work_Object_Type", "Fixed", "Enum", "No", "Yes", "Employee", "Status_Config", "", "Pipe/Equipment/Drawing/Model/etc.", "", "Equipment", "Concrete object type", "daily_log.work_object_type"],
  ["Daily_Log", "DL-016", "工作对象编号", "Work_Object_ID", "Objective", "Text", "No", "Yes", "Employee", "Daily log", "", "Free text; retain source IDs", "", "E010402", "Pipe/equipment/drawing/model identifier", "daily_log.work_object_id"],
  ["Daily_Log", "DL-017", "数量", "Quantity", "Objective", "Decimal", "Yes", "Yes", "Employee", "Daily log", "Unit/Calculation_Type", "Number >= 0; use standard unit", "", "2", "Standardized measurable quantity", "daily_log.quantity"],
  ["Daily_Log", "DL-018", "单位", "Unit", "Linked", "Text", "Yes", "No", "System", "Activity_Master", "Activity_ID", "Linked to activity", "", "个 / unit", "Unit shown to employee", "daily_log.unit"],
  ["Daily_Log", "DL-019", "计算类型", "Calculation_Type", "Linked", "Enum", "Yes", "No", "System", "Activity_Master", "Activity_ID", "Calculation type from master", "", "PER_ITEM", "Determines formula behavior", "daily_log.calculation_type"],
  ["Daily_Log", "DL-020", "标准定额", "Standard_Quota", "Linked", "Decimal", "No", "No", "System", "Activity_Master", "Activity_ID", "Numeric only for calculable rules", "", "0.6", "Standard quota per unit", "daily_log.standard_quota"],
  ["Daily_Log", "DL-021", "定额启用状态", "Activity_Enabled", "Linked", "Boolean", "Yes", "No", "System", "Activity_Master", "Activity_ID", "TRUE required", "TRUE", "TRUE", "Disabled activities cannot be used", "daily_log.activity_enabled"],
  ["Daily_Log", "DL-022", "完成状态", "Completion_Status", "Fixed", "Enum", "Yes", "Yes", "Employee", "Status_Config", "", "Started/In Progress/Mostly Completed/Completed", "", "Completed", "Fixed status replaces subjective percentage", "daily_log.completion_status"],
  ["Daily_Log", "DL-023", "进度系数", "Progress_Factor", "Linked", "Decimal", "Yes", "No", "System", "Status_Config", "Completion_Status", "Lookup from config", "", "1.0", "Configurable provisional factor", "daily_log.progress_factor"],
  ["Daily_Log", "DL-024", "关联记录编号", "Related_Record_ID", "Objective", "ID", "Conditional", "Yes", "Employee", "Daily_Log", "Calculation_Type", "Required for DERIVED_FROM_ACTIVITY", "", "DL-0005", "Reference for derived workload", "daily_log.related_record_id"],
  ["Daily_Log", "DL-025", "修正系数", "Adjustment_Factor", "Linked", "Decimal", "No", "No", "System", "Status_Config", "System default", "Visible default 1.0", "1.0", "1.0", "Reserved without quality scoring", "daily_log.adjustment_factor"],
  ["Daily_Log", "DL-026", "基础工作量", "Base_Workload", "Calculated", "Formula", "No", "No", "System", "Daily_Log + Activity_Master", "Quantity/Quota/Related_Record_ID", "Calculable rows only", "", "1.2", "Traceable base score", "daily_log.base_workload"],
  ["Daily_Log", "DL-027", "有效工作量", "Effective_Workload", "Calculated", "Formula", "No", "No", "System", "Daily_Log + Status_Config", "Base/Progress/Adjustment", "Base × factors", "", "1.2", "V0.1 effective score", "daily_log.effective_workload"],
  ["Daily_Log", "DL-028", "证据", "Evidence", "Objective", "Text", "No", "Yes", "Employee", "Daily log", "", "Free text or file reference", "", "PDF / DWG / model", "Completion evidence", "daily_log.evidence"],
  ["Daily_Log", "DL-029", "工作描述", "Description", "Objective", "Text", "Yes", "Yes", "Employee", "Daily log", "", "Free text", "", "Created equipment body and nozzles", "Detailed factual description", "daily_log.description"],
  ["Daily_Log", "DL-030", "备注", "Remark", "Objective", "Text", "No", "Yes", "Employee", "Daily log", "", "Free text", "", "", "Additional context", "daily_log.remark"],
  ["Daily_Log", "DL-031", "记录状态", "Record_Status", "Fixed", "Enum", "Yes", "Yes", "Employee/System", "Status_Config", "", "Example/User Input/Review", "Example", "User Input", "Controls summary inclusion", "daily_log.record_status"],
  ["Daily_Log", "DL-032", "数据质量标记", "Data_Quality_Flag", "Calculated", "Enum", "No", "No", "System", "Daily_Log", "All inputs/linked fields", "OK or explicit error code", "", "OK", "Prevents invalid rows from scoring", "daily_log.data_quality_flag"],
  ["Employee_Master", "EM-001", "员工编号", "Employee_ID", "Fixed", "ID", "Yes", "Yes", "Admin", "Employee_Master", "", "Unique", "EMP-001", "EMP-002", "Stable primary key", "employee.employee_id"],
  ["Employee_Master", "EM-002", "姓名", "Name", "Fixed", "Text", "Yes", "Yes", "Admin", "Historical logs", "", "Unique normalized display name", "", "Employee02", "Display name; not primary key", "employee.name"],
  ["Employee_Master", "EM-003", "团队编号", "Team_ID", "Fixed", "ID", "No", "Yes", "Admin", "Team_Master", "", "Existing Team_ID", "", "T01", "Effective team membership", "employee.team_id"],
  ["Employee_Master", "EM-004", "角色", "Role", "Fixed", "Enum", "Yes", "Yes", "Admin", "Historical logs", "", "Manager/Team Leader/Engineer", "", "Engineer", "Role-aware scope", "employee.role"],
  ["Employee_Master", "EM-005", "工作量范围", "Workload_Scope", "Fixed", "Enum", "Yes", "Yes", "Admin", "Business rule", "Role", "M1+M2 or OKR", "M1+M2", "M1+M2", "Controls ordinary summary", "employee.workload_scope"],
  ["Project_Master", "PM-001", "项目编号", "Project_ID", "Fixed", "ID", "Yes", "Yes", "Admin", "Project_Master", "", "Unique", "PRJ-001", "PRJ-006", "Stable primary key", "project.project_id"],
  ["Project_Master", "PM-002", "项目代码", "Project_Code", "Fixed", "Text", "Yes", "Yes", "Admin", "Historical logs", "", "Unique canonical code", "", "DEMO_PROJECT_06", "User-facing project code", "project.project_code"],
  ["Activity_Master", "AM-001", "定额编码", "Activity_ID", "Fixed", "ID", "Yes", "Yes", "Admin", "Quota_Raw", "", "Unique rule key", "", "M1-03-D", "Stable final rule key", "activity.activity_id"],
  ["Activity_Master", "AM-002", "工作路径", "Activity_Path", "Fixed", "Text", "Yes", "Yes", "Admin", "Activity_Master", "Module/Category/Activity", "Unique enabled selection", "", "M1 | ... | Pump", "User-facing selection label", "activity.activity_path"],
  ["Activity_Master", "AM-003", "标准定额", "Standard_Quota", "Fixed", "Decimal", "No", "Yes", "Admin", "Quota_Raw", "Activity_ID", "Blank for manual review", "", "0.6", "Rule value", "activity.standard_quota"],
  ["Activity_Master", "AM-004", "启用状态", "Enabled", "Fixed", "Boolean", "Yes", "Yes", "Admin", "Business scope", "", "M1/M2 TRUE; M3 FALSE", "TRUE", "TRUE", "Availability for input", "activity.enabled"],
  ["Quality_Event", "QE-001", "质量事件编号", "Quality_Event_ID", "Fixed", "ID", "Yes", "Yes", "Reviewer", "Quality_Event", "", "Unique", "QE-0001", "QE-0001", "Future quality event key", "quality_event.quality_event_id"],
  ["Quality_Event", "QE-002", "关联日报记录", "Related_Record_ID", "Objective", "ID", "No", "Yes", "Reviewer", "Daily_Log", "", "Existing Record_ID", "", "DL-0001", "Reference to daily log", "quality_event.related_record_id"],
  ["Quality_Event", "QE-003", "调整值", "Adjustment", "Subjective", "Decimal", "No", "Yes", "Reviewer", "Quality_Event", "Severity/Responsibility", "No V0.1 formula", "", "", "Reserved; not used in workload", "quality_event.adjustment"],
  ["Migration_Test", "MT-001", "原始文本", "Original_Text", "Objective", "Text", "Yes", "No", "System", "Historical daily logs", "", "Preserve source text", "", "Created pipe", "Source evidence", "migration.original_text"],
  ["Migration_Test", "MT-002", "建议工作", "Suggested_Activity", "Linked", "Text", "No", "No", "Rule", "Keyword mapping", "Original_Text", "Conservative suggestion", "", "M1-06 family", "Not final workload", "migration.suggested_activity"],
  ["Migration_Test", "MT-003", "建议数量", "Suggested_Quantity", "Linked", "Decimal", "No", "No", "Rule", "Explicit quantity/ID list", "Original_Text", "Only explicit or reliably counted", "", "25", "Never invent missing quantity", "migration.suggested_quantity"],
  ["Migration_Test", "MT-004", "置信度", "Confidence", "Linked", "Enum", "Yes", "No", "Rule", "Status_Config", "Suggestion", "High/Medium/Low/None", "None", "Medium", "Human review aid", "migration.confidence"],
  ["Migration_Test", "MT-005", "需要审核", "Needs_Review", "Calculated", "Boolean", "No", "No", "System", "Migration_Test", "Missing fields/ambiguity", "TRUE if incomplete", "TRUE", "TRUE", "Prevents false migration", "migration.needs_review"],
];

function applyTitle(sheet, range, text) {
  const r = sheet.getRange(range);
  r.merge();
  r.values = [[text]];
  r.format = { fill: colors.navy, font: { bold: true, color: colors.white }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true };
  r.format.rowHeight = 28;
}

function applyNote(sheet, range, text) {
  const r = sheet.getRange(range);
  r.merge();
  r.values = [[text]];
  r.format = { fill: colors.lightBlue, font: { color: colors.darkGrey }, horizontalAlignment: "left", verticalAlignment: "center", wrapText: true };
  r.format.rowHeight = 36;
}

function styleHeader(sheet, range) {
  const r = sheet.getRange(range);
  r.format = { fill: colors.blue, font: { bold: true, color: "#17365D" }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true, borders: { preset: "all", style: "thin", color: colors.border } };
  r.format.rowHeight = 32;
}

function styleTable(sheet, range, options = {}) {
  const r = sheet.getRange(range);
  r.format = { verticalAlignment: "center", wrapText: options.wrapText ?? true, borders: { preset: "inside", style: "thin", color: colors.border } };
  if (options.left) sheet.getRange(options.left).format.horizontalAlignment = "left";
  if (options.center) sheet.getRange(options.center).format.horizontalAlignment = "center";
  if (options.number) sheet.getRange(options.number).format.horizontalAlignment = "right";
}

function setWidths(sheet, widthMap) {
  for (const [col, width] of Object.entries(widthMap)) sheet.getRange(`${col}:${col}`).format.columnWidth = width;
}

function addTable(sheet, range, name) {
  const table = sheet.tables.add(range, true, name);
  table.showFilterButton = true;
  table.showBandedColumns = false;
  return table;
}

function makeSheet(workbook, name) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  return sheet;
}

function normalizeName(raw) {
  const s = trimValue(raw).toUpperCase().replace(/\s+/g, " ").trim();
  const map = {
    Employee02: "Employee02",
    "Employee05": "Employee05",
    Employee09: "Employee09",
    Employee13: "Employee13",
    TSIGIE: "Employee03",
    Employee04: "Employee04",
    Employee06: "Employee06",
    Employee07: "Employee07",
    Employee08: "Employee08",
    Employee10: "Employee10",
    Employee11: "Employee11",
    Employee12: "Employee12",
    Employee14: "Employee14",
    Employee15: "Employee15",
    Employee01: "Employee01",
  };
  return map[s] ?? (s.includes("Employee08") && s.includes("Employee07") ? "" : "");
}

function normalizeProject(raw) {
  const s = trimValue(raw).toUpperCase().replace(/\s+/g, "");
  if (!s || s === "/" || s === "-") return { code: "", review: true, note: "Project blank or placeholder" };
  if (s.includes(",") || s.includes("\n") || s.includes("&")) return { code: "", review: true, note: "Multiple project values in one historical row" };
  if (s === "SCSHOU") return { code: "DEMO_PROJECT_08", review: true, note: "SCSHOU treated as possible DEMO_PROJECT_08 alias" };
  const known = new Set(projects.map((p) => p[1]));
  return known.has(s) ? { code: s, review: false, note: "" } : { code: "", review: true, note: "Project not found in master" };
}

function findObjectCount(text) {
  const t = text.replace(/\r/g, " ").replace(/\n/g, " ");
  const explicit = t.match(/\b(\d+(?:\.\d+)?)\s+(?:equipments?|equipment|pipes?|pipe lines?|lines?|drawings?|units?|devices?)\b/i);
  if (explicit) return Number(explicit[1]);
  const ids = t.match(/\b[A-Z]{1,4}-\d{3,7}[A-Z]?(?:-[A-Z0-9]+){1,5}\b|\b[A-Z]{1,3}\d{3,7}[A-Z]?\b/g) ?? [];
  const filtered = ids.filter((x) => !/^M\d[A-Z]?$/.test(x));
  return filtered.length >= 2 ? filtered.length : null;
}

function suggestActivity(record) {
  const text = `${record.content} ${record.description}`.toLowerCase().replace(/\s+/g, " ");
  const result = { module: "", category: "", activity: "", activityId: "", quantity: null, confidence: "None", missing: [], review: true, reason: [] };
  if (record.role === "Manager") {
    result.reason.push("Manager record belongs to OKR scope, not M1/M2 ranking");
    result.missing.push("M1/M2 activity");
    result.confidence = "None";
    return result;
  }
  const qty = findObjectCount(`${record.content} ${record.description}`);
  if (qty !== null) result.quantity = qty;
  if (/insulat|thermal insulation/.test(text)) {
    result.module = "M2"; result.category = "图纸"; result.activity = "Thermal insulation summary table"; result.activityId = "M2-03"; result.confidence = "High";
  } else if (/anti[- ]?corrosion|corrosion treatment|防腐/.test(text)) {
    result.module = "M2"; result.category = "图纸"; result.activity = "External anti-corrosion summary table"; result.activityId = "M2-02"; result.confidence = "High";
  } else if (/support data|support plate|pipe support design|pipe support data/.test(text) && /table|sheet|data|design/.test(text)) {
    result.module = "M2"; result.category = "图纸"; result.activity = "Pipe support data sheet"; result.activityId = "M2-04"; result.confidence = "Medium";
  } else if (/layout|lay out|dimension|drawing|thumbnail|paper size|title block|pdf/.test(text)) {
    result.module = "M2"; result.category = "图纸"; result.activity = "Piping layout plan"; result.activityId = "M2-01"; result.confidence = "Medium";
  } else if (/\bmodif|revis|correction|adjust|suggestion/.test(text)) {
    result.module = "M1"; result.category = "模型修改"; result.activity = "Model modification"; result.activityId = ""; result.confidence = "Medium"; result.reason.push("M1-07 sub-type cannot be determined from text"); result.missing.push("M1-07 sub-type");
  } else if (/equipment|equipments|nozzle|reactor|heat exchanger|storage tank|pump|skid/.test(text) && /creat|model|body|support/.test(text)) {
    result.module = "M1"; result.category = "设备建模"; result.activity = "Equipment modeling"; result.confidence = "Medium";
    if (/reactor/.test(text)) result.activityId = "M1-03-A";
    else if (/heat exchanger/.test(text)) result.activityId = "M1-03-B";
    else if (/storage tank|tank/.test(text)) result.activityId = "M1-03-C";
    else if (/pump/.test(text)) result.activityId = "M1-03-D";
    else if (/skid/.test(text)) result.activityId = "M1-03-E";
    else { result.reason.push("Equipment subtype is not explicit"); result.missing.push("equipment subtype"); }
  } else if (/pipe|pipeline|piping|isometric/.test(text) && /creat|model|connect|connection|route|layout/.test(text)) {
    result.module = "M1"; result.category = "管道建模"; result.activity = "Pipeline modeling"; result.confidence = "Medium"; result.reason.push("M1-06 location/thermal subtype cannot be determined"); result.missing.push("M1-06 sub-type");
  } else if (/qa|q\/c|quality|check|review|approval|clash/.test(text)) {
    result.module = "M3"; result.category = /drawing|pdf|layout/.test(text) ? "图纸自检" : "模型自检"; result.activity = /drawing|pdf|layout/.test(text) ? "Internal self-check of drawings" : "Internal self-check of the model"; result.activityId = /drawing|pdf|layout/.test(text) ? "M3-02" : "M3-01"; result.confidence = "Medium"; result.reason.push("M3 is deferred this round"); result.missing.push("M3 activation decision");
  } else if (/wall|roof|floor|building|workshop structure|architectural/.test(text) && /creat|model|layout/.test(text)) {
    result.module = "M1"; result.category = "建筑/结构建模"; result.activity = "Architectural or structural modeling"; result.confidence = "Low"; result.reason.push("Cannot determine architectural vs structural and floor condition"); result.missing.push("M1-01/M1-02 variant");
  } else {
    result.reason.push("No conservative M1/M2 rule matched"); result.missing.push("activity"); result.confidence = "None";
  }
  if (result.quantity === null && result.module && result.module !== "M3") { result.missing.push("quantity"); result.reason.push("No explicit quantity or reliably countable ID list"); }
  if (result.activityId && result.activityId.startsWith("M3-")) result.review = true;
  else if (result.activityId && result.quantity !== null && result.missing.length === 0) { result.review = false; }
  return result;
}

function readDailyRecords() {
  const records = [];
  const definitions = [
    { sheet: "Manager1", roleDefault: "Manager", start: 4, map: { date: 1, name: 2, discipline: null, role: 3, project: null, area: null, content: 4, pages: 5, description: 6, hours: 7, status: 8, issue: 9, support: 10, coordination: 11, tomorrow: 12, remark: 13 } },
    { sheet: "team leader", roleDefault: "Team Leader", start: 3, map: { date: 1, name: 2, discipline: 3, role: 4, project: 5, area: 6, content: 7, pages: 8, description: 9, hours: 10, status: 11, issue: 12, support: 13, coordination: 14, tomorrow: 15, remark: 16 } },
    { sheet: "junior engineers", roleDefault: "Engineer", start: 3, map: { date: 1, name: 2, discipline: 3, role: null, project: 4, area: 5, content: 6, pages: 7, description: 8, hours: 9, status: 10, issue: 11, support: 12, learning: 13, tomorrow: 14, remark: 15 } },
  ];
  for (const def of definitions) {
    const ws = dailyValues.worksheets.getItem(def.sheet);
    const rows = ws.getUsedRange().values;
    let sourceNo = 0;
    for (let i = def.start - 1; i < rows.length; i += 1) {
      const row = rows[i] ?? [];
      const get = (key) => def.map[key] === null ? "" : row[def.map[key]];
      const rawName = textOrBlank(get("name"));
      const rawDate = get("date");
      const content = textOrBlank(get("content"));
      const description = textOrBlank(get("description"));
      if (!rawName && !rawDate && !content && !description) continue;
      if (!rawName && !rawDate) continue;
      sourceNo += 1;
      const normalized = normalizeName(rawName);
      const rawRole = textOrBlank(get("role"));
      const role = def.roleDefault === "Manager" ? "Manager" : (rawRole.toLowerCase().includes("leader") ? "Team Leader" : def.roleDefault);
      const record = {
        sourceFile: path.basename(sourceDaily), sourceSheet: def.sheet, sourceRow: i + 1, sourceNo,
        workDate: asDate(rawDate), rawName, normalizedName: normalized, role, discipline: textOrBlank(get("discipline")),
        rawProject: textOrBlank(get("project")), normalizedProject: normalizeProject(get("project")), area: textOrBlank(get("area")),
        content, description, pages: textOrBlank(get("pages")), hours: get("hours"), status: textOrBlank(get("status")),
        issue: textOrBlank(get("issue")), support: textOrBlank(get("support")), coordination: textOrBlank(get("coordination")),
        tomorrow: textOrBlank(get("tomorrow")), remark: textOrBlank(get("remark")),
      };
      record.originalText = [record.content, record.description].filter(Boolean).join(" | ");
      record.suggestion = suggestActivity(record);
      records.push(record);
    }
  }
  return records;
}

const migrationRecords = readDailyRecords();

function buildMigrationRows(records) {
  return records.map((r, idx) => {
    const s = r.suggestion;
    const missing = [...new Set(s.missing)];
    if (!r.normalizedName) missing.push("employee normalization");
    if (r.normalizedProject.review) missing.push("project normalization");
    const needsReview = r.role === "Manager" || s.review || missing.length > 0 || r.normalizedProject.review;
    const migrationStatus = r.role === "Manager" ? "Manager_OKR" : (s.activityId?.startsWith("M3-") ? "Deferred_M3" : (needsReview ? "Suggested_Review" : "Suggested_Mappable"));
    const reason = [...new Set([...(s.reason ?? []), r.normalizedProject.note, !r.normalizedName ? "Name not normalized to a unique master record" : ""].filter(Boolean))].join("; ");
    return [
      `MT-${String(idx + 1).padStart(4, "0")}`,
      r.sourceFile,
      r.sourceSheet,
      r.sourceRow,
      r.sourceNo,
      r.workDate,
      r.rawName,
      r.normalizedName,
      r.role,
      r.discipline,
      r.rawProject,
      r.normalizedProject.code,
      r.area,
      r.content,
      r.description,
      r.pages,
      typeof r.hours === "number" ? r.hours : textOrBlank(r.hours),
      r.status,
      r.originalText,
      s.activity,
      s.activityId,
      s.quantity,
      s.confidence,
      missing.join("; "),
      needsReview,
      migrationStatus,
      reason,
    ];
  });
}

const migrationRows = buildMigrationRows(migrationRecords);

const workbook = Workbook.create();
const readme = makeSheet(workbook, "README");
const fieldModel = makeSheet(workbook, "Field_Model");
const employeeMaster = makeSheet(workbook, "Employee_Master");
const teamMaster = makeSheet(workbook, "Team_Master");
const projectMaster = makeSheet(workbook, "Project_Master");
const activityMaster = makeSheet(workbook, "Activity_Master");
const statusConfig = makeSheet(workbook, "Status_Config");
const dailyLog = makeSheet(workbook, "Daily_Log");
const qualityEvent = makeSheet(workbook, "Quality_Event");
const employeeSummary = makeSheet(workbook, "Employee_Summary");
const teamSummary = makeSheet(workbook, "Team_Summary");
const projectSummary = makeSheet(workbook, "Project_Summary");
const migrationTest = makeSheet(workbook, "Migration_Test");
const quotaRaw = makeSheet(workbook, "Quota_Raw");
const quotaRawOriginal = makeSheet(workbook, "Quota_Raw_Original");

// README
applyTitle(readme, "A1:H1", "埃塞俄比亚办事处工程工作量量化系统 V0.1 / Ethiopia Office Engineering Workload Quantification System");
applyNote(readme, "A2:H2", "This is a formula-driven prototype for future database, API and form design. M1/M2 are enabled for testing; M3 and quality scoring are deliberately deferred. Historical logs are evidence for migration testing only, not new workload scores.");
readme.getRange("A4:B13").values = [
  ["项目目的 / Purpose", "让员工用结构化事实记录工作，使工作量可计算、可追溯、可程序化。"],
  ["启用范围 / Enabled scope", "M1 三维建模 + M2 图纸编制；经理采用 OKR 范围。"],
  ["当前统计开始 / Period start", new Date("2026-08-18")],
  ["当前统计结束 / Period end", new Date("2026-09-01")],
  ["工作量计算 / Calculation", "Base = Quantity × Standard_Quota；Effective = Base × Progress_Factor × Adjustment_Factor。"],
  ["示例记录 / Examples", "Daily_Log 中 Record_Status=Example 的行不进入汇总；改为 User Input 后才计入。"],
  ["下拉交互 / Interaction", "选择姓名、项目和工作路径；团队、角色、活动编码、单位、定额和系数自动关联。"],
  ["质量体系 / Quality", "Quality_Event 仅预留结构；不执行质量扣分，也不把质量系数混入基础工作量。"],
  ["原始数据 / Sources", "Quota_Raw、Quota_Raw_Original 和 Migration_Test 保留来源证据；原文件未覆盖。"],
  ["重要提醒 / Warning", "进度系数是 V0.1 暂定值，正式绩效制度使用前必须由业务确认。"],
];
readme.getRange("A4:A13").format = { fill: colors.blue, font: { bold: true, color: "#17365D" }, verticalAlignment: "center", wrapText: true };
readme.getRange("B4:B13").format = { verticalAlignment: "center", wrapText: true };
readme.getRange("B6:B7").format.numberFormat = "yyyy-mm-dd";
readme.getRange("A15:H15").values = [["数据源审计 / Source Audit", "文件", "工作表", "记录数", "日期范围", "作用", "版本关系", "备注"]];
styleHeader(readme, "A15:H15");
readme.getRange("A16:H19").values = [
  ["定额表", path.basename(sourceQuota), "基准工时定额表", "75 rows", "N/A", "当前定额来源", "当前工作版本", "已含 G 列活动编码"],
  ["原始定额备份", path.basename(sourceQuotaOriginal), "基准工时定额表", "75 rows", "N/A", "版本比对", "backup_20260904", "较早版本，保留原始布局"],
  ["历史统计", path.basename(sourceAugust), "Team Leaders / All Members / Team Performance", "4 teams + 10 members", "2026-08", "理解历史证据，不作为新评分", "历史结果", "No scoring / no direct hours"],
  ["历史日报", path.basename(sourceDaily), "Manager1 / team leader / junior engineers", `${migrationRecords.length} records`, "2026-08-18 to 2026-09-01", "迁移测试与字段反推", "历史原始数据", "41 + 87 + 244"],
];
styleTable(readme, "A16:H19", { left: "A16:H19" });
readme.getRange("A21:H21").values = [["颜色说明 / Color Legend", "黄色：员工输入", "绿色：系统关联", "蓝色：自动计算", "橙色：待审核/异常", "灰色：辅助范围", "", ""]];
readme.getRange("A21:H21").format = { fill: colors.grey, verticalAlignment: "center", wrapText: true };
readme.getRange("B21").format.fill = colors.input;
readme.getRange("C21").format.fill = colors.linked;
readme.getRange("D21").format.fill = colors.calculated;
readme.getRange("E21").format.fill = colors.warning;
readme.getRange("F21").format.fill = colors.grey;
readme.getRange("A23:H26").values = [
  ["使用步骤 / Steps", "1. 先维护 Employee_Master、Project_Master、Activity_Master。", "2. 在 Daily_Log 中填写黄色列。", "3. 检查 Data_Quality_Flag=OK。", "4. 查看三个 Summary。", "5. Migration_Test 仅供审核。", "", ""],
  ["新增主数据 / Add master data", "追加到相应 Master 表，并将对应 helper list 复制到 Daily_Log 右侧辅助区域。", "不要修改历史记录的 ID。", "", "", "", "", ""],
  ["活动选择 / Activity selection", "工作路径采用唯一显示路径下拉，不要求普通员工理解 Activity_ID。", "路径选中后 Module/Category/Activity_ID/Unit/Quota 自动回填。", "", "", "", "", ""],
  ["数据边界 / Boundaries", "历史日报不自动迁入 Daily_Log；AI/规则建议不直接产生最终工作量。", "M3、质量系数、组长管理因素和经理 OKR 不在本轮 M1/M2 汇总中。", "", "", "", "", ""],
];
readme.getRange("A23:A26").format = { fill: colors.blue, font: { bold: true, color: "#17365D" }, verticalAlignment: "center", wrapText: true };
readme.getRange("B23:H26").format = { verticalAlignment: "center", wrapText: true };
setWidths(readme, { A: 20, B: 36, C: 30, D: 24, E: 24, F: 28, G: 22, H: 28 });
readme.freezePanes.freezeRows(2);

// Field_Model
applyTitle(fieldModel, "A1:P1", "字段模型 / Field Model");
applyNote(fieldModel, "A2:P2", "Category: Fixed = fixed option; Linked = lookup-generated; Objective = factual user input; Subjective = human judgement reserved for review; Calculated = formula-driven. This table is the contract for future database/API/form work.");
fieldModel.getRange("A4:P4").values = [["Table", "Field_ID", "中文字段名", "English Name", "Category", "Data Type", "Required", "Editable", "Input By", "Source", "Depends On", "Validation", "Default", "Example", "Description", "Future DB Field"]];
styleHeader(fieldModel, "A4:P4");
fieldModel.getRange(`A5:P${4 + fieldRows.length}`).values = fieldRows;
styleTable(fieldModel, `A5:P${4 + fieldRows.length}`, { left: `A5:P${4 + fieldRows.length}` });
fieldModel.getRange(`G5:H${4 + fieldRows.length}`).format.horizontalAlignment = "center";
fieldModel.getRange(`E5:E${4 + fieldRows.length}`).format.horizontalAlignment = "center";
for (let i = 0; i < fieldRows.length; i += 1) {
  const row = 5 + i;
  const cat = fieldRows[i][4];
  const fill = cat === "Fixed" ? colors.input : cat === "Linked" ? colors.linked : cat === "Calculated" ? colors.calculated : cat === "Subjective" ? colors.warning : "#FFFFFF";
  fieldModel.getRange(`E${row}`).format.fill = fill;
}
addTable(fieldModel, `A4:P${4 + fieldRows.length}`, "FieldModelTable");
setWidths(fieldModel, { A: 16, B: 12, C: 18, D: 24, E: 13, F: 14, G: 10, H: 10, I: 16, J: 25, K: 24, L: 32, M: 15, N: 24, O: 38, P: 28 });
fieldModel.freezePanes.freezeRows(4);

// Master sheets
function writeMasterSheet(sheet, title, note, headers, rows, tableName, widths, dateCols = []) {
  const lastCol = headers.length;
  applyTitle(sheet, `${excelCol(1)}1:${excelCol(lastCol)}1`, title);
  applyNote(sheet, `${excelCol(1)}2:${excelCol(lastCol)}2`, note);
  sheet.getRange(`A4:${excelCol(lastCol)}4`).values = [headers];
  styleHeader(sheet, `A4:${excelCol(lastCol)}4`);
  if (rows.length) {
    sheet.getRange(`A5:${excelCol(lastCol)}${4 + rows.length}`).values = rows;
    styleTable(sheet, `A5:${excelCol(lastCol)}${4 + rows.length}`, { left: `A5:${excelCol(lastCol)}${4 + rows.length}` });
    addTable(sheet, `A4:${excelCol(lastCol)}${4 + rows.length}`, tableName);
  }
  for (const col of dateCols) sheet.getRange(`${col}5:${col}${4 + rows.length}`).format.numberFormat = "yyyy-mm-dd";
  setWidths(sheet, widths);
  sheet.freezePanes.freezeRows(4);
}

writeMasterSheet(employeeMaster, "员工主数据 / Employee Master", "Use Employee_ID as the stable key. Team and role may change over time; effective dates preserve historical meaning.", ["Employee_ID", "Name", "Chinese_Name", "Team_ID", "Role", "Effective_From", "Effective_To", "Enabled", "Workload_Scope", "Source_Notes"], employees, "EmployeeMasterTable", { A: 14, B: 18, C: 16, D: 12, E: 16, F: 16, G: 16, H: 10, I: 16, J: 42 }, ["F", "G"]);
writeMasterSheet(teamMaster, "团队主数据 / Team Master", "Team membership is referenced by Team_ID; formulas do not hard-code a person as a permanent team.", ["Team_ID", "Team_Name", "Team_Leader", "Enabled", "Source_Notes"], teams, "TeamMasterTable", { A: 12, B: 20, C: 20, D: 10, E: 48 });
writeMasterSheet(projectMaster, "项目主数据 / Project Master", "Canonical project codes are used for new entries. Suspected aliases remain visible in Alias_Notes and are not silently erased from Migration_Test.", ["Project_ID", "Project_Code", "Project_Name_CN", "Project_Name_EN", "Status", "Enabled", "Source_Notes", "Alias_Notes"], projects, "ProjectMasterTable", { A: 14, B: 20, C: 22, D: 22, E: 14, F: 10, G: 46, H: 28 });

// Activity_Master
applyTitle(activityMaster, "A1:X1", "结构化定额规则库 / Activity Master");
applyNote(activityMaster, "A2:X2", "One enabled Activity_ID must resolve to one unit, one calculation type and one standard quota. Original_Code is retained for compatibility; M3 rows are preserved but disabled.");
const activityHeaders = ["Activity_ID", "Activity_Path", "Module_ID", "Module_CN", "Module_EN", "Category_CN", "Category_EN", "Activity_CN", "Activity_EN", "Original_Code", "Description_CN", "Description_EN", "Calculation_Type", "Unit_CN", "Unit_EN", "Standard_Quota", "Formula_Rule", "Condition", "Note_CN", "Note_EN", "Enabled", "Version", "Derived_Factor", "Lookup_Activity_ID"];
activityMaster.getRange("A4:X4").values = [activityHeaders];
styleHeader(activityMaster, "A4:X4");
activityMaster.getRange(`A5:X${4 + activityRows.length}`).values = activityRows;
styleTable(activityMaster, `A5:X${4 + activityRows.length}`, { left: `A5:X${4 + activityRows.length}` });
activityMaster.getRange(`P5:P${4 + activityRows.length}`).format.numberFormat = "0.00";
activityMaster.getRange(`W5:W${4 + activityRows.length}`).format.numberFormat = "0.00";
activityMaster.getRange(`U5:U${4 + activityRows.length}`).format.horizontalAlignment = "center";
activityMaster.getRange(`U5:U${4 + activityRows.length}`).conditionalFormats.add("containsText", { text: "FALSE", format: { fill: colors.warning, font: { color: colors.red } } });
addTable(activityMaster, `A4:X${4 + activityRows.length}`, "ActivityMasterTable");
setWidths(activityMaster, { A: 14, B: 70, C: 10, D: 18, E: 24, F: 20, G: 24, H: 22, I: 30, J: 14, K: 34, L: 38, M: 24, N: 16, O: 20, P: 15, Q: 34, R: 34, S: 36, T: 38, U: 10, V: 18, W: 15, X: 18 });
activityMaster.freezePanes.freezeRows(4);

// Status_Config
applyTitle(statusConfig, "A1:L1", "状态与配置 / Status and Config");
applyNote(statusConfig, "A2:L2", "Progress_Factor and Adjustment_Factor are visible configuration values. Progress values are provisional V0.1 placeholders and must be confirmed before formal performance use.");
statusConfig.getRange("A4:D4").values = [["Completion_Status", "Progress_Factor", "Enabled", "Note"]];
styleHeader(statusConfig, "A4:D4");
statusConfig.getRange(`A5:D${4 + statusRows.length}`).values = statusRows;
styleTable(statusConfig, `A5:D${4 + statusRows.length}`);
statusConfig.getRange(`B5:B${4 + statusRows.length}`).format.numberFormat = "0.00";
addTable(statusConfig, `A4:D${4 + statusRows.length}`, "StatusConfigTable");
statusConfig.getRange("F4:G4").values = [["System_Default", "Value"]];
styleHeader(statusConfig, "F4:G4");
statusConfig.getRange("F5:G6").values = [["Default_Adjustment_Factor", 1], ["Daily_Log_Input_Capacity", 500]];
statusConfig.getRange("F5:F6").format = { fill: colors.blue, font: { bold: true, color: "#17365D" }, wrapText: true };
statusConfig.getRange("G5:G6").format = { fill: colors.input, horizontalAlignment: "right" };
statusConfig.getRange("G5").format.numberFormat = "0.00";
statusConfig.getRange("I4:J4").values = [["Work_Object_Type", "Enabled"]];
styleHeader(statusConfig, "I4:J4");
statusConfig.getRange(`I5:J${4 + workObjectTypes.length}`).values = workObjectTypes.map((r) => [r[0], true]);
styleTable(statusConfig, `I5:J${4 + workObjectTypes.length}`);
statusConfig.getRange("A12:B12").values = [["Record_Status", "Counts in summary?"]];
styleHeader(statusConfig, "A12:B12");
statusConfig.getRange(`A13:B${12 + recordStatuses.length}`).values = recordStatuses.map((r) => [r[0], r[0] === "User Input"]);
styleTable(statusConfig, `A13:B${12 + recordStatuses.length}`);
statusConfig.getRange("D12:E12").values = [["Confidence", "Review Meaning"]];
styleHeader(statusConfig, "D12:E12");
statusConfig.getRange(`D13:E${12 + confidenceValues.length}`).values = confidenceValues.map((r) => [r[0], r[0] === "High" ? "Clear enough for direct review" : r[0] === "Medium" ? "Candidate; check missing fields" : r[0] === "Low" ? "Weak candidate" : "No mapping"]);
styleTable(statusConfig, `D13:E${12 + confidenceValues.length}`);
statusConfig.getRange("G12:H12").values = [["Calculation_Type", "Meaning"]];
styleHeader(statusConfig, "G12:H12");
statusConfig.getRange(`G13:H${12 + calculationTypes.length}`).values = calculationTypes.map((r) => [r[0], r[0] === "MANUAL_REVIEW" ? "No automatic score" : r[0] === "DERIVED_FROM_ACTIVITY" ? "Uses Related_Record_ID" : "Quantity × Standard_Quota"]);
styleTable(statusConfig, `G13:H${12 + calculationTypes.length}`);
statusConfig.getRange("J12:L12").values = [["Scope Rule", "Value", "Note"]];
styleHeader(statusConfig, "J12:L12");
statusConfig.getRange("J13:L16").values = [
  ["Enabled_Modules", "M1; M2", "M3 remains disabled in V0.1"],
  ["Summary_Record_Status", "User Input", "Example and Review excluded"],
  ["Quality_Scoring", "OFF", "Quality_Event is structural only"],
  ["Manager_Scope", "OKR", "Excluded from ordinary M1/M2 ranking"],
];
styleTable(statusConfig, "J13:L16");
setWidths(statusConfig, { A: 24, B: 16, C: 12, D: 20, E: 34, F: 28, G: 18, H: 28, I: 22, J: 14, K: 22, L: 34 });
statusConfig.freezePanes.freezeRows(4);

// Daily_Log
applyTitle(dailyLog, "A1:AF1", "日报录入 / Daily Log");
applyNote(dailyLog, "A2:AF2", "Yellow columns are employee inputs. Green columns are linked. Blue columns are calculated. Set Record_Status=User Input only after checking Data_Quality_Flag=OK. Example rows are safe to delete or overwrite.");
const dailyHeaders = ["Record_ID", "Work_Date", "Employee_Name_Input", "Employee_ID", "Team_ID", "Team_Name", "Role", "Project_Code_Input", "Project_ID", "Unit_Area", "Activity_Path_Input", "Module", "Activity_Category", "Activity_ID", "Work_Object_Type", "Work_Object_ID", "Quantity", "Unit", "Calculation_Type", "Standard_Quota", "Activity_Enabled", "Completion_Status", "Progress_Factor", "Related_Record_ID", "Adjustment_Factor", "Base_Workload", "Effective_Workload", "Evidence", "Description", "Remark", "Record_Status", "Data_Quality_Flag"];
dailyLog.getRange("A4:AF4").values = [dailyHeaders];
styleHeader(dailyLog, "A4:AF4");
const dataStart = 5;
const dataEnd = 504;
const exampleInputs = [
  [new Date("2026-09-02"), "Employee02", "DEMO_PROJECT_08", "Main Plant", activityRows.find((r) => r[0] === "M2-01")[1], "Drawing", "LAYOUT-01", 1, "Completed", "Example", "Example A1 piping layout drawing"],
  [new Date("2026-09-02"), "Employee07", "DEMO_PROJECT_01", "Main Plant", activityRows.find((r) => r[0] === "M1-03-A")[1], "Equipment", "R080101", 2, "Completed", "Example", "Example reactor modeling"],
  [new Date("2026-09-02"), "Employee06", "DEMO_PROJECT_06", "Main Plant", activityRows.find((r) => r[0] === "M1-06-E")[1], "Pipe", "P-EXAMPLE-01", 10, "In Progress", "Example", "Example equipment connection pipe"],
  [new Date("2026-09-02"), "Employee11", "DEMO_PROJECT_01", "Main Plant", activityRows.find((r) => r[0] === "M1-07-A")[1], "Model", "MODEL-REV-01", 3, "Mostly Completed", "Example", "Example local modification"],
  [new Date("2026-09-02"), "Employee04", "DEMO_PROJECT_07", "Workshop-1", activityRows.find((r) => r[0] === "M1-01-A")[1], "Area / Building", "WORKSHOP-1", 1, "Started", "Example", "Example architectural modeling quantity in standard unit"],
  [new Date("2026-09-02"), "Employee03", "DEMO_PROJECT_04", "Main Plant", activityRows.find((r) => r[0] === "M2-04")[1], "Drawing", "SUPPORT-DATA-01", null, "Completed", "Example", "Example derived pipe support data sheet"],
];
const dailyValuesMatrix = Array.from({ length: dataEnd - dataStart + 1 }, () => Array(dailyHeaders.length).fill(null));
for (let i = 0; i < exampleInputs.length; i += 1) {
  const e = exampleInputs[i];
  const row = dailyValuesMatrix[i];
  row[1] = e[0]; row[2] = e[1]; row[7] = e[2]; row[9] = e[3]; row[10] = e[4]; row[14] = e[5]; row[15] = e[6]; row[16] = e[7]; row[21] = e[8]; row[27] = "Example evidence"; row[28] = e[10]; row[30] = e[9];
  if (e[4] === activityRows.find((r) => r[0] === "M2-04")[1]) row[23] = "DL-0004";
}
dailyLog.getRange(`A${dataStart}:AF${dataEnd}`).values = dailyValuesMatrix;
const dailyFormulaMatrix = [];
for (let r = dataStart; r <= dataEnd; r += 1) {
  const relatedBaseLookup = `IFERROR(INDEX($Z$${dataStart}:$Z$${dataEnd},VALUE(RIGHT($X${r},4))),"")`;
  dailyFormulaMatrix.push([
    `=IF(COUNTA(B${r}:C${r},H${r},K${r},O${r},Q${r},V${r},AE${r})=0,"","DL-"&TEXT(ROW()-4,"0000"))`,
    `=IFERROR(INDEX('Employee_Master'!$A$5:$A$104,MATCH($C${r},'Employee_Master'!$B$5:$B$104,0)),"")`,
    `=IFERROR(INDEX('Employee_Master'!$D$5:$D$104,MATCH($D${r},'Employee_Master'!$A$5:$A$104,0)),"")`,
    `=IFERROR(INDEX('Team_Master'!$B$5:$B$24,MATCH($E${r},'Team_Master'!$A$5:$A$24,0)),"")`,
    `=IFERROR(INDEX('Employee_Master'!$E$5:$E$104,MATCH($D${r},'Employee_Master'!$A$5:$A$104,0)),"")`,
    `=IFERROR(INDEX('Project_Master'!$A$5:$A$104,MATCH($H${r},'Project_Master'!$B$5:$B$104,0)),"")`,
    `=IFERROR(VLOOKUP($K${r},'Activity_Master'!$B$5:$X$104,2,0),"")`,
    `=IFERROR(VLOOKUP($K${r},'Activity_Master'!$B$5:$X$104,5,0),"")`,
    `=IFERROR(VLOOKUP($K${r},'Activity_Master'!$B$5:$X$104,23,0),"")`,
    `=IFERROR(VLOOKUP($N${r},'Activity_Master'!$A$5:$X$104,14,0),"")`,
    `=IFERROR(VLOOKUP($N${r},'Activity_Master'!$A$5:$X$104,13,0),"")`,
    `=IFERROR(VLOOKUP($N${r},'Activity_Master'!$A$5:$X$104,16,0),"")`,
    `=IFERROR(VLOOKUP($N${r},'Activity_Master'!$A$5:$X$104,21,0),"")`,
    `=IFERROR(INDEX('Status_Config'!$B$5:$B$8,MATCH($V${r},'Status_Config'!$A$5:$A$8,0)),"")`,
    `=IF($A${r}="","",'Status_Config'!$G$5)`,
    `=IF($S${r}="DERIVED_FROM_ACTIVITY",IF($X${r}="","",IF($X${r}=$A${r},"",IFERROR(${relatedBaseLookup}*VLOOKUP($N${r},'Activity_Master'!$A$5:$X$104,23,0),""))),IF($S${r}="MANUAL_REVIEW","",IF($Q${r}="","",$Q${r}*$T${r})))`,
    `=IF($Z${r}="","",$Z${r}*$W${r}*$Y${r})`,
    `=IF($A${r}="","",IF($G${r}="Manager","EXCLUDE_MANAGER_OKR",IF($B${r}="","MISSING_DATE",IF($C${r}="","MISSING_EMPLOYEE",IF($D${r}="","INVALID_EMPLOYEE",IF($H${r}="","MISSING_PROJECT",IF($I${r}="","INVALID_PROJECT",IF($K${r}="","MISSING_ACTIVITY",IF($N${r}="","INVALID_ACTIVITY",IF($U${r}=0,"DISABLED_ACTIVITY",IF($V${r}="","MISSING_STATUS",IF($S${r}="DERIVED_FROM_ACTIVITY",IF($X${r}="","MISSING_OR_SELF_LINK",IF($X${r}=$A${r},"MISSING_OR_SELF_LINK","OK")),IF($Q${r}="","MISSING_QUANTITY",IF($Q${r}<0,"NEGATIVE_QUANTITY",IF($S${r}="MANUAL_REVIEW","NEEDS_REVIEW","OK")))))))))))))))`,
  ]);
}
// Formula destinations are D/E/F/G/I/L/M/N/R/S/T/U/W/Y/Z/AA/AF.
dailyLog.getRange(`D${dataStart}:G${dataEnd}`).formulas = dailyFormulaMatrix.map((x) => x.slice(1, 5));
dailyLog.getRange(`I${dataStart}:I${dataEnd}`).formulas = dailyFormulaMatrix.map((x) => [x[5]]);
dailyLog.getRange(`L${dataStart}:N${dataEnd}`).formulas = dailyFormulaMatrix.map((x) => [x[6], x[7], x[8]]);
dailyLog.getRange(`R${dataStart}:U${dataEnd}`).formulas = dailyFormulaMatrix.map((x) => [x[9], x[10], x[11], x[12]]);
dailyLog.getRange(`W${dataStart}:W${dataEnd}`).formulas = dailyFormulaMatrix.map((x) => [x[13]]);
dailyLog.getRange(`Y${dataStart}:AA${dataEnd}`).formulas = dailyFormulaMatrix.map((x) => [x[14], x[15], x[16]]);
dailyLog.getRange(`AF${dataStart}:AF${dataEnd}`).formulas = dailyFormulaMatrix.map((x) => [x[17]]);
dailyLog.getRange(`A${dataStart}:A${dataEnd}`).formulas = dailyFormulaMatrix.map((x) => [x[0]]);
dailyLog.getRange(`B${dataStart}:B${dataEnd}`).format.numberFormat = "yyyy-mm-dd";
dailyLog.getRange(`Q${dataStart}:Q${dataEnd}`).format.numberFormat = "0.00";
dailyLog.getRange(`T${dataStart}:T${dataEnd}`).format.numberFormat = "0.00";
dailyLog.getRange(`W${dataStart}:W${dataEnd}`).format.numberFormat = "0.00";
dailyLog.getRange(`Y${dataStart}:AA${dataEnd}`).format.numberFormat = "0.00";
styleTable(dailyLog, `A${dataStart}:AF${dataEnd}`, { wrapText: true });
dailyLog.getRange(`B${dataStart}:C${dataEnd}`).format.fill = colors.input;
dailyLog.getRange(`H${dataStart}:H${dataEnd}`).format.fill = colors.input;
dailyLog.getRange(`J${dataStart}:K${dataEnd}`).format.fill = colors.input;
dailyLog.getRange(`O${dataStart}:Q${dataEnd}`).format.fill = colors.input;
dailyLog.getRange(`V${dataStart}:V${dataEnd}`).format.fill = colors.input;
dailyLog.getRange(`X${dataStart}:X${dataEnd}`).format.fill = colors.input;
dailyLog.getRange(`AB${dataStart}:AE${dataEnd}`).format.fill = colors.input;
for (const c of ["D", "E", "F", "G", "I", "L", "M", "N", "R", "S", "T", "U"]) dailyLog.getRange(`${c}${dataStart}:${c}${dataEnd}`).format.fill = colors.linked;
for (const c of ["A", "W", "Y", "Z", "AA", "AF"]) dailyLog.getRange(`${c}${dataStart}:${c}${dataEnd}`).format.fill = colors.calculated;
dailyLog.getRange(`AF${dataStart}:AF${dataEnd}`).conditionalFormats.add("containsText", { text: "OK", format: { fill: "#E2F0D9", font: { color: "#006100", bold: true } } });
dailyLog.getRange(`AF${dataStart}:AF${dataEnd}`).conditionalFormats.add("containsText", { text: "MISSING", format: { fill: colors.warning, font: { color: colors.red, bold: true } } });
dailyLog.getRange(`AF${dataStart}:AF${dataEnd}`).conditionalFormats.add("containsText", { text: "INVALID", format: { fill: colors.warning, font: { color: colors.red, bold: true } } });
dailyLog.getRange(`AF${dataStart}:AF${dataEnd}`).conditionalFormats.add("containsText", { text: "NEEDS_REVIEW", format: { fill: colors.warning, font: { color: colors.orange, bold: true } } });

// Helper ranges on the same sheet keep data validation compatible with ordinary Excel.
dailyLog.getRange("AH2:AM2").values = [["Helper lists — do not edit directly", "", "", "", "", ""]];
dailyLog.getRange("AH2:AM2").merge();
dailyLog.getRange("AH2:AM2").format = { fill: colors.grey, font: { bold: true, color: colors.darkGrey }, wrapText: true };
const helperHeaders = [["Employee_Name_List", "Project_Code_List", "Activity_Path_List", "Work_Object_Type_List", "Completion_Status_List", "Record_Status_List"]];
dailyLog.getRange("AH4:AM4").values = helperHeaders;
styleHeader(dailyLog, "AH4:AM4");
const helperLen = Math.max(100, employees.length, projects.length, activityRows.length, workObjectTypes.length, statusRows.length, recordStatuses.length);
const helperMatrix = Array.from({ length: helperLen }, (_, i) => [employees[i]?.[1] ?? null, projects[i]?.[1] ?? null, activityRows.filter((r) => r[20] === true)[i]?.[1] ?? null, workObjectTypes[i]?.[0] ?? null, statusRows[i]?.[0] ?? null, recordStatuses[i]?.[0] ?? null]);
dailyLog.getRange(`AH5:AM${4 + helperLen}`).values = helperMatrix;
styleTable(dailyLog, `AH5:AM${4 + helperLen}`);
dailyLog.getRange(`AH5:AM${4 + helperLen}`).format.fill = colors.grey;
dailyLog.dataValidations.add({ range: `C${dataStart}:C${dataEnd}`, rule: { type: "list", formula1: `=$AH$5:$AH$${4 + employees.length}` } });
dailyLog.dataValidations.add({ range: `H${dataStart}:H${dataEnd}`, rule: { type: "list", formula1: `=$AI$5:$AI$${4 + projects.length}` } });
dailyLog.dataValidations.add({ range: `K${dataStart}:K${dataEnd}`, rule: { type: "list", formula1: `=$AJ$5:$AJ$${4 + activityRows.filter((r) => r[20] === true).length}` } });
dailyLog.dataValidations.add({ range: `O${dataStart}:O${dataEnd}`, rule: { type: "list", formula1: `=$AK$5:$AK$${4 + workObjectTypes.length}` } });
dailyLog.dataValidations.add({ range: `V${dataStart}:V${dataEnd}`, rule: { type: "list", formula1: `=$AL$5:$AL$${4 + statusRows.length}` } });
dailyLog.dataValidations.add({ range: `AE${dataStart}:AE${dataEnd}`, rule: { type: "list", formula1: `=$AM$5:$AM$${4 + recordStatuses.length}` } });
dailyLog.dataValidations.add({ range: `Q${dataStart}:Q${dataEnd}`, rule: { type: "decimal", operator: "greaterThanOrEqual", formula1: 0 } });
dailyLog.dataValidations.add({ range: `B${dataStart}:B${dataEnd}`, rule: { type: "date", operator: "between", formula1: "DATE(2020,1,1)", formula2: "DATE(2100,12,31)" } });
addTable(dailyLog, `A4:AF${dataEnd}`, "DailyLogTable");
setWidths(dailyLog, { A: 13, B: 13, C: 18, D: 13, E: 11, F: 16, G: 15, H: 18, I: 13, J: 18, K: 70, L: 10, M: 20, N: 13, O: 18, P: 24, Q: 12, R: 16, S: 24, T: 14, U: 14, V: 17, W: 16, X: 16, Y: 14, Z: 15, AA: 17, AB: 24, AC: 42, AD: 24, AE: 14, AF: 24, AH: 20, AI: 20, AJ: 70, AK: 22, AL: 20, AM: 16 });
dailyLog.freezePanes.freezeRows(4);
dailyLog.freezePanes.freezeColumns(3);

// Quality_Event
applyTitle(qualityEvent, "A1:M1", "质量事件预留 / Quality Event (Structure Only)");
applyNote(qualityEvent, "A2:M2", "V0.1 does not calculate quality deductions. This table is a future event ledger and remains independent from base workload calculation.");
const qualityHeaders = ["Quality_Event_ID", "Event_Date", "Project_ID", "Employee_ID", "Reviewer_ID", "Related_Record_ID", "Issue_Type", "Severity", "Responsibility", "Adjustment", "Description", "Evidence", "Enabled"];
qualityEvent.getRange("A4:M4").values = [qualityHeaders];
styleHeader(qualityEvent, "A4:M4");
qualityEvent.getRange("A5:M7").values = [
  ["QE-EXAMPLE-01", new Date("2026-09-02"), "PRJ-006", "EMP-006", "EMP-005", "DL-0003", "Example - connection clarification", "Review", "待确认", null, "Example only; no deduction", "", false],
  [null, null, null, null, null, null, null, null, null, null, null, null, false],
  [null, null, null, null, null, null, null, null, null, null, null, null, false],
];
styleTable(qualityEvent, "A5:M7");
qualityEvent.getRange("B5:B7").format.numberFormat = "yyyy-mm-dd";
qualityEvent.getRange("M5:M7").format.fill = colors.grey;
addTable(qualityEvent, "A4:M7", "QualityEventTable");
setWidths(qualityEvent, { A: 20, B: 14, C: 14, D: 14, E: 14, F: 16, G: 28, H: 14, I: 18, J: 14, K: 42, L: 28, M: 10 });
qualityEvent.freezePanes.freezeRows(4);

// Summary sheets
function summaryPeriodHeader(sheet, title, lastCol) {
  applyTitle(sheet, `A1:${excelCol(lastCol)}1`, title);
  sheet.getRange("A2:D2").values = [["统计开始 / Period Start", new Date("2026-08-18"), "统计结束 / Period End", new Date("2026-09-01")]];
  sheet.getRange("A2:D2").format = { fill: colors.blue, font: { bold: true, color: "#17365D" }, wrapText: true };
  sheet.getRange("B2").format.numberFormat = "yyyy-mm-dd";
  sheet.getRange("D2").format.numberFormat = "yyyy-mm-dd";
  sheet.getRange(`F2:${excelCol(lastCol)}2`).merge();
  sheet.getRange(`F2:${excelCol(lastCol)}2`).values = [["Only Daily_Log rows with Record_Status=User Input and Data_Quality_Flag=OK are included. Change period cells to recalculate summaries."]];
  sheet.getRange(`F2:${excelCol(lastCol)}2`).format = { fill: colors.lightBlue, font: { color: colors.darkGrey }, wrapText: true };
}

summaryPeriodHeader(employeeSummary, "员工汇总 / Employee Summary", 11);
employeeSummary.getRange("A4:K4").values = [["Employee_ID", "Employee", "Team", "Role", "Workload_Scope", "M1 Workload", "M2 Workload", "Total Workload", "Valid Record Count", "Project Count", "Notes"]];
styleHeader(employeeSummary, "A4:K4");
const empSummaryRows = employees.map((e) => [e[0], e[1], null, e[4], e[8], null, null, null, null, null, e[4] === "OKR" ? "Excluded from ordinary M1/M2 ranking" : ""]);
employeeSummary.getRange("A5:K19").values = empSummaryRows;
const empFormulas = employees.map((_, idx) => {
  const r = 5 + idx;
  const distinctProjects = `IFERROR(SUMPRODUCT(('Daily_Log'!$D$${dataStart}:$D$${dataEnd}=$A${r})*('Daily_Log'!$I$${dataStart}:$I$${dataEnd}<>"")*('Daily_Log'!$AE$${dataStart}:$AE$${dataEnd}="User Input")*('Daily_Log'!$AF$${dataStart}:$AF$${dataEnd}="OK")/COUNTIFS('Daily_Log'!$D$${dataStart}:$D$${dataEnd},'Daily_Log'!$D$${dataStart}:$D$${dataEnd},'Daily_Log'!$I$${dataStart}:$I$${dataEnd},'Daily_Log'!$I$${dataStart}:$I$${dataEnd})),0)`;
  return [
    `=IFERROR(INDEX('Team_Master'!$B$5:$B$24,MATCH(INDEX('Employee_Master'!$D$5:$D$104,MATCH($A${r},'Employee_Master'!$A$5:$A$104,0)),'Team_Master'!$A$5:$A$24,0)),"")`,
    `=IF($E${r}="OKR",0,SUMIFS('Daily_Log'!$AA$${dataStart}:$AA$${dataEnd},'Daily_Log'!$D$${dataStart}:$D$${dataEnd},$A${r},'Daily_Log'!$L$${dataStart}:$L$${dataEnd},"M1",'Daily_Log'!$B$${dataStart}:$B$${dataEnd},">="&$B$2,'Daily_Log'!$B$${dataStart}:$B$${dataEnd},"<="&$D$2,'Daily_Log'!$AE$${dataStart}:$AE$${dataEnd},"User Input",'Daily_Log'!$AF$${dataStart}:$AF$${dataEnd},"OK"))`,
    `=IF($E${r}="OKR",0,SUMIFS('Daily_Log'!$AA$${dataStart}:$AA$${dataEnd},'Daily_Log'!$D$${dataStart}:$D$${dataEnd},$A${r},'Daily_Log'!$L$${dataStart}:$L$${dataEnd},"M2",'Daily_Log'!$B$${dataStart}:$B$${dataEnd},">="&$B$2,'Daily_Log'!$B$${dataStart}:$B$${dataEnd},"<="&$D$2,'Daily_Log'!$AE$${dataStart}:$AE$${dataEnd},"User Input",'Daily_Log'!$AF$${dataStart}:$AF$${dataEnd},"OK"))`,
    `=F${r}+G${r}`,
    `=IF($E${r}="OKR",0,COUNTIFS('Daily_Log'!$D$${dataStart}:$D$${dataEnd},$A${r},'Daily_Log'!$B$${dataStart}:$B$${dataEnd},">="&$B$2,'Daily_Log'!$B$${dataStart}:$B$${dataEnd},"<="&$D$2,'Daily_Log'!$AE$${dataStart}:$AE$${dataEnd},"User Input",'Daily_Log'!$AF$${dataStart}:$AF$${dataEnd},"OK"))`,
    `=IF($E${r}="OKR",0,${distinctProjects})`,
  ];
});
employeeSummary.getRange("C5:C19").formulas = empFormulas.map((x) => [x[0]]);
employeeSummary.getRange("F5:J19").formulas = empFormulas.map((x) => x.slice(1));
styleTable(employeeSummary, "A5:K19");
employeeSummary.getRange("F5:J19").format.numberFormat = "0.00";
employeeSummary.getRange("I5:J19").format.numberFormat = "0";
employeeSummary.getRange("A5:E19").format.fill = colors.linked;
employeeSummary.getRange("F5:J19").format.fill = colors.calculated;
addTable(employeeSummary, "A4:K19", "EmployeeSummaryTable");
setWidths(employeeSummary, { A: 14, B: 18, C: 18, D: 16, E: 16, F: 15, G: 15, H: 15, I: 16, J: 14, K: 38 });
employeeSummary.freezePanes.freezeRows(4);

summaryPeriodHeader(teamSummary, "团队汇总 / Team Summary", 10);
teamSummary.getRange("A4:J4").values = [["Team_ID", "Team", "Team Leader", "Member Count", "M1 Workload", "M2 Workload", "Total Workload", "Valid Record Count", "Project Count", "Notes"]];
styleHeader(teamSummary, "A4:J4");
teamSummary.getRange("A5:J8").values = teams.map((t) => [t[0], t[1], t[2], null, null, null, null, null, null, "M1/M2 only; manager excluded"]);
const teamFormulas = teams.map((_, idx) => {
  const r = 5 + idx;
  const distinctProjects = `IFERROR(SUMPRODUCT(('Daily_Log'!$E$${dataStart}:$E$${dataEnd}=$A${r})*('Daily_Log'!$I$${dataStart}:$I$${dataEnd}<>"")*('Daily_Log'!$AE$${dataStart}:$AE$${dataEnd}="User Input")*('Daily_Log'!$AF$${dataStart}:$AF$${dataEnd}="OK")/COUNTIFS('Daily_Log'!$E$${dataStart}:$E$${dataEnd},'Daily_Log'!$E$${dataStart}:$E$${dataEnd},'Daily_Log'!$I$${dataStart}:$I$${dataEnd},'Daily_Log'!$I$${dataStart}:$I$${dataEnd})),0)`;
  return [
    `=COUNTIFS('Employee_Master'!$D$5:$D$104,$A${r},'Employee_Master'!$I$5:$I$104,"M1+M2")`,
    `=SUMIFS('Daily_Log'!$AA$${dataStart}:$AA$${dataEnd},'Daily_Log'!$E$${dataStart}:$E$${dataEnd},$A${r},'Daily_Log'!$L$${dataStart}:$L$${dataEnd},"M1",'Daily_Log'!$B$${dataStart}:$B$${dataEnd},">="&$B$2,'Daily_Log'!$B$${dataStart}:$B$${dataEnd},"<="&$D$2,'Daily_Log'!$AE$${dataStart}:$AE$${dataEnd},"User Input",'Daily_Log'!$AF$${dataStart}:$AF$${dataEnd},"OK")`,
    `=SUMIFS('Daily_Log'!$AA$${dataStart}:$AA$${dataEnd},'Daily_Log'!$E$${dataStart}:$E$${dataEnd},$A${r},'Daily_Log'!$L$${dataStart}:$L$${dataEnd},"M2",'Daily_Log'!$B$${dataStart}:$B$${dataEnd},">="&$B$2,'Daily_Log'!$B$${dataStart}:$B$${dataEnd},"<="&$D$2,'Daily_Log'!$AE$${dataStart}:$AE$${dataEnd},"User Input",'Daily_Log'!$AF$${dataStart}:$AF$${dataEnd},"OK")`,
    `=E${r}+F${r}`,
    `=COUNTIFS('Daily_Log'!$E$${dataStart}:$E$${dataEnd},$A${r},'Daily_Log'!$B$${dataStart}:$B$${dataEnd},">="&$B$2,'Daily_Log'!$B$${dataStart}:$B$${dataEnd},"<="&$D$2,'Daily_Log'!$AE$${dataStart}:$AE$${dataEnd},"User Input",'Daily_Log'!$AF$${dataStart}:$AF$${dataEnd},"OK")`,
    `=${distinctProjects}`,
  ];
});
teamSummary.getRange("D5:I8").formulas = teamFormulas;
styleTable(teamSummary, "A5:J8");
teamSummary.getRange("D5:D8").format.numberFormat = "0";
teamSummary.getRange("E5:G8").format.numberFormat = "0.00";
teamSummary.getRange("H5:I8").format.numberFormat = "0";
teamSummary.getRange("A5:C8").format.fill = colors.linked;
teamSummary.getRange("D5:I8").format.fill = colors.calculated;
addTable(teamSummary, "A4:J8", "TeamSummaryTable");
setWidths(teamSummary, { A: 12, B: 18, C: 20, D: 14, E: 15, F: 15, G: 15, H: 18, I: 14, J: 32 });
teamSummary.freezePanes.freezeRows(4);

summaryPeriodHeader(projectSummary, "项目汇总 / Project Summary", 10);
projectSummary.getRange("A4:J4").values = [["Project_ID", "Project_Code", "Project_Name_CN", "Status", "People Involved", "M1 Workload", "M2 Workload", "Total Workload", "Valid Record Count", "Notes"]];
styleHeader(projectSummary, "A4:J4");
projectSummary.getRange("A5:J12").values = projects.map((p) => [p[0], p[1], p[2], p[4], null, null, null, null, null, p[7] ? `Alias: ${p[7]} needs confirmation` : ""]);
const projectFormulas = projects.map((_, idx) => {
  const r = 5 + idx;
  const people = `IFERROR(SUMPRODUCT(('Daily_Log'!$I$${dataStart}:$I$${dataEnd}=$A${r})*('Daily_Log'!$D$${dataStart}:$D$${dataEnd}<>"")*('Daily_Log'!$AE$${dataStart}:$AE$${dataEnd}="User Input")*('Daily_Log'!$AF$${dataStart}:$AF$${dataEnd}="OK")/COUNTIFS('Daily_Log'!$I$${dataStart}:$I$${dataEnd},'Daily_Log'!$I$${dataStart}:$I$${dataEnd},'Daily_Log'!$D$${dataStart}:$D$${dataEnd},'Daily_Log'!$D$${dataStart}:$D$${dataEnd})),0)`;
  return [
    `=${people}`,
    `=SUMIFS('Daily_Log'!$AA$${dataStart}:$AA$${dataEnd},'Daily_Log'!$I$${dataStart}:$I$${dataEnd},$A${r},'Daily_Log'!$L$${dataStart}:$L$${dataEnd},"M1",'Daily_Log'!$B$${dataStart}:$B$${dataEnd},">="&$B$2,'Daily_Log'!$B$${dataStart}:$B$${dataEnd},"<="&$D$2,'Daily_Log'!$AE$${dataStart}:$AE$${dataEnd},"User Input",'Daily_Log'!$AF$${dataStart}:$AF$${dataEnd},"OK")`,
    `=SUMIFS('Daily_Log'!$AA$${dataStart}:$AA$${dataEnd},'Daily_Log'!$I$${dataStart}:$I$${dataEnd},$A${r},'Daily_Log'!$L$${dataStart}:$L$${dataEnd},"M2",'Daily_Log'!$B$${dataStart}:$B$${dataEnd},">="&$B$2,'Daily_Log'!$B$${dataStart}:$B$${dataEnd},"<="&$D$2,'Daily_Log'!$AE$${dataStart}:$AE$${dataEnd},"User Input",'Daily_Log'!$AF$${dataStart}:$AF$${dataEnd},"OK")`,
    `=F${r}+G${r}`,
    `=COUNTIFS('Daily_Log'!$I$${dataStart}:$I$${dataEnd},$A${r},'Daily_Log'!$B$${dataStart}:$B$${dataEnd},">="&$B$2,'Daily_Log'!$B$${dataStart}:$B$${dataEnd},"<="&$D$2,'Daily_Log'!$AE$${dataStart}:$AE$${dataEnd},"User Input",'Daily_Log'!$AF$${dataStart}:$AF$${dataEnd},"OK")`,
  ];
});
projectSummary.getRange("E5:I12").formulas = projectFormulas;
styleTable(projectSummary, "A5:J12");
projectSummary.getRange("E5:E12").format.numberFormat = "0";
projectSummary.getRange("F5:H12").format.numberFormat = "0.00";
projectSummary.getRange("I5:I12").format.numberFormat = "0";
projectSummary.getRange("A5:D12").format.fill = colors.linked;
projectSummary.getRange("E5:I12").format.fill = colors.calculated;
addTable(projectSummary, "A4:J12", "ProjectSummaryTable");
setWidths(projectSummary, { A: 14, B: 20, C: 22, D: 14, E: 16, F: 15, G: 15, H: 15, I: 18, J: 36 });
projectSummary.freezePanes.freezeRows(4);

// Migration_Test
applyTitle(migrationTest, "A1:AA1", "历史迁移测试 / Migration Test");
applyNote(migrationTest, "A2:AA2", "These are rule-assisted suggestions only. Original text is retained. A row is not migrated into Daily_Log and never becomes a score without human-confirmed structured inputs.");
const migrationHeaders = ["Migration_Test_ID", "Source_File", "Source_Sheet", "Source_Row", "Source_Record_No", "Work_Date", "Original_Name", "Normalized_Employee", "Role", "Discipline", "Original_Project", "Suggested_Project", "Unit_Area", "Work_Content", "Specific_Description", "Pages", "Hours_Original", "Status_Original", "Original_Text", "Suggested_Activity", "Suggested_Activity_ID", "Suggested_Quantity", "Confidence", "Missing_Fields", "Needs_Review", "Migration_Status", "Reason"];
migrationTest.getRange("A4:AA4").values = [migrationHeaders];
styleHeader(migrationTest, "A4:AA4");
migrationTest.getRange(`A5:AA${4 + migrationRows.length}`).values = migrationRows;
styleTable(migrationTest, `A5:AA${4 + migrationRows.length}`, { wrapText: true });
migrationTest.getRange(`F5:F${4 + migrationRows.length}`).format.numberFormat = "yyyy-mm-dd";
migrationTest.getRange(`Q5:Q${4 + migrationRows.length}`).format.numberFormat = "0.00";
migrationTest.getRange(`V5:V${4 + migrationRows.length}`).format.numberFormat = "0.00";
migrationTest.getRange(`Y5:Y${4 + migrationRows.length}`).format.horizontalAlignment = "center";
migrationTest.getRange(`Y5:Y${4 + migrationRows.length}`).conditionalFormats.add("containsText", { text: "TRUE", format: { fill: colors.warning, font: { color: colors.red, bold: true } } });
migrationTest.getRange(`Z5:Z${4 + migrationRows.length}`).conditionalFormats.add("containsText", { text: "Suggested_Mappable", format: { fill: colors.linked } });
migrationTest.getRange(`Z5:Z${4 + migrationRows.length}`).conditionalFormats.add("containsText", { text: "Manager_OKR", format: { fill: colors.grey, font: { color: colors.darkGrey } } });
migrationTest.getRange(`Z5:Z${4 + migrationRows.length}`).conditionalFormats.add("containsText", { text: "Deferred_M3", format: { fill: colors.warning, font: { color: colors.orange } } });
addTable(migrationTest, `A4:AA${4 + migrationRows.length}`, "MigrationTestTable");
setWidths(migrationTest, { A: 18, B: 40, C: 18, D: 12, E: 16, F: 13, G: 18, H: 20, I: 16, J: 14, K: 20, L: 20, M: 20, N: 42, O: 60, P: 12, Q: 14, R: 18, S: 70, T: 36, U: 20, V: 18, W: 13, X: 34, Y: 14, Z: 18, AA: 60 });
migrationTest.freezePanes.freezeRows(4);

// Quota raw sheets
function writeQuotaRaw(sheet, title, values, note, isCurrent) {
  applyTitle(sheet, "A1:G1", title);
  applyNote(sheet, "A2:G2", note);
  const rows = padRows(values, 7);
  const bodyRows = rows.slice(3);
  const bodyEnd = 3 + bodyRows.length;
  sheet.getRange(`A4:G${bodyEnd}`).values = bodyRows;
  // Restore the source's visible bilingual section bands without using merged cells in data tables.
  for (const r of [4, 5, 50, 51, 64, 65]) {
    if (r <= bodyEnd) {
      sheet.getRange(`A${r}:G${r}`).format = { fill: colors.blue, font: { bold: true, color: "#17365D" }, wrapText: true };
    }
  }
  sheet.getRange(`A4:G${bodyEnd}`).format = { verticalAlignment: "center", wrapText: true };
  sheet.getRange("A4:G5").format = { fill: colors.blue, font: { bold: true, color: "#17365D" }, wrapText: true };
  sheet.getRange(`D7:D${bodyEnd}`).format.numberFormat = "0.00";
  sheet.getRange(`G4:G${bodyEnd}`).format.horizontalAlignment = "center";
  sheet.getRange(`A4:G${bodyEnd}`).format.borders = { preset: "inside", style: "thin", color: colors.border };
  setWidths(sheet, { A: 28, B: 46, C: 30, D: 12, E: 12, F: 52, G: 14 });
  sheet.freezePanes.freezeRows(5);
}
writeQuotaRaw(quotaRaw, "原始定额表（当前工作版本） / Quota Raw (Current)", quotaValues, "Copied from the current root file without changing source files. Activity codes in column G are retained for structured master generation.", true);
writeQuotaRaw(quotaRawOriginal, "原始定额表（备份版本） / Quota Raw (Backup)", quotaOriginalValues, "Copied from backup_20260904 for version comparison. This sheet is evidence only and is not used directly by formulas.", false);

// Recalculate/export and verify.
const outputXlsxPath = path.join(outputDir, "Workload_Quantification_System_V0.1.xlsx");
const xlsxBlob = await SpreadsheetFile.exportXlsx(workbook);
await xlsxBlob.save(outputXlsxPath);

const reopened = await SpreadsheetFile.importXlsx(await FileBlob.load(outputXlsxPath));
const keyInspect = await reopened.inspect({ kind: "table", sheetId: "Daily_Log", range: "A4:AF10", include: "values,formulas", tableMaxRows: 8, tableMaxCols: 32, maxChars: 12000 });
console.log("KEY_INSPECT\n" + keyInspect.ndjson);
const formulaErrors = await reopened.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 300 }, summary: "final formula error scan" });
console.log("FORMULA_ERRORS\n" + formulaErrors.ndjson);
const sheetInspect = await reopened.inspect({ kind: "sheet", include: "id,name" });
console.log("SHEETS\n" + sheetInspect.ndjson);

const renderRanges = {
  README: "A1:H26",
  Field_Model: `A1:P${4 + fieldRows.length}`,
  Employee_Master: "A1:J20",
  Team_Master: "A1:E9",
  Project_Master: "A1:H13",
  Activity_Master: `A1:X${4 + activityRows.length}`,
  Status_Config: "A1:L22",
  Daily_Log: "A1:AF16",
  Quality_Event: "A1:M8",
  Employee_Summary: "A1:K20",
  Team_Summary: "A1:J9",
  Project_Summary: "A1:J13",
  Migration_Test: "A1:AA20",
  Quota_Raw: "A1:G75",
  Quota_Raw_Original: "A1:G75",
};
for (const [sheetName, renderRange] of Object.entries(renderRanges)) {
  const preview = await reopened.render({ sheetName, range: renderRange, autoCrop: "all", scale: 1, format: "png" });
  const safe = sheetName.replace(/[^A-Za-z0-9_-]+/g, "_");
await fs.writeFile(path.join(qaDir, `${safe}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const statusCounts = {};
for (const row of migrationRows) statusCounts[row[25]] = (statusCounts[row[25]] ?? 0) + 1;
const directCount = statusCounts.Suggested_Mappable ?? 0;
const reviewCount = statusCounts.Suggested_Review ?? 0;
const managerCount = statusCounts.Manager_OKR ?? 0;
const deferredCount = statusCounts.Deferred_M3 ?? 0;
const designDoc = `# 字段模型与 Excel 原型设计说明

## 1. 数据源

本次审计读取了以下文件：

备份定额表位于 \`backup_20260904\`，当前根目录定额表作为工作版本，二者均以只读方式复制到本工作簿。

| 文件 | 工作表/范围 | 作用 |
|---|---|---|
| ${path.basename(sourceQuota)} | 基准工时定额表，75 行 | 当前定额规则来源，复制到 Quota_Raw |
| ${path.relative(baseDir, sourceQuotaOriginal).replaceAll(path.sep, "/")} | 基准工时定额表，75 行 | 备份版本，用于版本关系说明，复制到 Quota_Raw_Original |
| ${path.basename(sourceAugust)} | Team Leaders、All Members、Team Performance | 历史工作量证据，不直接作为新系统评分 |
| ${path.basename(sourceDaily)} | Manager1、team leader、junior engineers | 41 + 87 + 244 = ${migrationRecords.length} 条历史日报，用于字段反推和迁移测试 |

历史日报日期范围为 2026-08-18 至 2026-09-01。现有来源文件本身没有公式和数据验证；本原型从零加入下拉、关联公式、计算公式、条件格式和筛选表。

## 2. 字段模型

字段模型位于 \`Field_Model\`，覆盖 Daily_Log、Employee_Master、Project_Master、Activity_Master、Quality_Event 和 Migration_Test。字段类别为：

- Fixed：姓名、项目、工作路径、完成状态等预定义选项。
- Linked：Employee_ID、Team、Role、Activity_ID、Unit、Standard_Quota 等自动关联字段。
- Objective：日期、数量、对象编号、事实描述和证据。
- Subjective：仅保留质量事件中的责任/调整等审核字段，V0.1 不进入工作量计算。
- Calculated：Record_ID、Base_Workload、Effective_Workload、Data_Quality_Flag 等公式结果。

主要关系：

\`Employee → Team/Role\`

\`Project_Code → Project_ID\`

\`Activity_Path → Activity_ID/Unit/Calculation_Type/Standard_Quota\`

\`Completion_Status → Progress_Factor\`

\`Related_Record_ID → DERIVED_FROM_ACTIVITY Base_Workload\`

## 3. Activity Code 重构

原定额表中的一个编码存在多个条件或多个定额时，按最终计算规则拆分：

| Original_Code | 新 Activity_ID | 拆分原因 |
|---|---|---|
| M1-01 | M1-01-A/B/C | 建筑建模按楼层条件有 3 个定额 |
| M1-02 | M1-02-A/B/C | 结构建模按楼层条件有 3 个定额 |
| M1-03 | M1-03-A/B/C/D/E | 设备类型对应不同定额，撬装设备需人工审核 |
| M1-06 | M1-06-A/B/C/D/E | 车间内外、热力/非热力及设备接管单位和定额不同 |
| M1-07 | M1-07-A/B/C | 局部、重要、整体修改规则不同；整体修改人工审核 |
| M2-04 | M2-04 | 由关联建模基础工作量 × 0.25 |
| M3-01～M3-04 | 保留原编码 | 本轮全部 Enabled=FALSE，不进入 Daily_Log 选项和汇总 |

## 4. 计算规则

普通可计算活动：

\`Base_Workload = Quantity × Standard_Quota\`

\`Effective_Workload = Base_Workload × Progress_Factor × Adjustment_Factor\`

V0.1 状态配置为 Started=0.25、In Progress=0.50、Mostly Completed=0.80、Completed=1.00；这些值集中在 Status_Config，属于待业务确认的暂定配置。Adjustment_Factor 默认 1.0，质量事件不修改基础工作量。

MANUAL_REVIEW 活动不强行给分。M2-04 通过 Related_Record_ID 查找关联建模记录的 Base_Workload，再乘 Activity_Master 中的 Derived_Factor=0.25；缺失关联或自引用会被标记。

## 5. 历史数据兼容性

Migration_Test 保留每条历史日报的来源文件、工作表、行号、原文、原始项目和建议映射。规则辅助分类结果为：

| 分类 | 条数 | 比例 | 含义 |
|---|---:|---:|---|
| Suggested_Mappable | ${directCount} | ${(directCount / migrationRecords.length * 100).toFixed(1)}% | 建议活动和数量均足够明确，可进入人工复核 |
| Suggested_Review | ${reviewCount} | ${(reviewCount / migrationRecords.length * 100).toFixed(1)}% | 活动子类、数量、项目或员工信息仍缺失/含糊 |
| Deferred_M3 | ${deferredCount} | ${(deferredCount / migrationRecords.length * 100).toFixed(1)}% | QA/QC 或内部自检等 M3 类工作，当前暂缓 |
| Manager_OKR | ${managerCount} | ${(managerCount / migrationRecords.length * 100).toFixed(1)}% | 经理记录，不参加普通 M1/M2 排名 |

上述建议不写入 Daily_Log，也不产生新系统工作量。原文为 “Worked on model.” 等缺少对象/数量的记录，保留为待审核，不编造数量。

## 6. Excel 使用说明

1. 在 Employee_Master、Project_Master、Activity_Master 中维护主数据。
2. 在 Daily_Log 黄色列中填写日期、姓名、项目、工作路径、对象和数量等事实。
3. 选择工作路径后，Module、Category、Activity_ID、Unit、Calculation_Type、Standard_Quota 自动回填。
4. 确认 Data_Quality_Flag=OK，再将 Record_Status 设为 User Input。
5. Employee_Summary、Team_Summary 和 Project_Summary 仅统计 User Input + OK 且日期在统计区间内的记录。
6. Activity_Master 中 M3 为禁用项；Quality_Event 只记录事件，不执行扣分。
7. 新增主数据后，将新增显示值同步到 Daily_Log 右侧 helper list，确保普通 Excel 下拉范围可用。

## 7. 已知问题

- 进度系数未经过正式业务确认；当前仅为 V0.1 演示配置。
- SCSHOU 与 DEMO_PROJECT_08 的项目别名关系需要确认。
- 部分历史日报只有自然语言，没有可靠数量或定额子类。
- 撬装设备、整体修改等活动需要人工审核，不能由 Quantity × Quota 自动替代。
- 组长管理因素、质量扣分和经理 OKR 未与 M1/M2 混算。

## 8. 软件化建议

未来数据库可先拆为：

- employee、employee_role_history、team、project
- activity_rule、activity_rule_version
- daily_log、daily_log_calculation
- quality_event
- migration_review

Excel 中的 ID、枚举、Enabled、Effective_From/To、Source_Notes 和 Calculation_Type 可直接作为 API/数据库设计的初始字段。正式软件应继续保持“AI 只做建议，结构化规则负责最终计算”的边界。

## 9. QA 结果

- 已导出并重新打开 \`Workload_Quantification_System_V0.1.xlsx\`。
- 已检查关键 Daily_Log 区域、15 个工作表名称、公式错误扫描和数据验证配置。
- 已对所有工作表进行渲染检查，保留布局检查结果于工作目录的临时 QA 区。
- 已覆盖有效样例、经理排除、M3 禁用、手工审核、数量非负、M2-04 关联、自引用提示和汇总过滤逻辑。
`;
const designDocPath = path.join(outputDir, "字段模型与Excel原型设计说明.md");
await fs.writeFile(designDocPath, designDoc, "utf8");
await fs.rm(`${outputXlsxPath}.inspect.ndjson`, { force: true });

console.log(JSON.stringify({ outputXlsxPath, designDocPath, migrationCount: migrationRecords.length, statusCounts, activityCount: activityRows.length, enabledActivityCount: activityRows.filter((r) => r[20] === true).length, qaDir }, null, 2));
