package com.relationer.backend.api

import com.relationer.backend.api.generated.model.SearchRequest
import com.relationer.backend.api.generated.model.SearchResponse
import com.relationer.backend.domain.ReferenceSearch
import org.springframework.stereotype.Service

@Service
class ReferenceSearchService(private val mapper: SearchApiMapper, private val referenceCatalog: ReferenceCatalog) {
    // The singleton is eagerly created at startup; invalid catalog data prevents startup.
    private val catalog get() = referenceCatalog.entries
    private val search = ReferenceSearch()

    fun search(request: SearchRequest): SearchResponse =
        mapper.toResponse(search.search(mapper.toGraph(request), catalog))
}
