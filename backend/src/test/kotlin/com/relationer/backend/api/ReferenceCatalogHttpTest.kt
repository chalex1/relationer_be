package com.relationer.backend.api

import com.fasterxml.jackson.databind.ObjectMapper
import com.relationer.backend.domain.*
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.client.TestRestTemplate
import kotlin.test.*

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ReferenceCatalogHttpTest {
    @Autowired lateinit var http: TestRestTemplate
    @Autowired lateinit var json: ObjectMapper

    @Test
    fun `list returns the whole classified catalog without graphs`() {
        val response = http.getForEntity("/api/v1/references", String::class.java)
        assertEquals(200, response.statusCode.value())
        val entries = json.readTree(response.body)
        assertEquals(ReferenceCatalog().entries.map { it.id }, entries.map { it["id"].asText() })
        entries.forEach {
            assertTrue(it["categories"].size() > 0)
            assertEquals(it["categories"].size(), it["categories"].toSet().size)
            assertTrue(it["tags"].isArray)
            assertTrue(it["hasImage"].asBoolean())
            assertTrue(it["source"]["image"].asText().startsWith("/api/v1/references/${it["id"].asText()}/image?sourceId=source-1900&v="))
            assertFalse(it.has("graph"))
        }
    }

    @Test
    fun `every detail preserves legacy persons links verdict and source with reviewed participant corrections`() {
        val legacy = ReferenceCatalogLoader().load("catalog/legacy-production.json")
        val reviewedA = mapOf("affinity-allowed-01" to "georgiy", "affinity-allowed-02" to "georgiy", "affinity-allowed-03" to "foma")
        legacy.forEach { original ->
            val response = http.getForEntity("/api/v1/references/${original.id}", String::class.java)
            assertEquals(200, response.statusCode.value())
            val detail = json.readTree(response.body)
            val graph = detail["graph"]
            assertEquals(original.graph.persons.map { it.id }, graph["persons"].map { it["id"].asText() })
            assertEquals(original.graph.persons.map { it.name }, graph["persons"].map { if (it["name"].isNull) null else it["name"].asText() })
            assertEquals(reviewedA[original.id] ?: original.graph.personA.id, graph["personA"].asText())
            assertEquals(original.graph.personB.id, graph["personB"].asText())
            val expected = original.graph.persons.flatMap { p ->
                listOf("BIOLOGICAL" to p.children, "MARRIAGE" to p.spouses, "SPIRITUAL" to p.godchildren, "ADOPTION" to p.adoptedChildren)
                    .flatMap { (type, targets) -> targets.map { "$type:${p.id}:${it.id}" } }
            }
            assertEquals(expected, graph["relations"].map { "${it["type"].asText()}:${it["from"].asText()}:${it["to"].asText()}" })
            val metadata = detail["metadata"]
            assertTrue(metadata["source"]["image"].asText().startsWith("/api/v1/references/${original.id}/image?sourceId=source-1900&v="))
            assertEquals(original.verdict.name, metadata["verdict"].asText())
            assertEquals(original.description, metadata["description"].asText())
            assertEquals(original.source.document, metadata["source"]["document"].asText())
            assertEquals(original.source.page, metadata["source"]["page"].asInt())
            assertEquals(original.source.example, metadata["source"]["example"].asText())
            assertEquals(original.source.conclusion, metadata["source"]["conclusion"].asText())
        }
    }

    @Test
    fun `unknown reference returns a readable 404`() {
        val response = http.getForEntity("/api/v1/references/unknown", String::class.java)
        assertEquals(404, response.statusCode.value())
        assertTrue(json.readTree(response.body)["message"].asText().contains("unknown"))
    }
}
