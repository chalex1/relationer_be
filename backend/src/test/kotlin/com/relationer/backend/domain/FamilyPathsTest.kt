package com.relationer.backend.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class FamilyPathsTest {
    private val extractor = PathExtractor()
    private val encoder = PathEncoder()

    @Test
    fun `one known common parent gives blood kinship without invented people`() {
        val graph = siblings(parentCount = 1)

        assertEquals(listOf("<BB>"), codes(graph))
        assertEquals(3, graph.persons.size)
    }

    @Test
    fun `two common parents retain distinct blood paths`() {
        val graph = siblings()
        val paths = extractor.extractForSearch(graph)

        assertEquals(listOf("<BB>", "<BB>"), paths.map(encoder::encode))
        assertEquals(setOf("p1", "p2"), paths.map { it.persons[1].id }.toSet())
    }

    @Test
    fun `married common parents exclude affinity detours in both directions without changing graph`() {
        val graph = siblings(married = true)
        val rawPaths = extractor.extract(graph)

        for (direction in listOf(graph, graph.copy(personA = graph.personB, personB = graph.personA))) {
            assertEquals(listOf("<BB>", "<BB>"), codes(direction))
        }
        assertEquals(listOf("<BB>", "<BB>", "<BMB>", "<BMB>"), rawPaths.map(encoder::encode).sorted())
        assertEquals(rawPaths, extractor.extract(graph))
        assertEquals(listOf(graph.persons[3]), graph.persons[2].spouses)
        assertTrue(graph.persons.drop(2).all { it.children == listOf(graph.personA, graph.personB) })
    }

    @Test
    fun `children of different married parents retain affinity`() {
        val graph = stepSiblings()

        assertEquals(listOf("<BMB>"), codes(graph))
        assertEquals(listOf("<BMB>"), codes(graph.copy(personA = graph.personB, personB = graph.personA)))
    }

    @Test
    fun `separate blood relationship does not suppress remarriage affinity`() {
        val graph = stepSiblings()
        val commonParent = Person("common", children = mutableListOf(graph.personA, graph.personB))

        assertEquals(listOf("<BB>", "<BMB>"), codes(graph.copy(persons = graph.persons + commonParent)))
    }

    @Test
    fun `one shared parent alone does not suppress affinity via another spouse`() {
        val graph = stepSiblings()
        graph.persons[2].children += graph.personB

        assertEquals(listOf("<BB>", "<BMB>"), codes(graph))
    }

    @Test
    fun `redundant family fragment is excluded inside a longer search path`() {
        val family = siblings(married = true)
        val a = Person("outer-a", children = mutableListOf(family.personA))
        val b = Person("outer-b")
        family.personB.godchildren += b
        val graph = PersonGraph(family.persons + listOf(a, b), a, b)

        assertEquals(listOf("B><BB>G>", "B><BB>G>"), codes(graph))
        assertEquals(4, extractor.extract(graph).size)
    }

    @Test
    fun `search filters redundant paths on both user and reference sides`() {
        val bloodReference = reference("blood", siblings(married = true))
        val affinityReference = reference("affinity", stepSiblings())
        val search = ReferenceSearch()

        val bloodMatches = search.search(siblings(married = true), listOf(bloodReference, affinityReference))
        assertEquals(4, bloodMatches.size)
        assertTrue(bloodMatches.all { it.referencePattern.id == "blood" })
        assertTrue(bloodMatches.all { it.userPathCode == "<BB>" && it.referencePathCode == "<BB>" })

        val affinityMatches = search.search(stepSiblings(), listOf(bloodReference, affinityReference))
        assertEquals(listOf("affinity"), affinityMatches.map { it.referencePattern.id })
        assertEquals("<BMB>", affinityMatches.single().userPathCode)
    }

    private fun codes(graph: PersonGraph) = extractor.extractForSearch(graph).map(encoder::encode).sorted()

    private fun siblings(parentCount: Int = 2, married: Boolean = false): PersonGraph {
        val a = Person("a")
        val b = Person("b")
        val parents = (1..parentCount).map { Person("p$it", children = mutableListOf(a, b)) }
        if (married) parents[0].spouses += parents[1]
        return PersonGraph(listOf(a, b) + parents, a, b)
    }

    private fun stepSiblings(): PersonGraph {
        val a = Person("a")
        val b = Person("b")
        val p = Person("p", children = mutableListOf(a))
        val q = Person("q", children = mutableListOf(b), spouses = mutableListOf(p))
        return PersonGraph(listOf(a, b, p, q), a, b)
    }

    private fun reference(id: String, graph: PersonGraph) =
        ReferencePattern(id, graph, Verdict.FORBIDDEN, ReferenceSource(page = 42, conclusion = id))
}
