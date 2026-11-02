package com.relationer.backend.domain

import java.util.Collections
import java.util.IdentityHashMap

class PathExtractor {
    fun extract(graph: PersonGraph): List<PersonPath> {
        if (graph.personA === graph.personB) {
            return listOf(PersonPath(listOf(graph.personA), emptyList()))
        }

        val results = mutableListOf<PersonPath>()
        val persons = graph.persons
        val currentPersons = mutableListOf(graph.personA)
        val currentTransitions = mutableListOf<PathTransition>()
        val visited = Collections.newSetFromMap(IdentityHashMap<Person, Boolean>())
        visited += graph.personA

        fun dfs(current: Person) {
            if (current === graph.personB) {
                results += PersonPath(currentPersons.toList(), currentTransitions.toList())
                return
            }

            for ((next, transition) in neighbors(current, persons)) {
                if (!visited.add(next)) continue
                currentPersons += next
                currentTransitions += transition
                dfs(next)
                currentTransitions.removeAt(currentTransitions.lastIndex)
                currentPersons.removeAt(currentPersons.lastIndex)
                visited.remove(next)
            }
        }

        dfs(graph.personA)
        return results
    }

    private fun neighbors(current: Person, persons: List<Person>): List<Pair<Person, PathTransition>> {
        val result = mutableListOf<Pair<Person, PathTransition>>()
        val seen = IdentityHashMap<Person, MutableSet<PathTransition>>()

        fun add(person: Person, transition: PathTransition) {
            val transitions = seen[person] ?: mutableSetOf<PathTransition>().also { seen[person] = it }
            if (transitions.add(transition)) result += person to transition
        }

        current.children.forEach { add(it, PathTransition.BIOLOGICAL_PARENT_TO_CHILD) }
        current.godchildren.forEach { add(it, PathTransition.GODPARENT_TO_GODCHILD) }
        current.adoptedChildren.forEach { add(it, PathTransition.ADOPTER_TO_ADOPTED) }
        current.spouses.forEach { add(it, PathTransition.MARRIAGE) }

        persons.forEach { owner ->
            if (owner.children.any { it === current }) add(owner, PathTransition.BIOLOGICAL_CHILD_TO_PARENT)
            if (owner.godchildren.any { it === current }) add(owner, PathTransition.GODCHILD_TO_GODPARENT)
            if (owner.adoptedChildren.any { it === current }) add(owner, PathTransition.ADOPTED_TO_ADOPTER)
            if (owner.spouses.any { it === current }) add(owner, PathTransition.MARRIAGE)
        }
        return result
    }
}
