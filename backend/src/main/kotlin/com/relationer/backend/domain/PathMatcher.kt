package com.relationer.backend.domain

fun reversePath(path: String): String =
    path.reversed().map { char ->
        when (char) {
            '<' -> '>'
            '>' -> '<'
            else -> char
        }
    }.joinToString("")

class PathMatcher {
    private val validPath = Regex("(?:B>|<B|G>|<G|U>|<U|M)+")

    fun matches(userPath: String, referencePath: String, verdict: Verdict): Boolean {
        require(validPath.matches(userPath)) {
            "userPath must be non-empty and contain only B>, <B, G>, <G, U>, <U or M tokens"
        }
        require(validPath.matches(referencePath)) {
            "referencePath must be non-empty and contain only B>, <B, G>, <G, U>, <U or M tokens"
        }

        val (container, fragment) = when (verdict) {
            Verdict.ALLOWED -> userPath to referencePath
            Verdict.FORBIDDEN, Verdict.UNDETERMINED -> referencePath to userPath
        }

        return container.contains(fragment) || container.contains(reversePath(fragment))
    }
}
