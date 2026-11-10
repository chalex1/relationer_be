package com.relationer.backend.api

import com.relationer.backend.api.generated.ReferencesApi
import com.relationer.backend.api.generated.model.SearchRequest
import com.relationer.backend.api.generated.model.SearchResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RestController

@RestController
class ReferenceSearchController(private val service: ReferenceSearchService, private val catalog: ReferenceCatalogService) : ReferencesApi {
    override fun listReferences(catalog: String?, category: String?, reviewStatus: String?, search: String?, sort: String?) =
        this.catalog.listReferences(catalog, category, reviewStatus, search, sort)
    override fun getReference(id: String) = catalog.getReference(id)
    override fun getReferenceImage(id: String, sourceId: String?) = catalog.getImage(id, sourceId)
    override fun searchReferences(searchRequest: SearchRequest): ResponseEntity<SearchResponse> = ResponseEntity.ok(service.search(searchRequest))
}
