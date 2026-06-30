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
  AdminInput,
  AdminPage,
  AdminPageHeader,
  AdminSelect,
} from "@/components/admin/ui";
import {
  AnalyticsSummary,
  ChatConversationRow,
  ChatCostSummary,
  ChatLogListResponse,
  ChatTurnLogRow,
  ContentIssueRow,
  downloadAnalyticsCsv,
  fetchAnalyticsSummary,
  fetchChatConversations,
  fetchChatCostSummary,
  fetchChatLogs,
  fetchLlmPricing,
  getGroupItems,
  GroupSummary,
  listGroups,
  saveLlmPricing,
} from "@/lib/api";
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

      <ChatAnalyticsSection days={days} groupId={groupId === "" ? undefined : groupId} />
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

function formatUsd(value: number): string {
  if (value < 0.0001 && value > 0) return "< $0.0001";
  return `$${value.toFixed(4)}`;
}

function ChatAnalyticsSection({
  days,
  groupId,
}: {
  days: number;
  groupId?: number;
}) {
  const [viewMode, setViewMode] = useState<"turns" | "conversations">("turns");
  const [itemId, setItemId] = useState<number | "">("");
  const [conversationId, setConversationId] = useState("");
  const [turnCode, setTurnCode] = useState("");
  const [status, setStatus] = useState<"all" | "success" | "error">("all");
  const [minQuestions, setMinQuestions] = useState("");
  const [maxQuestions, setMaxQuestions] = useState("");
  const [items, setItems] = useState<Array<{ id: number; name: string }>>([]);
  const [pricingCacheHit, setPricingCacheHit] = useState("");
  const [pricingCacheMiss, setPricingCacheMiss] = useState("");
  const [pricingOutput, setPricingOutput] = useState("");
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingMessage, setPricingMessage] = useState("");
  const [chatLogs, setChatLogs] = useState<ChatLogListResponse | null>(null);
  const [conversations, setConversations] = useState<{
    items: ChatConversationRow[];
    total: number;
    total_prompt_tokens: number;
    total_completion_tokens: number;
    total_tokens: number;
    total_cost_usd: number;
  } | null>(null);
  const [costSummary, setCostSummary] = useState<ChatCostSummary | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [exporting, setExporting] = useState(false);

  const filters = useMemo(
    () => ({
      days,
      groupId,
      itemId: itemId === "" ? undefined : itemId,
      conversationId: conversationId.trim() || undefined,
      turnCode: turnCode.trim() || undefined,
      status,
      minQuestions: minQuestions ? Number(minQuestions) : undefined,
      maxQuestions: maxQuestions ? Number(maxQuestions) : undefined,
    }),
    [conversationId, days, groupId, itemId, maxQuestions, minQuestions, status, turnCode]
  );

  useEffect(() => {
    if (!groupId) {
      setItems([]);
      setItemId("");
      return;
    }
    getGroupItems(groupId)
      .then((data) => setItems(data.items.map((item) => ({ id: item.id, name: item.name }))))
      .catch(() => setItems([]));
  }, [groupId]);

  useEffect(() => {
    fetchLlmPricing()
      .then((data) => {
        setPricingCacheHit(String(data.input_cache_hit_price_per_1m));
        setPricingCacheMiss(String(data.input_cache_miss_price_per_1m));
        setPricingOutput(String(data.output_price_per_1m));
      })
      .catch(() => {
        setPricingCacheHit("0.014");
        setPricingCacheMiss("0.075");
        setPricingOutput("0.30");
      });
  }, []);

  const loadChatData = useCallback(async () => {
    setChatLoading(true);
    setChatError("");
    try {
      const [logs, convs, costs] = await Promise.all([
        fetchChatLogs(filters),
        fetchChatConversations(filters),
        fetchChatCostSummary(filters),
      ]);
      setChatLogs(logs);
      setConversations(convs);
      setCostSummary(costs);
    } catch (err) {
      setChatLogs(null);
      setConversations(null);
      setCostSummary(null);
      setChatError(err instanceof Error ? err.message : "Không tải được dữ liệu chat");
    } finally {
      setChatLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadChatData();
  }, [loadChatData]);

  const costChartData = useMemo(
    () =>
      costSummary?.daily.map((row) => ({
        date: row.date.slice(5),
        tokens: row.total_tokens,
        cost: row.cost_usd,
        turns: row.turn_count,
      })) ?? [],
    [costSummary]
  );

  const handleSavePricing = async () => {
    setPricingSaving(true);
    setPricingMessage("");
    try {
      await saveLlmPricing({
        input_cache_hit_price_per_1m: Number(pricingCacheHit),
        input_cache_miss_price_per_1m: Number(pricingCacheMiss),
        output_price_per_1m: Number(pricingOutput),
      });
      setPricingMessage("Đã lưu giá mới — áp dụng cho lượt chat tiếp theo.");
      void loadChatData();
    } catch (err) {
      setPricingMessage(err instanceof Error ? err.message : "Không lưu được giá");
    } finally {
      setPricingSaving(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await downloadAnalyticsCsv(
        viewMode === "turns" ? "chat-logs" : "chat-conversations",
        filters
      );
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Không xuất được CSV");
    } finally {
      setExporting(false);
    }
  };

  const activeTotals =
    viewMode === "turns"
      ? chatLogs
      : conversations;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Chat RAG"
        title="Lịch sử chat & chi phí LLM"
        description="Theo dõi câu hỏi/trả lời, token và chi phí theo cuộc hội thoại."
        action={
          <AdminButton type="button" onClick={() => void loadChatData()} disabled={chatLoading}>
            {chatLoading ? "Đang tải..." : "Làm mới chat"}
          </AdminButton>
        }
      />

      <AdminCard title="Cấu hình giá LLM DeepSeek (USD / 1M token)">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminField label="Input cache hit">
            <AdminInput
              type="number"
              min="0"
              step="0.001"
              value={pricingCacheHit}
              onChange={(e) => setPricingCacheHit(e.target.value)}
            />
          </AdminField>
          <AdminField label="Input cache miss">
            <AdminInput
              type="number"
              min="0"
              step="0.001"
              value={pricingCacheMiss}
              onChange={(e) => setPricingCacheMiss(e.target.value)}
            />
          </AdminField>
          <AdminField label="Output">
            <AdminInput
              type="number"
              min="0"
              step="0.001"
              value={pricingOutput}
              onChange={(e) => setPricingOutput(e.target.value)}
            />
          </AdminField>
          <div className="flex items-end">
            <AdminButton type="button" onClick={() => void handleSavePricing()} disabled={pricingSaving}>
              {pricingSaving ? "Đang lưu..." : "Lưu giá"}
            </AdminButton>
          </div>
        </div>
        <p className="admin-muted mt-3 text-xs">
          Chi phí = (hit × giá hit) + (miss × giá miss) + (output × giá output). Giá mới chỉ áp dụng cho lượt chat tiếp theo.
        </p>
        {pricingMessage && <p className="admin-muted mt-3 text-sm">{pricingMessage}</p>}
      </AdminCard>

      <AdminCard title="Bộ lọc lịch sử chat">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminField label="Hiện vật">
            <AdminSelect
              value={itemId === "" ? "" : String(itemId)}
              onChange={(e) => setItemId(e.target.value ? Number(e.target.value) : "")}
              disabled={!groupId}
            >
              <option value="">Tất cả hiện vật</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </AdminSelect>
          </AdminField>
          <AdminField label="Mã hội thoại">
            <AdminInput
              value={conversationId}
              onChange={(e) => setConversationId(e.target.value)}
              placeholder="search_session_id hoặc session..."
            />
          </AdminField>
          <AdminField label="Mã lượt (CHAT-xxx)">
            <AdminInput
              value={turnCode}
              onChange={(e) => setTurnCode(e.target.value)}
              placeholder="CHAT-123"
            />
          </AdminField>
          <AdminField label="Trạng thái">
            <AdminSelect
              value={status}
              onChange={(e) => setStatus(e.target.value as "all" | "success" | "error")}
            >
              <option value="all">Tất cả</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
            </AdminSelect>
          </AdminField>
          <AdminField label="Tối thiểu câu hỏi / hội thoại">
            <AdminInput
              type="number"
              min="1"
              value={minQuestions}
              onChange={(e) => setMinQuestions(e.target.value)}
            />
          </AdminField>
          <AdminField label="Tối đa câu hỏi / hội thoại">
            <AdminInput
              type="number"
              min="1"
              value={maxQuestions}
              onChange={(e) => setMaxQuestions(e.target.value)}
            />
          </AdminField>
          <AdminField label="Chế độ xem">
            <AdminSelect
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as "turns" | "conversations")}
            >
              <option value="turns">Theo lượt chat</option>
              <option value="conversations">Theo hội thoại</option>
            </AdminSelect>
          </AdminField>
          <div className="flex items-end">
            <AdminButton type="button" onClick={() => void handleExportCsv()} disabled={exporting}>
              {exporting ? "Đang xuất..." : "Xuất CSV"}
            </AdminButton>
          </div>
        </div>
      </AdminCard>

      {chatError && <AdminAlert type="error">{chatError}</AdminAlert>}

      {activeTotals && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminCard title="Tổng token input">
            <p className="text-3xl font-semibold">{activeTotals.total_prompt_tokens.toLocaleString()}</p>
          </AdminCard>
          <AdminCard title="Tổng token output">
            <p className="text-3xl font-semibold">
              {activeTotals.total_completion_tokens.toLocaleString()}
            </p>
          </AdminCard>
          <AdminCard title="Tổng token">
            <p className="text-3xl font-semibold">{activeTotals.total_tokens.toLocaleString()}</p>
          </AdminCard>
          <AdminCard title="Tổng chi phí">
            <p className="text-3xl font-semibold">{formatUsd(activeTotals.total_cost_usd)}</p>
            <p className="admin-muted mt-1 text-xs">
              {viewMode === "turns" ? chatLogs?.total ?? 0 : conversations?.total ?? 0}{" "}
              {viewMode === "turns" ? "lượt" : "hội thoại"}
            </p>
          </AdminCard>
        </div>
      )}

      {costSummary && costChartData.length > 0 && (
        <AdminCard title="Token & chi phí LLM theo ngày">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={costChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                <YAxis yAxisId="tokens" tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                <YAxis
                  yAxisId="cost"
                  orientation="right"
                  tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1a1a1a",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                />
                <Legend />
                <Line yAxisId="tokens" type="monotone" dataKey="tokens" name="Token" stroke="#7CB5EC" />
                <Line yAxisId="cost" type="monotone" dataKey="cost" name="USD" stroke="#D4AF37" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>
      )}

      {viewMode === "turns" ? (
        <AdminCard title="Lịch sử chat theo lượt">
          <ChatTurnTable rows={chatLogs?.items ?? []} />
        </AdminCard>
      ) : (
        <AdminCard title="Tổng hợp theo hội thoại">
          <ChatConversationTable rows={conversations?.items ?? []} />
        </AdminCard>
      )}
    </div>
  );
}

