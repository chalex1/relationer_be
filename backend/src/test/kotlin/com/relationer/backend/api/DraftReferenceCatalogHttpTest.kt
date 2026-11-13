package com.relationer.backend.api

import com.fasterxml.jackson.databind.ObjectMapper
import com.relationer.backend.domain.*
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.client.TestRestTemplate
import org.springframework.core.io.ClassPathResource
import java.io.ByteArrayInputStream
import javax.imageio.ImageIO
import kotlin.test.*

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class DraftReferenceCatalogHttpTest {
    @Autowired lateinit var http: TestRestTemplate
    @Autowired lateinit var json: ObjectMapper
    @Autowired lateinit var catalog: ReferenceCatalog

    @Test
    fun `invalid drafts preserve production browsing and search with explicit warning`() {
        val broken = ReferenceCatalog("catalog/malformed.json")
        assertNotNull(broken.draftFailure)
        assertEquals(catalog.production.size, broken.entries.size)
        val service = ReferenceCatalogService(broken)
        assertEquals(catalog.production.size, service.listReferences("production", null, null, null, null).body!!.size)
        val error = assertFailsWith<org.springframework.web.server.ResponseStatusException> {
            service.listReferences("draft", null, null, null, null)
        }
        assertEquals(503, error.statusCode.value())
        val request = service.getReference("blood-01").body!!.graph
        val result = ReferenceSearchService(SearchApiMapper(service), broken).search(request)
        assertTrue(result.matches.isNotEmpty())
        assertTrue(result.matches.all { match -> catalog.production.any { it.pattern.id == match.referenceId } })
        assertTrue(result.catalogWarning.orEmpty().isNotBlank())
    }

    @Test
    fun `reviewed cases are promoted and only pending cases remain in drafts`() {
        assertEquals(25, catalog.drafts.size)
        assertEquals(69, catalog.production.size)
        assertEquals(94, catalog.entries.size)
        val promotedIds = json.readTree(ClassPathResource("catalog/promoted-ids.json").inputStream).map { it.asText() }.toSet()
        assertEquals(promotedIds, catalog.production.map { it.pattern.id }.toSet())
        assertTrue(catalog.production.all { it.reviewStatus == GraphReviewStatus.REVIEWED })
        assertTrue(catalog.drafts.none { it.pattern.id in promotedIds })
        assertTrue(catalog.drafts.all { it.reviewStatus == GraphReviewStatus.DRAFT && it.sources.size == 1 })
        for ((query, size) in listOf("" to 94, "?catalog=draft" to 25, "?catalog=production" to 69)) {
            val response = http.getForEntity("/api/v1/references$query", String::class.java)
            assertEquals(200, response.statusCode.value())
            assertEquals(size, json.readTree(response.body).size())
        }
    }

    @Test
    fun `every graph source review status and PNG is readable by id`() {
        catalog.all.forEach { entry ->
            val id = entry.pattern.id
            val detail = json.readTree(http.getForObject("/api/v1/references/$id", String::class.java))
            assertEquals(id, detail["metadata"]["id"].asText())
            assertEquals(entry.reviewStatus.name, detail["metadata"]["reviewStatus"].asText())
            assertEquals(entry.sources.first().verdict.name, detail["metadata"]["sources"][0]["verdict"].asText())
            assertEquals(entry.pattern.graph.personA.id, detail["graph"]["personA"].asText())
            assertEquals(entry.pattern.graph.personB.id, detail["graph"]["personB"].asText())
            val image = http.getForEntity("/api/v1/references/$id/image", ByteArray::class.java)
            assertEquals(200, image.statusCode.value())
            assertEquals("image/png", image.headers.contentType?.toString())
            val expected = ClassPathResource("reference-catalog/${entry.sources.first().reference.image}").inputStream.use { it.readBytes() }
            assertContentEquals(expected, image.body)
            val decoded = ImageIO.read(ByteArrayInputStream(image.body!!))
            assertNotNull(decoded, id); assertTrue(decoded.width > 0 && decoded.height > 0, id)
        }
    }

    @Test
    fun `draft graphs participate in search and duplicate IDs are returned once per path`() {
        val draft = catalog.drafts.first { it.pattern.id !in catalog.production.map { e -> e.pattern.id } }
        val detail = json.readTree(http.getForObject("/api/v1/references/${draft.pattern.id}", String::class.java))
        val response = http.postForEntity("/api/v1/references/search", detail["graph"], String::class.java)
        assertEquals(200, response.statusCode.value())
        val matches = json.readTree(response.body)["matches"]
        assertTrue(matches.any { it["referenceId"].asText() == draft.pattern.id })
        assertEquals(matches.size(), matches.map { listOf(it["referenceId"], it["userPathCode"], it["referencePathCode"]) }.toSet().size)
        assertTrue(matches.all { match ->
            match["reviewStatus"].asText() == catalog.all.single { it.pattern.id == match["referenceId"].asText() }.reviewStatus.name && match["sources"].size() == 1
        })
    }

    @Test
    fun `list filters search and sorting operate over catalog metadata`() {
        val filtered = json.readTree(http.getForObject("/api/v1/references?catalog=draft&category=ADOPTION&reviewStatus=DRAFT&sort=-id", String::class.java))
        assertTrue(filtered.size() > 0)
        assertTrue(filtered.all { node -> node["categories"].any { it.asText() == "ADOPTION" } })
        val ids = filtered.map { it["id"].asText() }
        assertEquals(ids.sortedDescending(), ids)
        val first = catalog.drafts.first { it.pattern.id !in catalog.production.map { e -> e.pattern.id } }
        val byId = json.readTree(http.getForObject("/api/v1/references?search=${first.pattern.id}", String::class.java))
        assertTrue(byId.any { it["id"].asText() == first.pattern.id })
        val reviewed = json.readTree(http.getForObject("/api/v1/references?reviewStatus=REVIEWED", String::class.java))
        assertEquals(69, reviewed.size())
        for (query in listOf("catalog=bad", "category=MIXED", "reviewStatus=APPROVED", "sort=bad"))
            assertEquals(400, http.getForEntity("/api/v1/references?$query", String::class.java).statusCode.value())
    }

    @Test
    fun `missing sources images and reserved old draft endpoint are not mistaken for case ids`() {
        for (path in listOf("/unknown/image", "/blood-01/image?sourceId=missing", "/drafts"))
            assertEquals(404, http.getForEntity("/api/v1/references$path", String::class.java).statusCode.value())
    }
}
