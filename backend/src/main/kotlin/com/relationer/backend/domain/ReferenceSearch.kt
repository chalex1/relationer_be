package com.relationer.backend.domain

/**
 * Поиск совпадений пользовательского графа со справочником.
 *
 * Извлекает и кодирует пути между A и B, сопоставляет их
 * со справочными путями и возвращает найденные случаи.
 *
 * Не вычисляет общий вердикт: противоречащие результаты
 * возвращаются отдельно.
 */
class ReferenceSearch(
    private val extractor: PathExtractor = PathExtractor(),
    private val encoder: PathEncoder = PathEncoder(),
    private val matcher: PathMatcher = PathMatcher(),
) {
    fun search(
        userGraph: PersonGraph,
        references: Collection<ReferencePattern>,
    ): List<ReferenceMatch> {
        val userPaths = encodePaths(userGraph, "User graph")
        val referencePaths = references.map { reference ->
            reference to encodePaths(reference.graph, "Reference ${reference.id}")
        }
        val matches = linkedSetOf<ReferenceMatch>()

        for ((userPath, userCode) in userPaths) {
            for ((reference, paths) in referencePaths) {
                for ((referencePath, referenceCode) in paths) {
                    if (matcher.matches(userCode, referenceCode, reference.verdict)) {
                        matches += ReferenceMatch(
                            referencePattern = reference,
                            userPath = userPath,
                            userPathCode = userCode,
                            referencePath = referencePath,
                            referencePathCode = referenceCode,
                        )
                    }
                }
            }
        }

        return matches.toList()
    }

    private fun encodePaths(graph: PersonGraph, context: String): List<Pair<PersonPath, String>> {
        val errors = graph.validate()
        require(errors.isEmpty()) { "$context is invalid: ${errors.joinToString("; ")}" }
        return extractor.extractForSearch(graph).map { path ->
            val code = encoder.encode(path)
            require(code.isNotEmpty()) { "$context contains an empty path; select two different persons" }
            path to code
        }
    }
}
