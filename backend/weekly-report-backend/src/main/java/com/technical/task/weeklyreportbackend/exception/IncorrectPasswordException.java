package com.technical.task.weeklyreportbackend.exception;

import org.springframework.http.HttpStatus;

/**
 * The current password supplied with a password change did not match.
 *
 * <p>Deliberately 400 and not 401, even though it is a failed credential check. The caller is
 * already authenticated - their token is perfectly valid - and a 401 tells every client that
 * the <em>session</em> is finished. This project's API client acts on exactly that: a 401
 * runs the unauthorized handler and signs the user out. Returning one here would throw a user
 * back to the login screen for a typo in a form field.
 */
public class IncorrectPasswordException extends ApiException {

    public IncorrectPasswordException() {
        super(HttpStatus.BAD_REQUEST, "Your current password is incorrect");
    }
}
