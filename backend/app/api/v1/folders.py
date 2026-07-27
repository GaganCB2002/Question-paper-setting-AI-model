import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import Optional

from app.database import get_db
from app.api.deps import get_current_user
from app.schemas.folder import FolderCreate, FolderUpdate, FolderResponse, FolderTreeResponse, FolderDetailResponse
from app.models.user import User
from app.models.folder import Folder
from app.models.uploaded_file import UploadedFile

router = APIRouter(prefix="/folders", tags=["Folders"])


@router.post("/", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    folder_data: FolderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if folder_data.parent_id:
        parent = await db.execute(
            select(Folder).where(
                Folder.id == folder_data.parent_id,
                Folder.user_id == current_user.id,
                Folder.is_deleted == False,
            )
        )
        if parent.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent folder not found")

    folder = Folder(
        user_id=current_user.id,
        parent_id=folder_data.parent_id,
        name=folder_data.name.strip(),
        description=folder_data.description,
        color=folder_data.color,
        icon=folder_data.icon,
        created_by=str(current_user.id),
    )
    db.add(folder)
    await db.flush()
    await db.refresh(folder)

    file_count = await db.execute(
        select(func.count(UploadedFile.id)).where(
            UploadedFile.folder_id == folder.id,
            UploadedFile.is_deleted == False,
        )
    )

    return FolderResponse(
        id=folder.id,
        name=folder.name,
        description=folder.description,
        parent_id=folder.parent_id,
        color=folder.color,
        icon=folder.icon,
        sort_order=folder.sort_order,
        file_count=file_count.scalar() or 0,
        created_at=folder.created_at,
        updated_at=folder.updated_at,
    )


@router.get("/", response_model=dict)
async def list_folders(
    parent_id: Optional[uuid.UUID] = Query(None),
    include_root: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conditions = [
        Folder.user_id == current_user.id,
        Folder.is_deleted == False,
    ]
    if parent_id is not None:
        conditions.append(Folder.parent_id == parent_id)
    elif not include_root:
        conditions.append(Folder.parent_id.isnot(None))

    query = select(Folder).where(*conditions).order_by(Folder.sort_order, Folder.name)
    count_query = select(func.count(Folder.id)).where(*conditions)
    total = (await db.execute(count_query)).scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size))
    folders = result.scalars().all()

    folder_ids = [f.id for f in folders]
    file_counts = {}
    if folder_ids:
        count_result = await db.execute(
            select(UploadedFile.folder_id, func.count(UploadedFile.id))
            .where(
                UploadedFile.folder_id.in_(folder_ids),
                UploadedFile.is_deleted == False,
            )
            .group_by(UploadedFile.folder_id)
        )
        for row in count_result:
            file_counts[str(row[0])] = row[1]

    items = []
    for f in folders:
        items.append(FolderResponse(
            id=f.id,
            name=f.name,
            description=f.description,
            parent_id=f.parent_id,
            color=f.color,
            icon=f.icon,
            sort_order=f.sort_order,
            file_count=file_counts.get(str(f.id), 0),
            created_at=f.created_at,
            updated_at=f.updated_at,
        ))

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }


@router.get("/tree", response_model=list)
async def get_folder_tree(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Folder).where(
            Folder.user_id == current_user.id,
            Folder.is_deleted == False,
        ).order_by(Folder.sort_order, Folder.name)
    )
    all_folders = result.scalars().all()

    folder_ids = [f.id for f in all_folders]
    file_counts = {}
    if folder_ids:
        count_result = await db.execute(
            select(UploadedFile.folder_id, func.count(UploadedFile.id))
            .where(
                UploadedFile.folder_id.in_(folder_ids),
                UploadedFile.is_deleted == False,
            )
            .group_by(UploadedFile.folder_id)
        )
        for row in count_result:
            file_counts[str(row[0])] = row[1]

    def _build_tree(parent_id):
        children = []
        for f in all_folders:
            if f.parent_id == parent_id:
                sub = _build_tree(f.id)
                children.append(FolderTreeResponse(
                    id=f.id,
                    name=f.name,
                    description=f.description,
                    parent_id=f.parent_id,
                    color=f.color,
                    icon=f.icon,
                    sort_order=f.sort_order,
                    file_count=file_counts.get(str(f.id), 0),
                    created_at=f.created_at,
                    updated_at=f.updated_at,
                    children=sub,
                ))
        return children

    return _build_tree(None)


