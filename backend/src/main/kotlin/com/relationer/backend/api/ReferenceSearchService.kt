package com.relationer.backend.api

import com.relationer.backend.api.generated.model.SearchRequest
import com.relationer.backend.api.generated.model.SearchResponse
import com.relationer.backend.domain.ReferenceSearch
import org.springframework.stereotype.Service

@Service
class ReferenceSearchService(private val mapper: SearchApiMapper, private val referenceCatalog: ReferenceCatalog) {
    // The singleton merges both files; unavailable drafts are reported separately.
    private val catalog get() = referenceCatalog.entries
    private val search = ReferenceSearch()

    fun search(request: SearchRequest): SearchResponse {
        val response = mapper.toResponse(search.search(mapper.toGraph(request), catalog))
        return if (referenceCatalog.draftFailure == null) response else response.copy(
            catalogWarning = "Черновой каталог недоступен. Поиск выполнен только по рабочим кейсам.",
        )
    }
}
