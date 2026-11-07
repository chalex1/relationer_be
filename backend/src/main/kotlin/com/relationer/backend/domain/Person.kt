package com.relationer.backend.domain

/**
 * Один человек в графе родства.
 *
 * Содержит идентификатор, имя и связи с другими людьми:
 * дети, супруги, крестники и усыновлённые.
 */
class Person(
    val id: String,
    val name: String? = null,
    val children: MutableList<Person> = mutableListOf(),
    val godchildren: MutableList<Person> = mutableListOf(),
    val adoptedChildren: MutableList<Person> = mutableListOf(),
    val spouses: MutableList<Person> = mutableListOf(),
)
