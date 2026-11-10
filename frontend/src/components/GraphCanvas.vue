<script setup lang="ts">
import { VueFlow } from '@vue-flow/core'
import type { Node, Edge } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import PersonNode from './PersonNode.vue'
defineOptions({ inheritAttrs: false })
defineProps<{ nodes: Node[]; edges: Edge[]; id?: string; readonly?: boolean; compact?: boolean }>()
defineEmits<{ select: [id: string] }>()
</script>
<template>
  <VueFlow :id="id" :nodes="nodes" :edges="edges" :nodes-draggable="!readonly" :nodes-connectable="false" :edges-updatable="false" :delete-key-code="null" :min-zoom="0.01" :max-zoom="2" :fit-view-on-init="true" :zoom-on-double-click="false" :prevent-scrolling="!readonly" v-bind="$attrs">
    <Background :gap="22" :size="1" pattern-color="#d6ddd4" />
    <Controls v-if="!compact" :show-interactive="false" :show-fit-view="!!readonly" position="bottom-left" />
    <template #node-person="props"><PersonNode :id="props.id" :data="{ ...props.data, readonly, compact }" @select="$emit('select', $event)" /></template>
  </VueFlow>
</template>
