package com.technical.task.weeklyreportbackend.exception;

import org.springframework.http.HttpStatus;

/**
 * A sort property outside the endpoint's whitelist.
 *
 * <p>Not merely a typo guard: Spring Data resolves a dotted sort property into a join and
 * will happily order by any mapped attribute, so an unvalidated
 * {@code ?sort=user.passwordHash} would order rows by another user's password hash and leak
 * information through the ordering itself.
 */
public class InvalidSortPropertyException extends ApiException {

    public InvalidSortPropertyException(String property) {
        super(HttpStatus.BAD_REQUEST, "Cannot sort by '" + property + "'");
    }
}
