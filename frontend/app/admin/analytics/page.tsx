"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AdminDataTable,
  formatShortDateTime,
  TruncatedText,
} from "@/components/admin/AdminDataTable";
import {
  AdminAlert,
  AdminButton,
  AdminCard,
  AdminField,
  AdminPage,
  AdminPageHeader,
  AdminSelect,
} from "@/components/admin/ui";
import { AnalyticsSummary, ContentIssueRow, fetchAnalyticsSummary, GroupSummary, listGroups } from "@/lib/api";
import { canAccessGroup, getAdminSession } from "@/lib/adminAuth";

const DAY_OPTIONS = [
  { value: 7, label: "7 ngày" },
  { value: 30, label: "30 ngày" },
  { value: 90, label: "90 ngày" },
];

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return `${minutes}p ${rest}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}g ${mins}p`;
}

function mergeDailyTrend(
  groups: AnalyticsSummary["groups"],
  key: "visit_trend" | "search_trend"
) {
  const map = new Map<string, number>();
  for (const group of groups) {
    for (const point of group[key]) {
      map.set(point.date, (map.get(point.date) ?? 0) + point.count);
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [groupId, setGroupId] = useState<number | "">("");
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAnalyticsSummary(days, groupId === "" ? undefined : groupId);
      setSummary(data);
    } catch (err) {
      setSummary(null);
      setError(err instanceof Error ? err.message : "Không tải được thống kê");
    } finally {
      setLoading(false);
    }
  }, [days, groupId]);

  useEffect(() => {
    listGroups()
      .then((data) => {
        const session = getAdminSession();
        const visible =
          session?.role === "admin"
            ? data
            : data.filter((group) => canAccessGroup(session, group.id));
        setGroups(visible);
        setGroupId((current) => {
          if (current === "" || session?.role === "admin") return current;
          return canAccessGroup(session, current) ? current : "";
        });
      })
      .catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const groupChartData = useMemo(
    () =>
      summary?.groups.map((group) => ({
        name: group.group_name,
        visits: group.visits,
        searches: group.searches,
      })) ?? [],
    [summary]
  );

  const visitTrend = useMemo(
    () => (summary ? mergeDailyTrend(summary.groups, "visit_trend") : []),
    [summary]
  );
  const searchTrend = useMemo(
    () => (summary ? mergeDailyTrend(summary.groups, "search_trend") : []),
    [summary]
  );

  const trendChartData = useMemo(() => {
    const dates = new Set([...visitTrend.map((p) => p.date), ...searchTrend.map((p) => p.date)]);
    const visitMap = new Map(visitTrend.map((p) => [p.date, p.count]));
    const searchMap = new Map(searchTrend.map((p) => [p.date, p.count]));
    return Array.from(dates)
      .sort()
      .map((date) => ({
        date: date.slice(5),
        visits: visitMap.get(date) ?? 0,
        searches: searchMap.get(date) ?? 0,
      }));
  }, [visitTrend, searchTrend]);

  const chatDistribution = summary?.chat_per_search.distribution ?? [];

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Quản trị"
        title="Thống kê & theo dõi"
        description="Lượt truy cập, tìm kiếm hiện vật, tương tác chat và các trường hợp chậm/lỗi."
        action={
          <AdminButton type="button" onClick={() => void loadSummary()} disabled={loading}>
            {loading ? "Đang tải..." : "Làm mới"}
          </AdminButton>
        }
      />

      <AdminCard>
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField label="Khoảng thời gian">
            <AdminSelect
              value={String(days)}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {DAY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AdminSelect>
          </AdminField>
          <AdminField label="Khu di tích">
            <AdminSelect
              value={groupId === "" ? "" : String(groupId)}
              onChange={(e) => {
                const next = e.target.value ? Number(e.target.value) : "";
                const session = getAdminSession();
                if (
                  next !== "" &&
                  session?.role === "manager" &&
                  !canAccessGroup(session, next)
                ) {
                  return;
                }
                setGroupId(next);
              }}
            >
              <option value="">
                {getAdminSession()?.role === "manager" ? "Tất cả khu được gán" : "Tất cả khu"}
              </option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </AdminSelect>
          </AdminField>
        </div>
      </AdminCard>

      {error && <AdminAlert type="error">{error}</AdminAlert>}

      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminCard title="Lượt truy cập">
              <p className="text-3xl font-semibold">{summary.total_visits}</p>
            </AdminCard>
            <AdminCard title="Lượt tìm kiếm">
              <p className="text-3xl font-semibold">{summary.total_searches}</p>
            </AdminCard>
            <AdminCard title="TB thời gian tìm kiếm">
              <p className="text-3xl font-semibold">
                {formatMs(summary.search_timing.avg_ms)}
              </p>
              <p className="admin-muted mt-1 text-xs">
                {summary.search_timing.slow_count} lần &gt; 10s · {summary.search_timing.error_count}{" "}
                lỗi
              </p>
            </AdminCard>
            <AdminCard title="TB câu hỏi / lần tìm">
              <p className="text-3xl font-semibold">
                {summary.chat_per_search.avg_questions.toFixed(1)}
              </p>
              <p className="admin-muted mt-1 text-xs">
                {summary.chat_per_search.sessions_with_search} phiên có tìm kiếm
              </p>
            </AdminCard>
          </div>

          <AdminCard title="Truy cập & tìm kiếm theo khu di tích">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groupChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#1a1a1a",
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="visits" name="Truy cập" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="searches" name="Tìm kiếm" fill="#7CB5EC" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </AdminCard>

          <AdminCard title="Xu hướng theo ngày">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#1a1a1a",
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="visits" name="Truy cập" stroke="#D4AF37" />
                  <Line type="monotone" dataKey="searches" name="Tìm kiếm" stroke="#7CB5EC" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </AdminCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <AdminCard
              title="Số câu hỏi chat sau mỗi lần tìm kiếm"
              description="Phân bố số câu hỏi trong phiên tìm kiếm hiện vật."
            >
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chatDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="questions"
                      tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }}
                      label={{ value: "Câu hỏi", position: "insideBottom", offset: -2 }}
                    />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        background: "#1a1a1a",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    />
                    <Bar dataKey="sessions" name="Số phiên" fill="#90EE90" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="admin-muted text-sm">
                Trung bình {summary.chat_per_search.avg_questions.toFixed(2)} câu hỏi / phiên tìm
                kiếm.
              </p>
            </AdminCard>

            <AdminCard
              title="Thời gian phản hồi chat"
              description="Trung bình và các trường hợp chậm (&gt; 10 giây)."
            >
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="admin-muted">Số lượt chat</dt>
                  <dd className="text-lg font-semibold">{summary.chat_timing.count}</dd>
                </div>
                <div>
                  <dt className="admin-muted">Thời gian TB</dt>
                  <dd className="text-lg font-semibold">
                    {formatMs(summary.chat_timing.avg_ms)}
                  </dd>
                </div>
                <div>
                  <dt className="admin-muted">Chậm (&gt; 10s)</dt>
                  <dd className="text-lg font-semibold text-amber-300">
                    {summary.chat_timing.slow_count}
                  </dd>
                </div>
                <div>
                  <dt className="admin-muted">Lỗi</dt>
                  <dd className="text-lg font-semibold text-red-300">
                    {summary.chat_timing.error_count}
                  </dd>
                </div>
              </dl>
            </AdminCard>
          </div>

          <AdminCard
            title="Thời gian tương tác theo IP & khu di tích"
            description="Tính từ sự kiện đầu tiên đến sự kiện cuối trong cùng phiên trình duyệt."
          >
            <AdminDataTable
              rows={summary.session_durations}
              emptyMessage="Chưa có dữ liệu phiên."
              minWidth="680px"
            >
              {(pageRows) => (
                <>
                  <thead className="sticky top-0 z-10 bg-[#1a1510]">
                    <tr className="border-b border-white/10 text-left">
                      <th className="max-w-[9rem] py-2 pr-3 font-medium">Khu di tích</th>
                      <th className="max-w-[7rem] py-2 pr-3 font-medium">IP</th>
                      <th className="max-w-[6rem] py-2 pr-3 font-medium">Phiên</th>
                      <th className="py-2 pr-3 font-medium">Thời lượng</th>
                      <th className="py-2 pr-3 font-medium">Sự kiện</th>
                      <th className="max-w-[8.5rem] py-2 pr-3 font-medium">Lần cuối</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => (
                      <tr
                        key={`${row.session_id}-${row.group_id}-${row.client_ip}`}
                        className="border-b border-white/5"
                      >
                        <td className="max-w-[9rem] py-2 pr-3">
                          <TruncatedText text={row.group_name} maxLen={22} />
                        </td>
                        <td className="max-w-[7rem] py-2 pr-3">
                          <TruncatedText text={row.client_ip} maxLen={15} mono />
                        </td>
                        <td className="max-w-[6rem] py-2 pr-3">
                          <TruncatedText text={row.session_id} maxLen={10} mono />
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3">
                          {formatDuration(row.duration_seconds)}
                        </td>
                        <td className="py-2 pr-3">{row.event_count}</td>
                        <td className="max-w-[8.5rem] whitespace-nowrap py-2 pr-3">
                          <span title={new Date(row.last_seen).toLocaleString("vi-VN")}>
                            {formatShortDateTime(row.last_seen)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </AdminDataTable>
          </AdminCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <AdminCard title="Tìm kiếm / chat chậm (&gt; 10 giây)">
              <IssueTable rows={summary.slow_events} emptyLabel="Không có trường hợp chậm." />
            </AdminCard>
            <AdminCard title="Lỗi gần đây">
              <IssueTable rows={summary.recent_errors} emptyLabel="Không có lỗi ghi nhận." />
            </AdminCard>
          </div>

          <AdminCard
            title="Sinh nội dung hiện vật"
            description="Thiếu thông tin RAG, lỗi sinh text hoặc lỗi sinh audio theo hiện vật / persona / ngôn ngữ."
          >
            <dl className="mb-4 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="admin-muted">Không có thông tin</dt>
                <dd className="text-lg font-semibold text-amber-300">
                  {summary.content_no_information_count}
                </dd>
              </div>
              <div>
                <dt className="admin-muted">Lỗi sinh text</dt>
                <dd className="text-lg font-semibold text-red-300">
                  {summary.content_text_error_count}
                </dd>
              </div>
              <div>
                <dt className="admin-muted">Lỗi sinh audio</dt>
                <dd className="text-lg font-semibold text-red-300">
                  {summary.content_audio_error_count}
                </dd>
              </div>
            </dl>
            <ContentIssueTable
              rows={summary.content_issues}
              emptyLabel="Chưa có sự kiện sinh nội dung."
            />
          </AdminCard>
        </>
      )}
    </AdminPage>
  );
}

function contentEventLabel(eventType: string): string {
  switch (eventType) {
    case "content_no_information":
      return "Không có thông tin";
    case "content_text_error":
      return "Lỗi sinh text";
    case "content_audio_error":
      return "Lỗi sinh audio";
    default:
      return eventType;
  }
}

function ContentIssueTable({
  rows,
  emptyLabel,
}: {
  rows: ContentIssueRow[];
  emptyLabel: string;
}) {
  return (
    <AdminDataTable rows={rows} emptyMessage={emptyLabel} minWidth="720px">
      {(pageRows) => (
        <>
          <thead className="sticky top-0 z-10 bg-[#1a1510]">
            <tr className="border-b border-white/10 text-left">
              <th className="py-2 pr-3 font-medium">Loại</th>
              <th className="max-w-[8.5rem] py-2 pr-3 font-medium">Thời gian</th>
              <th className="max-w-[11rem] py-2 pr-3 font-medium">Khu / hiện vật</th>
              <th className="max-w-[7rem] py-2 pr-3 font-medium">Persona</th>
              <th className="py-2 pr-3 font-medium">Ngôn ngữ</th>
              <th className="max-w-[12rem] py-2 pr-3 font-medium">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, index) => (
              <tr key={`${row.created_at}-${index}`} className="border-b border-white/5 align-top">
                <td className="py-2 pr-3">{contentEventLabel(row.event_type)}</td>
                <td className="max-w-[8.5rem] py-2 pr-3">
                  <TruncatedText text={formatShortDateTime(row.created_at)} maxLen={18} />
                </td>
                <td className="max-w-[11rem] py-2 pr-3">
                  <TruncatedText
                    text={
                      row.item_name
                        ? `${row.group_name ?? "—"} · ${row.item_name}`
                        : (row.group_name ?? "—")
                    }
                    maxLen={28}
                  />
                </td>
                <td className="max-w-[7rem] py-2 pr-3">
                  <TruncatedText text={row.persona} maxLen={16} />
                </td>
                <td className="py-2 pr-3">{row.language ?? "—"}</td>
                <td className="max-w-[12rem] py-2 pr-3">
                  <TruncatedText text={row.error_detail} maxLen={40} />
                </td>
              </tr>
            ))}
          </tbody>
        </>
      )}
    </AdminDataTable>
  );
}

