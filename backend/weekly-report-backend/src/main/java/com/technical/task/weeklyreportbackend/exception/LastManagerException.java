package com.technical.task.weeklyreportbackend.exception;

import org.springframework.http.HttpStatus;

/**
 * Refuses the change that would leave the system with no enabled manager at all — after
 * which nobody could review a report, manage projects, or restore anyone's access, since
 * every one of those actions is manager-only.
 */
public class LastManagerException extends ApiException {

    public LastManagerException() {
        super(HttpStatus.CONFLICT, "This would leave no active manager. Promote someone else first.");
    }
}
