package com.technical.task.weeklyreportbackend.exception;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.validation.ObjectError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

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

    /** e.g. GET /api/dashboard/summary with no weekStart. A missing input is the caller's error. */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Map<String, Object>> handleMissingParameter(
            MissingServletRequestParameterException ex) {
        return ResponseEntity.badRequest()
                .body(body(HttpStatus.BAD_REQUEST, "Required parameter '" + ex.getParameterName() + "' is missing"));
    }

    /**
     * Bounds on individual request parameters (e.g. {@code @Min}/{@code @Max} on a
     * {@code @RequestParam}) are enforced by method validation, which throws this rather than
     * MethodArgumentNotValidException — that one only covers {@code @RequestBody} objects.
     * Without this handler an out-of-range page size or week count would surface as a 500.
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> handleConstraintViolation(ConstraintViolationException ex) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (ConstraintViolation<?> violation : ex.getConstraintViolations()) {
            // The path's last node is the parameter name; the full path includes the method.
            String path = violation.getPropertyPath().toString();
            String parameter = path.contains(".") ? path.substring(path.lastIndexOf('.') + 1) : path;
            fieldErrors.put(parameter, violation.getMessage());
        }

        Map<String, Object> responseBody = body(HttpStatus.BAD_REQUEST, "Invalid request parameter");
        responseBody.put("fieldErrors", fieldErrors);
        return ResponseEntity.badRequest().body(responseBody);
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
     * The right path with the wrong HTTP method — e.g. DELETE on an endpoint that only serves
     * GET and PUT.
     *
     * <p>Handled explicitly for the same reason as {@link NoResourceFoundException} below it,
     * and this one was learned the hard way: without it the catch-all turned a wrong method
     * into {@code 500 "Something went wrong"}, and a frontend calling a DELETE endpoint that
     * had not been deployed yet looked like a broken server rather than a stale one. A wrong
     * method is the caller's error, so it gets a 4xx and says which methods are allowed.
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> handleMethodNotSupported(
            HttpRequestMethodNotSupportedException ex) {
        String allowed = ex.getSupportedHttpMethods() == null
                ? ""
                : ex.getSupportedHttpMethods().stream().map(String::valueOf).collect(Collectors.joining(", "));
        String message = allowed.isBlank()
                ? "This endpoint does not support " + ex.getMethod()
                : "This endpoint does not support " + ex.getMethod() + " — try " + allowed;

        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(body(HttpStatus.METHOD_NOT_ALLOWED, message));
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
