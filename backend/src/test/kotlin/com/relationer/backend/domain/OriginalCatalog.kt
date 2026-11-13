package com.relationer.backend.domain

import com.relationer.backend.api.ReferenceCatalog

/** Keep the original eleven-case regression matrix independent of promotion. */
fun originalCatalog(): List<ReferencePattern> {
    val ids = ReferenceCatalogLoader().load("catalog/legacy-production.json").map { it.id }
    val current = ReferenceCatalog().entries.associateBy { it.id }
    return ids.map { current.getValue(it) }
}
