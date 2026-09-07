package com.technical.task.weeklyreportbackend.exception;

import org.springframework.http.HttpStatus;

/**
 * A user who has filed reports cannot be deleted — their authorship is part of the audit
 * trail, and reports.user_id is a non-null foreign key with no cascade. Disabling the
 * account achieves the same outcome without rewriting history.
 */
public class UserInUseException extends ApiException {

    public UserInUseException(long reportCount) {
        super(
                HttpStatus.CONFLICT,
                "This user has " + reportCount + " report(s) and cannot be deleted. "
                        + "Disable the account instead to revoke access while keeping their history.");
    }
}
