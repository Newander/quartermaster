from app.config import Role


class RoleChecker:
    """
    Initialize the list of roles that are allowed access.
    Example: RoleChecker([Role.admin, Role.manager])
    """

    def __init__(self, allowed_roles: list[Role]):
        self.allowed_roles = allowed_roles
        self.role_set = {role.value for role in allowed_roles}

    def __repr__(self):
        return f"<RoleChecker({self.role_set})>"

    def check(self, user_roles: set[str]) -> bool:
        return bool(self.role_set & set(user_roles))
    
# Auth helpers
is_admin = RoleChecker([Role.admin])
is_instructor = RoleChecker([Role.instructor, Role.admin])
is_finance = RoleChecker([Role.admin, Role.finance])
is_member = RoleChecker([Role.admin, Role.finance, Role.member, Role.instructor])