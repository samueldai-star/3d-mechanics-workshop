repo: samueldai-star/3d-mechanics-workshop
branch: main
path: design

## 設計端 → repo 對照
| 專案根目錄 | repo 路徑 |
|---|---|
| mechanics-workshop.dc.html | design/mechanics-workshop.dc.html |
| mechanics-workshop-v1.dc.html | design/mechanics-workshop-v1.dc.html |
| 同步契約與交接說明.md | design/同步契約與交接說明.md |
| support.js | （不進 repo） |

## Last sync
date: 2026-08-25T00:00:00Z

### Updated in this project
- 新增三個目的場景（拋射訓練場、中央走廊、天文塔）與場景切換系統 `AREAS` / `applyArea()`。
- 三扇出入口各自的轉場動畫：木門推開、符文依序點亮＋能量薄膜、螺旋梯盤旋上升。
- 新增九個場景角落（catapult / ruler / targets / chain / heat / entropy / kepler / cannon / telescope）。
- 模擬器面板主題擴充為 warm / cool / night 三套，依場景自動套用。

## Screen map
| 專案畫面 | 對應 repo 檔案 |
|---|---|
| mechanics-workshop.dc.html — 工坊總覽場景（九角落、長桌、三出入口、天窗） | （尚無） |
| mechanics-workshop.dc.html — 拋射訓練場（range） | （尚無；建議 `src/areas/range`） |
| mechanics-workshop.dc.html — 中央走廊（corridor） | （尚無；建議 `src/areas/corridor`） |
| mechanics-workshop.dc.html — 天文塔（tower） | （尚無；建議 `src/areas/tower`） |
| 場景定義 `AREAS`、出入口 `EXITS`（含轉場 kind） | （建議 repo `src/areas.js`） |
| 角落定義 `CORNERS`（18 筆，含 `area`） | （建議 repo `src/corners.js`） |
| 模擬器面板（warm / cool / night 三套主題） | （尚無；待 `src/simulators/*`） |
| 同步契約 | `design/同步契約與交接說明.md`（需以本專案最新版覆寫） |

## 待 repo 端建立（下次 sync 會抓）
- `src/corners.js`：18 角落定義（含 `area` 與 tabs 清單）
- `src/simulators/<cornerId>/<tabIndex>`：各分頁模擬器，介面 `mount / unmount / onReadouts / reset`
- 優先順序：旋轉圓盤（力矩方向 3D 右手定則、力矩量值、角動量守恆）→ 砲台拋射 → 克卜勒軌道

## Sync history
### 2026-08-21
- 依場景描述稿 v2 全面改版工坊：九角落、中央橡木長桌、三出入口、天窗光柱、科技感疊加層、可收合工坊地圖。
- 舊版（四角落）存為 `mechanics-workshop-v1.dc.html`。

### 2026-08-26
- 主檔名改為 ASCII：`mechanics-workshop.dc.html`（舊版 `mechanics-workshop-v1.dc.html`），避免中文檔名被轉義導致預覽找不到檔案。
