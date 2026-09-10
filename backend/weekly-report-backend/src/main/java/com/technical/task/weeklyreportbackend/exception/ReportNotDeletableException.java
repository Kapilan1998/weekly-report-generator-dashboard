package com.technical.task.weeklyreportbackend.exception;

import org.springframework.http.HttpStatus;

/**
 * A report that has been submitted at least once cannot be deleted.
 *
 * <p>Only a draft may go, and the reason is the audit trail this whole application is built
 * around. The moment a report is submitted it stops being private working notes: a manager
 * may have read it, approved it or sent it back with a comment, and every frozen version and
 * review comment hangs off it. Deleting that would let an author erase a decision that was
 * made about their work.
 *
 * <p>It is the same rule {@code UserAdminService} applies to accounts — a user who has filed
 * reports can only be disabled, never deleted, because their authorship is part of the
 * record. Allowing report deletion after submission would contradict it.
 *
 * <p>409 rather than 403: the caller is allowed to delete their own drafts, so this is a
 * conflict with the report's state, not a permission problem.
 */
public class ReportNotDeletableException extends ApiException {

    public ReportNotDeletableException() {
        super(HttpStatus.CONFLICT,
                "Only a draft can be deleted. A report that has been submitted is part of the "
                        + "review record and stays.");
    }
}
