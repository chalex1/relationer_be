package com.relationer.backend.domain

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class RealReferenceCatalogTest {
    private val loader = ReferenceCatalogLoader()

    @Test
    fun `loader preserves production metadata and relationships`() {
        val stream = javaClass.getResourceAsStream("/references.json")
        assertNotNull(stream)
        val records = stream.use { ObjectMapper().readTree(it) }
        val loaded = loader.load()
        assertEquals(records.size(), loaded.size)
        for (record in records) {
            val reference = loaded.single { it.id == record["id"].asText() }
            assertEquals(record["description"].asText(), reference.description)
            assertEquals(record["verdict"].asText(), reference.verdict.name)
            assertEquals(record["source"]["document"].asText(), reference.source.document)
            assertEquals(record["source"]["page"].intValue(), reference.source.page)
            assertEquals(record["source"]["example"].asText(), reference.source.example)
            assertEquals(record["source"]["conclusion"].asText(), reference.source.conclusion)
            val graph = reference.graph
            assertEquals(record["personA"].asText(), graph.personA.id)
            assertEquals(record["personB"].asText(), graph.personB.id)
            assertEquals(record["persons"].map { it["id"].asText() }, graph.persons.map { it.id })
            for (relation in record["relations"]) {
                val from = graph.persons.single { it.id == relation["from"].asText() }
                val targets = when (relation["type"].asText()) {
                    "BIOLOGICAL" -> from.children
                    "SPIRITUAL" -> from.godchildren
                    "ADOPTION" -> from.adoptedChildren
                    "MARRIAGE" -> from.spouses
                    else -> error("Unknown relationship")
                }
                assertTrue(targets.any { it.id == relation["to"].asText() })
            }
            assertEquals(record["relations"].size(), graph.persons.sumOf {
                it.children.size + it.godchildren.size + it.adoptedChildren.size + it.spouses.size
            })
        }
    }

    @ParameterizedTest
    @CsvSource(
        "blood-01, <BB>, a;p;b, 34, Изображение 1",
        "blood-02, <BB>B>, a;p;s;b, 34, Изображение 2",
        "blood-03, <BB>B>B>, a;p;s;n;b, 35, Изображение 3",
        "blood-04, <B<BB>B>, a;f;p;m;b, 35, Изображение 4",
        "blood-05, <BB>B>B>B>, a;p;s;n;gn;b, 36, Изображение 5",
    )
    fun `loads validates and encodes each real reference`(
        id: String, code: String, personIds: String, page: Int, example: String,
    ) {
        val reference = loader.load().single { it.id == id }
        val graph = reference.graph
        assertTrue(graph.validate().isEmpty(), id)
        assertEquals(Verdict.FORBIDDEN, reference.verdict)
        assertEquals(page, reference.source.page)
        assertEquals(example, reference.source.example)
        assertEquals(
            "О брачном праве. Сборник статей о различных видах родства (Москва, 1900), глава I",
            reference.source.document,
        )
        assertEquals("Запрещенные", reference.source.conclusion)
        assertTrue(reference.description.orEmpty().isNotBlank())
        assertEquals("a", graph.personA.id)
        assertEquals("b", graph.personB.id)
        val path = PathExtractor().extract(graph).single()
        assertEquals(personIds.split(';'), path.persons.map { it.id })
        assertEquals(code, PathEncoder().encode(path))
        val reverse = PathExtractor().extract(graph.copy(personA = graph.personB, personB = graph.personA)).single()
        assertEquals(reversePath(code), PathEncoder().encode(reverse))
    }

    @ParameterizedTest
    @CsvSource(
        "blood-01, <BB>, 2, 1, blood-01;blood-02;blood-03;blood-04;blood-05",
        "blood-02, <BB>B>, 3, 1, blood-02;blood-03;blood-04;blood-05",
        "blood-03, <BB>B>B>, 4, 1, blood-03;blood-05",
        "blood-04, <B<BB>B>, 4, 2, blood-04",
        "blood-05, <BB>B>B>B>, 5, 1, blood-05",
    )
    fun `search finds real cases for independent user graphs`(
        id: String, code: String, steps: Int, upwardSteps: Int, expectedIds: String,
    ) {
        val persons = (0..steps).map { Person("user-$it") }
        for (i in 0 until steps) {
            if (i < upwardSteps) persons[i + 1].children += persons[i]
            else persons[i].children += persons[i + 1]
        }
        val user = PersonGraph(persons, persons.first(), persons.last())
        assertTrue(user.validate().isEmpty())
        val references = loader.load()
        val matches = ReferenceSearch().search(user, references)
        assertEquals(expectedIds.split(';'), matches.map { it.referencePattern.id })
        assertTrue(matches.all { it.verdict == Verdict.FORBIDDEN && it.userPathCode == code })
        val ownMatch = matches.single { it.referencePattern.id == id }
        assertEquals(code, ownMatch.referencePathCode)
        assertEquals(persons, ownMatch.userPath.persons)

        val reverseUser = user.copy(personA = user.personB, personB = user.personA)
        val reverseMatches = ReferenceSearch().search(reverseUser, references)
        assertEquals(expectedIds.split(';'), reverseMatches.map { it.referencePattern.id })
        assertTrue(reverseMatches.all { it.userPathCode == reversePath(code) })
    }
}
