package com.technical.task.weeklyreportbackend.exception;

import org.springframework.http.HttpStatus;

/**
 * The project tag is frozen once any version of the report has been submitted.
 *
 * <p>The tag lives on the report, not on the version, so allowing it to change afterwards
 * would retroactively alter the context of an already-reviewed version — a leak straight
 * through the requirement that a previous version's content stays visible as it was.
 */
public class ProjectChangeNotAllowedException extends ApiException {

    public ProjectChangeNotAllowedException() {
        super(HttpStatus.CONFLICT, "The project cannot be changed after the report has been submitted");
    }
}
