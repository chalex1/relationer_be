import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import type { SearchRequest } from '../src/api/generated/models/SearchRequest'

// Inspect the actual computed request through Vue's development instrumentation.
// No test hooks or debug data are added to the shipped application.
async function readRequest(page: Page): Promise<SearchRequest> {
  return page.locator('.app-shell').evaluate(el => {
    const component = (el as HTMLElement & { __vueParentComponent: { devtoolsRawSetupState: { preparedRequest: { value: SearchRequest } } } }).__vueParentComponent
    return component.devtoolsRawSetupState.preparedRequest.value
  })
}
async function rename(page: Page, name: string) {
  await page.getByRole('button', { name: 'Переименовать', exact: true }).click()
  await page.getByLabel('Имя или обозначение').fill(name)
  await page.getByRole('button', { name: 'Сохранить имя', exact: true }).click()
}
async function more(page: Page) { await page.locator('.person-editor > details > summary').click() }
async function resetMenu(page: Page) { await page.getByLabel('Меню графа').click(); await page.getByRole('button', { name: 'Сбросить граф', exact: true }).click() }
async function addRelative(page: Page, role: string) {
  await page.getByRole('button', { name: 'Добавить родственника', exact: true }).click()
  await page.getByRole('button', { name: role, exact: true }).click()
}
async function connect(page: Page, person: string, role: string) {
  await page.getByRole('button', { name: 'Связать с существующим', exact: true }).click()
  await page.getByLabel('Выберите человека').selectOption(person)
  await page.getByLabel('Кем этот человек приходится').selectOption(role)
  await page.getByRole('button', { name: 'Добавить связь', exact: true }).click()
}

test('initial editor has protected A/B, renders and never calls the backend', async ({ page }) => {
  const errors: string[] = []; const calls: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('request', r => { if (r.url().includes('/api/v1/')) calls.push(r.url()) })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Выбрать: Персона A', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Выбрать: Персона B', exact: true })).toBeVisible()
  await more(page)
  await expect(page.getByRole('button', { name: 'Участники A и B защищены от удаления' })).toBeDisabled()
  await more(page)
  await page.keyboard.press('Delete')
  await expect(page.locator('.graph-stats')).toHaveText('2 чел. · 0 связ.')
  await mkdir('artifacts', { recursive: true })
  await page.screenshot({ path: 'artifacts/editor-desktop.png', fullPage: true })
  expect(errors).toEqual([]); expect(calls).toEqual([])
})