@router.get("/{folder_id}", response_model=FolderDetailResponse)
async def get_folder(
    folder_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Folder).where(
            Folder.id == folder_id,
            Folder.user_id == current_user.id,
            Folder.is_deleted == False,
        )
    )
    folder = result.scalar_one_or_none()
    if folder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    children_result = await db.execute(
        select(Folder).where(
            Folder.parent_id == folder_id,
            Folder.is_deleted == False,
        ).order_by(Folder.sort_order, Folder.name)
    )
    children = children_result.scalars().all()

    files_result = await db.execute(
        select(UploadedFile).where(
            UploadedFile.folder_id == folder_id,
            UploadedFile.is_deleted == False,
        ).order_by(UploadedFile.created_at.desc())
    )
    files = files_result.scalars().all()

    file_counts = {}
    if folder.id or children:
            count_result = await db.execute(
                select(UploadedFile.folder_id, func.count(UploadedFile.id))
                .where(
                    UploadedFile.folder_id.in_([folder.id] + [c.id for c in children]),
                    UploadedFile.is_deleted == False,
                )
                .group_by(UploadedFile.folder_id)
            )
            for row in count_result:
                file_counts[str(row[0])] = row[1]

    all_folders_including_children = [folder] + list(children)

    def _build_sub_tree(parent_id):
        result_list = []
        for c in all_folders_including_children:
            if c.parent_id == parent_id:
                subs = _build_sub_tree(c.id)
                result_list.append(FolderTreeResponse(
                    id=c.id,
                    name=c.name,
                    description=c.description,
                    parent_id=c.parent_id,
                    color=c.color,
                    icon=c.icon,
                    sort_order=c.sort_order,
                    file_count=file_counts.get(str(c.id), 0),
                    created_at=c.created_at,
                    updated_at=c.updated_at,
                    children=subs,
                ))
        return result_list

    child_tree = _build_sub_tree(folder_id)

    file_list = [
        {
            "id": str(f.id),
            "original_filename": f.original_filename,
            "file_size": f.file_size,
            "extension": f.extension,
            "mime_type": f.mime_type,
            "is_processed": f.is_processed,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f in files
    ]

    return FolderDetailResponse(
        id=folder.id,
        name=folder.name,
        description=folder.description,
        parent_id=folder.parent_id,
        color=folder.color,
        icon=folder.icon,
        sort_order=folder.sort_order,
        file_count=file_counts.get(str(folder.id), 0),
        created_at=folder.created_at,
        updated_at=folder.updated_at,
        children=child_tree,
        files=file_list,
    )


@router.put("/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: uuid.UUID,
    folder_data: FolderUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Folder).where(
            Folder.id == folder_id,
            Folder.user_id == current_user.id,
            Folder.is_deleted == False,
        )
    )
    folder = result.scalar_one_or_none()
    if folder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    if folder_data.parent_id is not None:
        if folder_data.parent_id == folder.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Folder cannot be its own parent")
        parent = await db.execute(
            select(Folder).where(
                Folder.id == folder_data.parent_id,
                Folder.user_id == current_user.id,
                Folder.is_deleted == False,
            )
        )
        if parent.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent folder not found")
        folder.parent_id = folder_data.parent_id

    update_data = folder_data.model_dump(exclude_unset=True, exclude={"parent_id"})
    for field, value in update_data.items():
        if value is not None:
            setattr(folder, field, value.strip() if isinstance(value, str) else value)

    await db.flush()
    await db.refresh(folder)

    file_count = await db.execute(
        select(func.count(UploadedFile.id)).where(
            UploadedFile.folder_id == folder.id,
            UploadedFile.is_deleted == False,
        )
    )

    return FolderResponse(
        id=folder.id,
        name=folder.name,
        description=folder.description,
        parent_id=folder.parent_id,
        color=folder.color,
        icon=folder.icon,
        sort_order=folder.sort_order,
        file_count=file_count.scalar() or 0,
        created_at=folder.created_at,
        updated_at=folder.updated_at,
    )


@router.delete("/{folder_id}")
async def delete_folder(
    folder_id: uuid.UUID,
    recursive: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Folder).where(
            Folder.id == folder_id,
            Folder.user_id == current_user.id,
            Folder.is_deleted == False,
        )
    )
    folder = result.scalar_one_or_none()
    if folder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    children = await db.execute(
        select(Folder.id).where(
            Folder.parent_id == folder_id,
            Folder.is_deleted == False,
        )
    )
    has_children = children.first() is not None

    files_in_folder = await db.execute(
        select(UploadedFile.id).where(
            UploadedFile.folder_id == folder_id,
            UploadedFile.is_deleted == False,
        )
    )
    has_files = files_in_folder.first() is not None

    if (has_children or has_files) and not recursive:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Folder is not empty. Use recursive=true to delete folder and all contents.",
        )

    if recursive:
        await _soft_delete_subtree(db, folder_id, str(current_user.id))
    else:
        folder.soft_delete(user=str(current_user.id))
        await db.flush()

    return {"message": "Folder deleted successfully"}


async def _soft_delete_subtree(db: AsyncSession, parent_id: uuid.UUID, user_id: str):
    children = await db.execute(
        select(Folder).where(Folder.parent_id == parent_id, Folder.is_deleted == False)
    )
    for child in children.scalars().all():
        await _soft_delete_subtree(db, child.id, user_id)

    files = await db.execute(
        select(UploadedFile).where(
            UploadedFile.folder_id == parent_id,
            UploadedFile.is_deleted == False,
        )
    )
    for f in files.scalars().all():
        f.soft_delete(user=user_id)

    folder = await db.execute(
        select(Folder).where(Folder.id == parent_id, Folder.is_deleted == False)
    )
    folder = folder.scalar_one_or_none()
    if folder:
        folder.soft_delete(user=user_id)

    await db.flush()


@router.put("/{folder_id}/move")
async def move_folder(
    folder_id: uuid.UUID,
    parent_id: Optional[uuid.UUID] = Query(None),
    sort_order: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Folder).where(
            Folder.id == folder_id,
            Folder.user_id == current_user.id,
            Folder.is_deleted == False,
        )
    )
    folder = result.scalar_one_or_none()
    if folder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    if parent_id is not None:
        if parent_id == folder_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Folder cannot be its own parent")

        ancestor_ids = set()
        current = parent_id
        while current is not None:
            if current == folder_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot move folder into its own descendant")
            ancestor_ids.add(current)
            parent_result = await db.execute(
                select(Folder.parent_id).where(Folder.id == current, Folder.is_deleted == False)
            )
            row = parent_result.first()
            current = row[0] if row else None

        parent = await db.execute(
            select(Folder).where(
                Folder.id == parent_id,
                Folder.user_id == current_user.id,
                Folder.is_deleted == False,
            )
        )
        if parent.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target folder not found")

        folder.parent_id = parent_id

    if sort_order is not None:
        folder.sort_order = sort_order

    await db.flush()
    return {"message": "Folder moved successfully"}
