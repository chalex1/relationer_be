package com.relationer.backend.api

import com.relationer.backend.domain.ReferenceCatalogLoader
import kotlin.test.*

class ConclusionConfirmationTest {
    @Test
    fun `all current source conclusions remain explicitly unconfirmed`() {
        val catalog = ReferenceCatalog()
        assertEquals(94, catalog.all.size)
        assertTrue(catalog.all.flatMap { it.sources }.none { it.conclusionConfirmed })
        val service = ReferenceCatalogService(catalog)
        assertTrue(catalog.all.flatMap { service.summary(it).sources!! }.none { it.conclusionConfirmed == true })
    }

    @Test
    fun `explicit source confirmation reaches details and search without changing primary verdict`() {
        val catalog = ReferenceCatalog("catalog/multiple-sources.json")
        val service = ReferenceCatalogService(catalog)
        val detail = service.getReference("test-multi").body!!
        assertEquals("REVIEWED", detail.metadata.reviewStatus!!.name)
        assertEquals("FORBIDDEN", detail.metadata.verdict.name)
        val sources = detail.metadata.sources!!
        assertFalse(sources[0].conclusionConfirmed == true)
        assertTrue(sources[1].conclusionConfirmed == true)
        assertEquals("ALLOWED", sources[1].verdict.name)
        val response = ReferenceSearchService(SearchApiMapper(service), catalog).search(detail.graph)
        val match = response.matches.single { it.referenceId == "test-multi" }
        assertEquals("FORBIDDEN", match.verdict.name)
        assertTrue(match.sources!![1].conclusionConfirmed == true)
    }

    @Test
    fun `truthy strings and confirmation without conclusion are rejected`() {
        for (fixture in listOf("invalid-conclusion-confirmation", "confirmed-without-conclusion")) {
            val error = assertFailsWith<IllegalArgumentException> { ReferenceCatalogLoader().loadEntries("catalog/$fixture.json") }
            assertTrue(error.message.orEmpty().contains("conclusionConfirmed"))
        }
    }
}
