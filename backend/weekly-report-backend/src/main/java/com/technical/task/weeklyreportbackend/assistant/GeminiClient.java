package com.technical.task.weeklyreportbackend.assistant;

import com.technical.task.weeklyreportbackend.exception.AssistantNotConfiguredException;
import com.technical.task.weeklyreportbackend.exception.AssistantUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The only class that knows Google's wire format. Everything above it works in terms of
 * {@link Reply} and {@link FunctionDeclaration}, so swapping provider means rewriting this
 * file and nothing else.
 *
 * <h2>Why raw maps rather than typed records for the conversation</h2>
 * A model turn must be echoed back to the provider <strong>byte for byte</strong>. On this
 * model each {@code functionCall} part arrives with a sibling {@code thoughtSignature}, and
 * replaying the turn without it is rejected outright:
 * <pre>
 * 400 INVALID_ARGUMENT - Function call is missing a thought_signature in functionCall parts
 * </pre>
 * Modelling parts as records would mean enumerating every field the provider might attach,
 * and silently dropping any field added later - reintroducing exactly that failure. Carrying
 * the parts as opaque maps makes replay correct by construction. It costs type safety in this
 * one class, which is the trade this class exists to contain.
 *
 * <h2>No SDK</h2>
 * Two REST calls against one endpoint do not justify a dependency, and the live-coding round
 * asks about code in this repository. Same reasoning as the hand-rolled charts.
 */
@Component
public class GeminiClient {

    private static final Logger log = LoggerFactory.getLogger(GeminiClient.class);

    private static final String BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

    /**
     * Retries exist because the free tier answers 503 "experiencing high demand" under load.
     * That is transient and unrelated to the request, so failing the user's question on the
     * first one would make a working feature look broken - especially in a demo. Three
     * attempts with a widening gap, and only for statuses where a retry can actually help.
     */
    private static final int MAX_ATTEMPTS = 3;
    private static final Duration RETRY_BACKOFF = Duration.ofSeconds(2);

    /** A tool offered to the model. {@code parameters} is a JSON Schema object. */
    public record FunctionDeclaration(String name, String description, Map<String, Object> parameters) {
    }

    /** One tool the model wants run. */
    public record ToolCall(String name, Map<String, Object> arguments) {
    }

    /**
     * @param text        the model's prose, when it answered rather than called a tool
     * @param toolCalls   the tools it wants run; non-empty means it has not answered yet
     * @param modelParts  the raw turn, to be replayed verbatim on the next request
     */
    public record Reply(String text, List<ToolCall> toolCalls, List<Map<String, Object>> modelParts) {

        public boolean wantsTools() {
            return !toolCalls.isEmpty();
        }
    }

    private final RestClient restClient;
    private final String apiKey;
    private final String model;

    /**
     * An explicit constructor rather than {@code @RequiredArgsConstructor}: it takes
     * {@code @Value} primitives and builds a configured client, which Lombok cannot express -
     * the same exception {@code JwtService} makes.
     */
    public GeminiClient(
            @Value("${app.gemini.api-key:}") String apiKey,
            @Value("${app.gemini.model:gemini-3.1-flash-lite}") String model
    ) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model;

