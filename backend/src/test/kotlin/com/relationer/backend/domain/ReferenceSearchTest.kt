package com.relationer.backend.domain

import com.relationer.backend.domain.PathTransition.*
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertSame
import kotlin.test.assertTrue

class ReferenceSearchTest {
    private val search = ReferenceSearch()

    @Test
    fun `one user path matches several reference cases and keeps their verdicts`() {
        val user = chain(BIOLOGICAL_CHILD_TO_PARENT, BIOLOGICAL_PARENT_TO_CHILD)
        val references = Verdict.entries.map { verdict ->
            reference(verdict.name, chain(BIOLOGICAL_CHILD_TO_PARENT, BIOLOGICAL_PARENT_TO_CHILD), verdict)
        }

        val matches = search.search(user, references)

        assertEquals(3, matches.size)
        assertEquals(references, matches.map { it.referencePattern })
        assertEquals(Verdict.entries.toList(), matches.map { it.verdict })
        assertTrue(matches.all { it.userPathCode == "<BB>" && it.referencePathCode == "<BB>" })
    }

    @Test
    fun `preserves distinct user paths with identical codes`() {
        val user = siblingsWithTwoParents()
        val reference = reference("siblings", chain(BIOLOGICAL_CHILD_TO_PARENT, BIOLOGICAL_PARENT_TO_CHILD))

        val matches = search.search(user, listOf(reference))

        assertEquals(2, matches.size)
        assertEquals(listOf("<BB>", "<BB>"), matches.map { it.userPathCode })
        assertEquals(setOf("parent1", "parent2"), matches.map { it.userPath.persons[1].id }.toSet())
        assertTrue(matches.all { it.referencePattern === reference })
    }

    @Test
    fun `preserves every pair of distinct user and reference paths with identical codes`() {
        val user = siblingsWithTwoParents()
        val reference = reference("siblings", siblingsWithTwoParents())

        val matches = search.search(user, listOf(reference))

        assertEquals(4, matches.size)
        assertEquals(4, matches.map { it.userPath.persons[1] to it.referencePath.persons[1] }.toSet().size)
        assertTrue(matches.all { it.userPathCode == "<BB>" && it.referencePathCode == "<BB>" })
    }

    @Test
    fun `different relation paths over the same persons are retained`() {
        val user = chain(BIOLOGICAL_PARENT_TO_CHILD)
        user.personA.godchildren += user.personB
        val graph = chain(BIOLOGICAL_PARENT_TO_CHILD)
        graph.personA.godchildren += graph.personB

        val matches = search.search(user, listOf(reference("two-relations", graph)))

        assertEquals(2, matches.size)
        assertEquals(setOf("B>", "G>"), matches.map { it.userPathCode }.toSet())
        assertTrue(matches.all { it.userPathCode == it.referencePathCode })
    }

    @Test
    fun `duplicate reference entries and symmetric reversal do not duplicate a match`() {
        val user = chain(BIOLOGICAL_CHILD_TO_PARENT, BIOLOGICAL_PARENT_TO_CHILD)
        val reference = reference("siblings", chain(BIOLOGICAL_CHILD_TO_PARENT, BIOLOGICAL_PARENT_TO_CHILD))

        val matches = search.search(user, listOf(reference, reference.copy(), reference))

        assertEquals(1, matches.size)
    }

    @Test
    fun `repeated fragment positions produce one match per path pair`() {
        val matches = search.search(
            chain(MARRIAGE, MARRIAGE, MARRIAGE),
            listOf(reference("marriage", chain(MARRIAGE), Verdict.ALLOWED)),
        )

        assertEquals(1, matches.size)
        assertEquals("MMM", matches.single().userPathCode)
        assertEquals("M", matches.single().referencePathCode)
    }

    @Test
    fun `unrelated paths produce an empty result`() {
        assertTrue(search.search(
            chain(BIOLOGICAL_PARENT_TO_CHILD),
            listOf(reference("adoption", chain(ADOPTER_TO_ADOPTED))),
        ).isEmpty())
    }

    @Test
    fun `disconnected user pair produces an empty result`() {
        assertTrue(search.search(
            disconnected(),
            listOf(reference("parent", chain(BIOLOGICAL_PARENT_TO_CHILD))),
        ).isEmpty())
    }

    @Test
    fun `reference with no path produces no matches`() {
        assertTrue(search.search(
            chain(BIOLOGICAL_PARENT_TO_CHILD),
            listOf(reference("disconnected", disconnected())),
        ).isEmpty())
    }

    @Test
    fun `empty reference collection produces an empty result`() {
        assertTrue(search.search(chain(BIOLOGICAL_PARENT_TO_CHILD), emptyList()).isEmpty())
    }

    @Test
    fun `rejects empty user path even without references`() {
        val error = assertFailsWith<IllegalArgumentException> { search.search(chain(), emptyList()) }
        assertTrue(error.message.orEmpty().contains("empty path"))
    }

