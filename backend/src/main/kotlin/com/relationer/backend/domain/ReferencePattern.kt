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
)
