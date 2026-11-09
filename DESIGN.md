# Closet Me — Design System & UI Guidelines
**Version:** 1.0  
**Theme:** ChatGPT / Apple Minimal & Clean ("Noiseless Clarity")

---

## 1. Core Philosophy (設計思想)

1. **Noiseless Clarity (余計なものを削ぎ落とした美しさ)**
   * 派手なグラデーションや過剰な立体感・装飾枠を排除し、**純白の背景、繊細なボーダー、十分な余白（ホワイトスペース）、研ぎ澄まされたタイポグラフィ**で情報を際立たせます。
   * 「装飾で目立たせる」のではなく、「文字の太さ・サイズ・数字の強弱」で自然な視線誘導を作ります。

2. **Widget vs. Conversation (データと対話の役割分担)**
   * **カード（ウィジェット）**: 数値、ステータス、時間帯推移、アイテム一覧などの「客観的データ」に特化。スキャンしやすく、コンパクトにまとめる。
   * **テキスト（カードの外）**: コンシェルジュからの主観的アドバイス、気遣い、対話の文脈を届ける。

3. **Restraint in Tone & Personality (上質で知的なトーン＆マナー)**
   * おもちゃのような絵文字（😊、🤖、☀️等）の乱用を廃止。
   * 洗練されたLucideベクターアイコンと、落ち着いた知的な語り口（過剰なおべっかや機械感を排したプロフェッショナルな対話）で統一します。

---

## 2. Design Tokens (デザイントークン)

### 2.1 Color Palette (カラー設計)

* **Backgrounds**:
  * メインキャンバス: `bg-zinc-50` または `bg-[#fafafa]`
  * カード・コンポーネント: `bg-white`
  * サブエリア（インナーボックス、リスト背景）: `bg-zinc-50/80`
* **Borders**:
  * カード枠線: `border border-zinc-200/80`
  * インナー区切り線: `border-t border-zinc-100`
  * 控えめな仕切り: `border-zinc-200/60`
