package com.technical.task.weeklyreportbackend.seed;

import com.technical.task.weeklyreportbackend.domain.Achievement;
import com.technical.task.weeklyreportbackend.domain.Blocker;
import com.technical.task.weeklyreportbackend.domain.HoursEntry;
import com.technical.task.weeklyreportbackend.domain.Project;
import com.technical.task.weeklyreportbackend.domain.Report;
import com.technical.task.weeklyreportbackend.domain.ReportStatus;
import com.technical.task.weeklyreportbackend.domain.ReportVersion;
import com.technical.task.weeklyreportbackend.domain.ReviewAction;
import com.technical.task.weeklyreportbackend.domain.ReviewComment;
import com.technical.task.weeklyreportbackend.domain.Role;
import com.technical.task.weeklyreportbackend.domain.TaskEntry;
import com.technical.task.weeklyreportbackend.domain.TaskPriority;
import com.technical.task.weeklyreportbackend.domain.TaskStatus;
import com.technical.task.weeklyreportbackend.domain.TaskType;
import com.technical.task.weeklyreportbackend.domain.User;
import com.technical.task.weeklyreportbackend.repository.ProjectRepository;
import com.technical.task.weeklyreportbackend.repository.ReportRepository;
import com.technical.task.weeklyreportbackend.repository.ReportVersionRepository;
import com.technical.task.weeklyreportbackend.repository.ReviewCommentRepository;
import com.technical.task.weeklyreportbackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Loads the demo dataset the assignment asks for: several team members, a couple of
 * managers, and six weeks of reports spread across every status — including one report that
 * went through a full correction cycle and so has two versions.
 *
 * <h2>Why a loader and not a Flyway migration</h2>
 * A seed migration would have to hardcode absolute week dates, and the dashboard opens on
 * the <em>current</em> week: run the project a month after those dates were written and it
 * greets you with an empty dashboard. This computes every week relative to today, so the
 * demo looks alive whenever it is run. It also means passwords are hashed by the real
 * {@link PasswordEncoder} rather than pasted in as pre-computed digests.
 *
 * <h2>When it runs</h2>
 * Only when the {@code users} table is empty. That makes it safe on every subsequent
 * start-up and impossible to run over data someone has entered — so an existing database is
 * never touched, and the way to see this data is to drop the schema and start again.
 * {@code app.seed.enabled=false} turns it off entirely (the tests do that).
 *
 * <h2>It goes through the same states the API does</h2>
 * Content is written to a version, submitting freezes that version, requesting changes adds
 * a comment and no version, and the next edit forks the version after it. Reproducing the
 * shapes by hand — a frozen version whose children changed, say, or a NEEDS_CORRECTION
 * report with an unfrozen current version — would produce data the real endpoints can never
 * produce, and the dashboard aggregates assume otherwise.
 */
