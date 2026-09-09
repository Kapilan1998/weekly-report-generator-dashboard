package com.technical.task.weeklyreportbackend.controller;

import com.technical.task.weeklyreportbackend.assistant.AssistantService;
import com.technical.task.weeklyreportbackend.dto.AssistantChatRequest;
import com.technical.task.weeklyreportbackend.dto.AssistantChatResponse;
import com.technical.task.weeklyreportbackend.dto.AssistantStatusResponse;
import com.technical.task.weeklyreportbackend.dto.AssistantSummaryResponse;
import com.technical.task.weeklyreportbackend.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * The AI chat assistant - the brief's optional Section 8 feature.
 *
 * <p><strong>Manager-only in full, at the class level.</strong> Every question it can answer
 * reaches across the whole team, which is exactly what a team member must not be able to
 * read. The gate lives here for the same reason it does on {@code DashboardController}: one
 * annotation covering the whole surface, rather than a decision repeated per method that
 * someone can forget on the next one.
 *
 * <p>The tools underneath additionally go through {@code ReportAccessGuard}, so even a
 * manager cannot use the assistant to read another member's unsubmitted draft. Role here,
 * ownership there - the same two layers as the rest of the application.
 */
@RestController
@RequestMapping("/api/assistant")
@PreAuthorize("hasRole('MANAGER')")
@RequiredArgsConstructor
public class AssistantController {

    private final AssistantService assistantService;

    /**
     * Whether the feature is usable at all. The frontend asks first, so an unconfigured
     * deployment renders a disabled control with an explanation instead of a chat box that
     * fails on every message.
     */
    @GetMapping("/status")
    public AssistantStatusResponse status() {
        return new AssistantStatusResponse(assistantService.isConfigured(), assistantService.model());
    }

    /** One question, with the conversation so far supplied by the client. */
    @PostMapping("/chat")
    public AssistantChatResponse chat(
            @Valid @RequestBody AssistantChatRequest request,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        return assistantService.chat(request, principal.getUser());
    }

    /** A written summary of one week: completed work, recurring blockers, workload balance. */
    @PostMapping("/summary")
    public AssistantSummaryResponse summary(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart,
            @AuthenticationPrincipal CustomUserDetails principal
    ) {
        return assistantService.summary(weekStart, principal.getUser());
    }
}