* **Typography Colors**:
  * プライマリ見出し / 重要数値: `text-zinc-900` (#18181b)
  * 本文 / サブ見出し: `text-zinc-700` (#3f3f46)
  * 補助説明 / 箇条書き: `text-zinc-600` (#52525b)
  * メタデータ / ラベル / 補足: `text-zinc-400` (#a1a1aa)
* **Semantic Accents (アクセントカラー - 必要な箇所のみ控えめに)**:
  * 晴天 / 注目: Amber (`bg-amber-50 text-amber-700 border-amber-200/60`, アイコン `text-amber-500`)
  * 雨天 / カレンダー: Sky / Blue (`bg-sky-50 text-sky-700 border-sky-200/60`, アイコン `text-sky-500`)
  * 良好 / 適合 / 快適: Emerald (`bg-emerald-50 text-emerald-700 border-emerald-200/60`)
  * 最高気温 / 警告: Rose (`text-rose-500`)
  * 夜間: Indigo (`text-indigo-400`)

### 2.2 Corner Radius (角丸)

* カード・ウィジェット外枠: `rounded-2xl` (16px) または `rounded-3xl` (24px)
* インナーボックス / チップ / ボタン: `rounded-xl` (12px)
* バッジ / ピルタグ: `rounded-full` (9999px)

### 2.3 Shadow (陰影)

* 強いドロップシャドウは使わず、繊細な境界線とごく薄いシャドウを組み合わせます。
* カード: `shadow-xs` または `shadow-sm`
* ホバー時: `hover:border-zinc-300 hover:shadow-sm`

---

## 3. Typography & Hierarchy (タイポグラフィ階層)

| 役割 | Tailwind クラス | 適用例 |
| :--- | :--- | :--- |
| **巨大数値 (Key Stat)** | `text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900` | 現在の気温（16℃）、総合Clo値 |
| **カードタイトル** | `text-sm sm:text-base font-bold text-zinc-900` | 地域名、コーデ提案タイトル |
| **セクション見出し** | `text-xs sm:text-sm font-semibold text-zinc-900` | 「今日の予報」「これからの天気」「コーディネート詳細」 |
| **本文・箇条書き** | `text-xs sm:text-sm text-zinc-600 leading-relaxed` | お出かけアドバイス、提案理由 |
| **ラベル・キャプション** | `text-[11px] font-medium text-zinc-400` | 「現在の気温」「Option 01」「断熱性指標」 |

---

## 4. Iconography (アイコン規約)

* **原則**: 絵文字は原則廃止（UI内の構造化要素には使用しない）。
* **Lucide React** の細線ベクターアイコンを使用。
* **サイズと色**:
  * メインステータス: `h-10 w-10` 〜 `h-11 w-11`（色: `text-amber-500`, `text-sky-500` 等）
  * リスト・見出し横: `h-3.5 w-3.5` 〜 `h-4 w-4`（色: `text-zinc-500` または意味に応じたアクセント色）
  * インライン補助: `h-3 w-3`（色: `text-zinc-400`）

---

## 5. Component Refactoring Roadmap (コンポーネント刷新計画)

### Phase 1: 天気ウィジェット & コンシェルジュ対話 (完了 ✅)
- [x] 天気カードのChatGPT風リニューアル（ヘッダー、大型気温、今日の予報、時間帯別推移）
- [x] コンシェルジュアドバイスをカード外（メッセージ本文）に分離
- [x] 下部サジェストチップに「今日の天気」を常設

### Phase 2: コーデ提案カード (`ChatAttachmentOutfits`) (完了 ✅)
- [x] カルーセルカードの過剰なボーダー・バッジを整理
- [x] 各コーデの「タイトル」「メインアイテム写真」「Clo値」を際立たせるミニマルな構成
- [x] 「今日これを着る」「入替」アクションをスマートに洗練
- [x] 被服気候学の科学的スコア（熱適合・色彩調和・TPO）と提案理由をすっきりアコーディオン化

### Phase 3: チャット入力バー & サジェストチップ (`ChatComposer`) (完了 ✅)
- [x] **Apple Spotlight風 モーフィング・カプセルUI (Morphing Capsule Design)**:
  - **通常時（コンパクト）**: 画面下部中央に、小さく控えめなカプセルバー（`場所・気分・服を入力...` ＋ カメラアイコン）を配置。上部には会話フェーズに応じた浮遊ピル（選択肢）を中央揃えで配置し、画面の視覚的重心と余白を美しく保つ。
  - **展開時（必要な時だけ拡大）**: カプセルをタップした瞬間にスッと横幅いっぱいにモーフィング拡大。用途別タブ（すべて / テイスト / 場所・天気 / 服の登録）と1タップ例文、テキスト入力フォームが立ち上がる。
  - **自動復帰**: 外側クリック、送信、または `Esc` / `閉じる` ボタンで元の小さなカプセルにスマートに戻る。

### Phase 4: クローゼット & スケジュールカード (`wardrobe_view`, `schedule_settings`) (完了 ✅)
- [x] 手持ち服のカテゴリタブとグリッド表示をクリーンなギャラリースタイルに刷新
- [x] スケジュールタイムライン（時間、予定名、ピンポイント天気）の整流化と上質ピルデザインへの統一

---

## 6. Implementation Reference (実装リファレンス)

### カード外枠の標準テンプレート
```tsx
<div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 space-y-4 shadow-xs w-full max-w-lg">
  {/* ヘッダー: タイトル + 右側ピルバッジ */}
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2 font-bold text-zinc-900 text-sm sm:text-base">
      <Icon className="h-4 w-4 text-zinc-500 shrink-0" />
      <span>タイトル</span>
    </div>
    <span className="rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200/60 px-2.5 py-0.5 text-xs font-medium">
      ステータス
    </span>
  </div>

  {/* メイン数値 / コンテンツ */}
  ...

  {/* 区切り線 */}
  <div className="border-t border-zinc-100" />

  {/* 下部アクション */}
  ...
</div>
```
