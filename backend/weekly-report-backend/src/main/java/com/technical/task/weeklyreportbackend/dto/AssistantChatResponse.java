package com.technical.task.weeklyreportbackend.dto;

import java.util.List;

/**
 * The assistant's answer.
 *
 * <p>{@code toolsUsed} is returned deliberately: it is what makes an answer checkable. A
 * manager can see that "three reports need correction" came from the report list rather than
 * from the model's own recollection, and it is the first thing to look at when an answer
 * looks wrong.
 */
public record AssistantChatResponse(
        String reply,
        List<String> toolsUsed
) {
}
