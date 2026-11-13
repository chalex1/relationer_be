package com.relationer.backend.domain

import com.fasterxml.jackson.databind.ObjectMapper
import com.relationer.backend.api.ReferenceCatalog
import java.nio.file.Files
import java.nio.file.Path
import kotlin.random.Random
import kotlin.test.*

/** Characterization tests document today's semantics; they do not approve historical conclusions. */
class CatalogSearchAuditTest {
    private val catalog = ReferenceCatalog().entries
    private val extractor = PathExtractor()
    private val encoder = PathEncoder()
    private val search = ReferenceSearch()
    private val matcher = PathMatcher()
    private val inverse = mapOf("B>" to "<B", "<B" to "B>", "G>" to "<G", "<G" to "G>", "U>" to "<U", "<U" to "U>", "M" to "M")

    private fun ref(id: String) = catalog.single { it.id == id }
    private fun code(graph: PersonGraph) = extractor.extractForSearch(graph).map(encoder::encode)
    private fun reversed(graph: PersonGraph) = graph.copy(personA = graph.personB, personB = graph.personA)
    private fun normalized(code: String) = minOf(code, reversePath(code))
    private fun occurrences(graph: PersonGraph, reverse: Boolean = false) = extractor.extractForSearch(graph).map {
        (if (reverse) it.persons.reversed() else it.persons).map { p -> p.id } to
            (if (reverse) reversePath(encoder.encode(it)) else encoder.encode(it))
    }.groupingBy { it }.eachCount()
    private fun matches(graph: PersonGraph, refs: List<ReferencePattern> = catalog) = search.search(graph, refs).map {
        listOf(it.referencePattern.id, it.verdict.name, normalized(it.userPathCode), normalized(it.referencePathCode))
    }.groupingBy { it }.eachCount()

    private fun shuffled(graph: PersonGraph, seed: Int): PersonGraph {
        val random = Random(seed)
        val byId = graph.persons.associate { it.id to Person(it.id, it.name) }
        for (original in graph.persons.shuffled(random)) {
            val p = byId.getValue(original.id)
            original.children.shuffled(random).forEach { p.children += byId.getValue(it.id) }
            original.godchildren.shuffled(random).forEach { p.godchildren += byId.getValue(it.id) }
            original.adoptedChildren.shuffled(random).forEach { p.adoptedChildren += byId.getValue(it.id) }
            original.spouses.shuffled(random).forEach { spouse ->
                // Marriage storage direction is immaterial.
                if (seed % 2 == 0) byId.getValue(spouse.id).spouses += p else p.spouses += byId.getValue(spouse.id)
            }
        }
        return PersonGraph(byId.values.shuffled(random), byId.getValue(graph.personA.id), byId.getValue(graph.personB.id))
    }

    @Test
    fun `all 94 cases match themselves in both directions with token oracle and no lost paths`() {
        assertEquals(94, catalog.size)
        val rows = catalog.map { reference ->
            val graph = reference.graph
            assertTrue(graph.validate().isEmpty(), reference.id)
            val raw = extractor.extract(graph)
            val paths = extractor.extractForSearch(graph)
            assertTrue(paths.isNotEmpty(), reference.id)
            assertEquals(occurrences(graph), occurrences(reversed(graph), reverse = true), reference.id)
            assertTrue(paths.all { it.persons.toSet().size == it.persons.size }, reference.id)
            val forward = search.search(graph, catalog)
            assertTrue(forward.any { it.referencePattern.id == reference.id && it.userPathCode == it.referencePathCode }, reference.id)
            assertEquals(matches(graph), matches(reversed(graph)), reference.id)
            for (candidate in catalog) {
                val expected = paths.any { user -> extractor.extractForSearch(candidate.graph).any { target ->
                    tokenMatch(user.transitions.map { it.token }, target.transitions.map { it.token }, candidate.verdict)
                } }
                assertEquals(expected, forward.any { it.referencePattern.id == candidate.id }, "${reference.id} -> ${candidate.id}")
            }
            mapOf("id" to reference.id, "rawPaths" to raw.map(encoder::encode), "searchPaths" to paths.map(encoder::encode),
                "matches" to forward.map { mapOf("referenceId" to it.referencePattern.id, "verdict" to it.verdict.name,
                    "userPath" to it.userPathCode, "referencePath" to it.referencePathCode) })
        }
        val output = Path.of("build/reports/catalog-audit/search-matrix.json")
        Files.createDirectories(output.parent)
        ObjectMapper().writerWithDefaultPrettyPrinter().writeValue(output.toFile(), rows)
    }

