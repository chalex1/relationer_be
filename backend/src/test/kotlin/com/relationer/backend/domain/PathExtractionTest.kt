package com.relationer.backend.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PathExtractionTest {
    private val extractor = PathExtractor()
    private val encoder = PathEncoder()

    @Test
    fun `T01 biological parent to child`() {
        val (parent, child) = Person("A") to Person("B")
        parent.children += child

        assertCodes(parent, child, parent, child, "B>")
    }

    @Test
    fun `T02 biological child to parent`() {
        val (parent, child) = Person("P") to Person("A")
        parent.children += child

        assertCodes(child, parent, parent, child, "<B")
    }

    @Test
    fun `T03 brothers through common parent`() {
        val parent = Person("P")
        val a = Person("A")
        val b = Person("B")
        parent.children += a
        parent.children += b

        assertCodes(a, b, parent, a, b, "<BB>")
    }

    @Test
    fun `T04 godparent to godchild`() {
        val godparent = Person("G")
        val godchild = Person("C")
        godparent.godchildren += godchild

        assertCodes(godparent, godchild, godparent, godchild, "G>")
    }

    @Test
    fun `T05 adopter to adopted`() {
        val adopter = Person("U")
        val adopted = Person("A")
        adopter.adoptedChildren += adopted

        assertCodes(adopter, adopted, adopter, adopted, "U>")
    }

    @Test
    fun `T06 adopted to adopter`() {
        val adopter = Person("U")
        val adopted = Person("A")
        adopter.adoptedChildren += adopted

        assertCodes(adopted, adopter, adopter, adopted, "<U")
    }

    @Test
    fun `T07 marriage is symmetric regardless of storage side`() {
        val a = Person("A")
        val b = Person("B")
        a.spouses += b
        assertCodes(a, b, a, b, "M")

        val c = Person("C")
        val d = Person("D")
        d.spouses += c
        assertCodes(c, d, c, d, "M")
    }

    @Test
    fun `mutual spouse references produce one marriage path`() {
        val a = Person("A")
        val b = Person("B")
        a.spouses += b
        b.spouses += a

        val paths = extractor.extract(graphOf(a, b, a, b))

        assertEquals(1, paths.size)
        assertEquals("M", encoder.encode(paths.single()))
    }

    @Test
    fun `T08 returns multiple paths between one pair`() {
        val a = Person("A")
        val p = Person("P")
        val p1 = Person("P1")
        p.children += a
        p.spouses += p1
        p1.adoptedChildren += a

        val paths = extract(a, p1, a, p, p1, "<BM", "<U")
        assertEquals(listOf("<BM", "<U"), paths.map(encoder::encode).sorted())
    }

    @Test
    fun `T09 returns no paths for disconnected people`() {
        val a = Person("A")
        val b = Person("B")

        assertTrue(extract(a, b, a, b).isEmpty())
    }

    @Test
    fun `T10 cycles terminate and paths do not repeat persons`() {
        val a = Person("A")
        val b = Person("B")
        val c = Person("C")
        a.spouses += b
        b.spouses += c
        c.spouses += a

        val paths = extract(a, c, a, b, c)
        assertTrue(paths.isNotEmpty())
        assertTrue(paths.all { path -> path.persons.distinctBy { System.identityHashCode(it) }.size == path.persons.size })
    }

    @Test
    fun `T11 encodes complex chain`() {
        val people = (0..11).map { Person("P$it") }
        fun spouse(i: Int, j: Int) { people[i].spouses += people[j] }
        fun parent(i: Int, j: Int) { people[i].children += people[j] }

        parent(1, 0)
        spouse(1, 2)
        parent(2, 3)
        spouse(3, 4)
        parent(5, 4)
        spouse(5, 6)
        parent(7, 6)
        spouse(7, 8)
        parent(8, 9)
        spouse(9, 10)
        parent(10, 11)

        val path = extract(people[0], people[11], *people.toTypedArray()).single()
        assertEquals("<BMB>M<BM<BMB>MB>", encoder.encode(path))
        assertEquals(11, path.transitions.size)
        assertEquals(12, path.persons.size)
        assertEquals(12, path.persons.toSet().size)
    }

    @Test
    fun `T12 preserves two paths with identical code`() {
        val a = Person("A")
        val b = Person("B")
        val p1 = Person("P1")
        val p2 = Person("P2")
        p1.children += a
        p1.children += b
        p2.children += a
        p2.children += b

        val paths = extract(a, b, a, p1, p2, b, "<BB>", "<BB>")
        assertEquals(2, paths.size)
        assertEquals(listOf("<BB>", "<BB>"), paths.map(encoder::encode))
        assertTrue(paths[0].persons[1] !== paths[1].persons[1])
    }

    @Test
    fun `T13 preserves two relation types`() {
        val a = Person("A")
        val b = Person("B")
        a.children += b
        a.godchildren += b

        val paths = extract(a, b, a, b, "B>", "G>")
        assertEquals(listOf("B>", "G>"), paths.map(encoder::encode).sorted())
    }

    @Test
    fun `T14 same person produces empty path and encoding`() {
        val a = Person("A")
        val path = extractor.extract(graphOf(a, a, a)).single()

        assertEquals(listOf(a), path.persons)
        assertTrue(path.transitions.isEmpty())
        assertEquals("", encoder.encode(path))
    }

    private fun assertCodes(
        from: Person,
        to: Person,
        vararg expected: Any,
    ) {
        val expectedCode = expected.last() as String
        val graphPersons = expected.dropLast(1).filterIsInstance<Person>()
        val paths = extractor.extract(graphOf(from, to, *graphPersons.toTypedArray()))
        assertEquals(listOf(expectedCode), paths.map(encoder::encode))
    }

    private fun extract(from: Person, to: Person, vararg expected: Any): List<PersonPath> {
        val expectedCodes = expected.filterIsInstance<String>()
        val graphPersons = expected.filterIsInstance<Person>()
        val paths = extractor.extract(graphOf(from, to, *graphPersons.toTypedArray()))
        if (expectedCodes.isNotEmpty()) assertEquals(expectedCodes.sorted(), paths.map(encoder::encode).sorted())
        return paths
    }

    private fun graphOf(from: Person, to: Person, vararg additional: Person): PersonGraph {
        val persons = buildList {
            add(from)
            if (to !== from) add(to)
            additional.forEach { if (none { it === additional }) add(it) }
        }.distinctBy { System.identityHashCode(it) }
        return PersonGraph(persons, from, to)
    }
}
