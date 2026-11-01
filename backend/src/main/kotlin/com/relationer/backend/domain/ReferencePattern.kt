package com.relationer.backend.domain

data class ReferencePattern(
    val id: String,
    val graph: PersonGraph,
    val verdict: Verdict,
    val source: ReferenceSource,
)

enum class Verdict {
    FORBIDDEN,
    UNDETERMINED,
    ALLOWED,
}

data class ReferenceSource(
    val page: Int?,
    val conclusion: String?,
)
