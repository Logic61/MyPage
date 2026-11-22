# 山中书斋：设计与素材记录

本轮在 `feat/mountain-study-20261122` 分支中开发，起点为 `430219dfd79e348201850e3de5d2645a8eb8b8b8`。目标是把个人主页做成可进入、可探索的山中书斋，同时保留文章独立地址与完整阅读体验。

## 空间与内容

- 山景中的洞门进入书斋；同时提供清楚的文字入口。
- 书堆通向真实文章目录，摊开的笔记通向最近文章。
- 工作台通向项目，信纸通向作者简介。
- 共用导航继续提供博客、项目、简历、搜索、主题与语言切换。
- 文章保持正常排版、公式、代码和目录，阅读后可回到书斋。
- 物件位置保持固定；手机增加明确且足够大的文字入口，避免依赖悬停。

## 场景素材

素材使用内置 ImageGen 生成，由 Sharp 转为 WebP（质量 88），未裁切、未缩放。原有山景资源保持独立；新增外景以 `src/assets/home-cloudscape.webp` 为参考编辑，新增内景延续其青绿矿物色与绢本质感。

| 资源 | 尺寸 | 文件大小 |
| --- | --- | --- |
| `public/scenes/mountain-gate.webp` | 1672 × 941 | 238612 bytes |
| `public/scenes/cave-study.webp` | 1672 × 941 | 401022 bytes |

热点坐标相对于完整图像左上角，必须与画布使用相同的缩放与位移；若未来加入 cover 裁切，应同时补偿坐标。

| 物件 | 中心 x / y | 建议覆盖范围 x / y |
| --- | --- | --- |
| 洞门 | 83.2% / 76.8% | 80–87% / 69.5–84% |
| 书堆 | 25.6% / 55.2% | 18.3–33% / 47–63.5% |
| 摊开笔记 | 48.1% / 72.1% | 33.3–62.9% / 63.7–80.5% |
| 工作台终端 | 83.8% / 47.2% | 78.3–89.6% / 41.4–53.1% |
| 信纸 | 77.9% / 77.4% | 68.8–87.1% / 71.7–83.1% |

### 内景生成提示词

> Use case: stylized-concept. Asset type: production background illustration for an interactive personal website, one single uninterrupted wide 16:9 image. Create the interior of a quiet scholar's mountain-cave study. Match the sophisticated visual language of classical Chinese blue-green mineral landscape painting on warm aged silk: finely drawn irregular rocks, delicately brushed pine mountains beyond the window, muted malachite and azurite, warm parchment, low-contrast hand-painted textures, restrained gold-ochre details. Mature atmospheric painting, spatially coherent and inhabitable, not cartoon and not photorealistic. View from the entrance, gentle elevated eye level, the whole room visible. Natural softly illuminated rock walls and an expansive irregular window opening in the center-right show pale teal mountains and drifting cream clouds. Warm worn wooden furniture, light stone floor, daylight fills the room with a small local amber lamplight. Preserve clear separation and visibility of these FOUR INTERACTIVE OBJECT GROUPS: (1) At approximately 24% across and 60% down the image, a conspicuous pile of cloth-bound books beside a low wooden bookcase near the left side of the window. (2) At 48% across and 72% down, a large open notebook on the main foreground wooden desk, blank pale cream pages facing the viewer. (3) At 78% across and 58% down, a separate right-side workbench with a single small understated dark wooden/brass terminal-like instrument, a dark rectangular inset face and no glowing display, visibly distinct from books. (4) At 72% across and 80% down, an isolated pale handwritten-letter-shaped sheet and envelope with no legible text, lying on the right foreground part of the desk with plenty of space around it. Keep these objects large enough to identify as website hotspots, do not clutter or obscure them. Cozy human traces in the desk and gently uneven books, but no people. Window light should lead the eye to the desk and books. All objects belong to the scene, no labels and no UI. No black or charred cavern, no magic circles, no fantasy game HUD, no neon, no high fantasy props, no visible text or lettering, no logo, no watermark, no border, no collage. Wide landscape composition with the full room and furniture comfortably inside frame.

### 外景编辑提示词

> Use case: precise-object-edit. Edit target: the supplied existing Chinese blue-green mountain landscape artwork. Produce ONE wide 16:9 production scene, preserve this exact artwork's overall composition and mature aesthetic. Change only a small local area on the lower-right foreground mountainside to add a scholar's cave entrance and a short believable stone approach. Preserve the existing main tall mountain in the right background, the broad pine trees, all clouds and distant peaks, waterfall, crescent moon, birds, and especially the large pale empty expanse across the left half. Preserve restrained malachite/azurite mineral colors, delicate classical brushwork, warm silk texture, muted golden details and atmospheric depth. Add a clearly visible open natural arched cave doorway carved into the near right cliff, with its center approximately 74 percent across and 67 percent down the entire canvas; integrate the rock and a little ledge naturally if needed. The opening should occupy about 7 to 9 percent of canvas width and 12 to 15 percent of canvas height so it reads unmistakably as a clickable portal. A small warm amber light glows from the shallow visible interior and gently touches the threshold; no white overexposure. A short run of irregular pale stone steps, roughly five to seven steps, leads from the lower-right ledge up to this entrance and feels anchored in real rock. It is the modest entrance to a peaceful inhabited study, with a plain warm wooden door frame if needed, not an ornate temple or fantasy fortress. Keep local light subtle and preserve the existing scene's daylight. Do not add any other building, character, extra mountain, large object, text, writing, plaque, sign, label, border, logo, watermark, HUD or UI. Do not repaint the rest of the picture. The result should look like the cave doorway and steps were always part of the original painting.

## 开发与兼容

使用项目原有 Node/Astro 工具链。先运行 `npm ci`，再运行 `npm run dev`；本地首页路径仍为 `/MyPage/`，英文为 `/MyPage/en/`。生产构建使用 `npm run build`。

所有新增链接与资源应遵守 `BASE_URL`。文章链接复用 `postSlug()`，保持中文、英文与既有英文重定向兼容。场景样式限定在首页，避免影响文章、归档、简历与项目页。

此起点不含此前在离线电脑中进行的匿名评论后端改造。合并这条分支前，应在有该工作的工作区核对；本轮不新增或更改评论服务。

## 本轮验证

- `npm run astro -- sync` 与 `npm run build` 成功，生产构建生成 296 个页面。
- 中英文首页的站内链接与场景资源路径检查通过，`git diff --check` 通过。
- 在生产构建预览中实际走通：山门进入书斋、藏书目录、分类筛选、打开文章、回到书斋；目录包含 96 篇文章，近作展示最近 8 篇。
- 搜索输入 `Sperner` 能找到对应文章；语言切换保留书斋状态；主题按钮可切换并恢复浅色模式。
- 在 390 × 844 的窄屏视口中检查山门、书斋与近作目录，完整画面与文字入口均可使用。此项为浏览器窄屏检查，不代表真实设备测试。
- 键盘验证：进入书斋后焦点落在标题，Tab 到藏书入口，Enter 打开目录，Escape 关闭目录并将焦点还给入口。

本轮在功能分支上交付；不改变现有 `main` 分支部署流程。
