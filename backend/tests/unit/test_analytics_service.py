from app.modules.analytics.service import ALLOWED_CLIENT_EVENT_TYPES


def test_allowed_client_event_types():
    assert "group_visit" in ALLOWED_CLIENT_EVENT_TYPES
    assert "item_view" in ALLOWED_CLIENT_EVENT_TYPES
    assert "search" not in ALLOWED_CLIENT_EVENT_TYPES
