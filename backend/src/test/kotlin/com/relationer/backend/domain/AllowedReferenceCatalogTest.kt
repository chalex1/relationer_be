package com.relationer.backend.domain

import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AllowedReferenceCatalogTest {
    @ParameterizedTest
    @CsvSource(
        "affinity-allowed-01, <B<BM<BB>B>B>, georgiy;ioanna;petr;maria;ancestor;feodora;irina;elena, 61, Изображение 2, 8",
        "affinity-allowed-02, <B<BM<B<BB>B>B>, georgiy;ioanna;petr;maria;left;ancestor;right;feodora;anna, 62, Изображение 3, 9",
        "affinity-allowed-03, <B<B<BM<BB>B>, foma;georgiy;ioanna;petr;maria;ancestor;irina;anna, 65, Изображение 1, 8",
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
        "affinity-allowed-01, <B<BM<BB>B>B>",
        "affinity-allowed-02, <B<BM<B<BB>B>B>",
        "affinity-allowed-03, <B<B<BM<BB>B>",
    )
    fun `search checks all catalog references for independent allowed user paths`(
        id: String, code: String,
    ) {
        val tokens = Regex("<B|B>|M").findAll(code).map { it.value }.toList()
        val persons = (0..tokens.size).map { Person("user-$it") }
        for ((i, token) in tokens.withIndex()) {
            when (token) {
                "<B" -> persons[i + 1].children += persons[i]
                "B>" -> persons[i].children += persons[i + 1]
                "M" -> persons[i].spouses += persons[i + 1]
            }
        }
        val graph = PersonGraph(persons, persons.first(), persons.last())
        val catalog = ReferenceCatalogLoader().load()
        for (user in listOf(graph, graph.copy(personA = graph.personB, personB = graph.personA))) {
            val matches = ReferenceSearch().search(user, catalog)
            assertEquals(listOf(id), matches.map { it.referencePattern.id })
            assertTrue(matches.all { it.verdict == Verdict.ALLOWED })
            assertEquals(code, matches.single { it.referencePattern.id == id }.referencePathCode)
        }
    }
}
