package com.relationer.backend.domain

import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import kotlin.test.assertEquals

class ReferenceMatchMatrixTest {
    @ParameterizedTest
    @CsvSource(
        "blood-01, 11111000000",
        "blood-02, 01111000000",
        "blood-03, 00101000000",
        "blood-04, 00010000000",
        "blood-05, 00001000000",
        "affinity-allowed-01, 00000101000",
        "affinity-allowed-02, 00000010000",
        "affinity-allowed-03, 00000001000",
        "spiritual-forbidden-01, 00000000111",
        "spiritual-forbidden-02, 00000000010",
        "spiritual-forbidden-03, 00000000001",
    )
    fun `search matrix covers every reference in both directions`(userId: String, expected: String) {
        val catalog = ReferenceCatalogLoader().load()
        assertEquals(listOf("blood-01", "blood-02", "blood-03", "blood-04", "blood-05",
            "affinity-allowed-01", "affinity-allowed-02", "affinity-allowed-03",
            "spiritual-forbidden-01", "spiritual-forbidden-02", "spiritual-forbidden-03"), catalog.map { it.id })
        val graph = catalog.single { it.id == userId }.graph
        for (user in listOf(graph, graph.copy(personA = graph.personB, personB = graph.personA))) {
            val matches = ReferenceSearch().search(user, catalog)
            val expectedIds = catalog.filterIndexed { index, _ -> expected[index] == '1' }.map { it.id }
            assertEquals(expectedIds, matches.map { it.referencePattern.id })
            for (match in matches) {
                assertEquals(match.referencePattern.verdict, match.verdict)
            }
        }
        println("$userId,${expected.toList().joinToString(",")}")
    }
}
