package com.relationer.backend.domain

data class PersonGraph(
    val persons: List<Person>,
    val personA: Person,
    val personB: Person,
) {
    fun validate(): List<String> {
        val errors = mutableListOf<String>()
        val ids = persons.map { it.id }
        ids.groupingBy { it }.eachCount().filterValues { it > 1 }.keys
            .forEach { errors += "Duplicate person id: $it" }

        if (persons.none { it === personA }) errors += "personA is not in persons"
        if (persons.none { it === personB }) errors += "personB is not in persons"

        persons.forEach { person ->
            sequenceOf(person.children, person.godchildren, person.spouses)
                .flatten()
                .filterNot { referenced -> persons.any { it === referenced } }
                .forEach { errors += "Person ${it.id} referenced by ${person.id} is not in persons" }
        }
        return errors
    }
}
