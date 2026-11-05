package com.relationer.backend.domain

data class ReferenceMatch(
    val referencePattern: ReferencePattern,
    val userPath: PersonPath,
    val userPathCode: String,
    val referencePath: PersonPath,
    val referencePathCode: String,
) {
    val verdict: Verdict get() = referencePattern.verdict
}
