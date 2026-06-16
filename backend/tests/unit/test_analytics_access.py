import pytest
from fastapi import HTTPException

from app.modules.analytics.access import resolve_allowed_analytics_groups
from app.modules.auth.service import AuthUser


class _FakeQuery:
    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return None


class _FakeDb:
    def query(self, *args, **kwargs):
        return _FakeQuery()


def test_admin_can_view_all_groups():
    user = AuthUser(username="admin", role="admin")
    assert resolve_allowed_analytics_groups(_FakeDb(), user, None) is None


def test_admin_can_filter_single_group():
    user = AuthUser(username="admin", role="admin")
    assert resolve_allowed_analytics_groups(_FakeDb(), user, 3) == [3]


def test_manager_only_sees_assigned_groups():
    user = AuthUser(username="mgr", role="manager", group_ids=(1, 2))
    assert resolve_allowed_analytics_groups(_FakeDb(), user, None) == [1, 2]


def test_manager_cannot_view_unassigned_group():
    user = AuthUser(username="mgr", role="manager", group_ids=(1,))
    with pytest.raises(HTTPException) as exc:
        resolve_allowed_analytics_groups(_FakeDb(), user, 99)
    assert exc.value.status_code == 403


def test_manager_can_view_assigned_group_filter():
    user = AuthUser(username="mgr", role="manager", group_ids=(1, 2))
    assert resolve_allowed_analytics_groups(_FakeDb(), user, 2) == [2]


def test_manager_without_groups_gets_empty_scope():
    user = AuthUser(username="mgr", role="manager", group_ids=())
    assert resolve_allowed_analytics_groups(_FakeDb(), user, None) == []
