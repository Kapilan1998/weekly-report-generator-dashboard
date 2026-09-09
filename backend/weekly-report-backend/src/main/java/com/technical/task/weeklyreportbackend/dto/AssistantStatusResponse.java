package com.technical.task.weeklyreportbackend.dto;

/**
 * Whether the assistant can be used at all.
 *
 * <p>The frontend asks this before rendering the chat widget, so an unconfigured deployment
 * shows a disabled control with an explanation instead of a button that always errors.
 */
public record AssistantStatusResponse(
        boolean configured,
        String model
) {
}
