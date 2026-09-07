package com.technical.task.weeklyreportbackend.exception;

import org.springframework.http.HttpStatus;

/**
 * A project that reports already reference cannot be deleted — doing so would strip the
 * project tag off historical reports, and a submitted version's context has to stay as it
 * was. Deactivating it instead keeps the history intact and removes it from the report
 * form's options.
 */
public class ProjectInUseException extends ApiException {

    public ProjectInUseException(long reportCount) {
        super(
                HttpStatus.CONFLICT,
                "This project is used by " + reportCount + " report(s) and cannot be deleted. "
                        + "Mark it inactive instead to stop new reports using it.");
    }
}
