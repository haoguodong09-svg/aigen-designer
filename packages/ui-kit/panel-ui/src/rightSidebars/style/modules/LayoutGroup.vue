<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useStyleState } from '../composables/useStyleState';
import { parseSizeValue } from '../utils/cssCodec';

const { batchSetStyle, getStyle, setStyle } = useStyleState();

const displayVal = computed(() => getStyle('display') || 'block');
const showMoreMenu = ref(false);
const showGridModal = ref(false);
const gridAnchorRect = ref<DOMRect | null>(null);

const MORE_DISPLAYS = [
  { label: '网格布局', short: '网格', value: 'grid' },
  { label: '内联块级', short: '内联块', value: 'inline-block' },
  { label: '内联', short: '内联', value: 'inline' },
  { label: '隐藏', short: '隐藏', value: 'none' },
];

const isMoreActive = computed(() =>
  MORE_DISPLAYS.some((d) => d.value === displayVal.value),
);

const currentMoreLabel = computed(() => {
  return (
    MORE_DISPLAYS.find((d) => d.value === displayVal.value)?.short ?? '网格'
  );
});

function selectDisplay(val: string) {
  setStyle('display', val, `切换布局 ${val}`);
  showMoreMenu.value = false;
}

// Flex controls
const flexDirection = computed(() => getStyle('flexDirection') || 'row');
const justifyContent = computed(
  () => getStyle('justifyContent') || 'flex-start',
);
const alignItems = computed(() => getStyle('alignItems') || 'stretch');
const flexWrap = computed(() => getStyle('flexWrap') || 'nowrap');

// Grid controls
const gridLockGap = ref(true);
const colGap = computed(
  () => parseSizeValue(getStyle('columnGap') || getStyle('gap'), 'px').num,
);
const rowGap = computed(
  () => parseSizeValue(getStyle('rowGap') || getStyle('gap'), 'px').num,
);
const gridAutoFlow = computed(() => getStyle('gridAutoFlow') || 'row');
const isDense = computed(() => gridAutoFlow.value.includes('dense'));
const baseFlow = computed(() =>
  gridAutoFlow.value.startsWith('column') ? 'column' : 'row',
);

const gridCols = computed(() => {
  const raw = getStyle('gridTemplateColumns');
  return raw ? raw.split(/\s+/).filter(Boolean) : ['1fr', '1fr'];
});
const gridRows = computed(() => {
  const raw = getStyle('gridTemplateRows');
  return raw ? raw.split(/\s+/).filter(Boolean) : ['auto'];
});

function openGridPopover(e: MouseEvent) {
  gridAnchorRect.value = (
    e.currentTarget as HTMLElement
  ).getBoundingClientRect();
  showGridModal.value = !showGridModal.value;
}

const gridPopoverStyle = computed(() => {
  if (!gridAnchorRect.value) return {};
  return {
    left: `${Math.max(8, Math.min(window.innerWidth - 260, gridAnchorRect.value.left - 40))}px`,
    top: `${Math.min(window.innerHeight - 360, gridAnchorRect.value.bottom + 6)}px`,
    width: '248px',
  };
});

function updateGap(type: 'col' | 'row', val: string) {
  const formatted = val.trim() ? `${val.trim()}px` : undefined;
  if (gridLockGap.value) {
    batchSetStyle(
      { columnGap: formatted, gap: undefined, rowGap: formatted },
      '调整网格间距',
    );
  } else if (type === 'col') {
    setStyle('columnGap', formatted, '调整列间距');
  } else {
    setStyle('rowGap', formatted, '调整行间距');
  }
}

function updateGridFlow(dir: 'column' | 'row', dense: boolean) {
  const val = dense ? `${dir} dense` : dir;
  setStyle('gridAutoFlow', val, '修改网格流向');
}

function updateTrack(kind: 'cols' | 'rows', list: string[]) {
  const prop = kind === 'cols' ? 'gridTemplateColumns' : 'gridTemplateRows';
  setStyle(prop, list.length > 0 ? list.join(' ') : undefined, '调整网格轨道');
}

function addTrack(kind: 'cols' | 'rows') {
  const list =
    kind === 'cols' ? [...gridCols.value, '1fr'] : [...gridRows.value, 'auto'];
  updateTrack(kind, list);
}

