"""
UML diagram type definitions and routing.
"""
from typing import Literal

# All supported diagram types (architecture + UML + HLD)
DiagramType = Literal[
    "architecture",
    "hld",
    "class",
    "sequence",
    "usecase",
    "activity",
    "state",
    "component",
    "deployment",
]

DIAGRAM_TYPE_LABELS: dict[str, str] = {
    "architecture": "Architecture / Component",
    "hld": "High-Level Design (HLD)",
    "class": "Class Diagram",
    "sequence": "Sequence Diagram",
    "usecase": "Use Case Diagram",
    "activity": "Activity Diagram",
    "state": "State Diagram",
    "component": "Component Diagram",
    "deployment": "Deployment Diagram",
}
