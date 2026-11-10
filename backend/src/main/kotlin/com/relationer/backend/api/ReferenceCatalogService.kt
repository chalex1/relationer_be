package com.relationer.backend.api

import com.relationer.backend.api.generated.model.*
import com.relationer.backend.domain.ReferenceCatalogEntry
import com.relationer.backend.domain.ReferencePattern
import com.relationer.backend.domain.GraphReviewStatus
import com.relationer.backend.domain.RelationCategory as DomainCategory
import org.springframework.core.io.ClassPathResource
import org.springframework.core.io.Resource
import org.springframework.http.ResponseEntity
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException
import org.springframework.http.HttpStatus
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

@Service
class ReferenceCatalogService(private val catalog: ReferenceCatalog) {
    private val imageVersions by lazy {
        catalog.all.flatMap { it.sources }.mapNotNull { it.reference.image }.distinct().associateWith { path ->
            val resource = ClassPathResource("reference-catalog/$path")
            if (Regex("images/[A-Za-z0-9][A-Za-z0-9._-]*\\.png").matches(path) && resource.exists()) resource.inputStream.use { input ->
                java.security.MessageDigest.getInstance("SHA-256").digest(input.readBytes()).joinToString("") { "%02x".format(it) }
            } else "missing"
        }
    }
    fun listReferences(origin: String?, category: String?, reviewStatus: String?, search: String?, sort: String?): ResponseEntity<List<ReferenceSummaryDto>> {
        require(origin == null || origin in setOf("production", "draft")) { "Unknown catalog: $origin" }
        if (origin != "production" && catalog.draftFailure != null)
            throw ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Draft catalog is unavailable")
        require(category == null || DomainCategory.entries.any { it.name == category }) { "Unknown category: $category" }
        require(reviewStatus == null || GraphReviewStatus.entries.any { it.name == reviewStatus }) { "Unknown reviewStatus: $reviewStatus" }
        val query = search?.trim().orEmpty()
        var entries = (when (origin) { "production" -> catalog.production; "draft" -> catalog.drafts; else -> catalog.all }).filter { entry ->
            (category == null || entry.pattern.categories.any { it.name == category }) &&
            (reviewStatus == null || entry.reviewStatus.name == reviewStatus) &&
            (query.isEmpty() || (listOf(entry.pattern.id, entry.title, entry.pattern.description) + entry.pattern.tags +
                entry.sources.flatMap { listOf(it.title, it.reference.example, it.reference.conclusion) }).any { it?.contains(query, ignoreCase = true) == true })
        }
        if (sort != null) {
            val comparator = when (sort.removePrefix("-")) {
                "id" -> compareBy<ReferenceCatalogEntry> { it.pattern.id }
                "title" -> compareBy { it.title.lowercase(java.util.Locale.ROOT) }
                "page" -> compareBy { it.sources.first().reference.page ?: Int.MAX_VALUE }
                else -> throw IllegalArgumentException("Unknown sort: $sort")
            }.thenBy { it.pattern.id }
            entries = entries.sortedWith(if (sort.startsWith("-")) comparator.reversed() else comparator)
        }
        return ResponseEntity.ok(entries.map(::summary))
    }

    fun find(id: String): ReferenceCatalogEntry = catalog.all.find { it.pattern.id == id }
        ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown reference id: $id")

    fun getReference(id: String) = ResponseEntity.ok(detail(find(id)))

    fun getImage(id: String, sourceId: String?): ResponseEntity<Resource> {
        val entry = find(id)
        val source = if (sourceId == null) entry.sources.first() else entry.sources.find { it.id == sourceId }
        val image = source?.reference?.image
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Image not available")
        // Resolve only catalog-owned resources, never a URL or arbitrary filesystem path.
        if (!Regex("images/[A-Za-z0-9][A-Za-z0-9._-]*\\.png").matches(image))
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Image not available")
        val resource = ClassPathResource("reference-catalog/$image")
        if (!resource.exists()) throw ResponseStatusException(HttpStatus.NOT_FOUND, "Image not available")
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(resource)
    }

    private fun imageUrl(entry: ReferenceCatalogEntry, sourceId: String): String {
        val image = entry.sources.first { it.id == sourceId }.reference.image
        return "/api/v1/references/${encode(entry.pattern.id)}/image?sourceId=${encode(sourceId)}&v=${imageVersions[image]}"
    }
    private fun encode(value: String) = URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20")

    fun summary(entry: ReferenceCatalogEntry): ReferenceSummaryDto {
        val reference = entry.pattern
        val sources = entry.sources.map { source -> CatalogSourceDto(
            id = source.id, title = source.title, verdict = VerdictDto.valueOf(source.verdict.name),
            page = source.reference.page, conclusion = source.reference.conclusion, example = source.reference.example,
            conclusionConfirmed = source.conclusionConfirmed,
            image = source.reference.image?.let { imageUrl(entry, source.id) },
        ) }
        val primary = sources.first()
        return ReferenceSummaryDto(
            id = reference.id, title = entry.title, reviewStatus = GraphReviewStatusDto.valueOf(entry.reviewStatus.name),
            catalog = if (catalog.production.any { it.pattern.id == reference.id }) "production" else "draft", sources = sources,
            categories = reference.categories.map { RelationCategory.valueOf(it.name) }.toSet(), tags = reference.tags,
            verdict = primary.verdict, source = SourceDto(primary.title, primary.page, primary.example, primary.conclusion, primary.image),
            hasImage = primary.image != null, description = reference.description,
        )
    }

    fun detail(entry: ReferenceCatalogEntry): ReferenceDetailDto {
        val graph = entry.pattern.graph
        val relations = graph.persons.flatMap { person ->
            listOf(RelationType.BIOLOGICAL to person.children, RelationType.MARRIAGE to person.spouses,
                RelationType.SPIRITUAL to person.godchildren, RelationType.ADOPTION to person.adoptedChildren)
                .flatMap { (type, targets) -> targets.map { RelationDto(type, person.id, it.id) } }
        }
        return ReferenceDetailDto(summary(entry), SearchRequest(
            graph.persons.map { PersonDto(it.id, it.name) }, relations, graph.personA.id, graph.personB.id,
        ))
    }
}
