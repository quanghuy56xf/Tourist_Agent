from app.modules.analytics.service import _timing_stats


class _FakeScalarQuery:
    def __init__(self, value):
        self._value = value

    def filter(self, *args, **kwargs):
        return self

    def scalar(self):
        return self._value


class _FakeDb:
    def __init__(self, values):
        self._values = list(values)

    def query(self, *args, **kwargs):
        return _FakeScalarQuery(self._values.pop(0))


def test_timing_stats_returns_zero_average_without_events():
    stats = _timing_stats(
        _FakeDb([0, None, 0, 0]),
        event_type="search",
        error_type="search_error",
        since=object(),
        group_ids=None,
    )
    assert stats.count == 0
    assert stats.avg_ms == 0.0
    assert stats.slow_count == 0
    assert stats.error_count == 0
