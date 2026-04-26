from dataclasses import dataclass, field


@dataclass
class CategorizationInput:
    user_id: str
    description_raw: str
    description_clean: str
    counterparty: str | None
    direction: str
    amount: float
    source_type: str
    source_name: str


@dataclass
class CategorizationResult:
    category: str
    subcategory: str | None
    confidence_score: float
    is_recurring: bool
    is_fixed_obligation: bool
    unresolved: bool
    candidate_categories: list[str] = field(default_factory=list)
    rule_trace: list[str] = field(default_factory=list)
