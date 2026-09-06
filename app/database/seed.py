"""Versioned initial dictionaries derived from the supplied source files."""

TEAMS = [
    ("T01", "Employee02", "Employee02", "4 teams observed in August source data"),
    ("T02", "Employee05", "Employee05", "4 teams observed in August source data"),
    ("T03", "Employee09", "Employee09", "4 teams observed in August source data"),
    ("T04", "Employee13", "Employee13", "4 teams observed in August source data"),
]

PERSONS = [
    ("Employee01", None, "Manager; retained as known person"),
    ("Employee02", "T01", "Team Leader"),
    ("Employee03", "T01", "Engineer"),
    ("Employee04", "T01", "Engineer"),
    ("Employee05", "T02", "Team Leader"),
    ("Employee06", "T02", "Engineer"),
    ("Employee07", "T02", "Engineer"),
    ("Employee08", "T02", "Engineer"),
    ("Employee09", "T03", "Team Leader"),
    ("Employee10", "T03", "Engineer"),
    ("Employee11", "T03", "Engineer"),
    ("Employee12", "T03", "Engineer"),
    ("Employee13", "T04", "Team Leader"),
    ("Employee14", "T04", "Engineer"),
    ("Employee15", "T04", "Engineer"),
]

PROJECTS = [
    ("DEMO_PROJECT_01", "DEMO_PROJECT_01"),
    ("DEMO_PROJECT_02", "DEMO_PROJECT_02"),
    ("DEMO_PROJECT_03", "DEMO_PROJECT_03"),
    ("DEMO_PROJECT_04", "DEMO_PROJECT_04"),
    ("DEMO_PROJECT_05", "DEMO_PROJECT_05"),
    ("DEMO_PROJECT_06", "DEMO_PROJECT_06"),
    ("DEMO_PROJECT_07", "DEMO_PROJECT_07"),
    ("DEMO_PROJECT_08", "DEMO_PROJECT_08"),
]

