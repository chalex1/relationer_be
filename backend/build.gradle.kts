plugins {
    kotlin("jvm") version "1.9.25"
    kotlin("plugin.spring") version "1.9.25"
    id("org.springframework.boot") version "3.3.12"
    id("io.spring.dependency-management") version "1.1.7"
    id("org.openapi.generator") version "7.17.0"
}

group = "com.relationer"
version = "0.0.1-SNAPSHOT"

java {
    toolchain { languageVersion.set(JavaLanguageVersion.of(21)) }
}

dependencies {
    implementation("com.fasterxml.jackson.core:jackson-databind")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
}

kotlin { jvmToolchain(21) }

val generatedOpenApiDir = layout.buildDirectory.dir("generated/openapi")

openApiGenerate {
    generatorName.set("kotlin-spring")
    inputSpec.set(layout.projectDirectory.file("openapi.yaml").asFile.absolutePath)
    outputDir.set(generatedOpenApiDir.get().asFile.absolutePath)
    apiPackage.set("com.relationer.backend.api.generated")
    modelPackage.set("com.relationer.backend.api.generated.model")
    configOptions.set(mapOf(
        "interfaceOnly" to "true",
        "skipDefaultInterface" to "true",
        "useSpringBoot3" to "true",
        "useBeanValidation" to "true",
        "documentationProvider" to "none",
        "annotationLibrary" to "none",
        "exceptionHandler" to "false",
        "useTags" to "true",
        "sourceFolder" to "src/main/kotlin",
        "enumPropertyNaming" to "UPPERCASE",
    ))
    globalProperties.set(mapOf(
        "apis" to "",
        "models" to "",
        "apiDocs" to "false",
        "modelDocs" to "false",
        "apiTests" to "false",
        "modelTests" to "false",
    ))
}

openApiValidate {
    inputSpec.set(layout.projectDirectory.file("openapi.yaml").asFile.absolutePath)
}

kotlin.sourceSets.named("main") {
    kotlin.srcDir(generatedOpenApiDir.map { it.dir("src/main/kotlin") })
}

tasks.named("compileKotlin") {
    dependsOn(tasks.named("openApiGenerate"))
}

tasks.withType<Test> {
    useJUnitPlatform()
}
