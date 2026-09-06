package com.technical.task.weeklyreportbackend.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.validation.ObjectError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Turns exceptions into a single response shape.
 *
 * <p>The handlers below never pass {@code ex.getMessage()} through for framework or driver
 * exceptions. Those messages disclose internals and echo attacker input — MySQL's integrity
 * message, for instance, names the constraint, the table and the duplicate key <em>value</em>
 * (which can be another user's id). Application exceptions ({@link ApiException} subclasses)
 * do carry their message, because those strings are written by us for the user.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApiException(ApiException ex) {
        return ResponseEntity.status(ex.getStatus()).body(body(ex.getStatus(), ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(error.getField(), error.getDefaultMessage());
        }
        // Class-level constraint violations have no field, so without this they would vanish
        // and the response would say "Validation failed" with an empty error map.
        for (ObjectError error : ex.getBindingResult().getGlobalErrors()) {
            fieldErrors.put(error.getObjectName(), error.getDefaultMessage());
        }

        Map<String, Object> responseBody = body(HttpStatus.BAD_REQUEST, "Validation failed");
        responseBody.put("fieldErrors", fieldErrors);
        return ResponseEntity.badRequest().body(responseBody);
    }

    /** e.g. GET /api/reports/abc — names the parameter but never echoes its value. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return ResponseEntity.badRequest()
                .body(body(HttpStatus.BAD_REQUEST, "Invalid value for parameter '" + ex.getName() + "'"));
    }

    /**
     * Malformed JSON, or an unknown property in the body — unknown properties are rejected
     * deliberately, since the brief requires a fixed report structure users cannot extend.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadableBody(HttpMessageNotReadableException ex) {
        log.warn("Rejected unreadable request body", ex);
        return ResponseEntity.badRequest()
                .body(body(HttpStatus.BAD_REQUEST, "Malformed or unrecognised request body"));
    }

    /**
     * A constraint the application did not check first — most likely the one-report-per-week
     * unique key losing a race. Logged in full at ERROR, because this handler must not turn a
     * genuine mapping bug (a missing not-null child field, say) into a friendly 409 that hides
     * the cause.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrity(DataIntegrityViolationException ex) {
        log.error("Data integrity violation", ex);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(body(HttpStatus.CONFLICT, "The change conflicts with existing data"));
    }

    /**
     * A request to a path no controller maps. Handled explicitly because the catch-all below
     * would otherwise report a plain wrong URL as a 500.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNoResource(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(body(HttpStatus.NOT_FOUND, "No endpoint matches this request"));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> handleAuthenticationException(AuthenticationException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(body(HttpStatus.UNAUTHORIZED, "Authentication failed"));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body(HttpStatus.FORBIDDEN, "Access denied"));
    }

    /**
     * Without this, anything unhandled falls through to Spring Boot's error controller, whose
     * disclosure depends on {@code server.error.include-message} staying at its default.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(body(HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong"));
    }

    private Map<String, Object> body(HttpStatus status, String message) {
        Map<String, Object> responseBody = new LinkedHashMap<>();
        responseBody.put("timestamp", Instant.now().toString());
        responseBody.put("status", status.value());
        responseBody.put("error", status.getReasonPhrase());
        responseBody.put("message", message);
        return responseBody;
    }
}