# rule_code, module, module_en, category, category_en, subtype, subtype_en,
# display_name, display_name_en, input_label, input_unit, unit, unit_en,
# base_score, quantity_mode, active, requires_basis, remark
RULES = [
    ("M1-01-A", "M1 三维建模", "M1 3D Modeling", "建筑建模", "Architectural Modeling", "一层+屋顶", "1 floor + roof", "建筑建模（一层+屋顶）", "Architectural modeling (1 floor + roof)", "人工确认的标准化数量", "个1000㎡·层", "个1000㎡·层", "1000 m²-floor", "0.75", "MANUAL_STANDARDIZED", 1, 1, "面积和楼层自动换算口径待确认；屋顶按一层计"),
    ("M1-01-B", "M1 三维建模", "M1 3D Modeling", "建筑建模", "Architectural Modeling", "二至四层+屋顶", "2-4 floors + roof", "建筑建模（二至四层+屋顶）", "Architectural modeling (2-4 floors + roof)", "人工确认的标准化数量", "个1000㎡·层", "个1000㎡·层", "1000 m²-floor", "0.70", "MANUAL_STANDARDIZED", 1, 1, "面积和楼层自动换算口径待确认；屋顶按一层计"),
    ("M1-01-C", "M1 三维建模", "M1 3D Modeling", "建筑建模", "Architectural Modeling", "五层及以上+屋顶", "5+ floors + roof", "建筑建模（五层及以上+屋顶）", "Architectural modeling (5+ floors + roof)", "人工确认的标准化数量", "个1000㎡·层", "个1000㎡·层", "1000 m²-floor", "0.60", "MANUAL_STANDARDIZED", 1, 1, "面积和楼层自动换算口径待确认；屋顶按一层计"),
    ("M1-02-A", "M1 三维建模", "M1 3D Modeling", "结构建模", "Structural Modeling", "一层+屋顶", "1 floor + roof", "结构建模（一层+屋顶）", "Structural modeling (1 floor + roof)", "人工确认的标准化数量", "个1000㎡·层", "个1000㎡·层", "1000 m²-floor", "1.50", "MANUAL_STANDARDIZED", 1, 1, "面积和楼层自动换算口径待确认；屋顶按一层计"),
    ("M1-02-B", "M1 三维建模", "M1 3D Modeling", "结构建模", "Structural Modeling", "二至四层+屋顶", "2-4 floors + roof", "结构建模（二至四层+屋顶）", "Structural modeling (2-4 floors + roof)", "人工确认的标准化数量", "个1000㎡·层", "个1000㎡·层", "1000 m²-floor", "1.40", "MANUAL_STANDARDIZED", 1, 1, "面积和楼层自动换算口径待确认；屋顶按一层计"),
    ("M1-02-C", "M1 三维建模", "M1 3D Modeling", "结构建模", "Structural Modeling", "五层及以上+屋顶", "5+ floors + roof", "结构建模（五层及以上+屋顶）", "Structural modeling (5+ floors + roof)", "人工确认的标准化数量", "个1000㎡·层", "个1000㎡·层", "1000 m²-floor", "1.20", "MANUAL_STANDARDIZED", 1, 1, "面积和楼层自动换算口径待确认；屋顶按一层计"),
    ("M1-03-A", "M1 三维建模", "M1 3D Modeling", "设备建模", "Equipment Modeling", "反应釜", "Reactor", "反应釜建模", "Reactor modeling", "数量", "台", "台", "unit", "1.20", "AUTO_1TO1", 1, 0, ""),
    ("M1-03-B", "M1 三维建模", "M1 3D Modeling", "设备建模", "Equipment Modeling", "换热器", "Heat Exchanger", "换热器建模", "Heat exchanger modeling", "数量", "台", "台", "unit", "0.90", "AUTO_1TO1", 1, 0, ""),
    ("M1-03-C", "M1 三维建模", "M1 3D Modeling", "设备建模", "Equipment Modeling", "储罐", "Storage Tank", "储罐建模", "Storage tank modeling", "数量", "台", "台", "unit", "0.70", "AUTO_1TO1", 1, 0, ""),
    ("M1-03-D", "M1 三维建模", "M1 3D Modeling", "设备建模", "Equipment Modeling", "泵", "Pump", "泵建模", "Pump modeling", "数量", "台", "台", "unit", "0.60", "AUTO_1TO1", 1, 0, ""),
    ("M1-03-E", "M1 三维建模", "M1 3D Modeling", "设备建模", "Equipment Modeling", "撬装设备", "Skid-mounted Equipment", "撬装设备建模", "Skid-mounted equipment modeling", "数量", "台", "台", "unit", None, "MANUAL_BASE_SCORE", 1, 1, "正式定额写明根据实际情况确定，必须填写本次基准分和依据"),
    ("M1-04-A", "M1 三维建模", "M1 3D Modeling", "外管廊建模", "External Pipe Rack Modeling", "外管廊", "External Pipe Rack", "外管廊建模", "External pipe rack modeling", "实际长度", "m", "100m", "100 m", "2.50", "AUTO_DIV100", 1, 0, "用户输入米，程序除以100"),
    ("M1-05-A", "M1 三维建模", "M1 3D Modeling", "内管廊建模", "Internal Pipe Rack Modeling", "内管廊", "Internal Pipe Rack", "内管廊建模", "Internal pipe rack modeling", "层数", "层", "层", "floor", "2.20", "AUTO_1TO1", 1, 0, ""),
    ("M1-06-A", "M1 三维建模", "M1 3D Modeling", "管道建模", "Piping Modeling", "车间内热力主管", "Thermal Main Pipe Inside Workshop", "车间内热力主管建模", "Thermal main pipe inside workshop", "管线数量", "根", "根", "line", "1.60", "AUTO_1TO1", 1, 0, "导热油、蒸汽"),
    ("M1-06-B", "M1 三维建模", "M1 3D Modeling", "管道建模", "Piping Modeling", "车间内其他主管", "Other Main Pipe Inside Workshop", "车间内其他主管建模", "Other main pipe inside workshop", "管线数量", "根", "根", "line", "1.10", "AUTO_1TO1", 1, 0, ""),
    ("M1-06-C", "M1 三维建模", "M1 3D Modeling", "管道建模", "Piping Modeling", "车间外热力主管", "Thermal Main Pipe Outside Workshop", "车间外热力主管建模", "Thermal main pipe outside workshop", "实际长度", "m", "100m", "100 m", "2.00", "AUTO_DIV100", 1, 0, "导热油、蒸汽；用户输入米，程序除以100"),
    ("M1-06-D", "M1 三维建模", "M1 3D Modeling", "管道建模", "Piping Modeling", "车间外其他主管", "Other Main Pipe Outside Workshop", "车间外其他主管建模", "Other main pipe outside workshop", "实际长度", "m", "100m", "100 m", "1.40", "AUTO_DIV100", 1, 0, "用户输入米，程序除以100"),
    ("M1-06-E", "M1 三维建模", "M1 3D Modeling", "管道建模", "Piping Modeling", "设备接管", "Equipment Connection Pipe", "设备接管建模", "Equipment connection pipe modeling", "管线数量", "根", "根", "line", "0.80", "AUTO_1TO1", 1, 0, ""),
    ("M1-07-A", "M1 三维建模", "M1 3D Modeling", "模型修改", "Model Modification", "局部修改", "Local Modification", "模型局部修改", "Local model modification", "修改次数", "次", "次", "event", "0.25", "AUTO_1TO1", 1, 0, "设备管道修改、设备旋转、管架修改"),
    ("M1-07-B", "M1 三维建模", "M1 3D Modeling", "模型修改", "Model Modification", "重要修改", "Major Modification", "模型重要修改", "Major model modification", "修改次数", "次", "次", "event", "0.50", "AUTO_1TO1", 1, 0, "主管道修改、设备移动、设备增减管口"),
    ("M1-07-C", "M1 三维建模", "M1 3D Modeling", "模型修改", "Model Modification", "整体修改", "Overall Modification", "模型整体修改", "Overall model modification", "修改次数", "次", "次", "event", None, "MANUAL_BASE_SCORE", 1, 1, "正式定额写明根据实际情况确定，必须填写本次基准分和依据"),
    ("M2-01-A", "M2 图纸编制", "M2 Drawing Preparation", "图纸编制", "Drawing Preparation", "管道平面布置图", "Piping Layout Drawing", "管道平面布置图", "Piping layout drawing", "图纸数量", "张", "A1图纸", "A1 drawing", "12.00", "AUTO_1TO1", 1, 0, "完整A1图纸"),
    ("M2-02-A", "M2 图纸编制", "M2 Drawing Preparation", "图纸编制", "Drawing Preparation", "外防腐一览表", "External Anti-corrosion Table", "设备、管道外防腐一览表", "External anti-corrosion table", "图纸数量", "张", "A3图纸", "A3 drawing", "1.20", "AUTO_1TO1", 1, 0, "完整A3图纸"),
    ("M2-03-A", "M2 图纸编制", "M2 Drawing Preparation", "图纸编制", "Drawing Preparation", "外保温一览表", "Thermal Insulation Table", "设备、管道外保温一览表", "Thermal insulation table", "图纸数量", "张", "A3图纸", "A3 drawing", "1.20", "AUTO_1TO1", 1, 0, "完整A3图纸"),
    ("M2-04-A", "M2 图纸编制", "M2 Drawing Preparation", "图纸编制", "Drawing Preparation", "管架资料表", "Pipe Support Data Sheet", "管架资料表", "Pipe support data sheet", "人工确认的关联管道建模工作量", "分", "关联工作量", "related workload", "0.25", "LINKED_WORKLOAD", 1, 1, "关联范围未正式确定；人工填写已确认的关联工作量和依据"),
    ("M3-01-A", "M3 辅助管理", "M3 Supporting Management", "辅助管理", "Supporting Management", "模型内部自检", "Internal Model Check", "模型内部自检", "Internal model check", "关联建模工作量", "分", "关联工作量", "related workload", "0.40", "LINKED_WORKLOAD", 0, 1, "本轮暂缓启用"),
    ("M3-02-A", "M3 辅助管理", "M3 Supporting Management", "辅助管理", "Supporting Management", "图纸内部自检", "Internal Drawing Check", "图纸内部自检", "Internal drawing check", "关联图纸工作量", "分", "关联工作量", "related workload", "0.30", "LINKED_WORKLOAD", 0, 1, "本轮暂缓启用"),
    ("M3-03-A", "M3 辅助管理", "M3 Supporting Management", "辅助管理", "Supporting Management", "会议沟通时间", "Meeting Communication Time", "会议沟通时间", "Meeting communication time", "实际会议时间", "小时", "小时", "hour", "1.15", "AUTO_1TO1", 0, 0, "本轮暂缓启用"),
    ("M3-04-A", "M3 辅助管理", "M3 Supporting Management", "辅助管理", "Supporting Management", "内部协调、团队管理", "Internal Coordination and Team Management", "内部协调、团队管理", "Internal coordination and team management", "实际时间", "小时", "小时", "hour", None, "DISABLED", 0, 0, "本轮暂缓启用；原表注明不计分"),
]
