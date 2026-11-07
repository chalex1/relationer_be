package com.relationer.backend.api

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.relationer.backend.domain.PersonGraph
import com.relationer.backend.domain.ReferenceCatalogLoader
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import org.junit.jupiter.params.provider.ValueSource
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.client.TestRestTemplate
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ReferenceSearchHttpTest {
    @Autowired lateinit var http: TestRestTemplate
    @Autowired lateinit var json: ObjectMapper

    @ParameterizedTest
    @CsvSource(
        "blood-01, <BB>, blood-01;blood-02;blood-03;blood-04;blood-05",
        "blood-02, <BB>B>, blood-02;blood-03;blood-04;blood-05",
        "blood-03, <BB>B>B>, blood-03;blood-05",
        "blood-04, <B<BB>B>, blood-04",
        "blood-05, <BB>B>B>B>, blood-05",
        "affinity-allowed-01, M<BB>B>B>, affinity-allowed-01;affinity-allowed-03",
        "affinity-allowed-02, M<B<BB>B>B>, affinity-allowed-02",
        "affinity-allowed-03, M<BB>B>, affinity-allowed-03",
        "spiritual-forbidden-01, G>, spiritual-forbidden-01;spiritual-forbidden-02;spiritual-forbidden-03",
        "spiritual-forbidden-02, G><B, spiritual-forbidden-02",
        "spiritual-forbidden-03, <GG>, spiritual-forbidden-03",
    )
    fun `real catalog cases return expected matches verdicts codes and sources`(id: String, code: String, expected: String) {
        val catalog = ReferenceCatalogLoader().load()
        val reference = catalog.single { it.id == id }
        val body = success(request(reference.graph))
        val matches = body["matches"]
        assertEquals(expected.split(';'), matches.map { it["referenceId"].asText() })
        assertEquals(setOf("matches"), body.fieldNames().asSequence().toSet())
        for (match in matches) {
            val source = catalog.single { it.id == match["referenceId"].asText() }
            assertEquals(source.verdict.name, match["verdict"].asText())
            assertEquals(source.description, match["description"].asText())
            assertEquals(code, match["userPathCode"].asText())
            assertEquals(source.source.document, match["source"]["document"].asText())
            assertEquals(source.source.page, match["source"]["page"].intValue())
            assertEquals(source.source.example, match["source"]["example"].asText())
            assertEquals(source.source.conclusion, match["source"]["conclusion"].asText())
        }
        assertEquals(code, matches.single { it["referenceId"].asText() == id }["referencePathCode"].asText())
    }

    @Test
    fun `reverse selection preserves case but reverses directed user path`() {
        val request = spiritualMother()
        request.put("personA", "mother").put("personB", "godparent")
        val match = success(request)["matches"].single()
        assertEquals("spiritual-forbidden-02", match["referenceId"].asText())
        assertEquals("B><G", match["userPathCode"].asText())
        assertEquals("G><B", match["referencePathCode"].asText())
    }

    @ParameterizedTest
    @ValueSource(ints = [0, 1])
    fun `reversing a directed edge changes meaning and removes match`(index: Int) {
        val request = spiritualMother()
        val relation = request["relations"][index] as ObjectNode
        val from = relation["from"].asText()
        relation.put("from", relation["to"].asText()).put("to", from)
        assertTrue(success(request)["matches"].isEmpty)
    }

    @Test
    fun `marriage can be supplied in either direction`() {
        val graph = ReferenceCatalogLoader().load().single { it.id == "affinity-allowed-03" }.graph
        val original = request(graph)
        val reversed = original.deepCopy()
        val marriage = reversed["relations"].single { it["type"].asText() == "MARRIAGE" } as ObjectNode
        val from = marriage["from"].asText()
        marriage.put("from", marriage["to"].asText()).put("to", from)
        assertEquals(success(original), success(reversed))
    }

    @Test
    fun `longer forbidden blood path does not match shorter forbidden reference`() {
        val graph = json.readTree("""{
            "persons":[{"id":"a"},{"id":"p"},{"id":"q"},{"id":"r"},{"id":"s"},{"id":"t"},{"id":"v"},{"id":"w"},{"id":"b"}],
            "relations":[
                {"type":"BIOLOGICAL","from":"p","to":"a"},
                {"type":"BIOLOGICAL","from":"q","to":"p"},
                {"type":"BIOLOGICAL","from":"r","to":"q"},
                {"type":"BIOLOGICAL","from":"s","to":"r"},
                {"type":"BIOLOGICAL","from":"s","to":"t"},
                {"type":"BIOLOGICAL","from":"t","to":"v"},
                {"type":"BIOLOGICAL","from":"v","to":"w"},
                {"type":"BIOLOGICAL","from":"w","to":"b"}],
            "personA":"a","personB":"b"} """)
        assertTrue(success(graph)["matches"].isEmpty)
    }

    @Test
    fun `allowed fragment remains a match inside a longer user path`() {
        val graph = ReferenceCatalogLoader().load().single { it.id == "affinity-allowed-03" }.graph
        val request = request(graph)
        request.withArray("persons").addObject().put("id", "extra")
        request.withArray("relations").addObject().put("type", "SPIRITUAL")
            .put("from", graph.personB.id).put("to", "extra")
        request.put("personB", "extra")
        val match = success(request)["matches"].single()
        assertEquals("affinity-allowed-03", match["referenceId"].asText())
        assertEquals("ALLOWED", match["verdict"].asText())
        assertEquals("M<BB>B>G>", match["userPathCode"].asText())
        assertEquals("M<BB>B>", match["referencePathCode"].asText())
    }

    @Test
    fun `different paths retain both allowed and forbidden results`() {
        val request = json.readTree("""{
            "persons":[{"id":"a"},{"id":"b"},{"id":"p"},{"id":"m"},{"id":"q"},{"id":"s"},{"id":"c"}],
            "relations":[
                {"type":"BIOLOGICAL","from":"p","to":"a"},
                {"type":"BIOLOGICAL","from":"p","to":"b"},
                {"type":"MARRIAGE","from":"a","to":"m"},
                {"type":"BIOLOGICAL","from":"q","to":"m"},
                {"type":"BIOLOGICAL","from":"q","to":"s"},
                {"type":"BIOLOGICAL","from":"s","to":"c"},
                {"type":"BIOLOGICAL","from":"c","to":"b"}],
            "personA":"a","personB":"b"} """)
        val matches = success(request)["matches"]
        assertEquals(7, matches.size())
        assertEquals(5, matches.count { it["verdict"].asText() == "FORBIDDEN" })
        assertEquals(2, matches.count { it["verdict"].asText() == "ALLOWED" })
        assertEquals(setOf("<BB>", "M<BB>B>B>"), matches.map { it["userPathCode"].asText() }.toSet())
    }

    @Test
    fun `different user paths with equal codes are not collapsed`() {
        val request = json.readTree("""{
            "persons":[{"id":"a"},{"id":"b"},{"id":"p"},{"id":"q"}],
            "relations":[
                {"type":"BIOLOGICAL","from":"p","to":"a"},
                {"type":"BIOLOGICAL","from":"p","to":"b"},
                {"type":"BIOLOGICAL","from":"q","to":"a"},
                {"type":"BIOLOGICAL","from":"q","to":"b"}],
            "personA":"a","personB":"b"} """)
        val matches = success(request)["matches"]
        assertEquals(10, matches.size())
        assertTrue(matches.all { it["userPathCode"].asText() == "<BB>" })
        assertTrue(matches.groupBy { it["referenceId"].asText() }.values.all { it.size == 2 })
    }

    @Test
    fun `disconnected people return an empty array`() {
        val request = spiritualMother()
        request.set<JsonNode>("relations", json.createArrayNode())
        assertEquals(json.readTree("""{"matches":[]}"""), success(request))
    }

    @Test
    fun `adoption is accepted and is not confused with blood or spiritual relations`() {
        val request = spiritualMother()
        (request["relations"][0] as ObjectNode).put("type", "ADOPTION")
        assertTrue(success(request)["matches"].isEmpty)
    }

    @Test
    fun `duplicate IDs are rejected by domain validation`() {
        val request = spiritualMother()
        request.withArray("persons").addObject().put("id", "mother")
        assertTrue(bad(request.toString())["message"].asText().contains("Duplicate person id: mother"))
    }

    @ParameterizedTest
    @ValueSource(strings = ["personA", "personB", "from", "to"])
    fun `unknown participant references return 400`(field: String) {
        val request = spiritualMother()
        if (field == "from" || field == "to") (request["relations"][0] as ObjectNode).put(field, "missing")
        else request.put(field, "missing")
        assertEquals("Unknown person id: missing", bad(request.toString())["message"].asText())
    }

    @ParameterizedTest
    @ValueSource(strings = ["persons", "relations", "personA", "personB"])
    fun `missing mandatory properties return 400`(field: String) {
        val request = spiritualMother()
        request.remove(field)
        bad(request.toString())
    }

    @ParameterizedTest
    @ValueSource(strings = ["unknown-type", "blank-id", "blank-from", "blank-personA", "empty-persons", "null-person", "null-relation", "null-id", "same-person", "missing-person-id"])
    fun `invalid fields and graphs return contract error`(scenario: String) {
        val request = spiritualMother()
        when (scenario) {
            "unknown-type" -> (request["relations"][0] as ObjectNode).put("type", "UNKNOWN")
            "blank-id" -> (request["persons"][0] as ObjectNode).put("id", " ")
            "blank-from" -> (request["relations"][0] as ObjectNode).put("from", " ")
            "blank-personA" -> request.put("personA", " ")
            "empty-persons" -> request.set<JsonNode>("persons", json.createArrayNode())
            "null-person" -> request.withArray("persons").addNull()
            "null-relation" -> request.withArray("relations").addNull()
            "null-id" -> (request["persons"][0] as ObjectNode).putNull("id")
            "same-person" -> request.put("personB", "godparent")
            "missing-person-id" -> (request["persons"][0] as ObjectNode).remove("id")
        }
        bad(request.toString())
    }

    @ParameterizedTest
    @ValueSource(strings = ["{broken", "null", "[]", ""])
    fun `invalid JSON and bodies return contract error`(body: String) {
        bad(body)
    }

    private fun spiritualMother(): ObjectNode = json.readTree("""{
        "persons":[{"id":"godparent","name":"Николай"},{"id":"mother","name":null},{"id":"child"}],
        "relations":[{"type":"SPIRITUAL","from":"godparent","to":"child"},
                     {"type":"BIOLOGICAL","from":"mother","to":"child"}],
        "personA":"godparent","personB":"mother"} """) as ObjectNode

    private fun post(body: String): ResponseEntity<String> = http.postForEntity(
        "/api/v1/references/search", HttpEntity(body, HttpHeaders().apply { contentType = MediaType.APPLICATION_JSON }),
        String::class.java,
    )

    private fun success(body: JsonNode): JsonNode {
        val response = post(body.toString())
        assertEquals(200, response.statusCode.value(), response.body)
        return json.readTree(response.body)
    }

    private fun bad(body: String): JsonNode {
        val response = post(body)
        assertEquals(400, response.statusCode.value(), response.body)
        assertTrue(response.headers.contentType!!.isCompatibleWith(MediaType.APPLICATION_JSON))
        val error = json.readTree(response.body)
        assertEquals(setOf("message"), error.fieldNames().asSequence().toSet())
        assertTrue(error["message"].asText().isNotBlank())
        assertFalse(error.toString().contains("stackTrace"))
        return error
    }

    private fun request(graph: PersonGraph): ObjectNode {
        val request = json.createObjectNode()
        val persons = request.putArray("persons")
        graph.persons.forEach { persons.addObject().put("id", it.id).put("name", it.name) }
        val relations = request.putArray("relations")
        graph.persons.forEach { person ->
            listOf("BIOLOGICAL" to person.children, "MARRIAGE" to person.spouses,
                "SPIRITUAL" to person.godchildren, "ADOPTION" to person.adoptedChildren).forEach { (type, targets) ->
                targets.forEach { relations.addObject().put("type", type).put("from", person.id).put("to", it.id) }
            }
        }
        return request.put("personA", graph.personA.id).put("personB", graph.personB.id)
    }
}
