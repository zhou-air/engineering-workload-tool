"""Deterministic workload calculations using :class:`decimal.Decimal`."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Mapping, Any


SCALE = Decimal("0.000001")
ADJUSTMENT_FACTOR = Decimal("1")


class ValidationError(ValueError):
    """Raised when a user-supplied value cannot be used safely."""


@dataclass(frozen=True)
class CalculationResult:
    quantity: Decimal
    standardized_quantity: Decimal
    base_score: Decimal
    adjustment_factor: Decimal
    workload_score: Decimal
    input_unit: str
    standard_unit: str
    requires_basis: bool


def parse_decimal(value: Any, field_name: str, *, allow_zero: bool = True) -> Decimal:
    text = str(value).strip()
    if not text:
        raise ValidationError(f"{field_name}不能为空")
    try:
        result = Decimal(text)
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError(f"{field_name}必须是有效数字") from exc
    if not result.is_finite():
        raise ValidationError(f"{field_name}必须是有限数字")
    if result < 0 or (not allow_zero and result == 0):
        relation = "大于 0" if not allow_zero else "不能为负数"
        raise ValidationError(f"{field_name}{relation}")
    return result


def calculate(
    rule: Mapping[str, Any],
    quantity_value: Any,
    manual_base_score_value: Any = None,
) -> CalculationResult:
    """Calculate one record from a database rule row.

    Supported modes deliberately mirror only the confirmed source rules.
    Ambiguous source rules require an explicit human-provided value.
    """

    quantity = parse_decimal(quantity_value, str(rule.get("input_label") or "数量"))
    mode = str(rule["quantity_mode"])
    requires_basis = bool(rule.get("requires_basis", 0))

    if mode == "AUTO_1TO1":
        standardized = quantity
        base_score = _rule_base_score(rule)
    elif mode == "AUTO_DIV100":
        standardized = quantity / Decimal("100")
        base_score = _rule_base_score(rule)
    elif mode == "MANUAL_STANDARDIZED":
        standardized = quantity
        base_score = _rule_base_score(rule)
        requires_basis = True
    elif mode == "MANUAL_BASE_SCORE":
        standardized = quantity
        base_score = parse_decimal(manual_base_score_value, "本次基准分", allow_zero=False)
        requires_basis = True
    elif mode == "LINKED_WORKLOAD":
        standardized = quantity
        base_score = _rule_base_score(rule)
        requires_basis = True
    else:
        raise ValidationError("该规则当前停用或没有可执行的计算方式")

    standardized = standardized.quantize(SCALE, rounding=ROUND_HALF_UP)
    score = (standardized * base_score * ADJUSTMENT_FACTOR).quantize(
        SCALE, rounding=ROUND_HALF_UP
    )
    return CalculationResult(
        quantity=quantity.quantize(SCALE, rounding=ROUND_HALF_UP),
        standardized_quantity=standardized,
        base_score=base_score.quantize(SCALE, rounding=ROUND_HALF_UP),
        adjustment_factor=ADJUSTMENT_FACTOR,
        workload_score=score,
        input_unit=str(rule.get("input_unit") or rule.get("unit") or ""),
        standard_unit=str(rule.get("unit") or ""),
        requires_basis=requires_basis,
    )


def _rule_base_score(rule: Mapping[str, Any]) -> Decimal:
    value = rule.get("base_score")
    if value is None or str(value).strip() == "":
        raise ValidationError("该规则没有固定基准分，请人工确认")
    return parse_decimal(value, "基准分", allow_zero=False)


def decimal_text(value: Decimal | str | int | float) -> str:
    """Serialize a Decimal without scientific notation or trailing zeros."""

    number = value if isinstance(value, Decimal) else Decimal(str(value))
    fixed = format(number, "f")
    if "." in fixed:
        fixed = fixed.rstrip("0").rstrip(".")
    return fixed or "0"


def display_decimal(value: Any, places: int = 4) -> str:
    if value is None or str(value).strip() == "":
        return ""
    number = Decimal(str(value))
    quantum = Decimal("1").scaleb(-places)
    return decimal_text(number.quantize(quantum, rounding=ROUND_HALF_UP))
