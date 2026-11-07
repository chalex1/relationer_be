package com.relationer.backend.api

import com.relationer.backend.api.generated.model.SearchRequest
import com.relationer.backend.api.generated.model.SearchResponse
import com.relationer.backend.domain.ReferenceCatalogLoader
import com.relationer.backend.domain.ReferenceSearch
import org.springframework.stereotype.Service

@Service
class ReferenceSearchService(private val mapper: SearchApiMapper) {
    // The singleton is eagerly created at startup; invalid catalog data prevents startup.
    private val catalog = ReferenceCatalogLoader().load()
    private val search = ReferenceSearch()

    fun search(request: SearchRequest): SearchResponse =
        mapper.toResponse(search.search(mapper.toGraph(request), catalog))
}
