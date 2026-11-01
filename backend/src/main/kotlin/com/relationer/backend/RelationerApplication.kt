package com.relationer.backend

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class RelationerApplication

fun main(args: Array<String>) {
    runApplication<RelationerApplication>(*args)
}
