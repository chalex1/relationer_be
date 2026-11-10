package com.relationer.backend.api

import com.relationer.backend.api.generated.model.ErrorResponse
import jakarta.validation.ConstraintViolationException
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatusCode
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.context.request.WebRequest
import org.springframework.web.method.annotation.HandlerMethodValidationException
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler

@RestControllerAdvice(assignableTypes = [ReferenceSearchController::class])
class SearchApiExceptionHandler : ResponseEntityExceptionHandler() {
    @ExceptionHandler(IllegalArgumentException::class)
    fun invalidGraph(error: IllegalArgumentException): ResponseEntity<ErrorResponse> =
        ResponseEntity.badRequest().body(ErrorResponse(error.message ?: "Invalid graph"))

    @ExceptionHandler(ConstraintViolationException::class)
    fun invalidConstraints(): ResponseEntity<ErrorResponse> =
        ResponseEntity.badRequest().body(ErrorResponse("Request fields failed validation"))

    override fun handleErrorResponseException(
        ex: org.springframework.web.ErrorResponseException, headers: HttpHeaders, status: HttpStatusCode, request: WebRequest,
    ): ResponseEntity<Any> = ResponseEntity.status(status).body(ErrorResponse(ex.body.detail ?: "Request failed"))

    override fun handleHttpMessageNotReadable(
        ex: HttpMessageNotReadableException, headers: HttpHeaders, status: HttpStatusCode, request: WebRequest,
    ): ResponseEntity<Any> = ResponseEntity.badRequest().body(ErrorResponse("Invalid JSON or request fields"))

    override fun handleMethodArgumentNotValid(
        ex: MethodArgumentNotValidException, headers: HttpHeaders, status: HttpStatusCode, request: WebRequest,
    ): ResponseEntity<Any> = ResponseEntity.badRequest().body(ErrorResponse("Request fields failed validation"))

    override fun handleHandlerMethodValidationException(
        ex: HandlerMethodValidationException, headers: HttpHeaders, status: HttpStatusCode, request: WebRequest,
    ): ResponseEntity<Any> = ResponseEntity.badRequest().body(ErrorResponse("Request fields failed validation"))
}