function IssueTable({
  rows,
  emptyLabel,
}: {
  rows: AnalyticsSummary["slow_events"];
  emptyLabel: string;
}) {
  return (
    <AdminDataTable rows={rows} emptyMessage={emptyLabel} minWidth="560px">
      {(pageRows) => (
        <>
          <thead className="sticky top-0 z-10 bg-[#1a1510]">
            <tr className="border-b border-white/10 text-left">
              <th className="py-2 pr-3 font-medium">Loại</th>
              <th className="max-w-[8rem] py-2 pr-3 font-medium">Thời gian</th>
              <th className="max-w-[11rem] py-2 pr-3 font-medium">Khu / hiện vật</th>
              <th className="max-w-[7rem] py-2 pr-3 font-medium">IP</th>
              <th className="max-w-[12rem] py-2 pr-3 font-medium">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, index) => (
              <tr key={`${row.created_at}-${index}`} className="border-b border-white/5 align-top">
                <td className="py-2 pr-3">{row.event_type}</td>
                <td className="max-w-[8rem] py-2 pr-3">
                  <div className="whitespace-nowrap">
                    {row.duration_ms != null ? formatMs(row.duration_ms) : "—"}
                  </div>
                  <TruncatedText
                    text={formatShortDateTime(row.created_at)}
                    maxLen={18}
                    className="admin-muted text-xs"
                  />
                </td>
                <td className="max-w-[11rem] py-2 pr-3">
                  <TruncatedText
                    text={
                      row.item_name
                        ? `${row.group_name ?? "—"} · ${row.item_name}`
                        : (row.group_name ?? "—")
                    }
                    maxLen={28}
                  />
                </td>
                <td className="max-w-[7rem] py-2 pr-3">
                  <TruncatedText text={row.client_ip} maxLen={15} mono />
                </td>
                <td className="max-w-[12rem] py-2 pr-3">
                  <TruncatedText text={row.error_detail} maxLen={36} />
                </td>
              </tr>
            ))}
          </tbody>
        </>
      )}
    </AdminDataTable>
  );
}
