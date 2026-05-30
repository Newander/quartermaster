from typing import Any


def model_to_dict_selective(
        instance, include_relations: list[str] | None = None, exclude_relations: list[str] | None = None
) -> dict[str, Any] | None:
    """
    Convert SQLAlchemy model to dictionary with selective relationships

    Args:
        instance: SQLAlchemy model instance
        include_relations: List of relationship names to include (e.g., ['member_contracts', 'memberships'])
        exclude_relations: List of relationship names to exclude
    """
    if instance is None:
        return None

    # Get basic columns
    result = {}
    for column in instance.__table__.columns:
        value = getattr(instance, column.name)
        # Convert datetime/date to string for JSON serialization
        if hasattr(value, 'isoformat'):
            result[column.name] = value.isoformat()
        else:
            result[column.name] = value

    # Determine which relationships to include
    if include_relations is not None:
        relations_to_process = include_relations
    else:
        relations_to_process = [rel.key for rel in instance.__mapper__.relationships]
        if exclude_relations:
            relations_to_process = [r for r in relations_to_process if r not in exclude_relations]

    # Process relationships
    for rel_name in relations_to_process:
        if not hasattr(instance, rel_name):
            continue

        rel_value = getattr(instance, rel_name)

        if rel_value is None:
            result[rel_name] = None
        elif isinstance(rel_value, list):
            result[rel_name] = [
                model_to_dict_selective(item, include_relations=[], exclude_relations=None)
                                for item in rel_value
            ]
        else:
            result[rel_name] = model_to_dict_selective(
                rel_value, include_relations=[], exclude_relations=None
            )

    return result
