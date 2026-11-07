package com.relationer.backend.domain

import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import org.junit.jupiter.params.provider.CsvSource
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertSame
import kotlin.test.assertTrue

class ReferenceCatalogLoaderTest {
    private val loader = ReferenceCatalogLoader()

    @Test
    fun `production catalog contains eleven prepared reference cases`() {
        val references = loader.load()
        assertEquals((1..5).map { "blood-0$it" } + (1..3).map { "affinity-allowed-0$it" } + (1..3).map { "spiritual-forbidden-0$it" }, references.map { it.id })
        assertTrue(references.all { it.graph.validate().isEmpty() })
    }

    @Test
    fun `loads synthetic records and preserves descriptions and sources`() {
        val references = loader.load("catalog/synthetic.json")
        assertEquals(4, references.size)
        assertEquals(4, references.map { it.id }.toSet().size)
        assertTrue(references.all { it.description.orEmpty().contains("СИНТЕТИЧЕСКИЙ ТЕСТ") })
        val source = references.first().source
        assertEquals("СИНТЕТИЧЕСКИЕ ТЕСТОВЫЕ ДАННЫЕ", source.document)
        assertEquals(1, source.page)
        assertEquals("fixture-1", source.example)
        assertEquals("Только проверка загрузчика", source.conclusion)
    }

    @Test
    fun `restores all relationships using the same person instances`() {
        val graph = loader.load("/catalog/synthetic.json").first().graph
        val (a, b, c, d, e) = graph.persons
        assertSame(a, graph.personA)
        assertSame(b, graph.personB)
        assertSame(b, a.children.single())
        assertSame(c, b.spouses.single())
        assertSame(d, c.godchildren.single())
        assertSame(e, d.adoptedChildren.single())
        assertEquals("Тест A", a.name)
        assertTrue(graph.validate().isEmpty())
        val paths = PathExtractor().extract(graph.copy(personB = e))
        assertEquals("B>MG>U>", PathEncoder().encode(paths.single()))
        val reverse = PathExtractor().extract(graph.copy(personA = e, personB = a))
        assertEquals("<U<GM<B", PathEncoder().encode(reverse.single()))
    }

    @ParameterizedTest
    @ValueSource(strings = ["id", "description", "source", "verdict", "persons", "relations", "personA", "personB"])
    fun `missing mandatory fields identify record and reason`(field: String) {
        val error = assertFailsWith<IllegalArgumentException> { loader.load("catalog/missing-$field.json") }
        assertTrue(error.message.orEmpty().contains(if (field == "id") "entry[0]" else "test-allowed"))
        assertTrue(error.message.orEmpty().contains(field))
    }

    @ParameterizedTest
    @CsvSource(
        "unknown-person, Unknown person id: missing",
        "unknown-endpoint, Unknown person id: missing",
        "duplicate-person, Duplicate person id: a",
        "duplicate-case, Duplicate reference id: test-allowed",
        "unknown-verdict, Unknown verdict: UNKNOWN",
        "invalid-graph, Invalid graph: personA and personB must be different",
        "unknown-relation, Unknown relation type: UNKNOWN",
        "invalid-page, source.page must be a positive integer",
        "missing-document, document must be a non-blank string",
    )
    fun `invalid records identify reference and reason`(fixture: String, reason: String) {
        val error = assertFailsWith<IllegalArgumentException> { loader.load("catalog/$fixture.json") }
        assertTrue(error.message.orEmpty().startsWith("Reference test-allowed:"))
        assertTrue(error.message.orEmpty().contains(reason))
    }

    @ParameterizedTest
    @ValueSource(strings = ["wrong-root", "malformed", "does-not-exist"])
    fun `invalid or missing resources have readable errors`(fixture: String) {
        val error = assertFailsWith<IllegalArgumentException> { loader.load("catalog/$fixture.json") }
        assertTrue(error.message.orEmpty().contains(fixture))
    }

    @Test
    fun `loaded catalog integrates with search and retains conflicting verdicts`() {
        val references = loader.load("catalog/synthetic.json")
        val parent = Person("user-parent")
        val child = Person("user-child")
        parent.children += child
        val user = PersonGraph(listOf(parent, child), parent, child)

        val matches = ReferenceSearch().search(user, references)

        assertEquals(3, matches.size)
        assertEquals(Verdict.entries.toSet(), matches.map { it.verdict }.toSet())
        assertEquals(setOf("test-allowed", "test-forbidden", "test-undetermined"), matches.map { it.referencePattern.id }.toSet())
        assertTrue(matches.all { it.userPathCode == "B>" && it.referencePathCode == "B>" })
    }
}
