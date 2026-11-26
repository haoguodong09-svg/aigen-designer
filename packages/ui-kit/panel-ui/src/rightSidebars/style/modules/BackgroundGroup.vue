<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { AigenIcon } from '@aigen-designer/base-ui';

import { useStyleState } from '../composables/useStyleState';
import StyleColorPicker from './StyleColorPicker.vue';
import StyleSelect from './StyleSelect.vue';

const BG_CLIP_OPTIONS = [
  { label: 'None - 无', value: '' },
  { label: 'padding-box 裁剪到padding', value: 'padding-box' },
  { label: 'content-box 裁剪到content', value: 'content-box' },
  { label: 'text 裁剪到文字', value: 'text' },
];

const RADIAL_SIZE_OPTIONS = [
  'farthest-corner',
  'closest-side',
  'closest-corner',
  'farthest-side',
];

const BG_REPEAT_OPTIONS = [
  { label: 'no-repeat (不重复)', value: 'no-repeat' },
  { label: 'repeat (平铺)', value: 'repeat' },
  { label: 'repeat-x (水平)', value: 'repeat-x' },
  { label: 'repeat-y (垂直)', value: 'repeat-y' },
];

type BgLayerType = 'image' | 'linear' | 'overlay' | 'radial';

interface ColorStop {
  color: string;
  pos: number;
}

interface BgLayer {
  angle: number;
  attachment: 'fixed' | 'scroll';
  height: string;
  id: string;
  imageSizeMode: 'contain' | 'cover' | 'custom';
  imageUrl: string;
  overlayColor: string;
  posX: string;
  posY: string;
  radialSize:
    | 'closest-corner'
    | 'closest-side'
    | 'farthest-corner'
    | 'farthest-side';
  repeat: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
  repeatGradient: boolean;
  stops: ColorStop[];
  type: BgLayerType;
  visible: boolean;
  width: string;
}

const { batchSetStyle, getStyle, selectedNode, setStyle } = useStyleState();

const bgColor = computed(() => getStyle('backgroundColor'));
const bgClip = computed(() => getStyle('backgroundClip'));

const layers = ref<BgLayer[]>([]);
const activeLayerIdx = ref<null | number>(null);
const popoverOpen = ref(false);
const anchorRect = ref<DOMRect | null>(null);

