package com.technical.task.weeklyreportbackend.exception;

import org.springframework.http.HttpStatus;

/**
 * A manager changing their own role or disabling their own account.
 *
 * <p>Blocked because it is almost always a mistake with an expensive outcome: demoting
 * yourself removes the very access needed to undo it, and disabling yourself ends your
 * session immediately.
 */
public class SelfAdministrationException extends ApiException {

    public SelfAdministrationException() {
        super(HttpStatus.CONFLICT, "You cannot change your own role or disable your own account");
    }
}
