package com.technical.task.weeklyreportbackend.security;

import com.technical.task.weeklyreportbackend.domain.Project;
import com.technical.task.weeklyreportbackend.domain.Role;
import com.technical.task.weeklyreportbackend.domain.User;
import com.technical.task.weeklyreportbackend.repository.ProjectRepository;
import com.technical.task.weeklyreportbackend.repository.ReportRepository;
import com.technical.task.weeklyreportbackend.repository.ReportVersionRepository;
import com.technical.task.weeklyreportbackend.repository.ReviewCommentRepository;
import com.technical.task.weeklyreportbackend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The assignment's RBAC requirement, as executable assertions: "a team member must never be
 * able to access another team member's report data or a manager-only endpoint."
 *
 * <p>These run through the real filter chain with real JWTs obtained from
 * {@code /api/auth/login}, rather than with {@code @WithMockUser}. That matters here: this
 * application's {@code JwtAuthFilter} builds its own {@code Authentication} — including the
 * {@code enabled} check — so a mocked principal would skip the exact code the tests are
 * about.
 *
 * <p>Several assertions pin behaviour that is easy to "fix" into a vulnerability:
 * <ul>
 *   <li>A peer's report is <strong>404, not 403</strong>, so report ids cannot be enumerated
 *       — and that holds for an <em>approved</em> peer report too, which is what pins the
 *       ordering of the ownership check before the status check.</li>
 *   <li>Registration cannot mint a manager. This was a real vulnerability in Phase 1.</li>
 *   <li>{@code ?sort=} is whitelisted, because Spring Data will happily order rows by
 *       {@code user.passwordHash} and leak information through the ordering itself.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RoleBasedAccessControlTest {

    private static final String PASSWORD = "Str0ng!Pass";
    private static final Pattern TOKEN = Pattern.compile("\"token\"\\s*:\\s*\"([^\"]+)\"");

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private ProjectRepository projectRepository;
    @Autowired
    private ReportRepository reportRepository;
    @Autowired
    private ReportVersionRepository versionRepository;
    @Autowired
    private ReviewCommentRepository reviewCommentRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private User alice;
    private User bob;
    private User manager;
    private Long projectId;

    private String aliceToken;
    private String bobToken;
    private String managerToken;

    @BeforeEach
    void setUp() throws Exception {
        // Deleted in FK order. Versions cascade to tasks, blockers, achievements and hours.
        reviewCommentRepository.deleteAll();
        versionRepository.deleteAll();
        reportRepository.deleteAll();
        userRepository.deleteAll();

        alice = createUser("Alice Member", "alice@test.local", Role.TEAM_MEMBER, true);
        bob = createUser("Bob Member", "bob@test.local", Role.TEAM_MEMBER, true);
        manager = createUser("Mia Manager", "mia@test.local", Role.MANAGER, true);

        // V2 seeds five projects, and Flyway runs in this context, so one is always available.
        projectId = projectRepository.findByActiveTrueOrderByNameAsc().stream()
                .findFirst()
                .map(Project::getId)
                .orElseThrow(() -> new IllegalStateException("no project seeded by V2"));

        aliceToken = login("alice@test.local");
        bobToken = login("bob@test.local");
        managerToken = login("mia@test.local");
    }

    // ---- the two requirements the brief states outright ----

    @Test
    @DisplayName("a team member cannot read another team member's report — and gets 404, not 403")
    void peerReportIsNotReadable() throws Exception {
        long aliceReport = createDraft(aliceToken, currentMonday());

        mockMvc.perform(get("/api/reports/{id}", aliceReport).header("Authorization", bearer(bobToken)))
                .andExpect(status().isNotFound());

        // Same answer for an id that doesn't exist, which is the point: the two are
        // indistinguishable, so ids cannot be probed.
        mockMvc.perform(get("/api/reports/{id}", 987654321L).header("Authorization", bearer(bobToken)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("a peer's approved report is still 404 — ownership is checked before status")
    void approvedPeerReportIsAlsoNotReadable() throws Exception {
        long aliceReport = createDraft(aliceToken, currentMonday());
        submit(aliceToken, aliceReport);
        approve(managerToken, aliceReport);

        // If the status check ran first this would answer "409 already approved" for a real
        // id and 404 for a fake one, which discloses both existence and state.
        mockMvc.perform(get("/api/reports/{id}", aliceReport).header("Authorization", bearer(bobToken)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("a team member cannot reach any manager-only read endpoint")
    void managerOnlyReadsAreForbidden() throws Exception {
        String[] paths = {
                "/api/reports",
                "/api/reports/week-status?weekStart=" + currentMonday(),
                "/api/users",
                "/api/projects/all",
                "/api/dashboard/summary?weekStart=" + currentMonday(),
                "/api/dashboard/charts?weekStart=" + currentMonday(),
                "/api/dashboard/activity",
                // The AI assistant reaches across the whole team, so it is gated identically.
                "/api/assistant/status",
        };

        for (String path : paths) {
            mockMvc.perform(get(path).header("Authorization", bearer(aliceToken)))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    @DisplayName("a team member cannot reach any manager-only write endpoint, with a valid body")
    void managerOnlyWritesAreForbidden() throws Exception {
        long aliceReport = createDraft(aliceToken, currentMonday());
        submit(aliceToken, aliceReport);

        // Bodies are valid on purpose. An invalid one would be rejected at argument binding,
        // which happens before method security and would pass this test for the wrong reason.
        mockMvc.perform(post("/api/projects")
                        .header("Authorization", bearer(aliceToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Should Not Exist\",\"description\":null}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/users")
                        .header("Authorization", bearer(aliceToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Should Not Exist","email":"nope@test.local",
                                 "password":"Str0ng!Pass","role":"MANAGER"}"""))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/projects/{id}", projectId).header("Authorization", bearer(aliceToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/reports/{id}/approve", aliceReport)
                        .header("Authorization", bearer(aliceToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"comment\":null}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/reports/{id}/request-changes", aliceReport)
                        .header("Authorization", bearer(aliceToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"comment\":\"let me review my own report\"}"))
                .andExpect(status().isForbidden());

        // The assistant is manager-only for the same reason the dashboard is: it answers
        // questions about everyone's reports. Bodies are valid so method security is what
        // rejects these, not bean validation.
        mockMvc.perform(post("/api/assistant/chat")
                        .header("Authorization", bearer(aliceToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"What is the team working on?\",\"history\":[]}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/assistant/summary")
                        .header("Authorization", bearer(aliceToken))
                        .param("weekStart", currentMonday().toString()))
                .andExpect(status().isForbidden());

        // Nothing was created by any of the above.
        assertThat(projectRepository.findAllByOrderByNameAsc())
                .extracting(Project::getName)
                .doesNotContain("Should Not Exist");
        assertThat(userRepository.findByEmail("nope@test.local")).isEmpty();
    }

    /**
     * The delete lifecycle end to end, through the real filter chain. Added after a stale
     * backend made a missing DELETE mapping look like a 500: every unit test passed, because
     * none of them goes through the dispatcher.
     */
    @Test
    @DisplayName("a member can delete their own draft, and nothing else")
    void draftDeleteLifecycle() throws Exception {
        long draft = createDraft(aliceToken, currentMonday());

        // A peer cannot delete it - and gets 404, the same answer a missing id gives, so ids
        // cannot be probed through this endpoint either.
        mockMvc.perform(delete("/api/reports/{id}", draft).header("Authorization", bearer(bobToken)))
                .andExpect(status().isNotFound());
        assertThat(reportRepository.findById(draft)).isPresent();

        // Nor can a manager: this endpoint is about your own drafts, and a manager reviewing
        // the team is not an owner.
        mockMvc.perform(delete("/api/reports/{id}", draft).header("Authorization", bearer(managerToken)))
                .andExpect(status().isNotFound());
        assertThat(reportRepository.findById(draft)).isPresent();

        // The owner can.
        mockMvc.perform(delete("/api/reports/{id}", draft).header("Authorization", bearer(aliceToken)))
                .andExpect(status().isNoContent());
        assertThat(reportRepository.findById(draft)).isEmpty();

        // Gone means gone: a second delete is a 404, not a silent success.
        mockMvc.perform(delete("/api/reports/{id}", draft).header("Authorization", bearer(aliceToken)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("a submitted or approved report cannot be deleted, and survives the attempt")
    void submittedReportCannotBeDeleted() throws Exception {
        long report = createDraft(aliceToken, currentMonday());
        submit(aliceToken, report);

        mockMvc.perform(delete("/api/reports/{id}", report).header("Authorization", bearer(aliceToken)))
                .andExpect(status().isConflict());
        assertThat(reportRepository.findById(report)).isPresent();

        // And once approved it is still refused - the report surviving is the part that
        // matters for the audit trail.
        approve(managerToken, report);
        mockMvc.perform(delete("/api/reports/{id}", report).header("Authorization", bearer(aliceToken)))
                .andExpect(status().isConflict());
        assertThat(reportRepository.findById(report)).isPresent();
    }

    /**
     * The point of the token version: a manager's change to somebody's access takes effect on
     * that person's very next request, rather than whenever their token happens to expire.
     */
    @Test
    @DisplayName("changing a role invalidates that user's existing token")
    void roleChangeEndsTheSession() throws Exception {
        // Alice's token works before the change.
        mockMvc.perform(get("/api/reports/mine").header("Authorization", bearer(aliceToken)))
                .andExpect(status().isOk());

        promote(alice.getId(), Role.MANAGER, true);

        // Same token, now rejected - and the body says why, so the UI can explain the
        // sign-out rather than dumping the user at a login screen for no visible reason.
        mockMvc.perform(get("/api/reports/mine").header("Authorization", bearer(aliceToken)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value(
                        org.hamcrest.Matchers.containsString("access was changed")));

        // Signing in again works and hands back the new role.
        String fresh = login("alice@test.local");
        mockMvc.perform(get("/api/reports/mine").header("Authorization", bearer(fresh)))
                .andExpect(status().isOk());
        // Manager now, so a manager-only endpoint answers.
        mockMvc.perform(get("/api/users").header("Authorization", bearer(fresh)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("disabling an account invalidates its token immediately")
    void disableEndsTheSession() throws Exception {
        mockMvc.perform(get("/api/reports/mine").header("Authorization", bearer(bobToken)))
                .andExpect(status().isOk());

        promote(bob.getId(), Role.TEAM_MEMBER, false);

        mockMvc.perform(get("/api/reports/mine").header("Authorization", bearer(bobToken)))
                .andExpect(status().isUnauthorized());

        // And they cannot sign back in while disabled - same generic message as a wrong
        // password, so the response does not confirm the address exists.
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"bob@test.local\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("a change that alters nothing leaves the session alone")
    void noOpUpdateKeepsTheSession() throws Exception {
        // Re-saving the role a member already has must not log them out, or a manager
        // glancing at the user list would end sessions by accident.
        promote(alice.getId(), Role.TEAM_MEMBER, true);

        mockMvc.perform(get("/api/reports/mine").header("Authorization", bearer(aliceToken)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("changing your password signs out your other devices, not the one you used")
    void passwordChangeEndsOtherSessions() throws Exception {
        // Two sessions for the same account, as if signed in on two devices.
        String otherDevice = login("alice@test.local");

        MvcResult result = mockMvc.perform(put("/api/profile/password")
                        .header("Authorization", bearer(aliceToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"" + PASSWORD
                                + "\",\"newPassword\":\"Str0ng!New\"}"))
                .andExpect(status().isOk())
                .andReturn();

        // The other device is out.
        mockMvc.perform(get("/api/reports/mine").header("Authorization", bearer(otherDevice)))
                .andExpect(status().isUnauthorized());

        // So is the token that made the request - but the response handed back a new one,
        // which is what keeps the person who changed their password signed in.
        mockMvc.perform(get("/api/reports/mine").header("Authorization", bearer(aliceToken)))
                .andExpect(status().isUnauthorized());

        Matcher matcher = TOKEN.matcher(result.getResponse().getContentAsString());
        assertThat(matcher.find()).isTrue();
        mockMvc.perform(get("/api/reports/mine").header("Authorization", bearer(matcher.group(1))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("the wrong HTTP method is 405, not 500")
    void wrongMethodIsMethodNotAllowed() throws Exception {
        /*
         * The regression that hid a real problem. A frontend calling DELETE against a backend
         * that had not been restarted got "500 Something went wrong", which reads as a server
         * fault rather than a missing deployment. A wrong method is the caller's error.
         *
         * /api/profile/password is used rather than something under /api/reports because that
         * controller maps DELETE /{id}: `DELETE /api/reports/mine` binds "mine" to a Long,
         * fails conversion and comes back 400, so it never reaches the method check at all.
         * ProfileController has no path variable, so there is nothing for DELETE to match.
         */
        mockMvc.perform(delete("/api/profile/password").header("Authorization", bearer(aliceToken)))
                .andExpect(status().isMethodNotAllowed());

        // And the 400 above is worth pinning too, so the two are not confused later.
        mockMvc.perform(delete("/api/reports/mine").header("Authorization", bearer(aliceToken)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("an unauthenticated request is 401, not a bare 403")
    void unauthenticatedRequestIsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/reports/mine")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/reports")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/reports/mine").header("Authorization", "Bearer not-a-token"))
                .andExpect(status().isUnauthorized());
        // Editing your own account still requires being signed in as someone.
        mockMvc.perform(put("/api/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Nobody\",\"email\":\"nobody@test.local\"}"))
                .andExpect(status().isUnauthorized());
    }

    /**
     * The profile endpoints are the one place a team member may write to a {@code users} row,
     * so both halves of that need pinning: the endpoint must be reachable by a member, and it
     * must not be a second way to do what {@code /api/users} exists to control.
     */
    @Test
    @DisplayName("a team member can edit their own profile but cannot promote themselves through it")
    void profileEditingIsSelfServiceButNotAWayToChangeRole() throws Exception {
        // Reachable by a team member - the endpoints deliberately carry no role gate.
        mockMvc.perform(put("/api/profile")
                        .header("Authorization", bearer(aliceToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Alice Renamed\",\"email\":\"alice@test.local\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Alice Renamed"))
                // Still a team member, and a newly signed token comes back because the JWT's
                // subject is the email address.
                .andExpect(jsonPath("$.role").value("TEAM_MEMBER"))
                .andExpect(jsonPath("$.token").isString());

        // A role field in the body is refused outright rather than ignored:
        // fail-on-unknown-properties turns it into a 400. Ignoring it would be safe today and
        // one careless DTO change away from a privilege escalation.
        mockMvc.perform(put("/api/profile")
                        .header("Authorization", bearer(aliceToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Alice Escalator","email":"alice@test.local",
                                 "role":"MANAGER"}"""))
                .andExpect(status().isBadRequest());

        // Neither request changed the role on the row.
        User reloaded = userRepository.findByEmail("alice@test.local").orElseThrow();
        assertThat(reloaded.getRole()).isEqualTo(Role.TEAM_MEMBER);
        assertThat(reloaded.getName()).isEqualTo("Alice Renamed");

        // And a member still cannot take another account's address.
        mockMvc.perform(put("/api/profile")
                        .header("Authorization", bearer(aliceToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Alice Member\",\"email\":\"bob@test.local\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("a wrong current password is 400, so a typo does not end the session")
    void wrongCurrentPasswordIsBadRequestNotUnauthorized() throws Exception {
        mockMvc.perform(put("/api/profile/password")
                        .header("Authorization", bearer(aliceToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"not-my-password\",\"newPassword\":\"Str0ng!New\"}"))
                .andExpect(status().isBadRequest());

        // The token is untouched by the failure, which is the behaviour the status protects:
        // the frontend signs the user out on any 401.
        mockMvc.perform(get("/api/reports/mine").header("Authorization", bearer(aliceToken)))
                .andExpect(status().isOk());

        // With the right one it goes through, and the old password stops working.
        mockMvc.perform(put("/api/profile/password")
                        .header("Authorization", bearer(aliceToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"Str0ng!New\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"alice@test.local\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"alice@test.local\",\"password\":\"Str0ng!New\"}"))
                .andExpect(status().isOk());
    }

    // ---- regressions worth keeping nailed down ----

    @Test
    @DisplayName("registration cannot mint a manager")
    void registrationCannotChooseARole() throws Exception {
        // RegisterRequest has no role field and unknown properties are rejected globally, so
        // this is a 400. Phase 1 accepted it and created a MANAGER against a permitAll
        // endpoint, which walked straight through every hasRole('MANAGER') gate.
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Evil Escalator","email":"evil@test.local",
                                 "password":"Str0ng!Pass","role":"MANAGER"}"""))
                .andExpect(status().isBadRequest());
        assertThat(userRepository.findByEmail("evil@test.local")).isEmpty();

        // And the accepted form always yields a team member.
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Plain Member","email":"plain@test.local",
                                 "password":"Str0ng!Pass"}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("TEAM_MEMBER"));

        assertThat(userRepository.findByEmail("plain@test.local"))
                .get()
                .extracting(User::getRole)
                .isEqualTo(Role.TEAM_MEMBER);
    }

    @Test
    @DisplayName("a manager may read a peer's submitted report but not their draft")
    void managerSeesSubmittedContentButNotADraft() throws Exception {
        long draft = createDraft(aliceToken, currentMonday());

        mockMvc.perform(get("/api/reports/{id}", draft).header("Authorization", bearer(managerToken)))
                .andExpect(status().isForbidden());

        submit(aliceToken, draft);

        mockMvc.perform(get("/api/reports/{id}", draft).header("Authorization", bearer(managerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.owner.id").value(alice.getId()))
                .andExpect(jsonPath("$.reviewable").value(true));
    }

    @Test
    @DisplayName("a manager cannot review their own report")
    void managerCannotSelfReview() throws Exception {
        long own = createDraft(managerToken, currentMonday());
        submit(managerToken, own);

        mockMvc.perform(post("/api/reports/{id}/approve", own)
                        .header("Authorization", bearer(managerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"comment\":null}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("the sort parameter is whitelisted, not passed through to the query")
    void sortPropertyIsWhitelisted() throws Exception {
        // Spring Data resolves a dotted sort property into a join and would order rows by
        // another user's password hash, leaking information through the ordering itself.
        mockMvc.perform(get("/api/reports?sort=user.passwordHash,asc")
                        .header("Authorization", bearer(managerToken)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/reports/mine?sort=user.passwordHash,asc")
                        .header("Authorization", bearer(aliceToken)))
                .andExpect(status().isBadRequest());

        // A whitelisted property still works, so the guard isn't just rejecting everything.
        mockMvc.perform(get("/api/reports?sort=weekStart,desc")
                        .header("Authorization", bearer(managerToken)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("disabling an account revokes an already-issued token immediately")
    void disablingRevokesAnExistingToken() throws Exception {
        mockMvc.perform(get("/api/reports/mine").header("Authorization", bearer(aliceToken)))
                .andExpect(status().isOk());

        alice.setEnabled(false);
        userRepository.save(alice);

        // Not at token expiry: JwtAuthFilter checks the flag on every request.
        mockMvc.perform(get("/api/reports/mine").header("Authorization", bearer(aliceToken)))
                .andExpect(status().isUnauthorized());

        // And the same generic message as a wrong password, so a disabled address isn't
        // confirmed as existing.
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"alice@test.local\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    @DisplayName("a team member cannot edit a peer's report even while it is editable")
    void peerReportIsNotWritable() throws Exception {
        long aliceReport = createDraft(aliceToken, currentMonday());

        mockMvc.perform(post("/api/reports/{id}/submit", aliceReport)
                        .header("Authorization", bearer(bobToken)))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/reports/{id}/versions", aliceReport)
                        .header("Authorization", bearer(bobToken)))
                .andExpect(status().isNotFound());

        // Alice's report is untouched: still exactly one report, still hers.
        assertThat(reportRepository.count()).isEqualTo(1);
        assertThat(reportRepository.findById(aliceReport))
                .get()
                .extracting(report -> report.getUser().getId())
                .isEqualTo(alice.getId());
    }

    @Test
    @DisplayName("/api/reports/mine has no userId parameter to bind, so it cannot be pointed elsewhere")
    void mineCannotBeRedirectedToAnotherUser() throws Exception {
        createDraft(aliceToken, currentMonday());

        // A shared filter object would bind this and rely on the service ignoring it. The
        // endpoint simply doesn't declare it, so Bob's own (empty) history comes back.
        mockMvc.perform(get("/api/reports/mine?userId={id}", alice.getId())
                        .header("Authorization", bearer(bobToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    // ---- helpers ----

    private User createUser(String name, String email, Role role, boolean enabled) {
        return userRepository.save(User.builder()
                .name(name)
                .email(email)
                .passwordHash(passwordEncoder.encode(PASSWORD))
                .role(role)
                .enabled(enabled)
                .build());
    }

    /**
     * A real token from the real endpoint. Extracted with a regex rather than a JSON parser
     * on purpose — this project runs Jackson 3 ({@code tools.jackson.databind}) and a test
     * helper is not worth coupling to either Jackson's API.
     */
    private String login(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();

        Matcher matcher = TOKEN.matcher(result.getResponse().getContentAsString());
        if (!matcher.find()) {
            throw new IllegalStateException("login response carried no token: "
                    + result.getResponse().getContentAsString());
        }
        return matcher.group(1);
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private LocalDate currentMonday() {
        return LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    /** A draft complete enough to be submitted, so the workflow steps below can run. */
    private long createDraft(String token, LocalDate weekStart) throws Exception {
        String body = """
                {
                  "weekStart": "%s",
                  "projectId": %d,
                  "tasksPlannedNextWeek": "Continue the migration",
                  "notes": null,
                  "links": null,
                  "tasks": [
                    {
                      "taskName": "Write the RBAC tests",
                      "priority": "HIGH",
                      "status": "DONE",
                      "plannedPercent": 100,
                      "actualPercent": 100,
                      "timePlannedHours": 6.00,
                      "timeSpentHours": 6.50,
                      "outputDeliverable": "RoleBasedAccessControlTest.java"
                    }
                  ],
                  "blockers": [],
                  "achievements": [],
                  "hours": [{ "taskType": "DEVELOPMENT", "hours": 6.50 }]
                }""".formatted(weekStart, projectId);

        MvcResult result = mockMvc.perform(post("/api/reports")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();

        Matcher matcher = Pattern.compile("\"id\"\\s*:\\s*(\\d+)")
                .matcher(result.getResponse().getContentAsString());
        if (!matcher.find()) {
            throw new IllegalStateException("create response carried no id");
        }
        return Long.parseLong(matcher.group(1));
    }

    /** A manager setting somebody's role and enabled flag, through the real endpoint. */
    private void promote(long userId, Role role, boolean enabled) throws Exception {
        mockMvc.perform(put("/api/users/{id}", userId)
                        .header("Authorization", bearer(managerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"" + role.name() + "\",\"enabled\":" + enabled + "}"))
                .andExpect(status().isOk());
    }

    private void submit(String token, long reportId) throws Exception {
        mockMvc.perform(post("/api/reports/{id}/submit", reportId).header("Authorization", bearer(token)))
                .andExpect(status().isOk());
    }

    private void approve(String token, long reportId) throws Exception {
        mockMvc.perform(post("/api/reports/{id}/approve", reportId)
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"comment\":null}"))
                .andExpect(status().isOk());
    }
}