    @Test
    fun `all catalog searches preserve occurrence counts across seeded graph and catalog permutations`() {
        val referenceOrders = (0..3).map { seed -> catalog.map { it.copy(graph = shuffled(it.graph, seed)) }.shuffled(Random(seed)) }
        for (reference in catalog) {
            val expected = matches(reference.graph)
            for ((seed, references) in referenceOrders.withIndex()) {
                val graph = shuffled(reference.graph, seed)
                assertEquals(occurrences(reference.graph), occurrences(graph), "paths ${reference.id} seed=$seed")
                assertEquals(expected, matches(graph, references), "matches ${reference.id} seed=$seed")
            }
        }
    }

    private fun tokenMatch(user: List<String>, reference: List<String>, verdict: Verdict): Boolean {
        val (container, fragment) = if (verdict == Verdict.ALLOWED) user to reference else reference to user
        val reverse = fragment.reversed().map { inverse.getValue(it) }
        return container.windowed(fragment.size).any { it == fragment || it == reverse }
    }

    @Test
    fun `contains agrees with whole token oracle for every pair up to three transitions`() {
        val tokens = inverse.keys.toList()
        val one = tokens.map { listOf(it) }
        val two = one.flatMap { a -> tokens.map { a + it } }
        val three = two.flatMap { a -> tokens.map { a + it } }
        val sequences = one + two + three
        for (u in sequences) for (r in sequences) for (verdict in Verdict.entries) {
            assertEquals(tokenMatch(u, r, verdict), matcher.matches(u.joinToString(""), r.joinToString(""), verdict),
                "user=$u reference=$r verdict=$verdict")
        }
    }

    @Test
    fun `known exact path conflicts are preserved rather than resolved by first match`() {
        for ((left, right) in listOf("affinity-allowed-07" to "affinity-forbidden-15")) {
            assertEquals(code(ref(left).graph).map(::normalized), code(ref(right).graph).map(::normalized))
            val result = search.search(ref(left).graph, listOf(ref(left), ref(right)))
            assertEquals(setOf(Verdict.ALLOWED, Verdict.FORBIDDEN), result.map { it.verdict }.toSet(), left)
            assertEquals(result.map { it.referencePattern.id }.toSet(), search.search(ref(left).graph, listOf(ref(right), ref(left))).map { it.referencePattern.id }.toSet())
        }
    }

    @Test
    fun `reviewed allowed participants no longer share the former forbidden path`() {
        for ((left, right) in listOf("affinity-allowed-01" to "affinity-forbidden-24",
            "affinity-allowed-02" to "affinity-forbidden-26", "affinity-allowed-03" to "affinity-forbidden-23")) {
            assertNotEquals(code(ref(left).graph).map(::normalized), code(ref(right).graph).map(::normalized))
            val result = search.search(ref(right).graph, listOf(ref(left), ref(right)))
            assertEquals(listOf(right), result.map { it.referencePattern.id }, left)
        }
    }

    @Test
    fun `catalog order changes presentation order but never removes a matching source`() {
        val first = ref("spiritual-forbidden-01")
        val second = ref("appendix-spiritual-forbidden-01")
        val forward = search.search(first.graph, listOf(first, second)).map { it.referencePattern.id }
        val reordered = search.search(first.graph, listOf(second, first)).map { it.referencePattern.id }
        assertEquals(listOf(first.id, second.id), forward)
        assertEquals(forward.reversed(), reordered)
        assertEquals(forward.toSet(), reordered.toSet())
    }

    @Test
    fun `short forbidden fragment and longer allowed context are current semantics not exact graph equality`() {
        assertTrue(matcher.matches("B>", "<BB>", Verdict.FORBIDDEN), "blood-01 appears for a parent-child input")
        assertTrue(matcher.matches("M<BB>B>", "M<BB>B>", Verdict.ALLOWED), "synthetic exact allowed path")
        assertFalse(matcher.matches("M<BB>B>", "M<BB>", Verdict.FORBIDDEN), "affinity-forbidden-22 is not inherited by a longer user path")
        assertTrue(matcher.matches("M<BB>B>", "M<BB>", Verdict.ALLOWED), "first-source verdict changes inclusion direction")
        val allowed = code(ref("blood-13").graph).single()
        assertTrue(matcher.matches(allowed + "M", allowed, Verdict.ALLOWED), "appended spouse changes endpoints but retains allowed match")
        assertFalse(matcher.matches(allowed + "M", allowed, Verdict.FORBIDDEN))
        assertTrue(matcher.matches("G>", code(ref("spiritual-undetermined-01").graph).single(), Verdict.UNDETERMINED))
        val originalSelection = ref("affinity-allowed-01").graph.let { graph ->
            graph.copy(personA = graph.persons.single { it.id == "petr" })
        }
        assertEquals(matches(originalSelection), matches(ref("affinity-forbidden-24").graph),
            "Different off-path branches are invisible to current path matching")
    }

