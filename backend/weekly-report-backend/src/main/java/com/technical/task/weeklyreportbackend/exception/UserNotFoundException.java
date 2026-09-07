package com.technical.task.weeklyreportbackend.exception;

import org.springframework.http.HttpStatus;

public class UserNotFoundException extends ApiException {

    public UserNotFoundException() {
        super(HttpStatus.NOT_FOUND, "User not found");
    }
}
