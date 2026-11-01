package com.relationer.backend.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class DomainModelTest {
    @Test
    fun `creates father to son graph`() {
        val father = Person("father")
        val son = Person("son")
        father.children += son

        val graph = PersonGraph(listOf(father, son), father, son)

        assertTrue(graph.validate().isEmpty())
        assertTrue(father.children.single() === son)
    }

    @Test
    fun `same son can be child and godchild once in persons`() {
        val father = Person("father")
        val son = Person("son")
        father.children += son
        father.godchildren += son

        val graph = PersonGraph(listOf(father, son), father, son)

        assertTrue(graph.validate().isEmpty())
        assertEquals(2, father.children.size + father.godchildren.size)
        assertEquals(2, graph.persons.size)
    }

    @Test
    fun `reference outside persons fails validation`() {
        val father = Person("father")
        val son = Person("son")
        father.children += son

        val graph = PersonGraph(listOf(father), father, father)

        assertTrue(graph.validate().any { it.contains("not in persons") })
    }

    @Test
    fun `duplicate ids fail validation`() {
        val first = Person("same")
        val second = Person("same")

        val graph = PersonGraph(listOf(first, second), first, second)

        assertTrue(graph.validate().any { it.contains("Duplicate person id") })
    }

    @Test
    fun `reference pattern keeps target pair verdict and source`() {
        val a = Person("a")
        val b = Person("b")
        val pattern = ReferencePattern(
            id = "case-1",
            graph = PersonGraph(listOf(a, b), a, b),
            verdict = Verdict.FORBIDDEN,
            source = ReferenceSource(page = 42, conclusion = "Запрещено"),
        )

        assertEquals(a, pattern.graph.personA)
        assertEquals(b, pattern.graph.personB)
        assertEquals(Verdict.FORBIDDEN, pattern.verdict)
        assertEquals(42, pattern.source.page)
    }

    @Test
    fun `verdict enum order is forbidden undetermined allowed`() {
        assertEquals(
            listOf(Verdict.FORBIDDEN, Verdict.UNDETERMINED, Verdict.ALLOWED),
            Verdict.entries.sorted(),
        )
        assertFalse(Verdict.FORBIDDEN > Verdict.UNDETERMINED)
    }
}