    private fun chain(path: String): PersonGraph {
        val tokens = Regex("B>|<B|G>|<G|U>|<U|M").findAll(path).map { it.value }.toList()
        require(tokens.joinToString("") == path)
        val persons = (0..tokens.size).map { Person("p$it") }
        tokens.forEachIndexed { i, token ->
            val (a, b) = if (token.startsWith("<")) persons[i + 1] to persons[i] else persons[i] to persons[i + 1]
            when (token) {
                "B>", "<B" -> a.children += b
                "G>", "<G" -> a.godchildren += b
                "U>", "<U" -> a.adoptedChildren += b
                "M" -> a.spouses += b
            }
        }
        return PersonGraph(persons, persons.first(), persons.last())
    }

    @Test
    fun `connected absence and short probes reproduce actual catalog inclusion without overall verdict`() {
        val probes = listOf("B>", "M", "G>", "U>", "MMMM", "M<BB>B>", code(ref("blood-13").graph).single() + "M")
        val rows = probes.map { input ->
            val graph = chain(input)
            assertEquals(listOf(input), code(graph))
            val hits = search.search(graph, catalog)
            when (input) {
                "B>" -> assertTrue(hits.any { it.referencePattern.id == "blood-01" })
                "M" -> assertTrue(hits.any { it.referencePattern.id == "adoption-forbidden-01" })
                "G>" -> assertTrue(hits.any { it.referencePattern.id == "spiritual-undetermined-01" && it.verdict == Verdict.UNDETERMINED })
                "U>" -> assertTrue(hits.any { it.referencePattern.id == "adoption-forbidden-01" })
                "MMMM" -> assertTrue(hits.isEmpty())
            }
            mapOf("input" to input, "matches" to hits.map { mapOf("id" to it.referencePattern.id,
                "verdict" to it.verdict.name, "referencePath" to it.referencePathCode) })
        }
        val output = Path.of("build/reports/catalog-audit/probes.json")
        Files.createDirectories(output.parent)
        ObjectMapper().writerWithDefaultPrettyPrinter().writeValue(output.toFile(), rows)
    }

    @Test
    fun `extending every catalog path retains allowed patterns but rejects shorter forbidden and unknown patterns`() {
        for (reference in catalog) for (path in code(reference.graph)) for (token in inverse.keys) {
            for (extended in listOf(path + token, token + path)) {
                assertEquals(reference.verdict == Verdict.ALLOWED, matcher.matches(extended, path, reference.verdict),
                    "${reference.id} input=$extended")
            }
        }
    }

    private fun twoParents(): PersonGraph {
        val a = Person("a"); val b = Person("b")
        val p = Person("p", children = mutableListOf(a, b))
        val q = Person("q", children = mutableListOf(a, b), spouses = mutableListOf(p))
        return PersonGraph(listOf(a, b, p, q), a, b)
    }

    @Test
    fun `several paths and equal codes preserve occurrences even when wire tuples coincide`() {
        val graph = twoParents()
        assertEquals(4, extractor.extract(graph).size)
        assertEquals(listOf("<BB>", "<BB>"), code(graph))
        val references = listOf(ref("blood-01"), ref("blood-01").copy(id = "audit-two-parents", graph = twoParents()))
        val result = search.search(graph, references)
        assertEquals(2, result.count { it.referencePattern.id == "blood-01" })
        assertEquals(4, result.count { it.referencePattern.id == "audit-two-parents" })
        assertEquals(2, result.map { listOf(it.referencePattern.id, it.userPathCode, it.referencePathCode) }.toSet().size)
        val expected = matches(graph, references)
        for (seed in 0..9) {
            val reordered = shuffled(graph, seed)
            assertEquals(occurrences(graph), occurrences(reordered))
            assertEquals(expected, matches(reordered, references.map { it.copy(graph = shuffled(it.graph, seed)) }.shuffled(Random(seed))))
        }
    }

    @Test
    fun `all relationship kinds retain direction and disconnected input returns no matches`() {
        val a = Person("a"); val b = Person("b"); val c = Person("c"); val d = Person("d"); val e = Person("e")
        a.children += b; b.spouses += c; c.godchildren += d; d.adoptedChildren += e
        val graph = PersonGraph(listOf(a, b, c, d, e), a, e)
        assertEquals(listOf("B>MG>U>"), code(graph))
        assertEquals(listOf("<U<GM<B"), code(reversed(graph)))
        val x = Person("x"); val y = Person("y")
        assertTrue(search.search(PersonGraph(listOf(x, y), x, y), catalog).isEmpty())
    }
}
