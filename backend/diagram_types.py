"""
UML diagram type definitions and routing.
"""
from typing import Literal

# All supported diagram types (architecture + UML + HLD + mind tree)
DiagramType = Literal[
    "architecture",
    "hld",
    "mindtree",
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
    "mindtree": "Mind Tree / Mind Map",
    "class": "Class Diagram",
    "sequence": "Sequence Diagram",
    "usecase": "Use Case Diagram",
    "activity": "Activity Diagram",
    "state": "State Diagram",
    "component": "Component Diagram",
    "deployment": "Deployment Diagram",
}
