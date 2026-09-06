package com.technical.task.weeklyreportbackend.exception;

import org.springframework.http.HttpStatus;

public class ProjectNotFoundException extends ApiException {

    public ProjectNotFoundException() {
        super(HttpStatus.NOT_FOUND, "Project not found or no longer active");
    }
}
