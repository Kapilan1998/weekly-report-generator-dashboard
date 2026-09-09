package com.technical.task.weeklyreportbackend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * One earlier turn of the conversation, replayed by the client.
 *
 * <p>{@code role} is whitelisted to the two values Gemini accepts. Without that, a caller
 * could set an arbitrary role and the provider would reject the whole request - or worse,
 * accept a role that lets the caller impersonate the system instruction.
 */
public record AssistantTurn(
        @NotBlank(message = "Role is required")
        @Pattern(regexp = "user|model", message = "Role must be 'user' or 'model'")
        String role,

        @NotBlank(message = "Text is required")
        @Size(max = 4000, message = "A turn must be at most 4000 characters")
        String text
) {
}
