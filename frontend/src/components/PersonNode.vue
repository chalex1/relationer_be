<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
defineProps<{ id: string; data: { name: string; role: string | null; active: boolean } }>()
defineEmits<{ select: [id: string] }>()
</script>
<template>
  <div class="person-node" :class="[{ 'is-active': data.active }, data.role ? `role-${data.role.toLowerCase()}` : 'role-relative']">
    <Handle id="top" type="target" :position="Position.Top" :connectable="false" />
    <Handle id="bottom" type="source" :position="Position.Bottom" :connectable="false" />
    <Handle id="left" type="target" :position="Position.Left" :connectable="false" />
    <Handle id="right" type="source" :position="Position.Right" :connectable="false" />
    <Handle id="spiritual-target" class="aux-handle" type="target" :position="Position.Top" :style="{ left: '25%' }" :connectable="false" />
    <Handle id="spiritual-source" class="aux-handle" type="source" :position="Position.Bottom" :style="{ left: '25%' }" :connectable="false" />
    <Handle id="adoption-target" class="aux-handle" type="target" :position="Position.Top" :style="{ left: '75%' }" :connectable="false" />
    <Handle id="adoption-source" class="aux-handle" type="source" :position="Position.Bottom" :style="{ left: '75%' }" :connectable="false" />
    <button class="person-card" :aria-label="`Выбрать: ${data.name}`" :aria-pressed="data.active" @click.stop="$emit('select', id)">
      <span class="person-avatar">{{ data.role || data.name.slice(0, 1).toUpperCase() }}</span>
      <span class="person-info"><span class="person-name">{{ data.name }}</span><span class="person-caption">{{ data.role ? `Участник ${data.role}` : 'Родственник' }}</span></span>
      <span v-if="data.role" class="protected-mark" title="Этого участника нельзя удалить">⌑</span>
    </button>
    <span v-if="data.active" class="node-selected-label">Выбранный человек</span>
  </div>
</template>