@Component
@ConditionalOnProperty(name = "app.seed.enabled", matchIfMissing = true)
@RequiredArgsConstructor
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    /** Stated in the README. Satisfies the same password policy the API enforces. */
    private static final String DEMO_PASSWORD = "Demo@1234";

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final ReportRepository reportRepository;
    private final ReportVersionRepository versionRepository;
    private final ReviewCommentRepository reviewCommentRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.count() > 0) {
            log.info("Demo data not loaded: the users table already has rows.");
            return;
        }

        List<Project> projects = projectRepository.findByActiveTrueOrderByNameAsc();
        if (projects.isEmpty()) {
            // V2 seeds five, so this only happens if someone removed them.
            log.warn("Demo data not loaded: no active projects exist to file reports against.");
            return;
        }

        Seed seed = new Seed(projects);
        seed.build();

        log.info("Demo data loaded: {} users, {} reports. Sign in with any of the emails and "
                        + "the password {}.",
                userRepository.count(), reportRepository.count(), DEMO_PASSWORD);
    }

    /**
     * Holds the run's mutable bits so the building methods don't have to thread them
     * through every call. One instance per seeding run.
     */
    private final class Seed {

        private final List<Project> projects;
        /** Monday of the current week; every other week is derived from it. */
        private final LocalDate thisWeek = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        private User maya;
        private User tom;
        private User priya;
        private User daniel;
        private User sofia;
        private User liam;

        private Seed(List<Project> projects) {
            this.projects = projects;
        }

        void build() {
            createUsers();
            createReports();
        }

        private void createUsers() {
            maya = user("Maya Sharma", "maya.sharma@example.com", Role.MANAGER);
            tom = user("Tom Becker", "tom.becker@example.com", Role.MANAGER);
            priya = user("Priya Nair", "priya.nair@example.com", Role.TEAM_MEMBER);
            daniel = user("Daniel Osei", "daniel.osei@example.com", Role.TEAM_MEMBER);
            sofia = user("Sofia Rossi", "sofia.rossi@example.com", Role.TEAM_MEMBER);
            liam = user("Liam Chen", "liam.chen@example.com", Role.TEAM_MEMBER);
        }

        /**
         * Six weeks of history. The current week is arranged so that every part of the
         * dashboard has something to show: one report waiting to be reviewed, one waiting on
         * its author, one still a draft, and somebody who hasn't filed at all.
         */
        private void createReports() {
            // ---- this week: the state the demo starts from ----
            submitted(priya, week(0), project("Client A"), 3);
            changesRequested(daniel, week(0), project("Internal Tooling"), 2, maya,
                    "The hours breakdown adds up to 31h but the tasks total 24h — please "
                            + "reconcile them, and split the migration work into its own task.");
            draft(sofia, week(0), project("R&D"), 2);
            // Liam files nothing this week, which is what makes "not started" and the
            // compliance rate show something other than 100%.

            // ---- last week: the correction cycle, start to finish ----
            approved(priya, week(1), project("Client A"), 3, maya, "Clear and complete, thanks.");
            approved(daniel, week(1), project("Internal Tooling"), 3, maya, null);
            correctedThenApproved(sofia, week(1), project("Marketing"), maya);
            submitted(liam, week(1), project("Support"), 2);

            // ---- earlier weeks: enough history for the trend charts ----
            approved(priya, week(2), project("Marketing"), 2, tom, null);
            approved(sofia, week(2), project("R&D"), 3, maya, "Good detail on the regressions.");
            changesRequested(liam, week(2), project("Support"), 2, tom,
                    "Please add the output/deliverable column for each task.");
            // A manager files their own weekly report too, and is reviewed by the other
            // manager — self-review is refused by the API.
            approved(tom, week(2), project("Internal Tooling"), 2, maya, null);

            approved(priya, week(3), project("Client A"), 3, maya, null);
            approved(daniel, week(3), project("R&D"), 2, tom, null);
            submitted(sofia, week(3), project("Marketing"), 2);
            approved(liam, week(3), project("Support"), 2, maya, "Thanks for the runbook.");

            approved(priya, week(4), project("Client A"), 2, maya, null);
            changesRequested(daniel, week(4), project("Client A"), 2, maya,
                    "Two tasks are still marked In progress at 100% planned — please correct "
                            + "the status or the percentage.");
            approved(sofia, week(4), project("R&D"), 2, tom, null);

            approved(priya, week(5), project("Internal Tooling"), 2, maya, null);
            approved(daniel, week(5), project("Internal Tooling"), 3, tom, null);
            approved(liam, week(5), project("Support"), 2, maya, null);
        }

        // ---- the lifecycle, mirroring ReportService ----

        /** A report whose current version has never been submitted. */
        private Report draft(User owner, LocalDate weekStart, Project project, int taskCount) {
            Report report = reportRepository.save(Report.builder()
                    .user(owner)
                    .project(project)
                    .weekStart(weekStart)
                    .weekEnd(weekStart.plusDays(6))
                    .status(ReportStatus.DRAFT)
                    .build());

            ReportVersion version = ReportVersion.builder()
                    .report(report)
                    .versionNumber(1)
                    .build();
            applyContent(version, owner, weekStart, taskCount, false);
            versionRepository.save(version);

            return report;
        }

        private Report submitted(User owner, LocalDate weekStart, Project project, int taskCount) {
            Report report = draft(owner, weekStart, project, taskCount);
            freezeCurrentVersion(report, submittedAt(weekStart));
            return report;
        }

        private void approved(User owner, LocalDate weekStart, Project project, int taskCount,
                              User reviewer, String note) {
            Report report = submitted(owner, weekStart, project, taskCount);
            review(report, reviewer, ReviewAction.APPROVE, note,
                    ReportStatus.APPROVED, submittedAt(weekStart).plusHours(20));
        }

        /**
         * The state directly after a manager sends a report back: the version they rejected
         * is still the current one, and no new version exists until the author edits. That is
         * the lazy fork the API implements, and the UI's "Edit &amp; resubmit" wording
         * depends on it.
         */
        private void changesRequested(User owner, LocalDate weekStart, Project project,
                                      int taskCount, User reviewer, String comment) {
            Report report = submitted(owner, weekStart, project, taskCount);
            review(report, reviewer, ReviewAction.REQUEST_CHANGES, comment,
                    ReportStatus.NEEDS_CORRECTION, submittedAt(weekStart).plusHours(6));
        }

        /**
         * A full cycle: submitted, sent back, corrected into version 2, resubmitted and
         * approved. This is the report to open in a demo — v1 stays readable next to v2, and
         * each comment is attached to the version it was made against.
         */
        private void correctedThenApproved(User owner, LocalDate weekStart, Project project,
                                           User reviewer) {
            Report report = submitted(owner, weekStart, project, 2);
            LocalDateTime firstSubmission = submittedAt(weekStart);

            review(report, reviewer, ReviewAction.REQUEST_CHANGES,
                    "Only two tasks for a full week, and the blockers section is empty even "
                            + "though the release slipped. Please expand both and resubmit.",
                    ReportStatus.NEEDS_CORRECTION, firstSubmission.plusHours(5));

            // The author's first edit after a freeze forks the next version.
            ReportVersion frozen = currentVersion(report);
            ReportVersion corrected = ReportVersion.builder()
                    .report(report)
                    .versionNumber(frozen.getVersionNumber() + 1)
                    .build();
            applyContent(corrected, owner, weekStart, 4, true);
            versionRepository.save(corrected);

            freezeCurrentVersion(report, firstSubmission.plusDays(1));
            review(report, reviewer, ReviewAction.APPROVE,
                    "Much clearer — thanks for adding the blockers.",
                    ReportStatus.APPROVED, firstSubmission.plusDays(1).plusHours(3));
        }

        private void freezeCurrentVersion(Report report, LocalDateTime at) {
            ReportVersion current = currentVersion(report);
            current.setSubmittedAt(at);
            versionRepository.save(current);

            report.setStatus(ReportStatus.SUBMITTED);
            report.setLastSubmittedAt(at);
            reportRepository.save(report);
        }

        private void review(Report report, User reviewer, ReviewAction action, String comment,
                            ReportStatus outcome, LocalDateTime at) {
            reviewCommentRepository.save(ReviewComment.builder()
                    .reportVersion(currentVersion(report))
                    .reviewer(reviewer)
                    .action(action)
                    .comment(comment)
                    .createdAt(at)
                    .build());

            report.setStatus(outcome);
            reportRepository.save(report);
        }

        private ReportVersion currentVersion(Report report) {
            return versionRepository
                    .findTopByReportIdOrderByVersionNumberDesc(report.getId())
                    .orElseThrow(() -> new IllegalStateException(
                            "seeded report " + report.getId() + " has no version"));
        }

        // ---- content ----

        /**
         * Fills a version with tasks, a plan, blockers, achievements and an hours breakdown
         * drawn from the owner's archetype, varied by week so the charts have movement rather
         * than a flat line. {@code expanded} is the corrected pass, which adds the blockers
         * the reviewer asked for.
         */
        private void applyContent(ReportVersion version, User owner, LocalDate weekStart,
                                  int taskCount, boolean expanded) {
            Archetype archetype = Archetype.forEmail(owner.getEmail());
            int weekIndex = (int) java.time.temporal.ChronoUnit.WEEKS.between(weekStart, thisWeek);

            List<TaskEntry> tasks = new ArrayList<>();
            BigDecimal totalSpent = BigDecimal.ZERO;
            for (int index = 0; index < taskCount; index++) {
                int pick = (weekIndex * 3 + index) % archetype.taskNames().length;
                // Deterministic but uneven: the last task of a week is the one still in flight.
                boolean done = index < taskCount - 1 || weekIndex % 3 != 0;
                BigDecimal planned = BigDecimal.valueOf(6 + (pick % 3) * 2L);
                BigDecimal spent = planned.add(BigDecimal.valueOf((pick % 4) - 1L))
                        .max(BigDecimal.ONE);
                totalSpent = totalSpent.add(spent);

                tasks.add(TaskEntry.builder()
                        .reportVersion(version)
                        .displayOrder(index)
                        .taskName(archetype.taskNames()[pick])
                        .priority(TaskPriority.values()[pick % TaskPriority.values().length])
                        .status(done ? TaskStatus.DONE : TaskStatus.IN_PROGRESS)
                        .plannedPercent(100)
                        .actualPercent(done ? 100 : 60 + (pick % 3) * 10)
                        .timePlannedHours(planned.setScale(2, RoundingMode.HALF_UP))
                        .timeSpentHours(spent.setScale(2, RoundingMode.HALF_UP))
                        .outputDeliverable(archetype.outputs()[pick % archetype.outputs().length])
                        .build());
            }
            version.replaceTaskEntries(tasks);

            int blockerCount = expanded ? 2 : (weekIndex % 2 == 0 ? 1 : 0);
            List<Blocker> blockers = new ArrayList<>();
            for (int index = 0; index < blockerCount; index++) {
                blockers.add(Blocker.builder()
                        .reportVersion(version)
                        .displayOrder(index)
                        .description(archetype.blockers()[(weekIndex + index) % archetype.blockers().length])
                        // At most one key issue, which is the rule the form enforces too.
                        .keyIssue(index == 0)
                        .build());
            }
            version.replaceBlockers(blockers);

            List<Achievement> achievements = new ArrayList<>();
            achievements.add(Achievement.builder()
                    .reportVersion(version)
                    .displayOrder(0)
                    .description(archetype.achievements()[weekIndex % archetype.achievements().length])
                    .keyAchievement(true)
                    .build());
            if (expanded) {
                achievements.add(Achievement.builder()
                        .reportVersion(version)
                        .displayOrder(1)
                        .description(archetype.achievements()[(weekIndex + 1) % archetype.achievements().length])
                        .keyAchievement(false)
                        .build());
            }
            version.replaceAchievements(achievements);

            version.replaceHoursEntries(hoursFor(version, archetype, totalSpent));

            version.setTasksPlannedNextWeek(archetype.plannedNextWeek());
            version.setNotes(weekIndex % 2 == 0 ? archetype.notes() : null);
            version.setLinks(weekIndex % 3 == 0 ? archetype.links() : null);
        }

        /**
         * Splits the week's actual task hours across task types by the owner's archetype, so
         * "hours by task type" and "hours spent per project" describe the same work instead of
         * being two unrelated made-up numbers. The remainder lands on Development, so the
         * split always adds back up to the total.
         */
        private List<HoursEntry> hoursFor(ReportVersion version, Archetype archetype,
                                          BigDecimal totalSpent) {
            Map<TaskType, BigDecimal> split = new EnumMap<>(TaskType.class);
            BigDecimal assigned = BigDecimal.ZERO;

            for (Map.Entry<TaskType, Double> share : archetype.shares().entrySet()) {
                if (share.getKey() == TaskType.DEVELOPMENT) continue;
                BigDecimal hours = totalSpent
                        .multiply(BigDecimal.valueOf(share.getValue()))
                        .setScale(2, RoundingMode.HALF_UP);
                if (hours.signum() > 0) {
                    split.put(share.getKey(), hours);
                    assigned = assigned.add(hours);
                }
            }

            BigDecimal development = totalSpent.subtract(assigned).setScale(2, RoundingMode.HALF_UP);
            if (development.signum() > 0) {
                split.put(TaskType.DEVELOPMENT, development);
            }

            List<HoursEntry> entries = new ArrayList<>();
            split.forEach((type, hours) -> entries.add(HoursEntry.builder()
                    .reportVersion(version)
                    .taskType(type)
                    .hours(hours)
                    .build()));
            return entries;
        }

        // ---- helpers ----

        private User user(String name, String email, Role role) {
            return userRepository.save(User.builder()
                    .name(name)
                    .email(email)
                    .passwordHash(passwordEncoder.encode(DEMO_PASSWORD))
                    .role(role)
                    .enabled(true)
                    .build());
        }

        private LocalDate week(int weeksAgo) {
            return thisWeek.minusWeeks(weeksAgo);
        }

        /** Friday afternoon of the week being reported on — when a weekly report gets filed. */
        private LocalDateTime submittedAt(LocalDate weekStart) {
            return weekStart.plusDays(4).atTime(16, 30);
        }

        private Project project(String name) {
            return projects.stream()
                    .filter(candidate -> candidate.getName().equalsIgnoreCase(name))
                    .findFirst()
                    // Falls back rather than failing: someone may have renamed V2's projects.
                    .orElse(projects.get(0));
        }
    }

    /**
     * What one person's week tends to look like. Giving each member their own pool of task
     * names, blockers and hours split is what makes the seeded reports read as six different
     * people rather than the same report six times — which matters, because the brief asks
     * the demo video to show two or three different members' reports.
     */
    private record Archetype(
            String[] taskNames,
            String[] outputs,
            String[] blockers,
            String[] achievements,
            String plannedNextWeek,
            String notes,
            String links,
            Map<TaskType, Double> shares
    ) {
        private static final Archetype FRONTEND = new Archetype(
                new String[]{
                        "Build the weekly report form", "Wire the dashboard filters",
                        "Add pagination to the report list", "Rework the mobile layout",
                        "Extract shared table components", "Fix focus handling in dialogs",
                },
                new String[]{"ReportFormPage.tsx", "ReportFilters.tsx", "Pagination.tsx", "Layout.tsx"},
                new String[]{
                        "Waiting on the review endpoint contract before the page can be finished",
                        "Design has no empty-state for the dashboard yet",
                        "Flaky local MySQL connection cost about half a day",
                },
                new String[]{
                        "Shipped the report form with version history",
                        "Cut the dashboard's first paint by roughly 40%",
                        "Dropped a chart dependency and hand-rolled the three we need",
                        "Mobile layout now works down to 390px",
                },
                "Finish the manager review screen and start on the dashboard charts.",
                "Pairing with Daniel on the review endpoint on Thursday.",
                "https://github.com/example/weekly-report/pull/128",
                Map.of(TaskType.TESTING, 0.15, TaskType.MEETINGS, 0.10, TaskType.DOCUMENTATION, 0.05)
        );

        private static final Archetype BACKEND = new Archetype(
                new String[]{
                        "Implement the review/approve endpoints", "Add the dashboard aggregate queries",
                        "Pessimistic locking on the edit path", "Write the user administration endpoints",
                        "Tighten the global exception handler", "Add the report version migration",
                },
                new String[]{"ReportReviewService.java", "DashboardService.java", "V3 migration", "UserController.java"},
                new String[]{
                        "Aggregates were double-counting corrected reports until the current-version rule landed",
                        "Flyway silently skipped migrations — needed an extra Spring Boot 4 module",
                        "Still deciding how to test against MySQL without Docker",
                },
                new String[]{
                        "Review workflow is complete end to end",
                        "Found and fixed a privilege escalation on the register endpoint",
                        "Dashboard queries now restrict to each report's current version",
                        "Every list endpoint is paginated and filterable",
                },
                "Port the shell RBAC checks into JUnit and finish the seed data loader.",
                "The current-version rule is documented in docs/PHASE2_SPEC.md.",
                "https://github.com/example/weekly-report/pull/131",
                Map.of(TaskType.TESTING, 0.20, TaskType.MEETINGS, 0.10, TaskType.DOCUMENTATION, 0.05)
        );

        private static final Archetype QA = new Archetype(
                new String[]{
                        "Regression pass on the correction cycle", "Automate the RBAC matrix checks",
                        "Cross-browser pass on the dashboard", "Write test data fixtures",
                        "Accessibility audit of the report form", "Load-test the report list endpoint",
                },
                new String[]{"rbac-suite.sh", "regression-checklist.md", "a11y-findings.md"},
                new String[]{
                        "The staging environment was down for two days",
                        "No seeded dataset yet, so every run starts by hand-creating reports",
                        "Can't reproduce the pagination bug on anything but Safari",
                },
                new String[]{
                        "88-check end-to-end suite passing against a real database",
                        "Proved version 1 stays intact after a full correction cycle",
                        "Caught the 500 on out-of-range request parameters",
                        "Dashboard verified at 390px with no console errors",
                },
                "Turn the shell suites into JUnit tests and re-run the RBAC matrix.",
                "Findings are in the shared test-notes doc.",
                "https://github.com/example/weekly-report/issues/44",
                Map.of(TaskType.TESTING, 0.55, TaskType.MEETINGS, 0.10, TaskType.DOCUMENTATION, 0.10)
        );

        private static final Archetype PLATFORM = new Archetype(
                new String[]{
                        "Write the setup instructions in the README", "Draft the ER diagram",
                        "Set up the deployment pipeline", "Document the review workflow",
                        "Add structured logging", "Prepare the demo environment",
                },
                new String[]{"README.md", "docs/diagrams/er-diagram.svg", "deploy.yml", "docs/ARCHITECTURE.md"},
                new String[]{
                        "Waiting on a decision about where to deploy",
                        "The ER diagram needs the versioning tables settled first",
                },
                new String[]{
                        "Setup instructions verified against a clean checkout",
                        "ER diagram covers users, projects, reports and review history",
                        "Runbook written for the demo environment",
                        "Architecture doc now records why each decision was made",
                },
                "Finish the deployment pipeline and record the demo walkthrough.",
                "Setup steps were re-checked on a clean machine this week.",
                "https://github.com/example/weekly-report/blob/main/README.md",
                Map.of(TaskType.TESTING, 0.10, TaskType.MEETINGS, 0.20, TaskType.DOCUMENTATION, 0.35)
        );

        static Archetype forEmail(String email) {
            return switch (email) {
                case "priya.nair@example.com" -> FRONTEND;
                case "daniel.osei@example.com" -> BACKEND;
                case "sofia.rossi@example.com" -> QA;
                default -> PLATFORM;
            };
        }
    }
}