        // Timeouts are not optional on an outbound call a user is waiting behind. A thinking
        // model can legitimately take tens of seconds, so the read timeout is generous while
        // the connect timeout stays short.
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(60));
        this.restClient = RestClient.builder()
                .baseUrl(BASE_URL)
                .requestFactory((ClientHttpRequestFactory) factory)
                .build();
    }

    public boolean isConfigured() {
        return !apiKey.isBlank();
    }

    public String model() {
        return model;
    }

    /**
     * One round trip. Returns either prose or the tools the model wants run - never both in a
     * way the caller has to reconcile, since {@link Reply#wantsTools()} decides which.
     *
     * @param systemPrompt  instructions and the read-only context the model always gets
     * @param contents      the conversation so far, in provider shape
     * @param tools         the tools on offer; empty for a plain completion
     */
    public Reply generate(String systemPrompt,
                          List<Map<String, Object>> contents,
                          List<FunctionDeclaration> tools) {
        if (!isConfigured()) {
            throw new AssistantNotConfiguredException();
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", systemPrompt))));
        body.put("contents", contents);
        if (!tools.isEmpty()) {
            List<Map<String, Object>> declarations = tools.stream()
                    .map(tool -> Map.of(
                            "name", tool.name(),
                            "description", tool.description(),
                            "parameters", (Object) tool.parameters()))
                    .toList();
            body.put("tools", List.of(Map.of("functionDeclarations", declarations)));
        }

        Map<String, Object> response = post(body);
        return toReply(response);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> post(Map<String, Object> body) {
        for (int attempt = 1; ; attempt++) {
            try {
                return restClient.post()
                        .uri("/models/{model}:generateContent", model)
                        // The key goes in a header, not a query parameter: the ?key= form is
                        // rejected for current key formats, and a URL is the thing most likely
                        // to end up in a log or a proxy trace.
                        .header("x-goog-api-key", apiKey)
                        .header("Content-Type", "application/json")
                        .body(body)
                        .retrieve()
                        .body(Map.class);

            } catch (HttpStatusCodeException ex) {
                // Logged in full for us, summarised for the caller: a provider error body can
                // carry quota details and request echoes, and our message reaches a user.
                log.warn("Gemini returned {} (attempt {}/{})",
                        ex.getStatusCode(), attempt, MAX_ATTEMPTS);

                if (!isRetryable(ex.getStatusCode())) {
                    throw new AssistantUnavailableException(explain(ex.getStatusCode()));
                }
                if (attempt >= MAX_ATTEMPTS) {
                    throw new AssistantUnavailableException(explain(ex.getStatusCode()));
                }

            } catch (ResourceAccessException ex) {
                // A timeout or a connection failure - worth one more try.
                log.warn("Gemini unreachable (attempt {}/{}): {}",
                        attempt, MAX_ATTEMPTS, ex.getMessage());
                if (attempt >= MAX_ATTEMPTS) {
                    throw new AssistantUnavailableException("The model did not respond in time.");
                }
            }

            pauseBeforeRetry(attempt);
        }
    }

    /** 4xx means the request itself is wrong; retrying it changes nothing. */
    private boolean isRetryable(HttpStatusCode status) {
        int code = status.value();
        return code == 408 || code == 429 || code >= 500;
    }

    /** Distinct messages, because the three causes need different action from the reader. */
    private String explain(HttpStatusCode status) {
        int code = status.value();
        if (code == 429) {
            return "The request limit has been reached. Wait a minute and try again.";
        }
        if (code == 401 || code == 403) {
            return "The configured API key was rejected. Check GEMINI_API_KEY.";
        }
        if (code >= 500) {
            return "The model is busy. Please try again in a moment.";
        }
        return "The request was rejected.";
    }

    private void pauseBeforeRetry(int attempt) {
        try {
            Thread.sleep(RETRY_BACKOFF.toMillis() * attempt);
        } catch (InterruptedException ex) {
            // Restore the flag and give up rather than swallowing the interrupt.
            Thread.currentThread().interrupt();
            throw new AssistantUnavailableException("The request was interrupted.");
        }
    }

    @SuppressWarnings("unchecked")
    private Reply toReply(Map<String, Object> response) {
        if (response == null) {
            throw new AssistantUnavailableException("The model returned no response.");
        }

        List<Map<String, Object>> candidates =
                (List<Map<String, Object>>) response.getOrDefault("candidates", List.of());
        if (candidates.isEmpty()) {
            // Usually a safety block: promptFeedback explains it, but the caller only needs
            // to know no answer came back.
            log.warn("Gemini returned no candidates: {}", response.get("promptFeedback"));
            throw new AssistantUnavailableException("The model declined to answer that.");
        }

        Map<String, Object> content =
                (Map<String, Object>) candidates.get(0).getOrDefault("content", Map.of());
        List<Map<String, Object>> parts =
                (List<Map<String, Object>>) content.getOrDefault("parts", List.of());

        StringBuilder text = new StringBuilder();
        List<ToolCall> toolCalls = new ArrayList<>();
        for (Map<String, Object> part : parts) {
            if (part.get("text") instanceof String value) {
                text.append(value);
            }
            if (part.get("functionCall") instanceof Map<?, ?> call) {
                Map<String, Object> typed = (Map<String, Object>) call;
                Object arguments = typed.get("args");
                toolCalls.add(new ToolCall(
                        String.valueOf(typed.get("name")),
                        arguments instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of()));
            }
        }

        return new Reply(text.toString().trim(), toolCalls, parts);
    }

    // ---- conversation building, kept here so the wire shape lives in one file ----

    public Map<String, Object> userText(String text) {
        return Map.of("role", "user", "parts", List.of(Map.of("text", text)));
    }

    public Map<String, Object> modelText(String text) {
        return Map.of("role", "model", "parts", List.of(Map.of("text", text)));
    }

    /** The model's own turn, replayed unchanged - see the note on thought signatures above. */
    public Map<String, Object> modelTurn(List<Map<String, Object>> parts) {
        return Map.of("role", "model", "parts", parts);
    }

    /**
     * Tool results. All of a turn's results go in one message: the provider pairs them with
     * the calls positionally, and splitting them across messages breaks that pairing.
     */
    public Map<String, Object> toolResults(List<Map<String, Object>> results) {
        return Map.of("role", "user", "parts", results);
    }

    public Map<String, Object> toolResult(String name, Map<String, Object> payload) {
        return Map.of("functionResponse", Map.of("name", name, "response", payload));
    }
}
