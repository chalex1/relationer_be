package com.relationer.backend.domain

class PathEncoder {
    fun encode(path: PersonPath): String = path.transitions.joinToString(separator = "") { it.token }
}