function removeTrack(kind: 'cols' | 'rows', idx: number) {
  const src = kind === 'cols' ? gridCols.value : gridRows.value;
  updateTrack(
    kind,
    src.filter((_, i) => i !== idx),
  );
}

function editTrack(kind: 'cols' | 'rows', idx: number, val: string) {
  const list = [...(kind === 'cols' ? gridCols.value : gridRows.value)];
  list[idx] = val.trim() || (kind === 'cols' ? '1fr' : 'auto');
  updateTrack(kind, list);
}
</script>

<template>
  <div class="aigen-style-group-body">
    <!-- 排布 Display -->
    <div class="aigen-style-row">
      <span class="aigen-style-row__label">排布</span>
      <div class="aigen-style-row__ctrl aigen-layout-display">
        <div class="aigen-style-seg">
          <button
            type="button"
            class="aigen-style-seg__btn"
            :class="{ 'is-active': displayVal === 'block' }"
            title="块级布局 (block)"
            @click="selectDisplay('block')"
          >
            块级
          </button>
          <button
            type="button"
            class="aigen-style-seg__btn"
            :class="{ 'is-active': displayVal === 'flex' }"
            title="弹性布局 (flex)"
            @click="selectDisplay('flex')"
          >
            弹性
          </button>
          <button
            type="button"
            class="aigen-style-seg__btn"
            :class="{ 'is-active': isMoreActive }"
            :title="`更多布局: ${currentMoreLabel}`"
            @click="showMoreMenu = !showMoreMenu"
          >
            <span>{{ currentMoreLabel }}</span>
            <svg
              viewBox="0 0 12 12"
              width="11"
              height="11"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="aigen-layout-caret"
            >
              <path d="M3 4.5L6 7.5L9 4.5" />
            </svg>
          </button>
        </div>

        <div v-if="showMoreMenu" class="aigen-layout-menu">
          <button
            v-for="item in MORE_DISPLAYS"
            :key="item.value"
            type="button"
            class="aigen-layout-menu__item"
            :class="{ 'is-active': displayVal === item.value }"
            @click="selectDisplay(item.value)"
          >
            <span>{{ item.label }}</span>
            <span class="aigen-layout-menu__code">{{ item.value }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Flex 动态配置 -->
    <template v-if="displayVal === 'flex'">
      <div class="aigen-style-row">
        <span class="aigen-style-row__label">主轴方向</span>
        <div class="aigen-style-seg">
          <button
            v-for="opt in [
              { title: '水平 (row)', val: 'row' },
              { title: '垂直 (column)', val: 'column' },
              { title: '水平反向 (row-reverse)', val: 'row-reverse' },
              { title: '垂直反向 (column-reverse)', val: 'column-reverse' },
            ]"
            :key="opt.val"
            type="button"
            class="aigen-style-seg__btn"
            :class="{ 'is-active': flexDirection === opt.val }"
            :title="opt.title"
            @click="setStyle('flexDirection', opt.val, '调整主轴方向')"
          >
            <svg
              viewBox="0 0 16 16"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                v-if="opt.val === 'row'"
                d="M3 8H13M9.5 4.5L13 8L9.5 11.5"
              />
              <path
                v-else-if="opt.val === 'column'"
                d="M8 3V13M4.5 9.5L8 13L11.5 9.5"
              />
              <path
                v-else-if="opt.val === 'row-reverse'"
                d="M13 8H3M6.5 4.5L3 8L6.5 11.5"
              />
              <path v-else d="M8 13V3M4.5 6.5L8 3L11.5 6.5" />
            </svg>
          </button>
        </div>
      </div>

      <div class="aigen-style-row">
        <span class="aigen-style-row__label">主轴对齐</span>
        <div class="aigen-style-seg">
          <button
            v-for="opt in [
              {
                label: '左',
                title: '起点对齐 (flex-start)',
                val: 'flex-start',
              },
              { label: '中', title: '居中 (center)', val: 'center' },
              { label: '右', title: '终点对齐 (flex-end)', val: 'flex-end' },
              {
                label: '两端',
                title: '两端对齐 (space-between)',
                val: 'space-between',
              },
              {
                label: '均分',
                title: '环绕均分 (space-around)',
                val: 'space-around',
              },
            ]"
            :key="opt.val"
            type="button"
            class="aigen-style-seg__btn"
            :class="{ 'is-active': justifyContent === opt.val }"
            :title="opt.title"
            @click="setStyle('justifyContent', opt.val, '调整主轴对齐')"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="aigen-style-row">
        <span class="aigen-style-row__label">辅轴对齐</span>
        <div class="aigen-style-seg">
          <button
            v-for="opt in [
              { label: '顶', title: '起点 (flex-start)', val: 'flex-start' },
              { label: '中', title: '居中 (center)', val: 'center' },
              { label: '底', title: '终点 (flex-end)', val: 'flex-end' },
              { label: '拉伸', title: '拉伸 (stretch)', val: 'stretch' },
              { label: '基线', title: '基线 (baseline)', val: 'baseline' },
            ]"
            :key="opt.val"
            type="button"
            class="aigen-style-seg__btn"
            :class="{ 'is-active': alignItems === opt.val }"
            :title="opt.title"
            @click="setStyle('alignItems', opt.val, '调整辅轴对齐')"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="aigen-style-row">
        <span class="aigen-style-row__label">换行模式</span>
        <div class="aigen-style-seg">
          <button
            v-for="opt in [
              { label: '不换行', val: 'nowrap' },
              { label: '正换行', val: 'wrap' },
              { label: '逆换行', val: 'wrap-reverse' },
            ]"
            :key="opt.val"
            type="button"
            class="aigen-style-seg__btn"
            :class="{ 'is-active': flexWrap === opt.val }"
            @click="setStyle('flexWrap', opt.val, '调整换行模式')"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </template>

    <!-- Grid 动态配置 -->
    <template v-if="displayVal === 'grid'">
      <div class="aigen-style-row">
        <span class="aigen-style-row__label">网格轨道</span>
        <button
          type="button"
          class="aigen-grid-edit-btn"
          @click="openGridPopover"
        >
          <span>编辑网格</span>
          <span class="aigen-grid-dot"></span>
        </button>
      </div>

      <div class="aigen-style-row">
        <span class="aigen-style-row__label">对齐</span>
        <div class="aigen-style-seg">
          <button
            v-for="opt in [
              { label: '左', val: 'start' },
              { label: '中', val: 'center' },
              { label: '右', val: 'end' },
              { label: '拉伸', val: 'stretch' },
            ]"
            :key="opt.val"
            type="button"
            class="aigen-style-seg__btn"
            :class="{ 'is-active': getStyle('justifyItems') === opt.val }"
            @click="setStyle('justifyItems', opt.val, '调整网格水平对齐')"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="aigen-style-row">
        <span class="aigen-style-row__label">多行对齐</span>
        <div class="aigen-style-seg">
          <button
            v-for="opt in [
              { label: '顶', val: 'start' },
              { label: '中', val: 'center' },
              { label: '底', val: 'end' },
              { label: '均分', val: 'space-between' },
            ]"
            :key="opt.val"
            type="button"
            class="aigen-style-seg__btn"
            :class="{ 'is-active': getStyle('alignContent') === opt.val }"
            @click="setStyle('alignContent', opt.val, '调整网格内容对齐')"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <Teleport to="body">
        <div
          v-if="showGridModal"
          class="aigen-spacing-mask"
          @click="showGridModal = false"
        ></div>
        <div
          v-if="showGridModal"
          class="aigen-style-popover"
          :style="gridPopoverStyle"
          @click.stop
        >
          <div class="aigen-sp-head">
            <span class="aigen-sp-title">网格配置</span>
            <button
              type="button"
              class="aigen-sp-auto"
              :class="{ 'is-active': gridLockGap }"
              title="锁定行列间距"
              @click="gridLockGap = !gridLockGap"
            >
              {{ gridLockGap ? '间距联动' : '独立间距' }}
            </button>
          </div>

          <div class="aigen-style-grid-2">
            <div class="aigen-style-field">
              <span class="aigen-style-field__label">列间距</span>
              <div class="aigen-style-unit-box">
                <input
                  type="number"
                  :value="colGap"
                  placeholder="0"
                  @change="
                    updateGap('col', ($event.target as HTMLInputElement).value)
                  "
                />
                <span class="aigen-style-unit-tag">px</span>
              </div>
            </div>
            <div class="aigen-style-field">
              <span class="aigen-style-field__label">行间距</span>
              <div class="aigen-style-unit-box">
                <input
                  type="number"
                  :value="rowGap"
                  placeholder="0"
                  @change="
                    updateGap('row', ($event.target as HTMLInputElement).value)
                  "
                />
                <span class="aigen-style-unit-tag">px</span>
              </div>
            </div>
          </div>

          <div class="aigen-style-row">
            <span class="aigen-style-row__label">方向</span>
            <div class="aigen-style-seg">
              <button
                type="button"
                class="aigen-style-seg__btn"
                :class="{ 'is-active': baseFlow === 'row' }"
                @click="updateGridFlow('row', isDense)"
              >
                横向
              </button>
              <button
                type="button"
                class="aigen-style-seg__btn"
                :class="{ 'is-active': baseFlow === 'column' }"
                @click="updateGridFlow('column', isDense)"
              >
                纵向
              </button>
            </div>
            <label class="aigen-grid-dense">
              <input
                type="checkbox"
                :checked="isDense"
                @change="
                  updateGridFlow(
                    baseFlow,
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              />
              Dense
            </label>
          </div>

          <!-- 列列表 -->
          <div class="aigen-grid-track-sec">
            <div class="aigen-sp-head">
              <span class="aigen-sp-title">列 ({{ gridCols.length }})</span>
              <button
                type="button"
                class="aigen-sp-auto"
                @click="addTrack('cols')"
              >
                + 添加
              </button>
            </div>
            <div class="aigen-grid-track-list">
              <div
                v-for="(col, i) in gridCols"
                :key="i"
                class="aigen-grid-track-item"
              >
                <input
                  type="text"
                  :value="col"
                  @change="
                    editTrack(
                      'cols',
                      i,
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
                <button
                  type="button"
                  title="删除"
                  @click="removeTrack('cols', i)"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          <!-- 行列表 -->
          <div class="aigen-grid-track-sec">
            <div class="aigen-sp-head">
              <span class="aigen-sp-title">行 ({{ gridRows.length }})</span>
              <button
                type="button"
                class="aigen-sp-auto"
                @click="addTrack('rows')"
              >
                + 添加
              </button>
            </div>
            <div class="aigen-grid-track-list">
              <div
                v-for="(row, i) in gridRows"
                :key="i"
                class="aigen-grid-track-item"
              >
                <input
                  type="text"
                  :value="row"
                  @change="
                    editTrack(
                      'rows',
                      i,
                      ($event.target as HTMLInputElement).value,
                    )
                  "
                />
                <button
                  type="button"
                  title="删除"
                  @click="removeTrack('rows', i)"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>

<style lang="less" scoped>
.aigen-layout-display {
  position: relative;
}

.aigen-layout-caret {
  flex-shrink: 0;
  opacity: 0.75;
}

.aigen-layout-menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 30;
  margin-top: 4px;
  width: 152px;
  padding: 4px;
  border: 1px solid var(--aigen-border);
  border-radius: 6px;
  background: var(--aigen-designer-background);
  box-shadow: 0 6px 18px rgb(0 0 0 / 12%);
  display: flex;
  flex-direction: column;
  gap: 2px;

  &__item {
    height: 26px;
    padding: 0 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--aigen-text-main);
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;

    &:hover {
      background: var(--aigen-muted);
    }

    &.is-active {
      color: var(--aigen-primary);
      background: var(--aigen-primary-faded);
      font-weight: 600;
    }
  }

  &__code {
    font-size: 10px;
    color: var(--aigen-text-helper);
    font-family: ui-monospace, monospace;
  }
}

.aigen-grid-edit-btn {
  flex: 1;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  background: var(--aigen-secondary);
  color: var(--aigen-text-main);
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;

  &:hover {
    border-color: var(--aigen-primary);
    color: var(--aigen-primary);
  }
}

.aigen-grid-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--aigen-primary);
}

.aigen-grid-dense {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--aigen-text-secondary);
  cursor: pointer;
}

.aigen-grid-track-sec {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.aigen-grid-track-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 110px;
  overflow-y: auto;
}

.aigen-grid-track-item {
  display: flex;
  align-items: center;
  gap: 4px;

  input {
    flex: 1;
    height: 24px;
    padding: 0 6px;
    border: 1px solid var(--aigen-border);
    border-radius: 4px;
    font-size: 12px;
    outline: none;
  }

  button {
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--aigen-text-helper);
    cursor: pointer;

    &:hover {
      background: var(--aigen-muted);
      color: #ef4444;
    }
  }
}
</style>