function ChatTurnTable({ rows }: { rows: ChatTurnLogRow[] }) {
  return (
    <AdminDataTable rows={rows} emptyMessage="Chưa có lượt chat nào." minWidth="980px">
      {(pageRows) => (
        <>
          <thead className="sticky top-0 z-10 bg-[#1a1510]">
            <tr className="border-b border-white/10 text-left">
              <th className="py-2 pr-3 font-medium">Mã</th>
              <th className="max-w-[8rem] py-2 pr-3 font-medium">Thời gian</th>
              <th className="max-w-[10rem] py-2 pr-3 font-medium">Hội thoại</th>
              <th className="max-w-[10rem] py-2 pr-3 font-medium">Khu / hiện vật</th>
              <th className="max-w-[12rem] py-2 pr-3 font-medium">Câu hỏi</th>
              <th className="max-w-[12rem] py-2 pr-3 font-medium">Trả lời</th>
              <th className="py-2 pr-3 font-medium">Token hit/miss/out</th>
              <th className="py-2 pr-3 font-medium">Chi phí</th>
              <th className="py-2 pr-3 font-medium">TT</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.id} className="border-b border-white/5 align-top">
                <td className="whitespace-nowrap py-2 pr-3 font-mono text-xs">{row.turn_code}</td>
                <td className="max-w-[8rem] py-2 pr-3">
                  <TruncatedText text={formatShortDateTime(row.created_at)} maxLen={18} />
                </td>
                <td className="max-w-[10rem] py-2 pr-3">
                  <TruncatedText text={row.conversation_id} maxLen={18} mono />
                </td>
                <td className="max-w-[10rem] py-2 pr-3">
                  <TruncatedText
                    text={
                      row.item_name
                        ? `${row.group_name ?? "—"} · ${row.item_name}`
                        : (row.group_name ?? "—")
                    }
                    maxLen={24}
                  />
                </td>
                <td className="max-w-[12rem] py-2 pr-3">
                  <TruncatedText text={row.user_message} maxLen={40} />
                </td>
                <td className="max-w-[12rem] py-2 pr-3">
                  <TruncatedText text={row.assistant_message} maxLen={40} />
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-xs" title={`in hit/miss/out · ${row.token_source}`}>
                  {row.prompt_cache_hit_tokens}/{row.prompt_cache_miss_tokens}/{row.completion_tokens}
                </td>
                <td className="whitespace-nowrap py-2 pr-3">{formatUsd(row.cost_usd)}</td>
                <td className="py-2 pr-3">
                  {row.success ? (
                    <span className="text-emerald-300">OK</span>
                  ) : (
                    <span className="text-red-300" title={row.error_detail ?? undefined}>
                      Lỗi
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </>
      )}
    </AdminDataTable>
  );
}

function ChatConversationTable({ rows }: { rows: ChatConversationRow[] }) {
  return (
    <AdminDataTable rows={rows} emptyMessage="Chưa có hội thoại nào." minWidth="860px">
      {(pageRows) => (
        <>
          <thead className="sticky top-0 z-10 bg-[#1a1510]">
            <tr className="border-b border-white/10 text-left">
              <th className="max-w-[10rem] py-2 pr-3 font-medium">Hội thoại</th>
              <th className="py-2 pr-3 font-medium">Câu hỏi</th>
              <th className="max-w-[10rem] py-2 pr-3 font-medium">Khu / hiện vật</th>
              <th className="py-2 pr-3 font-medium">Token in/out</th>
              <th className="py-2 pr-3 font-medium">Chi phí</th>
              <th className="max-w-[8rem] py-2 pr-3 font-medium">Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.conversation_id} className="border-b border-white/5 align-top">
                <td className="max-w-[10rem] py-2 pr-3">
                  <TruncatedText text={row.conversation_id} maxLen={18} mono />
                </td>
                <td className="py-2 pr-3">{row.question_count}</td>
                <td className="max-w-[10rem] py-2 pr-3">
                  <TruncatedText
                    text={
                      row.item_name
                        ? `${row.group_name ?? "—"} · ${row.item_name}`
                        : (row.group_name ?? "—")
                    }
                    maxLen={24}
                  />
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-xs">
                  {row.total_prompt_tokens}/{row.total_completion_tokens}
                </td>
                <td className="whitespace-nowrap py-2 pr-3">{formatUsd(row.total_cost_usd)}</td>
                <td className="max-w-[8rem] py-2 pr-3">
                  <TruncatedText text={formatShortDateTime(row.last_at)} maxLen={18} />
                </td>
              </tr>
            ))}
          </tbody>
        </>
      )}
    </AdminDataTable>
  );
}