// 切换节点时从 backgroundImage 简单同步展示图层
watch(
  () => selectedNode.value?.id,
  () => {
    popoverOpen.value = false;
    activeLayerIdx.value = null;
    const raw = getStyle('backgroundImage');
    if (!raw || raw === 'none') {
      layers.value = [];
      return;
    }
    layers.value = [
      {
        angle: 180,
        attachment:
          (getStyle('backgroundAttachment') as 'fixed' | 'scroll') || 'scroll',
        height: 'auto',
        id: `bg_${Date.now()}`,
        imageSizeMode: 'cover',
        imageUrl: raw.startsWith('url(')
          ? raw.slice(4, -1).replaceAll(/["']/g, '')
          : '',
        overlayColor: 'rgba(0, 0, 0, 0.35)',
        posX: '50%',
        posY: '50%',
        radialSize: 'farthest-corner',
        repeat:
          (getStyle('backgroundRepeat') as BgLayer['repeat']) || 'no-repeat',
        repeatGradient: raw.includes('repeating-'),
        stops: [
          { color: '#1677ff', pos: 0 },
          { color: '#69b1ff', pos: 100 },
        ],
        type: raw.includes('radial-gradient')
          ? 'radial'
          : raw.includes('linear-gradient')
            ? 'linear'
            : 'image',
        visible: true,
        width: 'auto',
      },
    ];
  },
  { immediate: true },
);

function serializeLayer(layer: BgLayer): string {
  const stopsStr = [...layer.stops]
    .sort((a, b) => a.pos - b.pos)
    .map((s) => `${s.color} ${s.pos}%`)
    .join(', ');
  if (layer.type === 'overlay') {
    return `linear-gradient(${layer.overlayColor}, ${layer.overlayColor})`;
  }
  if (layer.type === 'linear') {
    const fn = layer.repeatGradient
      ? 'repeating-linear-gradient'
      : 'linear-gradient';
    return `${fn}(${layer.angle}deg, ${stopsStr})`;
  }
  if (layer.type === 'radial') {
    const fn = layer.repeatGradient
      ? 'repeating-radial-gradient'
      : 'radial-gradient';
    return `${fn}(circle ${layer.radialSize} at ${layer.posX} ${layer.posY}, ${stopsStr})`;
  }
  return layer.imageUrl ? `url("${layer.imageUrl}")` : '';
}

function syncLayersToStyle() {
  const active = layers.value.filter((l) => l.visible);
  const bgImages = active.map(serializeLayer).filter(Boolean);
  if (bgImages.length === 0) {
    batchSetStyle(
      {
        backgroundAttachment: undefined,
        backgroundImage: undefined,
        backgroundPosition: undefined,
        backgroundRepeat: undefined,
        backgroundSize: undefined,
      },
      '清除背景图层',
    );
    return;
  }
  const imgLayer = active.find((l) => l.type === 'image');
  batchSetStyle(
    {
      backgroundAttachment: imgLayer?.attachment,
      backgroundImage: bgImages.join(', '),
      backgroundPosition: imgLayer
        ? `${imgLayer.posX} ${imgLayer.posY}`
        : undefined,
      backgroundRepeat: imgLayer?.repeat,
      backgroundSize: imgLayer
        ? imgLayer.imageSizeMode === 'custom'
          ? `${imgLayer.width || 'auto'} ${imgLayer.height || 'auto'}`
          : imgLayer.imageSizeMode
        : undefined,
    },
    '更新背景图层',
  );
}

function addLayer(e: MouseEvent) {
  const layer: BgLayer = {
    angle: 180,
    attachment: 'scroll',
    height: 'auto',
    id: `bg_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    imageSizeMode: 'cover',
    imageUrl: '',
    overlayColor: 'rgba(22, 119, 255, 0.25)',
    posX: '50%',
    posY: '50%',
    radialSize: 'farthest-corner',
    repeat: 'no-repeat',
    repeatGradient: false,
    stops: [
      { color: '#1677ff', pos: 0 },
      { color: '#69b1ff', pos: 100 },
    ],
    type: 'linear',
    visible: true,
    width: 'auto',
  };
  layers.value.push(layer);
  activeLayerIdx.value = layers.value.length - 1;
  anchorRect.value = (e.currentTarget as HTMLElement).getBoundingClientRect();
  popoverOpen.value = true;
  syncLayersToStyle();
}

function editLayer(idx: number, e: MouseEvent) {
  activeLayerIdx.value = idx;
  anchorRect.value = (e.currentTarget as HTMLElement).getBoundingClientRect();
  popoverOpen.value = true;
}

function removeLayer(idx: number) {
  layers.value.splice(idx, 1);
  if (activeLayerIdx.value === idx) popoverOpen.value = false;
  syncLayersToStyle();
}

function toggleLayerVisible(idx: number) {
  layers.value[idx].visible = !layers.value[idx].visible;
  syncLayersToStyle();
}

const currentLayer = computed(() =>
  activeLayerIdx.value === null
    ? null
    : (layers.value[activeLayerIdx.value] ?? null),
);

const popoverStyle = computed(() => {
  if (!anchorRect.value) return {};
  return {
    left: `${Math.max(8, Math.min(window.innerWidth - 260, anchorRect.value.left - 180))}px`,
    top: `${Math.max(8, Math.min(window.innerHeight - 360, anchorRect.value.bottom + 6))}px`,
    width: '252px',
  };
});

const ANCHOR_POINTS = [
  { x: '0%', y: '0%' },
  { x: '50%', y: '0%' },
  { x: '100%', y: '0%' },
  { x: '0%', y: '50%' },
  { x: '50%', y: '50%' },
  { x: '100%', y: '50%' },
  { x: '0%', y: '100%' },
  { x: '50%', y: '100%' },
  { x: '100%', y: '100%' },
];

const LAYER_LABELS: Record<BgLayerType, string> = {
  image: '背景图',
  linear: '线性渐变',
  overlay: '颜色叠加',
  radial: '径向渐变',
};

function reverseStops() {
  if (!currentLayer.value) return;
  currentLayer.value.stops = currentLayer.value.stops.map((s) => ({
    ...s,
    pos: 100 - s.pos,
  }));
  syncLayersToStyle();
}
</script>

<template>
  <div class="aigen-style-group-body">
    <!-- 背景图 & 渐变图层栏 -->
    <div class="aigen-style-row">
      <span class="aigen-style-row__label" style="width: 84px">
        背景图 &amp; 渐变
      </span>
      <div class="aigen-style-row__ctrl" style="justify-content: flex-end">
        <button
          type="button"
          class="aigen-bg-add-btn"
          title="添加背景图，线性渐变，径向渐变等"
          @click="addLayer"
        >
          <AigenIcon name="icon--aigen--add-rounded" />
        </button>
      </div>
    </div>

    <div v-if="layers.length > 0" class="aigen-bg-layers">
      <div
        v-for="(layer, idx) in layers"
        :key="layer.id"
        class="aigen-bg-layer-item"
        @click="editLayer(idx, $event)"
      >
        <span
          class="aigen-bg-layer-preview"
          :style="{ backgroundImage: serializeLayer(layer) }"
        ></span>
        <span class="aigen-bg-layer-name">{{ LAYER_LABELS[layer.type] }}</span>
        <button
          type="button"
          class="aigen-bg-layer-act"
          :title="layer.visible ? '隐藏' : '显示'"
          @click.stop="toggleLayerVisible(idx)"
        >
          <AigenIcon
            :name="
              layer.visible
                ? 'icon--aigen--visibility-outline-rounded'
                : 'icon--aigen--visibility-off-outline-rounded'
            "
          />
        </button>
        <button
          type="button"
          class="aigen-bg-layer-act is-del"
          title="删除图层"
          @click.stop="removeLayer(idx)"
        >
          <AigenIcon name="icon--aigen--close" />
        </button>
      </div>
    </div>

    <!-- 背景色 -->
    <div class="aigen-style-row">
      <span class="aigen-style-row__label">颜色</span>
      <StyleColorPicker
        :model-value="bgColor"
        placeholder="请输入颜色"
        @change="(val) => setStyle('backgroundColor', val, '调整背景色')"
      />
    </div>

    <!-- 裁剪 -->
    <div class="aigen-style-row">
      <span class="aigen-style-row__label">裁剪</span>
      <StyleSelect
        :model-value="bgClip"
        :options="BG_CLIP_OPTIONS"
        @change="
          (val) => setStyle('backgroundClip', val || undefined, '调整背景裁剪')
        "
      />
    </div>

    <!-- 4 Tab 背景设置 Popover -->
    <Teleport to="body">
      <div
        v-if="popoverOpen && currentLayer"
        class="aigen-spacing-mask"
        @click="popoverOpen = false"
      ></div>
      <div
        v-if="popoverOpen && currentLayer"
        class="aigen-style-popover"
        :style="popoverStyle"
        @click.stop
      >
        <div class="aigen-sp-head">
          <span class="aigen-sp-title">背景图 & 渐变设置</span>
        </div>

        <div class="aigen-style-seg">
          <button
            v-for="t in [
              'overlay',
              'linear',
              'radial',
              'image',
            ] as BgLayerType[]"
            :key="t"
            type="button"
            class="aigen-style-seg__btn"
            :class="{ 'is-active': currentLayer.type === t }"
            @click="
              () => {
                currentLayer!.type = t;
                syncLayersToStyle();
              }
            "
          >
            {{ LAYER_LABELS[t] }}
          </button>
        </div>

        <!-- Tab 1: 颜色叠加 -->
        <template v-if="currentLayer.type === 'overlay'">
          <div class="aigen-style-row">
            <span class="aigen-style-row__label">Color</span>
            <StyleColorPicker
              :model-value="currentLayer.overlayColor"
              placeholder="rgba(...)"
              @change="
                (val) => {
                  currentLayer!.overlayColor = val || 'transparent';
                  syncLayersToStyle();
                }
              "
            />
          </div>
        </template>

        <!-- Tab 2 & 3: 线性 / 径向渐变 -->
        <template
          v-if="
            currentLayer.type === 'linear' || currentLayer.type === 'radial'
          "
        >
          <div v-if="currentLayer.type === 'linear'" class="aigen-style-row">
            <span class="aigen-style-row__label">Angle</span>
            <div class="aigen-style-row__ctrl">
              <button
                type="button"
                class="aigen-bg-rot-btn"
                title="-45°"
                @click="
                  () => {
                    currentLayer!.angle = (currentLayer!.angle + 315) % 360;
                    syncLayersToStyle();
                  }
                "
              >
                ↺
              </button>
              <button
                type="button"
                class="aigen-bg-rot-btn"
                title="+45°"
                @click="
                  () => {
                    currentLayer!.angle = (currentLayer!.angle + 45) % 360;
                    syncLayersToStyle();
                  }
                "
              >
                ↻
              </button>
              <div class="aigen-style-unit-box">
                <input
                  v-model.number="currentLayer.angle"
                  type="number"
                  @change="syncLayersToStyle"
                />
                <span class="aigen-style-unit-tag">DEG</span>
              </div>
            </div>
          </div>

          <div v-else class="aigen-objpos-body">
            <div class="aigen-style-anchor-grid">
              <button
                v-for="(pt, idx) in ANCHOR_POINTS"
                :key="idx"
                type="button"
                class="aigen-style-anchor-grid__cell"
                :class="{
                  'is-active':
                    currentLayer.posX === pt.x && currentLayer.posY === pt.y,
                }"
                @click="
                  () => {
                    currentLayer!.posX = pt.x;
                    currentLayer!.posY = pt.y;
                    syncLayersToStyle();
                  }
                "
              ></button>
            </div>
            <StyleSelect
              v-model="currentLayer.radialSize"
              :options="RADIAL_SIZE_OPTIONS"
              @change="syncLayersToStyle"
            />
          </div>

          <div
            class="aigen-bg-grad-bar"
            :style="{ backgroundImage: serializeLayer(currentLayer) }"
          ></div>

          <div class="aigen-sp-head">
            <label class="aigen-grid-dense">
              <input
                v-model="currentLayer.repeatGradient"
                type="checkbox"
                @change="syncLayersToStyle"
              />
              Repeat
            </label>
            <button type="button" class="aigen-sp-auto" @click="reverseStops">
              ⇄ 反转色标
            </button>
          </div>

          <div
            v-for="(stop, sIdx) in currentLayer.stops"
            :key="sIdx"
            class="aigen-style-row"
          >
            <StyleColorPicker
              v-model="stop.color"
              placeholder="#hex"
              @change="syncLayersToStyle"
            />
            <div class="aigen-style-unit-box" style="max-width: 72px">
              <input
                v-model.number="stop.pos"
                type="number"
                min="0"
                max="100"
                @change="syncLayersToStyle"
              />
              <span class="aigen-style-unit-tag">%</span>
            </div>
          </div>
        </template>

        <!-- Tab 4: 背景图 -->
        <template v-if="currentLayer.type === 'image'">
          <div class="aigen-style-row">
            <span class="aigen-style-row__label">图片地址</span>
            <div class="aigen-style-unit-box">
              <input
                v-model="currentLayer.imageUrl"
                type="text"
                placeholder="https://... 或相对路径"
                @change="syncLayersToStyle"
              />
            </div>
          </div>
          <div class="aigen-style-row">
            <span class="aigen-style-row__label">大小</span>
            <div class="aigen-style-seg">
              <button
                v-for="m in ['custom', 'cover', 'contain'] as const"
                :key="m"
                type="button"
                class="aigen-style-seg__btn"
                :class="{ 'is-active': currentLayer.imageSizeMode === m }"
                @click="
                  () => {
                    currentLayer!.imageSizeMode = m;
                    syncLayersToStyle();
                  }
                "
              >
                {{ m }}
              </button>
            </div>
          </div>
          <div class="aigen-style-row">
            <span class="aigen-style-row__label">重复</span>
            <StyleSelect
              v-model="currentLayer.repeat"
              :options="BG_REPEAT_OPTIONS"
              @change="syncLayersToStyle"
            />
          </div>
          <div class="aigen-style-row">
            <span class="aigen-style-row__label">固定</span>
            <div class="aigen-style-seg">
              <button
                type="button"
                class="aigen-style-seg__btn"
                :class="{ 'is-active': currentLayer.attachment === 'scroll' }"
                @click="
                  () => {
                    currentLayer!.attachment = 'scroll';
                    syncLayersToStyle();
                  }
                "
              >
                不固定
              </button>
              <button
                type="button"
                class="aigen-style-seg__btn"
                :class="{ 'is-active': currentLayer.attachment === 'fixed' }"
                @click="
                  () => {
                    currentLayer!.attachment = 'fixed';
                    syncLayersToStyle();
                  }
                "
              >
                固定
              </button>
            </div>
          </div>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<style lang="less" scoped>
.aigen-bg-add-btn {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  background: var(--aigen-secondary);
  color: var(--aigen-text-main);
  font-size: 14px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    border-color: var(--aigen-primary);
    color: var(--aigen-primary);
  }
}

.aigen-bg-layers {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.aigen-bg-layer-item {
  height: 26px;
  padding: 0 6px;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  background: var(--aigen-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;

  &:hover {
    border-color: var(--aigen-primary);
  }
}

.aigen-bg-layer-preview {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid var(--aigen-border);
  background-size: cover;
  flex-shrink: 0;
}

.aigen-bg-layer-name {
  flex: 1;
  font-size: 11px;
  color: var(--aigen-text-main);
}

.aigen-bg-layer-act {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--aigen-text-helper);
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;

  &:hover {
    background: var(--aigen-muted);
    color: var(--aigen-text-main);
  }
  &.is-del:hover {
    color: #ef4444;
  }
}

.aigen-bg-rot-btn {
  width: 24px;
  height: 24px;
  border: 1px solid var(--aigen-border);
  border-radius: 4px;
  background: var(--aigen-secondary);
  cursor: pointer;
}

.aigen-bg-grad-bar {
  height: 16px;
  border-radius: 4px;
  border: 1px solid var(--aigen-border);
}
</style>
