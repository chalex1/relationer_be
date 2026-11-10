package com.relationer.backend.api

import com.relationer.backend.domain.ReferenceCatalogLoader
import org.springframework.stereotype.Component

@Component
class ReferenceCatalog {
    val entries = ReferenceCatalogLoader().load()
}
