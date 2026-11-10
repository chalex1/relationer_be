package com.relationer.backend.domain

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.node.ObjectNode

/**
 * Загружает справочные случаи из JSON-ресурса classpath.
 *
 * Восстанавливает связи по ID, проверяет записи и создаёт доменные графы.
 */
class ReferenceCatalogLoader {
    private val mapper = ObjectMapper().enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)

    fun load(resourcePath: String = "reference-catalog/references.json"): List<ReferencePattern> =
        loadEntries(resourcePath).map { it.pattern }

    fun loadEntries(resourcePath: String = "reference-catalog/references.json"): List<ReferenceCatalogEntry> {
        val stream = javaClass.getResourceAsStream("/${resourcePath.removePrefix("/")}")
        requireNotNull(stream) { "Catalog resource not found: $resourcePath" }
        val root = stream.use {
            try {
                mapper.readTree(it)
            } catch (e: java.io.IOException) {
                throw IllegalArgumentException("Invalid JSON in $resourcePath: ${e.message}", e)
            }
        }
        require(root != null && root.isArray) { "Catalog $resourcePath must be a JSON array" }
        val ids = mutableSetOf<String>()
        return root.mapIndexed { index, entry ->
            val label = entry.get("id")?.takeIf { it.isTextual }?.asText() ?: "entry[$index]"
            try {
                val id = entry.text("id")
                require(ids.add(id)) { "Duplicate reference id: $id" }
                catalogEntry(entry, id)
            } catch (e: IllegalArgumentException) {
                throw IllegalArgumentException("Reference $label: ${e.message}", e)
            }
        }
    }

    private fun catalogEntry(entry: JsonNode, id: String): ReferenceCatalogEntry {
        val sourcesNode = entry.get("sources")
        val sources: List<CatalogSource>
        val pattern: ReferencePattern
        if (sourcesNode == null) {
            pattern = parse(entry, id)
            sources = listOf(CatalogSource("legacy-primary", pattern.source.document!!, pattern.verdict, pattern.source))
        } else {
            require(sourcesNode.isArray && sourcesNode.size() > 0) { "sources must be a non-empty array" }
            val sourceIds = mutableSetOf<String>()
            val parsed = sourcesNode.map { source ->
                require(source.isObject) { "sources must contain objects" }
                val sourceId = source.text("id")
                require(sourceIds.add(sourceId)) { "Duplicate source id: $sourceId" }
                val normalized = (entry as ObjectNode).deepCopy()
                val legacySource = source.deepCopy<ObjectNode>()
                legacySource.put("document", source.text("title"))
                normalized.set<JsonNode>("source", legacySource)
                normalized.put("verdict", source.text("verdict"))
                val projection = parse(normalized, id)
                projection to CatalogSource(sourceId, source.text("title"), projection.verdict, projection.source)
            }
            pattern = parsed.first().first
            sources = parsed.map { it.second }
        }
        val status = entry.optionalText("reviewStatus")?.let { value ->
            requireNotNull(GraphReviewStatus.entries.find { it.name == value }) { "Unknown reviewStatus: $value" }
        } ?: GraphReviewStatus.DRAFT
        return ReferenceCatalogEntry(pattern, entry.optionalText("title") ?: pattern.description?.take(120) ?: id, status, sources)
    }

    private fun parse(entry: JsonNode, id: String): ReferencePattern {
        val description = entry.optionalText("description")
        val verdictText = entry.text("verdict")
        val verdict = Verdict.entries.find { it.name == verdictText }
        requireNotNull(verdict) { "Unknown verdict: $verdictText" }
        val source = entry.get("source")
        require(source != null && source.isObject) { "source must be an object" }
        val document = source.text("document")
        val pageNode = source.get("page")
        val page = if (pageNode == null || pageNode.isNull) null else {
            require(pageNode.isIntegralNumber && pageNode.canConvertToInt() && pageNode.intValue() > 0) {
                "source.page must be a positive integer"
            }
            pageNode.intValue()
        }
        val persons = linkedMapOf<String, Person>()
        entry.array("persons").forEach { node ->
            val personId = node.text("id")
            require(personId !in persons) { "Duplicate person id: $personId" }
            persons[personId] = Person(personId, node.optionalText("name"))
        }
        fun person(personId: String): Person = requireNotNull(persons[personId]) {
            "Unknown person id: $personId"
        }
        entry.array("relations").forEach { relation ->
            val from = person(relation.text("from"))
            val to = person(relation.text("to"))
            when (val type = relation.text("type")) {
                "BIOLOGICAL" -> from.children += to
                "MARRIAGE" -> from.spouses += to
                "SPIRITUAL" -> from.godchildren += to
                "ADOPTION", "ADOPTED" -> from.adoptedChildren += to
                else -> throw IllegalArgumentException("Unknown relation type: $type")
            }
        }
        val graph = PersonGraph(persons.values.toList(), person(entry.text("personA")), person(entry.text("personB")))
        val errors = graph.validate()
        require(errors.isEmpty()) { "Invalid graph: ${errors.joinToString("; ")}" }
        require(graph.personA !== graph.personB) { "Invalid graph: personA and personB must be different" }
        return ReferencePattern(
            id, graph, verdict,
            ReferenceSource(page, source.optionalText("conclusion"), document, source.optionalText("example"), source.optionalText("image")),
            description,
            entry.strings("categories").map { value ->
                requireNotNull(RelationCategory.entries.find { it.name == value }) { "Unknown category: $value" }
            }.toSet(),
            entry.strings("tags").map { java.text.Normalizer.normalize(it.trim().lowercase(java.util.Locale.ROOT), java.text.Normalizer.Form.NFC) }.toSet(),
        )
    }

    private fun JsonNode.strings(field: String): Set<String> {
        val value = get(field) ?: return emptySet()
        require(value.isArray) { "$field must be an array" }
        return value.map {
            require(it.isTextual && it.asText().isNotBlank()) { "$field must contain non-blank strings" }
            it.asText()
        }.toSet()
    }

    private fun JsonNode.text(field: String): String {
        val value = get(field)
        require(value != null && value.isTextual && value.asText().isNotBlank()) {
            "$field must be a non-blank string"
        }
        return value.asText()
    }

    private fun JsonNode.optionalText(field: String): String? =
        if (get(field) == null || get(field).isNull) null else text(field)

    private fun JsonNode.array(field: String): JsonNode {
        val value = get(field)
        require(value != null && value.isArray) { "$field must be an array" }
        return value
    }
}
