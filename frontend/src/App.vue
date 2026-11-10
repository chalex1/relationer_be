<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { MarkerType, useVueFlow } from '@vue-flow/core'
import type { Node, Edge, NodeChange } from '@vue-flow/core'
import GraphCanvas from './components/GraphCanvas.vue'
import { typePresentation } from './domain/graphPresentation'
import SearchResults from './components/SearchResults.vue'
import { useReferenceSearch } from './composables/useReferenceSearch'
import { RelationType } from './api/generated/models/RelationType'
import { createEditor, addRelative, connectPeople, renamePerson, removePerson, removeRelation, movePerson,
  relativeActions, resetEditor, isProtected, personRelations, relationFor } from './domain/editor'
import type { RelativeAction, EditorRelation } from './domain/editor'
import { toSearchRequest } from './domain/editor'

const editor = reactive(createEditor())
const selectedId = ref<string | null>(editor.graph.personA)
const selectedEdgeId = ref<string | null>(null)
const nameDraft = ref('Персона A')
const searchDialog = ref<HTMLDialogElement>()
const relativeDialog = ref<HTMLDialogElement>()
const renameDialog = ref<HTMLDialogElement>()
const renameInput = ref<HTMLInputElement>()
const renameError = ref('')
const sheetCollapsed = ref(false)
const moreMenu = ref<HTMLDetailsElement>()
const graphMenu = ref<HTMLDetailsElement>()
const notice = ref('')
const isError = ref(false)
const connectDialog = ref<HTMLDialogElement>()
const confirmDialog = ref<HTMLDialogElement>()
const targetId = ref('')
const connectionRole = ref<RelativeAction>('parent')
const connectionError = ref('')
const pendingDelete = ref<string | 'reset' | null>(null)
const { fitView, applyNodeChanges } = useVueFlow()
const selectedPerson = computed(() => editor.graph.persons.find(p => p.id === selectedId.value))
const selectedEdge = computed(() => editor.graph.relations.find(r => r.id === selectedEdgeId.value))
const related = computed(() => selectedId.value ? personRelations(editor, selectedId.value) : [])
const others = computed(() => editor.graph.persons.filter(p => p.id !== selectedId.value))
const pendingName = computed(() => editor.graph.persons.find(p => p.id === pendingDelete.value)?.name)
const pendingLinks = computed(() => pendingDelete.value ? personRelations(editor, pendingDelete.value).length : 0)
const nodes = computed<Node[]>(() => editor.graph.persons.map(p => ({
  id: p.id, type: 'person', position: { ...editor.positions[p.id] }, deletable: false,
  selected: p.id === selectedId.value,
  data: { name: p.name || 'Без имени', role: p.id === editor.graph.personA ? 'A' : p.id === editor.graph.personB ? 'B' : null, active: p.id === selectedId.value },
})))
const edges = computed<Edge[]>(() => editor.graph.relations.map(r => ({
  id: r.id, source: r.from, target: r.to,
  sourceHandle: r.type === RelationType.MARRIAGE ? 'right' : r.type === RelationType.SPIRITUAL ? 'spiritual-source' : r.type === RelationType.ADOPTION ? 'adoption-source' : 'bottom',
  targetHandle: r.type === RelationType.MARRIAGE ? 'left' : r.type === RelationType.SPIRITUAL ? 'spiritual-target' : r.type === RelationType.ADOPTION ? 'adoption-target' : 'top',
  type: 'smoothstep', label: typePresentation[r.type].short,
  selected: r.id === selectedEdgeId.value,
  style: { stroke: typePresentation[r.type].color, strokeWidth: r.id === selectedEdgeId.value ? 3 : 2, strokeDasharray: typePresentation[r.type].dash },
  labelStyle: { fill: typePresentation[r.type].color, fontSize: '11px', fontWeight: 500 },
  labelBgStyle: { fill: '#fafbf8' }, labelBgPadding: [6, 4], labelBgBorderRadius: 4,
  markerEnd: r.type === RelationType.MARRIAGE ? undefined : { type: MarkerType.ArrowClosed, color: typePresentation[r.type].color, width: 16, height: 16 },
})))
const preparedRequest = computed(() => toSearchRequest(editor))
const { state: searchState, search } = useReferenceSearch(preparedRequest)
function findMatches() {
  searchDialog.value?.showModal()
  void search()
}
const connectionPreview = computed(() => selectedId.value && targetId.value ? relationFor(selectedId.value, targetId.value, connectionRole.value) : null)
function personName(id: string) { return editor.graph.persons.find(p => p.id === id)?.name || 'Без имени' }
function relationshipText(r: EditorRelation) {
  return `${personName(r.from)} ${r.type === RelationType.MARRIAGE ? '↔' : '→'} ${personName(r.to)}`
}
function message(text: string, error = false) { notice.value = text; isError.value = error }
function selectPerson(id: string) {
  selectedId.value = id; selectedEdgeId.value = null; nameDraft.value = personName(id); sheetCollapsed.value = false
  if (moreMenu.value) moreMenu.value.open = false
}
function perform(action: () => void) { try { action() } catch (e) { message(e instanceof Error ? e.message : 'Не удалось выполнить действие.', true) } }
async function openRename() {
  nameDraft.value = personName(selectedId.value!)
  renameError.value = ''
  renameDialog.value?.showModal()
  await nextTick(); renameInput.value?.focus(); renameInput.value?.select()
}
function saveName() {
  if (!selectedId.value) return
  try {
    renamePerson(editor, selectedId.value, nameDraft.value)
    renameDialog.value?.close(); message('Имя сохранено.')
  } catch (e) { renameError.value = e instanceof Error ? e.message : 'Не удалось сохранить имя.' }
}
function showGraph(duration = 200) {
  fitView({ padding: 0.22, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : duration, maxZoom: 1 })
}
async function toggleSheet() {
  sheetCollapsed.value = !sheetCollapsed.value
  await nextTick(); showGraph()
}
let resizeTimer: ReturnType<typeof setTimeout>
function resizeGraph() { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => showGraph(0), 150) }
onMounted(() => window.addEventListener('resize', resizeGraph))
onBeforeUnmount(() => { window.removeEventListener('resize', resizeGraph); clearTimeout(resizeTimer) })
async function add(action: RelativeAction) {
  if (!selectedId.value) return
  perform(() => { const id = addRelative(editor, selectedId.value!, action); selectPerson(id); relativeDialog.value?.close(); message('Родственник добавлен.') })
  await nextTick(); showGraph()
}
function openConnect() {
  if (!selectedId.value) return
  targetId.value = others.value[0]?.id || ''; connectionRole.value = 'parent'; connectionError.value = ''
  connectDialog.value?.showModal()
}
function saveConnection() {
  try {
    connectPeople(editor, selectedId.value!, targetId.value, connectionRole.value)
    connectDialog.value?.close(); message('Связь между людьми добавлена.')
  } catch (e) { connectionError.value = e instanceof Error ? e.message : 'Не удалось добавить связь.' }
}
function deletePerson() {
  if (!selectedId.value || isProtected(editor, selectedId.value)) return
  if (related.value.length > 1) { pendingDelete.value = selectedId.value; confirmDialog.value?.showModal() }
  else executeDelete(selectedId.value)
}
function executeDelete(id: string) {
  removePerson(editor, id); selectPerson(editor.graph.personA); message('Человек и его связи удалены.')
}
async function reset() {
  resetEditor(editor); selectPerson(editor.graph.personA); message('Граф сброшен. Начните с двух участников.')
  await nextTick(); showGraph()
}
function requestReset() {
  if (graphMenu.value) graphMenu.value.open = false
  if (editor.graph.relations.length > 1 || editor.graph.persons.length > 3) { pendingDelete.value = 'reset'; confirmDialog.value?.showModal() }
  else reset()
}
function confirmDelete() {
  if (pendingDelete.value === 'reset') reset()
  else if (pendingDelete.value) executeDelete(pendingDelete.value)
  confirmDialog.value?.close(); pendingDelete.value = null
}
function deleteEdge(id: string) { removeRelation(editor, id); selectedEdgeId.value = null; message('Связь удалена.') }
function changes(changes: NodeChange[]) {
  applyNodeChanges(changes.filter(change => change.type === 'dimensions'))
  for (const change of changes) {
    if (change.type === 'position' && change.position) movePerson(editor, change.id, change.position)
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <a href="#" class="brand" aria-label="Relationer — конструктор родства"><img src="/favicon.svg" alt="" />relationer<span>.</span></a>
      <span class="header-section">Конструктор родства</span>
      <a href="/references">Каталог эталонов</a>
      <span class="local-badge">Черновик в этой вкладке</span>
    </header>
    <main class="workspace">
      <aside class="inspector" :class="{ collapsed: sheetCollapsed }" aria-label="Действия с человеком">
        <div class="sheet-heading">
          <div><span class="eyebrow">{{ selectedPerson ? 'ВЫБРАН ЧЕЛОВЕК' : selectedEdge ? 'ВЫБРАНА СВЯЗЬ' : 'ВАША СХЕМА' }}</span><h1>{{ selectedPerson?.name || (selectedEdge ? 'Связь между людьми' : 'Выберите человека') }}</h1></div>
          <button class="sheet-toggle icon-button" :aria-label="sheetCollapsed ? 'Развернуть панель' : 'Свернуть панель'" :aria-expanded="!sheetCollapsed" aria-controls="inspector-body" @click="toggleSheet">{{ sheetCollapsed ? '⌃' : '⌄' }}</button>
        </div>
        <div id="inspector-body" class="inspector-body">
          <section v-if="selectedPerson" class="person-editor">
            <div class="primary-actions">
              <button class="button primary" @click="relativeDialog?.showModal()"><span aria-hidden="true">＋</span> Добавить родственника</button>
              <button class="button secondary" @click="openConnect"><span aria-hidden="true">↔</span> Связать с существующим</button>
              <button class="button secondary" @click="openRename"><span aria-hidden="true">✎</span> Переименовать</button>
            </div>
            <details ref="moreMenu" class="secondary-menu">
              <summary>Ещё <span>Связи и удаление</span></summary>
              <div class="secondary-content">
                <div class="section-heading"><span>Связи человека</span><span class="count-pill">{{ related.length }}</span></div>
                <p v-if="!related.length" class="muted">Пока нет связей.</p>
                <ul v-else class="relation-list"><li v-for="relation in related" :key="relation.id"><span class="relation-dot" :style="{ background: typePresentation[relation.type].color }"></span><div><span>{{ relationshipText(relation) }}</span><small>{{ typePresentation[relation.type].label }}</small></div><button class="icon-button" :aria-label="`Удалить связь: ${relationshipText(relation)}`" @click="deleteEdge(relation.id)">×</button></li></ul>
                <button class="button delete-person" :disabled="isProtected(editor, selectedPerson.id)" @click="deletePerson">{{ isProtected(editor, selectedPerson.id) ? 'Участники A и B защищены от удаления' : 'Удалить человека' }}</button>
              </div>
            </details>
          </section>
          <section v-else-if="selectedEdge" class="edge-editor"><h2>{{ relationshipText(selectedEdge) }}</h2><p>{{ typePresentation[selectedEdge.type].label }}</p><details class="secondary-menu"><summary>Ещё</summary><button class="button danger" @click="deleteEdge(selectedEdge.id)">Удалить связь</button></details></section>
          <p v-else class="muted">Нажмите на карточку на холсте, чтобы добавить родственника или связать людей.</p>
          <details class="family-hint">
            <summary>Как добавить родителей</summary>
            <p>Если для определения родства достаточно одного общего родителя, добавьте только его. Для подробного семейного дерева можно добавить обоих родителей, браки и детей от разных союзов.</p>
            <p><code>&lt;BB&gt;</code> — кровное родство через общего родителя.</p>
            <p><code>&lt;BMB&gt;</code> — путь через брак родителей, который может обозначать свойство между детьми разных супругов.</p>
          </details>
          <p class="sidebar-hint">Нажмите на человека → выберите действие.</p>
        </div>
      </aside>
      <section class="canvas-section" aria-label="Холст графа родства">
        <div class="canvas-toolbar">
          <span class="graph-stats">{{ editor.graph.persons.length }} чел. · {{ preparedRequest.relations.length }} связ.</span>
          <button class="button fit-button" @click="showGraph()"><span aria-hidden="true">⛶</span> Показать весь граф</button>
          <details ref="graphMenu" class="graph-menu"><summary class="icon-button" aria-label="Меню графа">⋯</summary><div class="graph-menu-content"><button class="button secondary" @click="requestReset">Сбросить граф</button><p class="muted">Черновик хранится до обновления страницы.</p></div></details>
        </div>
        <div class="search-toolbar">
          <button class="button primary" :disabled="searchState.status === 'loading'" @click="findMatches">{{ searchState.status === 'loading' ? 'Ищем совпадения…' : 'Найти совпадения' }}</button>
          <button class="button secondary" @click="searchDialog?.showModal()">{{ searchState.status === 'success' ? `Результаты (${searchState.response.matches.length})` : 'Участники и результаты' }}</button>
        </div>
        <div class="graph-canvas">
          <GraphCanvas :nodes="nodes" :edges="edges" :apply-default="false" :nodes-connectable="false" :edges-updatable="false" :delete-key-code="null" :min-zoom="0.05" :max-zoom="2" :fit-view-on-init="true" :zoom-on-pinch="true" :zoom-on-double-click="false" :pan-on-drag="true" :prevent-scrolling="true" @nodes-change="changes" @node-click="({ node }: { node: Node }) => selectPerson(node.id)" @edge-click="({ edge }: { edge: Edge }) => { selectedEdgeId = edge.id; selectedId = null; sheetCollapsed = false }" @select="selectPerson" />
          <div class="participants" aria-label="Участники поиска"><button :aria-label="`Выбрать участника A: ${personName(editor.graph.personA)}`" :class="{ active: selectedId === editor.graph.personA }" @click="selectPerson(editor.graph.personA)"><span class="mini-avatar a">A</span><span>{{ personName(editor.graph.personA) }}</span></button><button :aria-label="`Выбрать участника B: ${personName(editor.graph.personB)}`" :class="{ active: selectedId === editor.graph.personB }" @click="selectPerson(editor.graph.personB)"><span class="mini-avatar b">B</span><span>{{ personName(editor.graph.personB) }}</span></button></div>
          <p v-if="!editor.graph.relations.length" class="canvas-welcome">Выберите человека, чтобы начать</p>
        </div>
        <div class="canvas-footer"><div class="legend"><span><i class="blood"></i> Родство</span><span><i class="marriage"></i> Брак</span><span><i class="spiritual"></i> Крещение</span><span><i class="adoption"></i> Усыновление</span></div></div>
      </section>
    </main>
    <div v-if="notice" class="toast" :class="{ error: isError }" role="status"><span>{{ isError ? '!' : '✓' }}</span>{{ notice }}<button class="icon-button" aria-label="Закрыть уведомление" @click="notice = ''">×</button></div>
    <dialog ref="searchDialog" class="modal search-modal" aria-labelledby="search-title">
      <div class="modal-top"><span class="eyebrow">СПРАВОЧНИК РОДСТВА</span><button class="icon-button" aria-label="Закрыть поиск" @click="searchDialog?.close()">×</button></div>
      <h2 id="search-title">Поиск совпадений</h2>
      <div class="search-participants">
        <div><label for="search-person-a">Участник A</label><select id="search-person-a" v-model="editor.graph.personA"><option v-for="p in editor.graph.persons" :key="p.id" :value="p.id">{{ p.name || 'Без имени' }}</option></select></div>
        <div><label for="search-person-b">Участник B</label><select id="search-person-b" v-model="editor.graph.personB"><option v-for="p in editor.graph.persons" :key="p.id" :value="p.id">{{ p.name || 'Без имени' }}</option></select></div>
      </div>
      <button class="button primary search-submit" :disabled="searchState.status === 'loading'" @click="search">{{ searchState.status === 'loading' ? 'Ищем совпадения…' : 'Повторить поиск' }}</button>
      <SearchResults :state="searchState" />
    </dialog>
    <dialog ref="relativeDialog" class="modal role-modal" aria-labelledby="relative-title">
      <div class="modal-top"><span class="eyebrow">ДОБАВИТЬ К {{ selectedPerson?.name }}</span><button class="icon-button" aria-label="Закрыть" @click="relativeDialog?.close()">×</button></div>
      <h2 id="relative-title">Кого добавим?</h2><p>Выберите роль. Связь появится автоматически.</p>
      <div class="role-list"><button v-for="action in relativeActions" :key="action.id" class="button secondary" @click="add(action.id)"><span class="action-icon" aria-hidden="true">{{ action.icon }}</span>{{ action.label }}<span class="role-arrow" aria-hidden="true">＋</span></button></div>
    </dialog>
    <dialog ref="renameDialog" class="modal" aria-labelledby="rename-title">
      <form @submit.prevent="saveName"><div class="modal-top"><span class="eyebrow">ИМЯ ЧЕЛОВЕКА</span><button type="button" class="icon-button" aria-label="Закрыть" @click="renameDialog?.close()">×</button></div><h2 id="rename-title">Переименовать</h2><label for="person-name">Имя или обозначение</label><input id="person-name" ref="renameInput" v-model="nameDraft" autocomplete="off" /><p v-if="renameError" class="form-error" role="alert">{{ renameError }}</p><div class="modal-actions"><button type="button" class="button secondary" @click="renameDialog?.close()">Отмена</button><button type="submit" class="button primary">Сохранить имя</button></div></form>
    </dialog>
    <dialog ref="connectDialog" class="modal" aria-labelledby="connect-title" @close="connectionError = ''">
      <form @submit.prevent="saveConnection"><div class="modal-top"><span class="eyebrow">СУЩЕСТВУЮЩИЕ ЛЮДИ</span><button type="button" class="icon-button" aria-label="Закрыть" @click="connectDialog?.close()">×</button></div><h2 id="connect-title">Связать людей</h2><p>Выберите человека и его роль относительно {{ selectedPerson?.name }}.</p>
        <label for="existing-person">Выберите человека</label><select id="existing-person" v-model="targetId"><option v-for="p in others" :key="p.id" :value="p.id">{{ p.name }}{{ p.id === editor.graph.personA ? ' (A)' : p.id === editor.graph.personB ? ' (B)' : '' }}</option></select>
        <label for="relation-role">Кем этот человек приходится {{ selectedPerson?.name }}?</label><select id="relation-role" v-model="connectionRole"><option v-for="action in relativeActions" :key="action.id" :value="action.id">{{ action.role }}</option></select>
        <div v-if="connectionPreview" class="connection-preview"><span>{{ typePresentation[connectionPreview.type].label }}</span><strong>{{ personName(connectionPreview.from) }} {{ connectionPreview.type === RelationType.MARRIAGE ? '↔' : '→' }} {{ personName(connectionPreview.to) }}</strong></div>
        <p v-if="connectionError" class="form-error" role="alert">{{ connectionError }}</p><div class="modal-actions"><button type="button" class="button secondary" @click="connectDialog?.close()">Отмена</button><button type="submit" class="button primary" :disabled="!connectionPreview">Добавить связь</button></div>
      </form>
    </dialog>
    <dialog ref="confirmDialog" class="modal" aria-labelledby="confirm-title"><span class="eyebrow">ПОДТВЕРЖДЕНИЕ</span><h2 id="confirm-title">{{ pendingDelete === 'reset' ? 'Начать заново?' : `Удалить ${pendingName}?` }}</h2><p>{{ pendingDelete === 'reset' ? 'Все добавленные люди и связи будут удалены. Останутся только персоны A и B.' : `Вместе с человеком будут удалены его связи (${pendingLinks}). Это действие нельзя отменить.` }}</p><div class="modal-actions"><button class="button secondary" @click="confirmDialog?.close()">Отмена</button><button class="button danger" @click="confirmDelete">{{ pendingDelete === 'reset' ? 'Сбросить граф' : 'Удалить человека' }}</button></div></dialog>
  </div>
</template>
