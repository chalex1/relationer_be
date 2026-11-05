package com.relationer.backend.domain

import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import org.junit.jupiter.params.provider.EnumSource
import org.junit.jupiter.params.provider.ValueSource
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PathMatcherTest {
    private val matcher = PathMatcher()

    @ParameterizedTest
    @CsvSource("B>, <B", "<B, B>", "G>, <G", "<G, G>", "U>, <U", "<U, U>", "M, M")
    fun `reverses all seven tokens`(path: String, expected: String) {
        assertEquals(expected, reversePath(path))
    }

    @ParameterizedTest
    @CsvSource("G>M<U, U>M<G", "<BM, MB>", "<BMB>, <BMB>", "B>G>U>M, M<U<G<B")
    fun `reverses complex paths`(path: String, expected: String) {
        assertEquals(expected, reversePath(path))
    }

    @ParameterizedTest
    @ValueSource(strings = ["B>", "<B", "G>", "<G", "U>", "<U", "M", "<BB>", "G>M<U", "<BMB>G><UM"])
    fun `double reverse restores original path`(path: String) {
        assertEquals(path, reversePath(reversePath(path)))
    }

    @Test
    fun `siblings path is symmetric`() {
        assertEquals("<BB>", reversePath("<BB>"))
    }

    @ParameterizedTest
    @CsvSource(
        "<BB>, <BB>, true",
        "<BB>M<B, <BB>, true",
        "M<BB>G>, <BB>, true",
        "G>M<BB>, <BB>, true",
        "<BB>, <BB>M, false",
        "G>MB>U>, <BM, true",
    )
    fun `allowed contains reference in user path`(user: String, reference: String, expected: Boolean) {
        assertEquals(expected, matcher.matches(user, reference, Verdict.ALLOWED))
    }

    @ParameterizedTest
    @CsvSource(
        "<BB>, <BB>, true",
        "<BB>, <BB>M, true",
        "<BB>, G><BB>M, true",
        "<BB>, G>M<BB>, true",
        "<BB>M, <BB>, false",
        "<BM, G>MB>U>, true",
    )
    fun `forbidden contains user in reference path`(user: String, reference: String, expected: Boolean) {
        assertEquals(expected, matcher.matches(user, reference, Verdict.FORBIDDEN))
    }

    @ParameterizedTest
    @CsvSource(
        "<BB>, <BB>, true",
        "<BB>, <BB>M, true",
        "<BB>, G><BB>M, true",
        "<BB>, G>M<BB>, true",
        "<BB>M, <BB>, false",
        "<BM, G>MB>U>, true",
    )
    fun `undetermined contains user in reference path`(user: String, reference: String, expected: Boolean) {
        assertEquals(expected, matcher.matches(user, reference, Verdict.UNDETERMINED))
    }

    @ParameterizedTest
    @EnumSource(Verdict::class)
    fun `different relation types do not match`(verdict: Verdict) {
        assertFalse(matcher.matches("B>", "U>", verdict))
        assertFalse(matcher.matches("B>", "G>", verdict))
    }

    @ParameterizedTest
    @EnumSource(Verdict::class)
    fun `matching cannot skip transitions`(verdict: Verdict) {
        val container = "B>MG>"
        val fragment = "B>G>"
        val (user, reference) = if (verdict == Verdict.ALLOWED) container to fragment else fragment to container
        assertFalse(matcher.matches(user, reference, verdict))
    }

    @ParameterizedTest
    @EnumSource(Verdict::class)
    fun `rejects empty paths on either side`(verdict: Verdict) {
        assertFailsWith<IllegalArgumentException> { matcher.matches("", "B>", verdict) }
        assertFailsWith<IllegalArgumentException> { matcher.matches("B>", "", verdict) }
        assertFailsWith<IllegalArgumentException> { matcher.matches("", "", verdict) }
    }

    @ParameterizedTest
    @ValueSource(strings = ["B", ">B", "B<", "<B>", "G", "U", "X>", "b>", "<g", "u>", "m", "B> M", "B>\n", "B>>", "<", " "])
    fun `rejects invalid tokens including lowercase and whitespace`(invalid: String) {
        for (verdict in Verdict.entries) {
            val userError = assertFailsWith<IllegalArgumentException> { matcher.matches(invalid, "B>", verdict) }
            val referenceError = assertFailsWith<IllegalArgumentException> { matcher.matches("B>", invalid, verdict) }
            assertTrue(userError.message.orEmpty().contains("userPath"))
            assertTrue(referenceError.message.orEmpty().contains("referencePath"))
        }
    }

    @Test
    fun `accepts a sequence containing every token`() {
        val path = "B><BG><GU><UM"
        assertTrue(matcher.matches(path, path, Verdict.ALLOWED))
    }
}
