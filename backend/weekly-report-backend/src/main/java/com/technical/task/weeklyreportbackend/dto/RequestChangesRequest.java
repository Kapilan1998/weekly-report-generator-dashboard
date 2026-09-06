package com.technical.task.weeklyreportbackend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * A manager's one general comment explaining what needs correcting.
 *
 * <p>Single-component on purpose: the review endpoints accept a comment and nothing else,
 * so there is no field through which a manager could reach report content. Unknown JSON
 * properties are rejected globally, so smuggling extra keys fails loudly.
 */
public record RequestChangesRequest(
        @NotBlank(message = "A comment explaining the required changes is required")
        @Size(max = 2000, message = "Comment must be at most 2000 characters")
        String comment
) {
}
