"""
Contract API routes
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Query, Session, selectinload

from app.auth.dependancies import PermissionChecker
from app.common.route_generator import RouteAlchemyManager, custom_filter
from app.database import dep_get_session
from app.db_schemas import RelationLookupOut
from app.models.contract import Contract, MemberContract
from app.models.hr import Member
from app.schemas.contract import (
    ContractMemberSyncInput,
    ContractMemberSyncResponse,
    MemberContractSyncInput,
    MemberContractSyncResponse,
    MemberContractCreate,
    MemberContractListResponse,
    MemberContractResponse,
    MemberContractUpdate,
    MemberOptionResponse,
)

read_document_dep = Depends(PermissionChecker("document"))
edit_document_dep = Depends(PermissionChecker("document", edit=True))

route_contract_manager = RouteAlchemyManager(
    Contract,
    get_depends=[read_document_dep],
    create_depends=[edit_document_dep],
    edit_depends=[edit_document_dep],
    delete_depends=[edit_document_dep],
    relation_lookups={
        "member_contracts": RelationLookupOut(
            api_route="/contract/member-options",
            value_field="member_id",
            label_field="label",
            relation_kind="many",
            foreign_key="member_id",
            foreign_table="member",
            transcription="Członkowie",
            description="Wybierz członków przypisanych do dokumentu.",
        ),
        "shelf_rentals": RelationLookupOut(
            api_route="/shelves/rentals",
            value_field="id",
            label_field="shelf_id",
            relation_kind="many",
            description="Powiązane wynajmy półek.",
        ),
    },
)
route_contract_manager.link_list_route()
route_contract_manager.link_schema_route()
route_contract_manager.link_get_route()
route_contract_manager.link_create_route(unique_field="title")
route_contract_manager.link_update_route(unique_field="title")
route_contract_manager.link_delete_route(to_archive=False)


def filter_by_member_id(query: Query[MemberContract], member_id: int) -> Query[MemberContract]:
    return custom_filter(query, MemberContract.member_id, member_id)


def filter_by_contract_id(query: Query[MemberContract], contract_id: int) -> Query[MemberContract]:
    return custom_filter(query, MemberContract.contract_id, contract_id)


def filter_by_signed(query: Query[MemberContract], signed: bool) -> Query[MemberContract]:
    return custom_filter(query, MemberContract.signed, signed)


route_member_contract_manager = RouteAlchemyManager(
    MemberContract,
    api_prefix="/member-contract",
    get_depends=[read_document_dep],
    create_depends=[edit_document_dep],
    edit_depends=[edit_document_dep],
    delete_depends=[edit_document_dep],
    relation_lookups={
        "member_id": RelationLookupOut(
            api_route="/member",
            value_field="id",
            label_field="email",
            description="Wybierz członka, którego dotyczy podpis.",
            app_route="/member",
        ),
        "contract_id": RelationLookupOut(
            api_route="/contract",
            value_field="id",
            label_field="title",
            description="Wybierz umowę powiązaną z podpisem.",
            app_route="/contract",
        ),
    },
)
route_member_contract_manager.link_list_route(
    list_filters=[
        ("member_id", "Member ID", int, filter_by_member_id),
        ("contract_id", "Contract ID", int, filter_by_contract_id),
        ("signed", "Signed", bool, filter_by_signed),
    ],
)
route_member_contract_manager.link_schema_route()
route_member_contract_manager.link_get_route()
route_member_contract_manager.link_create_route()
route_member_contract_manager.link_update_route()
route_member_contract_manager.link_delete_route(to_archive=False)

router = route_contract_manager.router
router.include_router(route_member_contract_manager.router)


def _member_option_label(member: Member) -> str:
    name = f"{member.first_name} {member.last_name}".strip()
    if name and member.email:
        return f"{name} <{member.email}>"
    if name:
        return name
    return member.email or f"Członek #{member.id}"


@router.get(
    "/member-options",
    response_model=list[MemberOptionResponse],
    dependencies=[read_document_dep],
)
def get_contract_member_options(
    include_deleted: bool = False,
    session: Session = Depends(dep_get_session),
):
    """Lookup endpoint for members assignable to documents."""
    query = session.query(Member)
    if not include_deleted:
        query = query.filter(Member.is_deleted.is_(False))

    members = query.order_by(
        Member.last_name.asc(),
        Member.first_name.asc(),
        Member.id.asc(),
    ).all()
    return [
        MemberOptionResponse(member_id=member.id, label=_member_option_label(member))
        for member in members
    ]


@router.put(
    "/{contract_id:int}/members",
    response_model=ContractMemberSyncResponse,
    dependencies=[edit_document_dep],
)
def sync_contract_members(
    contract_id: int,
    payload: ContractMemberSyncInput,
    session: Session = Depends(dep_get_session),
):
    """Replace members assigned to a contract while preserving signed links."""
    contract = (
        session.query(Contract)
        .options(selectinload(Contract.member_contracts))
        .filter(Contract.id == contract_id)
        .first()
    )
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found",
        )

    requested_member_ids = list(dict.fromkeys(payload.member_ids))
    if requested_member_ids:
        members = session.query(Member).filter(
            Member.id.in_(requested_member_ids),
            Member.is_deleted.is_(False),
        ).all()
        found_member_ids = {member.id for member in members}
        missing_member_ids = [
            member_id
            for member_id in requested_member_ids
            if member_id not in found_member_ids
        ]
        if missing_member_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Members not found: {missing_member_ids}",
            )

    requested_member_id_set = set(requested_member_ids)
    links_by_member_id = {
        link.member_id: link
        for link in contract.member_contracts
    }
    current_member_id_set = set(links_by_member_id)

    member_ids_to_remove = current_member_id_set - requested_member_id_set
    signed_member_ids_to_remove = [
        member_id
        for member_id in member_ids_to_remove
        if links_by_member_id[member_id].signed
    ]
    if signed_member_ids_to_remove:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Cannot remove signed contract assignments for members: "
                f"{signed_member_ids_to_remove}"
            ),
        )

    created_count = 0
    for member_id in requested_member_ids:
        if member_id in links_by_member_id:
            continue
        session.add(
            MemberContract(
                member_id=member_id,
                contract_id=contract_id,
                signed=False,
            )
        )
        created_count += 1

    removed_count = 0
    for member_id in member_ids_to_remove:
        session.delete(links_by_member_id[member_id])
        removed_count += 1

    session.commit()

    assigned_count = session.query(MemberContract).filter(
        MemberContract.contract_id == contract_id
    ).count()
    signed_count = session.query(MemberContract).filter(
        MemberContract.contract_id == contract_id,
        MemberContract.signed.is_(True),
    ).count()

    return ContractMemberSyncResponse(
        status="ok",
        contract_id=contract_id,
        assigned_count=assigned_count,
        signed_count=signed_count,
        created_count=created_count,
        removed_count=removed_count,
    )


@router.put(
    "/member/{member_id:int}/contracts",
    response_model=MemberContractSyncResponse,
    dependencies=[edit_document_dep],
)
def sync_member_contracts(
    member_id: int,
    payload: MemberContractSyncInput,
    session: Session = Depends(dep_get_session),
):
    """Replace contracts assigned to a member while preserving signed links."""
    member = (
        session.query(Member)
        .options(selectinload(Member.member_contracts))
        .filter(Member.id == member_id, Member.is_deleted.is_(False))
        .first()
    )
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    requested_contract_ids = list(dict.fromkeys(payload.contract_ids))
    if requested_contract_ids:
        contracts = session.query(Contract).filter(
            Contract.id.in_(requested_contract_ids),
        ).all()
        found_contract_ids = {contract.id for contract in contracts}
        missing_contract_ids = [
            contract_id
            for contract_id in requested_contract_ids
            if contract_id not in found_contract_ids
        ]
        if missing_contract_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Contracts not found: {missing_contract_ids}",
            )

    requested_contract_id_set = set(requested_contract_ids)
    links_by_contract_id = {
        link.contract_id: link
        for link in member.member_contracts
    }
    current_contract_id_set = set(links_by_contract_id)

    contract_ids_to_remove = current_contract_id_set - requested_contract_id_set
    signed_contract_ids_to_remove = [
        contract_id
        for contract_id in contract_ids_to_remove
        if links_by_contract_id[contract_id].signed
    ]
    if signed_contract_ids_to_remove:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Cannot remove signed contract assignments for contracts: "
                f"{signed_contract_ids_to_remove}"
            ),
        )

    created_count = 0
    for contract_id in requested_contract_ids:
        if contract_id in links_by_contract_id:
            continue
        session.add(
            MemberContract(
                member_id=member_id,
                contract_id=contract_id,
                signed=False,
            )
        )
        created_count += 1

    removed_count = 0
    for contract_id in contract_ids_to_remove:
        session.delete(links_by_contract_id[contract_id])
        removed_count += 1

    session.commit()

    assigned_count = session.query(MemberContract).filter(
        MemberContract.member_id == member_id
    ).count()
    signed_count = session.query(MemberContract).filter(
        MemberContract.member_id == member_id,
        MemberContract.signed.is_(True),
    ).count()

    return MemberContractSyncResponse(
        status="ok",
        member_id=member_id,
        assigned_count=assigned_count,
        signed_count=signed_count,
        created_count=created_count,
        removed_count=removed_count,
    )


@router.get("/member/{member_id:int}/contract", response_model=MemberContractListResponse, dependencies=[read_document_dep])
def get_member_contract_links(member_id: int, session: Session = Depends(dep_get_session)):
    """Get contract links assigned to a member."""
    member = session.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    query = session.query(MemberContract).options(
        selectinload(MemberContract.contract)
    ).filter(MemberContract.member_id == member_id)

    total = query.count()
    member_contracts = query.all()
    return {"total": total, "member_contracts": member_contracts}


@router.post(
    "/member/{member_id:int}/contract",
    response_model=MemberContractResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[edit_document_dep],
)
def upsert_member_contract_link(
    member_id: int, payload: MemberContractCreate, session: Session = Depends(dep_get_session)
):
    """Create or update a member-contract link (upsert by member_id + contract_id)."""
    member = session.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    contract = session.query(Contract).filter(Contract.id == payload.contract_id).first()
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

    link = (
        session.query(MemberContract)
        .filter(MemberContract.member_id == member_id, MemberContract.contract_id == payload.contract_id)
        .first()
    )

    if link:
        link.signed = payload.signed
        link.signed_at = payload.signed_at or (
            datetime.now() if payload.signed and not link.signed_at else link.signed_at
        )
        link.notes = payload.notes
    else:
        link = MemberContract(
            member_id=member_id,
            contract_id=payload.contract_id,
            signed=payload.signed,
            signed_at=payload.signed_at or (datetime.now() if payload.signed else None),
            notes=payload.notes,
        )
        session.add(link)

    session.commit()
    session.refresh(link)
    return link


@router.put(
    "/member/{member_id:int}/contract/{member_contract_id:int}",
    response_model=MemberContractResponse,
    dependencies=[edit_document_dep],
)
def update_member_contract_link(
    member_id: int,
    member_contract_id: int,
    payload: MemberContractUpdate,
    session: Session = Depends(dep_get_session),
):
    """Update a member-contract link by ID within a member scope."""
    member = session.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    link = (
        session.query(MemberContract)
        .filter(MemberContract.id == member_contract_id, MemberContract.member_id == member_id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member contract link not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(link, field, value)

    if "signed" in update_data and link.signed and link.signed_at is None:
        link.signed_at = datetime.now()

    session.commit()
    session.refresh(link)
    return link
