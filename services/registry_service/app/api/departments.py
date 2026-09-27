from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from services.common.database import get_db
from services.common.models import Department
from services.common.schemas import DepartmentCreate, DepartmentOut

router = APIRouter(prefix="/departments", tags=["Departments"])

@router.get("", response_model=List[DepartmentOut])
async def list_departments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Department))
    return result.scalars().all()

@router.post("", response_model=DepartmentOut, status_code=201)
async def create_department(payload: DepartmentCreate, db: AsyncSession = Depends(get_db)):
    dept = Department(**payload.model_dump())
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return dept
