package com.relationer.backend.api

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.client.TestRestTemplate
import kotlin.test.*

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CatalogSearchAuditHttpTest {
    @Autowired lateinit var http: TestRestTemplate
    @Autowired lateinit var json: ObjectMapper

    @Test
    fun `all eight adopted archive cases round trip through normalized ADOPTION API and match themselves`() {
        for (number in 1..8) {
            val id = "adoption-forbidden-${number.toString().padStart(2, '0')}"
            val detail = json.readTree(http.getForObject("/api/v1/references/$id", String::class.java))
            val graph = detail["graph"]
            assertTrue(graph["relations"].any { it["type"].asText() == "ADOPTION" }, id)
            assertFalse(graph["relations"].any { it["type"].asText() == "ADOPTED" }, id)
            val response = http.postForEntity("/api/v1/references/search", graph, String::class.java)
            assertEquals(200, response.statusCode.value())
            assertTrue(json.readTree(response.body)["matches"].any { it["referenceId"].asText() == id }, id)
            // ADOPTED is an import-only spelling; today's REST contract accepts ADOPTION.
            val imported = graph.deepCopy<ObjectNode>()
            (imported["relations"].first { it["type"].asText() == "ADOPTION" } as ObjectNode).put("type", "ADOPTED")
            assertEquals(400, http.postForEntity("/api/v1/references/search", imported, String::class.java).statusCode.value(), id)
        }
    }

    @Test
    fun `two common parents produce indistinguishable blood01 DTO occurrences without losing domain paths`() {
        val graph = json.readTree("""{
            "persons":[{"id":"a"},{"id":"b"},{"id":"p"},{"id":"q"}],
            "personA":"a","personB":"b",
            "relations":[
                {"type":"BIOLOGICAL","from":"p","to":"a"},
                {"type":"BIOLOGICAL","from":"p","to":"b"},
                {"type":"BIOLOGICAL","from":"q","to":"a"},
                {"type":"BIOLOGICAL","from":"q","to":"b"}]
        }""")
        val response = http.postForEntity("/api/v1/references/search", graph, String::class.java)
        assertEquals(200, response.statusCode.value())
        val matches = json.readTree(response.body)["matches"].filter { it["referenceId"].asText() == "blood-01" }
        assertEquals(2, matches.size)
        assertEquals(matches[0], matches[1])
        assertEquals("<BB>", matches[0]["userPathCode"].asText())
        assertFalse(matches[0].has("userPathPersonIds"))
    }
}
