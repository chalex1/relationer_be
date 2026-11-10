package com.relationer.backend.domain

/**
 * Один справочный случай родственных отношений.
 *
 * Содержит граф родства, вердикт и источник,
 * на основании которых выполняется сопоставление.
 */
data class ReferencePattern(
    val id: String,
    val graph: PersonGraph,
    val verdict: Verdict,
    val source: ReferenceSource,
    val description: String? = null,
    val categories: Set<RelationCategory> = emptySet(),
    val tags: Set<String> = emptySet(),
)

/**
 * Вердикт, указанный в справочном случае.
 *
 * ALLOWED — разрешено.
 * FORBIDDEN — запрещено.
 * UNDETERMINED — решение не определено.
 *
 * Не вычисляется алгоритмом поиска.
 */
enum class Verdict {
    FORBIDDEN,
    UNDETERMINED,
    ALLOWED,
}

/**
 * Источник справочного случая.
 *
 * Содержит сведения о документе или примере,
 * из которого получены схема родства и вердикт.
 */
data class ReferenceSource(
    val page: Int?,
    val conclusion: String?,
    val document: String? = null,
    val example: String? = null,
    val image: String? = null,
)

/** Independent relationship facets; an empty set means not yet classified. */
enum class RelationCategory { BLOOD, AFFINITY, SPIRITUAL, ADOPTION }
