package com.technical.task.weeklyreportbackend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * One question for the assistant, plus as much of the conversation as the client wants it to
 * remember.
 *
 * <p>History is supplied by the caller rather than stored server-side. The brief does not ask
 * for persisted conversations, and keeping it in the widget's own state avoids a table, a
 * migration and a retention question about text that quotes report content.
 *
 * <p>Both lengths are capped. The message cap keeps a single request cheap; the history cap
 * bounds what one caller can push through the model in a turn, since every prior turn is
 * resent and therefore re-billed.
 */
public record AssistantChatRequest(
        @NotBlank(message = "A question is required")
        @Size(max = 1000, message = "A question must be at most 1000 characters")
        String message,

        @Valid
        @Size(max = 20, message = "At most 20 previous turns can be sent")
        List<AssistantTurn> history
) {
}
