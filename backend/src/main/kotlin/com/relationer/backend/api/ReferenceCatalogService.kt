package com.relationer.backend.api

import com.relationer.backend.api.generated.model.*
import com.relationer.backend.domain.ReferencePattern
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException
import org.springframework.http.HttpStatus

@Service
class ReferenceCatalogService(private val catalog: ReferenceCatalog) {
    fun listReferences(): ResponseEntity<List<ReferenceSummaryDto>> = ResponseEntity.ok(catalog.entries.map(::summary))

    fun getReference(id: String): ResponseEntity<ReferenceDetailDto> {
        val reference = catalog.entries.find { it.id == id } ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown reference id: $id")
        val graph = reference.graph
        val relations = graph.persons.flatMap { person ->
            listOf(RelationType.BIOLOGICAL to person.children, RelationType.MARRIAGE to person.spouses,
                RelationType.SPIRITUAL to person.godchildren, RelationType.ADOPTION to person.adoptedChildren)
                .flatMap { (type, targets) -> targets.map { RelationDto(type, person.id, it.id) } }
        }
        return ResponseEntity.ok(ReferenceDetailDto(summary(reference), SearchRequest(
            graph.persons.map { PersonDto(it.id, it.name) }, relations, graph.personA.id, graph.personB.id,
        )))
    }

    private fun summary(reference: ReferencePattern) = ReferenceSummaryDto(
        id = reference.id,
        categories = reference.categories.map { RelationCategory.valueOf(it.name) }.toSet(),
        tags = reference.tags,
        verdict = VerdictDto.valueOf(reference.verdict.name),
        source = SourceDto(reference.source.document, reference.source.page, reference.source.example,
            reference.source.conclusion, reference.source.image),
        hasImage = reference.source.image != null,
        description = reference.description,
    )
}