test('adds a common parent, renames them and prevents duplicate connections', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Добавить родственника' }).click()
  await page.getByRole('button', { name: 'Родителя', exact: true }).click()
  await expect(page.locator('.graph-stats')).toHaveText('3 чел. · 1 связ.')
  await rename(page, 'Елена')
  await expect(page.getByRole('button', { name: 'Выбрать: Елена', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Связать с существующим' }).click()
  await page.getByLabel('Выберите человека').selectOption('person-b')
  await page.getByLabel('Кем этот человек приходится').selectOption('child')
  await page.getByRole('button', { name: 'Добавить связь', exact: true }).click()
  await expect(page.locator('.graph-stats')).toHaveText('3 чел. · 2 связ.')
  await page.getByRole('button', { name: 'Связать с существующим' }).click()
  await page.getByLabel('Выберите человека').selectOption('person-b')
  await page.getByLabel('Кем этот человек приходится').selectOption('child')
  await page.getByRole('button', { name: 'Добавить связь', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Такая связь уже есть в графе.')
  await page.getByRole('button', { name: 'Отмена', exact: true }).click()
  const request = await readRequest(page)
  const parent = request.persons.find(p => p.name === 'Елена')!
  expect(request.persons).toHaveLength(3)
  expect(request.relations).toEqual([{ type: 'BIOLOGICAL', from: parent.id, to: 'person-a' }, { type: 'BIOLOGICAL', from: parent.id, to: 'person-b' }])
  expect(Object.keys(request).sort()).toEqual(['personA', 'personB', 'persons', 'relations'])
  await page.getByRole('button', { name: 'Закрыть уведомление' }).click()
  await page.screenshot({ path: 'artifacts/editor-common-parent.png', fullPage: true })
  await more(page)
  await page.getByRole('button', { name: 'Удалить человека', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Отмена', exact: true }).click()
  await expect(page.locator('.graph-stats')).toHaveText('3 чел. · 2 связ.')
  await page.getByRole('button', { name: 'Удалить человека', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить человека', exact: true }).click()
  await expect(page.locator('.graph-stats')).toHaveText('2 чел. · 0 связ.')
})

test('a single connection and its relative can be removed without confirmation', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Добавить родственника' }).click()
  await page.getByRole('button', { name: 'Крёстного', exact: true }).click()
  await expect(page.locator('.graph-stats')).toHaveText('3 чел. · 1 связ.')
  await more(page)
  await page.getByRole('button', { name: /^Удалить связь:/ }).click()
  await expect(page.locator('.graph-stats')).toHaveText('3 чел. · 0 связ.')
  await page.getByRole('button', { name: 'Удалить человека', exact: true }).click()
  await expect(page.locator('.graph-stats')).toHaveText('2 чел. · 0 связ.')
  await expect(page.getByRole('dialog')).not.toBeVisible()
})

test('reset confirms loss of several connections and restores the initial graph', async ({ page }) => {
  await page.goto('/')
  for (const label of ['Родителя', 'Ребёнка']) {
    await page.getByRole('button', { name: 'Добавить родственника' }).click()
    await page.getByRole('button', { name: label, exact: true }).click()
  }
  await resetMenu(page)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Сбросить граф', exact: true }).click()
  await expect(page.locator('.graph-stats')).toHaveText('2 чел. · 0 связ.')
  await expect(page.getByRole('button', { name: 'Выбрать: Персона A', exact: true })).toBeVisible()
})

test('nodes can be dragged and selecting them preserves their names', async ({ page }) => {
  await page.goto('/')
  const node = page.locator('.vue-flow__node[data-id="person-a"]')
  const before = await node.boundingBox()
  if (!before) throw new Error('Node not found')
  await page.mouse.move(before.x + 80, before.y + 25)
  await page.mouse.down(); await page.mouse.move(before.x + 140, before.y + 85, { steps: 12 }); await page.mouse.up()
  await expect.poll(async () => { const after = await node.boundingBox(); return Math.abs((after?.y ?? 0) - before.y) }).toBeGreaterThan(20)
  await expect(page.getByRole('button', { name: 'Выбрать: Персона A', exact: true })).toBeVisible()
})

test('different relation types between one pair have distinct paths', async ({ page }) => {
  await page.goto('/')
  for (const role of ['child', 'godchild', 'adopted-child']) {
    await page.getByRole('button', { name: 'Связать с существующим' }).click()
    await page.getByLabel('Выберите человека').selectOption('person-b')
    await page.getByLabel('Кем этот человек приходится').selectOption(role)
    await page.getByRole('button', { name: 'Добавить связь', exact: true }).click()
  }
  await expect(page.locator('.graph-stats')).toHaveText('2 чел. · 3 связ.')
  await expect(page.locator('.vue-flow__edge-path')).toHaveCount(3)
  await expect.poll(async () => new Set(await page.locator('.vue-flow__edge-path').evaluateAll(paths => paths.map(path => path.getAttribute('d')))).size).toBe(3)
  expect((await readRequest(page)).relations).toEqual(['BIOLOGICAL', 'SPIRITUAL', 'ADOPTION'].map(type => ({ type, from: 'person-a', to: 'person-b' })))
})


test('spouse chain produces the expected SearchRequest', async ({ page }) => {
  await page.goto('/')
  await addRelative(page, 'Супруга / супругу')
  await rename(page, 'Михаил')
  await connect(page, 'person-b', 'child')
  const request = await readRequest(page)
  const spouse = request.persons.find(p => p.name === 'Михаил')!
  expect(request.personA).toBe('person-a'); expect(request.personB).toBe('person-b')
  expect(request.relations).toEqual([
    { type: 'MARRIAGE', from: 'person-a', to: spouse.id },
    { type: 'BIOLOGICAL', from: spouse.id, to: 'person-b' },
  ])
  await page.getByRole('button', { name: 'Показать весь граф' }).click()
  expect(await readRequest(page)).toEqual(request)
})

test('spiritual relationship keeps its direction and all seven roles are available', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Добавить родственника' }).click()
  const roles = ['Родителя', 'Ребёнка', 'Супруга / супругу', 'Крёстного', 'Крестника', 'Приёмного родителя', 'Приёмного ребёнка']
  for (const role of roles) await expect(page.getByRole('button', { name: role, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Крёстного', exact: true }).click()
  await rename(page, 'Николай')
  await connect(page, 'person-b', 'godchild')
  const request = await readRequest(page)
  const godparent = request.persons.find(p => p.name === 'Николай')!
  expect(request.relations).toEqual([
    { type: 'SPIRITUAL', from: godparent.id, to: 'person-a' },
    { type: 'SPIRITUAL', from: godparent.id, to: 'person-b' },
  ])
  expect(JSON.stringify(request)).not.toMatch(/positions|sourceHandle|targetHandle/)
})

test.describe('mobile touch editor', () => {
  test.use({ hasTouch: true, isMobile: true })
  for (const width of [320, 375, 390, 768]) {
    test(`bottom sheets, primary actions and common parent at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 768 ? 1024 : 844 })
      await page.goto('/')
      const noOverflow = async () => {
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(windowHeight)
      }
      const windowHeight = width === 768 ? 1024 : 844
      await noOverflow()
      await page.getByRole('button', { name: 'Выбрать: Персона B', exact: true }).tap()
      await expect(page.locator('.sheet-heading h1')).toHaveText('Персона B')
      await page.getByRole('button', { name: 'Выбрать: Персона A', exact: true }).tap()
      await expect(page.locator('.sheet-heading h1')).toHaveText('Персона A')
      const inspector = await page.locator('.inspector').boundingBox()
      const canvas = await page.locator('.graph-canvas').boundingBox()
      expect(inspector!.width).toBe(width)
      expect(canvas!.height).toBeGreaterThan(250)
      expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(inspector!.y + 1)
      for (const name of ['Добавить родственника', 'Связать с существующим', 'Переименовать']) {
        await expect(page.getByRole('button', { name, exact: true })).toBeInViewport()
      }
      await page.getByRole('button', { name: 'Добавить родственника' }).tap()
      const sheet = await page.getByRole('dialog').boundingBox()
      expect(sheet!.x).toBe(0); expect(sheet!.width).toBe(width)
      expect(sheet!.y + sheet!.height).toBeCloseTo(windowHeight, 0)
      await noOverflow()
      await page.getByRole('button', { name: 'Приёмного ребёнка', exact: true }).scrollIntoViewIfNeeded()
      await expect(page.getByRole('button', { name: 'Приёмного ребёнка', exact: true })).toBeInViewport()
      await page.getByRole('button', { name: 'Родителя', exact: true }).tap()
      await page.getByRole('button', { name: 'Переименовать', exact: true }).tap()
      await page.getByLabel('Имя или обозначение').fill('Елена')
      await page.getByRole('button', { name: 'Сохранить имя' }).tap()
      await page.getByRole('button', { name: 'Связать с существующим' }).tap()
      await page.getByLabel('Выберите человека').selectOption('person-b')
      await page.getByLabel('Кем этот человек приходится').selectOption('child')
      await noOverflow()
      await page.getByRole('button', { name: 'Добавить связь', exact: true }).tap()
      await page.getByRole('button', { name: 'Показать весь граф' }).tap()
      await expect.poll(() => page.locator('.vue-flow__node').evaluateAll(nodes => {
        const canvas = document.querySelector('.graph-canvas')!.getBoundingClientRect()
        return nodes.every(node => { const box = node.getBoundingClientRect(); return box.left >= canvas.left && box.right <= canvas.right && box.top >= canvas.top && box.bottom <= canvas.bottom })
      })).toBe(true)
      const request = await readRequest(page)
      const parent = request.persons.find(p => p.name === 'Елена')!
      expect(request.relations).toEqual([{ type: 'BIOLOGICAL', from: parent.id, to: 'person-a' }, { type: 'BIOLOGICAL', from: parent.id, to: 'person-b' }])
      await noOverflow()
      await page.getByRole('button', { name: 'Свернуть панель' }).tap()
      await expect(page.getByRole('button', { name: 'Добавить родственника' })).not.toBeVisible()
      await page.getByRole('button', { name: 'Развернуть панель' }).tap()
      await expect(page.getByRole('button', { name: 'Добавить родственника' })).toBeInViewport()
      await page.getByRole('button', { name: 'Закрыть уведомление' }).tap()
      await page.screenshot({ path: `artifacts/editor-mobile-${width}.png`, fullPage: true })
      if (width === 390) {
        await page.screenshot({ path: 'artifacts/editor-mobile.png', fullPage: true })
        await page.getByRole('button', { name: 'Добавить родственника' }).tap()
        await page.screenshot({ path: 'artifacts/editor-mobile-roles.png', fullPage: true })
      }
    })
  }

  test('touch pan, pinch zoom and node drag keep the page still and the request unchanged', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const request = await readRequest(page)
    const canvas = (await page.locator('.graph-canvas').boundingBox())!
    const client = await page.context().newCDPSession(page)
    const transform = () => page.locator('.vue-flow__transformationpane').getAttribute('style')
    const beforePan = await transform()
    const x = 180, y = canvas.y + canvas.height - 55
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] })
    for (let n = 1; n <= 8; n++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + n * 8, y: y - n * 4, id: 0 }] })
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(transform).not.toBe(beforePan)
    const zoom = async () => Number((await transform())?.match(/scale\(([^)]+)\)/)?.[1])
    const beforePinch = await zoom()
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 140, y, id: 0 }, { x: 240, y, id: 1 }] })
    for (let n = 1; n <= 8; n++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 140 - n * 5, y, id: 0 }, { x: 240 + n * 5, y, id: 1 }] })
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(zoom).toBeGreaterThan(beforePinch)
    await page.getByRole('button', { name: 'Показать весь граф' }).tap()
    await page.waitForTimeout(300)
    const node = page.locator('.vue-flow__node[data-id="person-a"]')
    const before = (await node.boundingBox())!
    const nx = before.x + before.width / 2, ny = before.y + before.height / 2
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: nx, y: ny, id: 0 }] })
    for (let n = 1; n <= 10; n++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: nx + n * 2, y: ny + n * 5, id: 0 }] })
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(async () => (await node.boundingBox())!.y - before.y).toBeGreaterThan(20)
    expect(await readRequest(page)).toEqual(request)
    expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual({ x: 0, y: 0 })
  })
})


for (const width of [1440, 390]) {
  test(`individual parents and family guidance work at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 })
    await page.goto('/')
    const hint = page.locator('.family-hint')
    await hint.getByText('Как добавить родителей', { exact: true }).click()
    await expect(hint.getByText('Если для определения родства достаточно одного общего родителя, добавьте только его. Для подробного семейного дерева можно добавить обоих родителей, браки и детей от разных союзов.', { exact: true })).toBeVisible()
    await expect(hint.locator('p').nth(1)).toHaveText('<BB> — кровное родство через общего родителя.')
    await expect(hint.locator('p').nth(2)).toHaveText('<BMB> — путь через брак родителей, который может обозначать свойство между детьми разных супругов.')
    await hint.getByText('Как добавить родителей', { exact: true }).click()
    await addRelative(page, 'Родителя')
    await rename(page, 'Елена')
    await connect(page, 'person-b', 'child')
    await page.getByRole('button', { name: 'Выбрать участника A: Персона A', exact: true }).click()
    await addRelative(page, 'Родителя')
    await rename(page, 'Иван')
    await connect(page, 'person-b', 'child')
    await page.getByRole('button', { name: 'Добавить родственника', exact: true }).click()
    await expect(page.locator('.role-list button')).toHaveCount(7)
    for (const role of ['Родителя', 'Ребёнка', 'Супруга / супругу', 'Крёстного', 'Крестника', 'Приёмного родителя', 'Приёмного ребёнка']) {
      await expect(page.getByRole('button', { name: role, exact: true })).toBeVisible()
    }
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click()
    const request = await readRequest(page)
    const first = request.persons.find(p => p.name === 'Елена')!
    const second = request.persons.find(p => p.name === 'Иван')!
    expect(request.persons).toHaveLength(4)
    expect(request.relations).toEqual([first, second].flatMap(parent => ['person-a', 'person-b'].map(to => ({ type: 'BIOLOGICAL', from: parent.id, to }))))
    await connect(page, first.id, 'spouse')
    await expect(page.locator('.graph-stats')).toHaveText('4 чел. · 5 связ.')
    expect((await readRequest(page)).relations).toEqual([...request.relations, { type: 'MARRIAGE', from: second.id, to: first.id }])
  })
}
