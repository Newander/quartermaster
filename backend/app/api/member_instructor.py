"""
Members API endpoints
"""

from app.auth.dependancies import member_get_dep, admin_dep, member_edit_dep
from app.common.route_generator import RouteAlchemyManager, custom_filter
from app.database import QuartermasterCRMBase
from app.db_schemas import RelationLookupOut
from app.models import Instructor
from app.models.hr import Member
from sqlalchemy.orm import Query

### Member
route_member_manager = RouteAlchemyManager(
    Member,
    get_depends=[member_get_dep],
    create_depends=[admin_dep],
    edit_depends=[member_edit_dep],
    delete_depends=[admin_dep],
    relation_lookups={
        "instructor_impersonation": RelationLookupOut(
            api_route="/instructor",
            value_field="id",
            label_field="specialization",
            description="Powiązany rekord instruktora dla wybranego członka.",
            app_route="/instructor",
            relation_kind="one",
        ),
        "member_contracts": RelationLookupOut(
            api_route="/contract",
            value_field="id",
            source_value_field="contract_id",
            label_field="title",
            transcription="Dokumenty",
            description="Wybierz dokumenty przypisane do członka.",
            app_route="/contract",
            foreign_key="contract_id",
            foreign_table="contract",
            relation_kind="many",
        ),
        "memberships": RelationLookupOut(
            api_route="/membership/plans",
            value_field="id",
            label_field="name",
            description="Wybierz plany członkostwa powiązane z rekordem członka.",
            foreign_table="membership_plan",
            relation_kind="many",
        ),
        "shelf_rentals": RelationLookupOut(
            api_route="/shelves/shelves",
            value_field="id",
            label_field="shelf_number",
            description="Wybierz wypożyczenia półek powiązane z członkiem.",
            relation_kind="many",
        ),
        "training_sessions": RelationLookupOut(
            api_route="/training/training-session",
            value_field="id",
            label_field="session_date",
            description="Wybierz sesje treningowe powiązane z członkiem.",
            relation_kind="many",
        ),
    },
)


def is_instructor_filter[T: QuartermasterCRMBase](query: Query[T], is_instructor: bool) -> Query[T]:
    """ Allows showing only Instructors from the Members """
    if is_instructor:
        query = query.join(Instructor)
    else:
        query = query.join(Instructor, isouter=True).filter(Instructor.id == None)

    return query


route_member_manager.link_list_route(
    list_filters=[
        ('is_instructor', 'Instruktor?', bool, is_instructor_filter),
        ('is_deleted', 'Usunęty?', bool, lambda query, value: custom_filter(query, Member.is_deleted, value)),
    ],
)
route_member_manager.link_schema_route()
route_member_manager.link_get_route()
route_member_manager.link_create_route(unique_field='email')
route_member_manager.link_update_route(unique_field='email')
route_member_manager.link_export_route()
route_member_manager.link_delete_route()

### Instructors
route_instructor_manager = RouteAlchemyManager(
    Instructor,
    get_depends=[member_get_dep],
    create_depends=[admin_dep],
    edit_depends=[admin_dep],
    delete_depends=[admin_dep],
    relation_lookups={
        "member_id": RelationLookupOut(
            api_route="/member",
            value_field="id",
            label_field="email",
            description="Wybierz członka, który ma być powiązany z instruktorem.",
            app_route="/member",
        ),
    },
)
route_instructor_manager.link_list_route(
    list_filters=[
        ('is_active', 'Aktiwny?', bool, lambda query, value: custom_filter(query, Instructor.is_active, value)),
    ],
)
route_instructor_manager.link_schema_route()
route_instructor_manager.link_get_route()
route_instructor_manager.link_create_route(unique_field='member_id')
route_instructor_manager.link_update_route(unique_field='member_id')
route_instructor_manager.link_delete_route()
