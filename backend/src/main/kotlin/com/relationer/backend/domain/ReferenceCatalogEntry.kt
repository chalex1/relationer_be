package com.relationer.backend.domain

/** Catalog metadata is independent of the graph matching model. */
data class ReferenceCatalogEntry(
    val pattern: ReferencePattern,
    val title: String,
    val reviewStatus: GraphReviewStatus,
    val sources: List<CatalogSource>,
)

enum class GraphReviewStatus { DRAFT, REVIEWED, NEEDS_CORRECTION }

data class CatalogSource(
    val id: String,
    val title: String,
    val verdict: Verdict,
    val reference: ReferenceSource,
    // Explicit manual confirmation of the conclusion, independent of graph review and historical verdict.
    val conclusionConfirmed: Boolean = false,
)
