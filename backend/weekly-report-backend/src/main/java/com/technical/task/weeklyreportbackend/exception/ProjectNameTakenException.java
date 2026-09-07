package com.technical.task.weeklyreportbackend.exception;

import org.springframework.http.HttpStatus;

public class ProjectNameTakenException extends ApiException {

    public ProjectNameTakenException(String name) {
        super(HttpStatus.CONFLICT, "A project named '" + name + "' already exists");
    }
}