    @Test
    fun `rejects empty reference path even without user paths`() {
        val error = assertFailsWith<IllegalArgumentException> {
            search.search(disconnected(), listOf(reference("empty", chain())))
        }
        assertTrue(error.message.orEmpty().contains("Reference empty contains an empty path"))
    }

    @Test
    fun `rejects invalid user graph before extracting paths`() {
        val graph = chain(BIOLOGICAL_PARENT_TO_CHILD)
        val invalid = graph.copy(persons = listOf(graph.personA))

        val error = assertFailsWith<IllegalArgumentException> { search.search(invalid, emptyList()) }

        assertTrue(error.message.orEmpty().contains("User graph is invalid"))
    }

    @Test
    fun `rejects invalid reference graph before extracting paths`() {
        val graph = chain(BIOLOGICAL_PARENT_TO_CHILD)
        val invalid = graph.copy(persons = listOf(graph.personA))

        val error = assertFailsWith<IllegalArgumentException> {
            search.search(graph, listOf(reference("invalid", invalid)))
        }

        assertTrue(error.message.orEmpty().contains("Reference invalid is invalid"))
    }

    @Test
    fun `integrates graph extraction encoding and verdict dependent search in both directions`() {
        val mother = Person("mother")
        val a = Person("a")
        val brother = Person("brother")
        val b = Person("b")
        mother.children += listOf(a, brother)
        brother.spouses += b
        val user = PersonGraph(listOf(mother, a, brother, b), a, b)
        val allowed = reference(
            "allowed", chain(BIOLOGICAL_CHILD_TO_PARENT, BIOLOGICAL_PARENT_TO_CHILD), Verdict.ALLOWED,
        )
        val forbidden = reference(
            "forbidden", chain(BIOLOGICAL_CHILD_TO_PARENT, BIOLOGICAL_PARENT_TO_CHILD, MARRIAGE, GODPARENT_TO_GODCHILD),
        )
        val undetermined = reference(
            "undetermined", chain(MARRIAGE, BIOLOGICAL_CHILD_TO_PARENT, BIOLOGICAL_PARENT_TO_CHILD), Verdict.UNDETERMINED,
        )
        val unrelated = reference("unrelated", chain(ADOPTER_TO_ADOPTED))

        val matches = search.search(user, listOf(allowed, forbidden, undetermined, unrelated))

        assertEquals(listOf(allowed, forbidden, undetermined), matches.map { it.referencePattern })
        assertEquals(listOf("<BB>", "<BB>MG>", "M<BB>"), matches.map { it.referencePathCode })
        assertEquals(listOf(Verdict.ALLOWED, Verdict.FORBIDDEN, Verdict.UNDETERMINED), matches.map { it.verdict })
        for (match in matches) {
            assertEquals(listOf(a, mother, brother, b), match.userPath.persons)
            assertEquals(listOf(BIOLOGICAL_CHILD_TO_PARENT, BIOLOGICAL_PARENT_TO_CHILD, MARRIAGE), match.userPath.transitions)
            assertEquals("<BB>M", match.userPathCode)
            assertEquals(PathEncoder().encode(match.referencePath), match.referencePathCode)
            assertSame(match.referencePattern.graph.personA, match.referencePath.persons.first())
            assertSame(match.referencePattern.graph.personB, match.referencePath.persons.last())
            assertEquals(42, match.referencePattern.source.page)
        }
    }

    private fun reference(id: String, graph: PersonGraph, verdict: Verdict = Verdict.FORBIDDEN) =
        ReferencePattern(id, graph, verdict, ReferenceSource(page = 42, conclusion = "Reference conclusion"))

    private fun siblingsWithTwoParents(): PersonGraph {
        val a = Person("a")
        val b = Person("b")
        val parents = listOf(Person("parent1"), Person("parent2"))
        parents.forEach { it.children += listOf(a, b) }
        return PersonGraph(listOf(a, b) + parents, a, b)
    }

    private fun disconnected(): PersonGraph {
        val a = Person("a")
        val b = Person("b")
        return PersonGraph(listOf(a, b), a, b)
    }

    private fun chain(vararg transitions: PathTransition): PersonGraph {
        val persons = (0..transitions.size).map { Person("p$it") }
        transitions.forEachIndexed { index, transition ->
            val from = persons[index]
            val to = persons[index + 1]
            when (transition) {
                BIOLOGICAL_PARENT_TO_CHILD -> from.children += to
                BIOLOGICAL_CHILD_TO_PARENT -> to.children += from
                GODPARENT_TO_GODCHILD -> from.godchildren += to
                GODCHILD_TO_GODPARENT -> to.godchildren += from
                ADOPTER_TO_ADOPTED -> from.adoptedChildren += to
                ADOPTED_TO_ADOPTER -> to.adoptedChildren += from
                MARRIAGE -> from.spouses += to
            }
        }
        return PersonGraph(persons, persons.first(), persons.last())
    }
}
