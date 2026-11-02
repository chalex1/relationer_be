package com.relationer.backend.domain

enum class PathTransition(val token: String) {
    BIOLOGICAL_PARENT_TO_CHILD("B>"),
    BIOLOGICAL_CHILD_TO_PARENT("<B"),
    GODPARENT_TO_GODCHILD("G>"),
    GODCHILD_TO_GODPARENT("<G"),
    ADOPTER_TO_ADOPTED("U>"),
    ADOPTED_TO_ADOPTER("<U"),
    MARRIAGE("M"),
}

data class PersonPath(
    val persons: List<Person>,
    val transitions: List<PathTransition>,
) {
    init {
        require(persons.isNotEmpty()) { "A path must contain at least one person" }
        require(transitions.size == persons.size - 1) {
            "A path must have exactly one transition between consecutive persons"
        }
    }
}
