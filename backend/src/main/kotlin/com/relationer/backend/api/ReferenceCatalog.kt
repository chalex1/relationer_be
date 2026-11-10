package com.relationer.backend.api

import com.relationer.backend.domain.ReferenceCatalogLoader
import org.springframework.stereotype.Component

@Component
class ReferenceCatalog internal constructor(draftResource: String) {
    constructor() : this("reference-catalog/references-draft.json")
    val production = ReferenceCatalogLoader().loadEntries()
    private val draftResult = runCatching { ReferenceCatalogLoader().loadEntries(draftResource) }
    val draftFailure = draftResult.exceptionOrNull()
    val drafts = draftResult.getOrDefault(emptyList())
    init {
        if (draftFailure != null) org.slf4j.LoggerFactory.getLogger(javaClass).warn("Draft catalog unavailable", draftFailure)
        val byId = production.associateBy { it.pattern.id }
        drafts.forEach { draft ->
            val existing = byId[draft.pattern.id]
            if (existing != null) {
                val a = existing.pattern.graph
                val b = draft.pattern.graph
                fun links(graph: com.relationer.backend.domain.PersonGraph) = graph.persons.flatMap { p ->
                    listOf("B" to p.children, "M" to p.spouses, "G" to p.godchildren, "U" to p.adoptedChildren)
                        .flatMap { (type, targets) -> targets.map { listOf(type, p.id, it.id) } }
                }.toSet()
                require(existing.copy(pattern = draft.pattern) == draft &&
                    existing.pattern.copy(graph = b) == draft.pattern &&
                    a.personA.id == b.personA.id && a.personB.id == b.personB.id &&
                    a.persons.associate { it.id to it.name } == b.persons.associate { it.id to it.name } && links(a) == links(b)) {
                    "Conflicting versions of reference ID: ${draft.pattern.id}"
                }
            }
        }
    }
    val all = (production + drafts).distinctBy { it.pattern.id }
    val entries = all.map { it.pattern }
}
