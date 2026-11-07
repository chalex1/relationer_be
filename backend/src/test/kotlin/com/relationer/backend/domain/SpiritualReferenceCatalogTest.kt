package com.relationer.backend.domain

import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SpiritualReferenceCatalogTest {
    @ParameterizedTest
    @CsvSource(
        "spiritual-forbidden-01, G>, godparent;goddaughter, 120, spiritual-forbidden-01;spiritual-forbidden-02;spiritual-forbidden-03",
        "spiritual-forbidden-02, G><B, godparent;godchild;mother, 121, spiritual-forbidden-02",
        "spiritual-forbidden-03, <GG>, godson;godparent;goddaughter, 121, spiritual-forbidden-03",
    )
    fun `loads validates encodes and searches spiritual cases`(
        id: String, code: String, ids: String, page: Int, expectedMatches: String,
    ) {
        val catalog = ReferenceCatalogLoader().load()
        val reference = catalog.single { it.id == id }
        assertTrue(reference.graph.validate().isEmpty())
        assertEquals(Verdict.FORBIDDEN, reference.verdict)
        assertEquals(page, reference.source.page)
        val path = PathExtractor().extract(reference.graph).single()
        assertEquals(ids.split(';'), path.persons.map { it.id })
        assertEquals(code, PathEncoder().encode(path))

        // Build an independent user graph from the expected chain, using new people.
        val persons = path.persons.map { Person("user-${it.id}") }
        path.transitions.forEachIndexed { i, transition ->
            when (transition) {
                PathTransition.GODPARENT_TO_GODCHILD -> persons[i].godchildren += persons[i + 1]
                PathTransition.GODCHILD_TO_GODPARENT -> persons[i + 1].godchildren += persons[i]
                PathTransition.BIOLOGICAL_CHILD_TO_PARENT -> persons[i + 1].children += persons[i]
                else -> error("Unexpected transition: $transition")
            }
        }
        val graph = PersonGraph(persons, persons.first(), persons.last())
        for (user in listOf(graph, graph.copy(personA = graph.personB, personB = graph.personA))) {
            val matches = ReferenceSearch().search(user, catalog)
            assertEquals(expectedMatches.split(';'), matches.map { it.referencePattern.id })
            assertTrue(matches.all { it.verdict == Verdict.FORBIDDEN })
        }
        val reverse = graph.copy(personA = graph.personB, personB = graph.personA)
        assertEquals(reversePath(code), PathEncoder().encode(PathExtractor().extract(reverse).single()))
    }
}
