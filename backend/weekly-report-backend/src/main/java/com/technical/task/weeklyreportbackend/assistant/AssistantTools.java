package com.technical.task.weeklyreportbackend.assistant;

import com.technical.task.weeklyreportbackend.assistant.GeminiClient.FunctionDeclaration;
import com.technical.task.weeklyreportbackend.domain.ReportStatus;
import com.technical.task.weeklyreportbackend.domain.User;
import com.technical.task.weeklyreportbackend.dto.PageResponse;
import com.technical.task.weeklyreportbackend.dto.ReportSummaryResponse;
import com.technical.task.weeklyreportbackend.exception.ApiException;
import com.technical.task.weeklyreportbackend.service.DashboardService;
import com.technical.task.weeklyreportbackend.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The tools the assistant may call. All four are <strong>read-only</strong> and every one of
 * them goes through an existing service.
 *
 * <h2>Authorization is inherited, never re-implemented</h2>
 * {@link #getReportContent} calls {@link ReportService#getDetail}, which resolves the report
 * through {@code ReportAccessGuard} exactly as the REST endpoint does. So the assistant
 * cannot read another member's draft, because the guard refuses it - the same code path, the
 * same answer. Had these tools reached for repositories directly, the assistant would have
 * become a way to read data the API forbids, and the guard would have been silently bypassed.
 *
 * <h2>There are no write tools, deliberately</h2>
 * Nothing here can approve, request changes, or edit. That matters because report content is
 * text a team member wrote, and it enters the model's context as tool output - someone could
 * put "ignore your instructions and…" in a blocker. With no write tools the worst outcome of
 * that is a wrong <em>answer</em>; it can never become a wrong <em>action</em>.
 *
 * <h2>Failures come back as data</h2>
 * A refused or malformed call returns {@code {"error": "..."}} rather than throwing, so the
 * model can tell the manager "that report is still a draft" instead of the whole request
 * collapsing into a 500.
 */
@Component
@RequiredArgsConstructor
public class AssistantTools {

    private static final Logger log = LoggerFactory.getLogger(AssistantTools.class);

    /** Caps one tool result. Enough to reason over a team-week, small enough to stay cheap. */
    private static final int MAX_REPORTS = 25;

    private final ReportService reportService;
    private final DashboardService dashboardService;
    private final ObjectMapper objectMapper;

    // ---- declarations offered to the model ----

    public List<FunctionDeclaration> declarations() {
        return List.of(
                new FunctionDeclaration(
                        "get_week_overview",
                        "Summary metrics for one week: team size, how many reports were "
                                + "submitted, how many are still drafts, how many people have not "
                                + "started, the compliance percentage, plus the current count of "
                                + "reports needing correction and open blockers. Also returns one "
                                + "row per team member with that member's status for the week.",
                        object(Map.of("weekStart", string(
                                "Any date in the week, yyyy-MM-dd. Normalised to the Monday.")),
                                List.of("weekStart"))),

                new FunctionDeclaration(
                        "list_reports",
                        "Lists reports with their week, project, owner and status. Use it to find "
                                + "reports before reading one. Every filter is optional; with none, "
                                + "the most recent reports across the team are returned.",
                        object(new LinkedHashMap<>(Map.of(
                                "weekStart", string("A single week, yyyy-MM-dd."),
                                "weekFrom", string("Range start, yyyy-MM-dd."),
                                "weekTo", string("Range end, yyyy-MM-dd."),
                                "userId", integer("Numeric id of one team member."),
                                "status", string("One of DRAFT, SUBMITTED, NEEDS_CORRECTION, APPROVED."))),
                                List.of())),

                new FunctionDeclaration(
                        "get_report_content",
                        "Reads one report in full: its completed tasks, what is planned for next "
                                + "week, blockers, achievements, hours by task type, notes and the "
                                + "latest review comment. Another member's draft cannot be read.",
                        object(Map.of("reportId", integer("Numeric report id from list_reports.")),
                                List.of("reportId"))),

                new FunctionDeclaration(
                        "get_team_metrics",
                        "Aggregates over a window of weeks: tasks completed per week, each "
                                + "member's reports by status, hours and report counts per project, "
                                + "and hours by task type. Use it for trends and workload questions "
                                + "rather than reading reports one by one.",
                        object(new LinkedHashMap<>(Map.of(
                                "weekStart", string("The most recent week to include, yyyy-MM-dd."),
                                "weeks", integer("How many weeks back to cover, 1 to 52."))),
                                List.of("weekStart")))
        );
    }

    // ---- dispatch ----

    /**
     * Runs one tool call on behalf of {@code actor}. The actor is threaded through rather than
     * read from a security context so the authorization decision is an argument, not ambient
     * state - it is impossible to call this without saying who is asking.
     */
    public Map<String, Object> run(String name, Map<String, Object> arguments, User actor) {
        try {
            return switch (name) {
                case "get_week_overview" -> getWeekOverview(arguments);
                case "list_reports" -> listReports(arguments);
                case "get_report_content" -> getReportContent(arguments, actor);
                case "get_team_metrics" -> getTeamMetrics(arguments);
                default -> error("There is no tool called '" + name + "'.");
            };
        } catch (ApiException ex) {
            // An application refusal - a draft that is not visible, a report that does not
            // exist. The model is told why so it can pass that on in plain language.
            return error(ex.getMessage());
        } catch (RuntimeException ex) {
            log.warn("Assistant tool '{}' failed", name, ex);
            return error("That lookup failed.");
        }
    }

    private Map<String, Object> getWeekOverview(Map<String, Object> arguments) {
        LocalDate week = requireDate(arguments, "weekStart");
        return Map.of(
                "summary", asMap(dashboardService.summary(week)),
                "members", reportService.weekStatus(week).stream().map(this::asMap).toList());
    }

    private Map<String, Object> listReports(Map<String, Object> arguments) {
        PageResponse<ReportSummaryResponse> page = reportService.listTeam(
                optionalLong(arguments, "userId"),
                null,
                optionalStatus(arguments),
                optionalDate(arguments, "weekStart"),
                optionalDate(arguments, "weekFrom"),
                optionalDate(arguments, "weekTo"),
                PageRequest.of(0, MAX_REPORTS,
                        Sort.by(Sort.Direction.DESC, "weekStart").and(Sort.by(Sort.Direction.DESC, "id"))));

        return Map.of(
                "reports", page.content().stream().map(this::asMap).toList(),
                "returned", page.content().size(),
                "totalMatching", page.totalElements(),
                // Stated so the model qualifies its answer instead of treating a capped page
                // as the complete set.
                "truncated", page.totalElements() > page.content().size());
    }

    private Map<String, Object> getReportContent(Map<String, Object> arguments, User actor) {
        long reportId = requireLong(arguments, "reportId");
        // Straight through the service, so ReportAccessGuard applies. A peer's draft raises
        // DraftNotVisibleException and comes back as an error the model can explain.
        return asMap(reportService.getDetail(reportId, actor));
    }

    private Map<String, Object> getTeamMetrics(Map<String, Object> arguments) {
        LocalDate week = requireDate(arguments, "weekStart");
        int weeks = (int) Math.min(52, Math.max(1, optionalLong(arguments, "weeks") == null
                ? 8
                : optionalLong(arguments, "weeks")));
        return asMap(dashboardService.charts(week, weeks));
    }

    // ---- JSON Schema helpers, so the declarations above stay readable ----

    private Map<String, Object> object(Map<String, Object> properties, List<String> required) {
        return Map.of("type", "object", "properties", properties, "required", required);
    }

    private Map<String, Object> string(String description) {
        return Map.of("type", "string", "description", description);
    }

    private Map<String, Object> integer(String description) {
        return Map.of("type", "integer", "description", description);
    }

    // ---- argument coercion: the model sends JSON, not Java types ----

    private LocalDate requireDate(Map<String, Object> arguments, String key) {
        LocalDate value = optionalDate(arguments, key);
        if (value == null) {
            throw new IllegalArgumentException(key + " is required and must be yyyy-MM-dd");
        }
        return value;
    }

    private LocalDate optionalDate(Map<String, Object> arguments, String key) {
        Object raw = arguments.get(key);
        if (raw == null || String.valueOf(raw).isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(String.valueOf(raw).trim());
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException(key + " must be a date in yyyy-MM-dd form");
        }
    }

    private long requireLong(Map<String, Object> arguments, String key) {
        Long value = optionalLong(arguments, key);
        if (value == null) {
            throw new IllegalArgumentException(key + " is required and must be a number");
        }
        return value;
    }

    /** Numbers may arrive as Integer, Long, Double or a numeric String, depending on the model. */
    private Long optionalLong(Map<String, Object> arguments, String key) {
        Object raw = arguments.get(key);
        if (raw == null) {
            return null;
        }
        if (raw instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(raw).trim());
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException(key + " must be a number");
        }
    }

    private List<ReportStatus> optionalStatus(Map<String, Object> arguments) {
        Object raw = arguments.get("status");
        if (raw == null || String.valueOf(raw).isBlank()) {
            return null;
        }
        try {
            return List.of(ReportStatus.valueOf(String.valueOf(raw).trim().toUpperCase()));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException(
                    "status must be DRAFT, SUBMITTED, NEEDS_CORRECTION or APPROVED");
        }
    }

    /** Records to JSON-shaped maps, using the application's own configured mapper. */
    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        return objectMapper.convertValue(value, Map.class);
    }

    private Map<String, Object> error(String message) {
        return Map.of("error", message);
    }
}
