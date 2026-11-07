package com.relationer.backend.domain

import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AllowedReferenceCatalogTest {
    @ParameterizedTest
    @CsvSource(
        "affinity-allowed-01, M<BB>B>B>, petr;maria;ancestor;feodora;irina;elena, 61, Изображение 2, 8",
        "affinity-allowed-02, M<B<BB>B>B>, petr;maria;left;ancestor;right;feodora;anna, 62, Изображение 3, 9",
        "affinity-allowed-03, M<BB>B>, petr;maria;ancestor;irina;anna, 65, Изображение 1, 8",
    )
    fun `loads validates and encodes allowed cases`(
        id: String, code: String, ids: String, page: Int, example: String, personCount: Int,
    ) {
        val reference = ReferenceCatalogLoader().load().single { it.id == id }
        assertEquals(Verdict.ALLOWED, reference.verdict)
        assertTrue(reference.graph.validate().isEmpty())
        assertEquals(personCount, reference.graph.persons.size)
        assertEquals(page, reference.source.page)
        assertEquals(example, reference.source.example)
        assertEquals(
            "О брачном праве. Сборник статей о различных видах родства (Москва, 1900), глава IV",
            reference.source.document,
        )
        assertTrue(reference.source.conclusion.orEmpty().contains("при условии отсутствия предшествующего брака"))
        val path = PathExtractor().extract(reference.graph).single()
        assertEquals(ids.split(';'), path.persons.map { it.id })
        assertEquals(code, PathEncoder().encode(path))
        val reverse = reference.graph.copy(personA = reference.graph.personB, personB = reference.graph.personA)
        assertEquals(reversePath(code), PathEncoder().encode(PathExtractor().extract(reverse).single()))
    }

    @ParameterizedTest
    @CsvSource(
        "affinity-allowed-01, M<BB>B>B>, 1, 3, affinity-allowed-01;affinity-allowed-03",
        "affinity-allowed-02, M<B<BB>B>B>, 2, 3, affinity-allowed-02",
        "affinity-allowed-03, M<BB>B>, 1, 2, affinity-allowed-03",
    )
    fun `search checks all catalog references for independent allowed user paths`(
        id: String, code: String, up: Int, down: Int, expected: String,
    ) {
        val persons = (0..1 + up + down).map { Person("user-$it") }
        persons[0].spouses += persons[1]
        for (i in 1 until persons.lastIndex) {
            if (i <= up) persons[i + 1].children += persons[i]
            else persons[i].children += persons[i + 1]
        }
        val graph = PersonGraph(persons, persons.first(), persons.last())
        val catalog = ReferenceCatalogLoader().load()
        for (user in listOf(graph, graph.copy(personA = graph.personB, personB = graph.personA))) {
            val matches = ReferenceSearch().search(user, catalog)
            assertEquals(expected.split(';'), matches.map { it.referencePattern.id })
            assertTrue(matches.all { it.verdict == Verdict.ALLOWED })
            assertEquals(code, matches.single { it.referencePattern.id == id }.referencePathCode)
        }
    }
}
