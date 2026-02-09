"""
Diagram CRUD - save, list, load, update, delete.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from auth import get_current_user_required
from database import get_db
from models import User, Diagram

router = APIRouter()


class CreateDiagramRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    diagram_type: str = Field(..., min_length=1, max_length=50)
    diagram_data: dict = Field(...)


class UpdateDiagramRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    diagram_data: dict | None = None


@router.post("")
async def create_diagram(
    body: CreateDiagramRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
):
    """Save a new diagram."""
    diagram = Diagram(
        user_id=current_user.id,
        title=body.title,
        diagram_type=body.diagram_type,
        diagram_data=body.diagram_data,
        mermaid_code=body.diagram_data.get("mermaid") or body.diagram_data.get("code"),
    )
    db.add(diagram)
    await db.commit()
    await db.refresh(diagram)
    return {
        "id": diagram.id,
        "title": diagram.title,
        "diagram_type": diagram.diagram_type,
        "created_at": diagram.created_at.isoformat() if diagram.created_at else None,
    }


@router.get("")
async def list_diagrams(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
):
    """List user's diagrams."""
    result = await db.execute(
        select(Diagram).where(Diagram.user_id == current_user.id).order_by(Diagram.updated_at.desc())
    )
    diagrams = result.scalars().all()
    return {
        "diagrams": [
            {
                "id": d.id,
                "title": d.title,
                "diagram_type": d.diagram_type,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "updated_at": d.updated_at.isoformat() if d.updated_at else None,
            }
            for d in diagrams
        ]
    }


@router.get("/{diagram_id}")
async def get_diagram(
    diagram_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
):
    """Get a specific diagram."""
    result = await db.execute(
        select(Diagram).where(Diagram.id == diagram_id, Diagram.user_id == current_user.id)
    )
    diagram = result.scalars().first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    return {
        "id": diagram.id,
        "title": diagram.title,
        "diagram_type": diagram.diagram_type,
        "diagram_data": diagram.diagram_data or {},
        "mermaid_code": diagram.mermaid_code,
        "created_at": diagram.created_at.isoformat() if diagram.created_at else None,
        "updated_at": diagram.updated_at.isoformat() if diagram.updated_at else None,
    }


@router.put("/{diagram_id}")
async def update_diagram(
    diagram_id: int,
    body: UpdateDiagramRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
):
    """Update a diagram."""
    result = await db.execute(
        select(Diagram).where(Diagram.id == diagram_id, Diagram.user_id == current_user.id)
    )
    diagram = result.scalars().first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    if body.title is not None:
        diagram.title = body.title
    if body.diagram_data is not None:
        diagram.diagram_data = body.diagram_data
        diagram.mermaid_code = body.diagram_data.get("mermaid") or body.diagram_data.get("code")
    db.add(diagram)
    await db.commit()
    await db.refresh(diagram)
    return {
        "id": diagram.id,
        "title": diagram.title,
        "updated_at": diagram.updated_at.isoformat() if diagram.updated_at else None,
    }


@router.delete("/{diagram_id}")
async def delete_diagram(
    diagram_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
):
    """Delete a diagram."""
    result = await db.execute(
        select(Diagram).where(Diagram.id == diagram_id, Diagram.user_id == current_user.id)
    )
    diagram = result.scalars().first()
    if not diagram:
        raise HTTPException(status_code=404, detail="Diagram not found")
    await db.delete(diagram)
    await db.commit()
    return {"detail": "Deleted"}
