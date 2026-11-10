package com.relationer.backend.api

import com.relationer.backend.api.generated.model.*
import com.relationer.backend.domain.Person
import com.relationer.backend.domain.PersonGraph
import com.relationer.backend.domain.ReferenceMatch
import org.springframework.stereotype.Component

@Component
class SearchApiMapper(private val catalog: ReferenceCatalogService) {
    fun toGraph(request: SearchRequest): PersonGraph {
        val persons = request.persons.map {
            requireNotNull(it) { "persons must not contain null" }
            Person(it.id, it.name)
        }
        val byId = persons.associateBy { it.id }
        fun person(id: String): Person = requireNotNull(byId[id]) { "Unknown person id: $id" }

        request.relations.forEach { relation ->
            requireNotNull(relation) { "relations must not contain null" }
            val from = person(relation.from)
            val to = person(relation.to)
            when (relation.type) {
                RelationType.BIOLOGICAL -> from.children += to
                RelationType.MARRIAGE -> from.spouses += to
                RelationType.SPIRITUAL -> from.godchildren += to
                RelationType.ADOPTION -> from.adoptedChildren += to
            }
        }
        val graph = PersonGraph(persons, person(request.personA), person(request.personB))
        val errors = graph.validate()
        require(errors.isEmpty()) { errors.joinToString("; ") }
        require(graph.personA !== graph.personB) { "personA and personB must be different" }
        return graph
    }

    fun toResponse(matches: List<ReferenceMatch>): SearchResponse = SearchResponse(matches.map { match ->
        val reference = match.referencePattern
        val metadata = catalog.summary(catalog.find(reference.id))
        ReferenceMatchDto(
            referenceId = reference.id,
            title = metadata.title,
            catalog = metadata.catalog,
            reviewStatus = metadata.reviewStatus,
            sources = metadata.sources,
            verdict = VerdictDto.valueOf(match.verdict.name),
            description = reference.description,
            userPathCode = match.userPathCode,
            referencePathCode = match.referencePathCode,
            source = metadata.source,
        )
    })
}
