package com.relationer.backend.domain

class Person(
    val id: String,
    val name: String? = null,
    val children: MutableList<Person> = mutableListOf(),
    val godchildren: MutableList<Person> = mutableListOf(),
    val spouses: MutableList<Person> = mutableListOf(),
)
