<script setup lang="ts">
import { computed, ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import type { SearchRequest } from '../api/generated/models/SearchRequest'
import GraphCanvas from './GraphCanvas.vue'
import { catalogGraph } from '../domain/catalog'
const props = defineProps<{ graph: SearchRequest; id: string }>()
const layout = computed(() => catalogGraph(props.graph))
const { fitView, zoomIn, zoomOut } = useVueFlow({ id: `reference-${props.id}` })
const container = ref<HTMLElement>()
let observer: ResizeObserver | undefined
let frame = 0
const dialog = ref<HTMLDialogElement>()
const expanded = ref(false)
async function resize() {
  await nextTick()
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => fitView({ padding: 0.06, maxZoom: 1.2 }))
}
function open() { expanded.value = true; dialog.value?.showModal(); void resize() }
function close() { expanded.value = false; dialog.value?.close(); void resize() }
onMounted(() => {
  observer = new ResizeObserver(() => { void resize() })
  if (container.value) observer.observe(container.value)
})
onBeforeUnmount(() => { observer?.disconnect(); cancelAnimationFrame(frame); dialog.value?.close() })
</script>
<template>
  <div ref="container" class="reference-graph">
    <div class="reference-graph-tools">
      <button class="button secondary" @click="open">Развернуть граф</button>
      <div class="reference-zoom" aria-label="Масштаб графа">
        <button class="button secondary" aria-label="Уменьшить граф" @click="zoomOut()">−</button>
        <button class="button secondary" aria-label="Увеличить граф" @click="zoomIn()">+</button>
        <button class="button secondary" aria-label="Показать весь граф" @click="resize">⛶</button>
      </div>
    </div>
    <p v-if="layout.levels > 5" class="muted">Большой граф: используйте масштаб, перемещение или развёрнутый просмотр.</p>
    <div v-if="!expanded" class="reference-canvas" :style="{ height: `${layout.height}px` }">
      <GraphCanvas :id="`reference-${id}`" :nodes="layout.nodes" :edges="layout.edges" readonly compact :fit-view-params="{ padding: 0.06, maxZoom: 1.2 }" />
    </div>
    <dialog ref="dialog" class="graph-dialog" @cancel.prevent="close">
      <div class="reference-graph-tools">
        <button class="button secondary" @click="close">Закрыть граф</button>
        <div class="reference-zoom" aria-label="Масштаб графа">
          <button class="button secondary" aria-label="Уменьшить граф" @click="zoomOut()">−</button>
          <button class="button secondary" aria-label="Увеличить граф" @click="zoomIn()">+</button>
          <button class="button secondary" aria-label="Показать весь граф" @click="resize">⛶</button>
        </div>
      </div>
      <div v-if="expanded" class="expanded-canvas"><GraphCanvas :id="`reference-${id}`" :nodes="layout.nodes" :edges="layout.edges" readonly compact :fit-view-params="{ padding: 0.06, maxZoom: 1.2 }" /></div>
    </dialog>
  </div>
</template>
